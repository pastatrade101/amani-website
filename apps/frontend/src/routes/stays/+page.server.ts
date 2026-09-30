import { apiGet } from '$lib/server/api';
import { enquire } from '$lib/server/enquiry';
import { loadSiteChrome } from '$lib/server/site-chrome';
import { hasStayFilters, stayFilters } from '$lib/stay-content';
import type { Paginated, Stay } from '$lib/types/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	// Only known filter values reach the API; the API itself only lists public stays.
	const { filters, page, query } = stayFilters(url.searchParams);
	const [chrome, stays, featured] = await Promise.all([
		loadSiteChrome(fetch),
		apiGet<Paginated<Stay>>(`lodges?${query}`, fetch).catch(() => null),
		// The Stays menu shows featured properties.
		apiGet<Paginated<Stay>>('lodges?status=published&is_featured=true&limit=4', fetch).then((result) => result.items).catch((): Stay[] => [])
	]);
	const browsing = !hasStayFilters(filters) && page === 1;
	return {
		siteOrigin: url.origin,
		...chrome,
		stays: stays?.items ?? [],
		stayTotal: stays?.pagination.total ?? 0,
		page,
		pageCount: stays?.pagination.totalPages ?? 1,
		staysUnavailable: stays === null,
		filters,
		// Before anything is featured, the menu shows the first stays instead.
		navStays: featured.length ? featured : browsing ? (stays?.items ?? []).slice(0, 4) : []
	};
};

export const actions: Actions = {
	enquire
};
