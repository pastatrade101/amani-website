import { apiGet } from '$lib/server/api';
import { enquire } from '$lib/server/enquiry';
import { loadSiteChrome } from '$lib/server/site-chrome';
import { tourFilters } from '$lib/home-content';
import type { Paginated, Tour } from '$lib/types/api';
import type { FaqItem } from '$lib/components/faq/faq-list.svelte';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	// Same filters as the home search, so a search form can post to either page.
	const { filters, query } = tourFilters(url.searchParams);
	// A safari style's page is this list filtered to it, so its FAQs show here.
	// tourFilters has already checked the id is a uuid.
	const styleId = filters.category_id;
	const [chrome, tours, faqs] = await Promise.all([
		loadSiteChrome(fetch),
		apiGet<Paginated<Tour>>(`tours?${query}`, fetch).catch(() => null),
		styleId
			? apiGet<Paginated<FaqItem>>(`faqs?placement=category&target_id=${encodeURIComponent(styleId)}&limit=50`, fetch).then((r) => r.items).catch(() => [] as FaqItem[])
			: ([] as FaqItem[])
	]);
	return {
		faqs,
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
