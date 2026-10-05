/**
 * Upload a folder of photos into the media library, several at a time, through
 * the same path as an editor's upload: optimised original + thumbnail + media
 * row + the responsive AVIF/WebP ladder.
 *
 * Attributes come from an optional JSON manifest keyed by source file name:
 *   { "serengeti_011_result.avif": { "name": "serengeti-011.avif", "alt": "…", "caption": "…" } }
 * Without one, the file keeps its own name and gets no alt text.
 *
 * Re-running is safe and is how attributes are corrected: a photo whose name is
 * already in the library is not uploaded again; its alt text and caption are
 * updated to the manifest's when they differ.
 *
 * Dry run (default — reads only, writes nothing):
 *   npm run media:import -- --dir ~/Desktop/photos --manifest photos.json
 * Upload, 6 at a time (default):
 *   npm run media:import -- --dir ~/Desktop/photos --manifest photos.json --apply --concurrency 6
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { supabase } from '../config/supabase';
import { generateResponsiveVariants, uploadImageToStorage } from '../services/upload.service';

type Entry = { name?: string; alt?: string | null; caption?: string | null };

const FOLDER = 'media';
const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' };

const arg = (flag: string) => {
  const index = process.argv.indexOf(flag);
  return index > -1 ? process.argv[index + 1] : undefined;
};
const apply = process.argv.includes('--apply');
const dir = arg('--dir')?.replace(/^~(?=\/)/, process.env.HOME ?? '~');
const manifestPath = arg('--manifest');
const concurrency = Math.max(1, Math.min(12, Number(arg('--concurrency') ?? 6) || 6));

const run = async () => {
  if (!dir) throw new Error('Pass --dir <folder of photos>.');
  const manifest: Record<string, Entry> = manifestPath ? JSON.parse(await readFile(manifestPath, 'utf8')) : {};
  const files = (await readdir(dir)).filter((file) => MIME[path.extname(file).slice(1).toLowerCase()]).sort();

  // Which target names are already in the library (one query, not one per file).
  const targets = files.map((file) => manifest[file]?.name ?? file);
  const existing = new Map<string, { id: string; alt_text: string | null; caption: string | null }>();
  for (let i = 0; i < targets.length; i += 200) {
    const { data, error } = await supabase
      .from('media_library')
      .select('id,file_name,alt_text,caption')
      .in('file_name', targets.slice(i, i + 200))
      .is('deleted_at', null);
    if (error) throw new Error(`Unable to read the media library: ${error.message}`);
    for (const row of data ?? []) existing.set(String(row.file_name), { id: String(row.id), alt_text: row.alt_text, caption: row.caption });
  }

  console.log(`${files.length} photos in ${dir}; ${existing.size} already in the library. ${apply ? `Uploading ${concurrency} at a time.` : 'Dry run — nothing is written (add --apply).'}`);

  let done = 0;
  const counts = { uploaded: 0, updated: 0, unchanged: 0, failed: 0 };
  const queue = [...files];

  const work = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      const entry = manifest[file] ?? {};
      const name = entry.name ?? file;
      const alt = entry.alt ?? null;
      const caption = entry.caption ?? null;
      const label = `[${String(++done).padStart(String(files.length).length)}/${files.length}] ${name}`;
      try {
        const known = existing.get(name);
        if (known) {
          if ((alt !== null && alt !== known.alt_text) || (caption !== null && caption !== known.caption)) {
            if (apply) {
              const { error } = await supabase.from('media_library').update({ alt_text: alt ?? known.alt_text, caption: caption ?? known.caption }).eq('id', known.id);
              if (error) throw new Error(error.message);
            }
            counts.updated += 1;
            console.log(`${label} — attributes ${apply ? 'updated' : 'would update'}`);
          } else {
            counts.unchanged += 1;
          }
          continue;
        }
        if (!apply) {
          counts.uploaded += 1;
          console.log(`${label} — would upload`);
          continue;
        }

        const buffer = await readFile(path.join(dir, file));
        const mimetype = MIME[path.extname(file).slice(1).toLowerCase()];
        const upload = { fieldname: 'file', originalname: name, encoding: '7bit', mimetype, size: buffer.length, buffer } as unknown as Express.Multer.File;
        const result = await uploadImageToStorage(upload, FOLDER);
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
        if (error || !media) throw new Error(error?.message ?? 'media row not saved');
        // Awaited here (not left in the background) so the pool also bounds the CPU-heavy resizing.
        await generateResponsiveVariants(String(media.id), result.processedBuffer, FOLDER, result.path);
        counts.uploaded += 1;
        console.log(`${label} — uploaded`);
      } catch (error) {
        counts.failed += 1;
        console.warn(`${label} — FAILED: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, work));
  console.log(`Done. ${apply ? 'Uploaded' : 'Would upload'} ${counts.uploaded}, attributes ${apply ? 'updated' : 'to update'} ${counts.updated}, unchanged ${counts.unchanged}, failed ${counts.failed}.`);
  if (counts.failed) process.exitCode = 1;
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
