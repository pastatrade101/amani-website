import { guideSections } from './homepage-guides';
import { formatPrice } from './safari-pricing.js';
import type { Destination, HomepageSection, Tour } from './types/api.js';

export const defaultSections: HomepageSection[] = [
	...guideSections,
	{ section_key: 'hero', title: 'Tanzania Safari Tours', subtitle: 'DISCOVER. EXPLORE. BELONG.', content: 'Follow the wild. Find your quiet. Discover Tanzania on a private journey from the Serengeti plains to the shores of Zanzibar — thoughtfully planned around you.', button_text: 'Plan My Safari', button_url: '#request-quote', sort_order: 0 },
	{ section_key: 'why_us', title: 'More than a safari. A connection to Tanzania.', subtitle: 'THE KEY2AFRICA APPROACH', content: 'The best journeys feel personal. We bring local insight and thoughtful planning to the moments you’ve been dreaming of, and the ones you haven’t imagined yet.', button_text: 'Create my Tanzania journey', button_url: '#request-quote', sort_order: 5 },
	{ section_key: 'experiences', title: 'Moments that become your favourite stories.', subtitle: 'EXPERIENCE SOMETHING EXTRAORDINARY', content: 'Feel the thrill of the wild, the stillness of the plains and the freedom to explore your way.', sort_order: 10 },
	{ section_key: 'destinations', title: 'Where Will Your Tanzania Safari Take You?', subtitle: 'EXPLORE TANZANIA', content: 'Discover the iconic parks, landscapes and wildlife areas that make Tanzania an unforgettable safari destination.', sort_order: 20 },
	{ section_key: 'safari_packages', title: 'Find a Safari That Feels Like You', subtitle: 'YOUR JOURNEY STARTS HERE', content: 'Explore our published itineraries, then make them your own with our local team.', sort_order: 30 },
	{ section_key: 'when_to_go', title: 'When Should You Go?', subtitle: 'BEST TIME TO VISIT', content: 'Every season tells a different story. Choose the landscapes, wildlife and pace that speak to you.', sort_order: 40 },
	{ section_key: 'how_it_works', title: 'Your dream safari, thoughtfully put together.', subtitle: 'FROM A FIRST IDEA TO A GREAT ADVENTURE', content: 'You bring the curiosity. We help with the details. Together, we’ll turn your ideas into a journey that feels right for you.', sort_order: 43 },
	{ section_key: 'faq', title: 'A few things you might be wondering.', subtitle: 'GOOD TO KNOW', content: 'A little clarity before your next adventure.', sort_order: 46 },
	{ section_key: 'enquiry', title: 'Let’s Plan Your Tanzania Story', subtitle: 'MADE AROUND YOU', content: 'Tell us a little about your dream trip. Our team will help turn your ideas into a safari designed around you.', sort_order: 50 }
];

/** Longest text that still reads as the small uppercase label above a heading. */
export const EYEBROW_MAX = 40;

const trimmed = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * The homepage blocks render `subtitle` as the small label above the heading and
 * `content` as the paragraph under it. The CMS stores them the other way: the
 * label is `extra_data.eyebrow` and the paragraph is `subtitle` (or `content`).
 * Map one onto the other here, once. A label longer than EYEBROW_MAX is not a
 * label, so the default one is kept rather than printing a paragraph in caps.
 * Disabled CMS markers must never be replaced with fallback copy.
 */
export function mergeSections(rows: HomepageSection[]): HomepageSection[] {
	return defaultSections.map((fallback) => {
		const row = rows.find((item) => item.section_key === fallback.section_key);
		if (row?.is_active === false) return { section_key: fallback.section_key, is_active: false, sort_order: row.sort_order ?? fallback.sort_order };
		const filled = Object.fromEntries(Object.entries(row ?? {}).filter(([, value]) => value !== null && value !== undefined));
		const eyebrow = trimmed(row?.extra_data?.eyebrow);
		const paragraph = trimmed(row?.subtitle) || trimmed(row?.content);
		return {
			...fallback,
			is_active: true,
			...filled,
			subtitle: eyebrow && eyebrow.length <= EYEBROW_MAX ? eyebrow : fallback.subtitle,
			content: paragraph || fallback.content
		};
	}).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export function safeUrl(value: string | null | undefined, fallback = '#request-quote'): string {
	if (!value || value.includes('\\')) return fallback;
	if ((value.startsWith('/') && !value.startsWith('//')) || value.startsWith('#')) return value;
	try {
		const url = new URL(value);
		return ['https:', 'http:'].includes(url.protocol) ? url.href : fallback;
	} catch { return fallback; }
}

export const textContent = (value?: string | null): string => (value ?? '')
	.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
	.replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

/**
 * Bundled photos for well-known places, used only while a destination has no
 * CMS image. Without this every image-less card showed the same hero shot.
 */
const PLACE_PHOTOS: [RegExp, string][] = [
	[/serengeti/, '/images/serengeti.jpg'],
	[/ngorongoro/, '/images/ngorongoro.jpg'],
	[/tarangire/, '/images/tarangire.jpg'],
	[/manyara/, '/images/lake-manyara.jpg'],
	[/zanzibar|stone town|pemba|mafia/, '/images/experience-zanzibar.jpg'],
	[/nyerere|selous|rufiji/, '/images/itinerary-game-drive.jpg'],
	[/ruaha/, '/images/itinerary-lions.jpg'],
	[/mikumi/, '/images/itinerary-elephants.jpg'],
	[/arusha|kilimanjaro/, '/images/itinerary-rhino.jpg']
];
/** Rotated by position for anything unmatched, so neighbouring cards differ. */
const SPARE_PHOTOS = ['/images/itinerary-elephants.jpg', '/images/itinerary-lions.jpg', '/images/itinerary-baobab-sunset.jpg', '/images/itinerary-rhino.jpg', '/images/tanzania-hero-2.jpg', '/images/itinerary-crater.jpg'];

/** The CMS image when there is one; otherwise a photo of the place, or a rotating spare. */
export function destinationPhoto(item: Destination, index = 0): string {
	const spare = SPARE_PHOTOS[index % SPARE_PHOTOS.length];
	const own = item.main_image_url_thumbnail || item.image_url_thumbnail || item.main_image_url || item.image_url || item.banner_image_url;
	if (own) return safeUrl(own, spare);
	const place = `${item.name} ${item.slug} ${item.region ?? ''}`.toLowerCase();
	return PLACE_PHOTOS.find(([pattern]) => pattern.test(place))?.[1] ?? spare;
}

type Place = { name: string; slug: string };

/** A tour's places in route order; older tours only have their primary destination. */
export function tourRoute(tour: Pick<Tour, 'tour_destinations' | 'destinations'>): Place[] {
	const linked = [...(tour.tour_destinations ?? [])]
		.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
		.map((link) => link.destinations)
		.filter((place): place is NonNullable<typeof place> => Boolean(place && String(place.name ?? '').trim()));
	const primary = tour.destinations;
	const places: Place[] = linked.length ? linked : primary && String(primary.name ?? '').trim() ? [primary] : [];
	return places.filter((place, index) => places.findIndex((other) => other.name === place.name) === index);
}

/** "Serengeti National Park" reads as "Serengeti" in a one-line route. */
export const shortPlaceName = (name: string) =>
	name.replace(/\s+(national park|conservation area|game reserve|marine park|nature reserve|forest reserve)$/i, '').trim() || name.trim();

/** Route stops for a card: the first `max` places, and how many more there are. */
export function routeStops(tour: Pick<Tour, 'tour_destinations' | 'destinations'>, max = 3) {
	const names = tourRoute(tour).map((place) => shortPlaceName(place.name));
	return { stops: names.slice(0, max), more: Math.max(0, names.length - max) };
}

/** "6 days · 5 nights"; nights only when the tour records them. Empty for a missing duration. */
export function tourDuration(days: unknown, nights?: unknown): string {
	const dayCount = Math.floor(Number(days));
	if (!Number.isFinite(dayCount) || dayCount <= 0) return '';
	const nightCount = Math.floor(Number(nights));
	const count = (value: number, word: string) => `${value} ${word}${value === 1 ? '' : 's'}`;
	return Number.isFinite(nightCount) && nightCount > 0 ?`${count(dayCount, 'day')} · ${count(nightCount, 'night')}` : count(dayCount, 'day');
}

/** "6 Days / 5 Nights", the card's duration row. Empty for a missing duration. */
export function tourDurationTitle(days: unknown, nights?: unknown): string {
	const dayCount = Math.floor(Number(days));
	if (!Number.isFinite(dayCount) || dayCount <= 0) return '';
	const nightCount = Math.floor(Number(nights));
	const count = (value: number, word: string) => `${value} ${word}${value === 1 ? '' : 's'}`;
	return Number.isFinite(nightCount) && nightCount > 0 ? `${count(dayCount, 'Day')} / ${count(nightCount, 'Night')}` : count(dayCount, 'Day');
}

/** "Tarangire, Serengeti & Ngorongoro" — a tour's route as a card subtitle, with "+N more" past `max`. */
export function routeSentence(tour: Pick<Tour, 'tour_destinations' | 'destinations'>, max = 4): string {
	const { stops, more } = routeStops(tour, max);
	if (!stops.length) return '';
	if (more) return `${stops.join(', ')} +${more} more`;
	return stops.length === 1 ? stops[0] : `${stops.slice(0, -1).join(', ')} & ${stops[stops.length - 1]}`;
}

/**
 * The per-person "from" price a tour advertises: the lowest style price when
 * the tour has priced styles, else its own from-price. Null means on request.
 */
export function tourFromPrice(tour: Pick<Tour, 'pricing_summary' | 'price_from' | 'currency'>): string | null {
	const summary = tour.pricing_summary;
	const styled = Number(summary?.from);
	if (summary?.from != null && Number.isFinite(styled) && styled > 0) return formatPrice(styled, summary.currency || tour.currency || 'USD');
	const own = Number(tour.price_from);
	return Number.isFinite(own) && own > 0 ? formatPrice(own, tour.currency || 'USD') : null;
}

/**
 * One photo per tour in a list: the tour's own image, else a bundled photo of
 * a place on its route, else a spare. Image-less tours in the same list never
 * share a bundled photo while an unused one is left.
 */
export function tourPhotos(tours: Pick<Tour, 'main_image_url' | 'main_image_url_thumbnail' | 'banner_image_url' | 'tour_destinations' | 'destinations'>[]): string[] {
	const used = new Set<string>();
	return tours.map((tour, index) => {
		const spare = SPARE_PHOTOS[index % SPARE_PHOTOS.length];
		const own = tour.main_image_url_thumbnail || tour.main_image_url || tour.banner_image_url;
		if (own) return safeUrl(own, spare);
		const places = tourRoute(tour)
			.map((place) => PLACE_PHOTOS.find(([pattern]) => pattern.test(`${place.name} ${place.slug}`.toLowerCase()))?.[1])
			.filter((photo): photo is string => Boolean(photo));
		const candidates = [...new Set([...places, ...SPARE_PHOTOS])];
		const photo = candidates.find((candidate) => !used.has(candidate)) ?? candidates[index % candidates.length];
		used.add(photo);
		return photo;
	});
}

export function circuitFor(destination: Destination): string {
	const location = `${destination.region ?? ''} ${destination.name} ${destination.slug}`.toLowerCase();
	// Southern/western Serengeti are areas within the Northern Circuit.
	if (/serengeti|ndutu/.test(location)) return 'northern';
	if (/zanzibar|pemba|mafia|coast|stone town|saadani|dar es salaam/.test(location)) return 'coast';
	if (/southern|ruaha|nyerere|mikumi|udzungwa|rufiji|iringa|selous/.test(location)) return 'southern';
	if (/western|mahale|katavi|tanganyika|gombe|rubondo|kigoma/.test(location)) return 'western';
	if (/northern|serengeti|manyara|ngorongoro|tarangire|arusha|kilimanjaro|migration|natron/.test(location)) return 'northern';
	return 'other';
}

export function tourFilters(params: URLSearchParams) {
	const search = (params.get('search') ?? '').trim().slice(0, 150);
	const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	const destination = params.get('destination_id') ?? '';
	const category = params.get('category_id') ?? '';
	const filters = { search, destination_id: uuid.test(destination) ? destination : '', category_id: uuid.test(category) ? category : '' };
	const page = Math.min(1000, Math.max(1, Math.floor(Number(params.get('page')) || 1)));
	const query = new URLSearchParams({ status: 'published', limit: '12', page: String(page) });
	for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
	return { filters, query };
}
