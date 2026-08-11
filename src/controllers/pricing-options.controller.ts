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
const syncTourStartingPrice = async (tourId: string) => {
  if (!tourId) return;
  const { data, error } = await supabase
    .from('tour_price_options')
    .select('price')
    .eq('tour_id', tourId)
    .eq('price_type', 'per_person')
    .order('price', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new AppError('Pricing option saved, but the tour starting price could not be synchronized.', 500, [error]);
  const nextPrice = data?.price ?? 0;

  const { error: updateError } = await supabase
    .from('tours')
    .update({ price_from: nextPrice })
    .eq('id', tourId);
  if (updateError) throw new AppError('Pricing option saved, but the tour starting price could not be synchronized.', 500, [updateError]);
};

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

  await syncTourStartingPrice(String(data.tour_id));

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

  if (error) throw new AppError('Unable to update pricing option.', 500, [error]);

  const previousTourId = String(previous.tour_id ?? '');
  const nextTourId = String(data.tour_id ?? previousTourId);
  await syncTourStartingPrice(nextTourId);
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
  if (error) throw new AppError('Unable to delete pricing option.', 500, [error]);

  await syncTourStartingPrice(String(previous?.tour_id ?? ''));

  await safeAudit({ action: 'delete', entityId: req.params.id, entityType: 'tour_price_options', oldData: previous, req });

  return sendSuccess(res, 'Pricing option deleted successfully.');
});
