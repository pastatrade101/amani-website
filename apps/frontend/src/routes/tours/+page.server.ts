import { apiGet } from '$lib/server/api';
import { allPublishedTours } from '$lib/server/tours';
import { enquire } from '$lib/server/enquiry';
import { loadSiteChrome } from '$lib/server/site-chrome';
import { parseTourQuery } from '$lib/tour-filter';
import { approvedReviews, averageRating, type GuestReview } from '$lib/homepage-guides';
import type { Paginated, Tour } from '$lib/types/api';
import type { FaqItem } from '$lib/components/faq/faq-list.svelte';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	// Old links (?destination_id=…&category_id=…&search=…, from the menus,
	// destination pages and the home search) parse into the same query.
	const query = parseTourQuery(url.searchParams);
	// A safari style's page is this list filtered to it, so its FAQs show here.
	const faqStyleId = query.styles.length === 1 ? query.styles[0] : '';
	const [chrome, tours, faqs, generalFaqs, reviews] = await Promise.all([
		loadSiteChrome(fetch),
		allPublishedTours(fetch),
		faqStyleId
			? apiGet<Paginated<FaqItem>>(`faqs?placement=category&target_id=${encodeURIComponent(faqStyleId)}&limit=50`, fetch).then((r) => r.items).catch(() => [] as FaqItem[])
			: ([] as FaqItem[]),
		// The general safari questions (the home page's), for any list without a style of its own.
		apiGet<Paginated<FaqItem>>('faqs?placement=home&limit=12', fetch).then((r) => r.items).catch(() => [] as FaqItem[]),
		apiGet<Paginated<GuestReview>>('reviews?status=approved&limit=100', fetch).catch(() => null)
	]);
	return {
		faqs,
		faqStyleId,
		generalFaqs,
		reviews: reviews ? approvedReviews(reviews.items, 100) : [],
		reviewTotal: reviews?.pagination.total ?? 0,
		reviewAverage: reviews ? averageRating(reviews.items) : null,
		siteOrigin: url.origin,
		...chrome,
		tours: tours ?? [],
		toursUnavailable: tours === null,
		query
	};
};

export const actions: Actions = {
	enquire
};
