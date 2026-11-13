import { apiGet } from '$lib/server/api';
import { loadSiteChrome } from '$lib/server/site-chrome';
import { approvedReviews, type GuestReview } from '$lib/homepage-guides';
import { compareSlugs } from '$lib/compare.svelte';
import type { Paginated, TourDetail } from '$lib/types/api';
import type { PageServerLoad } from './$types';

/**
 * The comparison reads its safaris from the URL, not from the browser's
 * shortlist: a safari is usually settled by two or three people, so the page
 * has to survive being pasted into a message, and it renders on the server so
 * the table arrives with the page.
 */
export const load: PageServerLoad = async ({ fetch, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const slugs = compareSlugs(url.searchParams.get('tours'));
	const [chrome, loaded, reviews] = await Promise.all([
		loadSiteChrome(fetch),
		// A safari unpublished since it was shortlisted drops out instead of failing the rest.
		Promise.all(slugs.map((slug) => apiGet<TourDetail>(`tours/${encodeURIComponent(slug)}`, fetch).catch(() => null))),
		slugs.length ? apiGet<Paginated<GuestReview>>('reviews?status=approved&limit=100', fetch).then((result) => approvedReviews(result.items, 100)).catch((): GuestReview[] => []) : Promise.resolve([] as GuestReview[])
	]);
	const tours = loaded.filter((tour): tour is TourDetail => Boolean(tour));
	// Guest reviews linked to each safari: how many, and their average.
	const ratings: Record<string, { count: number; average: number }> = {};
	for (const tour of tours) {
		const own = reviews.filter((review) => review.tour_id === tour.id);
		if (own.length) ratings[tour.id] = { count: own.length, average: own.reduce((sum, review) => sum + Number(review.rating), 0) / own.length };
	}
	return { siteOrigin: url.origin, ...chrome, tours, ratings, missing: slugs.length - tours.length };
};
