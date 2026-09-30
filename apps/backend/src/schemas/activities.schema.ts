import { z } from 'zod';

const statusSchema = z.enum(['draft', 'published', 'archived']);
const optionalUrl = z.union([z.string().url(), z.literal('')]).optional().nullable();
const optionalText = (max: number) => z.string().max(max).optional().nullable();

export const ACTIVITY_CATEGORIES = ['wildlife', 'adventure', 'cultural', 'water', 'trekking', 'relaxation'] as const;
export const ACTIVITY_DIFFICULTIES = ['easy', 'moderate', 'challenging', 'strenuous'] as const;

// No defaults on the shared fields: an update sends only what changed, and a
// default would silently reset what it left out. Create adds its own below.
const fields = {
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers and single hyphens.').optional(),
  // Primary destination; kept in step with the first of destination_ids.
  destination_id: z.union([z.string().uuid(), z.literal('')]).optional().nullable(),
  // Every destination the activity can be done in, primary first (activity_destinations).
  destination_ids: z.array(z.string().uuid()).max(30).optional(),
  // Tours that include the activity (tour_activities).
  tour_ids: z.array(z.string().uuid()).max(300).optional(),
  location_label: optionalText(160),
  category: z.enum(ACTIVITY_CATEGORIES),
  difficulty: z.enum(ACTIVITY_DIFFICULTIES).optional().nullable(),
  description: z.string().max(20000).optional().nullable(),
  why_we_recommend: z.string().max(8000).optional().nullable(),
  highlights: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  hero_image_url: optionalUrl,
  image_url: optionalUrl,
  og_image_url: optionalUrl,
  duration_label: optionalText(80),
  price_from: z.coerce.number().nonnegative().max(1_000_000).optional().nullable(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  price_unit: optionalText(60),
  badge: optionalText(40),
  best_season: z.array(z.string()).optional(),
  // Best months 1–12, picked from the Seasons module in the CMS.
  best_months: z.array(z.coerce.number().int().min(1).max(12)).max(12).optional(),
  status: statusSchema,
  is_featured: z.coerce.boolean(),
  sort_order: z.coerce.number().int().min(0),
  seo_title: optionalText(120),
  meta_title: optionalText(120),
  meta_description: optionalText(320)
};

const hasDestination = (value: { destination_id?: string | null; destination_ids?: string[] }) =>
  Boolean(value.destination_ids?.length || value.destination_id);

export const activityCreateSchema = z
  .object({
    ...fields,
    category: fields.category.default('wildlife'),
    currency: fields.currency.default('USD'),
    status: fields.status.default('draft'),
    is_featured: fields.is_featured.default(false),
    sort_order: fields.sort_order.default(0)
  })
  .superRefine((value, ctx) => {
    if (value.status === 'published' && !hasDestination(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['destination_ids'], message: 'Choose at least one destination before publishing this activity.' });
    }
  });

export const activityUpdateSchema = z
  .object(fields)
  .partial()
  .superRefine((value, ctx) => {
    // Only when this update both publishes and sets destinations to none.
    if (value.status === 'published' && value.destination_ids && !value.destination_ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['destination_ids'], message: 'Choose at least one destination before publishing this activity.' });
    }
  });
