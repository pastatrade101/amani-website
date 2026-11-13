import { z } from 'zod';

// A country hub (Tanzania, Kenya, Uganda...): its own intro, photo and travel
// facts. Destinations join it through their `country` name, so a country
// needs no destination edits to light up.
const statusSchema = z.enum(['draft', 'published', 'archived']);
const optionalUrl = z.union([z.string().url(), z.literal('')]).optional().nullable();
const optionalText = (max: number) => z.string().max(max).optional().nullable();

export const COUNTRY_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

export const countryCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.').optional(),
  hero_image_url: optionalUrl,
  intro_text: optionalText(6000),
  best_months: z.array(z.enum(COUNTRY_MONTHS)).max(12).default([]),
  visa_info: optionalText(6000),
  health_info: optionalText(6000),
  currency: optionalText(60),
  capital: optionalText(80),
  phase: z.enum(['live', 'planned', 'future']).default('live'),
  status: statusSchema.default('draft'),
  is_featured: z.coerce.boolean().default(false),
  seo_title: optionalText(160),
  meta_title: optionalText(160),
  meta_description: optionalText(320),
  og_image_url: optionalUrl
});

export const countryUpdateSchema = countryCreateSchema.partial();
