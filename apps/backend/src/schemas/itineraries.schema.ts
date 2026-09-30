import { z } from 'zod';
import { LIMIT_MESSAGES as M, TOUR_LIMITS as L } from './tour-limits';
import { activityRules, fitsText } from './tours.schema';

const optionalText = z.string().optional().nullable();
const optionalUrl = z.union([z.string().url(), z.literal('')]).optional().nullable();
// An emptied picker sends '' — that clears the link rather than failing the uuid column.
const blankToNull = (value: unknown) => (typeof value === 'string' && !value.trim() ? null : value);
const optionalUuid = z.preprocess(blankToNull, z.string().uuid().nullable()).optional();

// The same text limits as a day saved through the tour editor (PUT /tours/:id/content).
export const itineraryCreateSchema = z.object({
  tour_id: z.string().uuid(),
  day_number: z.coerce.number().int().positive(),
  title: z.string().min(2).max(L.dayTitle, M.dayTitle),
  summary: z.preprocess(blankToNull, z.string().trim().max(L.daySummary, M.daySummary).nullable()).optional(),
  description: z.string().refine(fitsText(L.dayDescription), M.dayDescription).optional().nullable(),
  accommodation: z.string().max(L.stayName, M.stayName).optional().nullable(),
  // Optional link to a real property. The free-text field above stays the
  // fallback for anything not yet in the CMS.
  accommodation_id: optionalUuid,
  // The place the day is spent (pins it on the route map) and how travellers
  // reach it from the day before. Null is "not stated".
  destination_id: optionalUuid,
  travel_mode: z.preprocess(blankToNull, z.enum(['DRIVE', 'FLY', 'BOAT']).nullable()).optional(),
  meals: z.string().max(L.meals, M.meals).optional().nullable(),
  activities: z.string().superRefine(activityRules).optional().nullable(),
  image_url: optionalUrl,
  // The day's photos, first is the lead; image_url is kept equal to it.
  image_urls: z.array(z.string().trim().url()).max(L.dayPhotos, M.dayPhotos).optional()
});

export const itineraryUpdateSchema = itineraryCreateSchema.partial();
