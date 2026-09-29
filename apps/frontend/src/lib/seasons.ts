import {
	Binoculars, Bird, Camera, CloudDrizzle, CloudRain, CloudSun, Droplets, Fish, Footprints, Heart, Leaf, Mountain,
	Palmtree, Sailboat, Snowflake, Sprout, Sun, Tent, ThermometerSun, Trees, Wind
} from '@lucide/svelte';

/** One row of the `seasons` table (/api/seasons). */
export type Season = {
	id?: string;
	name: string;
	start_month: number;
	end_month: number;
	description?: string | null;
	icon: string;
	tone: string;
	advantages: string[];
	disadvantages: string[];
	best_for?: string | null;
	status?: string;
	sort_order?: number;
	updated_at?: string;
	created_at?: string;
};

type Icon = typeof Leaf;

/** Keep in step with SEASON_ICONS in apps/backend/src/schemas/seasons.schema.ts. */
export const SEASON_ICONS: { key: string; label: string; icon: Icon }[] = [
	{ key: 'leaf', label: 'Leaf', icon: Leaf },
	{ key: 'sprout', label: 'Sprout', icon: Sprout },
	{ key: 'cloud-rain', label: 'Rain', icon: CloudRain },
	{ key: 'cloud-drizzle', label: 'Drizzle', icon: CloudDrizzle },
	{ key: 'cloud-sun', label: 'Sun & cloud', icon: CloudSun },
	{ key: 'sun', label: 'Sun', icon: Sun },
	{ key: 'thermometer-sun', label: 'Heat', icon: ThermometerSun },
	{ key: 'droplets', label: 'Humid', icon: Droplets },
	{ key: 'wind', label: 'Wind', icon: Wind },
	{ key: 'snowflake', label: 'Cool', icon: Snowflake }
];

/**
 * Keep in step with SEASON_TONES in the backend schema. Class strings are
 * written out in full so Tailwind generates them.
 */
export const SEASON_TONES: { key: string; label: string; card: string; icon: string; strip: string; swatch: string }[] = [
	{ key: 'green', label: 'Green', card: 'bg-[#F3F9F4]', icon: 'text-[#4F8A5B]', strip: 'bg-[#E8F3EA] text-[#2F6B3C]', swatch: 'bg-[#4F8A5B]' },
	{ key: 'blue', label: 'Blue', card: 'bg-[#F1F6FC]', icon: 'text-[#3B78B5]', strip: 'bg-[#E6F0FA] text-[#1E4F80]', swatch: 'bg-[#3B78B5]' },
	{ key: 'amber', label: 'Amber', card: 'bg-[#FFFAE8]', icon: 'text-[#D9A900]', strip: 'bg-[#FFF6D6] text-[#7A5A00]', swatch: 'bg-[#D9A900]' },
	{ key: 'rose', label: 'Rose', card: 'bg-[#FDF3F2]', icon: 'text-[#C2554A]', strip: 'bg-[#FBE6E3] text-[#8A2E25]', swatch: 'bg-[#C2554A]' },
	{ key: 'slate', label: 'Slate', card: 'bg-[#F4F5F7]', icon: 'text-[#5B6474]', strip: 'bg-[#E9ECF1] text-[#374151]', swatch: 'bg-[#5B6474]' }
];

/** A month no season covers. */
export const UNASSIGNED_MONTH = 'bg-[#F4F5F7] text-[#9CA3AF]';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const seasonIcon = (key: string | null | undefined): Icon => SEASON_ICONS.find((item) => item.key === key)?.icon ?? Leaf;
export const seasonTone = (key: string | null | undefined) => SEASON_TONES.find((item) => item.key === key) ?? SEASON_TONES[0];

/** A range may wrap the year end, e.g. November to February. */
export const coversMonth = (season: Pick<Season, 'start_month' | 'end_month'>, month: number) =>
	season.start_month <= season.end_month
		? month >= season.start_month && month <= season.end_month
		: month >= season.start_month || month <= season.end_month;

export const monthRange = (season: Pick<Season, 'start_month' | 'end_month'>) => {
	const start = MONTHS[season.start_month - 1];
	const end = MONTHS[season.end_month - 1];
	if (!start || !end) return '';
	return season.start_month === season.end_month ? start : `${start} – ${end}`;
};

/** The month strip: each month takes the first season (by sort order) that covers it. */
export const monthStrip = (seasons: Season[]) =>
	MONTH_SHORT.map((label, index) => ({ label, season: seasons.find((season) => coversMonth(season, index + 1)) ?? null }));

/**
 * The "Quick guide" row under the season cards. Stored on the homepage
 * `when_to_go` section: extra_data.quick_guide = [{ label, value, icon }],
 * with extra_data.quick_guide_eyebrow / quick_guide_title / footnote.
 */
export type QuickGuideItem = { label: string; value: string; icon: string };

export const GUIDE_ICONS: { key: string; label: string; icon: Icon }[] = [
	{ key: 'footprints', label: 'Migration', icon: Footprints },
	{ key: 'camera', label: 'Photography', icon: Camera },
	{ key: 'trees', label: 'Landscapes', icon: Trees },
	{ key: 'bird', label: 'Birds', icon: Bird },
	{ key: 'mountain', label: 'Mountain', icon: Mountain },
	{ key: 'palmtree', label: 'Beach', icon: Palmtree },
	{ key: 'binoculars', label: 'Game viewing', icon: Binoculars },
	{ key: 'sailboat', label: 'Sailing', icon: Sailboat },
	{ key: 'fish', label: 'Diving & fishing', icon: Fish },
	{ key: 'tent', label: 'Camping', icon: Tent },
	{ key: 'heart', label: 'Honeymoon', icon: Heart },
	{ key: 'sun', label: 'Sunshine', icon: Sun },
	{ key: 'leaf', label: 'Green season', icon: Leaf }
];

export const guideIcon = (key: string | null | undefined): Icon => GUIDE_ICONS.find((item) => item.key === key)?.icon ?? Binoculars;

export const QUICK_GUIDE_DEFAULTS = {
	eyebrow: 'Quick Guide',
	title: 'Best Time for Different Experiences',
	footnote: 'Seasons are a general guide. Rainfall and wildlife movements vary by location and year.',
	items: [
		{ label: 'Great Migration', value: 'June – October', icon: 'footprints' },
		{ label: 'Best Photography', value: 'January – March', icon: 'camera' },
		{ label: 'Green Landscapes', value: 'November – March', icon: 'trees' },
		{ label: 'Bird Watching', value: 'November – April', icon: 'bird' },
		{ label: 'Climbing Kilimanjaro', value: 'January – March & June – October', icon: 'mountain' },
		{ label: 'Zanzibar Beaches', value: 'Year Round', icon: 'palmtree' }
	] as QuickGuideItem[]
};

/** The quick guide as the CMS stores it, falling back to the built-in copy field by field. */
export const quickGuide = (extra: Record<string, unknown> | null | undefined) => {
	const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
	const items = Array.isArray(extra?.quick_guide)
		? (extra.quick_guide as Partial<QuickGuideItem>[])
				.map((item) => ({ label: text(item?.label), value: text(item?.value), icon: text(item?.icon) }))
				.filter((item) => item.label)
		: null;
	return {
		eyebrow: text(extra?.quick_guide_eyebrow) || QUICK_GUIDE_DEFAULTS.eyebrow,
		title: text(extra?.quick_guide_title) || QUICK_GUIDE_DEFAULTS.title,
		footnote: text(extra?.footnote) || QUICK_GUIDE_DEFAULTS.footnote,
		// An explicitly emptied list hides the guide; no list at all keeps the built-in one.
		items: items ?? QUICK_GUIDE_DEFAULTS.items
	};
};

/** Shown only when the API cannot be reached, so the section never renders empty by accident. */
export const fallbackSeasons: Season[] = [
	{
		name: 'Green Season', start_month: 1, end_month: 3, icon: 'leaf', tone: 'green',
		description: "The landscape is lush and green with beautiful scenery. It's a quieter time to travel with fewer crowds and excellent photography opportunities.",
		advantages: ['Lush green landscapes', 'Beautiful scenery', 'Fewer crowds', 'Great photography opportunities', 'Lower prices'],
		disadvantages: ['More rain, especially in March', 'Some lodges may be closed', 'Wildlife can be more dispersed', 'Some roads can be challenging'],
		best_for: 'Green landscapes, photography and fewer crowds'
	},
	{
		name: 'Long Rains', start_month: 4, end_month: 5, icon: 'cloud-rain', tone: 'blue',
		description: 'This is the long rainy season with heavier and more frequent rains. The landscapes are at their greenest, with dramatic skies and fewer tourists.',
		advantages: ['Lush, beautiful landscapes', 'Very few tourists', 'Lower prices', 'Excellent bird watching'],
		disadvantages: ['Heavier and more frequent rains', 'Some lodges may be closed', 'Game viewing can be more challenging', 'Some roads may be difficult'],
		best_for: 'Budget travelers, bird watching and lush scenery'
	},
	{
		name: 'Dry Season (Peak)', start_month: 6, end_month: 10, icon: 'sun', tone: 'amber',
		description: 'This is a popular time for safari, with dry weather, excellent wildlife viewing and opportunities to follow the Great Migration in the northern Serengeti.',
		advantages: ['Excellent wildlife viewing', 'Great Migration opportunities', 'Little to no rain', 'Clear skies and beautiful weather'],
		disadvantages: ['More tourists', 'Higher prices', 'Popular lodges can be fully booked', 'Parks can be busier'],
		best_for: 'Great Migration, river crossings and excellent game viewing'
	},
	{
		name: 'Short Rains', start_month: 11, end_month: 12, icon: 'leaf', tone: 'green',
		description: "Short rains bring a fresh, green landscape and fewer crowds. Wildlife viewing remains good, and it's a great time to combine a safari with a beach holiday in Zanzibar.",
		advantages: ['Landscapes turn green again', 'Fewer crowds', 'Great bird watching', 'Good wildlife viewing', 'Perfect for combining safari and beach'],
		disadvantages: ['Short rains, usually in the afternoons', 'Some roads can be muddy', 'Wildlife can be more spread out'],
		best_for: 'Fewer crowds, green landscapes and bird watching'
	}
];
