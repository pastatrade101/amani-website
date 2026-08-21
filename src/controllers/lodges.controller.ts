import { supabase } from '../config/supabase';
import { amenitiesForLodge, attachCovers, imagesForLodge, toursFeaturingLodge } from './lodge-media.controller';
import { publicDetailsForLodge } from './lodge-details.controller';
import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import {
  bulkSoftDeleteRecords,
  bulkUpdateRecords,
  createRecord,
  listRecords,
  softDeleteRecord,
  updateRecord
} from '../utils/supabase-helpers';
import { attachAvailableLocales, localeOf, localizeRecords } from '../utils/translations';

// Explicit FK hint is required now that lodge_destinations provides a second
// relationship path between these tables. Without it PostgREST returns an
// ambiguous-relationship error and every lodge list request fails.
const select = '*, destinations!lodges_destination_id_fkey(name,slug)';

export const listLodges = asyncHandler(async (req, res) => {
  return listRecords(req, res, {
    table: 'lodges',
    select,
    searchColumns: ['name', 'description', 'why_we_recommend'],
    statusColumn: 'status',
    defaultStatus: 'published',
    filters: ['destination_id', 'accommodation_level', 'lodge_type', 'is_featured', 'show_property_publicly'],
    // Most properties keep their photography only in lodge_images and have no
    // image_url at all, so cards need the gallery cover to fall back to.
    // Covers first, then the locale merge — translations must win over the
    // source text, and covers are images, which are never translated.
    afterFetch: async (items) => {
      await attachCovers(items);
      await localizeRecords('lodges', items, localeOf(req.query.locale));
    }
  });
});

/**
 * One property, with everything the public page renders.
 *
 * Gallery, amenities and the tours that actually stay here are attached in a
 * single response so the page makes one call, and each is fail-soft so the
 * page still renders before the accommodation migration has been applied.
 */
export const getLodge = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('lodges')
    .select(select)
    .eq('slug', req.params.slug)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new AppError('Unable to fetch the property.', 500, [error]);
  if (!data) throw new AppError('Record not found.', 404);
  if ((data as Record<string, unknown>).show_property_publicly === false) throw new AppError('Record not found.', 404);

  const lodge = data as Record<string, unknown>;
  await attachAvailableLocales('lodges', [lodge]);
  await localizeRecords('lodges', [lodge], localeOf(req.query.locale));
  const id = String(lodge.id);
  const [images, amenities, featuredIn, details] = await Promise.all([
    imagesForLodge(id),
    amenitiesForLodge(id),
    toursFeaturingLodge(id),
    publicDetailsForLodge(id)
  ]);

  return sendSuccess(res, 'Record fetched successfully.', {
    ...lodge,
    images,
    amenities,
    featured_in_tours: featuredIn,
    ...details
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
