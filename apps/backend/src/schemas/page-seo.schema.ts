import { z } from 'zod';

const optionalText = z.string().trim().optional().nullable();
const optionalUrl = z.union([z.string().trim().url(), z.literal('')]).optional().nullable();

export const pageSeoCreateSchema = z.object({
  path: z.string().min(1).startsWith('/', 'path must start with "/".'),
  title: optionalText,
  meta_description: optionalText,
  og_title: optionalText,
  og_description: optionalText,
  og_image_url: optionalUrl,
  canonical_url: optionalUrl,
  robots: z.string().trim().optional().default('index,follow'),
  structured_data: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).optional().nullable(),
  is_active: z.boolean().optional().default(true)
});

export const pageSeoUpdateSchema = pageSeoCreateSchema.partial();
