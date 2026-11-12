import { apiGet } from '$lib/server/api';
import { enquire } from '$lib/server/enquiry';
import { loadSiteChrome } from '$lib/server/site-chrome';
import type { FaqItem } from '$lib/components/faq/faq-list.svelte';
import type { Paginated, TourActivityItem } from '$lib/types/api';
import type { Actions, PageServerLoad } from './$types';

/**
 * The practical planning sections (why Tanzania, the Key2africa approach, costs,
 * trip length, inclusions, a day on safari, questions) moved here from the
 * homepage. They keep their homepage CMS records, so the same switches, copy
 * and order apply. Everything fails soft, like the homepage.
 */
export const load: PageServerLoad = async ({ fetch, url }) => {
	const [chrome, faqs, optionalActivities] = await Promise.all([
		loadSiteChrome(fetch),
		apiGet<Paginated<FaqItem>>('faqs?placement=home&limit=12', fetch).then((result) => result.items).catch(() => [] as FaqItem[]),
		apiGet<TourActivityItem[]>('activities/optional', fetch).catch(() => [] as TourActivityItem[])
	]);
	return { siteOrigin: url.origin, chrome, faqs, optionalActivities };
};

export const actions: Actions = { enquire };
