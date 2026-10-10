import { z } from 'zod';

export const tourInclusionCreateSchema = z.object({
  tour_id: z.string().uuid(),
  option_id: z.string().uuid(),
  title: z.never({invalid_type_error:'Select an option from the shared library.'}).optional(),
  sort_order: z.coerce.number().int().min(0).optional().default(0)
});

export const tourInclusionUpdateSchema = tourInclusionCreateSchema.partial();
