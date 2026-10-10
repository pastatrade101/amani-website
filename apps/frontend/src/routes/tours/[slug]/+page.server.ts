import { error, redirect } from '@sveltejs/kit';
import { apiGet, ApiError } from '$lib/server/api';
import { enquire } from '$lib/server/enquiry';
import { loadSiteChrome } from '$lib/server/site-chrome';
import { approvedReviews, type GuestReview } from '$lib/homepage-guides';
import type { Paginated, TourDetail } from '$lib/types/api';
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
	type FAQ = { question: string; answer: string };
	const [specificFaqs, generalFaqs, reviews] = await Promise.all([
		apiGet<Paginated<FAQ>>(`faqs?status=published&entity_type=tours&entity_id=${encodeURIComponent(tour.id)}&limit=12`, fetch).then(r => r.items).catch(() => [] as FAQ[]),
		apiGet<Paginated<FAQ>>('faqs?status=published&entity_type=null&destination_id=null&limit=12', fetch).then(r => r.items).catch(() => [] as FAQ[]),
		apiGet<Paginated<GuestReview>>('reviews?status=approved&limit=3', fetch).then(r => approvedReviews(r.items)).catch(() => [] as GuestReview[])
	]);
	const seen = new Set<string>();
	const faqs = [...specificFaqs, ...generalFaqs].filter(faq => { const key = faq.question.trim().toLowerCase(); if (!key || seen.has(key)) return false; seen.add(key); return true; });
	return { siteOrigin: url.origin, tour, chrome, faqs, reviews };
};

export const actions: Actions = {
	enquire
};
