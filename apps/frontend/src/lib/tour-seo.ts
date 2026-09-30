import { safeUrl, textContent } from './home-content.js';
import { siteInfo } from './site-info.js';
import { lowestPrice, sortedDays } from './tour-itinerary.js';
import type { TourDetail } from './types/api.js';

const DESCRIPTION_MAX = 160;

// textContent turns tags into spaces; pull punctuation back onto its word ("crater ." → "crater.").
const plain = (value?: string | null) => textContent(value).replace(/\s+([.,;:!?])/g, '$1');

/** Cuts on a word boundary so search snippets never end mid-word. */
export function clip(text: string, max = DESCRIPTION_MAX): string {
	if (text.length <= max) return text;
	const cut = text.slice(0, max - 1);
	const space = cut.lastIndexOf(' ');
	return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

/** An absolute URL for og:image and JSON-LD; bundled images resolve against the site. */
const absolute = (value: string, origin: string) => (value.startsWith('/') ? new URL(value, origin).href : value);

/**
 * Title, description, canonical URL, share image and TouristTrip JSON-LD for a
 * tour page. `fallbackImage` is the bundled photo the hero uses when the tour
 * has none of its own. The JSON-LD string is safe inside a <script> tag.
 */
export function tourSeo(tour: TourDetail, origin: string, fallbackImage: string) {
	const name = (tour.meta_title || tour.seo_title || tour.title).trim();
	const title = `${name} | Key2africa`;
	const description = clip(plain(tour.meta_description) || plain(tour.short_description) || plain(tour.full_description) || siteInfo.description);
	const canonical = new URL(`/tours/${encodeURIComponent(tour.slug)}`, origin).href;
	const image = absolute(safeUrl(tour.og_image_url || tour.banner_image_url || tour.main_image_url, fallbackImage), origin);
	const days = sortedDays(tour.itinerary_days);
	const from = lowestPrice(tour);
	const schema = {
		'@context': 'https://schema.org',
		'@type': 'TouristTrip',
		name: tour.title,
		description,
		url: canonical,
		image,
		provider: { '@type': 'Organization', name: siteInfo.company, url: new URL('/', origin).href },
		...(from ? { offers: { '@type': 'AggregateOffer', lowPrice: from.amount, priceCurrency: from.currency, url: `${canonical}#prices` } } : {}),
		...(days.length
			? {
					itinerary: {
						'@type': 'ItemList',
						numberOfItems: days.length,
						itemListElement: days.map((day, index) => ({
							'@type': 'ListItem',
							position: index + 1,
							name: `Day ${day.day_number}: ${day.title}`,
							...(plain(day.summary) ? { description: plain(day.summary) } : {}),
							...(day.destination?.name ? { item: { '@type': 'TouristDestination', name: day.destination.name } } : {})
						}))
					}
				}
			: {})
	};
	return { title, description, canonical, image, jsonLd: JSON.stringify(schema).replace(/</g, '\\u003c') };
}
