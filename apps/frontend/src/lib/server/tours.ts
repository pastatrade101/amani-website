import { apiGet } from './api';
import type { Paginated, Tour } from '$lib/types/api';

/** The API's page cap is 100; ten pages is far beyond any real catalogue. */
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

/**
 * Every published tour, so the page can filter and count on any field. Null
 * when the API is down; a later page failing keeps the tours already loaded.
 */
export async function allPublishedTours(fetch: typeof globalThis.fetch): Promise<Tour[] | null> {
	const first = await apiGet<Paginated<Tour>>(`tours?status=published&limit=${PAGE_SIZE}&page=1`, fetch).catch(() => null);
	if (!first) return null;
	const pages = Math.min(MAX_PAGES, first.pagination.totalPages || 1);
	const rest = await Promise.all(
		Array.from({ length: pages - 1 }, (_, i) => apiGet<Paginated<Tour>>(`tours?status=published&limit=${PAGE_SIZE}&page=${i + 2}`, fetch).then((page) => page.items).catch(() => [] as Tour[]))
	);
	const seen = new Set<string>();
	return [...first.items, ...rest.flat()].filter((tour) => !seen.has(tour.id) && Boolean(seen.add(tour.id)));
}
