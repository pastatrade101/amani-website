import { fail } from '@sveltejs/kit';
import { apiGet, apiRequest, ApiError } from '$lib/server/api';
import { mergeSections, tourFilters } from '$lib/home-content';
import { referenceActivities, referenceDestinations } from '$lib/data/reference';
import type { Activity, Category, Destination, HomepageSection, Paginated, Tour } from '$lib/types/api';
import { fallbackSeasons, type Season } from '$lib/seasons';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const { filters, query } = tourFilters(url.searchParams);
	const [homepage, destinations, activities, categories, tours, seasons] = await Promise.allSettled([
		apiGet<HomepageSection[]>('homepage', fetch),
		apiGet<Paginated<Destination>>('destinations?status=published&limit=100', fetch),
		apiGet<Paginated<Activity>>('activities?status=published&limit=12', fetch),
		apiGet<Paginated<Category>>('categories?status=published&limit=100', fetch),
		apiGet<Paginated<Tour>>(`tours?${query}`, fetch),
		apiGet<Paginated<Season>>('seasons?status=published&limit=24', fetch)
	]);
	return {
		siteOrigin: url.origin,
		sections: mergeSections(homepage.status === 'fulfilled' && Array.isArray(homepage.value) ? homepage.value : []),
		destinations: destinations.status === 'fulfilled' ? destinations.value.items.filter((item) => !item.country || item.country.toLowerCase() === 'tanzania') : referenceDestinations,
		activities: activities.status === 'fulfilled' ? activities.value.items : referenceActivities,
		categories: categories.status === 'fulfilled' ? categories.value.items : [],
		tours: tours.status === 'fulfilled' ? tours.value.items : [],
		// Built-in seasons only when the API is unreachable; an empty CMS list hides the cards.
		seasons: seasons.status === 'fulfilled' ? seasons.value.items : fallbackSeasons,
		tourTotal: tours.status === 'fulfilled' ? tours.value.pagination.total : 0,
		page: Number(query.get('page')),
		pageCount: tours.status === 'fulfilled' ? tours.value.pagination.totalPages : 1,
		toursUnavailable: tours.status === 'rejected',
		destinationsAreReference: destinations.status === 'rejected',
		filters
	};
};

export const actions: Actions = {
	enquire: async ({ request, fetch, getClientAddress }) => {
		const data = await request.formData();
		const value = (key: string) => String(data.get(key) ?? '').trim();
		const values = { full_name: value('full_name'), email: value('email'), phone: value('phone'), message: value('message'), travel_date: value('travel_date'), travelers: value('travelers'), interest: value('interest') };
		if (value('website')) return fail(400, { success: false, message: 'Unable to send this enquiry.', values });
		if (values.full_name.length < 2 || values.full_name.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || values.email.length > 254 || values.message.length < 10 || values.message.length > 5000 || values.interest.length > 200 || values.phone.length > 50) {
			return fail(400, { success: false, message: 'Please enter your name, a valid email, and a message of 10–5,000 characters.', values });
		}
		if (!/^([1-9]|1[0-9]|20)$/.test(values.travelers) || (values.travel_date && (!/^\d{4}-\d{2}-\d{2}$/.test(values.travel_date) || !Number.isFinite(Date.parse(values.travel_date)) || new Date(values.travel_date).toISOString().slice(0, 10) !== values.travel_date))) {
			return fail(400, { success: false, message: 'Please check your travel date and number of travelers.', values });
		}
		// The contact table has no date/traveler columns. Store trip preferences in message.
		const preferences = [`Travel date: ${values.travel_date || 'Flexible'}`, `Travelers: ${values.travelers}`, `Interest: ${values.interest || 'Tanzania safari'}`].join('\n');
		try {
			await apiRequest('contact', fetch, {
				method: 'POST', headers: { 'X-Forwarded-For': getClientAddress() },
				body: JSON.stringify({ full_name: values.full_name, email: values.email, phone: values.phone || null, subject: `Safari enquiry: ${values.interest || 'Tanzania'}`, message: `${values.message}\n\n${preferences}` })
			});
			return { success: true, message: 'Thank you! Your enquiry has been received. Our team will be in touch.', values: null };
		} catch (error) {
			return fail(error instanceof ApiError && error.status === 429 ? 429 : 503, { success: false, message: error instanceof ApiError && error.status === 429 ? 'Please wait a few minutes before sending another enquiry.' : 'We couldn’t send your enquiry right now. Your details are still here; please try again shortly.', values });
		}
	}
};
