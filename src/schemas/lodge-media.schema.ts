import { z } from 'zod';

/**
 * Gallery and amenities are edited as whole sets, not row by row.
 *
 * The admin screen already holds the complete ordered list in memory, so one
 * "here is the gallery now" call replaces upload, reorder, re-cover, edit and
 * delete with a single round trip — and cannot leave the gallery half-saved.
 */
export const lodgeImagesReplaceSchema = z.object({
  images: z
    .array(
      z.object({
        image_url: z.string().min(1).max(2048),
        alt_text: z.string().max(300).optional().nullable(),
        caption: z.string().max(500).optional().nullable(),
        is_cover: z.boolean().optional()
      })
    )
    // Enough for a property gallery; a guard rather than a product limit.
    .max(60)
});

export const lodgeAmenitiesReplaceSchema = z.object({
  amenity_ids: z.array(z.string().uuid()).max(80)
});

export const amenityCreateSchema = z.object({
  name: z.string().min(2).max(80),
  icon_key: z.string().max(40).optional().nullable(),
  sort_order: z.coerce.number().int().optional(),
  is_active: z.boolean().optional()
});

export const amenityUpdateSchema = amenityCreateSchema.partial();
