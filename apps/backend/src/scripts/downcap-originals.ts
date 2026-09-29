/**
 * URL-stable original-image optimization. Run before the R2 migration while
 * R2_ENABLED=false. The object at file_path is replaced in place and file_url
 * is deliberately never changed.
 */
import sharp from 'sharp';
import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { overwriteManagedObject } from '../services/upload.service';

type Row = { id: string; file_path: string | null; mime_type: string | null; width: number | null };

const optimize = async (buffer: Buffer, mime: string): Promise<Buffer> => {
  const image = sharp(buffer).rotate().resize({ width: env.MEDIA_MAX_ORIGINAL_WIDTH, withoutEnlargement: true });
  if (mime === 'image/png') return image.png({ compressionLevel: 9 }).toBuffer();
  if (mime === 'image/webp') return image.webp({ quality: env.MEDIA_ORIGINAL_QUALITY }).toBuffer();
  if (mime === 'image/avif') return image.avif({ quality: Math.max(50, env.MEDIA_ORIGINAL_QUALITY - 20) }).toBuffer();
  return image.jpeg({ quality: env.MEDIA_ORIGINAL_QUALITY, mozjpeg: true }).toBuffer();
};

const main = async () => {
  if (env.R2_ENABLED) throw new Error('Run the pre-migration down-cap with R2_ENABLED=false.');
  const { data, error } = await supabase
    .from('media_library')
    .select('id,file_path,mime_type,width')
    .eq('file_type', 'image')
    .gt('width', env.MEDIA_MAX_ORIGINAL_WIDTH);
  if (error) throw error;

  let optimized = 0;
  let failed = 0;
  for (const row of (data ?? []) as Row[]) {
    if (!row.file_path || !row.mime_type?.startsWith('image/')) continue;
    try {
      const downloaded = await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).download(row.file_path);
      if (downloaded.error || !downloaded.data) throw downloaded.error || new Error('Download returned no data.');
      const output = await optimize(Buffer.from(await downloaded.data.arrayBuffer()), row.mime_type);
      await overwriteManagedObject(row.file_path, output, row.mime_type);
      const metadata = await sharp(output).metadata();
      await supabase.from('media_library').update({
        file_size: output.length,
        width: metadata.width ?? row.width,
        height: metadata.height ?? null,
        aspect_ratio: metadata.width && metadata.height ? metadata.width / metadata.height : null
      }).eq('id', row.id);
      optimized += 1;
      console.log(`optimized ${row.file_path}`);
    } catch (error) {
      failed += 1;
      console.error(`failed ${row.file_path}:`, error instanceof Error ? error.message : error);
    }
  }
  console.log(`Down-cap complete: ${optimized} optimized, ${failed} failed.`);
  if (failed) process.exitCode = 1;
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
