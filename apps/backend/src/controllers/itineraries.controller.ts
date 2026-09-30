import { supabase } from '../config/supabase';
import { safeAudit } from '../services/audit.service';
import { AppError, sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import { cleanSearch, getPagination, getQueryString, paginationMeta } from '../utils/query';
import { sanitizeRichFields } from '../utils/rich-text';
import { dayImageFields, dayImages, legacyStyleFor, normaliseStays } from '../utils/tour-content';

// The linked property rides along so the admin list and the day editor can
// show it without a second call. Null for days still using free text.
const select =
  '*, tours(id,title,slug,duration_days,duration_nights,status,destinations!tours_destination_id_fkey(name,slug,country)), lodge:lodges!itinerary_days_accommodation_id_fkey(id,name,slug,lodge_type,accommodation_level,hero_image_url,image_url,destinations!lodges_destination_id_fkey(name))';

/**
 * This form edits one stay per day (accommodation / accommodation_id). Keep it
 * in step with the per-style stays the tour editor and public pages read by
 * writing the stay those columns mirror: midrange, else the first.
 */
const syncLegacyStay = async (day: Record<string, unknown>, body: Record<string, unknown>) => {
  if (!('accommodation_id' in body) && !('accommodation' in body)) return;
  const dayId = String(day.id);
  const { data: stays, error } = await supabase.from('itinerary_day_stays').select('safari_style').eq('itinerary_day_id', dayId);
  // Before the stays migration there is nothing to keep in step.
  if (error) return;

  const style = legacyStyleFor((stays ?? []).map((stay) => stay.safari_style));
  const [stay] = normaliseStays([
    { safari_style: style, lodge_id: day.accommodation_id as string | null, accommodation: day.accommodation as string | null }
  ]);
  const { error: writeError } = stay
    ? await supabase.from('itinerary_day_stays').upsert({ itinerary_day_id: dayId, ...stay }, { onConflict: 'itinerary_day_id,safari_style' })
    : await supabase.from('itinerary_day_stays').delete().eq('itinerary_day_id', dayId).eq('safari_style', style);
  if (writeError) throw new AppError('The day was saved, but where travellers stay could not be updated.', 500, [writeError]);
};

const duplicateDayExists = async (tourId: string, dayNumber: number, excludeId?: string) => {
  let query = supabase
    .from('itinerary_days')
    .select('id')
    .eq('tour_id', tourId)
    .eq('day_number', dayNumber);

  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query.maybeSingle();
  if (error) throw new AppError('Unable to validate itinerary day.', 500, [error]);

  return Boolean(data);
};

export const listItineraries = asyncHandler(async (req, res) => {
  const { page, limit, from, to } = getPagination(req.query);
  const tourId = getQueryString(req.query, 'tour_id');
  const search = cleanSearch(getQueryString(req.query, 'search'));

  let query = supabase
    .from('itinerary_days')
    .select(select, { count: 'exact' })
    .order('day_number', { ascending: true })
    .order('created_at', { ascending: true });

  if (tourId && tourId !== 'all') query = query.eq('tour_id', tourId);
  if (search) {
    query = query.or(
      ['title', 'description', 'accommodation', 'meals', 'activities']
        .map((column) => `${column}.ilike.%${search}%`)
        .join(',')
    );
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw new AppError('Unable to fetch itinerary days.', 500, [error]);

  return sendSuccess(res, 'Itinerary days fetched successfully.', {
    items: data ?? [],
    pagination: paginationMeta(page, limit, count ?? 0)
  });
});

export const listTourItineraries = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('itinerary_days')
    .select(select)
    .eq('tour_id', req.params.tourId)
    .order('day_number', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new AppError('Unable to fetch tour itinerary days.', 500, [error]);

  return sendSuccess(res, 'Tour itinerary days fetched successfully.', data ?? []);
});

export const getItinerary = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('itinerary_days')
    .select(select)
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) throw new AppError('Unable to fetch itinerary day.', 500, [error]);
  if (!data) throw new AppError('Itinerary day not found.', 404);

  return sendSuccess(res, 'Itinerary day fetched successfully.', data);
});

export const createItinerary = asyncHandler(async (req, res) => {
  const body = req.body as Record<string, unknown> & { day_number: number; tour_id: string };

  if (await duplicateDayExists(body.tour_id, body.day_number)) {
    throw new AppError('This tour already has an itinerary day with that day number.', 409);
  }

  // Itinerary days have their own controller rather than the shared
  // createRecord helper, so the rich-text gate has to be applied by hand here.
  const payload = { ...sanitizeRichFields('itinerary_days', body), ...dayImageFields(body, null) };

  const { data, error } = await supabase
    .from('itinerary_days')
    .insert(payload)
    .select(select)
    .single();

  if (error) throw new AppError('Unable to create itinerary day.', 500, [error]);
  await syncLegacyStay(data as Record<string, unknown>, body);

  await safeAudit({ action: 'create', entityId: data?.id, entityType: 'itinerary_days', newData: data, req });

  return sendSuccess(res, 'Itinerary day created successfully.', data, 201);
});

export const updateItinerary = asyncHandler(async (req, res) => {
  const { data: previous, error: previousError } = await supabase
    .from('itinerary_days')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  if (previousError) throw new AppError('Unable to fetch itinerary day.', 500, [previousError]);
  if (!previous) throw new AppError('Itinerary day not found.', 404);

  const body = req.body as Record<string, unknown>;
  const tourId = String(body.tour_id ?? previous.tour_id);
  const dayNumber = Number(body.day_number ?? previous.day_number);

  if (await duplicateDayExists(tourId, dayNumber, req.params.id)) {
    throw new AppError('This tour already has an itinerary day with that day number.', 409);
  }

  const storedImages = Array.isArray(previous.image_urls) ? dayImages(previous) : null;
  const payload = { ...sanitizeRichFields('itinerary_days', body), ...dayImageFields(body, storedImages) };

  const { data, error } = await supabase
    .from('itinerary_days')
    .update(payload)
    .eq('id', req.params.id)
    .select(select)
    .single();

  if (error) throw new AppError('Unable to update itinerary day.', 500, [error]);
  await syncLegacyStay(data as Record<string, unknown>, body);

  await safeAudit({ action: 'update', entityId: req.params.id, entityType: 'itinerary_days', oldData: previous, newData: data, req });

  return sendSuccess(res, 'Itinerary day updated successfully.', data);
});

export const deleteItinerary = asyncHandler(async (req, res) => {
  const { data: previous } = await supabase
    .from('itinerary_days')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  const { error } = await supabase.from('itinerary_days').delete().eq('id', req.params.id);
  if (error) throw new AppError('Unable to delete itinerary day.', 500, [error]);

  await safeAudit({ action: 'delete', entityId: req.params.id, entityType: 'itinerary_days', oldData: previous, req });

  return sendSuccess(res, 'Itinerary day deleted successfully.');
});
