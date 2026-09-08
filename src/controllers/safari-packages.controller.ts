import { asyncHandler } from '../utils/async-handler';
import {
  createRecord,
  getRecordBySlug,
  listRecords,
  softDeleteRecord,
  updateRecord
} from '../utils/supabase-helpers';

/**
 * Safari packages — the landing-page collection.
 *
 * A row is one page; `sections` holds its ordered content blocks. The public
 * detail route reads a page by slug and renders those blocks; the sitemap reads
 * the list and keeps only rows that are both published and indexable.
 */

/**
 * The linked tour, so the itinerary block can render that tour's real days.
 *
 * The foreign keys are named explicitly. Both `itinerary_days -> lodges` and
 * `lodges -> destinations` can be reached more than one way — a lodge also
 * joins destinations through `lodge_destinations` — and PostgREST refuses an
 * ambiguous embed with PGRST201 rather than guessing. Same hints the tours
 * controller uses, so both routes resolve the identical shape.
 */
const tourEmbed =
  'tours(id,slug,title,duration_days,price_from,currency,main_image_url,' +
  'itinerary_days(id,day_number,title,description,accommodation,accommodation_id,meals,activities,image_url,' +
  'lodge:lodges!itinerary_days_accommodation_id_fkey(id,name,slug,lodge_type,accommodation_level,hero_image_url,image_url,' +
  'destinations!lodges_destination_id_fkey(name),' +
  'lodge_images(id,image_url,alt_text,caption,sort_order,is_cover))))';

const detailSelect = `*, ${tourEmbed}`;

export const listSafariPackages = asyncHandler(async (req, res) => {
  return listRecords(req, res, {
    table: 'safari_packages',
    searchColumns: ['name', 'hero_title', 'hero_subtitle', 'meta_description'],
    statusColumn: 'status',
    defaultStatus: 'published',
    filters: ['tour_id', 'category_id', 'is_featured', 'indexable'],
    orderBy: 'sort_order',
    ascending: true
  });
});

export const getSafariPackage = asyncHandler(async (req, res) => {
  // The detail select carries the linked tour and its days. The list above
  // deliberately does not — and nothing may build an edit form from it.
  return getRecordBySlug(res, 'safari_packages', req.params.slug, detailSelect);
});

export const createSafariPackage = asyncHandler(async (req, res) => {
  return createRecord(req, res, 'safari_packages', req.body, { slugSource: 'name', userFields: true });
});

export const updateSafariPackage = asyncHandler(async (req, res) => {
  return updateRecord(req, res, 'safari_packages', req.params.id, req.body, { slugSource: 'name', userFields: true });
});

export const deleteSafariPackage = asyncHandler(async (req, res) => {
  return softDeleteRecord(res, 'safari_packages', req.params.id, req);
});
