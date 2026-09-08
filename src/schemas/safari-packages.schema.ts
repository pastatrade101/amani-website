import { z } from 'zod';

const statusSchema = z.enum(['draft', 'published', 'archived']);
const optionalUrl = z.union([z.string().url(), z.literal('')]).optional().nullable();
const optionalUuid = z.union([z.string().uuid(), z.literal(''), z.null()]).optional();

/**
 * One content block.
 *
 * `passthrough`, deliberately — the opposite of the safari-style landing
 * document next door, which is `.strict()` because it is a fixed template. Here
 * the block vocabulary is meant to grow: a new block type ships in the renderer
 * and the editor without a migration and without touching this file. The one
 * thing enforced is that a block says what it is, because the renderer switches
 * on `type` and a block without one can never draw anything.
 */
const sectionBlockSchema = z.object({ type: z.string().min(1) }).passthrough();

export const safariPackageCreateSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).optional(),

  tour_id: optionalUuid,
  category_id: optionalUuid,

  hero_eyebrow: z.string().optional().nullable(),
  hero_title: z.string().optional().nullable(),
  hero_subtitle: z.string().optional().nullable(),
  hero_image_url: optionalUrl,

  // A page of sixty blocks is a mistake, not a long page.
  sections: z.array(sectionBlockSchema).max(60).optional(),

  status: statusSchema.default('draft'),

  /**
   * Strict boolean, never `z.coerce.boolean()`.
   *
   * Coercion turns the string "false" into `true`, which on an indexing flag
   * is the wrong direction to be wrong in: it would invite a crawler onto a
   * page the editor had just marked as not ready. An absent value stays absent
   * and the column keeps whatever it already had.
   */
  indexable: z.boolean().optional(),

  is_featured: z.coerce.boolean().default(false),
  sort_order: z.coerce.number().int().optional().nullable(),

  seo_title: z.string().optional().nullable(),
  meta_title: z.string().optional().nullable(),
  meta_description: z.string().optional().nullable(),
  og_image_url: optionalUrl
});

export const safariPackageUpdateSchema = safariPackageCreateSchema.partial();
