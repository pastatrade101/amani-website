import { toEastAfricaCountry } from './countries.js';
import { destinationPhoto, safeUrl } from './home-content.js';
import { LODGE_LEVELS, lodgeLevelLabel, styleForLodgeLevel } from './lodge-levels.js';
import { formatPrice, SAFARI_STYLES, type SafariStyle } from './safari-pricing.js';
import type { Destination, Stay, StayDetail, StayTour, StayType } from './types/api.js';

/**
 * Words and small rules for the public Stays pages (the lodges & camps). Plain
 * TS so it is testable; icons are mapped in the components.
 */

/** The lodge_type enum, most common safari stays first (same words as the CMS). */
export const STAY_TYPES: { value: StayType; label: string }[] = [
	{ value: 'SAFARI_LODGE', label: 'Safari lodge' },
	{ value: 'TENTED_CAMP', label: 'Tented camp' },
	{ value: 'MOBILE_CAMP', label: 'Mobile camp' },
	{ value: 'HOTEL', label: 'Hotel' },
	{ value: 'BEACH_RESORT', label: 'Beach resort' },
	{ value: 'BOUTIQUE_HOTEL', label: 'Boutique hotel' },
	{ value: 'ECO_LODGE', label: 'Eco lodge' },
	{ value: 'VILLA', label: 'Villa' },
	{ value: 'GUEST_HOUSE', label: 'Guest house' }
];

const toStayType = (value: unknown): StayType | null => STAY_TYPES.find((type) => type.value === String(value ?? '').toUpperCase())?.value ?? null;

/** "Tented camp"; empty for a missing or unknown type. */
export const stayTypeLabel = (value: unknown): string => STAY_TYPES.find((type) => type.value === toStayType(value))?.label ?? '';

/** Budget / Midrange / Luxury, each with the CMS's own one-line description of the level. */
export const STAY_STYLES: { id: SafariStyle; label: string; hint: string }[] = SAFARI_STYLES.map((style) => ({
	id: style.id,
	label: style.title.replace(/\s+Safari$/, ''),
	hint: LODGE_LEVELS.find((level) => level.style === style.id)?.hint ?? ''
}));

const isStyle = (value: unknown): value is SafariStyle => SAFARI_STYLES.some((style) => style.id === value);

/** The style the API computed, else the one the lodge level implies. */
export const stayStyle = (stay: Pick<Stay, 'style' | 'accommodation_level'>): SafariStyle =>
	isStyle(stay.style) ? stay.style : styleForLodgeLevel(stay.accommodation_level);

export const styleLabel = (style: SafariStyle): string => STAY_STYLES.find((item) => item.id === style)?.label ?? 'Midrange';

/** "Luxury · top-end" for the most exclusive properties, else the style's name. */
export const stayStyleLabel = (stay: Pick<Stay, 'style' | 'accommodation_level'>): string =>
	stay.accommodation_level ? lodgeLevelLabel(stay.accommodation_level) : styleLabel(stayStyle(stay));

/** "Central Serengeti, Tanzania": the park area (or destination, or region), then the country. */
export function stayLocation(stay: Pick<Stay, 'park_area' | 'region' | 'country' | 'destinations'>): string {
	const place = stay.park_area?.trim() || stay.destinations?.name?.trim() || stay.region?.trim() || '';
	const country = stay.country?.trim() ?? '';
	return place && country && place.toLowerCase() !== country.toLowerCase() ? `${place}, ${country}` : place || country;
}

/**
 * "Western rim of the Ngorongoro Crater, Arusha Region": the place names a
 * stay has, most precise first, skipping any already said by an earlier one.
 */
export function placeLine(names: (string | null | undefined)[]): string {
	const kept: string[] = [];
	for (const name of names.map((value) => value?.trim() ?? '')) {
		if (name && !kept.some((other) => other.toLowerCase().includes(name.toLowerCase()))) kept.push(name);
	}
	return kept.join(', ');
}

export type StayPhoto = { kind: 'own'; src: string } | { kind: 'place'; src: string; place: string } | { kind: 'none' };

/** The property's own photos, card-sized first. */
export const ownStayPhoto = (stay: Pick<Stay, 'image_url_thumbnail' | 'hero_image_url_thumbnail' | 'image_url' | 'cover_image_url' | 'hero_image_url'>): string =>
	safeUrl(stay.image_url_thumbnail || stay.hero_image_url_thumbnail || stay.image_url || stay.cover_image_url || stay.hero_image_url, '');

/**
 * A photo that is genuinely of a place: its CMS image or the bundled landscape
 * of that park. destinationPhoto() rotates a spare wildlife shot by position
 * when it knows nothing about the place, so a photo that changes with the
 * position is a spare and is not used here.
 */
export function placePhoto(place: Pick<Destination, 'name' | 'slug'> & Partial<Destination>): string {
	const item: Destination = { id: place.id ?? place.slug, ...place };
	const first = destinationPhoto(item, 0);
	return first === destinationPhoto(item, 1) ? first : '';
}

/**
 * What a stay card or hero shows. A stay without photos of its own is never
 * shown with a photo pretending to be the property: it gets the landscape of
 * its park with the place named on it, or a branded placeholder.
 * `destination` is the full destination (with its CMS image) when the page has it.
 */
export function stayPhoto(stay: Stay, destination?: Destination | null): StayPhoto {
	const own = ownStayPhoto(stay);
	if (own && !own.startsWith('#')) return { kind: 'own', src: own };
	const candidates: { name: string; place: Pick<Destination, 'name' | 'slug'> & Partial<Destination> }[] = [];
	if (destination) candidates.push({ name: destination.name, place: destination });
	if (stay.destinations?.name) candidates.push({ name: stay.destinations.name, place: { name: stay.destinations.name, slug: stay.destinations.slug ?? '' } });
	if (stay.park_area?.trim()) candidates.push({ name: stay.park_area.trim(), place: { name: stay.park_area.trim(), slug: '' } });
	for (const candidate of candidates) {
		const src = placePhoto(candidate.place);
		if (src) return { kind: 'place', src, place: candidate.name };
	}
	return { kind: 'none' };
}

/** Listing filters from the query string; anything unknown is dropped rather than sent to the API. */
export type StayFilters = { search: string; destination_id: string; style: string; lodge_type: string; country: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const STAYS_PER_PAGE = 12;

export function stayFilters(params: URLSearchParams) {
	const destination = params.get('destination_id') ?? '';
	const style = (params.get('style') ?? '').toLowerCase();
	const filters: StayFilters = {
		search: (params.get('search') ?? '').trim().slice(0, 150),
		destination_id: UUID.test(destination) ? destination : '',
		style: isStyle(style) ? style : '',
		lodge_type: toStayType(params.get('lodge_type')) ?? '',
		country: toEastAfricaCountry(params.get('country')) ?? ''
	};
	const page = Math.min(1000, Math.max(1, Math.floor(Number(params.get('page')) || 1)));
	const query = new URLSearchParams({ status: 'published', limit: String(STAYS_PER_PAGE), page: String(page) });
	for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
	return { filters, page, query };
}

export const hasStayFilters = (filters: StayFilters) => Object.values(filters).some(Boolean);

/** /stays with some filters changed; empty values and page 1 drop out of the URL. */
export function staysHref(filters: Partial<StayFilters>, changes: Partial<StayFilters> & { page?: string } = {}, hash = '#stay-results'): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries({ ...filters, ...changes })) if (value && !(key === 'page' && value === '1')) params.set(key, value);
	const search = params.toString();
	return `/stays${search ? `?${search}` : ''}${hash}`;
}

/** "Children aged 6 and over"; empty when the property has not said. */
export function childrenPolicy(stay: Pick<StayDetail, 'children_allowed' | 'minimum_child_age'>): string {
	if (stay.children_allowed === false) return 'Adults only';
	const age = Math.floor(Number(stay.minimum_child_age));
	if (Number.isFinite(age) && age > 0) return `Children aged ${age} and over`;
	return stay.children_allowed === true ? 'Children welcome' : '';
}

const BEST_FOR_LABELS: Record<string, string> = {
	COUPLES: 'Couples',
	HONEYMOON: 'Honeymooners',
	FAMILIES: 'Families',
	GROUPS: 'Groups',
	SOLO_TRAVELERS: 'Solo travellers',
	SENIORS: 'Seniors',
	LUXURY_TRAVELERS: 'Luxury travellers',
	ADVENTURE_TRAVELERS: 'Adventure travellers',
	PHOTOGRAPHERS: 'Photographers'
};

/** Known "best for" codes as words; older free-text values are kept as typed. */
export const bestForLabels = (values?: string[] | null): string[] => [
	...new Set((values ?? []).map((value) => BEST_FOR_LABELS[String(value).trim().toUpperCase()] ?? String(value).trim()).filter(Boolean))
];

/** "3 nights"; empty when not set. */
export function nightsLabel(value: unknown): string {
	const nights = Math.floor(Number(value));
	return Number.isFinite(nights) && nights > 0 ? `${nights} ${nights === 1 ? 'night' : 'nights'}` : '';
}

/** Valid coordinates, or null (0,0 is an unset form rather than the Gulf of Guinea). */
export function stayCoordinates(stay: Pick<StayDetail, 'latitude' | 'longitude'>): { latitude: number; longitude: number } | null {
	if (stay.latitude == null || stay.longitude == null || stay.latitude === '' || stay.longitude === '') return null;
	const latitude = Number(stay.latitude);
	const longitude = Number(stay.longitude);
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
	return latitude === 0 && longitude === 0 ? null : { latitude, longitude };
}

export const mapUrl = (coordinates: { latitude: number; longitude: number }) => `https://www.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}`;

/** "From $450 per night", only when the property shows its rates publicly. */
export function nightlyRate(stay: Pick<Stay, 'show_rates_publicly' | 'price_per_night_from' | 'currency'>): string {
	if (stay.show_rates_publicly !== true) return '';
	const amount = Number(stay.price_per_night_from);
	return Number.isFinite(amount) && amount > 0 ? `From ${formatPrice(amount, stay.currency || 'USD')} per night` : '';
}

/** "Day 2", "Days 2–3", "Days 1, 4 & 6". */
export function dayList(days: number[]): string {
	const sorted = [...new Set(days.map(Number).filter((day) => Number.isInteger(day) && day > 0))].sort((a, b) => a - b);
	if (!sorted.length) return '';
	if (sorted.length === 1) return `Day ${sorted[0]}`;
	const runs: string[] = [];
	for (let start = 0; start < sorted.length; ) {
		let end = start;
		while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end += 1;
		runs.push(end > start ? `${sorted[start]}–${sorted[end]}` : String(sorted[start]));
		start = end + 1;
	}
	return `Days ${runs.length === 1 ? runs[0] : `${runs.slice(0, -1).join(', ')} & ${runs.at(-1)}`}`;
}

/** "Midrange · Day 1": the styles and days in which a tour sleeps at this stay. */
export function overnightNote(tour: Pick<StayTour, 'styles' | 'days'>): string {
	const styles = SAFARI_STYLES.map((style) => style.id).filter((id) => (tour.styles ?? []).includes(id));
	const names = styles.map(styleLabel);
	const styleText = names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names.at(-1)}` : (names[0] ?? '');
	return [styleText, dayList(tour.days ?? [])].filter(Boolean).join(' · ');
}

/** The tour categories of the tours that stay here, once each, in first-seen order. */
export function tourCategories(tours: Pick<StayTour, 'category_id' | 'tour_categories'>[]): { id: string; name: string }[] {
	const seen = new Map<string, string>();
	for (const tour of tours) {
		const id = tour.category_id?.trim();
		const name = tour.tour_categories?.name?.trim();
		if (id && name && UUID.test(id) && !seen.has(id)) seen.set(id, name);
	}
	return [...seen].map(([id, name]) => ({ id, name }));
}

/**
 * The stay page's photos: the gallery (cover first, then CMS order) plus the
 * hero and card images when they are not already in it. Captions and alt
 * text come from the CMS; missing alt text names the property.
 */
export function stayGallery(stay: Pick<StayDetail, 'name' | 'images' | 'hero_image_url' | 'image_url' | 'cover_image_url'>): { id: string; src: string; alt: string; caption: string }[] {
	const gallery = [...(stay.images ?? [])]
		.sort((a, b) => Number(Boolean(b.is_cover)) - Number(Boolean(a.is_cover)) || (a.sort_order ?? 0) - (b.sort_order ?? 0))
		.map((image) => ({ id: image.id, url: image.image_url, alt: image.alt_text?.trim() ?? '', caption: image.caption?.trim() ?? '' }));
	const extras = [stay.hero_image_url, stay.image_url, stay.cover_image_url].map((url, index) => ({ id: `own-${index}`, url: url ?? '', alt: '', caption: '' }));
	// A chosen hero leads; otherwise the gallery cover does.
	const ordered = stay.hero_image_url ? [extras[0], ...gallery, ...extras.slice(1)] : [...gallery, ...extras];
	const seen = new Set<string>();
	const photos: { id: string; src: string; alt: string; caption: string }[] = [];
	for (const photo of ordered) {
		const src = safeUrl(photo.url, '');
		if (!src || src.startsWith('#') || seen.has(src)) continue;
		seen.add(src);
		photos.push({ id: photo.id, src, alt: photo.alt || photo.caption || `${stay.name}: photo ${photos.length + 1}`, caption: photo.caption });
	}
	return photos;
}
