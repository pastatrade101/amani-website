import { AppError } from './api-response';

/**
 * Pure planning for the tour editor's content save (PUT /api/tours/:id/content)
 * and the shape of the itinerary on the way out. Nothing here touches the
 * database, so every rule the save depends on is unit tested on its own.
 */

export const SAFARI_STYLES = ['budget', 'midrange', 'luxury'] as const;
export type SafariStyle = (typeof SAFARI_STYLES)[number];
export type TravelMode = 'DRIVE' | 'FLY' | 'BOAT';

type Row = Record<string, any>;

export const isSafariStyle = (value: unknown): value is SafariStyle =>
  typeof value === 'string' && (SAFARI_STYLES as readonly string[]).includes(value);

const styleRank = (style: unknown) => {
  const index = (SAFARI_STYLES as readonly unknown[]).indexOf(style);
  return index === -1 ? SAFARI_STYLES.length : index;
};

const has = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

/** Trimmed text, or null when there is nothing in it. */
const text = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const bySortOrder = (a: Row, b: Row) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0);

// ── Stays ────────────────────────────────────────────────────────────────────

export type StayInput = { safari_style: SafariStyle; lodge_id?: string | null; accommodation?: string | null };
export type Stay = { safari_style: SafariStyle; lodge_id: string | null; accommodation: string | null };

/** One stay per style in Budget → Luxury order; a stay naming nowhere is dropped. */
export const normaliseStays = (stays: readonly StayInput[] | null | undefined): Stay[] => {
  const byStyle = new Map<SafariStyle, Stay>();
  for (const stay of stays ?? []) {
    if (!isSafariStyle(stay?.safari_style) || byStyle.has(stay.safari_style)) continue;
    const lodgeId = text(stay.lodge_id);
    const accommodation = text(stay.accommodation);
    if (!lodgeId && !accommodation) continue;
    byStyle.set(stay.safari_style, { safari_style: stay.safari_style, lodge_id: lodgeId, accommodation });
  }
  return SAFARI_STYLES.flatMap((style) => byStyle.get(style) ?? []);
};

/**
 * The style older readers see through itinerary_days.accommodation_id /
 * accommodation: midrange (the style public pages open on), else the first.
 * With no stays at all, a legacy edit becomes the midrange stay.
 */
export const legacyStyleFor = (styles: readonly unknown[]): SafariStyle => {
  const known = styles.filter(isSafariStyle).sort((a, b) => styleRank(a) - styleRank(b));
  if (!known.length || known.includes('midrange')) return 'midrange';
  return known[0];
};

export const legacyStayFields = (stays: readonly Stay[]) => {
  const style = legacyStyleFor(stays.map((stay) => stay.safari_style));
  const stay = stays.find((item) => item.safari_style === style) ?? null;
  return { accommodation_id: stay?.lodge_id ?? null, accommodation: stay?.accommodation ?? null };
};

// ── Days ─────────────────────────────────────────────────────────────────────

export type DayInput = {
  id?: string;
  day_number: number;
  title: string;
  summary?: string | null;
  description?: string | null;
  destination_id?: string | null;
  travel_mode?: TravelMode | null;
  meals?: string | null;
  activities?: string | null;
  image_urls?: string[];
  stays?: StayInput[];
};

/** Every itinerary_days column the tour editor writes. */
export type DayRow = {
  tour_id: string;
  day_number: number;
  title: string;
  summary: string | null;
  description: string | null;
  destination_id: string | null;
  travel_mode: TravelMode | null;
  meals: string | null;
  activities: string | null;
  image_urls: string[];
  image_url: string | null;
  accommodation_id: string | null;
  accommodation: string | null;
};

export type ExistingDay = Partial<Omit<DayRow, 'day_number'>> & {
  id: string;
  day_number: number;
  stays?: Array<{ safari_style?: unknown }> | null;
};

export type DayPlan = {
  /** Days of this tour the payload no longer lists. */
  remove: string[];
  /**
   * Kept days whose number changes, first parked on numbers nobody uses, so
   * reordering never trips UNIQUE(tour_id, day_number) half-way through.
   */
  park: Array<{ id: string; tour_id: string; title: string; day_number: number }>;
  /** `stays` undefined means the payload left that day's stays alone. */
  keep: Array<{ id: string; row: DayRow; stays?: Stay[]; dropStyles: SafariStyle[] }>;
  add: Array<{ row: DayRow; stays: Stay[] }>;
};

/** Distinct, trimmed photo URLs in the order given. */
export const uniqueUrls = (urls: readonly unknown[] | null | undefined): string[] => [
  ...new Set((urls ?? []).map(text).filter((url): url is string => Boolean(url)))
];

/** A day's photos, reading the single legacy image when the list is empty. */
export const dayImages = (day: { image_urls?: unknown; image_url?: unknown }): string[] => {
  const urls = uniqueUrls(Array.isArray(day.image_urls) ? day.image_urls : []);
  if (urls.length) return urls;
  const single = text(day.image_url);
  return single ? [single] : [];
};

/**
 * Photo columns for a single-day write from the older itinerary form, keeping
 * image_url equal to the first of image_urls whichever of the two it sent.
 * `stored` is the day's current photo list, or null when the row has no
 * image_urls column yet (then only image_url is written).
 */
export const dayImageFields = (
  body: Record<string, unknown>,
  stored: readonly string[] | null
): { image_urls?: string[]; image_url?: string | null } => {
  if (Array.isArray(body.image_urls)) {
    const urls = uniqueUrls(body.image_urls);
    return { image_urls: urls, image_url: urls[0] ?? null };
  }
  if (!has(body, 'image_url')) return {};
  const lead = text(body.image_url);
  if (!stored) return { image_url: lead };
  // A new lead replaces the old one; clearing it moves the next photo up.
  const rest = stored.slice(1).filter((url) => url !== lead);
  const urls = lead ? [lead, ...rest] : rest;
  return { image_urls: urls, image_url: urls[0] ?? null };
};

/** Newline separated activities, without blank lines or stray spaces. */
const activityLines = (value: unknown): string | null =>
  text(
    typeof value === 'string'
      ? value
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .join('\n')
      : null
  );

/**
 * Turn the editor's day list into writes against what the tour holds now.
 *
 * A day in the payload replaces the stored day, but a field the payload leaves
 * out keeps its stored value (null clears it). Ids are preserved, because
 * translations are keyed by them.
 */
export const planDays = (
  tourId: string,
  existing: readonly ExistingDay[],
  input: readonly DayInput[],
  sanitizeDescription: (html: string) => string = (html) => html
): DayPlan => {
  const stored = new Map(existing.map((day) => [day.id, day]));
  const seenIds = new Set<string>();
  const seenNumbers = new Set<number>();

  for (const day of input) {
    if (seenNumbers.has(day.day_number)) throw new AppError(`Day ${day.day_number} appears more than once.`, 422);
    seenNumbers.add(day.day_number);
    if (!day.id) continue;
    if (!stored.has(day.id)) {
      throw new AppError(`Day ${day.day_number} is not part of this tour. Reload the tour and try again.`, 422);
    }
    if (seenIds.has(day.id)) throw new AppError(`Day ${day.day_number} is listed twice.`, 422);
    seenIds.add(day.id);
  }

  const highest = Math.max(0, ...existing.map((day) => day.day_number), ...input.map((day) => day.day_number));
  let parking = Math.max(1000, highest + 1);

  const plan: DayPlan = {
    remove: existing.filter((day) => !seenIds.has(day.id)).map((day) => day.id),
    park: [],
    keep: [],
    add: []
  };

  for (const day of input) {
    const base = day.id ? stored.get(day.id) : undefined;
    const pick = <T>(key: keyof DayInput, read: (value: unknown) => T, fallback: T): T =>
      has(day, key) ? read(day[key]) : base ? fallback : read(null);

    const images = has(day, 'image_urls') ? uniqueUrls(day.image_urls) : base ? dayImages(base) : [];
    const stays = has(day, 'stays') ? normaliseStays(day.stays) : undefined;
    const legacy = stays
      ? legacyStayFields(stays)
      : { accommodation_id: base?.accommodation_id ?? null, accommodation: base?.accommodation ?? null };

    const description = pick('description', text, base?.description ?? null);
    const row: DayRow = {
      tour_id: tourId,
      day_number: day.day_number,
      title: day.title.trim(),
      summary: pick('summary', text, base?.summary ?? null),
      description: description && has(day, 'description') ? sanitizeDescription(description) : description,
      destination_id: pick('destination_id', text, base?.destination_id ?? null),
      // The mode is how travellers reach a day's place from the day before;
      // the first day has no day before it.
      travel_mode:
        day.day_number === 1
          ? null
          : pick('travel_mode', (value) => (value === 'DRIVE' || value === 'FLY' || value === 'BOAT' ? value : null), base?.travel_mode ?? null),
      meals: pick('meals', text, base?.meals ?? null),
      activities: pick('activities', activityLines, base?.activities ?? null),
      image_urls: images,
      image_url: images[0] ?? null,
      ...legacy
    };

    if (!base || !day.id) {
      plan.add.push({ row, stays: stays ?? [] });
      continue;
    }

    if (base.day_number !== day.day_number) {
      plan.park.push({ id: day.id, tour_id: tourId, title: base.title ?? row.title, day_number: parking++ });
    }
    const storedStyles = (base.stays ?? []).map((stay) => stay?.safari_style).filter(isSafariStyle);
    plan.keep.push({
      id: day.id,
      row,
      stays,
      dropStyles: stays ? storedStyles.filter((style) => !stays.some((stay) => stay.safari_style === style)) : []
    });
  }

  return plan;
};

/** Every lodge and destination a day list points at, for one existence check each. */
export const referencedIds = (days: readonly DayInput[]) => ({
  lodgeIds: [...new Set(days.flatMap((day) => normaliseStays(day.stays).map((stay) => stay.lodge_id)).filter((id): id is string => Boolean(id)))],
  destinationIds: [...new Set(days.map((day) => text(day.destination_id)).filter((id): id is string => Boolean(id)))]
});

// ── Lists, images, activities ────────────────────────────────────────────────

/** Inclusion / exclusion rows in the order given. */
export const textListRows = (tourId: string, items: readonly string[]) =>
  items
    .map((item) => text(item))
    .filter((title): title is string => Boolean(title))
    .map((title, index) => ({ tour_id: tourId, title, sort_order: index }));

export type ImageInput = {
  id?: string;
  image_url: string;
  alt_text?: string | null;
  caption?: string | null;
  is_featured?: boolean;
};

export type ImagePlan = {
  keep: Array<{ id: string; tour_id: string; image_url: string; alt_text: string | null; caption: string | null; sort_order: number; is_featured: boolean }>;
  add: Array<{ tour_id: string; image_url: string; alt_text: string | null; caption: string | null; sort_order: number; is_featured: boolean }>;
  remove: string[];
};

export const planImages = (tourId: string, existingIds: readonly string[], images: readonly ImageInput[]): ImagePlan => {
  if (images.filter((image) => image.is_featured === true).length > 1) {
    throw new AppError('Only one gallery photo can be featured.', 422);
  }
  const stored = new Set(existingIds);
  const seen = new Set<string>();
  const plan: ImagePlan = { keep: [], add: [], remove: [] };

  images.forEach((image, index) => {
    const row = {
      tour_id: tourId,
      image_url: image.image_url.trim(),
      alt_text: text(image.alt_text),
      caption: text(image.caption),
      sort_order: index,
      is_featured: image.is_featured === true
    };
    if (!image.id) {
      plan.add.push(row);
      return;
    }
    if (!stored.has(image.id)) throw new AppError(`Gallery photo ${index + 1} is not part of this tour. Reload the tour and try again.`, 422);
    if (seen.has(image.id)) throw new AppError(`Gallery photo ${index + 1} is listed twice.`, 422);
    seen.add(image.id);
    plan.keep.push({ id: image.id, ...row });
  });

  plan.remove = existingIds.filter((id) => !seen.has(id));
  return plan;
};

/** Distinct ids in the order given (order becomes sort_order). */
export const uniqueIds = (ids: readonly string[]) => [...new Set(ids.map((id) => id.trim()).filter(Boolean))];

// ── Reading a tour back ──────────────────────────────────────────────────────

const stayLodge = (lodge: unknown): Row | null => {
  if (!lodge || typeof lodge !== 'object') return null;
  const value = lodge as Row;
  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    lodge_type: value.lodge_type ?? null,
    accommodation_level: value.accommodation_level ?? null,
    hero_image_url: value.hero_image_url ?? null,
    image_url: value.image_url ?? null,
    status: value.status ?? null
  };
};

/**
 * One itinerary day in the published shape: photos as a list, stays in style
 * order, and the route fields present even before their migrations ran. A day
 * with only the legacy single stay reads as that day's midrange stay.
 */
export const normaliseDay = (day: Row): Row => {
  day.summary ??= null;
  day.destination_id ??= null;
  day.destination ??= null;
  day.travel_mode ??= null;
  day.image_urls = dayImages(day);

  const stays = (Array.isArray(day.stays) ? (day.stays as Row[]) : [])
    .filter((stay) => isSafariStyle(stay?.safari_style))
    .sort((a, b) => styleRank(a.safari_style) - styleRank(b.safari_style));
  if (!stays.length && (day.accommodation_id || text(day.accommodation))) {
    stays.push({
      safari_style: 'midrange',
      lodge_id: day.accommodation_id ?? null,
      accommodation: text(day.accommodation),
      lodge: stayLodge(day.lodge)
    });
  }
  day.stays = stays;
  return day;
};

/**
 * Children in display order, and drafts kept off public pages. PostgREST does
 * not order embedded rows, so every list is sorted here.
 */
export const normaliseTourDetail = (record: Row, { staff }: { staff: boolean }): Row => {
  if (Array.isArray(record.itinerary_days)) {
    record.itinerary_days = (record.itinerary_days as Row[])
      .map(normaliseDay)
      .sort((a, b) => Number(a.day_number) - Number(b.day_number));
  }
  for (const key of ['tour_inclusions', 'tour_exclusions', 'tour_images', 'tour_destinations', 'tour_price_options']) {
    if (Array.isArray(record[key])) record[key] = [...record[key]].sort(bySortOrder);
  }
  if (Array.isArray(record.tour_pricing_seasons)) {
    record.tour_pricing_seasons = (record.tour_pricing_seasons as Row[])
      .map((season) => ({
        ...season,
        group_prices: Array.isArray(season.group_prices)
          ? [...season.group_prices].sort(
              (a: Row, b: Row) => bySortOrder(a, b) || Number(a.minimum_travelers ?? 0) - Number(b.minimum_travelers ?? 0)
            )
          : []
      }))
      .sort(bySortOrder);
  }
  if (Array.isArray(record.tour_activities)) {
    // The editor sees every linked activity; a public page only published
    // ones, so a draft's name never reaches it.
    record.tour_activities = (record.tour_activities as Row[])
      .filter((link) => link?.activity && (staff || link.activity.status === 'published'))
      .sort(bySortOrder);
  }
  return record;
};

// ── Lodges → tours ───────────────────────────────────────────────────────────

type TourRef = { id?: unknown; title?: unknown; slug?: unknown; status?: unknown; deleted_at?: unknown } | null | undefined;

export type LodgeStayRow = {
  safari_style?: unknown;
  day?: { id?: unknown; day_number?: unknown; tour?: TourRef } | null;
};

export type LegacyLodgeDayRow = {
  id?: unknown;
  day_number?: unknown;
  tour?: TourRef;
  /** The day's stays of any lodge; a day that has some is described by them. */
  stays?: unknown[] | null;
};

export type TourUsingLodge = {
  id: string;
  title: string;
  slug: string;
  status: string;
  styles: SafariStyle[];
  days: number[];
};

/**
 * Tours whose itinerary sleeps at a lodge, with the styles and day numbers.
 * Legacy accommodation_id links count as midrange, but only on days that have
 * no per-style stays yet — otherwise the stays already say which style it is.
 */
export const summariseToursUsingLodge = (
  stayRows: readonly LodgeStayRow[],
  legacyRows: readonly LegacyLodgeDayRow[]
): TourUsingLodge[] => {
  const tours = new Map<string, { tour: NonNullable<TourRef>; styles: Set<SafariStyle>; days: Set<number> }>();
  const note = (tour: TourRef, style: unknown, dayNumber: unknown) => {
    if (!tour || tour.deleted_at || !tour.id || !isSafariStyle(style)) return;
    const id = String(tour.id);
    const entry = tours.get(id) ?? { tour, styles: new Set<SafariStyle>(), days: new Set<number>() };
    entry.styles.add(style);
    if (Number.isFinite(Number(dayNumber))) entry.days.add(Number(dayNumber));
    tours.set(id, entry);
  };

  for (const row of stayRows) note(row.day?.tour, row.safari_style, row.day?.day_number);
  for (const row of legacyRows) {
    if (Array.isArray(row.stays) && row.stays.length) continue;
    note(row.tour, 'midrange', row.day_number);
  }

  return [...tours.entries()]
    .map(([id, { tour, styles, days }]) => ({
      id,
      title: String(tour.title ?? ''),
      slug: String(tour.slug ?? ''),
      status: String(tour.status ?? ''),
      styles: SAFARI_STYLES.filter((style) => styles.has(style)),
      days: [...days].sort((a, b) => a - b)
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
};
