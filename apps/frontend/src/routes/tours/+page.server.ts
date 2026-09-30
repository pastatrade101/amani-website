import { apiGet } from '$lib/server/api';
import { enquire } from '$lib/server/enquiry';
import { loadSiteChrome } from '$lib/server/site-chrome';
import { tourFilters } from '$lib/home-content';
import type { Paginated, Tour } from '$lib/types/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	// Same filters as the home search, so a search form can post to either page.
	const { filters, query } = tourFilters(url.searchParams);
	const [chrome, tours] = await Promise.all([
		loadSiteChrome(fetch),
		apiGet<Paginated<Tour>>(`tours?${query}`, fetch).catch(() => null)
	]);
	return {
		siteOrigin: url.origin,
		...chrome,
		tours: tours?.items ?? [],
		tourTotal: tours?.pagination.total ?? 0,
		page: Number(query.get('page')),
		pageCount: tours?.pagination.totalPages ?? 1,
		toursUnavailable: tours === null,
		filters
	};
};

export const actions: Actions = {
	enquire
};
