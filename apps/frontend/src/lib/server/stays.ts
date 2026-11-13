import { apiGet } from './api';
import type { Paginated, Stay } from '$lib/types/api';

/** The API's page cap is 100; ten pages is far beyond any real collection. */
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

/** Every published stay, so the page can filter, count and map them all. Null when the API is down. */
export async function allPublishedStays(fetch: typeof globalThis.fetch): Promise<Stay[] | null> {
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
export const cardStay = (stay: Stay): Stay => Object.fromEntries(CARD_FIELDS.filter((key) => stay[key] !== undefined).map((key) => [key, stay[key]])) as Stay;
