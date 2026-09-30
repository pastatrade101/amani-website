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
import { attachAvailableLocales, localeOf, localizeRecords } from '../utils/translations';
import { cleanSearch, getPagination, getQueryString, paginationMeta } from '../utils/query';
import { sanitizeRichFields } from '../utils/rich-text';
import { isStaffRequest } from '../utils/staff';
import { normaliseTourDetail } from '../utils/tour-content';
import { pricingSummary, type SeasonForSummary } from '../utils/tour-pricing';
import { applyTourContent } from '../services/tour-content.service';
import type { TourContentInput } from '../schemas/tours.schema';

const primaryDestinationEmbed = 'destinations!tours_destination_id_fkey(name,slug,country)';
const specialistEmbed = 'specialist:specialists!tours_specialist_id_fkey(id,name,role,photo_url,blurb,whatsapp_number,tripadvisor_url,status,is_featured,sort_order)';
const legacySelect = `*, ${primaryDestinationEmbed}, tour_categories(name,slug), ${specialistEmbed}`;
const fallbackSelect = `*, ${primaryDestinationEmbed}, tour_categories(name,slug)`;
const destinationEmbed = 'tour_destinations(destination_id,sort_order,is_primary,destinations!tour_destinations_destination_id_fkey(id,name,slug,country))';
const select = `${legacySelect}, ${destinationEmbed}`;
// Lean projection for listings: everything the cards use, minus the detail-only
// heavy fields (full_description, sample_itinerary). getTour still uses the full
// select + embeds below.
const legacyListSelect =
  `id, title, slug, short_description, destination_id, specialist_id, category_id, experience_type, persona_tags, duration_days, duration_nights, budget_tier, price_from, currency, main_image_url, banner_image_url, highlights, difficulty_level, group_size, group_size_min, group_size_max, minimum_age, start_location, end_location, is_available, seats_remaining, status, is_featured, is_popular, seo_title, meta_title, meta_description, og_image_url, created_at, updated_at, ${primaryDestinationEmbed}, tour_categories(name,slug), ${specialistEmbed}`;
const fallbackListSelect =
  `id, title, slug, short_description, destination_id, category_id, experience_type, persona_tags, duration_days, duration_nights, budget_tier, price_from, currency, main_image_url, banner_image_url, highlights, difficulty_level, group_size, group_size_min, group_size_max, minimum_age, start_location, end_location, is_available, seats_remaining, status, is_featured, is_popular, seo_title, meta_title, meta_description, og_image_url, created_at, updated_at, ${primaryDestinationEmbed}, tour_categories(name,slug)`;
const listSelect = `${legacyListSelect}, ${destinationEmbed}`;
// Cards show the safari styles, a "from" price and the number of days. The
// seasons are only read to compute pricing_summary and are stripped before the
// response, so the list payload stays light.
const listPricingEmbed =
  'tour_pricing_seasons(safari_style,season_type,start_date,end_date,currency,pricing_basis,status,sort_order,group_prices:tour_group_prices(price,price_status))';
const dayCountEmbed = 'itinerary_days(count)';
const listSelects = [
  `${listSelect}, ${dayCountEmbed}, ${listPricingEmbed}`,
  `${listSelect}, ${dayCountEmbed}`,
  `${fallbackListSelect}, ${dayCountEmbed}`,
  fallbackListSelect
];
// Compact relationship-free projection for admin lookup controls. Itinerary,
// pricing and departures editors only need a tour identity and duration; they
// should not fail because an optional destination/specialist embed is stale.
const summaryListSelect =
  'id, title, slug, destination_id, duration_days, duration_nights, status, created_at, updated_at';
// Detail view also embeds the assigned trip specialist, day-by-day itinerary,
// what's included/excluded, pricing options and the tour gallery images.
// Catalogue activities linked in the CMS (tour_activities); drafts are dropped
// for public readers in normaliseTourDetail.
const activitiesEmbed = 'tour_activities(sort_order,activity:activities(id,name,slug,category,duration_label,price_from,currency,price_unit,badge,hero_image_url,image_url,status))';
const dayColumns = 'id,day_number,title,description,accommodation,accommodation_id,meals,activities,image_url';
const dayLodgeEmbed = (columns: string) =>
  `lodge:lodges!itinerary_days_accommodation_id_fkey(${columns},destinations!lodges_destination_id_fkey(name),lodge_images(id,image_url,alt_text,caption,sort_order,is_cover))`;
const dayLodgeColumns = 'id,name,slug,lodge_type,accommodation_level,hero_image_url,image_url';
const dayDestinationEmbed = 'destination:destinations!itinerary_days_destination_id_fkey(id,name,slug)';
// Hinted by constraint name: itinerary_day_stays is a second path between days
// and lodges, so an unhinted lodges embed would be ambiguous (PGRST201).
// status + show_property_publicly tell the tour page whether a stay page exists to link to.
const dayStaysEmbed = `stays:itinerary_day_stays!itinerary_day_stays_itinerary_day_id_fkey(safari_style,lodge_id,accommodation,lodge:lodges!itinerary_day_stays_lodge_id_fkey(${dayLodgeColumns},status,show_property_publicly))`;
const itineraryEmbeds = {
  stays: `itinerary_days(${dayColumns},summary,image_urls,destination_id,travel_mode,${dayDestinationEmbed},${dayLodgeEmbed(`${dayLodgeColumns},status,show_property_publicly`)},${dayStaysEmbed})`,
  // Before the itinerary stays migration.
  route: `itinerary_days(${dayColumns},destination_id,travel_mode,${dayDestinationEmbed},${dayLodgeEmbed(dayLodgeColumns)})`,
  // Before the route migration.
  legacy: `itinerary_days(${dayColumns},${dayLodgeEmbed(dayLodgeColumns)})`
};
const contentEmbeds = 'tour_inclusions(title,sort_order), tour_exclusions(title,sort_order), tour_price_options(id,tour_id,title,label,price,currency,price_type,description,sort_order,created_at,updated_at), tour_images(id,tour_id,image_url,alt_text,caption,sort_order,is_featured,created_at,updated_at)';
const seasonsEmbed = 'tour_pricing_seasons(id,safari_style,season_type,season_name,start_date,end_date,currency,pricing_basis,status,sort_order,group_prices:tour_group_prices(id,minimum_travelers,maximum_travelers,room_count,price,price_status,sort_order))';
// Tried in order; each step drops what a not-yet-applied migration would add,
// so the page keeps rendering between deploying code and running its SQL.
const detailSelects = [
  `${select}, ${itineraryEmbeds.stays}, ${contentEmbeds}, ${seasonsEmbed}, ${activitiesEmbed}`,
  `${select}, ${itineraryEmbeds.route}, ${contentEmbeds}, ${seasonsEmbed}, ${activitiesEmbed}`,
  `${select}, ${itineraryEmbeds.legacy}, ${contentEmbeds}, ${seasonsEmbed}, ${activitiesEmbed}`,
  `${select}, ${itineraryEmbeds.legacy}, ${contentEmbeds}, ${activitiesEmbed}`,
  `${fallbackSelect}, itinerary_days(${dayColumns}), ${contentEmbeds}`
];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const relationErrorText = (error: unknown) =>
  [
    typeof error === 'string' ? error : '',
    error instanceof Error ? error.message : '',
    JSON.stringify(error ?? '')
  ]
    .join(' ')
    .toLowerCase();

const isOptionalTourRelationError = (error: unknown) => {
  const text = relationErrorText(error);
  return (
    text.includes('tour_destinations') ||
    text.includes('specialist_id') ||
    text.includes('specialists') ||
    text.includes('itinerary_days') ||
    text.includes('itinerary_day_stays') ||
    text.includes('accommodation_id') ||
    text.includes('lodges') ||
    text.includes('tour_pricing_seasons') ||
    text.includes('tour_group_prices') ||
    text.includes('schema cache') ||
    text.includes('relationship') ||
    text.includes('pgrst200') ||
    text.includes('pgrst205') ||
    text.includes('42p01') ||
    text.includes('42703')
  );
};

const isTourDestinationsRelationError = isOptionalTourRelationError;

type Row = Record<string, unknown>;
type QueryResult = { data: unknown; error: unknown; count?: number | null };

/**
 * Run a read with the first projection the database can answer. Only a
 * missing optional table, column or relationship moves on to the next one;
 * any other error is thrown as it is.
 */
const firstAnswer = async <T extends QueryResult>(selects: string[], run: (columns: string) => PromiseLike<T>): Promise<T> => {
  let result = await run(selects[0]);
  for (const columns of selects.slice(1)) {
    if (!result.error || !isOptionalTourRelationError(result.error)) break;
    result = await run(columns);
  }
  return result;
};

const normalizeDestinationIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.map(String).map((id) => id.trim()).filter(Boolean))]
    : [];

const attachTourDetailImages = async (record: Record<string, unknown>) => {
  await attachThumbnails('tours', [record]);

  const tourImages = Array.isArray(record.tour_images)
    ? (record.tour_images as Array<Record<string, unknown>>)
    : [];
  await attachThumbnails('tour_images', tourImages);

  const itineraryDays = Array.isArray(record.itinerary_days)
    ? (record.itinerary_days as Array<Record<string, unknown>>)
    : [];
  await attachThumbnails('itinerary_days', itineraryDays);

  const linkedLodges = itineraryDays
    .flatMap((day) => [day.lodge, ...(Array.isArray(day.stays) ? (day.stays as Row[]).map((stay) => stay.lodge) : [])])
    .filter((lodge): lodge is Record<string, unknown> => Boolean(lodge) && typeof lodge === 'object');
  await attachThumbnails('lodges', linkedLodges);

  const specialist = record.specialist;
  if (specialist && typeof specialist === 'object') {
    await attachThumbnails('specialists', [specialist as Record<string, unknown>]);
  }
};

const prepareTourPayload = (body: Record<string, unknown>) => {
  const rawPayload = { ...body };
  const hasDestinationIds = Object.prototype.hasOwnProperty.call(rawPayload, 'destination_ids');
  const hasDestinationId = Object.prototype.hasOwnProperty.call(rawPayload, 'destination_id');

  delete rawPayload.destination_ids;
  delete rawPayload.tour_destinations;
  delete rawPayload.specialist;

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

/** One tour with every embed, or null. Soft-deleted tours do not exist here. */
const loadTourDetail = async (column: 'id' | 'slug', key: string): Promise<Row | null> => {
  const { data, error } = await firstAnswer(detailSelects, (columns) =>
    supabase.from('tours').select(columns).eq(column, key).is('deleted_at', null).maybeSingle()
  );
  if (error) throw new AppError('Unable to fetch tours.', 500, [error]);
  return (data as unknown as Row | null) ?? null;
};

/**
 * The full tour as the admin editor reads it: any status, every linked
 * activity. Create, update and the content save answer with this.
 */
const fetchTourById = async (id: string) => {
  const record = uuidPattern.test(id) ? await loadTourDetail('id', id) : null;
  if (!record) throw new AppError('Record not found.', 404);
  normaliseTourDetail(record, { staff: true });
  await attachTourDetailImages(record);
  return record;
};

const bySortOrder = (a: Row, b: Row) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0);

/** Card fields computed from the list embeds, which are then dropped. */
const finishListItem = (item: Row, withPricing: boolean) => {
  if (Array.isArray(item.tour_destinations)) item.tour_destinations = [...(item.tour_destinations as Row[])].sort(bySortOrder);
  if (Array.isArray(item.itinerary_days)) {
    item.itinerary_day_count = Number((item.itinerary_days as Row[])[0]?.count ?? 0);
    delete item.itinerary_days;
  }
  if (withPricing) {
    // Null when the pricing tables are not there: unknown, not "no prices".
    item.pricing_summary = Array.isArray(item.tour_pricing_seasons)
      ? pricingSummary(item.tour_pricing_seasons as SeasonForSummary[])
      : null;
  }
  delete item.tour_pricing_seasons;
};

export const listTours = asyncHandler(async (req, res) => {
  const { page, limit, from, to } = getPagination(req.query);
  const search = cleanSearch(getQueryString(req.query, 'search'));
  // Only the CMS may ask for drafts; everyone else sees published tours
  // whatever ?status says.
  const status = isStaffRequest(req) ? getQueryString(req.query, 'status') : 'published';
  const destinationId = getQueryString(req.query, 'destination_id');
  const summaryOnly = getQueryString(req.query, 'view') === 'summary';

  // A filter value that can never match (a malformed id, "maybe" for a flag)
  // is an empty result, not a 500 from PostgREST — the same rule as lodges.
  const idFilterOk = (value: string) => !value || value === 'all' || value === 'null' || uuidPattern.test(value);
  const flagFilterOk = (value: string) => !value || ['all', 'null', 'true', 'false'].includes(value.toLowerCase());
  if (
    !idFilterOk(destinationId) ||
    !idFilterOk(getQueryString(req.query, 'category_id')) ||
    !['is_featured', 'is_popular', 'is_available'].every((flag) => flagFilterOk(getQueryString(req.query, flag)))
  ) {
    return sendSuccess(res, 'Records fetched successfully.', { items: [], pagination: paginationMeta(page, limit, 0) });
  }

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
      query = value === 'null' ? query.is(filter, null) : query.eq(filter, filter === 'category_id' ? value : value.toLowerCase());
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

  const { data, error, count } = await firstAnswer(
    summaryOnly ? [summaryListSelect, fallbackListSelect] : listSelects,
    buildListQuery
  );
  if (error) throw new AppError('Unable to fetch tours.', 500, [error]);

  const items = (data ?? []) as unknown as Array<Record<string, unknown>>;
  for (const item of items) finishListItem(item, !summaryOnly);
  await attachThumbnails('tours', items);
  // One batched merge for the whole page of tours — a locale never costs a
  // query per row.
  await localizeRecords('tours', items, localeOf(req.query.locale));
  const specialists = items
    .map((item) => item.specialist)
    .filter((specialist): specialist is Record<string, unknown> => Boolean(specialist) && typeof specialist === 'object');
  await attachThumbnails('specialists', specialists);

  return sendSuccess(res, 'Records fetched successfully.', {
    items,
    pagination: paginationMeta(page, limit, count ?? 0)
  });
});

export const getTour = asyncHandler(async (req, res) => {
  const key = req.params.slug;
  const staff = isStaffRequest(req);
  const record = await loadTourDetail(uuidPattern.test(key) ? 'id' : 'slug', key);
  // A draft or archived tour does not exist for the public, by slug or by id.
  if (!record || (!staff && record.status !== 'published')) throw new AppError('Record not found.', 404);

  normaliseTourDetail(record, { staff });
  const locale = localeOf(req.query.locale);

  // The days are embedded rows, so localizing the tour leaves them in the
  // source language — a German page with an English day-by-day plan, which is
  // the half-translated result that reads worse than no translation at all.
  const days = Array.isArray(record.itinerary_days) ? (record.itinerary_days as Array<Record<string, unknown>>) : [];
  // These touch different fields (image variants, locale list, translated
  // text), so they run side by side: the uncached page load sat close to the
  // website's API timeout when they ran one after another.
  await Promise.all([
    attachTourDetailImages(record),
    attachAvailableLocales('tours', [record]),
    localizeRecords('tours', [record], locale),
    days.length ? localizeRecords('itinerary_days', days, locale) : null
  ]);

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

/**
 * The tour editor's content in one save: itinerary days and their stays,
 * inclusions, exclusions, gallery and linked activities. Each key that is
 * present replaces that collection; the answer is the full admin record, so
 * the editor picks up the ids of anything it just created.
 */
export const saveTourContent = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const previous = await fetchTourById(id);

  await applyTourContent(id, req.body as TourContentInput, req.user?.sub);

  const record = await fetchTourById(id);
  await safeAudit({ action: 'update', entityId: id, entityType: 'tours', oldData: previous, newData: record, req });

  return sendSuccess(res, 'Tour content saved successfully.', record);
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
