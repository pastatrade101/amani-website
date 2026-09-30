import { error, redirect } from '@sveltejs/kit';
import { apiGet, ApiError } from '$lib/server/api';
import { enquire } from '$lib/server/enquiry';
import { loadSiteChrome } from '$lib/server/site-chrome';
import type { TourDetail } from '$lib/types/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params, url, request, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	// The API only returns published tours to the public; header/footer data fails soft on its own.
	const [tour, chrome] = await Promise.all([
		apiGet<TourDetail>(`tours/${encodeURIComponent(params.slug)}`, fetch).catch((reason: unknown) => (reason instanceof ApiError ? reason : new ApiError(503))),
		loadSiteChrome(fetch)
	]);
	if (tour instanceof ApiError) {
		if (tour.status === 404 || tour.status === 400) error(404, 'We couldn’t find that safari. It may have been renamed or is no longer offered.');
		error(503, 'We can’t show this safari right now. Please try again in a few minutes.');
	}
	// A tour can also be opened by its id; send people to the address worth sharing.
	// GET only, so a form posted to the old address is never sent twice.
	if (request.method === 'GET' && tour.slug && tour.slug !== params.slug) redirect(301, `/tours/${encodeURIComponent(tour.slug)}${url.search}`);
	return { siteOrigin: url.origin, tour, chrome };
};

export const actions: Actions = {
	enquire
};
