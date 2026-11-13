/**
 * The destinations page's explorer: every published place, grouped by safari
 * region, ranked by the CMS's own 1–10 scores, joined to the safaris that visit
 * it, and pinned on a map at the CMS coordinates. Plain TS, so it runs in node
 * tests and on the server; nothing here is invented when a field is empty.
 */
import { circuitFor, safeUrl, textContent, tourPhotos } from './home-content';
import { tourFacts, tourPriceValue } from './tour-filter';
import { TANZANIA } from './safari-page';
import type { DestinationDetail } from './destination-content';
import type { Tour } from './types/api';

export type RegionKey = 'northern' | 'southern' | 'western' | 'coast' | 'other';
export type TraitKey = 'wildlife' | 'photography' | 'family' | 'adventure' | 'luxury';
export type SortKey = 'recommended' | TraitKey;

const REGION_ORDER: RegionKey[] = ['northern', 'southern', 'western', 'coast', 'other'];
const REGION_COPY: Record<RegionKey, { title: string; description: string }> = {
	northern: { title: 'Northern circuit', description: 'The classic Tanzania safari' },
	southern: { title: 'Southern circuit', description: 'Wild, remote and unhurried' },
	western: { title: 'Western circuit', description: 'Forests, lakes and wild horizons' },
	coast: { title: 'Zanzibar & coast', description: 'Your Indian Ocean escape' },
	other: { title: 'More places', description: '' }
};

/** The same names the place pages use for the scores. */
export const TRAITS: { key: TraitKey; label: string; best: string; field: keyof DestinationDetail }[] = [
	{ key: 'wildlife', label: 'Wildlife', best: 'wildlife', field: 'score_wildlife' },
	{ key: 'photography', label: 'Photography', best: 'photography', field: 'score_photography' },
	{ key: 'family', label: 'Family travel', best: 'families', field: 'score_family' },
	{ key: 'adventure', label: 'Adventure', best: 'adventure', field: 'score_adventure' },
	{ key: 'luxury', label: 'Comfort & luxury', best: 'comfort', field: 'score_luxury' }
];

export type PlaceSafaris = { count: number; from: { amount: number; currency: string } | null };

export type Place = {
	id: string;
	slug: string;
	name: string;
	region: RegionKey;
	/** The CMS region or location line, e.g. "Northern Circuit" or "Kilimanjaro Region". */
	area: string;
	country: string;
	summary: string;
	/** Own photos only, thumbnail first. Empty when the place has none yet. */
	photos: string[];
	lat: number | null;
	lng: number | null;
	featured: boolean;
	scores: Partial<Record<TraitKey, number>>;
	safaris: PlaceSafaris;
};

export type Region = { key: RegionKey; title: string; description: string; count: number };

export type Combination = { id: string; slug: string; title: string; days: number; stops: { name: string; slug: string | null }[]; from: { amount: number; currency: string } | null; photo: string };

const score = (value: unknown): number | null => {
	const n = Number(value);
	return value !== null && value !== undefined && value !== '' && Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
};
const coordinate = (value: unknown, limit: number): number | null => {
	const n = Number(value);
	return value !== null && value !== undefined && value !== '' && Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
};

/** How many published safaris visit each place, and the lowest dollar price among them. */
export function safarisByPlace(tours: Tour[]): Map<string, PlaceSafaris> {
	const out = new Map<string, PlaceSafaris>();
	tours.forEach((tour, index) => {
		const price = tourPriceValue(tour);
		for (const place of tourFacts(tour, index).places) {
			const entry = out.get(place.id) ?? { count: 0, from: null };
			entry.count += 1;
			// Only compare like with like: a price in another currency never undercuts a dollar one.
			if (price && (!entry.from || (price.currency === entry.from.currency && price.amount < entry.from.amount))) entry.from = price;
			out.set(place.id, entry);
		}
	});
	return out;
}

export function toPlace(d: DestinationDetail, safaris: Map<string, PlaceSafaris>): Place {
	const scores: Partial<Record<TraitKey, number>> = {};
	for (const trait of TRAITS) {
		const value = score(d[trait.field]);
		if (value !== null) scores[trait.key] = value;
	}
	const photos = [d.main_image_url_thumbnail, d.image_url_thumbnail, d.main_image_url, d.image_url, d.banner_image_url].map((url) => safeUrl(url, '')).filter(Boolean);
	return {
		id: d.id,
		slug: d.slug,
		name: d.name,
		region: circuitFor(d) as RegionKey,
		area: textContent(d.region || d.location || ''),
		country: d.country || '',
		summary: textContent(d.short_description || d.description || ''),
		photos: [...new Set(photos)],
		lat: coordinate(d.latitude, 90),
		lng: coordinate(d.longitude, 180),
		featured: Boolean(d.is_featured),
		scores,
		safaris: safaris.get(d.id) ?? { count: 0, from: null }
	};
}

/**
 * Regions that have places, in map order. "More places" takes the country's
 * name when every place in it is in one other country (e.g. Kenya).
 */
export function regionsOf(places: Place[]): Region[] {
	return REGION_ORDER.flatMap((key) => {
		const inside = places.filter((place) => place.region === key);
		if (!inside.length) return [];
		const copy = { ...REGION_COPY[key] };
		const countries = [...new Set(inside.map((place) => place.country).filter(Boolean))];
		if (key === 'other' && countries.length === 1 && countries[0].toLowerCase() !== 'tanzania') copy.title = countries[0];
		return [{ key, ...copy, count: inside.length }];
	});
}

/** The two strongest scores of 8 or more, e.g. "Best for wildlife and photography". */
export function bestFor(place: Pick<Place, 'scores'>): string {
	const top = TRAITS.map((trait) => ({ trait, value: place.scores[trait.key] ?? 0 }))
		.filter((item) => item.value >= 8)
		.sort((a, b) => b.value - a.value)
		.slice(0, 2)
		.map((item) => item.trait.best);
	return top.length ? `Best for ${top.join(' and ')}` : '';
}

/** Sorts that more than one place can answer. */
export function sortsFor(places: Place[]): SortKey[] {
	return ['recommended', ...TRAITS.filter((trait) => places.filter((place) => place.scores[trait.key] !== undefined).length > 1).map((trait) => trait.key)];
}

export type ExplorerQuery = { search: string; region: RegionKey | ''; country: string; sort: SortKey };

export const isRegion = (value: string): value is RegionKey => (REGION_ORDER as string[]).includes(value);
export const isSort = (value: string): value is SortKey => value === 'recommended' || TRAITS.some((trait) => trait.key === value);

export function readQuery(params: URLSearchParams): ExplorerQuery {
	const region = params.get('circuit') ?? '';
	const sort = params.get('sort') ?? '';
	return {
		search: (params.get('search') ?? '').trim().slice(0, 120),
		region: isRegion(region) ? region : '',
		country: (params.get('country') ?? '').slice(0, 100),
		sort: isSort(sort) ? sort : 'recommended'
	};
}

export function queryString(query: ExplorerQuery): string {
	const params = new URLSearchParams();
	if (query.search) params.set('search', query.search);
	if (query.country) params.set('country', query.country);
	if (query.region) params.set('circuit', query.region);
	if (query.sort !== 'recommended') params.set('sort', query.sort);
	const qs = params.toString();
	return qs ? `?${qs}` : '';
}

/** Places matching the query, in its order. "Recommended" keeps the page's own order. */
export function explore(places: Place[], query: ExplorerQuery): Place[] {
	const words = query.search.toLowerCase().split(/\s+/).filter(Boolean);
	const shown = places.filter((place) => {
		if (query.region && place.region !== query.region) return false;
		if (query.country && place.country !== query.country) return false;
		const text = `${place.name} ${place.area} ${place.country} ${place.summary}`.toLowerCase();
		return words.every((word) => text.includes(word));
	});
	if (query.sort === 'recommended') return shown;
	const key = query.sort;
	return shown
		.map((place, index) => ({ place, index }))
		.sort((a, b) => (b.place.scores[key] ?? -1) - (a.place.scores[key] ?? -1) || a.index - b.index)
		.map((item) => item.place);
}

/**
 * Real ways to combine places: published safaris that visit three or more,
 * featured first, then the longest routes. Stops link when they are published places.
 */
export function combinations(tours: Tour[], places: Place[], limit = 3): Combination[] {
	const slugById = new Map(places.map((place) => [place.id, place.slug]));
	const photos = tourPhotos(tours);
	return tours
		.map((tour, index) => ({ tour, index, facts: tourFacts(tour, index), photo: photos[index] }))
		.filter((item) => item.facts.places.length >= 3 && item.tour.slug)
		.sort((a, b) => Number(Boolean(b.tour.is_featured)) - Number(Boolean(a.tour.is_featured)) || b.facts.places.length - a.facts.places.length || a.index - b.index)
		.slice(0, limit)
		.map(({ tour, facts, photo }) => ({
			id: tour.id,
			slug: tour.slug,
			title: tour.title,
			days: facts.days,
			stops: facts.places.map((place) => ({ name: place.name, slug: slugById.get(place.id) ?? null })),
			from: tourPriceValue(tour),
			photo
		}));
}

/**
 * A small locator map: Tanzania's outline (Natural Earth) with one place
 * marked and the others as faint dots, for a place that has no photo yet.
 */
export function locator(target: { lat: number; lng: number }, others: { lat: number; lng: number }[], width = 160, height = 120) {
	const mercator = (lng: number, lat: number): [number, number] => [(lng * Math.PI) / 180, -Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
	const outline = TANZANIA.map(([lng, lat]) => mercator(lng, lat));
	const all = [...outline, mercator(target.lng, target.lat)];
	const xs = all.map((p) => p[0]);
	const ys = all.map((p) => p[1]);
	const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
	const pad = 10;
	const scale = Math.min((width - pad * 2) / (maxX - minX), (height - pad * 2) / (maxY - minY));
	const offsetX = (width - (maxX - minX) * scale) / 2;
	const offsetY = (height - (maxY - minY) * scale) / 2;
	const place = ([x, y]: [number, number]): [number, number] => [Math.round((offsetX + (x - minX) * scale) * 10) / 10, Math.round((offsetY + (y - minY) * scale) * 10) / 10];
	const [x, y] = place(mercator(target.lng, target.lat));
	return {
		outline: `M${outline.map(place).map((p) => p.join(',')).join('L')}Z`,
		x,
		y,
		dots: others.filter((o) => o.lat !== target.lat || o.lng !== target.lng).map((o) => place(mercator(o.lng, o.lat))).filter(([dx, dy]) => dx >= 0 && dx <= width && dy >= 0 && dy <= height)
	};
}
