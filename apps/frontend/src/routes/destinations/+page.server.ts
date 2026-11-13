import { destinationCatalogue } from '$lib/server/destinations';
import { loadSiteChrome } from '$lib/server/site-chrome';
import { allPublishedTours } from '$lib/server/tours';
import { combinations, readQuery, regionsOf, safarisByPlace, sortsFor, toPlace } from '$lib/destination-explorer';
import { enquire } from '$lib/server/enquiry';
import { countryGroups, isHomeCountry } from '$lib/countries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const [chrome, catalogue, tours] = await Promise.all([loadSiteChrome(fetch), destinationCatalogue(fetch).catch(() => null), allPublishedTours(fetch)]);
	const all = catalogue ?? [];
	const safaris = safarisByPlace(tours ?? []);
	// Recommended order: featured places, then places with their own photo, then the CMS order.
	const pictured = (d: (typeof all)[number]) => Boolean(d.main_image_url || d.image_url || d.banner_image_url);
	const rank = (d: (typeof all)[number]) => (d.is_featured && pictured(d) ? 0 : pictured(d) ? 1 : 2);
	const places = all.map((d, index) => ({ d, index })).sort((a, b) => rank(a.d) - rank(b.d) || a.index - b.index).map(({ d }) => toPlace(d, safaris));
	const regions = regionsOf(places);
	// Each country with its places: Tanzania described by its circuits, the others by their own areas.
	const countries = countryGroups(places).map((country) => ({
		...country,
		description: isHomeCountry(country.name) ? regions.filter((region) => region.country === 'Tanzania').map((region) => region.title).join(', ') : (regions.find((region) => region.key === country.slug)?.description ?? '')
	}));
	const featured = all.find((d) => d.is_featured && (d.banner_image_url || d.main_image_url || d.image_url)) ?? all.find((d) => d.banner_image_url || d.main_image_url || d.image_url) ?? null;
	return {
		chrome,
		siteOrigin: url.origin,
		unavailable: catalogue === null,
		query: readQuery(url.searchParams),
		places,
		regions,
		countries,
		sorts: sortsFor(places),
		routes: combinations(tours ?? [], places),
		featured: featured ? { name: featured.name, banner_image_url: featured.banner_image_url, main_image_url: featured.main_image_url, image_url: featured.image_url } : null
	};
};

export const actions: Actions = { enquire };
