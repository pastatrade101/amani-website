import { supabase } from '../config/supabase';
import {
  featuredTourCards,
  nearbyStayCard,
  toursUsingEachLodge,
  type LegacyLodgeDayLink,
  type LodgeStayLink
} from '../utils/lodge-stays';
import { attachThumbnails } from '../utils/supabase-helpers';
import type { TourUsingLodge } from '../utils/tour-content';
import { localizeRecords } from '../utils/translations';

/**
 * Reads behind the public Stays pages (GET /api/lodges and /api/lodges/:slug)
 * and the CMS's "tours using this property". Every read is batched per page of
 * lodges — never a query per lodge — and fail-soft, so a missing optional
 * table (before its migration runs) empties one section instead of the page.
 */

type Row = Record<string, unknown>;

const softly = async <T>(run: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await run();
  } catch {
    return fallback;
  }
};

// PostgREST caps a response at its max-rows (1000 on Supabase), and one page
// of 100 lodges can have more stays than that, so link reads are paged.
const LINK_PAGE = 1000;

type LinkPage = { data: unknown; error: unknown; count?: number | null };

/** Every row of a read, or null when the read failed (e.g. the table is missing). */
const allRows = async <T>(read: (from: number, to: number) => PromiseLike<LinkPage>): Promise<T[] | null> => {
  const rows: T[] = [];
  for (;;) {
    const { data, error, count } = await read(rows.length, rows.length + LINK_PAGE - 1);
    if (error) return null;
    const batch = (Array.isArray(data) ? data : []) as T[];
    rows.push(...batch);
    if (!batch.length) return rows;
    // The exact count decides; a short page only when the count is missing.
    if (count != null ? rows.length >= count : batch.length < LINK_PAGE) return rows;
  }
};

/**
 * Gallery cover per property as `cover_image_url`.
 *
 * Most properties imported from the photo set have no image_url or
 * hero_image_url — their photography lives entirely in lodge_images — so a
 * card reading only the legacy fields renders an empty tile. This gives the
 * listing something real to fall back to.
 */
export const attachCovers = async (rows: Row[]): Promise<void> => {
  const ids = rows.map((row) => String(row.id ?? '')).filter(Boolean);
  if (!ids.length) return;

  await softly(async () => {
    const { data, error } = await supabase
      .from('lodge_images')
      .select('lodge_id,image_url,is_cover,sort_order')
      .in('lodge_id', ids)
      .order('is_cover', { ascending: false })
      .order('sort_order', { ascending: true });
    if (error) return;

    // First row per lodge wins: covers sort first, then lowest sort_order.
    const cover = new Map<string, string>();
    for (const row of (data ?? []) as Array<{ lodge_id: string; image_url: string }>) {
      if (!cover.has(row.lodge_id)) cover.set(row.lodge_id, row.image_url);
    }
    for (const row of rows) {
      const url = cover.get(String(row.id));
      if (url) row.cover_image_url = url;
    }
  }, undefined);
};

const tourRefColumns = 'id,title,slug,status,deleted_at';
const dayStaysEmbed = 'stays:itinerary_day_stays!itinerary_day_stays_itinerary_day_id_fkey(safari_style)';

/**
 * Tours whose itinerary sleeps at each of these lodges, with styles and days.
 *
 * Built on real links only — a day's per-style stay, or the legacy
 * itinerary_days.accommodation_id on a day with no stays yet — never on "same
 * destination", which would claim a trip uses a lodge it may not.
 * `publishedOnly` also filters in the database, so drafts cost no rows.
 */
export const toursUsingLodges = async (
  lodgeIds: readonly string[],
  { publishedOnly }: { publishedOnly: boolean }
): Promise<Map<string, TourUsingLodge[]>> => {
  const ids = [...new Set(lodgeIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const inner = publishedOnly ? '!inner' : '';

  const stays = allRows<LodgeStayLink>((from, to) => {
    let query = supabase
      .from('itinerary_day_stays')
      .select(
        `lodge_id,safari_style,day:itinerary_days!itinerary_day_stays_itinerary_day_id_fkey${inner}(id,day_number,tour:tours${inner}(${tourRefColumns}))`,
        { count: 'exact' }
      )
      .in('lodge_id', ids);
    if (publishedOnly) query = query.eq('day.tour.status', 'published').is('day.tour.deleted_at', null);
    return query.order('itinerary_day_id').order('safari_style').range(from, to);
  });

  const legacyDays = (withStays: boolean) =>
    allRows<LegacyLodgeDayLink>((from, to) => {
      let query = supabase
        .from('itinerary_days')
        .select(`id,day_number,accommodation_id,tour:tours${inner}(${tourRefColumns})${withStays ? `,${dayStaysEmbed}` : ''}`, {
          count: 'exact'
        })
        .in('accommodation_id', ids);
      if (publishedOnly) query = query.eq('tour.status', 'published').is('tour.deleted_at', null);
      return query.order('id').range(from, to);
    });

  const [stayRows, withStays] = await Promise.all([stays, legacyDays(true)]);
  // Before the stays migration there is no stays embed: read the legacy links alone.
  const legacyRows = withStays ?? (await legacyDays(false));
  return toursUsingEachLodge(stayRows ?? [], legacyRows ?? [], { publishedOnly });
};

/**
 * `tour_count` on each lodge: published tours whose itinerary sleeps there.
 * Zero when the links cannot be read, so a missing table never fails the list.
 */
export const attachTourCounts = async (rows: Row[]): Promise<void> => {
  const usage = await softly(
    () => toursUsingLodges(rows.map((row) => String(row.id ?? '')), { publishedOnly: true }),
    new Map<string, TourUsingLodge[]>()
  );
  for (const row of rows) row.tour_count = usage.get(String(row.id))?.length ?? 0;
};

/**
 * Lodges linked to a destination through lodge_destinations (a property can
 * sit in more than its primary destination). Null when the table is missing.
 */
export const lodgeIdsInDestination = async (destinationId: string): Promise<string[] | null> =>
  softly(async () => {
    const { data, error } = await supabase.from('lodge_destinations').select('lodge_id').eq('destination_id', destinationId);
    if (error) return null;
    return [...new Set(((data ?? []) as Array<{ lodge_id: unknown }>).map((row) => String(row.lodge_id ?? '')).filter(Boolean))];
  }, null);

// The tour-card fields the tours list returns. Tried in order; each step drops
// an embed a not-yet-applied migration would add.
const cardColumns =
  'id,title,slug,short_description,duration_days,duration_nights,price_from,currency,main_image_url,banner_image_url,category_id,tour_categories(name,slug)';
const cardDestinationsEmbed =
  'tour_destinations(destination_id,sort_order,is_primary,destinations!tour_destinations_destination_id_fkey(id,name,slug))';
const cardPricingEmbed =
  'tour_pricing_seasons(safari_style,season_type,start_date,end_date,currency,pricing_basis,status,sort_order,group_prices:tour_group_prices(price,price_status))';
const cardSelects = [`${cardColumns},${cardDestinationsEmbed},${cardPricingEmbed}`, `${cardColumns},${cardDestinationsEmbed}`, cardColumns];

/** Published tours that sleep at this lodge, as tour cards with their styles and days. */
export const featuredToursForLodge = async (lodgeId: string, locale?: string): Promise<Row[]> =>
  softly(async () => {
    const usage = (await toursUsingLodges([lodgeId], { publishedOnly: true })).get(lodgeId) ?? [];
    if (!usage.length) return [];

    let tours: Row[] | null = null;
    for (const columns of cardSelects) {
      const { data, error } = await supabase
        .from('tours')
        .select(columns)
        .in('id', usage.map((tour) => tour.id))
        .eq('status', 'published')
        .is('deleted_at', null);
      if (!error) {
        tours = (data ?? []) as unknown as Row[];
        break;
      }
    }
    if (!tours?.length) return [];

    await attachThumbnails('tours', tours);
    await localizeRecords('tours', tours, locale);
    return featuredTourCards(usage, tours);
  }, []);

const NEARBY_LIMIT = 3;
const nearbyColumns =
  'id,name,slug,lodge_type,accommodation_level,hero_image_url,image_url,destinations!lodges_destination_id_fkey(name,slug)';

/** Up to three other public stays in the same destination, featured first. */
export const nearbyStays = async (lodge: Row, locale?: string): Promise<Row[]> => {
  const destinationId = lodge.destination_id ? String(lodge.destination_id) : '';
  if (!destinationId) return [];

  return softly(async () => {
    const { data, error } = await supabase
      .from('lodges')
      .select(nearbyColumns)
      .eq('destination_id', destinationId)
      .neq('id', String(lodge.id))
      .eq('status', 'published')
      .not('show_property_publicly', 'is', false)
      .is('deleted_at', null)
      .order('is_featured', { ascending: false })
      .order('name', { ascending: true })
      .limit(NEARBY_LIMIT);
    if (error) return [];

    const rows = (data ?? []) as unknown as Row[];
    await Promise.all([attachThumbnails('lodges', rows), attachCovers(rows)]);
    await localizeRecords('lodges', rows, locale);
    return rows.map(nearbyStayCard);
  }, []);
};
