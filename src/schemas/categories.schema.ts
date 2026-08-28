import { sanitizeRichText, toPlainText } from '../utils/rich-text';
import { z } from 'zod';

const statusSchema = z.enum(['draft', 'published', 'archived']);
const optionalUrl = z.union([z.string().url(), z.literal('')]).optional().nullable();

export const FITNESS_LEVELS = ['easy', 'moderate', 'active', 'challenging', 'strenuous'] as const;

// '' and null both mean "not set" — the admin form clears a select to '' while
// the API stores null, and neither should fail validation.
const fitnessSchema = z
  .union([z.enum(FITNESS_LEVELS), z.literal('')])
  .optional()
  .nullable()
  .transform((value) => value || null);

// Form number inputs surface '' when cleared; coerce that (and null) to null
// instead of letting z.coerce turn it into 0, which would then fail min(1).
const optionalDays = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : value),
  z.coerce.number().int().min(1).nullable()
).optional();

const monthsSchema = z
  .array(z.coerce.number().int().min(1).max(12))
  .max(12)
  .optional()
  // Dedup and sort so the stored value is canonical regardless of click order.
  .transform((months) => (months ? [...new Set(months)].sort((a, b) => a - b) : months));

// A highlight that is only markup ("<p></p>") is a placeholder row, not
// content. The admin filters these client-side; this keeps the rule true for
// every caller. Tag-stripping is enough here because sanitizeRichFields runs
// on the same payload before the DB write.
/**
 * One planning note: sanitised on the way in, and emptied to null when the
 * editor leaves only markup behind, so a blank block never renders a card.
 */
const richNote = z
  .string()
  .max(4000)
  .optional()
  .nullable()
  .transform((value) => {
    if (!value) return null;
    const clean = sanitizeRichText(value);
    return toPlainText(clean).trim() ? clean : null;
  });

const highlightsSchema = z
  .array(z.string())
  .optional()
  .transform((items) =>
    items?.filter((item) => item.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim().length > 0)
  );

const daysRangeValid = (data: { min_days?: number | null; max_days?: number | null }) =>
  data.min_days == null || data.max_days == null || data.max_days >= data.min_days;

const categoryBaseSchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers and single hyphens.')
    .optional(),
  short_description: z.string().max(250).optional().nullable(),
  description: z.string().optional().nullable(),
  who_its_for: z.string().optional().nullable(),
  fitness_level: fitnessSchema,
  min_days: optionalDays,
  max_days: optionalDays,
  best_months: monthsSchema,
  highlights: highlightsSchema,
  /**
   * Per-style planning prose the "how to plan" band renders. Both keys
   * optional: a style with neither shows no block, which is deliberate — an
   * empty planning section beats an invented one.
   *
   * Rich text, so a specialist can write bullets rather than one long
   * paragraph. Sanitised here rather than by sanitizeRichFields, which walks a
   * flat list of column names and cannot reach inside a jsonb value — leaving
   * these two the only rich content on the table that would arrive unfiltered.
   */
  planning_notes: z
    .object({
      costs: richNote,
      route: richNote
    })
    .partial()
    .optional()
    .nullable(),
  icon_url: optionalUrl,
  image_url: optionalUrl,
  lottie_url: optionalUrl,
  status: statusSchema.default('draft'),
  is_featured: z.coerce.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).default(0),
  meta_title: z.string().optional().nullable(),
  meta_description: z.string().optional().nullable(),
  seo_image_url: optionalUrl
});

export const categoryCreateSchema = categoryBaseSchema.superRefine((data, ctx) => {
  if (!daysRangeValid(data)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['max_days'],
      message: 'Recommended maximum days must be greater than or equal to minimum days.'
    });
  }
});

export const categoryUpdateSchema = categoryBaseSchema.partial().superRefine((data, ctx) => {
  if (!daysRangeValid(data)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['max_days'],
      message: 'Recommended maximum days must be greater than or equal to minimum days.'
    });
  }
});
