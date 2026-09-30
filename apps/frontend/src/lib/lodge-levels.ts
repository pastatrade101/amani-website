import type { SafariStyle } from './safari-pricing.js';

/**
 * One vocabulary for comfort level across the site. Lodges store their level
 * as BUDGET / MID_RANGE / LUXURY / PREMIUM_LUXURY; tour prices and itinerary
 * stays use the three safari styles. Top-end properties count as Luxury, so a
 * luxury itinerary can use either kind of luxury lodge.
 */
export type LodgeLevel = 'BUDGET' | 'MID_RANGE' | 'LUXURY' | 'PREMIUM_LUXURY';

export const LODGE_LEVELS: { value: LodgeLevel; style: SafariStyle; label: string; hint: string }[] = [
	{ value: 'BUDGET', style: 'budget', label: 'Budget', hint: 'Campsites, simple camps and lodges' },
	{ value: 'MID_RANGE', style: 'midrange', label: 'Midrange', hint: 'Comfortable lodges and tented camps' },
	{ value: 'LUXURY', style: 'luxury', label: 'Luxury', hint: 'Premium lodges and camps' },
	{ value: 'PREMIUM_LUXURY', style: 'luxury', label: 'Luxury · top-end', hint: 'The most exclusive properties' }
];

const isLevel = (value: unknown): value is LodgeLevel => LODGE_LEVELS.some((level) => level.value === value);

/** The safari style a lodge serves. Unknown or missing levels count as midrange. */
export const styleForLodgeLevel = (level: unknown): SafariStyle =>
	LODGE_LEVELS.find((item) => item.value === String(level ?? '').toUpperCase())?.style ?? 'midrange';

/** Lodge levels that fit a safari style, e.g. luxury → LUXURY and PREMIUM_LUXURY. */
export const lodgeLevelsForStyle = (style: SafariStyle): LodgeLevel[] =>
	LODGE_LEVELS.filter((level) => level.style === style).map((level) => level.value);

export const lodgeLevelLabel = (level: unknown): string => {
	const value = String(level ?? '').toUpperCase();
	return isLevel(value) ? LODGE_LEVELS.find((item) => item.value === value)!.label : 'Midrange';
};

/**
 * Tours stored free-text budget tiers before styles existed (mid_range,
 * ultra_luxury, "Mid-range"…). Read any of them as a safari style.
 */
export const normalizeSafariStyle = (value: unknown): SafariStyle | null => {
	const text = String(value ?? '').toLowerCase().replace(/[\s_-]+/g, '');
	if (!text) return null;
	if (text.startsWith('budget')) return 'budget';
	if (text.startsWith('mid')) return 'midrange';
	if (text.includes('luxury') || text.startsWith('premium') || text.startsWith('ultra')) return 'luxury';
	return null;
};
