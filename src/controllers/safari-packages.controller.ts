import { supabase } from '../config/supabase';
import { AppError, sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';
import {
  attachThumbnails,
  createRecord,
  listRecords,
  softDeleteRecord,
  updateRecord
} from '../utils/supabase-helpers';
import { attachAvailableLocales, localeOf, localizeRecords } from '../utils/translations';

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
  const locale = localeOf(req.query.locale);
  return listRecords(req, res, {
    // The listing's cards carry the package name and hero copy.
    afterFetch: locale ? (items) => localizeRecords('safari_packages', items, locale) : undefined,
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
  const { data, error } = await supabase
    .from('safari_packages')
    .select(detailSelect)
    .eq('slug', req.params.slug)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new AppError('Unable to fetch safari_packages.', 500, [error]);
  if (!data) throw new AppError('Record not found.', 404);

  const record = data as unknown as Record<string, unknown>;
  await attachThumbnails('safari_packages', [record]);
  await attachAvailableLocales('safari_packages', [record]);

  // Without ?locale= this is the editor's read and stays exactly as stored.
  const locale = localeOf(req.query.locale);
  if (locale) {
    await localizeRecords('safari_packages', [record], locale);

    // The linked tour and its days are embedded rows, so translating the page
    // leaves them in the default language — an Italian page whose itinerary
    // block is English. Each carries its own translation; apply both.
    const tour = record.tours as Record<string, unknown> | null | undefined;
    if (tour && typeof tour === 'object') {
      await localizeRecords('tours', [tour], locale);
      const days = Array.isArray(tour.itinerary_days) ? (tour.itinerary_days as Array<Record<string, unknown>>) : [];
      if (days.length) await localizeRecords('itinerary_days', days, locale);
    }
  }

  return sendSuccess(res, 'Record fetched successfully.', record);
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
