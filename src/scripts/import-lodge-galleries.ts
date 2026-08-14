/**
 * Import accommodation properties and their galleries from the renamed image set.
 *
 * Source of truth is the file name: "<Property> <NN>.avif" in the ALL IMAGES
 * folder gives both which property an image belongs to and the order it should
 * appear in. The sibling region/tier folders supply the destination and comfort
 * level. Nothing else is inferred — descriptions, prices, amenities and
 * "why we recommend" have no source in that folder and are left empty for an
 * editor rather than invented.
 *
 * Images are never uploaded: every file is matched to an existing media_library
 * row by exact file name, and only matched rows are attached.
 *
 * Dry run by default:
 *   npm run content:lodge-galleries -- --dir "/path/to/rename"
 * Apply:
 *   npm run content:lodge-galleries -- --dir "/path/to/rename" --apply
 */
import { readdirSync, statSync } from 'fs';
import path from 'path';
import { supabase } from '../config/supabase';

type Existing = { id: string; name: string; slug: string };

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dirArg = args[args.indexOf('--dir') + 1];
const ROOT = dirArg && !dirArg.startsWith('--') ? dirArg : path.join(process.env.HOME ?? '', 'Desktop', 'rename');

// Uppercase, per the 2026-08-12 accommodation-management migration which
// replaced the original lowercase check constraint.
const TIERS: Record<string, string> = { BUDGET: 'BUDGET', 'MID RANGE': 'MID_RANGE', LUXURY: 'LUXURY' };

/**
 * Folder names in the CMS and on disk drifted apart, so these are stated
 * explicitly. Without them the import would create a second copy of properties
 * that already exist.
 */
const ALIASES: Record<string, string> = {
  dove: 'Dove Serengeti Camp',
  kankari: 'Kankari Lodge',
  'safari haven': 'Safari Haven Tented Camp',
  'forest hill': 'Forest Hill Hotel',
  'grand melia': 'Gran Meliá Arusha',
  'heart and soul': 'Heart and Soul Lodge',
  'manyara secrete (wma)': "Manyara's Secret",
  'moyo tented camp': 'Moyo Tented Camp',
  'the retreat at ngorongoro': 'The Retreat at Ngorongoro'
};

/** Not properties: a region folder whose images sit loose beside the others. */
const SKIP = new Set(['dar,ruaha,mikumi,nyerere']);

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Read the property name out of "<Property> 04.avif". */
const propertyOf = (file: string) => clean(file.replace(/\s*\d+\s*\.avif$/i, '').replace(/\.avif$/i, ''));

/** Leading number gives the running order; the cover is simply the first. */
const orderOf = (file: string) => {
  const match = file.match(/(\d+)\s*\.avif$/i);
  return match ? Number(match[1]) : 9999;
};

/**
 * Comfort level and region come from the folder a property sits in. Regions
 * that span more than one destination (Arusha *and* Kilimanjaro; Karatu,
 * Manyara, Ngorongoro *and* Tarangire) are deliberately left unresolved unless
 * the property's own name names a destination.
 */
const readTree = (root: string) => {
  const meta = new Map<string, { region: string; tier: string }>();
  const regions = readdirSync(root).filter((entry) => {
    const full = path.join(root, entry);
    return statSync(full).isDirectory() && entry !== 'ALL IMAGES';
  });

  for (const region of regions) {
    for (const second of readdirSync(path.join(root, region))) {
      const secondPath = path.join(root, region, second);
      if (!statSync(secondPath).isDirectory()) continue;

      if (TIERS[second]) {
        for (const property of readdirSync(secondPath)) {
          if (statSync(path.join(secondPath, property)).isDirectory()) {
            meta.set(norm(property), { region, tier: TIERS[second] });
          }
        }
      } else {
        meta.set(norm(second), { region, tier: '' });
      }
    }
  }
  return meta;
};

/** Only ever from words actually in the property's name. */
const typeFromName = (name: string): string => {
  const value = name.toLowerCase();
  if (/tented|under canvas/.test(value)) return 'TENTED_CAMP';
  if (/mobile camp/.test(value)) return 'MOBILE_CAMP';
  if (/\bcamp\b/.test(value)) return 'TENTED_CAMP';
  if (/boutique/.test(value)) return 'BOUTIQUE_HOTEL';
  if (/beach|resort/.test(value)) return 'BEACH_RESORT';
  if (/\bvilla\b/.test(value)) return 'VILLA';
  if (/guest house/.test(value)) return 'GUEST_HOUSE';
  if (/\beco\b/.test(value)) return 'ECO_LODGE';
  if (/hotel|suite|house|inn|manor/.test(value)) return 'HOTEL';
  return 'SAFARI_LODGE';
};

const run = async () => {
  const allImagesDir = path.join(ROOT, 'ALL IMAGES');
  const files = readdirSync(allImagesDir).filter((file) => /\.avif$/i.test(file));
  const meta = readTree(ROOT);

  const byProperty = new Map<string, string[]>();
  for (const file of files) {
    const key = propertyOf(file);
    if (!byProperty.has(key)) byProperty.set(key, []);
    byProperty.get(key)!.push(file);
  }

  // Media library, by exact file name.
  const media: Array<{ file_name: string; file_url: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('media_library')
      .select('file_name,file_url')
      .is('deleted_at', null)
      .range(from, from + 999);
    if (error || !data?.length) break;
    media.push(...(data as typeof media));
    if (data.length < 1000) break;
  }
  const library = new Map(media.map((row) => [row.file_name, row.file_url]));

  const { data: lodgeRows } = await supabase.from('lodges').select('id,name,slug').is('deleted_at', null);
  const existing = new Map<string, Existing>();
  for (const lodge of (lodgeRows ?? []) as Existing[]) existing.set(norm(lodge.name), lodge);

  const { data: destRows } = await supabase.from('destinations').select('id,name').is('deleted_at', null);
  const destinations = (destRows ?? []) as Array<{ id: string; name: string }>;
  /**
   * Keywords that identify exactly one destination. "Serengeti" and "Arusha"
   * are deliberately absent: each matches several destinations, so a property
   * named for them is genuinely ambiguous and is better left unset than guessed.
   */
  const KEYWORDS: Array<[string, string]> = [
    ['ngorongoro', 'Ngorongoro Crater'],
    ['manyara', 'Lake Manyara National Park'],
    ['tarangire', 'Tarangire National Park'],
    ['ndutu', 'Ndutu / Southern Serengeti'],
    ['kilimanjaro', 'Mount Kilimanjaro'],
    ['mikumi', 'Mikumi National Park'],
    ['ruaha', 'Ruaha National Park'],
    ['nyerere', 'Nyerere National Park'],
    ['zanzibar', 'Zanzibar'],
    ['nungwi', 'Nungwi & Kendwa'],
    ['stone town', 'Stone Town']
  ];

  const destinationFor = (property: string, region: string): string | null => {
    // The property's own name wins — "Ngorongoro Marera" says where it is even
    // though its folder covers four destinations.
    const lower = property.toLowerCase();
    for (const [keyword, destName] of KEYWORDS) {
      if (!lower.includes(keyword)) continue;
      const match = destinations.find((d) => norm(d.name) === norm(destName));
      if (match) return match.id;
    }
    const exact = destinations.find((d) => norm(d.name) === norm(region));
    return exact ? exact.id : null;
  };

  let created = 0;
  let updated = 0;
  let attached = 0;
  let skippedNoMedia = 0;
  const unresolved: string[] = [];

  console.log(`${apply ? 'APPLYING' : 'DRY RUN'} — source: ${ROOT}\n`);
  console.log(`${'PROPERTY'.padEnd(30)} ${'IMGS'.padEnd(6)} ${'TIER'.padEnd(10)} ${'DESTINATION'.padEnd(22)} ACTION`);
  console.log('-'.repeat(96));

  for (const [property, propertyFiles] of [...byProperty].sort()) {
    if (SKIP.has(property.toLowerCase())) continue;

    const ordered = propertyFiles.sort((a, b) => orderOf(a) - orderOf(b));
    const urls = ordered.map((file) => library.get(file)).filter((url): url is string => Boolean(url));

    if (!urls.length) {
      skippedNoMedia += 1;
      console.log(`${property.slice(0, 29).padEnd(30)} ${String(propertyFiles.length).padEnd(6)} ${''.padEnd(10)} ${''.padEnd(22)} SKIP — no images in media library`);
      continue;
    }

    const info = meta.get(norm(property));
    const canonical = ALIASES[property.toLowerCase()] ?? clean(property);
    const found = existing.get(norm(canonical));
    const destinationId = destinationFor(canonical, info?.region ?? '');
    const destinationName = destinations.find((d) => d.id === destinationId)?.name ?? '—';
    if (!destinationId) unresolved.push(canonical);

    const action = found ? 'update' : 'create';
    console.log(
      `${canonical.slice(0, 29).padEnd(30)} ${String(urls.length).padEnd(6)} ${(info?.tier ?? '—').padEnd(10)} ${destinationName.slice(0, 21).padEnd(22)} ${action} + ${urls.length} images`
    );

    if (!apply) {
      if (found) updated += 1;
      else created += 1;
      attached += urls.length;
      continue;
    }

    let lodgeId = found?.id;

    if (!lodgeId) {
      // New properties arrive as drafts: they have no description or price yet,
      // so publishing them would put empty pages on the live site.
      const insert = await supabase
        .from('lodges')
        .insert({
          name: canonical,
          slug: slugify(canonical),
          status: 'draft',
          accommodation_level: info?.tier || 'MID_RANGE',
          lodge_type: typeFromName(canonical),
          destination_id: destinationId
        })
        .select('id')
        .single();
      if (insert.error) {
        console.log(`   ! could not create: ${insert.error.message}`);
        continue;
      }
      lodgeId = String(insert.data.id);
      created += 1;
    } else {
      // Only ever fill blanks on an existing record — never overwrite what an
      // editor has already written.
      const current = await supabase
        .from('lodges')
        .select('accommodation_level,lodge_type,destination_id')
        .eq('id', lodgeId)
        .single();
      const patch: Record<string, unknown> = {};
      if (info?.tier && !current.data?.accommodation_level) patch.accommodation_level = info.tier;
      if (!current.data?.destination_id && destinationId) patch.destination_id = destinationId;
      if (Object.keys(patch).length) await supabase.from('lodges').update(patch).eq('id', lodgeId);
      updated += 1;
    }

    await supabase.from('lodge_images').delete().eq('lodge_id', lodgeId);
    const rows = urls.map((url, index) => ({
      lodge_id: lodgeId,
      image_url: url,
      alt_text: `${canonical} — photo ${index + 1}`,
      sort_order: index,
      is_cover: index === 0
    }));
    const inserted = await supabase.from('lodge_images').insert(rows);
    if (inserted.error) console.log(`   ! gallery failed: ${inserted.error.message}`);
    else attached += rows.length;
  }

  console.log('-'.repeat(96));
  console.log(`properties created: ${created} | updated: ${updated} | images attached: ${attached}`);
  console.log(`skipped (no media): ${skippedNoMedia}`);
  console.log(`destination left blank (region covers several): ${unresolved.length}`);
  if (unresolved.length) console.log('  ' + unresolved.slice(0, 20).join(', ') + (unresolved.length > 20 ? ' …' : ''));
  console.log(
    apply
      ? '\nDone. New properties are drafts with empty description/price/amenities — those need an editor.'
      : '\nDry run — nothing written. Re-run with --apply.'
  );
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
