import { apiGet } from '$lib/server/api';
import { mergeSections } from '$lib/home-content';
import { referenceActivities, referenceDestinations } from '$lib/data/reference';
import type { Activity, Category, Destination, HomepageSection, Paginated, Stay, Tour } from '$lib/types/api';

/**
 * What the site header and footer need on every public page: which homepage
 * sections are switched on (the menus follow them), the destinations and
 * activities in the menus, the tour categories, and a few tours and stays for
 * the Tours and Stays menus. Each part fails soft, so a slow API never blanks a page.
 */
export async function loadSiteChrome(fetch: typeof globalThis.fetch) {
	const [homepage, destinations, activities, categories, tours, stays] = await Promise.allSettled([
		apiGet<HomepageSection[]>('homepage', fetch),
		apiGet<Paginated<Destination>>('destinations?status=published&limit=100', fetch),
		apiGet<Paginated<Activity>>('activities?status=published&limit=12', fetch),
		apiGet<Paginated<Category>>('categories?status=published&limit=100', fetch),
		apiGet<Paginated<Tour>>('tours?status=published&limit=6', fetch),
		apiGet<Paginated<Stay>>('lodges?status=published&limit=4', fetch)
	]);
	const sections = mergeSections(homepage.status === 'fulfilled' && Array.isArray(homepage.value) ? homepage.value : []);
	return {
		sections,
		visible: sections.filter((section) => section.is_active !== false).map((section) => section.section_key),
		destinations: destinations.status === 'fulfilled' ? destinations.value.items.filter((item) => !item.country || item.country.toLowerCase() === 'tanzania') : referenceDestinations,
		destinationsAreReference: destinations.status === 'rejected',
		activities: activities.status === 'fulfilled' ? activities.value.items : referenceActivities,
		categories: categories.status === 'fulfilled' ? categories.value.items : [],
		navTours: tours.status === 'fulfilled' ? tours.value.items : [],
		navStays: stays.status === 'fulfilled' ? stays.value.items : []
	};
}

export type SiteChrome = Awaited<ReturnType<typeof loadSiteChrome>>;
