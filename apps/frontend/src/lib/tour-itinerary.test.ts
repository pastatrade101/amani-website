import assert from 'node:assert/strict';
import { test } from 'node:test';
import { standardGroupPrices } from './safari-pricing.js';
import {
	activityList,
	dayPhotos,
	durationLabel,
	groupSizeLabel,
	initialStyle,
	lowestPrice,
	mealsLabel,
	offeredStyles,
	overnightLabel,
	stayHref,
	readableLabel,
	stylesLabel,
	tourRoute,
	travelModeLabel
} from './tour-itinerary.js';
import type { ItineraryDay, StayLodge, TourPricingSeasonPublic } from './types/api.js';

const lodge = (name: string, extra: Partial<StayLodge> = {}): StayLodge => ({ id: name, name, slug: name.toLowerCase().replace(/\s+/g, '-'), ...extra });
const day = (overrides: Partial<ItineraryDay> = {}): ItineraryDay => ({ id: `day-${overrides.day_number ?? 1}`, day_number: 1, title: 'Arusha to Tarangire', ...overrides });
const season = (style: TourPricingSeasonPublic['safari_style'], prices: (number | null)[] = [900, 800]): TourPricingSeasonPublic => ({
	id: `season-${style}`,
	safari_style: style,
	season_type: 'STANDARD_SEASON',
	season_name: 'Standard Season',
	currency: 'USD',
	pricing_basis: 'PER_PERSON',
	status: 'ACTIVE',
	group_prices: standardGroupPrices()
		.slice(0, prices.length)
		.map((row, i) => ({ ...row, price: prices[i], price_status: prices[i] == null ? 'ON_REQUEST' : 'FIXED_PRICE' }))
});

test('offered styles combine priced styles and styles with stays, in fixed order', () => {
	const tour = {
		tour_pricing_seasons: [season('luxury')],
		itinerary_days: [day({ stays: [{ safari_style: 'budget', accommodation: 'Twiga Campsite' }, { safari_style: 'midrange', lodge_id: null, accommodation: '  ' }] })]
	};
	assert.deepEqual(offeredStyles(tour), ['budget', 'luxury']);
	assert.deepEqual(offeredStyles({ tour_pricing_seasons: [], itinerary_days: [] }), []);
});

test('the initial style is midrange when offered, else the first offered', () => {
	assert.equal(initialStyle(['budget', 'midrange', 'luxury']), 'midrange');
	assert.equal(initialStyle(['budget', 'luxury']), 'budget');
	assert.equal(initialStyle([]), 'midrange');
});

test('overnight follows the chosen style and says "or similar"', () => {
	const stays = [
		{ safari_style: 'midrange' as const, lodge_id: 'l1', lodge: lodge('Tarangire Safari Lodge') },
		{ safari_style: 'luxury' as const, accommodation: 'Oliver’s Camp or similar' }
	];
	assert.equal(overnightLabel(day({ stays }), 'midrange'), 'Tarangire Safari Lodge or similar');
	assert.equal(overnightLabel(day({ stays }), 'luxury'), 'Oliver’s Camp or similar');
	// The day has per-style stays but none for budget: nothing to show, not the legacy lodge.
	assert.equal(overnightLabel(day({ stays, lodge: lodge('Old Lodge') }), 'budget'), '');
});

test('days without stays fall back to the legacy lodge or accommodation', () => {
	assert.equal(overnightLabel(day({ lodge: lodge('Kibo Lodge'), accommodation: 'Ignored' }), 'luxury'), 'Kibo Lodge or similar');
	assert.equal(overnightLabel(day({ accommodation: 'Arusha Coffee Lodge' }), 'budget'), 'Arusha Coffee Lodge or similar');
	assert.equal(overnightLabel(day({ accommodation: 'None' }), 'budget'), '');
	assert.equal(overnightLabel(day({}), 'budget'), '');
});

test('day photos: own photos first, then the legacy photo, then the stay lodge; max 3, deduped', () => {
	const own = day({ image_urls: ['https://cdn.example/a.jpg', 'https://cdn.example/a.jpg', 'javascript:alert(1)', 'https://cdn.example/b.jpg', 'https://cdn.example/c.jpg', 'https://cdn.example/d.jpg'], image_url: 'https://cdn.example/legacy.jpg' });
	assert.deepEqual(dayPhotos(own, 'midrange').map((photo) => photo.src), ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg', 'https://cdn.example/c.jpg']);
	assert.equal(dayPhotos(own, 'midrange')[0].alt, 'Arusha to Tarangire');
	assert.deepEqual(dayPhotos(day({ image_urls: [], image_url: 'https://cdn.example/legacy.jpg' }), 'midrange').map((photo) => photo.src), ['https://cdn.example/legacy.jpg']);
	const stays = [{ safari_style: 'luxury' as const, lodge: lodge('Chem Chem', { hero_image_url: 'https://cdn.example/hero.jpg', image_url: 'https://cdn.example/hero.jpg' }) }];
	assert.deepEqual(dayPhotos(day({ stays }), 'luxury'), [{ src: 'https://cdn.example/hero.jpg', alt: 'Chem Chem' }]);
	assert.deepEqual(dayPhotos(day({ stays }), 'budget'), []);
	assert.deepEqual(dayPhotos(day({}), 'budget'), []);
});

test('meals read naturally', () => {
	assert.equal(mealsLabel('B, L, D'), 'Breakfast, Lunch & Dinner');
	assert.equal(mealsLabel('BLD'), 'Breakfast, Lunch & Dinner');
	assert.equal(mealsLabel('B/D'), 'Breakfast & Dinner');
	assert.equal(mealsLabel('lunch and dinner'), 'Lunch & Dinner');
	assert.equal(mealsLabel('Dinner, Breakfast'), 'Breakfast & Dinner');
	assert.equal(mealsLabel('L'), 'Lunch');
	assert.equal(mealsLabel('full board'), 'Full board');
	assert.equal(mealsLabel('Picnic lunch & dinner'), 'Picnic lunch & dinner');
	assert.equal(mealsLabel('None'), '');
	assert.equal(mealsLabel('  '), '');
	assert.equal(mealsLabel(null), '');
});

test('the route lists day destinations in order, once per stay', () => {
	const days = [
		day({ day_number: 3, destination: { id: 's', name: 'Serengeti', slug: 'serengeti' } }),
		day({ day_number: 1, destination: { id: 'a', name: 'Arusha', slug: 'arusha' } }),
		day({ day_number: 2, destination: { id: 's', name: 'Serengeti', slug: 'serengeti' } }),
		day({ day_number: 4, destination: null }),
		day({ day_number: 5, destination: { id: 'a', name: 'Arusha', slug: 'arusha' } })
	];
	assert.deepEqual(tourRoute({ itinerary_days: days }), ['Arusha', 'Serengeti', 'Arusha']);
	const links = [
		{ destination_id: 'n', sort_order: 2, is_primary: false, destinations: { id: 'n', name: 'Ngorongoro', slug: 'ngorongoro' } },
		{ destination_id: 't', sort_order: 1, is_primary: true, destinations: { id: 't', name: 'Tarangire', slug: 'tarangire' } }
	];
	assert.deepEqual(tourRoute({ itinerary_days: [], tour_destinations: links }), ['Tarangire', 'Ngorongoro']);
	assert.deepEqual(tourRoute({ destinations: { name: 'Zanzibar', slug: 'zanzibar' } }), ['Zanzibar']);
	assert.deepEqual(tourRoute({}), []);
});

test('travel mode shows from day 2 only', () => {
	assert.equal(travelModeLabel({ day_number: 1, travel_mode: 'FLY' }), '');
	assert.equal(travelModeLabel({ day_number: 2, travel_mode: 'FLY' }), 'By air');
	assert.equal(travelModeLabel({ day_number: 3, travel_mode: 'DRIVE' }), 'By road');
	assert.equal(travelModeLabel({ day_number: 3, travel_mode: null }), '');
});

test('facts labels', () => {
	assert.equal(durationLabel(7, 6), '7 days / 6 nights');
	assert.equal(durationLabel(1, 0), '1 day');
	assert.equal(durationLabel(5, null), '5 days');
	assert.equal(durationLabel(0, 0), '');
	assert.equal(groupSizeLabel(2, 6), '2–6 travelers');
	assert.equal(groupSizeLabel(null, 6), 'Up to 6 travelers');
	assert.equal(groupSizeLabel(2, null), 'From 2 travelers');
	assert.equal(groupSizeLabel(4, 4), '4 travelers');
	assert.equal(groupSizeLabel(null, null), '');
	assert.equal(stylesLabel(['luxury', 'budget']), 'Budget · Luxury');
	assert.equal(readableLabel('MODERATE_HARD'), 'Moderate hard');
	assert.deepEqual(activityList('Game drive\n- Picnic lunch\n\n• Sundowner'), ['Game drive', 'Picnic lunch', 'Sundowner']);
});

test('lowest price ignores on-request rows and styles without prices', () => {
	assert.deepEqual(lowestPrice({ tour_pricing_seasons: [season('midrange', [1200, 950]), season('budget', [null, 700])] }), { amount: 700, currency: 'USD' });
	assert.equal(lowestPrice({ tour_pricing_seasons: [season('luxury', [null])] }), null);
	assert.equal(lowestPrice({}), null);
});

test('an overnight links to its stay page only when that page is public', () => {
	const lodge = (extra: Record<string, unknown>) => ({ id: 'l1', name: 'Tarangire Safari Lodge', slug: 'tarangire-safari-lodge', status: 'published', show_property_publicly: true, ...extra });
	const withLodge = (extra: Record<string, unknown>) => ({ stays: [{ safari_style: 'midrange' as const, lodge_id: 'l1', lodge: lodge(extra) }] });
	assert.equal(stayHref(withLodge({}), 'midrange'), '/stays/tarangire-safari-lodge');
	assert.equal(stayHref(withLodge({ status: 'draft' }), 'midrange'), '');
	assert.equal(stayHref(withLodge({ show_property_publicly: false }), 'midrange'), '');
	assert.equal(stayHref(withLodge({}), 'luxury'), '');
	assert.equal(stayHref({ stays: [{ safari_style: 'midrange', accommodation: 'Rufiji River Camp' }] }, 'midrange'), '');
});
