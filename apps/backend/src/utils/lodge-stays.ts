import { EAST_AFRICA_COUNTRIES } from '../schemas/lodges.schema';
import { cleanSearch } from './query';
import { isSafariStyle, summariseToursUsingLodge, type LegacyLodgeDayRow, type LodgeStayRow, type SafariStyle, type TourUsingLodge } from './tour-content';
import { pricingSummary, type SeasonForSummary } from './tour-pricing';

/**
 * Stays are the public face of the lodges table. These are the pure rules the
 * lodge list and detail endpoints share; the reads that feed them live in
 * services/lodge-stays.service.ts. Nothing here touches the database.
 */

type Row = Record<string, unknown>;

// ── Levels and styles ────────────────────────────────────────────────────────

export const LODGE_LEVELS = ['BUDGET', 'MID_RANGE', 'LUXURY', 'PREMIUM_LUXURY'] as const;
export type LodgeLevel = (typeof LODGE_LEVELS)[number];

// Mirrors LODGE_LEVELS in apps/frontend/src/lib/lodge-levels.ts: top-end
// properties count as Luxury, so a luxury itinerary can use either kind.
const STYLE_OF_LEVEL: Record<LodgeLevel, SafariStyle> = {
  BUDGET: 'budget',
  MID_RANGE: 'midrange',
  LUXURY: 'luxury',
  PREMIUM_LUXURY: 'luxury'
};

const isLodgeLevel = (value: string): value is LodgeLevel => (LODGE_LEVELS as readonly string[]).includes(value);

/** The safari style a lodge serves. Unknown or missing levels count as midrange, like the frontend. */
export const styleForLodgeLevel = (level: unknown): SafariStyle => {
  const value = String(level ?? '').trim().toUpperCase();
  return isLodgeLevel(value) ? STYLE_OF_LEVEL[value] : 'midrange';
};

/** Lodge levels that fit a safari style, e.g. luxury → LUXURY and PREMIUM_LUXURY. */
export const lodgeLevelsForStyle = (style: SafariStyle): LodgeLevel[] =>
  LODGE_LEVELS.filter((level) => STYLE_OF_LEVEL[level] === style);

// ── List filters ─────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StayDestinationFilter = { kind: 'any' } | { kind: 'none' } | { kind: 'id'; id: string };

export type StayListFilters = {
  /** Levels to match; null leaves the level alone. */
  levels: LodgeLevel[] | null;
  /** The country as the lodge editor stores it, or null for any country. */
  country: string | null;
  destination: StayDestinationFilter;
  /**
   * A value no stay can match (an unknown style, a country outside East
   * Africa, a destination id that is not an id). The list answers empty
   * rather than ignoring the filter, which would show stays that do not fit.
   */
  matchesNothing: boolean;
};

const unset = (value: string) => !value || value === 'all';

type StayFilterQuery = {
  style?: string;
  country?: string;
  destination_id?: string;
  is_featured?: string;
  show_property_publicly?: string;
};

/** ?style, ?country and ?destination_id, read the way the list applies them. */
export const parseStayFilters = (query: StayFilterQuery): StayListFilters => {
  const filters: StayListFilters = { levels: null, country: null, destination: { kind: 'any' }, matchesNothing: false };

  // A flag Postgres cannot read as a boolean (?is_featured=maybe) would fail
  // the whole query with a 500; like an unknown style, it matches nothing.
  for (const flag of [query.is_featured, query.show_property_publicly]) {
    const value = (flag ?? '').trim().toLowerCase();
    if (!unset(value) && !['true', 'false', 'null'].includes(value)) filters.matchesNothing = true;
  }

  const style = (query.style ?? '').trim().toLowerCase();
  if (!unset(style)) {
    if (isSafariStyle(style)) filters.levels = lodgeLevelsForStyle(style);
    else filters.matchesNothing = true;
  }

  // Countries are an enum of the East African countries (schemas/lodges.schema),
  // matched without regard to case so ?country=kenya works.
  const country = (query.country ?? '').trim();
  if (!unset(country)) {
    const known = EAST_AFRICA_COUNTRIES.find((name) => name.toLowerCase() === country.toLowerCase());
    if (known) filters.country = known;
    else filters.matchesNothing = true;
  }

  const destination = (query.destination_id ?? '').trim();
  if (destination === 'null') filters.destination = { kind: 'none' };
  else if (!unset(destination)) {
    // Checked here because the id is written into a PostgREST or() filter.
    if (UUID.test(destination)) filters.destination = { kind: 'id', id: destination.toLowerCase() };
    else filters.matchesNothing = true;
  }

  return filters;
};

/**
 * Search text safe to put inside a PostgREST or() filter: commas and % are
 * already stripped by cleanSearch; parentheses and quotes would end the group.
 */
export const staySearchTerm = (value: string): string => cleanSearch(value).replace(/[()"\\]/g, ' ').replace(/\s+/g, ' ').trim();

// ── Visibility ───────────────────────────────────────────────────────────────

/** Published and not hidden from the website — what a visitor may see. */
export const isPublicStay = (lodge: Row | null | undefined): boolean =>
  Boolean(lodge) && lodge!.status === 'published' && lodge!.show_property_publicly !== false && !lodge!.deleted_at;

/**
 * A visitor sees a nightly price only when the property shows its rates. The
 * editor turns rates off for contract prices it may not advertise, and the
 * "from" price is one of them.
 */
export const withoutPrivateRates = <T extends Row>(lodge: T): T => {
  if (lodge.show_rates_publicly !== true) (lodge as Row).price_per_night_from = null;
  return lodge;
};

type DestinationRef = { id: unknown; name: unknown; slug: unknown; region: unknown; country: unknown };

/**
 * The lodge's destination for linking. A visitor never gets a destination
 * whose page is not published — the link would only 404.
 */
export const stayDestination = (embed: unknown, { staff }: { staff: boolean }): DestinationRef | null => {
  if (!embed || typeof embed !== 'object') return null;
  const destination = embed as Row;
  if (!destination.slug || (!staff && destination.status !== undefined && destination.status !== 'published')) return null;
  return {
    id: destination.id ?? null,
    name: destination.name ?? null,
    slug: destination.slug,
    region: destination.region ?? null,
    country: destination.country ?? null
  };
};

// ── Tours that sleep at a lodge ──────────────────────────────────────────────

export type LodgeStayLink = LodgeStayRow & { lodge_id?: unknown };
export type LegacyLodgeDayLink = LegacyLodgeDayRow & { accommodation_id?: unknown };

const groupBy = <T>(rows: readonly T[], key: (row: T) => unknown): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    if (!id) continue;
    const list = groups.get(String(id)) ?? [];
    list.push(row);
    groups.set(String(id), list);
  }
  return groups;
};

/**
 * summariseToursUsingLodge for many lodges at once, from one batched read of
 * the per-style stays and one of the legacy accommodation_id days.
 * `publishedOnly` keeps drafts off public pages and out of tour_count.
 */
export const toursUsingEachLodge = (
  stayRows: readonly LodgeStayLink[],
  legacyRows: readonly LegacyLodgeDayLink[],
  { publishedOnly }: { publishedOnly: boolean }
): Map<string, TourUsingLodge[]> => {
  const stays = groupBy(stayRows, (row) => row.lodge_id);
  const legacy = groupBy(legacyRows, (row) => row.accommodation_id);
  const result = new Map<string, TourUsingLodge[]>();
  for (const id of new Set([...stays.keys(), ...legacy.keys()])) {
    const tours = summariseToursUsingLodge(stays.get(id) ?? [], legacy.get(id) ?? []);
    const kept = publishedOnly ? tours.filter((tour) => tour.status === 'published') : tours;
    if (kept.length) result.set(id, kept);
  }
  return result;
};

const bySortOrder = (a: Row, b: Row) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0);

/**
 * One featured_in_tours card: the tour-card fields the tours list returns,
 * plus the styles and days in which this lodge is the tour's overnight.
 */
export const featuredTourCard = (tour: Row, usage: Pick<TourUsingLodge, 'styles' | 'days'>, today?: string): Row => ({
  id: tour.id,
  title: tour.title ?? null,
  slug: tour.slug ?? null,
  short_description: tour.short_description ?? null,
  duration_days: tour.duration_days ?? null,
  duration_nights: tour.duration_nights ?? null,
  price_from: tour.price_from ?? null,
  currency: tour.currency ?? null,
  main_image_url: tour.main_image_url ?? null,
  main_image_url_thumbnail: tour.main_image_url_thumbnail ?? null,
  // The responsive ladder attachThumbnails found, when there is one.
  ...(tour.main_image_url_variants ? { main_image_url_variants: tour.main_image_url_variants } : {}),
  banner_image_url: tour.banner_image_url ?? null,
  category_id: tour.category_id ?? null,
  tour_categories: tour.tour_categories && typeof tour.tour_categories === 'object' ? tour.tour_categories : null,
  // PostgREST does not order embedded rows.
  tour_destinations: Array.isArray(tour.tour_destinations) ? [...(tour.tour_destinations as Row[])].sort(bySortOrder) : [],
  // Null when the pricing tables are not there: unknown, not "no prices".
  pricing_summary: Array.isArray(tour.tour_pricing_seasons)
    ? pricingSummary(tour.tour_pricing_seasons as SeasonForSummary[], today)
    : null,
  styles: usage.styles,
  days: usage.days
});

/** Cards in the order of `usage`; a tour the card read did not return is left out. */
export const featuredTourCards = (usage: readonly TourUsingLodge[], tours: readonly Row[], today?: string): Row[] => {
  const byId = new Map(tours.map((tour) => [String(tour.id), tour]));
  return usage.flatMap((entry) => {
    const tour = byId.get(entry.id);
    return tour ? [featuredTourCard(tour, entry, today)] : [];
  });
};

const pickDefined = (row: Row, keys: readonly string[]): Row =>
  Object.fromEntries(keys.filter((key) => row[key] !== undefined && row[key] !== null).map((key) => [key, row[key]]));

/** A nearby_stays card: identity, level, style, images and destination only. */
export const nearbyStayCard = (lodge: Row): Row => ({
  id: lodge.id,
  name: lodge.name ?? null,
  slug: lodge.slug ?? null,
  lodge_type: lodge.lodge_type ?? null,
  accommodation_level: lodge.accommodation_level ?? null,
  style: styleForLodgeLevel(lodge.accommodation_level),
  hero_image_url: lodge.hero_image_url ?? null,
  image_url: lodge.image_url ?? null,
  // Cover fields, present only when found (thumbnails, responsive ladder, gallery cover).
  ...pickDefined(lodge, [
    'hero_image_url_thumbnail',
    'hero_image_url_variants',
    'image_url_thumbnail',
    'image_url_variants',
    'cover_image_url'
  ]),
  destinations: lodge.destinations && typeof lodge.destinations === 'object' ? lodge.destinations : null
});
