/**
 * The stays page's explorer: every published lodge and camp, grouped by the
 * place it is in, filtered by comfort, place and type, and pinned on the map
 * at its place. Plain TS (node tests, server). A stay's own coordinates are
 * rarely set, so the map pins places, each with how many stays it holds.
 */
import { safeUrl, textContent } from './home-content';
import { ownStayPhoto, stayStyle, stayStyleLabel, stayTypeLabel, STAY_STYLES, STAY_TYPES, nightsLabel, bestForLabels } from './stay-content';
import type { SafariStyle } from './safari-pricing';
import type { DestinationDetail } from './destination-content';
import type { Stay, StayType } from './types/api';

export type StayItem = {
	id: string;
	slug: string;
	name: string;
	type: StayType | '';
	typeLabel: string;
	style: SafariStyle;
	styleLabel: string;
	placeId: string;
	placeName: string;
	area: string;
	country: string;
	summary: string;
	photo: string;
	tours: number;
	nights: string;
	suits: string[];
	featured: boolean;
};

export type StayPlace = { id: string; name: string; slug: string; lat: number | null; lng: number | null; count: number };
export type StayQuery = { search: string; place: string; style: SafariStyle | ''; type: StayType | ''; country: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const coordinate = (value: unknown, limit: number): number | null => {
	const n = Number(value);
	return value !== null && value !== undefined && value !== '' && Number.isFinite(n) && Math.abs(n) <= limit && n !== 0 ? n : null;
};

export function toStayItem(stay: Stay): StayItem {
	const typeLabel = stayTypeLabel(stay.lodge_type);
	return {
		id: stay.id,
		slug: stay.slug,
		name: stay.name,
		type: typeLabel ? (String(stay.lodge_type).toUpperCase() as StayType) : '',
		typeLabel,
		style: stayStyle(stay),
		styleLabel: stayStyleLabel(stay),
		placeId: stay.destination_id ?? '',
		placeName: stay.destinations?.name?.trim() ?? '',
		area: textContent(stay.park_area?.trim() || stay.region?.trim() || ''),
		country: stay.country?.trim() ?? '',
		summary: textContent(stay.short_description ?? ''),
		photo: safeUrl(ownStayPhoto(stay), ''),
		tours: Math.max(0, Math.floor(Number(stay.tour_count) || 0)),
		nights: nightsLabel(stay.recommended_nights),
		suits: bestForLabels(stay.best_for),
		featured: Boolean(stay.is_featured)
	};
}

/** Recommended order: featured, then stays with their own photo, then those on safaris, then the CMS order. */
export function recommended(items: StayItem[]): StayItem[] {
	const rank = (item: StayItem) => (item.featured ? 0 : 3) + (item.photo ? 0 : 2) + (item.tours ? 0 : 1);
	return items.map((item, index) => ({ item, index })).sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index).map(({ item }) => item);
}

/** The places that have stays, most stays first, with the place's map position. */
export function stayPlaces(items: StayItem[], destinations: Pick<DestinationDetail, 'id' | 'name' | 'slug' | 'latitude' | 'longitude'>[]): StayPlace[] {
	const byId = new Map(destinations.map((d) => [d.id, d]));
	const counts = new Map<string, number>();
	for (const item of items) if (item.placeId) counts.set(item.placeId, (counts.get(item.placeId) ?? 0) + 1);
	return [...counts]
		.map(([id, count]) => {
			const d = byId.get(id);
			const name = d?.name ?? items.find((item) => item.placeId === id)?.placeName ?? '';
			return { id, name, slug: d?.slug ?? '', lat: coordinate(d?.latitude, 90), lng: coordinate(d?.longitude, 180), count };
		})
		.filter((place) => place.name)
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export const styleCounts = (items: StayItem[]) => STAY_STYLES.map((style) => ({ ...style, count: items.filter((item) => item.style === style.id).length }));
export const typeCounts = (items: StayItem[]) => STAY_TYPES.map((type) => ({ ...type, count: items.filter((item) => item.type === type.value).length })).filter((type) => type.count > 0);

const isStyle = (value: string): value is SafariStyle => STAY_STYLES.some((style) => style.id === value);
const isType = (value: string): value is StayType => STAY_TYPES.some((type) => type.value === value);

/** The same address the stays page has always used, so old links and the menu keep working. */
export function readStayQuery(params: URLSearchParams): StayQuery {
	const place = params.get('destination_id') ?? '';
	const style = (params.get('style') ?? '').toLowerCase();
	const type = (params.get('lodge_type') ?? '').toUpperCase();
	return {
		search: (params.get('search') ?? '').trim().slice(0, 150),
		place: UUID.test(place) ? place : '',
		style: isStyle(style) ? style : '',
		type: isType(type) ? type : '',
		country: (params.get('country') ?? '').trim().slice(0, 60)
	};
}

export function stayQueryString(query: StayQuery): string {
	const params = new URLSearchParams();
	if (query.search) params.set('search', query.search);
	if (query.place) params.set('destination_id', query.place);
	if (query.style) params.set('style', query.style);
	if (query.type) params.set('lodge_type', query.type);
	if (query.country) params.set('country', query.country);
	const qs = params.toString();
	return qs ? `?${qs}` : '';
}

/** Stays matching the query, every word somewhere in the name, type, place or excerpt. */
export function filterStays(items: StayItem[], query: StayQuery, skip?: 'style' | 'place' | 'type'): StayItem[] {
	const words = query.search.toLowerCase().split(/\s+/).filter(Boolean);
	return items.filter((item) => {
		if (skip !== 'style' && query.style && item.style !== query.style) return false;
		if (skip !== 'place' && query.place && item.placeId !== query.place) return false;
		if (skip !== 'type' && query.type && item.type !== query.type) return false;
		if (query.country && item.country.toLowerCase() !== query.country.toLowerCase()) return false;
		const text = `${item.name} ${item.typeLabel} ${item.placeName} ${item.area} ${item.styleLabel} ${item.summary}`.toLowerCase();
		return words.every((word) => text.includes(word));
	});
}
