/**
 * The tour editor's data model: the form shape, how a stored tour becomes a
 * form, how a form becomes the two save requests (the tour itself, then its
 * content), and the rules that decide whether it can be saved at all.
 *
 * Plain TS with relative imports, so every rule here can be unit tested
 * without the Svelte toolchain.
 */
import { hasRichContent, looksLikeHtml, toPlainText } from '../../../richText.js';
import { normalizeSafariStyle } from '../../../../lodge-levels.js';
import { SAFARI_STYLES, styleOf, type PricingSeason, type SafariStyle } from '../../../../safari-pricing.js';
import { TOUR_LIMITS, richTextLength } from '../../../../tour-limits.js';
import type { ItineraryDay, Tour, TourContentBody, TourContentDay } from '../../../types.js';
import type { ItineraryDay as PublicItineraryDay, Tour as PublicTour } from '../../../../types/api.js';

export type PublishStatus = 'draft' | 'published' | 'archived';
export type TravelMode = '' | 'DRIVE' | 'FLY' | 'BOAT';
export type TabKey = 'basics' | 'trip' | 'itinerary' | 'included' | 'pricing' | 'activities' | 'media' | 'seo' | 'translations';
export type Option = { label: string; value: string };
export type MediaItem = { id: string; file_name: string; file_url: string; thumbnail_url?: string | null };

export type DestinationOption = { id: string; name: string; region: string; status: string; pinned: boolean };
export type LodgeOption = { id: string; name: string; destination_id: string; destination_name: string; level: string; status: string };
export type ActivityOption = { id: string; name: string; category: string; status: string; destination_ids: string[] };

/** `custom` is editor state only: the row is typing a name instead of picking a lodge. */
export type StayDraft = { lodge_id: string; accommodation: string; custom: boolean };

export type DayDraft = {
  /** Stable {#each} key: the day id once saved. */
  key: string;
  id: string;
  title: string;
  summary: string;
  description: string;
  destination_id: string;
  travel_mode: TravelMode;
  meals: string;
  activities: string[];
  image_urls: string[];
  stays: Record<SafariStyle, StayDraft>;
};

export type GalleryDraft = { key: string; id: string; image_url: string; alt_text: string; caption: string; is_featured: boolean };

/**
 * Number inputs bind as numbers in Svelte, so the "string" fields below can
 * hold a number (or null) at runtime. Everything that reads them goes through
 * `text()` first.
 */
export type TourEditorForm = {
  title: string;
  slug: string;
  status: PublishStatus;
  category_id: string;
  specialist_id: string;
  /** First is the primary destination. */
  destination_ids: string[];
  short_description: string;
  full_description: string;
  is_available: boolean;
  is_featured: boolean;
  is_popular: boolean;
  duration_days: string;
  duration_nights: string;
  start_trip_point_id: string;
  end_trip_point_id: string;
  group_size_min: string;
  group_size_max: string;
  minimum_age: string;
  difficulty_level: string;
  /** Safari style key; an older free-text tier that does not map is kept as is. */
  budget_tier: string;
  experience_type: string;
  persona_tags: string[];
  highlights: string[];
  /** Plain text of a loaded highlight -> its stored rich text, so untouched bullets keep their formatting. */
  highlight_sources: Record<string, string>;
  customization_intro: string;
  customization_options: string[];
  days: DayDraft[];
  inclusion_ids: string[];
  exclusion_ids: string[];
  price_from: string;
  currency: string;
  activity_ids: string[];
  activity_settings: Record<string, { is_optional: boolean; additional_cost: boolean; pricing_option_id: string | null }>;
  main_image_url: string;
  banner_image_url: string;
  images: GalleryDraft[];
  meta_title: string;
  meta_description: string;
  og_image_url: string;
};

// ── Limits (mirror PUT /tours/:id/content and the tours schema) ─────────────
// Text lengths live in $lib/tour-limits, shared with the API's copy.

export const LIMITS = TOUR_LIMITS;
export const MAX_DAYS = 60;
/** The public day shows three photos, so three slots are offered and three saved. */
export const MAX_DAY_PHOTOS = TOUR_LIMITS.dayPhotos;
export const DAY_PHOTO_SLOTS = TOUR_LIMITS.dayPhotos;
export const MAX_HIGHLIGHTS = TOUR_LIMITS.highlights;
export const MAX_LIST_ITEMS = TOUR_LIMITS.listItems;
export const MAX_ACTIVITY_ITEMS = TOUR_LIMITS.activities;
export const MAX_GALLERY = 40;
export const MAX_ACTIVITIES = 50;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const STYLE_KEYS: SafariStyle[] = SAFARI_STYLES.map((style) => style.id);
export const STYLE_LABEL: Record<SafariStyle, string> = { budget: 'Budget', midrange: 'Midrange', luxury: 'Luxury' };

export const DIFFICULTY_LEVELS = ['Easy', 'Moderate', 'Challenging'] as const;

export const TRAVEL_MODES: { value: Exclude<TravelMode, ''>; label: string }[] = [
  { value: 'DRIVE', label: 'By road' },
  { value: 'FLY', label: 'By air' },
  { value: 'BOAT', label: 'By boat' }
];

export const MEALS = ['Breakfast', 'Lunch', 'Dinner'] as const;
export type Meal = (typeof MEALS)[number];

// ── Small helpers ────────────────────────────────────────────────────────────

/** Trimmed text of anything a field can hold, including a bound number. */
export const text = (value: unknown): string => String(value ?? '').trim();

const nullableNumber = (value: unknown): number | null => {
  const raw = text(value);
  return raw === '' ? null : Number(raw);
};

/** The API only stores absolute image addresses. */
export const isImageUrl = (value: unknown) => {
  try {
    return /^https?:$/.test(new URL(text(value)).protocol);
  } catch {
    return false;
  }
};

const isWholeNumber = (value: unknown, min: number) => {
  const raw = text(value);
  if (!raw) return true;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min;
};

export const newKey = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

export const slugify = (value: unknown) =>
  text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Moves one item, returning a new list; out-of-range moves return the list unchanged. */
export const moveItem = <T>(list: readonly T[], index: number, delta: -1 | 1): T[] => {
  const target = index + delta;
  if (index < 0 || target < 0 || index >= list.length || target >= list.length) return [...list];
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

// ── Meals ────────────────────────────────────────────────────────────────────

const MEAL_WORDS: Record<string, Meal> = {
  breakfast: 'Breakfast',
  b: 'Breakfast',
  lunch: 'Lunch',
  l: 'Lunch',
  dinner: 'Dinner',
  d: 'Dinner'
};

/**
 * The meals a stored value names, in Breakfast → Dinner order. Null when the
 * text says something the three chips cannot ("Picnic lunch", "Full board"),
 * so the editor keeps it as a custom value instead of rewriting it.
 */
export const parseMeals = (value: unknown): Meal[] | null => {
  const raw = text(value).toLowerCase();
  if (!raw) return [];
  const found = new Set<Meal>();
  // "BLD" / "B D": the shorthand the public page also reads.
  const compact = raw.replace(/[\s,/&+.]+/g, '');
  const tokens = /^[bld]{1,3}$/.test(compact) ? compact.split('') : raw.split(/\s*(?:,|&|\+|\/|\band\b)\s*/);
  for (const token of tokens) {
    if (!token) continue;
    const meal = MEAL_WORDS[token];
    if (!meal) return null;
    found.add(meal);
  }
  return MEALS.filter((meal) => found.has(meal));
};

/** "Breakfast", "Breakfast & Dinner", "Breakfast, Lunch & Dinner". */
export const formatMeals = (meals: readonly Meal[]): string => {
  const list = MEALS.filter((meal) => meals.includes(meal));
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}`;
};

// ── Days ─────────────────────────────────────────────────────────────────────

/**
 * Activities are stored newline separated. Older days wrote a single line with
 * commas, which the itineraries page has always split the same way.
 */
export const parseActivities = (value: unknown): string[] => {
  const raw = text(value);
  if (!raw) return [''];
  const parts = raw.includes('\n') ? raw.split(/\r?\n/) : raw.split(/,\s*/);
  const items = parts.map((item) => item.trim()).filter(Boolean);
  return items.length ? items : [''];
};

const emptyStay = (): StayDraft => ({ lodge_id: '', accommodation: '', custom: false });
export const emptyStays = (): Record<SafariStyle, StayDraft> => ({ budget: emptyStay(), midrange: emptyStay(), luxury: emptyStay() });

const padPhotos = (urls: string[]) => [...urls, ...Array(Math.max(0, DAY_PHOTO_SLOTS - urls.length)).fill('')];

export const blankDay = (): DayDraft => ({
  key: newKey(),
  id: '',
  title: '',
  summary: '',
  description: '',
  destination_id: '',
  travel_mode: '',
  meals: '',
  activities: [''],
  image_urls: padPhotos([]),
  stays: emptyStays()
});

/** A copy to insert as a new day: same content, no id. */
export const copyDay = (day: DayDraft): DayDraft => ({
  ...day,
  key: newKey(),
  id: '',
  activities: [...day.activities],
  image_urls: [...day.image_urls],
  stays: {
    budget: { ...day.stays.budget },
    midrange: { ...day.stays.midrange },
    luxury: { ...day.stays.luxury }
  }
});

const stayFilled = (stay: StayDraft) => Boolean(stay.lodge_id || text(stay.accommodation));

/** Nothing written on it yet — safe for "Draft with AI" to fill. */
export const isEmptyDay = (day: DayDraft) =>
  !text(day.title) &&
  !text(day.summary) &&
  !hasRichContent(day.description) &&
  !text(day.meals) &&
  day.activities.every((item) => !text(item)) &&
  day.image_urls.every((url) => !text(url)) &&
  !STYLE_KEYS.some((style) => stayFilled(day.stays[style]));

const travelModeOf = (value: unknown): TravelMode => {
  const mode = text(value).toUpperCase();
  return mode === 'DRIVE' || mode === 'FLY' || mode === 'BOAT' ? mode : '';
};

/**
 * A stored day as an editable draft. A day saved before per-style stays has
 * only the single legacy lodge; that becomes the Midrange overnight, which is
 * where the API reads it back from too.
 */
export const dayFromRecord = (day: ItineraryDay): DayDraft => {
  const stays = emptyStays();
  const recorded = Array.isArray(day.stays) ? day.stays : [];
  for (const stay of recorded) {
    if (!STYLE_KEYS.includes(stay.safari_style)) continue;
    const lodgeId = text(stay.lodge_id ?? stay.lodge?.id);
    const name = text(stay.accommodation);
    stays[stay.safari_style] = { lodge_id: lodgeId, accommodation: lodgeId ? '' : name, custom: !lodgeId && Boolean(name) };
  }
  if (!recorded.length) {
    const lodgeId = text(day.accommodation_id ?? day.lodge?.id);
    const name = text(day.accommodation);
    if (lodgeId || name) stays.midrange = { lodge_id: lodgeId, accommodation: lodgeId ? '' : name, custom: !lodgeId };
  }

  const photos = [...new Set((Array.isArray(day.image_urls) ? day.image_urls : []).map(text).filter(Boolean))];
  if (!photos.length && text(day.image_url)) photos.push(text(day.image_url));

  const id = text(day.id);
  return {
    key: id || newKey(),
    id,
    title: String(day.title ?? ''),
    summary: String(day.summary ?? ''),
    description: String(day.description ?? ''),
    destination_id: text(day.destination_id),
    travel_mode: travelModeOf(day.travel_mode),
    meals: String(day.meals ?? ''),
    activities: parseActivities(day.activities),
    image_urls: padPhotos(photos),
    stays
  };
};

/**
 * Lodges the stored days already use, as picker options. They name the
 * overnights before the lodge list has loaded, and keep a lodge that is no
 * longer in that list selectable instead of silently showing "none".
 */
export const lodgesInTour = (tour: Tour): LodgeOption[] => {
  const found = new Map<string, LodgeOption>();
  for (const day of tour.itinerary_days ?? []) {
    const linked = [day.lodge, ...(day.stays ?? []).map((stay) => stay.lodge)];
    for (const lodge of linked) {
      if (!lodge?.id || found.has(lodge.id)) continue;
      found.set(lodge.id, {
        id: lodge.id,
        name: String(lodge.name ?? 'Linked lodge'),
        destination_id: '',
        destination_name: '',
        level: String(lodge.accommodation_level ?? ''),
        status: String((lodge as { status?: string | null }).status ?? 'published')
      });
    }
  }
  return [...found.values()];
};

// ── Form ─────────────────────────────────────────────────────────────────────

export const emptyForm = (): TourEditorForm => ({
  title: '',
  slug: '',
  status: 'draft',
  category_id: '',
  specialist_id: '',
  destination_ids: [],
  short_description: '',
  full_description: '',
  is_available: true,
  is_featured: false,
  is_popular: false,
  duration_days: '1',
  duration_nights: '',
  start_trip_point_id: '',
  end_trip_point_id: '',
  group_size_min: '',
  group_size_max: '',
  minimum_age: '',
  difficulty_level: '',
  budget_tier: '',
  experience_type: '',
  persona_tags: [],
  highlights: [''],
  highlight_sources: {},
  customization_intro: '',
  customization_options: [''],
  days: [],
  inclusion_ids: [],
  exclusion_ids: [],
  price_from: '',
  currency: 'USD',
  activity_ids: [],
  activity_settings: {},
  main_image_url: '',
  banner_image_url: '',
  images: [],
  meta_title: '',
  meta_description: '',
  og_image_url: ''
});

const bySortOrder = (a: { sort_order?: number | null }, b: { sort_order?: number | null }) =>
  Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);

const optionalText = (value: unknown) => (value === null || value === undefined ? '' : String(value));

/** Stored difficulty in the select's wording; anything else is kept verbatim. */
export const normalizeDifficulty = (value: unknown): string => {
  const raw = text(value);
  return DIFFICULTY_LEVELS.find((level) => level.toLowerCase() === raw.toLowerCase()) ?? raw;
};

/** Primary destination first, then the rest in their saved order. */
export const tourDestinationIds = (tour: Tour): string[] => {
  const rows = [...(Array.isArray(tour.tour_destinations) ? tour.tour_destinations : [])].sort(bySortOrder);
  const primary = text(tour.destination_id) || text(rows.find((row) => row.is_primary)?.destination_id);
  const ids = rows.map((row) => text(row.destination_id ?? row.destinations?.id)).filter(Boolean);
  return [...new Set([primary, ...ids].filter(Boolean))];
};

const listOrBlank = (items: string[]) => (items.length ? items : ['']);

/** A stored tour (the staff GET / save response) as the editor's form. */
export const formFromTour = (tour: Tour): TourEditorForm => {
  const highlightSources: Record<string, string> = {};
  const highlights = (Array.isArray(tour.highlights) ? tour.highlights : [])
    .map((item) => {
      const stored = String(item ?? '');
      const plain = toPlainText(stored).replace(/\s*\n+\s*/g, ' ').trim();
      if (plain && looksLikeHtml(stored)) highlightSources[plain] = stored;
      return plain;
    })
    .filter(Boolean);

  const days = [...(Array.isArray(tour.itinerary_days) ? tour.itinerary_days : [])]
    .sort((a, b) => Number(a.day_number ?? 0) - Number(b.day_number ?? 0))
    .map(dayFromRecord);

  const images = [...(Array.isArray(tour.tour_images) ? tour.tour_images : [])].sort(bySortOrder).map((image) => ({
    key: text(image.id) || newKey(),
    id: text(image.id),
    image_url: String(image.image_url ?? ''),
    alt_text: optionalText(image.alt_text),
    caption: optionalText(image.caption),
    is_featured: Boolean(image.is_featured)
  }));
  // One featured photo at most, whatever older data says.
  let seenFeatured = false;
  for (const image of images) {
    if (image.is_featured && seenFeatured) image.is_featured = false;
    if (image.is_featured) seenFeatured = true;
  }

  const rawTier = text(tour.budget_tier);

  return {
    title: String(tour.title ?? ''),
    slug: String(tour.slug ?? ''),
    status: tour.status === 'published' || tour.status === 'archived' ? tour.status : 'draft',
    category_id: text(tour.category_id),
    specialist_id: text(tour.specialist_id ?? tour.specialist?.id),
    destination_ids: tourDestinationIds(tour),
    short_description: optionalText(tour.short_description),
    full_description: optionalText(tour.full_description),
    is_available: tour.is_available ?? true,
    is_featured: Boolean(tour.is_featured),
    is_popular: Boolean(tour.is_popular),
    duration_days: optionalText(tour.duration_days ?? 1),
    duration_nights: optionalText(tour.duration_nights),
    start_trip_point_id: optionalText(tour.start_trip_point_id),
    end_trip_point_id: optionalText(tour.end_trip_point_id),
    group_size_min: optionalText(tour.group_size_min),
    group_size_max: optionalText(tour.group_size_max),
    minimum_age: optionalText(tour.minimum_age),
    difficulty_level: normalizeDifficulty(tour.difficulty_level),
    budget_tier: normalizeSafariStyle(rawTier) ?? rawTier,
    experience_type: optionalText(tour.experience_type),
    persona_tags: (Array.isArray(tour.persona_tags) ? tour.persona_tags : []).map(text).filter(Boolean),
    highlights: listOrBlank(highlights),
    highlight_sources: highlightSources,
    customization_intro: optionalText(tour.customization_intro),
    customization_options: listOrBlank((Array.isArray(tour.customization_options) ? tour.customization_options : []).map(String)),
    days,
    inclusion_ids: [...(tour.tour_inclusions ?? [])].sort(bySortOrder).map((item) => String(item.option_id ?? '')).filter(Boolean),
    exclusion_ids: [...(tour.tour_exclusions ?? [])].sort(bySortOrder).map((item) => String(item.option_id ?? '')).filter(Boolean),
    price_from: tour.price_from === null || tour.price_from === undefined || Number(tour.price_from) === 0 ? '' : String(tour.price_from),
    currency: text(tour.currency) || 'USD',
    activity_settings: Object.fromEntries((tour.tour_activities ?? []).filter(link => link.activity?.id).map(link => [link.activity!.id, { is_optional: link.is_optional === true, additional_cost: link.additional_cost === true, pricing_option_id: link.pricing_option_id ?? null }])),
    activity_ids: [...(Array.isArray(tour.tour_activities) ? tour.tour_activities : [])]
      .sort(bySortOrder)
      .map((link) => text(link.activity?.id))
      .filter(Boolean),
    main_image_url: optionalText(tour.main_image_url),
    banner_image_url: optionalText(tour.banner_image_url),
    images,
    meta_title: optionalText(tour.meta_title || tour.seo_title),
    meta_description: optionalText(tour.meta_description),
    og_image_url: optionalText(tour.og_image_url || tour.og_image)
  };
};

// ── Payloads ─────────────────────────────────────────────────────────────────

const cleanList = (items: readonly string[]) => items.map(text).filter(Boolean);

/** Nights left blank means the usual days − 1. */
export const suggestedNights = (days: unknown) => Math.max(0, (Math.trunc(Number(text(days))) || 1) - 1);

/** Body for POST /tours and PUT /tours/:id. */
export const corePayload = (form: TourEditorForm) => {
  const days = Math.trunc(Number(text(form.duration_days))) || 1;
  const nights = text(form.duration_nights);
  const seoTitle = text(form.meta_title) || null;
  return {
    title: text(form.title),
    slug: text(form.slug),
    status: form.status,
    category_id: form.category_id || null,
    specialist_id: form.specialist_id || null,
    destination_id: form.destination_ids[0] || null,
    destination_ids: [...form.destination_ids],
    short_description: text(form.short_description) || null,
    full_description: hasRichContent(form.full_description) ? form.full_description : null,
    is_available: form.is_available,
    is_featured: form.is_featured,
    is_popular: form.is_popular,
    duration_days: days,
    duration_nights: nights ? Number(nights) : suggestedNights(days),
    start_trip_point_id: text(form.start_trip_point_id) || null,
    end_trip_point_id: text(form.end_trip_point_id) || null,
    group_size_min: nullableNumber(form.group_size_min),
    group_size_max: nullableNumber(form.group_size_max),
    minimum_age: nullableNumber(form.minimum_age),
    difficulty_level: text(form.difficulty_level) || null,
    budget_tier: text(form.budget_tier) || null,
    experience_type: text(form.experience_type) || null,
    persona_tags: [...form.persona_tags],
    highlights: cleanList(form.highlights).map((item) => form.highlight_sources[item] ?? item),
    customization_intro: text(form.customization_intro) || null,
    customization_options: cleanList(form.customization_options),
    price_from: Number(text(form.price_from) || 0),
    currency: text(form.currency).toUpperCase() || 'USD',
    main_image_url: text(form.main_image_url) || null,
    banner_image_url: text(form.banner_image_url) || null,
    og_image_url: text(form.og_image_url) || null,
    // Older readers use seo_title; both carry the same value.
    meta_title: seoTitle,
    seo_title: seoTitle,
    meta_description: text(form.meta_description) || null
  };
};

const dayPayload = (day: DayDraft, index: number): TourContentDay => ({
  ...(day.id ? { id: day.id } : {}),
  day_number: index + 1,
  title: text(day.title),
  summary: text(day.summary) || null,
  description: hasRichContent(day.description) ? day.description : null,
  destination_id: day.destination_id || null,
  // Day 1 has no previous stop to travel from.
  travel_mode: index > 0 ? day.travel_mode || null : null,
  meals: text(day.meals) || null,
  activities: cleanList(day.activities).join('\n') || null,
  image_urls: [...new Set(cleanList(day.image_urls))].slice(0, MAX_DAY_PHOTOS),
  stays: STYLE_KEYS.map((style) => {
    const stay = day.stays[style];
    return {
      safari_style: style,
      lodge_id: stay.lodge_id || null,
      accommodation: stay.lodge_id ? null : text(stay.accommodation) || null
    };
  }).filter((stay) => stay.lodge_id || stay.accommodation)
});

/** Body for PUT /tours/:id/content — every collection, so the save is whole. */
export const contentPayload = (form: TourEditorForm): Required<TourContentBody> => ({
  days: form.days.map(dayPayload),
  inclusion_ids: [...form.inclusion_ids],
  exclusion_ids: [...form.exclusion_ids],
  images: form.images
    .filter((image) => text(image.image_url))
    .map((image) => ({
      ...(image.id ? { id: image.id } : {}),
      image_url: text(image.image_url),
      alt_text: text(image.alt_text) || null,
      caption: text(image.caption) || null,
      is_featured: image.is_featured
    })),
  activity_ids: [...new Set(form.activity_ids)],
  activity_settings: [...new Set(form.activity_ids)].map(activity_id => ({ activity_id, ...(form.activity_settings[activity_id] ?? { is_optional: false, additional_cost: false, pricing_option_id: null }) }))
});

/** What would be saved, as one comparable string. UI-only state never counts as a change. */
export const snapshot = (form: TourEditorForm) => JSON.stringify([corePayload(form), contentPayload(form)]);

// ── Validation ───────────────────────────────────────────────────────────────

/** `field` is the input's name, so the editor can bring it into view after a blocked save. */
export type Problem = { tab: TabKey; message: string; dayKey?: string; field?: string };

/**
 * Every reason the form cannot be saved, in the order they should be fixed.
 * Mirrors the tours schema and PUT /tours/:id/content, so a save the editor
 * lets through is one the API accepts.
 */
/**
 * A page URL the API accepts. A slug the tour already has is left alone even
 * if older than the pattern — changing it would break links to the page.
 */
export const slugProblem = (slug: unknown, storedSlug = ''): string => {
  const value = text(slug);
  if (value.length < 2) return 'Page URL needs at least 2 characters, e.g. 7-day-serengeti-safari.';
  if (value !== storedSlug && !SLUG_RE.test(value)) return 'Page URL: lowercase letters, numbers and single hyphens, e.g. 7-day-serengeti-safari.';
  return '';
};

export const findProblems = (form: TourEditorForm, storedSlug = ''): Problem[] => {
  const problems: Problem[] = [];
  const add = (tab: TabKey, message: string, dayKey?: string, field?: string) => problems.push({ tab, message, dayKey, field });
  // "… — it has 75." tells the editor how much to cut.
  const has = (length: number) => ` — it has ${length}.`;

  const title = text(form.title);
  if (title.length < 2) add('basics', 'Give the safari a title of at least 2 characters.', undefined, 'title');
  else if (title.length > LIMITS.title) add('basics', `Keep the safari title to ${LIMITS.title} characters so it fits on a tour card${has(title.length)}`, undefined, 'title');
  const slugIssue = slugProblem(form.slug, storedSlug);
  if (slugIssue) add('basics', slugIssue, undefined, 'slug');
  const glance = text(form.short_description);
  if (glance && glance.length < 5) add('basics', '“At a glance” needs at least 5 characters, or leave it empty.', undefined, 'short_description');
  else if (glance.length > LIMITS.shortDescription) add('basics', `Keep “At a glance” to ${LIMITS.shortDescription} characters${has(glance.length)}`, undefined, 'short_description');

  for (const [value, field, name] of [
    [form.start_trip_point_id, 'start_trip_point_id', 'start point'],
    [form.end_trip_point_id, 'end_trip_point_id', 'end point']
  ] as const) {
    if (form.status === 'published' && !text(value)) add('trip', `Select a ${name} from Trip Points before publishing.`, undefined, field);
    else if (text(value) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value))) add('trip', `Select a valid ${name} from Trip Points.`, undefined, field);
  }
  const experience = text(form.experience_type);
  if (experience.length > LIMITS.experienceType) add('trip', `Keep the experience type to ${LIMITS.experienceType} characters${has(experience.length)}`, undefined, 'experience_type');
  const highlights = cleanList(form.highlights);
  if (highlights.length > MAX_HIGHLIGHTS) add('trip', `List at most ${MAX_HIGHLIGHTS} highlights — there are ${highlights.length}.`);
  if (highlights.some((item) => item.length > LIMITS.highlight)) add('trip', `Keep each highlight to ${LIMITS.highlight} characters.`);

  const days = Number(text(form.duration_days));
  if (!Number.isInteger(days) || days < 1) add('trip', 'Days must be a whole number, at least 1.');
  if (!isWholeNumber(form.duration_nights, 0)) add('trip', 'Nights must be a whole number, 0 or more — or leave it blank.');
  if (!isWholeNumber(form.group_size_min, 0) || !isWholeNumber(form.group_size_max, 0)) add('trip', 'Group sizes must be whole numbers.');
  else {
    const min = nullableNumber(form.group_size_min);
    const max = nullableNumber(form.group_size_max);
    if (min !== null && max !== null && max < min) add('trip', 'The maximum group size is smaller than the minimum.');
  }
  if (!isWholeNumber(form.minimum_age, 0)) add('trip', 'Minimum age must be a whole number.');
  if (form.customization_options.some((option) => text(option).length > LIMITS.customizationOption)) {
    add('trip', `Trip customisation: keep each option to ${LIMITS.customizationOption} characters.`);
  }

  if (form.days.length > MAX_DAYS) add('itinerary', `An itinerary can have at most ${MAX_DAYS} days.`);
  form.days.forEach((day, index) => {
    const label = `Day ${index + 1}`;
    const dayTitle = text(day.title);
    if (dayTitle.length < 2) add('itinerary', `${label} needs a title of at least 2 characters.`, day.key);
    else if (dayTitle.length > LIMITS.dayTitle) add('itinerary', `${label}: keep the title to ${LIMITS.dayTitle} characters so it fits the itinerary timeline${has(dayTitle.length)}`, day.key);
    const summary = text(day.summary);
    if (summary.length > LIMITS.daySummary) add('itinerary', `${label}: keep the summary to ${LIMITS.daySummary} characters so it fits under the day title${has(summary.length)}`, day.key);
    const described = richTextLength(day.description);
    if (described > LIMITS.dayDescription) add('itinerary', `${label}: keep the description to ${LIMITS.dayDescription} characters of text${has(described)}`, day.key);
    if (text(day.meals).length > LIMITS.meals) add('itinerary', `${label}: keep the meals to ${LIMITS.meals} characters.`, day.key);
    const activities = cleanList(day.activities);
    if (activities.length > MAX_ACTIVITY_ITEMS) add('itinerary', `${label}: list at most ${MAX_ACTIVITY_ITEMS} activities — there are ${activities.length}.`, day.key);
    if (activities.some((item) => item.length > LIMITS.activity)) add('itinerary', `${label}: keep each activity to ${LIMITS.activity} characters so it fits on one chip.`, day.key);
    for (const style of STYLE_KEYS) {
      const stay = day.stays[style];
      if (!stay.lodge_id && text(stay.accommodation).length > LIMITS.stayName) {
        add('itinerary', `${label}: keep the ${STYLE_LABEL[style]} property name to ${LIMITS.stayName} characters so it fits the Overnight line.`, day.key);
      }
    }
    const photos = cleanList(day.image_urls);
    if (photos.some((url) => !isImageUrl(url))) add('itinerary', `${label}: a photo address is not a full web address (https://…).`, day.key);
    if (new Set(photos).size > MAX_DAY_PHOTOS) add('itinerary', `${label}: the tour page shows ${MAX_DAY_PHOTOS} photos a day — remove the extra ones.`, day.key);
  });

  for (const [items, name] of [[form.inclusion_ids, 'included'], [form.exclusion_ids, 'excluded']] as const) {
    if (items.length > MAX_LIST_ITEMS) add('included', `Select at most ${MAX_LIST_ITEMS} ${name} items.`);
    if (new Set(items).size !== items.length) add('included', `Select each ${name} item only once.`);
    if (items.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) add('included', `Select valid ${name} items from the shared library.`);
  }

  const price = text(form.price_from);
  if (price && (!Number.isFinite(Number(price)) || Number(price) < 0)) add('pricing', 'Enter the starting price as a number, e.g. 1850 — or leave it blank.');
  if (!/^[A-Za-z]{3}$/.test(text(form.currency))) add('pricing', 'Currency is a 3-letter code, e.g. USD.');

  if (form.activity_ids.length > MAX_ACTIVITIES) add('activities', `Link at most ${MAX_ACTIVITIES} activities.`);
  for (const [value, tab, name] of [
    [form.main_image_url, 'media', 'main image'],
    [form.banner_image_url, 'media', 'banner image'],
    [form.og_image_url, 'seo', 'sharing image']
  ] as const) {
    if (text(value) && !isImageUrl(value)) add(tab, `The ${name} needs a full web address (https://…).`);
  }
  if (form.images.some((image) => text(image.image_url) && !isImageUrl(image.image_url))) add('media', 'A gallery photo address is not a full web address (https://…).');
  if (form.images.filter((image) => text(image.image_url)).length > MAX_GALLERY) add('media', `The gallery holds at most ${MAX_GALLERY} photos.`);
  form.images.forEach((image, index) => {
    if (!text(image.image_url)) return;
    if (text(image.alt_text).length > LIMITS.altText) add('media', `Gallery photo ${index + 1}: keep the alt text to ${LIMITS.altText} characters.`);
    if (text(image.caption).length > LIMITS.caption) add('media', `Gallery photo ${index + 1}: keep the caption to ${LIMITS.caption} characters.`);
  });

  // Past the search targets (60 / 160) is only a warning; the hard caps block.
  const seoTitle = text(form.meta_title);
  if (seoTitle.length > LIMITS.seoTitle.max) add('seo', `Keep the SEO title to ${LIMITS.seoTitle.max} characters — search results cut it after about ${LIMITS.seoTitle.target}${has(seoTitle.length)}`, undefined, 'meta_title');
  const metaDescription = text(form.meta_description);
  if (metaDescription.length > LIMITS.metaDescription.max) {
    add('seo', `Keep the meta description to ${LIMITS.metaDescription.max} characters — search results cut it after about ${LIMITS.metaDescription.target}${has(metaDescription.length)}`, undefined, 'meta_description');
  }

  if (form.status === 'published') {
    if (!form.destination_ids.length) add('basics', 'Choose at least one destination before publishing — or save it as a draft.');
    if (!glance) add('basics', 'Write the “At a glance” description before publishing — or save it as a draft.');
    if (!form.days.length) add('itinerary', 'Add at least one itinerary day before publishing — or save it as a draft.');
  }

  return problems;
};

// ── Live previews ────────────────────────────────────────────────────────────
// The editor previews with the public components themselves; these build the
// data they read from what is typed right now, so the preview is what saves.

/**
 * The tour as the public tour card reads it: the route in the order the
 * destinations were picked, nights as they will be saved, and the "from"
 * price the API would advertise from the saved price table.
 */
export const cardPreviewTour = (form: TourEditorForm, destinations: readonly DestinationOption[], seasons: readonly PricingSeason[]): PublicTour => {
  const core = corePayload(form);
  const lowest = lowestFixedPrice(seasons);
  const places = new Map(destinations.map((place) => [place.id, place]));
  const preview = {
    id: 'preview',
    title: core.title || 'Your safari title',
    slug: core.slug || 'preview',
    duration_days: core.duration_days,
    duration_nights: core.duration_nights,
    price_from: core.price_from,
    currency: core.currency,
    main_image_url: isImageUrl(core.main_image_url) ? core.main_image_url : null,
    banner_image_url: isImageUrl(core.banner_image_url) ? core.banner_image_url : null,
    tour_destinations: core.destination_ids.flatMap((id, index) => {
      const place = places.get(id);
      return place ? [{ destination_id: id, sort_order: index, is_primary: index === 0, destinations: { id, name: place.name, slug: slugify(place.name) } }] : [];
    }),
    pricing_summary: lowest ? { styles: [], from: lowest.amount, currency: lowest.currency } : null
  } satisfies Partial<PublicTour>;
  return preview as PublicTour;
};

/** One editor day as the public itinerary timeline reads it. */
export const timelineDay = (day: DayDraft, index: number, lodges: readonly LodgeOption[]): PublicItineraryDay => ({
  id: day.key,
  day_number: index + 1,
  title: text(day.title),
  summary: text(day.summary) || null,
  // Day 1 has no leg into it, as on save.
  travel_mode: index > 0 ? day.travel_mode || null : null,
  stays: STYLE_KEYS.flatMap((style): NonNullable<PublicItineraryDay['stays']> => {
    const stay = day.stays[style];
    if (stay.lodge_id) {
      const name = lodges.find((lodge) => lodge.id === stay.lodge_id)?.name ?? 'Linked lodge';
      return [{ safari_style: style, lodge_id: stay.lodge_id, accommodation: null, lodge: { id: stay.lodge_id, name, slug: '' } }];
    }
    return text(stay.accommodation) ? [{ safari_style: style, lodge_id: null, accommodation: text(stay.accommodation) }] : [];
  })
});

// ── Pricing ──────────────────────────────────────────────────────────────────

/** Lowest fixed per-person price across every style's active seasons. */
export const lowestFixedPrice = (seasons: readonly PricingSeason[]): { amount: number; currency: string } | null => {
  let best: { amount: number; currency: string } | null = null;
  for (const season of seasons) {
    if (season.status !== 'ACTIVE' || season.pricing_basis !== 'PER_PERSON') continue;
    for (const price of season.group_prices ?? []) {
      if (price.price_status !== 'FIXED_PRICE' || price.price === null || price.price === undefined) continue;
      const amount = Number(price.price);
      if (Number.isFinite(amount) && (!best || amount < best.amount)) best = { amount, currency: season.currency || 'USD' };
    }
  }
  return best;
};

/** "4 of 6 prices set" under each style tab, as on the pricing page. */
export const stylePriceNote = (seasons: readonly PricingSeason[], style: SafariStyle): string => {
  const rows = seasons.filter((season) => styleOf(season) === style).flatMap((season) => season.group_prices ?? []);
  if (!rows.length) return 'Not set up';
  return `${rows.filter((row) => row.price_status === 'FIXED_PRICE' && row.price != null).length} of ${rows.length} prices set`;
};
