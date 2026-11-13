/**
 * Countries a property can be in: the East African Community members. Kept in
 * step with EAST_AFRICA_COUNTRIES in apps/backend/src/schemas/lodges.schema.ts.
 */
export const EAST_AFRICA_COUNTRIES = [
	'Tanzania',
	'Kenya',
	'Uganda',
	'Rwanda',
	'Burundi',
	'South Sudan',
	'Democratic Republic of the Congo',
	'Somalia'
] as const;

export type EastAfricaCountry = (typeof EAST_AFRICA_COUNTRIES)[number];

export const DEFAULT_COUNTRY: EastAfricaCountry = 'Tanzania';

/** A stored country as one of the list (case-insensitive), or null when it isn't one. */
export const toEastAfricaCountry = (value: unknown): EastAfricaCountry | null =>
	EAST_AFRICA_COUNTRIES.find((country) => country.toLowerCase() === String(value ?? '').trim().toLowerCase()) ?? null;

/** A country's address part, e.g. "Democratic Republic of the Congo" → "democratic-republic-of-the-congo". */
export const countrySlug = (name: string): string =>
	name.trim().toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** The East African country an address part names, or null. */
export const countryFromSlug = (slug: string): EastAfricaCountry | null =>
	EAST_AFRICA_COUNTRIES.find((country) => countrySlug(country) === String(slug ?? '').toLowerCase()) ?? null;

/** The country's own page, e.g. /destinations/kenya. */
export const countryHref = (name: string): string => `/destinations/${countrySlug(name)}`;

/** Whether a stored country is Tanzania, the home country (a blank country counts as Tanzania). */
export const isHomeCountry = (value: unknown): boolean => {
	const name = String(value ?? '').trim();
	return !name || name.toLowerCase() === DEFAULT_COUNTRY.toLowerCase();
};

export type CountryGroup = { name: string; slug: string; href: string; count: number };

/**
 * The countries the given places are in, with how many places each: Tanzania
 * first, then the East African list's order. A blank country counts as Tanzania.
 */
export function countryGroups(places: { country?: string | null }[]): CountryGroup[] {
	const counts = new Map<string, number>();
	for (const place of places) {
		const name = isHomeCountry(place.country) ? DEFAULT_COUNTRY : (toEastAfricaCountry(place.country) ?? String(place.country).trim());
		counts.set(name, (counts.get(name) ?? 0) + 1);
	}
	const rank = (name: string) => { const i = (EAST_AFRICA_COUNTRIES as readonly string[]).indexOf(name); return i === -1 ? EAST_AFRICA_COUNTRIES.length : i; };
	return [...counts].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b)).map(([name, count]) => ({ name, slug: countrySlug(name), href: countryHref(name), count }));
}

/** The same places with Tanzania's first, otherwise in their own order. */
export const homeFirst = <T extends { country?: string | null }>(places: T[]): T[] =>
	[...places].sort((a, b) => Number(!isHomeCountry(a.country)) - Number(!isHomeCountry(b.country)));
