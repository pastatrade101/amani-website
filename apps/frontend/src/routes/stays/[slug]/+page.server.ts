import { error } from '@sveltejs/kit';
import { apiGet, ApiError } from '$lib/server/api';
import { enquire } from '$lib/server/enquiry';
import { loadSiteChrome } from '$lib/server/site-chrome';
import type { Paginated, Stay, StayDetail } from '$lib/types/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	// The API only returns published, public properties to the public; the rest fails soft on its own.
	const [stay, chrome, navStays] = await Promise.all([
		apiGet<StayDetail>(`lodges/${encodeURIComponent(params.slug)}`, fetch).catch((reason: unknown) => (reason instanceof ApiError ? reason : new ApiError(503))),
		loadSiteChrome(fetch),
		apiGet<Paginated<Stay>>('lodges?status=published&is_featured=true&limit=4', fetch).then((result) => result.items).catch((): Stay[] => [])
	]);
	if (stay instanceof ApiError) {
		if (stay.status === 404 || stay.status === 400) error(404, 'We couldn’t find that place to stay. It may have been renamed or is no longer offered.');
		error(503, 'We can’t show this place to stay right now. Please try again in a few minutes.');
	}
	return { siteOrigin: url.origin, stay, chrome, navStays };
};

export const actions: Actions = {
	enquire
};
