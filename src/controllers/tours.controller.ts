import { asyncHandler } from '../utils/async-handler';
import { supabase } from '../config/supabase';
import { AppError, sendSuccess } from '../utils/api-response';
import { safeAudit } from '../services/audit.service';
import { createUniqueSlug } from '../services/slug.service';
import {
  attachThumbnails,
  bulkSoftDeleteRecords,
  softDeleteRecord,
} from '../utils/supabase-helpers';
import { cleanSearch, getPagination, getQueryString, paginationMeta } from '../utils/query';
import { sanitizeRichFields } from '../utils/rich-text';

const primaryDestinationEmbed = 'destinations!tours_destination_id_fkey(name,slug,country)';
const legacySelect = `*, ${primaryDestinationEmbed}, tour_categories(name,slug)`;
const destinationEmbed = 'tour_destinations(destination_id,sort_order,is_primary,destinations!tour_destinations_destination_id_fkey(id,name,slug,country))';
const select = `${legacySelect}, ${destinationEmbed}`;
// Lean projection for listings: everything the cards use, minus the detail-only
// heavy fields (full_description, sample_itinerary). getTour still uses the full
// select + embeds below.
const legacyListSelect =
  `id, title, slug, short_description, destination_id, category_id, experience_type, persona_tags, duration_days, duration_nights, budget_tier, price_from, currency, main_image_url, banner_image_url, highlights, difficulty_level, group_size, group_size_min, group_size_max, minimum_age, start_location, end_location, is_available, seats_remaining, status, is_featured, is_popular, seo_title, meta_title, meta_description, og_image_url, ${primaryDestinationEmbed}, tour_categories(name,slug)`;
const listSelect = `${legacyListSelect}, ${destinationEmbed}`;
// Detail view also embeds the day-by-day itinerary, what's included/excluded,
// the pricing options and the tour gallery images.
const legacyDetailSelect = `${legacySelect}, itinerary_days(day_number,title,description,accommodation,accommodation_id,meals,activities,image_url,lodge:accommodation_id(id,name,slug,lodge_type,accommodation_level,hero_image_url,image_url,destinations(name))), tour_inclusions(title,sort_order), tour_exclusions(title,sort_order), tour_price_options(id,tour_id,title,label,price,currency,price_type,description,sort_order,created_at,updated_at), tour_images(id,tour_id,image_url,alt_text,caption,sort_order,is_featured,created_at,updated_at)`;
const detailSelect = `${select}, itinerary_days(day_number,title,description,accommodation,accommodation_id,meals,activities,image_url,lodge:accommodation_id(id,name,slug,lodge_type,accommodation_level,hero_image_url,image_url,destinations(name))), tour_inclusions(title,sort_order), tour_exclusions(title,sort_order), tour_price_options(id,tour_id,title,label,price,currency,price_type,description,sort_order,created_at,updated_at), tour_images(id,tour_id,image_url,alt_text,caption,sort_order,is_featured,created_at,updated_at)`;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isTourDestinationsRelationError = (error: unknown) => {
  const text = [
    typeof error === 'string' ? error : '',
    error instanceof Error ? error.message : '',
    JSON.stringify(error ?? '')
  ]
    .join(' ')
    .toLowerCase();
  return (
    text.includes('tour_destinations') ||
    text.includes('schema cache') ||
    text.includes('relationship') ||
    text.includes('pgrst200') ||
    text.includes('pgrst205') ||
    text.includes('42p01')
  );
};

const normalizeDestinationIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.map(String).map((id) => id.trim()).filter(Boolean))]
    : [];

const prepareTourPayload = (body: Record<string, unknown>) => {
  const rawPayload = { ...body };
  const hasDestinationIds = Object.prototype.hasOwnProperty.call(rawPayload, 'destination_ids');
  const hasDestinationId = Object.prototype.hasOwnProperty.call(rawPayload, 'destination_id');

  delete rawPayload.destination_ids;
  delete rawPayload.tour_destinations;

  const explicitPrimary =
    typeof rawPayload.destination_id === 'string' && rawPayload.destination_id.trim()
      ? rawPayload.destination_id.trim()
      : '';
  const destinationIds = normalizeDestinationIds(body.destination_ids);
  if (!destinationIds.length && explicitPrimary) destinationIds.push(explicitPrimary);
  if (explicitPrimary && !destinationIds.includes(explicitPrimary)) destinationIds.unshift(explicitPrimary);

  if (hasDestinationIds) rawPayload.destination_id = destinationIds[0] ?? null;

  return {
    payload: sanitizeRichFields('tours', rawPayload),
    destinationIds,
    syncDestinations: hasDestinationIds || hasDestinationId
  };
};

const syncTourDestinations = async (tourId: string, destinationIds: string[]) => {
  const { error: deleteError } = await supabase.from('tour_destinations').delete().eq('tour_id', tourId);
  if (deleteError) {
    if (isTourDestinationsRelationError(deleteError) && destinationIds.length <= 1) return;
    throw new AppError(
      'Tour destination mapping is unavailable. Run the tour_destinations database migration before saving multiple destinations.',
      500,
      [deleteError]
    );
  }

  if (!destinationIds.length) return;

  const { error: insertError } = await supabase.from('tour_destinations').insert(
    destinationIds.map((destinationId, sortOrder) => ({
      tour_id: tourId,
      destination_id: destinationId,
      sort_order: sortOrder,
      is_primary: sortOrder === 0
    }))
  );

  if (insertError) {
    if (isTourDestinationsRelationError(insertError) && destinationIds.length <= 1) return;
    throw new AppError(
      'Tour destination mapping is unavailable. Run the tour_destinations database migration before saving multiple destinations.',
      500,
      [insertError]
    );
  }
};

const fetchTourById = async (id: string) => {
  const loadTour = (columns: string) =>
    supabase
      .from('tours')
      .select(columns)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

  let { data, error } = await loadTour(detailSelect);
  if (error && isTourDestinationsRelationError(error)) {
    ({ data, error } = await loadTour(legacyDetailSelect));
  }

  if (error) throw new AppError('Unable to fetch tours.', 500, [error]);
  if (!data) throw new AppError('Record not found.', 404);

  const record = data as unknown as Record<string, unknown>;
  await attachThumbnails('tours', [record]);
  return record;
};

export const listTours = asyncHandler(async (req, res) => {
  const { page, limit, from, to } = getPagination(req.query);
  const search = cleanSearch(getQueryString(req.query, 'search'));
  const status = getQueryString(req.query, 'status');
  const destinationId = getQueryString(req.query, 'destination_id');

  let joinedTourIds: string[] | null = null;
  let destinationJoinUnavailable = false;

  if (destinationId && destinationId !== 'all') {
    const { data: joinRows, error: joinError } = await supabase
      .from('tour_destinations')
      .select('tour_id')
      .eq('destination_id', destinationId);
    if (joinError) {
      if (isTourDestinationsRelationError(joinError)) destinationJoinUnavailable = true;
      else throw new AppError('Unable to fetch tour destinations.', 500, [joinError]);
    }

    if (!joinError) {
      joinedTourIds = [...new Set((joinRows ?? []).map((row) => row.tour_id as string).filter(Boolean))];
    }
  }

  const buildListQuery = (columns: string) => {
    let query = supabase
      .from('tours')
      .select(columns, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(['title', 'short_description', 'full_description'].map((column) => `${column}.ilike.%${search}%`).join(','));
    }

    if (status && status !== 'all') query = query.eq('status', status);
    else if (!status) query = query.eq('status', 'published');

    for (const filter of ['category_id', 'is_featured', 'is_popular', 'is_available']) {
      const value = getQueryString(req.query, filter);
      if (!value || value === 'all') continue;
      query = value === 'null' ? query.is(filter, null) : query.eq(filter, value);
    }

    if (destinationId && destinationId !== 'all') {
      if (!destinationJoinUnavailable && joinedTourIds?.length) {
        query = query.or(`destination_id.eq.${destinationId},id.in.(${joinedTourIds.join(',')})`);
      } else {
        query = query.eq('destination_id', destinationId);
      }
    }

    return query.range(from, to);
  };

  let { data, error, count } = await buildListQuery(listSelect);
  if (error && isTourDestinationsRelationError(error)) {
    ({ data, error, count } = await buildListQuery(legacyListSelect));
  }
  if (error) throw new AppError('Unable to fetch tours.', 500, [error]);

  const items = (data ?? []) as unknown as Array<Record<string, unknown>>;
  await attachThumbnails('tours', items);

  return sendSuccess(res, 'Records fetched successfully.', {
    items,
    pagination: paginationMeta(page, limit, count ?? 0)
  });
});

export const getTour = asyncHandler(async (req, res) => {
  const key = req.params.slug;
  const column = uuidPattern.test(key) ? 'id' : 'slug';
  const loadTour = (columns: string) =>
    supabase
      .from('tours')
      .select(columns)
      .eq(column, key)
      .is('deleted_at', null)
      .maybeSingle();

  let { data, error } = await loadTour(detailSelect);
  if (error && isTourDestinationsRelationError(error)) {
    ({ data, error } = await loadTour(legacyDetailSelect));
  }

  if (error) throw new AppError('Unable to fetch tours.', 500, [error]);
  if (!data) throw new AppError('Record not found.', 404);

  const record = data as unknown as Record<string, unknown>;
  await attachThumbnails('tours', [record]);

  return sendSuccess(res, 'Record fetched successfully.', record);
});

export const createTour = asyncHandler(async (req, res) => {
  const { payload, destinationIds, syncDestinations } = prepareTourPayload(req.body);
  const source = String(payload.slug || payload.title);
  payload.slug = await createUniqueSlug('tours', source);

  if (req.user) {
    payload.created_by = req.user.sub;
    payload.updated_by = req.user.sub;
  }

  const { data, error } = await supabase.from('tours').insert(payload).select('id').single();
  if (error) throw new AppError('Unable to create tours.', 500, [error]);

  if (syncDestinations) await syncTourDestinations(data.id, destinationIds);

  const record = await fetchTourById(data.id);
  await safeAudit({ action: 'create', entityId: data.id, entityType: 'tours', newData: record, req });

  return sendSuccess(res, 'Record created successfully.', record, 201);
});

export const updateTour = asyncHandler(async (req, res) => {
  const { payload, destinationIds, syncDestinations } = prepareTourPayload(req.body);

  if (payload.slug) {
    payload.slug = await createUniqueSlug('tours', String(payload.slug), req.params.id);
  }

  if (req.user) payload.updated_by = req.user.sub;

  const { data: previous } = await supabase.from('tours').select('*').eq('id', req.params.id).maybeSingle();
  const { data, error } = await supabase.from('tours').update(payload).eq('id', req.params.id).select('id').single();
  if (error) throw new AppError('Unable to update tours.', 500, [error]);

  if (syncDestinations) await syncTourDestinations(req.params.id, destinationIds);

  const record = await fetchTourById(data.id);
  await safeAudit({ action: 'update', entityId: req.params.id, entityType: 'tours', oldData: previous, newData: record, req });

  return sendSuccess(res, 'Record updated successfully.', record);
});

export const deleteTour = asyncHandler(async (req, res) => {
  return softDeleteRecord(res, 'tours', req.params.id, req);
});

// Bulk delete for the admin list's select-all action. Capped so a runaway or
// malicious request cannot soft-delete the whole catalogue in one call.
const BULK_DELETE_LIMIT = 200;

export const bulkDeleteTours = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]).map(String) : [];
  const unique = [...new Set(ids.filter(Boolean))];

  if (!unique.length) throw new AppError('Provide at least one tour id.', 400);
  if (unique.length > BULK_DELETE_LIMIT) {
    throw new AppError(`Cannot delete more than ${BULK_DELETE_LIMIT} tours at once.`, 400);
  }

  return bulkSoftDeleteRecords(res, 'tours', unique, req);
});
