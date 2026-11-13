import { apiGet } from '$lib/server/api';
import { destinationCatalogue } from '$lib/server/destinations';
import { enquire } from '$lib/server/enquiry';
import { loadSiteChrome } from '$lib/server/site-chrome';
import { readStayQuery, recommended, stayPlaces, toStayItem } from '$lib/stay-explorer';
import type { Paginated, Stay } from '$lib/types/api';
import type { Actions, PageServerLoad } from './$types';

/** The API's page cap is 100; ten pages is far beyond any real collection. */
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

/** Every published stay, so the page can filter, count and map them all. Null when the API is down. */
async function allPublishedStays(fetch: typeof globalThis.fetch): Promise<Stay[] | null> {
	const first = await apiGet<Paginated<Stay>>(`lodges?status=published&limit=${PAGE_SIZE}&page=1`, fetch).catch(() => null);
	if (!first) return null;
	const pages = Math.min(MAX_PAGES, first.pagination.totalPages || 1);
	const rest = await Promise.all(
		Array.from({ length: pages - 1 }, (_, i) => apiGet<Paginated<Stay>>(`lodges?status=published&limit=${PAGE_SIZE}&page=${i + 2}`, fetch).then((page) => page.items).catch(() => [] as Stay[]))
	);
	const seen = new Set<string>();
	return [...first.items, ...rest.flat()].filter((stay) => !seen.has(stay.id) && Boolean(seen.add(stay.id)));
}

// Only what a stay card shows travels to the browser, not each stay's full write-up.
const CARD_FIELDS = ['id', 'name', 'slug', 'lodge_type', 'accommodation_level', 'style', 'destination_id', 'destinations', 'country', 'region', 'park_area', 'short_description', 'hero_image_url', 'image_url', 'hero_image_url_thumbnail', 'image_url_thumbnail', 'cover_image_url', 'image_url_variants', 'hero_image_url_variants', 'is_featured', 'tour_count', 'recommended_nights', 'best_for'] as const;
const cardStay = (stay: Stay): Stay => Object.fromEntries(CARD_FIELDS.filter((key) => stay[key] !== undefined).map((key) => [key, stay[key]])) as Stay;

export const load: PageServerLoad = async ({ fetch, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const [chrome, all, catalogue, featured] = await Promise.all([
		loadSiteChrome(fetch),
		allPublishedStays(fetch),
		destinationCatalogue(fetch).catch(() => []),
		// The Stays menu shows featured properties.
		apiGet<Paginated<Stay>>('lodges?status=published&is_featured=true&limit=4', fetch).then((result) => result.items).catch((): Stay[] => [])
	]);
	const items = all ?? [];
	// Recommended order: featured, then stays with their own photo, then those on safaris.
	const order = new Map(recommended(items.map(toStayItem)).map((item, i) => [item.id, i]));
	const stays = [...items].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map(cardStay);
	const places = stayPlaces(stays.map(toStayItem), catalogue);
	const inUse = new Set(places.map((place) => place.id));
	return {
		siteOrigin: url.origin,
		...chrome,
		stays,
		staysUnavailable: all === null,
		query: readStayQuery(url.searchParams),
		places,
		// The places' own photos stand in for stays without photos, with the place named.
		placeDetails: catalogue.filter((d) => inUse.has(d.id)).map((d) => ({ id: d.id, name: d.name, slug: d.slug, image_url: d.image_url, main_image_url: d.main_image_url, banner_image_url: d.banner_image_url })),
		// Before anything is featured, the menu shows the first stays instead.
		navStays: featured.length ? featured : stays.slice(0, 4)
	};
};

export const actions: Actions = { enquire };
