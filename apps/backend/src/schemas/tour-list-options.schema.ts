import { z } from 'zod';
import { TOUR_LIMITS } from './tour-limits';
export const tourListOptionCreateSchema = z.object({
  kind: z.enum(['inclusion', 'exclusion']),
  title: z.string().trim().min(1).max(TOUR_LIMITS.listItem).transform(title => title.replace(/\s+/g, ' ')),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).default(0)
}).strict();
export const tourListOptionUpdateSchema = tourListOptionCreateSchema.omit({kind:true}).partial();
export const tourListOptionBulkSchema = z.object({
  kind: z.enum(['inclusion', 'exclusion']),
  titles: z.array(tourListOptionCreateSchema.shape.title).min(1).max(200)
});
