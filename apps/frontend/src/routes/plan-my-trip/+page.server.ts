import { apiGet } from '$lib/server/api';
import { loadSiteChrome } from '$lib/server/site-chrome';
import { planTrip } from '$lib/server/plan-trip';
import { fallbackSeasons, type Season } from '$lib/seasons';
import { MONTH_NAMES, PARTIES, type PartyId, type PlanContext } from '$lib/planner/options';
import { plannerStay, plannerTour, tripTypes, type PlannerSeason } from '$lib/planner/planner';
import type { Paginated, Stay, Tour } from '$lib/types/api';
import type { Actions, PageServerLoad } from './$types';

/** What a link to the planner may prefill. Values that match nothing published are dropped. */
export type PlanPrefill = {
	context: PlanContext | null;
	type: string;
	priority: string;
	party: PartyId | '';
	year: number | null;
	month: number | null;
	date: string;
	from: string;
};

/**
 * The planner suggests trips as the visitor answers, so it loads the published
 * catalogue up front. Every part fails soft: without it the planner still
 * collects the request, it just has less to suggest.
 */
export const load: PageServerLoad = async ({ fetch, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const [chrome, tours, stays, seasons] = await Promise.all([
		loadSiteChrome(fetch),
		apiGet<Paginated<Tour>>('tours?status=published&limit=100', fetch).then((result) => result.items.map(plannerTour)).catch(() => []),
		apiGet<Paginated<Stay>>('lodges?status=published&limit=100', fetch).then((result) => result.items.map(plannerStay)).catch(() => []),
		// Built-in seasons only when the API is unreachable, as on the home page.
		apiGet<Paginated<Season>>('seasons?status=published&limit=24', fetch).then((result) => result.items).catch(() => fallbackSeasons)
	]);
	const types = tripTypes(chrome.categories, tours);
	// Priorities are the published activities (the built-in list when the API is down).
	const priorities = chrome.activities.map((activity) => ({ slug: activity.slug, name: activity.name }));
	const query = url.searchParams;
	const slug = (key: string) => (query.get(key) ?? '').trim().toLowerCase();

	// Where the visitor came from: a tour, a stay or a destination, looked up by slug.
	const tour = tours.find((item) => item.slug === slug('tour'));
	const stay = stays.find((item) => item.slug === slug('stay'));
	const destination = chrome.destinationsAreReference ? undefined : chrome.destinations.find((item) => item.slug === slug('destination'));
	const context: PlanContext | null = tour
		? { kind: 'tour', slug: tour.slug, name: tour.title }
		: stay
			? { kind: 'stay', slug: stay.slug, name: stay.name }
			: destination
				? { kind: 'destination', slug: destination.slug, name: destination.name }
				: null;

	// A month as YYYY-MM or a month name; a month already past this year means next year's.
	const now = new Date();
	let year: number | null = null;
	let month: number | null = null;
	const rawMonth = slug('month');
	const iso = rawMonth.match(/^(\d{4})-(\d{2})$/);
	if (iso && Number(iso[2]) >= 1 && Number(iso[2]) <= 12) {
		year = Number(iso[1]);
		month = Number(iso[2]) - 1;
	} else if (rawMonth.length >= 3) {
		const index = MONTH_NAMES.findIndex((name) => name.toLowerCase().startsWith(rawMonth.slice(0, 3)));
		if (index >= 0) [year, month] = [index < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear(), index];
	}
	if (year !== null && month !== null && (year > now.getFullYear() + 2 || year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth()))) [year, month] = [null, null];
	// An exact start date must be a real day, today or later.
	const rawDate = slug('date');
	const parsed = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? new Date(`${rawDate}T00:00:00Z`) : null;
	const date = parsed && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === rawDate && rawDate >= now.toISOString().slice(0, 10) && Number(rawDate.slice(0, 4)) <= now.getFullYear() + 2 ? rawDate : '';

	const prefill: PlanPrefill = {
		context,
		type: types.find((type) => type.slug === slug('category'))?.slug ?? '',
		priority: priorities.find((activity) => activity.slug === slug('activity'))?.slug ?? '',
		party: PARTIES.find((party) => party.id === slug('persona'))?.id ?? '',
		year,
		month,
		date,
		from: /^[a-z0-9_]{1,40}$/.test(slug('from')) ? slug('from') : ''
	};
	return {
		siteOrigin: url.origin,
		...chrome,
		tours,
		stays,
		types,
		priorities,
		seasons: seasons.map(({ name, start_month, end_month, best_for, description }): PlannerSeason => ({ name, start_month, end_month, best_for, description })),
		prefill
	};
};

export const actions: Actions = {
	plan: planTrip
};
