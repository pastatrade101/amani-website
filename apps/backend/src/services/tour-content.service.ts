import { supabase } from '../config/supabase';
import type { TourContentInput } from '../schemas/tours.schema';
import { AppError } from '../utils/api-response';
import { sanitizeRichFields } from '../utils/rich-text';
import {
  planDays,
  planImages,
  referencedIds,
  SAFARI_STYLES,
  textListRows,
  uniqueIds,
  type DayPlan,
  type ExistingDay,
  type ImagePlan,
  type Stay
} from '../utils/tour-content';

/**
 * Saves the tour editor's content collections: itinerary days with their
 * per-style stays, inclusions, exclusions, gallery and linked activities.
 *
 * PostgREST gives no transaction, so everything is read and checked before the
 * first write, and each collection is written in the order that loses the
 * least if a later step fails (new rows land before old ones are removed).
 */

const STAYS_MIGRATION = 'database/migrations/2026-09-30-itinerary-stays.sql';

const dayColumns =
  'id,tour_id,day_number,title,summary,description,destination_id,travel_mode,meals,activities,image_url,image_urls,accommodation,accommodation_id';
const storedDaysSelect = `${dayColumns}, stays:itinerary_day_stays!itinerary_day_stays_itinerary_day_id_fkey(safari_style)`;

const errorText = (error: unknown) => JSON.stringify(error ?? '').toLowerCase();

const isMissingSchema = (error: unknown) => {
  const text = errorText(error);
  return ['42p01', '42703', 'pgrst200', 'pgrst204', 'pgrst205', 'schema cache'].some((code) => text.includes(code));
};

const sanitizeDescription = (html: string) =>
  String(sanitizeRichFields('itinerary_days', { description: html }).description ?? '');

/** The ids in `ids` that `table` does not have. */
const missingIds = async (table: string, ids: string[]): Promise<string[]> => {
  if (!ids.length) return [];
  const { data, error } = await supabase.from(table).select('id').in('id', ids);
  if (error) throw new AppError(`Unable to check ${table}.`, 500, [error]);
  const found = new Set((data ?? []).map((row) => String((row as { id: unknown }).id)));
  return ids.filter((id) => !found.has(id));
};

const loadDayPlan = async (tourId: string, days: NonNullable<TourContentInput['days']>): Promise<DayPlan> => {
  const { data, error } = await supabase.from('itinerary_days').select(storedDaysSelect).eq('tour_id', tourId);
  if (error) {
    if (isMissingSchema(error)) {
      throw new AppError(`Itinerary days cannot be saved until ${STAYS_MIGRATION} has been applied.`, 503, [error]);
    }
    throw new AppError('Unable to load the itinerary days.', 500, [error]);
  }

  const plan = planDays(tourId, (data ?? []) as unknown as ExistingDay[], days, sanitizeDescription);

  const { lodgeIds, destinationIds } = referencedIds(days);
  const [lodgesMissing, destinationsMissing] = await Promise.all([
    missingIds('lodges', lodgeIds),
    missingIds('destinations', destinationIds)
  ]);
  if (lodgesMissing.length) {
    throw new AppError('A stay points at a lodge that no longer exists. Choose the lodge again and save.', 422, [{ lodge_ids: lodgesMissing }]);
  }
  if (destinationsMissing.length) {
    throw new AppError('A day points at a destination that no longer exists. Choose it again and save.', 422, [{ destination_ids: destinationsMissing }]);
  }
  return plan;
};

const loadImagePlan = async (tourId: string, images: NonNullable<TourContentInput['images']>): Promise<ImagePlan> => {
  const { data, error } = await supabase.from('tour_images').select('id').eq('tour_id', tourId);
  if (error) throw new AppError('Unable to load the tour gallery.', 500, [error]);
  return planImages(tourId, (data ?? []).map((row) => String((row as { id: unknown }).id)), images);
};

const checkActivities = async (activityIds: string[]) => {
  const missing = await missingIds('activities', activityIds);
  if (missing.length) {
    throw new AppError('An activity linked to this tour no longer exists. Remove it and save again.', 422, [{ activity_ids: missing }]);
  }
};

const writeDays = async (tourId: string, plan: DayPlan) => {
  if (plan.remove.length) {
    // Stays go with their day (on delete cascade).
    const { error } = await supabase.from('itinerary_days').delete().eq('tour_id', tourId).in('id', plan.remove);
    if (error) throw new AppError('Unable to remove itinerary days.', 500, [error]);
  }
  if (plan.park.length) {
    const { error } = await supabase.from('itinerary_days').upsert(plan.park, { onConflict: 'id' });
    if (error) throw new AppError('Unable to reorder the itinerary days.', 500, [error]);
  }
  if (plan.keep.length) {
    const { error } = await supabase
      .from('itinerary_days')
      .upsert(plan.keep.map(({ id, row }) => ({ id, ...row })), { onConflict: 'id' });
    if (error) throw new AppError('Unable to save the itinerary days.', 500, [error]);
  }

  const stays: Array<Stay & { itinerary_day_id: string }> = [];
  for (const day of plan.keep) {
    for (const stay of day.stays ?? []) stays.push({ itinerary_day_id: day.id, ...stay });
  }

  if (plan.add.length) {
    const { data, error } = await supabase
      .from('itinerary_days')
      .insert(plan.add.map((day) => day.row))
      .select('id, day_number');
    if (error) throw new AppError('Unable to add the new itinerary days.', 500, [error]);
    const idByNumber = new Map((data ?? []).map((row) => [Number(row.day_number), String(row.id)]));
    for (const day of plan.add) {
      const id = idByNumber.get(day.row.day_number);
      if (id) for (const stay of day.stays) stays.push({ itinerary_day_id: id, ...stay });
    }
  }

  if (stays.length) {
    const { error } = await supabase.from('itinerary_day_stays').upsert(stays, { onConflict: 'itinerary_day_id,safari_style' });
    if (error) throw new AppError('Unable to save where travellers stay.', 500, [error]);
  }
  for (const style of SAFARI_STYLES) {
    const dayIds = plan.keep.filter((day) => day.dropStyles.includes(style)).map((day) => day.id);
    if (!dayIds.length) continue;
    const { error } = await supabase
      .from('itinerary_day_stays')
      .delete()
      .in('itinerary_day_id', dayIds)
      .eq('safari_style', style);
    if (error) throw new AppError('Unable to remove a stay.', 500, [error]);
  }
};

/** Replace inclusions or exclusions: new rows first, so a failed insert loses nothing. */
const replaceTextList = async (table: 'tour_inclusions' | 'tour_exclusions', tourId: string, items: string[]) => {
  const { data: previous, error: readError } = await supabase.from(table).select('id').eq('tour_id', tourId);
  if (readError) throw new AppError(`Unable to load ${table}.`, 500, [readError]);

  const rows = textListRows(tourId, items);
  if (rows.length) {
    const { error } = await supabase.from(table).insert(rows);
    if (error) throw new AppError(`Unable to save ${table}.`, 500, [error]);
  }
  const previousIds = (previous ?? []).map((row) => String((row as { id: unknown }).id));
  if (previousIds.length) {
    const { error } = await supabase.from(table).delete().in('id', previousIds);
    if (error) throw new AppError(`Unable to replace ${table}.`, 500, [error]);
  }
};

const writeImages = async (tourId: string, plan: ImagePlan) => {
  if (plan.keep.length) {
    const { error } = await supabase.from('tour_images').upsert(plan.keep, { onConflict: 'id' });
    if (error) throw new AppError('Unable to save the tour gallery.', 500, [error]);
  }
  if (plan.add.length) {
    const { error } = await supabase.from('tour_images').insert(plan.add);
    if (error) throw new AppError('Unable to add photos to the tour gallery.', 500, [error]);
  }
  if (plan.remove.length) {
    const { error } = await supabase.from('tour_images').delete().eq('tour_id', tourId).in('id', plan.remove);
    if (error) throw new AppError('Unable to remove photos from the tour gallery.', 500, [error]);
  }
};

const writeActivities = async (tourId: string, activityIds: string[]) => {
  if (activityIds.length) {
    const { error } = await supabase
      .from('tour_activities')
      .upsert(
        activityIds.map((activityId, index) => ({ tour_id: tourId, activity_id: activityId, sort_order: index })),
        { onConflict: 'tour_id,activity_id' }
      );
    if (error) {
      const status = isMissingSchema(error) ? 503 : 500;
      throw new AppError('Unable to link activities to this tour. Run the activity links migration first.', status, [error]);
    }
  }

  let unlink = supabase.from('tour_activities').delete().eq('tour_id', tourId);
  if (activityIds.length) unlink = unlink.not('activity_id', 'in', `(${activityIds.join(',')})`);
  const { error } = await unlink;
  // Nothing to unlink before the activity links migration exists.
  if (error && !(isMissingSchema(error) && !activityIds.length)) {
    throw new AppError('Unable to unlink activities from this tour.', 500, [error]);
  }
};

export const applyTourContent = async (tourId: string, body: TourContentInput, userId?: string) => {
  // Read and check everything first; nothing is written until the whole
  // payload is known to fit. The collections live in separate tables, so the
  // checks run side by side, and so do the writes (each one is already safe
  // on its own: new rows land before old ones go). A six-day save was about
  // twenty round trips in a row.
  const activityIds = body.activity_ids ? uniqueIds(body.activity_ids) : null;
  const [dayPlan, imagePlan] = await Promise.all([
    body.days ? loadDayPlan(tourId, body.days) : null,
    body.images ? loadImagePlan(tourId, body.images) : null,
    activityIds ? checkActivities(activityIds) : null
  ]);

  await Promise.all([
    dayPlan ? writeDays(tourId, dayPlan) : null,
    body.inclusions ? replaceTextList('tour_inclusions', tourId, body.inclusions) : null,
    body.exclusions ? replaceTextList('tour_exclusions', tourId, body.exclusions) : null,
    imagePlan ? writeImages(tourId, imagePlan) : null,
    activityIds ? writeActivities(tourId, activityIds) : null
  ]);

  // The tours list shows when a tour was last edited; content counts.
  const touch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (userId) touch.updated_by = userId;
  await supabase.from('tours').update(touch).eq('id', tourId);
};
