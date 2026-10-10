import { syncTourStartingPrice } from '../services/tour-starting-price.service';
import { supabase } from '../config/supabase';
import { safeAudit } from '../services/audit.service';
import { AppError, sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import { getPagination, getQueryString, paginationMeta } from '../utils/query';

const select = '*, tours(id,title,slug,duration_days,duration_nights,price_from,currency,status,destinations!tours_destination_id_fkey(name,slug,country))';

const normalizePayload = (payload: Record<string, unknown>) => {
  const normalized = { ...payload };
  const title = String(payload.title ?? payload.label ?? '').trim();

  if (title) {
    normalized.title = title;
    normalized.label = title;
  }

  if (payload.currency) normalized.currency = String(payload.currency).toUpperCase();
  if (!payload.price_type) normalized.price_type = 'per_person';

  return normalized;
};

// Keep the tour-card starting price aligned with its real per-person rates.
// Other option types (supplements, upgrades, discounts and group totals) must
// not become the public "from" price.

export const listPricingOptions = asyncHandler(async (req, res) => {
  const { page, limit, from, to } = getPagination(req.query);
  const tourId = getQueryString(req.query, 'tour_id');
  const priceType = getQueryString(req.query, 'price_type');

  let query = supabase
    .from('tour_price_options')
    .select(select, { count: 'exact' })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (tourId && tourId !== 'all') query = query.eq('tour_id', tourId);
  if (priceType && priceType !== 'all') query = query.eq('price_type', priceType);

  const { data, error, count } = await query.range(from, to);
  if (error) throw new AppError('Unable to fetch pricing options.', 500, [error]);

  return sendSuccess(res, 'Pricing options fetched successfully.', {
    items: data ?? [],
    pagination: paginationMeta(page, limit, count ?? 0)
  });
});

export const listTourPricingOptions = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('tour_price_options')
    .select(select)
    .eq('tour_id', req.params.tourId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new AppError('Unable to fetch tour pricing options.', 500, [error]);

  return sendSuccess(res, 'Tour pricing options fetched successfully.', data ?? []);
});

export const getPricingOption = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('tour_price_options')
    .select(select)
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) throw new AppError('Unable to fetch pricing option.', 500, [error]);
  if (!data) throw new AppError('Pricing option not found.', 404);

  return sendSuccess(res, 'Pricing option fetched successfully.', data);
});

export const createPricingOption = asyncHandler(async (req, res) => {
  const payload = normalizePayload(req.body as Record<string, unknown>);

  const { data, error } = await supabase
    .from('tour_price_options')
    .insert(payload)
    .select(select)
    .single();

  if (error) throw new AppError('Unable to create pricing option.', 500, [error]);

  if (!data.is_addon) await syncTourStartingPrice(String(data.tour_id));

  await safeAudit({ action: 'create', entityId: data?.id, entityType: 'tour_price_options', newData: data, req });

  return sendSuccess(res, 'Pricing option created successfully.', data, 201);
});

export const updatePricingOption = asyncHandler(async (req, res) => {
  const { data: previous, error: previousError } = await supabase
    .from('tour_price_options')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  if (previousError) throw new AppError('Unable to fetch pricing option.', 500, [previousError]);
  if (!previous) throw new AppError('Pricing option not found.', 404);

  const payload = normalizePayload(req.body as Record<string, unknown>);

  const { data, error } = await supabase
    .from('tour_price_options')
    .update(payload)
    .eq('id', req.params.id)
    .select(select)
    .single();

  if (error) throw new AppError(error.code === '23514' ? 'This rate is used by an optional activity. Keep its tour and charge basis compatible.' : 'Unable to update pricing option.', error.code === '23514' ? 422 : 500, [error]);

  const previousTourId = String(previous.tour_id ?? '');
  const nextTourId = String(data.tour_id ?? previousTourId);
  if (!data.is_addon || !previous.is_addon) await syncTourStartingPrice(nextTourId);
  if (previousTourId && previousTourId !== nextTourId) await syncTourStartingPrice(previousTourId);

  await safeAudit({ action: 'update', entityId: req.params.id, entityType: 'tour_price_options', oldData: previous, newData: data, req });

  return sendSuccess(res, 'Pricing option updated successfully.', data);
});

export const deletePricingOption = asyncHandler(async (req, res) => {
  const { data: previous } = await supabase
    .from('tour_price_options')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  const { error } = await supabase.from('tour_price_options').delete().eq('id', req.params.id);
  if (error) throw new AppError(error.code === '23503' ? 'Unlink this rate from its optional activity before deleting it.' : 'Unable to delete pricing option.', error.code === '23503' ? 409 : 500, [error]);

  if (!previous?.is_addon) await syncTourStartingPrice(String(previous?.tour_id ?? ''));

  await safeAudit({ action: 'delete', entityId: req.params.id, entityType: 'tour_price_options', oldData: previous, req });

  return sendSuccess(res, 'Pricing option deleted successfully.');
});

const seasonSelect = '*, group_prices:tour_group_prices(*)';

export const listTourPricingSeasons = asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('tour_pricing_seasons').select(seasonSelect).eq('tour_id', req.params.tourId).order('sort_order').order('minimum_travelers', { referencedTable: 'tour_group_prices' });
  if (error) throw new AppError('Unable to fetch pricing seasons. Run the season pricing migration first.', 500, [error]);
  return sendSuccess(res, 'Pricing seasons fetched successfully.', data ?? []);
});

export const saveTourPricingSeasons = asyncHandler(async (req, res) => {
  const tourId = String(req.body.tour_id);
  const seasons = req.body.seasons as Array<Record<string, any>>;
  const savedIds: string[] = [];

  for (const [index, season] of seasons.entries()) {
    const seasonPayload = {
      ...(season.id ? { id: season.id } : {}), tour_id: tourId, safari_style: season.safari_style ?? 'midrange', season_type: season.season_type,
      season_name: season.season_name, start_date: season.start_date || null, end_date: season.end_date || null,
      currency: season.currency, pricing_basis: season.pricing_basis, status: season.status, sort_order: season.sort_order ?? index * 10
    };
    const { data: saved, error } = await supabase.from('tour_pricing_seasons').upsert(seasonPayload).select('id').single();
    if (error) throw new AppError('Unable to save pricing season.', 500, [error]);
    savedIds.push(saved.id);

    const { error: clearError } = await supabase.from('tour_group_prices').delete().eq('season_id', saved.id);
    if (clearError) throw new AppError('Unable to update season group prices.', 500, [clearError]);
    const rows = (season.group_prices ?? []).map((price: Record<string, any>, priceIndex: number) => ({
      season_id: saved.id, minimum_travelers: price.minimum_travelers, maximum_travelers: price.maximum_travelers ?? null,
      room_count: price.room_count, price: price.price_status === 'FIXED_PRICE' ? price.price : null,
      price_status: price.price_status, sort_order: price.sort_order ?? priceIndex * 10
    }));
    if (rows.length) {
      const { error: pricesError } = await supabase.from('tour_group_prices').insert(rows);
      if (pricesError) throw new AppError('Unable to save season group prices.', 500, [pricesError]);
    }
  }

  let staleQuery = supabase.from('tour_pricing_seasons').delete().eq('tour_id', tourId);
  if (savedIds.length) staleQuery = staleQuery.not('id', 'in', `(${savedIds.join(',')})`);
  const { error: staleError } = await staleQuery;
  if (staleError) throw new AppError('Pricing saved, but removed seasons could not be cleared.', 500, [staleError]);

  const { data, error } = await supabase.from('tour_pricing_seasons').select(seasonSelect).eq('tour_id', tourId).order('sort_order');
  if (error) throw new AppError('Pricing saved, but could not be reloaded.', 500, [error]);
  const fixedPerPersonRates = (data ?? []).flatMap((season: Record<string, any>) =>
    season.status === 'ACTIVE' && season.pricing_basis === 'PER_PERSON'
      ? (season.group_prices ?? []).filter((price: Record<string, any>) => price.price_status === 'FIXED_PRICE' && price.price != null).map((price: Record<string, any>) => Number(price.price))
      : []
  ).filter((price: number) => Number.isFinite(price));
  if (fixedPerPersonRates.length) {
    const { error: tourPriceError } = await supabase.from('tours').update({ price_from: Math.min(...fixedPerPersonRates) }).eq('id', tourId);
    if (tourPriceError) throw new AppError('Season pricing saved, but the tour starting price could not be synchronized.', 500, [tourPriceError]);
  }
  await safeAudit({ action: 'update', entityId: tourId, entityType: 'tour_pricing_seasons', newData: data, req });
  return sendSuccess(res, 'Season pricing saved successfully.', data ?? []);
});
