/**
 * Copy every managed media object from Supabase Storage to Cloudflare R2.
 *
 * Critical invariant: this script NEVER updates media_library.file_url. That
 * URL remains the raw database lookup key used by API joins. The frontend maps
 * it to PUBLIC_MEDIA_CDN_URL only when rendering.
 *
 * Safe to re-run: R2 PutObject overwrites the same deterministic key.
 */
import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { putR2Object, r2Enabled } from '../services/r2.service';
import sharp from 'sharp';

type MediaRow = {
  id: string;
  file_url: string | null;
  file_path: string | null;
  thumbnail_path: string | null;
  mime_type: string | null;
  variant_widths: number[] | null;
  has_avif: boolean | null;
};

const r2Origin = env.R2_PUBLIC_URL?.replace(/\/+$/, '') || '';

/** Storage bucket encoded in the canonical Supabase public URL. */
const bucketFor = (url: string | null): string => {
  const match = url?.match('/storage/v1/object/public/([^/]+)/');
  return match?.[1] || env.SUPABASE_STORAGE_BUCKET;
};

const contentTypeFor = (key: string, fallback?: string | null): string => {
  if (key.endsWith('.avif')) return 'image/avif';
  if (key.endsWith('.webp')) return 'image/webp';
  if (key.endsWith('.png')) return 'image/png';
  if (/\.jpe?g$/i.test(key)) return 'image/jpeg';
  if (key.endsWith('.mp4')) return 'video/mp4';
  if (key.endsWith('.webm')) return 'video/webm';
  if (key.endsWith('.json')) return 'application/json';
  return fallback || 'application/octet-stream';
};

const responsiveKeys = (row: MediaRow): string[] => {
  if (!row.file_path || !row.variant_widths?.length) return [];
  const fileName = row.file_path.split('/').pop() ?? '';
  const stem = fileName.replace(/\.[^.]+$/, '');
  const folder = row.file_path.includes('/') ? row.file_path.split('/').slice(0, -1).join('/') : 'uploads';
  return row.variant_widths.flatMap((width) => [
    `${folder}/responsive/${stem}/${width}.webp`,
    ...(row.has_avif ? [`${folder}/responsive/${stem}/${width}.avif`] : [])
  ]);
};

const download = async (bucket: string, key: string): Promise<Buffer | null> => {
  const { data, error } = await supabase.storage.from(bucket).download(key);
  if (error) {
    if (error.message.toLowerCase().includes('not found')) return null;
    throw error;
  }
  return data ? Buffer.from(await data.arrayBuffer()) : null;
};

const recoverOriginal = async (row: MediaRow, bucket: string): Promise<Buffer | null> => {
  if (!row.file_path) return null;
  const fileName = row.file_path.split('/').pop() ?? '';
  const stem = fileName.replace(/\.[^.]+$/, '');
  const folder = row.file_path.includes('/') ? row.file_path.split('/').slice(0, -1).join('/') : 'uploads';
  const widths = [...(row.variant_widths ?? [])].sort((a, b) => b - a);
  const candidates = widths.flatMap((width) => [
    ...(row.has_avif ? [`${folder}/responsive/${stem}/${width}.avif`] : []),
    `${folder}/responsive/${stem}/${width}.webp`
  ]);
  if (row.thumbnail_path) candidates.push(row.thumbnail_path);

  const sources: Array<Buffer | null> = [];
  for (let at = 0; at < candidates.length; at += 4) {
    sources.push(...await Promise.all(candidates.slice(at, at + 4).map((candidate) => download(bucket, candidate))));
  }
  for (const source of sources) {
    if (!source) continue;
    try {
      if (row.mime_type === 'image/avif') return await sharp(source).avif({ quality: 62 }).toBuffer();
      if (row.mime_type === 'image/png') return await sharp(source).png({ compressionLevel: 9 }).toBuffer();
      if (row.mime_type === 'image/webp') return await sharp(source).webp({ quality: 82 }).toBuffer();
      if (row.mime_type === 'image/jpeg') return await sharp(source).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
      return source;
    } catch {
      continue;
    }
  }
  return null;
};

const main = async () => {
  if (!r2Enabled) throw new Error('Set R2_ENABLED=true and all R2_* variables before migrating.');

  let from = 0;
  const pageSize = 200;
  let copied = 0;
  let failed = 0;
  let orphaned = 0;
  let alreadyMigrated = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('media_library')
      .select('id,file_url,file_path,thumbnail_path,mime_type,variant_widths,has_avif')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as MediaRow[];
    if (!rows.length) break;

    for (const row of rows) {
      if (!row.file_path) continue;
      if (r2Origin && row.file_url?.startsWith(`${r2Origin}/`)) {
        alreadyMigrated += 1;
        continue;
      }
      const sourceBucket = bucketFor(row.file_url);
      try {
        const original = await download(sourceBucket, row.file_path) ?? await recoverOriginal(row, sourceBucket);
        if (!original) {
          orphaned += 1;
          console.warn(`orphaned ${row.file_path} (no original, thumbnail, or responsive source)`);
          continue;
        }

        await putR2Object(row.file_path, original, contentTypeFor(row.file_path, row.mime_type));
        copied += 1;

        if (row.thumbnail_path) {
          let thumbnail = await download(sourceBucket, row.thumbnail_path);
          if (!thumbnail && row.mime_type?.startsWith('image/')) {
            thumbnail = await sharp(original).rotate().resize({ width: 600, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
          }
          if (thumbnail) {
            await putR2Object(row.thumbnail_path, thumbnail, 'image/webp');
            copied += 1;
          }
        }

        for (const key of responsiveKeys(row)) {
          let derivative = await download(sourceBucket, key);
          if (!derivative && row.mime_type?.startsWith('image/')) {
            const width = Number(key.match(/\/(\d+)\.(?:webp|avif)$/)?.[1]);
            if (width) {
              const resized = sharp(original).rotate().resize({ width, withoutEnlargement: true });
              derivative = key.endsWith('.avif')
                ? await resized.avif({ quality: 50, effort: 4 }).toBuffer()
                : await resized.webp({ quality: 72 }).toBuffer();
            }
          }
          if (derivative) {
            await putR2Object(key, derivative, contentTypeFor(key));
            copied += 1;
          }
        }
        console.log(`migrated ${row.file_path}`);
      } catch (error) {
        failed += 1;
        console.error(`failed ${row.file_path}:`, error instanceof Error ? error.message : error);
      }
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  console.log(`R2 migration complete: ${copied} objects copied, ${alreadyMigrated} already on R2, ${orphaned} orphaned rows skipped, ${failed} failed.`);
  if (failed) process.exitCode = 1;
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
