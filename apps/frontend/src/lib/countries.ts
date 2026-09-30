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
