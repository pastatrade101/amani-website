import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatPrice, groupLabel, seasonForStyle, standardGroupPrices, stylesWithPrices, tiersForStyle, type PricingSeason } from './safari-pricing.js';

const season = (overrides: Partial<PricingSeason>): PricingSeason => ({
	season_type: 'STANDARD_SEASON',
	season_name: 'Standard Season',
	currency: 'USD',
	pricing_basis: 'PER_PERSON',
	status: 'ACTIVE',
	group_prices: standardGroupPrices().map((row, i) => ({ ...row, price: 1000 - i * 50 })),
	...overrides
});

test('a season without a style counts as midrange', () => {
	assert.equal(seasonForStyle([season({})], 'midrange')?.season_name, 'Standard Season');
	assert.equal(seasonForStyle([season({})], 'budget'), null);
});

test('a dated season covering today wins over the standard season', () => {
	const seasons = [season({ safari_style: 'luxury' }), season({ safari_style: 'luxury', season_type: 'PEAK_SEASON', season_name: 'Peak', start_date: '2026-06-01', end_date: '2026-10-31', sort_order: 10 })];
	assert.equal(seasonForStyle(seasons, 'luxury', '2026-07-15')?.season_name, 'Peak');
	assert.equal(seasonForStyle(seasons, 'luxury', '2026-12-01')?.season_name, 'Standard Season');
});

test('inactive and per-group seasons are never shown', () => {
	assert.deepEqual(stylesWithPrices([season({ safari_style: 'budget', status: 'INACTIVE' }), season({ safari_style: 'luxury', pricing_basis: 'PER_GROUP' })]), []);
});

test('tiers are ordered by group size, hide unavailable rows and keep on-request ones', () => {
	const prices = standardGroupPrices();
	prices[0] = { ...prices[0], price: null, price_status: 'ON_REQUEST' };
	prices[5] = { ...prices[5], price: null, price_status: 'NOT_AVAILABLE' };
	const tiers = tiersForStyle([season({ group_prices: [...prices].reverse().map((p, i) => (p.price_status === 'FIXED_PRICE' ? { ...p, price: 500 + i } : p)) })], 'midrange');
	assert.deepEqual(tiers.map((t) => t.label), ['1 Pax', '2 Pax', '3 Pax', '4 Pax', '5 Pax']);
	assert.equal(tiers[0].price, null);
	assert.equal(tiers[0].status, 'ON_REQUEST');
});

test('group labels and prices read naturally', () => {
	assert.equal(groupLabel({ minimum_travelers: 7, maximum_travelers: null }), '7+ Pax');
	assert.equal(groupLabel({ minimum_travelers: 7, maximum_travelers: 10 }), '7–10 Pax');
	assert.equal(formatPrice(2650), '$2,650');
});
