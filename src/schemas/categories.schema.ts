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

const landingText = (max = 4000) => z.string().trim().min(1).max(max);
const landingList = z.array(landingText(600)).length(4);
const landingLinkSchema = z.object({
  label: landingText(160),
  // Guide links are deliberately internal. This prevents copied content from
  // silently sending visitors off-site and matches the approved page export.
  href: z.string().trim().max(500).regex(/^(?:\/(?!\/)|#)/, 'Use an internal path or page anchor.')
}).strict();

/**
 * One complete safari-style landing-page document. Its keys intentionally
 * mirror the public template props, making a CMS JSON export copy-pasteable.
 * Exact list lengths enforce the visual rhythm in the approved UI.
 */
const landingPageContentSchema = z.object({
  hero: z.object({
    eyebrow: landingText(120),
    headline: landingText(180),
    subheadline: landingText(600),
    primaryCtaLabel: landingText(80),
    secondaryCtaLabel: landingText(80),
    trustLine: landingText(500)
  }).strict(),
  trustChips: landingList,
  overview: z.object({
    label: landingText(120),
    headline: landingText(180),
    paragraphs: z.array(landingText(4000)).min(1).max(4),
    // Required: this band is a photo beside the paragraphs, so a page without
    // one publishes half empty. Every existing row already carries an absolute
    // URL, so tightening this rejects nothing that is already stored.
    imageUrl: z.string().url()
  }).strict(),
  planner: z.object({
    label: landingText(120),
    headline: landingText(180),
    intro: landingText(600)
  }).strict(),
  tourCollection: z.object({
    label: landingText(120),
    headline: landingText(180),
    subheadline: landingText(600),
    resultsNoun: landingText(120),
    loadMoreLabel: landingText(80)
  }).strict(),
  planningGuide: z.object({
    label: landingText(120),
    title: landingText(180),
    intro: landingText(1200),
    blocks: z.array(z.object({
      title: landingText(160),
      body: landingText(5000),
      links: z.array(landingLinkSchema).min(1).max(8)
    }).strict()).length(4)
  }).strict(),
  advisor: z.object({
    headline: landingText(180),
    intro: landingText(1200),
    big: landingList,
    quiet: landingList
  }).strict(),
  howItsPlanned: z.object({
    label: landingText(120),
    title: landingText(180),
    intro: landingText(600),
    steps: z.array(z.object({
      title: landingText(160),
      text: landingText(600)
    }).strict()).length(4)
  }).strict(),
  reviews: z.object({
    label: landingText(120),
    title: landingText(180),
    intro: landingText(800)
  }).strict(),
  faq: z.object({
    title: landingText(180),
    answeredBy: landingText(120)
  }).strict(),
  finalCta: z.object({
    label: landingText(120),
    headline: landingText(180),
    subheadline: landingText(800),
    proofs: landingList,
    buttonLabel: landingText(80),
    whatsappLabel: landingText(160)
  }).strict()
}).strict();

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
  landing_page_content: landingPageContentSchema.optional().nullable(),
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
  if (data.status === 'published' && !data.landing_page_content) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['landing_page_content'],
      message: 'Complete safari-style landing-page content is required before publishing.'
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
  if (data.status === 'published' && !data.landing_page_content) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['landing_page_content'],
      message: 'Complete safari-style landing-page content is required before publishing.'
    });
  }
});
