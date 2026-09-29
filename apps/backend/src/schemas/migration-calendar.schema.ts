import { z } from 'zod';

export const migrationCalendarCreateSchema = z.object({
  month: z.string().min(1),
  location: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  image_url: z.union([z.string().url(), z.literal('')]).optional().nullable(),
  display_order: z.coerce.number().int().min(0).default(0),
  is_published: z.boolean().optional().default(true)
});

export const migrationCalendarUpdateSchema = migrationCalendarCreateSchema.partial();
