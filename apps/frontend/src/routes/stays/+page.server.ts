import { apiGet } from '$lib/server/api';
import { allPublishedStays, cardStay } from '$lib/server/stays';
import { destinationCatalogue } from '$lib/server/destinations';
import { enquire } from '$lib/server/enquiry';
import { loadSiteChrome } from '$lib/server/site-chrome';
import { readStayQuery, recommended, stayPlaces, toStayItem } from '$lib/stay-explorer';
import type { Paginated, Stay } from '$lib/types/api';
import type { Actions, PageServerLoad } from './$types';

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
