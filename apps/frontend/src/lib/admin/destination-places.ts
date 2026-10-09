// Relative, not $lib: the unit tests run this file outside SvelteKit.
import { EAST_AFRICA_COUNTRIES } from '../countries.js';

/**
 * The choices behind a destination's place fields, and how each one reads on
 * the website:
 * - country: the label on the card photo, the page header and the Country filter;
 * - region: the safari region, the small label above the name on cards and the
 *   Safari region filter on /destinations (circuitFor reads it);
 * - location: the administrative region(s), first on the page's location line
 *   ("Manyara Region · Northern Circuit · Tanzania").
 */
export const DESTINATION_COUNTRIES = [...EAST_AFRICA_COUNTRIES];

/** Tanzania's circuits are the ones the public Safari region filter knows. */
export const SAFARI_REGIONS: Record<string, string[]> = {
	Tanzania: ['Northern Circuit', 'Southern Circuit', 'Western Circuit', 'Zanzibar & the Coast'],
	Kenya: ['Masai Mara', 'Amboseli & Tsavo', 'Laikipia & Samburu', 'Rift Valley Lakes', 'Nairobi', 'Kenyan Coast'],
	Uganda: ['Bwindi & the Southwest', 'Queen Elizabeth & the West', 'Murchison Falls & the North', 'Kampala & Entebbe'],
	Rwanda: ['Volcanoes & the Northwest', 'Akagera & the East', 'Nyungwe & the Southwest', 'Kigali']
};

const TANZANIA_REGIONS = [
	'Arusha', 'Dar es Salaam', 'Dodoma', 'Geita', 'Iringa', 'Kagera', 'Katavi', 'Kigoma', 'Kilimanjaro', 'Lindi',
	'Manyara', 'Mara', 'Mbeya', 'Mjini Magharibi', 'Morogoro', 'Mtwara', 'Mwanza', 'Njombe', 'Pemba North', 'Pemba South',
	'Pwani', 'Rukwa', 'Ruvuma', 'Shinyanga', 'Simiyu', 'Singida', 'Songwe', 'Tabora', 'Tanga', 'Unguja North', 'Unguja South'
];
const KENYA_COUNTIES = [
	'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega',
	'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni',
	'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', "Murang'a", 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira',
	'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans-Nzoia', 'Turkana',
	'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'
];

/** Administrative areas as visitors read them: "Manyara Region", "Narok County". */
export const ADMIN_AREAS: Record<string, string[]> = {
	Tanzania: TANZANIA_REGIONS.map((name) => `${name} Region`),
	Kenya: KENYA_COUNTIES.map((name) => `${name} County`),
	Uganda: ['Central Region', 'Eastern Region', 'Northern Region', 'Western Region'],
	Rwanda: ['Kigali City', 'Northern Province', 'Southern Province', 'Eastern Province', 'Western Province']
};

export const safariRegionsFor = (country: string): string[] => SAFARI_REGIONS[country] ?? [];
export const adminAreasFor = (country: string): string[] => ADMIN_AREAS[country] ?? [];

const plain = (value: string) => value.trim().toLowerCase().replace(/\s+(region|county|province|city)$/, '');

/** "manyara", "Manyara Region" and "MANYARA region" are all the same area. */
export function matchAdminArea(country: string, value: string): string | null {
	const wanted = plain(value);
	if (!wanted) return null;
	return adminAreasFor(country).find((area) => plain(area) === wanted) ?? null;
}

/** How several areas are stored and shown: "Mara Region, Simiyu Region". */
export const joinAreas = (areas: string[]): string => areas.filter(Boolean).join(', ');

/**
 * A stored location read back into the list: every part must be a known area,
 * otherwise the whole text is kept as typed (older free-text locations such as
 * "Indian Ocean, off the Tanzanian coast" stay exactly as they were).
 */
export function splitAreas(country: string, value: string): { areas: string[]; custom: string } {
	const text = (value ?? '').trim();
	if (!text) return { areas: [], custom: '' };
	const parts = text.split(/\s*,\s*|\s+&\s+|\s+and\s+/i).filter(Boolean);
	const areas = parts.map((part) => matchAdminArea(country, part));
	return areas.every(Boolean) ? { areas: [...new Set(areas as string[])], custom: '' } : { areas: [], custom: text };
}

/** Which safari region an administrative area belongs to, when that is clear. */
const AREA_TO_SAFARI_REGION: Record<string, Record<string, string>> = {
	Tanzania: {
		Arusha: 'Northern Circuit', Manyara: 'Northern Circuit', Kilimanjaro: 'Northern Circuit', Mara: 'Northern Circuit', Simiyu: 'Northern Circuit',
		Iringa: 'Southern Circuit', Morogoro: 'Southern Circuit', Lindi: 'Southern Circuit', Mbeya: 'Southern Circuit',
		Katavi: 'Western Circuit', Kigoma: 'Western Circuit', Rukwa: 'Western Circuit',
		'Mjini Magharibi': 'Zanzibar & the Coast', 'Unguja North': 'Zanzibar & the Coast', 'Unguja South': 'Zanzibar & the Coast',
		'Pemba North': 'Zanzibar & the Coast', 'Pemba South': 'Zanzibar & the Coast', 'Dar es Salaam': 'Zanzibar & the Coast', Pwani: 'Zanzibar & the Coast', Tanga: 'Zanzibar & the Coast'
	},
	Kenya: {
		Narok: 'Masai Mara', Kajiado: 'Amboseli & Tsavo', 'Taita-Taveta': 'Amboseli & Tsavo', Laikipia: 'Laikipia & Samburu',
		Samburu: 'Laikipia & Samburu', Isiolo: 'Laikipia & Samburu', Nakuru: 'Rift Valley Lakes', Baringo: 'Rift Valley Lakes',
		Nairobi: 'Nairobi', Mombasa: 'Kenyan Coast', Kwale: 'Kenyan Coast', Kilifi: 'Kenyan Coast', Lamu: 'Kenyan Coast'
	}
};

/**
 * When the safari region field holds an administrative area ("Arusha"), the
 * card label and the Safari region filter read wrongly. Suggest the safari
 * region it belongs to and move the area to Location.
 */
export function regionTidyUp(country: string, region: string): { area: string; safariRegion: string } | null {
	const value = region.trim();
	if (!value || safariRegionsFor(country).includes(value)) return null;
	const area = matchAdminArea(country, value);
	if (!area) return null;
	const safariRegion = AREA_TO_SAFARI_REGION[country]?.[area.replace(/\s+(Region|County|Province|City)$/, '')] ?? '';
	return safariRegion ? { area, safariRegion } : null;
}

/** The page's location line, as the public destination page builds it. */
export const locationLine = (location: string, region: string, country: string): string =>
	[location, region, country].map((part) => part.trim()).filter((part, index, all) => part && all.indexOf(part) === index).join(' · ');

/** Coordinates the public map link accepts, or a message saying why not. */
export function coordinateError(latitude: string, longitude: string): string {
	const lat = latitude.trim();
	const lng = longitude.trim();
	if (!lat && !lng) return '';
	if (!lat || !lng) return 'Add both latitude and longitude, or leave both empty.';
	const a = Number(lat);
	const b = Number(lng);
	if (!Number.isFinite(a) || Math.abs(a) > 90) return 'Latitude runs from -90 to 90 (Tanzania is about -1 to -12).';
	if (!Number.isFinite(b) || Math.abs(b) > 180) return 'Longitude runs from -180 to 180 (Tanzania is about 29 to 41).';
	return '';
}
