import { DEFAULT_STYLE, SAFARI_STYLES, stylesWithPrices, tiersForStyle, seasonForStyle, type SafariStyle } from './safari-pricing.js';
import { safeUrl } from './home-content.js';
import type { DayStay, ItineraryDay, StayLodge, TourDetail } from './types/api.js';

/**
 * Pure helpers behind the public tour page (/tours/{slug}): which safari
 * styles it offers, where travellers sleep each night in the chosen style,
 * the photos and meals shown for a day, and the route. Everything here reads
 * CMS data as-is and never fills gaps with made-up names or photos.
 */

export const sortedDays = (days?: ItineraryDay[] | null): ItineraryDay[] => [...(days ?? [])].sort((a, b) => a.day_number - b.day_number);

const clean = (value?: string | null) => (value ?? '').replace(/\s+/g, ' ').trim();
// "None", "N/A" or a dash mean there is nothing to show (e.g. the departure day).
const isBlank = (value: string) => !value || /^(?:none|n\/?a|-+|—|no accommodation)$/i.test(value);
const stayName = (stay: Pick<DayStay, 'lodge' | 'accommodation'>) => clean(stay.lodge?.name) || clean(stay.accommodation);
// Stays that name neither a lodge nor a property do not count.
const namedStays = (day: Pick<ItineraryDay, 'stays'>) => (day.stays ?? []).filter((stay) => !isBlank(stayName(stay)));

/** Styles the page offers: any with prices or with at least one stay, Budget → Luxury. */
export function offeredStyles(tour: Pick<TourDetail, 'tour_pricing_seasons' | 'itinerary_days'>, today?: string): SafariStyle[] {
	const priced = stylesWithPrices(tour.tour_pricing_seasons ?? [], today);
	const stayed = new Set((tour.itinerary_days ?? []).flatMap((day) => namedStays(day).map((stay) => stay.safari_style)));
	return SAFARI_STYLES.map((style) => style.id).filter((id) => priced.includes(id) || stayed.has(id));
}

/** Midrange when offered, else the first offered style. */
export const initialStyle = (styles: SafariStyle[]): SafariStyle => (styles.includes(DEFAULT_STYLE) ? DEFAULT_STYLE : (styles[0] ?? DEFAULT_STYLE));

/** True when the day names its stays per style, so the Overnight changes with the style. */
export const hasStylePerStay = (day: Pick<ItineraryDay, 'stays'>) => namedStays(day).length > 0;

/**
 * Where travellers sleep on a day in a style. Days saved with per-style stays
 * use the stay for that style (none when the style has no stay that night);
 * older days without stays fall back to their single lodge or accommodation.
 */
export function stayFor(day: Pick<ItineraryDay, 'stays' | 'lodge' | 'accommodation'>, style: SafariStyle): { name: string; lodge: StayLodge | null } | null {
	const stays = namedStays(day);
	if (stays.length) {
		const stay = stays.find((item) => item.safari_style === style);
		return stay ? { name: stayName(stay), lodge: stay.lodge ?? null } : null;
	}
	const name = clean(day.lodge?.name) || clean(day.accommodation);
	return isBlank(name) ? null : { name, lodge: day.lodge ?? null };
}

/** The stay's own page, only when it exists publicly (published and shown on the website); '' otherwise. */
export function stayHref(day: Pick<ItineraryDay, 'stays' | 'lodge' | 'accommodation'>, style: SafariStyle): string {
	const lodge = stayFor(day, style)?.lodge;
	if (!lodge?.slug || lodge.status !== 'published' || lodge.show_property_publicly === false) return '';
	return `/stays/${encodeURIComponent(lodge.slug)}`;
}

/** "{lodge} or similar", or '' when the night has no stay (the Overnight cell is then hidden). */
export function overnightLabel(day: Pick<ItineraryDay, 'stays' | 'lodge' | 'accommodation'>, style: SafariStyle): string {
	const name = stayFor(day, style)?.name ?? '';
	if (!name) return '';
	return /\bor similar$/i.test(name) ? name : `${name} or similar`;
}

export type DayPhoto = { src: string; alt: string };

const photoUrl = (value?: string | null) => {
	const url = safeUrl(clean(value), '');
	return url.startsWith('#') ? '' : url;
};

/**
 * Up to `limit` photos for a day: its own photos, else its single legacy
 * photo, else the photos of the lodge it stays at in this style (skipped with
 * `lodgeFallback` false, when the overnight card already shows that lodge).
 */
export function dayPhotos(day: Pick<ItineraryDay, 'title' | 'image_urls' | 'image_url' | 'stays' | 'lodge' | 'accommodation'>, style: SafariStyle, limit = 3, lodgeFallback = true): DayPhoto[] {
	const title = clean(day.title);
	const own = (day.image_urls ?? []).map(photoUrl).filter(Boolean);
	const single = photoUrl(day.image_url);
	let photos: DayPhoto[];
	if (own.length) photos = own.map((src) => ({ src, alt: title }));
	else if (single) photos = [{ src: single, alt: title }];
	else if (!lodgeFallback) photos = [];
	else {
		const lodge = stayFor(day, style)?.lodge;
		photos = [lodge?.hero_image_url, lodge?.image_url].map(photoUrl).filter(Boolean).map((src) => ({ src, alt: clean(lodge?.name) || title }));
	}
	const seen = new Set<string>();
	return photos.filter((photo) => !seen.has(photo.src) && seen.add(photo.src)).slice(0, limit);
}

const MEALS = { b: 'Breakfast', l: 'Lunch', d: 'Dinner' } as const;
type Meal = keyof typeof MEALS;
const MEAL_WORDS: Record<string, Meal> = { b: 'b', bf: 'b', breakfast: 'b', l: 'l', lunch: 'l', d: 'd', dinner: 'd' };

/**
 * Meals as travellers read them: "B, L, D", "BLD" or "breakfast and dinner"
 * become "Breakfast, Lunch & Dinner" / "Breakfast & Dinner". Anything else
 * ("Full board", "Picnic lunch") is kept as written; "None" is empty.
 */
export function mealsLabel(value?: string | null): string {
	const text = clean(value);
	if (isBlank(text) || /^no meals?$/i.test(text)) return '';
	const compact = text.replace(/[\s.]/g, '').toLowerCase();
	let meals: Meal[] | null = /^[bld]{1,3}$/.test(compact) ? (compact.split('') as Meal[]) : null;
	if (!meals) {
		const words = text.toLowerCase().split(/\s*(?:,|;|\/|&|\+|\band\b)\s*/).map((word) => word.replace(/\.$/, '').trim()).filter(Boolean);
		meals = words.length && words.every((word) => word in MEAL_WORDS) ? words.map((word) => MEAL_WORDS[word]) : null;
	}
	if (!meals) return text.charAt(0).toUpperCase() + text.slice(1);
	const names = (['b', 'l', 'd'] as const).filter((meal) => meals.includes(meal)).map((meal) => MEALS[meal]);
	return names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names.at(-1)}` : names[0];
}

/** Newline-separated activities as a list. */
export const activityList = (value?: string | null): string[] =>
	(value ?? '').split('\n').map((line) => clean(line.replace(/^[-•*]\s*/, ''))).filter(Boolean);

/**
 * The destinations in travel order: the days' destinations (a stay of several
 * nights counts once), else the tour's linked destinations, else its primary one.
 */
export function tourRoute(tour: Pick<TourDetail, 'itinerary_days' | 'tour_destinations' | 'destinations'>): string[] {
	const names: string[] = [];
	for (const day of sortedDays(tour.itinerary_days)) {
		const name = clean(day.destination?.name);
		if (name && names.at(-1) !== name) names.push(name);
	}
	if (names.length) return names;
	const linked = [...(tour.tour_destinations ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((link) => clean(link.destinations?.name)).filter(Boolean);
	if (linked.length) return [...new Set(linked)];
	const primary = clean(tour.destinations?.name);
	return primary ? [primary] : [];
}

const TRAVEL_MODES = { DRIVE: 'By road', FLY: 'By air', BOAT: 'By boat' } as const;

/** How travellers reach the day's destination. Day 1 has none (it is the arrival). */
export const travelModeLabel = (day: Pick<ItineraryDay, 'day_number' | 'travel_mode'>): string =>
	day.day_number > 1 && day.travel_mode ? (TRAVEL_MODES[day.travel_mode] ?? '') : '';

export function durationLabel(days?: number | null, nights?: number | null): string {
	const dayCount = Math.round(Number(days) || 0);
	if (dayCount <= 0) return '';
	const nightCount = Math.round(Number(nights) || 0);
	return `${dayCount} ${dayCount === 1 ? 'day' : 'days'}${nightCount > 0 ? ` / ${nightCount} ${nightCount === 1 ? 'night' : 'nights'}` : ''}`;
}

export function groupSizeLabel(min?: number | null, max?: number | null): string {
	const low = Number(min) > 0 ? Math.round(Number(min)) : 0;
	const high = Number(max) > 0 ? Math.round(Number(max)) : 0;
	const people = (count: number) => (count === 1 ? 'traveler' : 'travelers');
	if (low && high) return low === high ? `${low} ${people(low)}` : `${Math.min(low, high)}–${Math.max(low, high)} travelers`;
	if (high) return `Up to ${high} ${people(high)}`;
	if (low) return `From ${low} ${people(low)}`;
	return '';
}

/** "Budget · Midrange" for the styles offered. */
export const stylesLabel = (styles: SafariStyle[]): string =>
	SAFARI_STYLES.filter((style) => styles.includes(style.id)).map((style) => style.title.replace(/\s+Safari$/, '')).join(' · ');

/** "MODERATE" / "moderate_hard" → "Moderate" / "Moderate hard". */
export const readableLabel = (value?: string | null): string => {
	const text = clean(value).replace(/_/g, ' ').toLowerCase();
	return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};

/** The lowest fixed per-person price across the offered styles' current seasons. */
export function lowestPrice(tour: Pick<TourDetail, 'tour_pricing_seasons'>, today?: string): { amount: number; currency: string } | null {
	const seasons = tour.tour_pricing_seasons ?? [];
	let best: { amount: number; currency: string } | null = null;
	for (const style of stylesWithPrices(seasons, today)) {
		const currency = seasonForStyle(seasons, style, today)?.currency ?? 'USD';
		for (const tier of tiersForStyle(seasons, style, today)) {
			if (tier.price != null && tier.price > 0 && (!best || tier.price < best.amount)) best = { amount: tier.price, currency };
		}
	}
	return best;
}
