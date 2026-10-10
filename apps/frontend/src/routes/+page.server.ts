import { publishedGallery, type GalleryPhoto } from '$lib/homepage-gallery';
import { approvedReviews, type GuestReview } from '$lib/homepage-guides';
import { apiGet } from '$lib/server/api';
import { enquire } from '$lib/server/enquiry';
import { mergeSections, tourFilters } from '$lib/home-content';
import { referenceActivities, referenceDestinations } from '$lib/data/reference';
import type { Activity, Category, Destination, HomepageSection, Paginated, Stay, Tour } from '$lib/types/api';
import { fallbackSeasons, type Season } from '$lib/seasons';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const { filters, query } = tourFilters(url.searchParams);
	// The Tours menu shows the newest tours. The unfiltered first page already is
	// that list; only a search or later page needs its own request (sent first,
	// so the search stays the last tours request).
	const browsing = !filters.search && !filters.destination_id && !filters.category_id && query.get('page') === '1';
	const [stays, latest, homepage, destinations, activities, categories, tours, seasons, reviews, faqs, gallery, optionalActivities] = await Promise.allSettled([
		apiGet<Paginated<Stay>>('lodges?status=published&limit=4', fetch),
		browsing ? Promise.resolve(null) : apiGet<Paginated<Tour>>('tours?status=published&limit=6', fetch),
		apiGet<HomepageSection[]>('homepage', fetch),
		apiGet<Paginated<Destination>>('destinations?status=published&limit=100', fetch),
		apiGet<Paginated<Activity>>('activities?status=published&limit=12', fetch),
		apiGet<Paginated<Category>>('categories?status=published&limit=100', fetch),
		apiGet<Paginated<Tour>>(`tours?${query}`, fetch),
		apiGet<Paginated<Season>>('seasons?status=published&limit=24', fetch),
		apiGet<Paginated<GuestReview>>('reviews?status=approved&limit=3', fetch),
		apiGet<Paginated<{question:string;answer:string}>>('faqs?status=published&entity_type=null&destination_id=null&limit=12', fetch),
		apiGet<Paginated<GalleryPhoto>>('gallery?status=published&media_type=image&limit=24', fetch),
        apiGet<import('$lib/types/api').TourActivityItem[]>('activities/optional',fetch)
	]);
	return {
		siteOrigin: url.origin,
        optionalActivities: optionalActivities.status === 'fulfilled' ? optionalActivities.value : [],
		gallery: gallery.status === 'fulfilled' ? publishedGallery(gallery.value.items) : [],
		reviews: reviews.status === 'fulfilled' ? approvedReviews(reviews.value.items) : [],
		faqs: faqs.status === 'fulfilled' ? faqs.value.items : null,
		sections: mergeSections(homepage.status === 'fulfilled' && Array.isArray(homepage.value) ? homepage.value : []),
		destinations: destinations.status === 'fulfilled' ? destinations.value.items.filter((item) => !item.country || item.country.toLowerCase() === 'tanzania') : referenceDestinations,
		activities: activities.status === 'fulfilled' ? activities.value.items : referenceActivities,
		categories: categories.status === 'fulfilled' ? categories.value.items : [],
		tours: tours.status === 'fulfilled' ? tours.value.items : [],
		navStays: stays.status === 'fulfilled' ? stays.value.items : [],
		navTours: latest.status === 'fulfilled' && latest.value ? latest.value.items : browsing && tours.status === 'fulfilled' ? tours.value.items.slice(0, 6) : [],
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
	enquire
};
