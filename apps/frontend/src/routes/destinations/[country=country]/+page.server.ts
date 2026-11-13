import { error } from '@sveltejs/kit';
import { apiGet } from '$lib/server/api';
import { destinationCatalogue } from '$lib/server/destinations';
import { allPublishedTours } from '$lib/server/tours';
import { allPublishedStays, cardStay } from '$lib/server/stays';
import { loadSiteChrome } from '$lib/server/site-chrome';
import { enquire } from '$lib/server/enquiry';
import { countryFromSlug, countryGroups, countrySlug, isHomeCountry } from '$lib/countries';
import { readQuery, regionsOf, safarisByPlace, sortsFor, toPlace } from '$lib/destination-explorer';
import { textContent } from '$lib/home-content';
import { recommended, toStayItem } from '$lib/stay-explorer';
import { tourFacts } from '$lib/tour-filter';
import type { Country } from '$lib/types/api';
import type { Actions, PageServerLoad } from './$types';

/** "A, B, C and 4 more places": the country's own places, nothing invented. */
function placeLine(names: string[], country: string): string {
	if (!names.length) return '';
	const shown = names.slice(0, 3);
	const rest = names.length - shown.length;
	const list = rest > 0 ? `${shown.join(', ')} and ${rest} more ${rest === 1 ? 'place' : 'places'}` : shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}` : shown[0];
	return `${list} in ${country}, each on the map below.`;
}

/**
 * A country's page, e.g. /destinations/kenya: its places (from the
 * destinations' own `country`), the safaris that visit them and the stays
 * there, with the CMS country record's intro, photo and facts when it has one.
 */
export const load: PageServerLoad = async ({ fetch, url, params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const name = countryFromSlug(params.country);
	if (!name) error(404, 'Country not found');
	const [chrome, catalogue, tours, stays, record] = await Promise.all([
		loadSiteChrome(fetch),
		destinationCatalogue(fetch).catch(() => null),
		allPublishedTours(fetch),
		allPublishedStays(fetch),
		apiGet<Country>(`countries/${encodeURIComponent(params.country)}`, fetch).catch(() => null)
	]);
	const here = (country: unknown) => (isHomeCountry(country) ? countrySlug('Tanzania') : countrySlug(String(country))) === params.country;
	const all = (catalogue ?? []).filter((d) => here(d.country));
	// A country with no places and no page of its own isn't on the site yet.
	if (catalogue && !all.length && !record) error(404, `${name} isn’t on our map yet`);

	const safaris = safarisByPlace(tours ?? []);
	// Recommended order, as on the destinations page: featured with a photo, then pictured, then the CMS order.
	const pictured = (d: (typeof all)[number]) => Boolean(d.main_image_url || d.image_url || d.banner_image_url);
	const rank = (d: (typeof all)[number]) => (d.is_featured && pictured(d) ? 0 : pictured(d) ? 1 : 2);
	const ordered = all.map((d, index) => ({ d, index })).sort((a, b) => rank(a.d) - rank(b.d) || a.index - b.index).map(({ d }) => d);
	const places = ordered.map((d) => toPlace(d, safaris));
	const ids = new Set(all.map((d) => d.id));

	const visiting = (tours ?? []).filter((tour, i) => tourFacts(tour, i).places.some((place) => ids.has(place.id)));
	const staying = (stays ?? []).filter((stay) => ids.has(stay.destination_id ?? '') || (stay.country ? countrySlug(stay.country) === params.country : false));
	const order = new Map(recommended(staying.map(toStayItem)).map((item, i) => [item.id, i]));
	const stayCards = [...staying].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).slice(0, 6).map(cardStay);
	// The places' own records, so a stay card can name its park.
	const placeById = new Map(all.map((d) => [d.id, { id: d.id, name: d.name, slug: d.slug }]));

	const cover = ordered.find(pictured) ?? null;
	const others = countryGroups(catalogue ?? []).filter((country) => country.slug !== params.country);
	return {
		chrome,
		siteOrigin: url.origin,
		unavailable: catalogue === null,
		country: {
			name,
			slug: params.country,
			intro: textContent(record?.intro_text ?? '') || placeLine(ordered.map((d) => d.name), name),
			hero: record?.hero_image_url || cover?.banner_image_url || cover?.main_image_url || cover?.image_url || '',
			heroAlt: record?.hero_image_url ? name : (cover?.name ?? ''),
			capital: record?.capital?.trim() || '',
			currency: record?.currency?.trim() || '',
			bestMonths: Array.isArray(record?.best_months) ? record.best_months : [],
			visa: textContent(record?.visa_info ?? ''),
			health: textContent(record?.health_info ?? ''),
			metaTitle: record?.meta_title?.trim() || record?.seo_title?.trim() || '',
			metaDescription: record?.meta_description?.trim() || '',
			ogImage: record?.og_image_url || ''
		},
		query: readQuery(url.searchParams),
		places,
		regions: regionsOf(places),
		sorts: sortsFor(places),
		tours: visiting.slice(0, 6),
		tourTotal: visiting.length,
		stays: stayCards,
		stayPlaces: Object.fromEntries(stayCards.filter((stay) => stay.destination_id && placeById.has(stay.destination_id)).map((stay) => [stay.id, placeById.get(stay.destination_id!)!])),
		stayTotal: staying.length,
		others
	};
};

export const actions: Actions = { enquire };
