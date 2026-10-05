/**
 * Copy accommodation photography from another site built on this platform
 * (Goldfinch Adventures by default) into this site's own storage, and attach it
 * to the lodges here that have the same slug or name.
 *
 * The source is read through its public API only, so no credentials for the
 * other site are needed. Every photo is downloaded and stored through this
 * site's normal upload path (original + thumbnail + media library row + the
 * responsive AVIF/WebP ladder), exactly as if an editor had uploaded it — the
 * copies live in this site's bucket and do not depend on the other site.
 *
 * Nothing is created or overwritten:
 *  - no lodge is created; source lodges with no match here are listed;
 *  - an image field (image_url, hero_image_url, …) is filled only when empty;
 *  - a gallery is filled only when the lodge has no gallery yet.
 * Photos hosted on a lodge's own website are linked, not copied, as the source
 * site does. Re-running is safe: a photo already copied (same file name in the
 * media library) is reused instead of uploaded again.
 *
 * Lodges are matched by slug, then by name. Where the same property is named
 * differently on the two sites, confirm the pair with --map (source slug =
 * slug here, comma-separated); the script never guesses.
 *
 * By default the photos are only uploaded into this site's media library
 * (labelled with their lodge's name, so editors can find and attach them);
 * --attach also links them to matching lodges as described above.
 *
 * Dry run (default — reads only, writes nothing):
 *   npm run media:copy-lodges -- --from https://goldfinch-adventures.com
 *   npm run media:copy-lodges -- --map mawe-mawe=mawe-mawe-lodge,sametu=serengeti-sametu-camp
 * Apply (upload only):
 *   npm run media:copy-lodges -- --from https://goldfinch-adventures.com --apply
 * Apply and attach to matching lodges:
 *   npm run media:copy-lodges -- --from https://goldfinch-adventures.com --attach --apply
 */
import { supabase } from '../config/supabase';
import { RESPONSIVE_WIDTHS, generateResponsiveVariants, uploadImageToStorage } from '../services/upload.service';
import { putR2Object, r2Enabled } from '../services/r2.service';

type Row = Record<string, unknown>;
type SourceImage = { image_url: string; alt_text?: string | null; caption?: string | null; sort_order?: number; is_cover?: boolean };
type SourceLodge = Row & { name: string; slug: string; images?: SourceImage[] };

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const attach = args.includes('--attach');
const fromArg = args[args.indexOf('--from') + 1];
const FROM = (fromArg && !fromArg.startsWith('--') ? fromArg : 'https://goldfinch-adventures.com').replace(/\/+$/, '');
const FOLDER = 'media';
const concurrencyArg = Number(args[args.indexOf('--concurrency') + 1]);
/** Photos processed at once. Copying is mostly network-bound, so this is safe to raise. */
const CONCURRENCY = args.includes('--concurrency') && concurrencyArg > 0 ? Math.min(16, concurrencyArg) : 8;
const mapArg = args[args.indexOf('--map') + 1];
/** Confirmed pairs: source slug → slug here. */
const MAP = new Map(
  (args.includes('--map') && mapArg && !mapArg.startsWith('--') ? mapArg : '')
    .split(',')
    .map((pair) => pair.split('=').map((part) => part.trim()))
    .filter((pair): pair is [string, string] => pair.length === 2 && Boolean(pair[0]) && Boolean(pair[1]))
);

// Lodge columns that hold a single photo. Derived fields (cover_image_url,
// *_thumbnail) are left out — this site computes its own.
const IMAGE_FIELDS = ['image_url', 'hero_image_url', 'mobile_hero_image_url', 'social_image_url'];

const MIME: Record<string, string> = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

const norm = (value: unknown) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');

const getJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return (await res.json()) as T;
};

/** Hosts the source site manages itself (its bucket, CDN or Supabase storage). */
let managedHosts = new Set<string>();
/** The source's CDN bucket origin (https://pub-….r2.dev), seen in its own photo URLs. */
let sourceCdn = '';
const isManaged = (url: string) => {
  try {
    const { hostname, pathname } = new URL(url);
    return managedHosts.has(hostname) || hostname.endsWith('.r2.dev') || pathname.includes('/storage/v1/object/public/');
  } catch {
    return false;
  }
};

const baseName = (url: string) => decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');

/**
 * A readable media-library name: "<lodge-slug>-01.avif", numbered in the order
 * the lodge shows its photos (single-photo fields, then the gallery), so the
 * same photo gets the same name on every run.
 */
const numbering = new Map<string, Map<string, number>>();
const photoName = (lodgeSlug: string, url: string): string => {
  const slug = lodgeSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'lodge';
  const forLodge = numbering.get(slug) ?? new Map<string, number>();
  numbering.set(slug, forLodge);
  if (!forLodge.has(url)) forLodge.set(url, forLodge.size + 1);
  const ext = (baseName(url).split('.').pop() ?? 'jpg').toLowerCase();
  return `${slug}-${String(forLodge.get(url)).padStart(2, '0')}.${ext}`;
};

const loadSource = async (): Promise<SourceLodge[]> => {
  const list = await getJson<{ data?: { items?: SourceLodge[] } }>(`${FROM}/api/lodges?limit=500`);
  const items = list.data?.items ?? [];
  const detailed: SourceLodge[] = [];
  for (const item of items) {
    try {
      const detail = await getJson<{ data?: SourceLodge }>(`${FROM}/api/lodges/${encodeURIComponent(item.slug)}`);
      detailed.push({ ...item, ...(detail.data ?? {}) });
    } catch (error) {
      console.warn(`  ! could not read "${item.name}": ${(error as Error).message}`);
      detailed.push(item);
    }
  }
  return detailed;
};

/**
 * Copy the source's ready-made responsive ladder (<folder>/responsive/<stem>/
 * <width>.webp|avif) next to the new original, instead of re-encoding it here —
 * AVIF encoding is what made a copy take ~16 s per photo. Returns the widths
 * copied; 0 means the source had none and the caller encodes them instead.
 */
const copyVariantsFrom = async (sourceUrl: string, newPath: string, mediaId: string): Promise<number> => {
  if (!r2Enabled) return 0;
  const clean = sourceUrl.split(/[?#]/)[0];
  const sourceStem = (clean.split('/').pop() ?? '').replace(/\.[^.]+$/, '');
  const sourceBase = `${clean.replace(/\/[^/]+$/, '')}/responsive/${sourceStem}`;
  const newStem = (newPath.split('/').pop() ?? '').replace(/\.[^.]+$/, '');
  const newBase = `${newPath.replace(/\/[^/]+$/, '')}/responsive/${newStem}`;

  const copyOne = async (width: number, ext: 'webp' | 'avif'): Promise<boolean> => {
    try {
      const res = await fetch(`${sourceBase}/${width}.${ext}`);
      if (!res.ok) return false;
      await putR2Object(`${newBase}/${width}.${ext}`, Buffer.from(await res.arrayBuffer()), `image/${ext}`);
      return true;
    } catch {
      return false;
    }
  };

  const results = await Promise.all(
    RESPONSIVE_WIDTHS.map(async (width) => {
      const [webp, avif] = await Promise.all([copyOne(width, 'webp'), copyOne(width, 'avif')]);
      return { width, webp, avif };
    })
  );
  const widths = results.filter((r) => r.webp).map((r) => r.width);
  if (!widths.length) return 0;
  const hasAvif = results.filter((r) => r.webp).every((r) => r.avif);
  await supabase.from('media_library').update({ variant_widths: widths, has_avif: hasAvif }).eq('id', mediaId);
  return widths.length;
};

/** Copied URL for a source photo; reuses an earlier copy of the same file. */
const copied = new Map<string, string>();
let uploadedCount = 0;
let reusedCount = 0;
let renamedCount = 0;
const copyPhoto = async (url: string, alt: string | null, caption: string | null, name: string): Promise<string | null> => {
  if (copied.has(url)) return copied.get(url)!;

  // Already copied — under this name, or under the source's own file name by an
  // earlier run (renamed here so the media library reads well).
  const { data: existing } = await supabase
    .from('media_library')
    .select('id,file_url,file_name,file_path,variant_widths')
    .in('file_name', [name, baseName(url)])
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (existing?.file_url) {
    if (existing.file_name !== name && apply) {
      await supabase.from('media_library').update({ file_name: name, caption }).eq('id', existing.id as string);
      renamedCount += 1;
    }
    // A run stopped part-way can leave a copy without its sizes; give it them.
    const sizes = Array.isArray(existing.variant_widths) ? existing.variant_widths.length : 0;
    if (apply && !sizes && existing.file_path) await copyVariantsFrom(url, String(existing.file_path), String(existing.id));
    copied.set(url, String(existing.file_url));
    reusedCount += 1;
    return String(existing.file_url);
  }

  if (!apply) {
    copied.set(url, `(new copy of ${name})`);
    uploadedCount += 1;
    return copied.get(url)!;
  }

  // A source row can still point at the source's old Supabase storage after the
  // file moved to its CDN bucket (the site serves it from there); read it there.
  let from = url;
  let res = await fetch(from);
  const storageKey = url.split('/storage/v1/object/public/')[1]?.split('/').slice(1).join('/');
  if (!res.ok && storageKey && sourceCdn) {
    from = `${sourceCdn}/${storageKey}`;
    res = await fetch(from);
  }
  if (!res.ok) {
    console.warn(`  ! download failed (${res.status}): ${url}`);
    return null;
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const mimetype = (res.headers.get('content-type') ?? '').split(';')[0] || MIME[ext] || 'image/jpeg';
  const file = { fieldname: 'file', originalname: name, encoding: '7bit', mimetype, size: buffer.length, buffer } as unknown as Express.Multer.File;

  const result = await uploadImageToStorage(file, FOLDER);
  const { data: media, error } = await supabase
    .from('media_library')
    .insert({
      alt_text: alt,
      caption,
      file_name: name,
      file_path: result.path,
      file_size: result.size,
      file_type: 'image',
      file_url: result.url,
      thumbnail_path: result.thumbnailPath ?? null,
      thumbnail_url: result.thumbnailUrl ?? null,
      mime_type: result.mimeType,
      width: result.width ?? null,
      height: result.height ?? null,
      aspect_ratio: result.aspectRatio ?? null,
      blurhash: result.blurhash ?? null,
      dominant_color: result.dominantColor ?? null
    })
    .select('id')
    .single();
  if (error || !media) {
    console.warn(`  ! media row not saved for ${name}: ${error?.message ?? 'unknown error'}`);
    return null;
  }
  // Sizes: copied from the source when it has them, otherwise encoded here.
  const copiedSizes = await copyVariantsFrom(from, result.path, String(media.id));
  if (!copiedSizes) await generateResponsiveVariants(String(media.id), result.processedBuffer, FOLDER, result.path);
  copied.set(url, result.url);
  uploadedCount += 1;
  return result.url;
};

const main = async () => {
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} — copying accommodation photos from ${FROM}\n`);
  managedHosts = new Set([new URL(FROM).hostname]);

  const source = await loadSource();
  sourceCdn =
    source
      .flatMap((lodge) => [...IMAGE_FIELDS.map((field) => lodge[field]), ...(lodge.images ?? []).map((image) => image.image_url)])
      .map((value) => {
        try {
          return new URL(String(value)).origin;
        } catch {
          return '';
        }
      })
      .find((origin) => origin.endsWith('.r2.dev')) ?? '';

  if (!attach) {
    // Upload only: every photo of every source lodge into the media library,
    // captioned with the lodge's name. No lodge is touched.
    let external = 0;
    // Names are assigned in the lodge's own photo order before anything runs,
    // so they are the same however the parallel uploads finish.
    const tasks: Array<{ url: string; alt: string | null; caption: string; name: string }> = [];
    const queued = new Set<string>();
    for (const lodge of source) {
      const urls: Array<{ url: string; alt: string | null }> = [];
      for (const field of IMAGE_FIELDS) {
        const url = typeof lodge[field] === 'string' ? String(lodge[field]).trim() : '';
        if (url) urls.push({ url, alt: String(lodge.name) });
      }
      for (const image of [...(lodge.images ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
        if (image?.image_url) urls.push({ url: image.image_url, alt: image.alt_text ?? String(lodge.name) });
      }
      for (const { url, alt } of urls) {
        if (!isManaged(url)) {
          external += 1;
          continue;
        }
        const name = photoName(lodge.slug, url);
        if (queued.has(url)) continue;
        queued.add(url);
        tasks.push({ url, alt, caption: String(lodge.name), name });
      }
    }

    console.log(`${tasks.length} photos, ${CONCURRENCY} at a time\n`);
    let next = 0;
    let finished = 0;
    const worker = async () => {
      while (next < tasks.length) {
        const task = tasks[next++];
        try {
          await copyPhoto(task.url, task.alt, task.caption, task.name);
        } catch (error) {
          console.warn(`  ! ${task.name}: ${(error as Error).message}`);
        }
        finished += 1;
        if (finished % 25 === 0 || finished === tasks.length) console.log(`• ${finished}/${tasks.length} photos`);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log(`
Source lodges:          ${source.length}
Photos ${apply ? 'uploaded' : 'to upload'}:       ${uploadedCount}${reusedCount ? ` (+${reusedCount} already in the media library, skipped)` : ''}
Lodge-website photos (not copied): ${external}${renamedCount ? `\nRenamed from an earlier run:  ${renamedCount}` : ''}`);
    console.log(apply ? '\nDone. Find them in CMS → Media, captioned with each lodge\'s name.' : '\nNothing was written. Re-run with --apply to upload.');
    return;
  }

  const { data: targetRows, error } = await supabase.from('lodges').select('*').is('deleted_at', null);
  if (error) throw new Error(`Could not read lodges here: ${error.message}`);
  const targets = (targetRows ?? []) as Row[];
  const columns = new Set(targets.length ? Object.keys(targets[0]) : IMAGE_FIELDS);
  const bySlug = new Map(targets.map((row) => [String(row.slug ?? ''), row]));
  const byName = new Map(targets.map((row) => [norm(row.name), row]));

  const unmatched: string[] = [];
  let fieldsFilled = 0;
  let fieldsKept = 0;
  let galleriesFilled = 0;
  let galleriesKept = 0;
  let galleryPhotos = 0;
  let linkedExternal = 0;

  for (const lodge of source) {
    const mapped = MAP.get(lodge.slug);
    if (mapped && !bySlug.has(mapped)) console.warn(`  ! --map ${lodge.slug}=${mapped}: no lodge here with slug "${mapped}"`);
    const target = (mapped ? bySlug.get(mapped) : undefined) ?? bySlug.get(lodge.slug) ?? byName.get(norm(lodge.name));
    if (!target) {
      unmatched.push(lodge.name);
      continue;
    }
    const label = `${lodge.name}${String(target.name) !== lodge.name ? ` → ${String(target.name)}` : ''}`;
    const photoFor = async (url: string, alt: string | null) => {
      if (!isManaged(url)) {
        linkedExternal += 1;
        return url;
      }
      return copyPhoto(url, alt, String(lodge.name), photoName(lodge.slug, url));
    };

    // Single-photo fields: only where this site has none.
    const update: Row = {};
    for (const field of IMAGE_FIELDS) {
      const url = typeof lodge[field] === 'string' ? String(lodge[field]).trim() : '';
      if (!url || !columns.has(field)) continue;
      if (String(target[field] ?? '').trim()) {
        fieldsKept += 1;
        continue;
      }
      const next = await photoFor(url, String(lodge.name));
      if (next) update[field] = next;
    }

    // Gallery: only when this lodge has none yet.
    const gallery = (lodge.images ?? []).filter((image) => image?.image_url).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    let galleryRows: Row[] = [];
    if (gallery.length) {
      const { count } = await supabase.from('lodge_images').select('id', { count: 'exact', head: true }).eq('lodge_id', target.id as string);
      if ((count ?? 0) > 0) {
        galleriesKept += 1;
      } else {
        const coverAt = Math.max(0, gallery.findIndex((image) => image.is_cover === true));
        for (const [index, image] of gallery.entries()) {
          const next = await photoFor(image.image_url, image.alt_text ?? null);
          if (!next) continue;
          galleryRows.push({
            lodge_id: target.id,
            image_url: next,
            alt_text: image.alt_text ?? null,
            caption: image.caption ?? null,
            sort_order: index,
            is_cover: index === coverAt
          });
        }
        // Exactly one cover (the database enforces it): keep it on the first row
        // that made it, if the flagged one could not be copied.
        if (galleryRows.length && !galleryRows.some((row) => row.is_cover)) galleryRows[0].is_cover = true;
      }
    }

    const fieldCount = Object.keys(update).length;
    fieldsFilled += fieldCount;
    if (galleryRows.length) {
      galleriesFilled += 1;
      galleryPhotos += galleryRows.length;
    }
    console.log(`• ${label}: ${fieldCount} field${fieldCount === 1 ? '' : 's'}, ${galleryRows.length} gallery photo${galleryRows.length === 1 ? '' : 's'}`);

    if (!apply) continue;
    if (fieldCount) {
      const { error: updateError } = await supabase.from('lodges').update(update).eq('id', target.id as string);
      if (updateError) console.warn(`  ! fields not saved for ${label}: ${updateError.message}`);
    }
    if (galleryRows.length) {
      const { error: insertError } = await supabase.from('lodge_images').insert(galleryRows);
      if (insertError) console.warn(`  ! gallery not saved for ${label}: ${insertError.message}`);
    }
    galleryRows = [];
  }

  console.log(`
Source lodges:            ${source.length}
Matched here:             ${source.length - unmatched.length}
Photos ${apply ? 'copied' : 'to copy'}:           ${uploadedCount}${reusedCount ? ` (+${reusedCount} already copied, reused)` : ''}
Lodge-website photos linked (not copied): ${linkedExternal}
Image fields filled:      ${fieldsFilled}  (kept ${fieldsKept} that already had a photo)
Galleries filled:         ${galleriesFilled} (${galleryPhotos} photos)  (kept ${galleriesKept} existing galleries)`);
  if (unmatched.length) console.log(`\nNo lodge here with the same slug or name (skipped):\n  - ${unmatched.join('\n  - ')}`);
  if (!apply) console.log('\nNothing was written. Re-run with --apply to copy.');
  else console.log('\nDone. Public pages show the photos once the public cache expires (or after any CMS save).');
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
