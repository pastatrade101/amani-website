import { supabase } from '../config/supabase';
import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import { getQueryString } from '../utils/query';
import { createRecord, getRecordById, listRecords, softDeleteRecord, updateRecord } from '../utils/supabase-helpers';

type ReviewTour = {
  id: string;
  title: string;
  slug: string;
  main_image_url: string | null;
  banner_image_url: string | null;
};

/**
 * Reviews originally used a PostgREST `tours(...)` embed. The legacy reviews
 * table intentionally stores a loose `tour_id` (there is no foreign key), so
 * PostgREST cannot resolve that relationship and rejects the whole request.
 *
 * Fetch the reviews first, then enrich them with the same optional `tours`
 * object. Enrichment is best-effort: a missing/deleted tour must never make the
 * Reviews CMS or public review widgets unavailable.
 */
const attachReviewTours = async (items: Array<Record<string, unknown>>) => {
  const tourIds = [
    ...new Set(
      items
        .map((item) => item.tour_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  ];

  if (!tourIds.length) return;

  const { data, error } = await supabase
    .from('tours')
    .select('id,title,slug,main_image_url,banner_image_url')
    .in('id', tourIds);

  if (error || !data) return;

  const toursById = new Map((data as ReviewTour[]).map((tour) => [tour.id, tour]));
  for (const item of items) {
    const tourId = typeof item.tour_id === 'string' ? item.tour_id : '';
    const tour = toursById.get(tourId) ?? null;
    item.tours = tour;
    if (!item.tour_title && tour?.title) item.tour_title = tour.title;
  }
};

export const listReviews = asyncHandler(async (req, res) => {
  return listRecords(req, res, {
    table: 'reviews',
    select: '*',
    searchColumns: ['author_name', 'message', 'tour_title'],
    statusColumn: 'status',
    defaultStatus: 'approved',
    filters: ['tour_id', 'platform', 'rating', 'is_featured'],
    orderBy: 'sort_order',
    ascending: true,
    afterFetch: attachReviewTours
  });
});

export const getReview = asyncHandler(async (req, res) => {
  return getRecordById(res, 'reviews', req.params.id, '*');
});

export const createReview = asyncHandler(async (req, res) => {
  return createRecord(req, res, 'reviews', req.body);
});

export const updateReview = asyncHandler(async (req, res) => {
  return updateRecord(req, res, 'reviews', req.params.id, req.body);
});

export const deleteReview = asyncHandler(async (req, res) => {
  return softDeleteRecord(res, 'reviews', req.params.id, req);
});

// Aggregate of approved, non-deleted reviews for AggregateRating JSON-LD.
export const reviewSummary = asyncHandler(async (req, res) => {
  const tourId = getQueryString(req.query, 'tour_id');

  let query = supabase.from('reviews').select('platform, rating').eq('status', 'approved').is('deleted_at', null);
  if (tourId) query = query.eq('tour_id', tourId);

  const { data, error } = await query;
  if (error) throw new AppError('Unable to fetch review summary.', 500, [error]);

  const rows = (data ?? []) as Array<{ platform: string; rating: number }>;
  const round1 = (value: number) => Math.round(value * 10) / 10;

  const count = rows.length;
  const average = count ? round1(rows.reduce((sum, row) => sum + Number(row.rating ?? 0), 0) / count) : 0;

  const groups = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    const group = groups.get(row.platform) ?? { total: 0, count: 0 };
    group.total += Number(row.rating ?? 0);
    group.count += 1;
    groups.set(row.platform, group);
  }

  const by_platform = [...groups.entries()].map(([platform, group]) => ({
    platform,
    count: group.count,
    average: round1(group.total / group.count)
  }));

  return sendSuccess(res, 'Review summary fetched successfully.', { count, average, by_platform });
});
