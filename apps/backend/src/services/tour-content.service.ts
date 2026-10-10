import { syncTourStartingPrice } from './tour-starting-price.service';
import { supabase } from '../config/supabase';
import type { TourContentInput } from '../schemas/tours.schema';
import { AppError } from '../utils/api-response';
import { sanitizeRichFields } from '../utils/rich-text';
import {
  planDays,
  planImages,
  referencedIds,
  SAFARI_STYLES,
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

/** Check all selections before any content write, then recheck inside the SQL transaction. */
const checkListOptions = async (tourId: string, kind: 'inclusion' | 'exclusion', ids: string[]) => {
  if (!ids.length) return;
  const table = kind === 'inclusion' ? 'tour_inclusions' : 'tour_exclusions';
  const [{data:options,error},{data:previous,error:readError}] = await Promise.all([
    supabase.from('tour_list_options').select('id,kind,is_active').in('id',ids),
    supabase.from(table).select('option_id').eq('tour_id',tourId)
  ]);
  if(error||readError)throw new AppError('Unable to validate the package options.',500,[error,readError]);
  const retained = new Set((previous??[]).map(row=>row.option_id));
  if(ids.some(id=>!options?.some(option=>option.id===id && option.kind===kind && (option.is_active||retained.has(id)))))
    throw new AppError(`Select available ${kind} options from the shared library.`,422);
};
const writeListOptions = async (tourId:string, body:TourContentInput) => {
  if(body.inclusion_ids===undefined && body.exclusion_ids===undefined)return;
  const {error}=await supabase.rpc('set_tour_list_options',{
    p_tour_id:tourId,p_inclusion_ids:body.inclusion_ids??null,p_exclusion_ids:body.exclusion_ids??null
  });
  if(error)throw new AppError('Unable to save the selected package options.',error.code==='23514'?422:500,[error]);
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

const writeActivities = async (tourId: string, activityIds: string[], settings?: TourContentInput['activity_settings']) => {
  // A per-person rate that becomes an activity add-on stops counting towards
  // the tour's "from" price. Any other content save leaves price_from alone.
  const linked = (settings ?? []).flatMap(row => row.pricing_option_id ? [row.pricing_option_id] : []);
  let becomingAddOns = 0;
  if (linked.length) {
    const { count, error } = await supabase.from('tour_price_options').select('id',{count:'exact',head:true}).eq('tour_id',tourId).in('id',linked).eq('price_type','per_person').eq('is_addon',false);
    if (error) throw new AppError('Unable to verify tour rates.',500,[error]);
    becomingAddOns = count ?? 0;
  }
  const { error } = await supabase.rpc('set_tour_activity_links', {
    p_tour_id: tourId,
    p_links: settings ?? activityIds.map(activity_id => ({ activity_id }))
  });
  // 23514 messages come from set_tour_activity_links and name the actual problem.
  if (error) throw new AppError(error.code === '23514' ? `Unable to save tour activities: ${error.message}` : 'Unable to save tour activities.', error.code === '23514' ? 422 : 500, [error]);
  if (becomingAddOns) await syncTourStartingPrice(tourId);
};

export const applyTourContent = async (tourId: string, body: TourContentInput, userId?: string) => {
  // Read and check everything first; nothing is written until the whole
  // payload is known to fit. The collections live in separate tables, so the
  // checks run side by side, and so do the writes (each one is already safe
  // on its own: new rows land before old ones go). A six-day save was about
  // twenty round trips in a row.
  const activityIds = body.activity_settings ? body.activity_settings.map(row => row.activity_id) : body.activity_ids ? uniqueIds(body.activity_ids) : null;
  if (body.activity_ids && body.activity_settings && JSON.stringify(body.activity_ids) !== JSON.stringify(activityIds))
    throw new AppError('Activity choices and settings must match in the same order.', 422);
  if (body.activity_settings?.some(row => row.pricing_option_id)) {
    const { data, error } = await supabase.from('tour_price_options').select('id,tour_id,price_type').in('id', body.activity_settings.flatMap(row => row.pricing_option_id ? [row.pricing_option_id] : []));
    if (error) throw new AppError('Unable to check activity prices.', 500, [error]);
    if (body.activity_settings.some(row => row.pricing_option_id && !data?.some(price => price.id === row.pricing_option_id && price.tour_id === tourId && ['per_person','per_group','per_child','upgrade'].includes(price.price_type))))
      throw new AppError('Choose an activity pricing option from this tour.', 422);
  }
  const [dayPlan, imagePlan] = await Promise.all([
    body.days ? loadDayPlan(tourId, body.days) : null,
    body.images ? loadImagePlan(tourId, body.images) : null,
    activityIds ? checkActivities(activityIds) : null,
    body.inclusion_ids ? checkListOptions(tourId,'inclusion',body.inclusion_ids) : null,
    body.exclusion_ids ? checkListOptions(tourId,'exclusion',body.exclusion_ids) : null
  ]);

  await Promise.all([
    dayPlan ? writeDays(tourId, dayPlan) : null,
    writeListOptions(tourId,body),
    imagePlan ? writeImages(tourId, imagePlan) : null,
    activityIds ? writeActivities(tourId, activityIds, body.activity_settings) : null
  ]);

  // The tours list shows when a tour was last edited; content counts.
  const touch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (userId) touch.updated_by = userId;
  await supabase.from('tours').update(touch).eq('id', tourId);
};
