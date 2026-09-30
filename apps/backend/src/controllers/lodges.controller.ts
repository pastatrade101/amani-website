import { supabase } from '../config/supabase';
import { amenitiesForLodge, imagesForLodge } from './lodge-media.controller';
import { publicDetailsForLodge } from './lodge-details.controller';
import {
  attachCovers,
  attachTourCounts,
  featuredToursForLodge,
  lodgeIdsInDestination,
  nearbyStays
} from '../services/lodge-stays.service';
import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import { parseStayFilters, stayDestination, staySearchTerm, styleForLodgeLevel, withoutPrivateRates } from '../utils/lodge-stays';
import { getPagination, getQueryString, paginationMeta } from '../utils/query';
import {
  attachThumbnails,
  bulkSoftDeleteRecords,
  bulkUpdateRecords,
  createRecord,
  softDeleteRecord,
  updateRecord
} from '../utils/supabase-helpers';
import { isStaffRequest } from '../utils/staff';
import { attachAvailableLocales, localeOf, localizeRecords } from '../utils/translations';

// Explicit FK hint is required now that lodge_destinations provides a second
// relationship path between these tables. Without it PostgREST returns an
// ambiguous-relationship error and every lodge list request fails.
const select = '*, destinations!lodges_destination_id_fkey(name,slug)';
// The detail page links the destination, so it needs its id and place names;
// status is read so a visitor is never linked to an unpublished page.
const detailSelect = '*, destinations!lodges_destination_id_fkey(id,name,slug,region,country,status)';

const searchColumns = ['name', 'short_description', 'description', 'why_we_recommend', 'region', 'park_area'];
// Exact-match filters, read like listRecords reads them ("null" means IS NULL).
const plainFilters = ['accommodation_level', 'lodge_type', 'is_featured', 'show_property_publicly'];

type Row = Record<string, unknown>;

/**
 * The lodge list: the CMS's property table and the public Stays page.
 *
 * A custom query rather than listRecords, because visitors get a different
 * order (featured first, then A–Z) and filters listRecords has no words for:
 * ?style (a safari style → its accommodation levels), ?country, and a
 * destination that also matches lodge_destinations. Staff keep the CMS
 * behaviour: newest first, and ?status chooses drafts.
 */
export const listLodges = asyncHandler(async (req, res) => {
  const { page, limit, from, to } = getPagination(req.query);
  const staff = isStaffRequest(req);
  const filters = parseStayFilters({
    style: getQueryString(req.query, 'style'),
    country: getQueryString(req.query, 'country'),
    destination_id: getQueryString(req.query, 'destination_id'),
    is_featured: getQueryString(req.query, 'is_featured'),
    show_property_publicly: getQueryString(req.query, 'show_property_publicly')
  });
  if (filters.matchesNothing) {
    return sendSuccess(res, 'Records fetched successfully.', { items: [], pagination: paginationMeta(page, limit, 0) });
  }

  const destination = filters.destination;
  const linkedIds = destination.kind === 'id' ? await lodgeIdsInDestination(destination.id) : null;

  let query = supabase.from('lodges').select(select, { count: 'exact' }).is('deleted_at', null);
  query = staff
    ? query.order('created_at', { ascending: false })
    : query.order('is_featured', { ascending: false }).order('name', { ascending: true }).order('id', { ascending: true });

  const search = staySearchTerm(getQueryString(req.query, 'search'));
  if (search) query = query.or(searchColumns.map((column) => `${column}.ilike.%${search}%`).join(','));

  // Only a verified CMS token may ask for drafts or hidden properties; a
  // visitor sending ?status=all still gets published, public ones.
  const status = staff ? getQueryString(req.query, 'status') : '';
  if (status && status !== 'all') query = query.eq('status', status);
  else if (!status) query = query.eq('status', 'published');
  if (!staff) query = query.not('show_property_publicly', 'is', false);

  for (const filter of plainFilters) {
    const value = getQueryString(req.query, filter);
    if (!value || value === 'all') continue;
    query = value === 'null' ? query.is(filter, null) : query.eq(filter, value);
  }
  if (filters.levels) query = query.in('accommodation_level', filters.levels);
  // ilike without wildcards is a case-insensitive equals, so rows saved before
  // the country list existed ("tanzania") still match.
  if (filters.country) query = query.ilike('country', filters.country);
  if (destination.kind === 'none') query = query.is('destination_id', null);
  if (destination.kind === 'id') {
    query = linkedIds?.length
      ? query.or(`destination_id.eq.${destination.id},id.in.(${linkedIds.join(',')})`)
      : query.eq('destination_id', destination.id);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw new AppError('Unable to fetch lodges.', 500, [error]);

  const items = (data ?? []) as unknown as Row[];
  // Most properties keep their photography only in lodge_images and have no
  // image_url at all, so cards need the gallery cover to fall back to. The
  // three reads write different fields, so they run side by side.
  await Promise.all([attachThumbnails('lodges', items), attachCovers(items), attachTourCounts(items)]);
  // Covers first, then the locale merge — translations must win over the
  // source text, and covers are images, which are never translated.
  await localizeRecords('lodges', items, localeOf(req.query.locale));
  for (const item of items) {
    item.style = styleForLodgeLevel(item.accommodation_level);
    if (!staff) withoutPrivateRates(item);
  }

  return sendSuccess(res, 'Records fetched successfully.', {
    items,
    pagination: paginationMeta(page, limit, count ?? 0)
  });
});

/**
 * One property, with everything the public Stays page renders.
 *
 * Gallery, amenities, the tours that actually sleep here and nearby stays are
 * attached in a single response so the page makes one call, and each is
 * fail-soft so the page still renders before the accommodation migration has
 * been applied.
 */
export const getLodge = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('lodges')
    .select(detailSelect)
    .eq('slug', req.params.slug)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new AppError('Unable to fetch the property.', 500, [error]);
  if (!data) throw new AppError('Record not found.', 404);
  const lodge = data as unknown as Row;
  if (lodge.show_property_publicly === false) throw new AppError('Record not found.', 404);
  // Drafts and hidden properties only open in the CMS.
  const staff = isStaffRequest(req);
  if (!staff && lodge.status !== 'published') throw new AppError('Record not found.', 404);

  const locale = localeOf(req.query.locale);
  const id = String(lodge.id);
  // The sections need only the id and destination, so they load alongside the
  // lodge's own thumbnails and translation rather than after them: the stay
  // page gives this call three seconds, and each round trip counts.
  const [images, amenities, featuredIn, details, nearby] = await Promise.all([
    imagesForLodge(id),
    amenitiesForLodge(id),
    featuredToursForLodge(id, locale),
    publicDetailsForLodge(id),
    nearbyStays(lodge, locale),
    (async () => {
      await attachThumbnails('lodges', [lodge]);
      await attachAvailableLocales('lodges', [lodge]);
      await localizeRecords('lodges', [lodge], locale);
    })()
  ]);
  if (!staff) withoutPrivateRates(lodge);

  return sendSuccess(res, 'Record fetched successfully.', {
    ...lodge,
    style: styleForLodgeLevel(lodge.accommodation_level),
    destination: stayDestination(lodge.destinations, { staff }),
    images,
    amenities,
    featured_in_tours: featuredIn,
    ...details,
    // Seasonal rates are contract prices; they leave the API only when the
    // property is set to show its rates.
    rates: lodge.show_rates_publicly === true ? details.rates : [],
    nearby_stays: nearby
  });
});

export const createLodge = asyncHandler(async (req, res) => {
  return createRecord(req, res, 'lodges', req.body, { slugSource: 'name', userFields: true });
});

export const updateLodge = asyncHandler(async (req, res) => {
  return updateRecord(req, res, 'lodges', req.params.id, req.body, { slugSource: 'name', userFields: true });
});

export const deleteLodge = asyncHandler(async (req, res) => {
  return softDeleteRecord(res, 'lodges', req.params.id, req);
});

// Bulk actions for the admin list. Capped so one request cannot rewrite the
// whole table, and the status value is checked against the publish_status enum
// rather than trusted from the client.
const BULK_LIMIT = 200;
const STATUSES = ['draft', 'published', 'hidden', 'archived'] as const;

const idsFrom = (body: unknown): string[] => {
  const raw = Array.isArray((body as { ids?: unknown[] })?.ids) ? (body as { ids: unknown[] }).ids : [];
  const unique = [...new Set(raw.map(String).filter(Boolean))];
  if (!unique.length) throw new AppError('Provide at least one lodge id.', 400);
  if (unique.length > BULK_LIMIT) throw new AppError(`Cannot process more than ${BULK_LIMIT} lodges at once.`, 400);
  return unique;
};

export const bulkDeleteLodges = asyncHandler(async (req, res) => {
  return bulkSoftDeleteRecords(res, 'lodges', idsFrom(req.body), req);
});

export const bulkUpdateLodgeStatus = asyncHandler(async (req, res) => {
  const status = String((req.body as { status?: unknown })?.status ?? '');
  if (!(STATUSES as readonly string[]).includes(status)) {
    throw new AppError(`Status must be one of: ${STATUSES.join(', ')}.`, 400);
  }
  return bulkUpdateRecords(res, 'lodges', idsFrom(req.body), { status }, req);
});
