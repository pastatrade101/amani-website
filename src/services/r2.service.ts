import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env';

const completeConfig = Boolean(
  env.R2_ACCOUNT_ID &&
  env.R2_ACCESS_KEY_ID &&
  env.R2_SECRET_ACCESS_KEY &&
  env.R2_BUCKET_NAME &&
  env.R2_PUBLIC_URL
);

/** One reversible feature gate for every R2 write/delete operation. */
export const r2Enabled = env.R2_ENABLED && completeConfig;

let client: S3Client | null = null;
const r2 = (): S3Client => {
  if (!r2Enabled) throw new Error('Cloudflare R2 is not configured.');
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!
      }
    });
  }
  return client;
};

const cleanKey = (key: string) => key.replace(/^\/+/, '');

export const r2PublicUrl = (key: string): string =>
  `${env.R2_PUBLIC_URL!.replace(/\/+$/, '')}/${cleanKey(key)}`;

export const putR2Object = async (
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
  cacheControl = 'public, max-age=31536000, immutable'
): Promise<string> => {
  await r2().send(new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME!,
    Key: cleanKey(key),
    Body: body,
    ContentType: contentType,
    CacheControl: cacheControl
  }));
  return r2PublicUrl(key);
};

export const deleteR2Object = async (key: string): Promise<void> => {
  await r2().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME!, Key: cleanKey(key) }));
};
