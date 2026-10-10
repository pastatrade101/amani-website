import { z } from 'zod';
import { LIMIT_MESSAGES as M, TOUR_LIMITS as L, activityProblems, richTextLength } from './tour-limits';

const statusSchema = z.enum(['draft', 'published', 'archived']);
const optionalUrl = z.union([z.string().url(), z.literal('')]).optional().nullable();
const optionalUuid = z.union([z.string().uuid(), z.literal('')]).optional().nullable();
const safariStyleSchema = z.enum(['budget', 'midrange', 'luxury']);

/** Rich text is measured by what a reader sees, not by its markup. */
export const fitsText = (max: number) => (value: string) => richTextLength(value) <= max;
/** Each line of a day's activities is one chip; see activityProblems. */
export const activityRules = (value: string, ctx: z.RefinementCtx) => {
  for (const message of activityProblems(value)) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
};

// Text limits (tour-limits.ts) keep every field inside the public layout that
// shows it; the longest text already published fits all of them.
export const tourCreateSchema = z.object({
  title: z.string().min(2).max(L.title, M.title),
  slug: z.string().min(2).optional(),
  short_description: z.string().min(5).max(L.shortDescription, M.shortDescription).optional().nullable(),
  full_description: z.string().min(5).optional().nullable(),
  destination_id: optionalUuid,
  destination_ids: z.array(z.string().uuid()).optional(),
  category_id: optionalUuid,
  specialist_id: optionalUuid,
  experience_type: z.string().max(L.experienceType, M.experienceType).optional().nullable(),
  persona_tags: z.array(z.string().max(80)).default([]),
  // New tours store a safari style key ('budget' | 'midrange' | 'luxury');
  // older free-text tiers ("Mid-range", "ultra_luxury"…) are still accepted.
  budget_tier: z.union([safariStyleSchema, z.string().max(80)]).optional().nullable(),
  duration_days: z.coerce.number().int().positive(),
  duration_nights: z.coerce.number().int().min(0).default(0),
  price_from: z.coerce.number().nonnegative(),
  currency: z.string().min(3).max(3).default('USD'),
  main_image_url: optionalUrl,
  banner_image_url: optionalUrl,
  sample_itinerary: z.union([z.array(z.record(z.unknown())), z.string()]).optional().nullable(),
  // A highlight can keep the formatting it was written with, so it is measured as text.
  highlights: z.array(z.string().refine(fitsText(L.highlight), M.highlight)).max(L.highlights, M.highlights).default([]),
  customization_intro: z.string().max(1000).optional().nullable(),
  customization_options: z.array(z.string().min(1).max(L.customizationOption, M.customizationOption)).default([]),
  difficulty_level: z.string().optional().nullable(),
  group_size: z.string().optional().nullable(),
  group_size_min: z.coerce.number().int().min(0).optional().nullable(),
  group_size_max: z.coerce.number().int().min(0).optional().nullable(),
  minimum_age: z.coerce.number().int().min(0).optional().nullable(),
  start_trip_point_id: z.preprocess((v) => v === '' ? null : v, z.string().uuid().nullable()).optional(),
  end_trip_point_id: z.preprocess((v) => v === '' ? null : v, z.string().uuid().nullable()).optional(),
  start_location: z.never({ invalid_type_error: 'Select a start point from Trip Points instead of entering text.' }).optional(),
  end_location: z.never({ invalid_type_error: 'Select an end point from Trip Points instead of entering text.' }).optional(),
  status: statusSchema.default('draft'),
  is_available: z.coerce.boolean().default(true),
  is_featured: z.coerce.boolean().default(false),
  is_popular: z.coerce.boolean().default(false),
  seats_remaining: z.coerce.number().int().min(0).optional().nullable(),
  // Hard caps sit above the search-snippet targets (60 / 160), which the editor only warns about.
  seo_title: z.string().max(L.seoTitle.max, M.seoTitle).optional().nullable(),
  meta_title: z.string().max(L.seoTitle.max, M.seoTitle).optional().nullable(),
  meta_description: z.string().max(L.metaDescription.max, M.metaDescription).optional().nullable(),
  og_image: optionalUrl,
  og_image_url: optionalUrl
});

export const tourUpdateSchema = tourCreateSchema.partial();

// ── Tour content (PUT /api/tours/:id/content) ───────────────────────────────
// Every key is optional; a key that is present replaces that whole collection.
// Blank strings read as null so an emptied field clears instead of failing.

const blankToNull = (value: unknown) => (typeof value === 'string' && !value.trim() ? null : value);
const blankToUndefined = (value: unknown) => (value === null || (typeof value === 'string' && !value.trim()) ? undefined : value);
const nullableText = (max: number, message?: string) => z.preprocess(blankToNull, z.string().trim().max(max, message).nullable()).optional();
const nullableUuid = z.preprocess(blankToNull, z.string().uuid().nullable()).optional();
// An id that is present must be a real one; new rows simply leave it out.
const rowId = z.preprocess(blankToUndefined, z.string().uuid().optional());

const unique = <T>(label: string, key: (item: T) => unknown, field: string) => (items: T[], ctx: z.RefinementCtx) => {
  const seen = new Set<unknown>();
  items.forEach((item, index) => {
    const value = key(item);
    if (value === undefined) return;
    if (seen.has(value)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, field], message: label });
    seen.add(value);
  });
};

const dayStaySchema = z.object({
  safari_style: safariStyleSchema,
  lodge_id: nullableUuid,
  // Free-text name for a property that is not in the CMS yet.
  accommodation: nullableText(L.stayName, M.stayName)
});

const contentDaySchema = z.object({
  id: rowId,
  day_number: z.coerce.number().int().min(1).max(60),
  title: z.string().trim().min(2).max(L.dayTitle, M.dayTitle),
  summary: nullableText(L.daySummary, M.daySummary),
  // The markup cap stays generous; the reader-facing limit is on the text.
  description: z.preprocess(blankToNull, z.string().trim().max(20000).refine(fitsText(L.dayDescription), M.dayDescription).nullable()).optional(),
  destination_id: nullableUuid,
  travel_mode: z.preprocess(blankToNull, z.enum(['DRIVE', 'FLY', 'BOAT']).nullable()).optional(),
  meals: nullableText(L.meals, M.meals),
  activities: z.preprocess(blankToNull, z.string().trim().max(2000).superRefine(activityRules).nullable()).optional(),
  image_urls: z.array(z.string().trim().url()).max(L.dayPhotos, M.dayPhotos).optional(),
  stays: z
    .array(dayStaySchema)
    .max(3)
    .superRefine(unique('Each safari style can only have one stay per day.', (stay: z.infer<typeof dayStaySchema>) => stay.safari_style, 'safari_style'))
    .optional()
});

const contentImageSchema = z.object({
  id: rowId,
  image_url: z.string().trim().url(),
  alt_text: nullableText(L.altText, M.altText),
  caption: nullableText(L.caption, M.caption),
  is_featured: z.boolean().optional()
});

export const tourActivitySettingSchema = z.object({
  activity_id: z.string().uuid(),
  is_optional: z.boolean(),
  additional_cost: z.boolean().default(false),
  pricing_option_id: z.string().uuid().nullable().default(null)
}).superRefine((row, ctx) => {
  if ((!row.is_optional && (row.additional_cost || row.pricing_option_id)) || (row.pricing_option_id && !row.additional_cost))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Only optional additional-cost activities can link a price.' });
});

export const tourContentSchema = z.object({
  days: z
    .array(contentDaySchema)
    .max(60)
    .superRefine(unique('Each day number can only be used once.', (day: z.infer<typeof contentDaySchema>) => day.day_number, 'day_number'))
    .superRefine(unique('Each day can only be listed once.', (day: z.infer<typeof contentDaySchema>) => day.id, 'id'))
    .optional(),
  inclusion_ids: z.array(z.string().uuid()).max(L.listItems, M.listItems).refine(ids => new Set(ids).size === ids.length, 'Select each inclusion only once.').optional(),
  exclusion_ids: z.array(z.string().uuid()).max(L.listItems, M.listItems).refine(ids => new Set(ids).size === ids.length, 'Select each exclusion only once.').optional(),
  inclusions: z.never({invalid_type_error:'Select inclusions from the shared library.'}).optional(),
  exclusions: z.never({invalid_type_error:'Select exclusions from the shared library.'}).optional(),
  images: z
    .array(contentImageSchema)
    .max(40)
    .refine((images) => images.filter((image) => image.is_featured === true).length <= 1, {
      message: 'Only one gallery photo can be featured.'
    })
    .optional(),
  activity_settings: z.array(tourActivitySettingSchema).max(50).refine(rows => new Set(rows.map(r => r.activity_id)).size === rows.length, 'Select each activity once.').optional(),
  activity_ids: z.array(z.string().uuid()).max(50).refine(ids => new Set(ids).size === ids.length, 'Select each activity once.').optional()
});

export type TourContentInput = z.infer<typeof tourContentSchema>;
