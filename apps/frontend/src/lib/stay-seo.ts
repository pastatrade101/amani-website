import { safeUrl, textContent } from './home-content.js';
import { siteInfo } from './site-info.js';
import { stayCoordinates, stayGallery, stayLocation, stayTypeLabel } from './stay-content.js';
import { clip } from './tour-seo.js';
import type { StayDetail } from './types/api.js';

// textContent turns tags into spaces; pull punctuation back onto its word.
const plain = (value?: string | null) => textContent(value).replace(/\s+([.,;:!?])/g, '$1');

/** An absolute URL for og:image and JSON-LD; bundled images resolve against the site. */
const absolute = (value: string, origin: string) => (value.startsWith('/') ? new URL(value, origin).href : value);

/**
 * Title, description, canonical URL, share image and JSON-LD for a stay page.
 * The share image is only ever the property's own photo (empty without one),
 * and the LodgingBusiness carries only fields the CMS actually holds: no
 * ratings, reviews or prices. The JSON-LD string is safe inside a <script> tag.
 */
export function staySeo(stay: StayDetail, origin: string) {
	const name = (stay.meta_title || stay.seo_title || stay.name).trim();
	const title = `${name} | Key2africa`;
	const type = stayTypeLabel(stay.lodge_type);
	const location = stayLocation(stay);
	const generated = `${type || 'A place to stay'}${location ? ` in ${location}` : ''}. See the safaris that stay here and plan your visit with ${siteInfo.brand}.`;
	const description = clip(plain(stay.meta_description) || plain(stay.short_description) || plain(stay.description) || generated);
	const canonical = new URL(`/stays/${encodeURIComponent(stay.slug)}`, origin).href;
	const photos = stayGallery(stay);
	const social = safeUrl(stay.social_image_url, '');
	const own = social && !social.startsWith('#') ? social : (photos[0]?.src ?? '');
	const image = own ? absolute(own, origin) : '';
	const coordinates = stayCoordinates(stay);
	const region = stay.region?.trim() || stay.destination?.region?.trim() || stay.park_area?.trim() || '';
	const country = stay.country?.trim() || stay.destination?.country?.trim() || '';
	const home = new URL('/', origin).href;
	const lodging = {
		'@type': 'LodgingBusiness',
		name: stay.name,
		description,
		url: canonical,
		...(photos.length ? { image: photos.slice(0, 6).map((photo) => absolute(photo.src, origin)) } : {}),
		...(region || country ? { address: { '@type': 'PostalAddress', ...(region ? { addressRegion: region } : {}), ...(country ? { addressCountry: country } : {}) } } : {}),
		...(coordinates ? { geo: { '@type': 'GeoCoordinates', latitude: coordinates.latitude, longitude: coordinates.longitude } } : {})
	};
	const place = stay.destination ?? null;
	const breadcrumbs = {
		'@type': 'BreadcrumbList',
		itemListElement: [
			{ name: 'Home', item: home },
			{ name: 'Stays', item: new URL('/stays', origin).href },
			...(place?.id && place.name ? [{ name: place.name, item: new URL(`/stays?destination_id=${encodeURIComponent(place.id)}`, origin).href }] : []),
			{ name: stay.name, item: canonical }
		].map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, ...crumb }))
	};
	const schema = { '@context': 'https://schema.org', '@graph': [lodging, breadcrumbs] };
	return { title, description, canonical, image, noindex: stay.indexable === false, jsonLd: JSON.stringify(schema).replace(/</g, '\\u003c') };
}
