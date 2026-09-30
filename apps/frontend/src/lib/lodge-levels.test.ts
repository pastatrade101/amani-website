import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lodgeLevelLabel, lodgeLevelsForStyle, normalizeSafariStyle, styleForLodgeLevel } from './lodge-levels.js';

test('lodge levels map onto the three safari styles', () => {
	assert.equal(styleForLodgeLevel('BUDGET'), 'budget');
	assert.equal(styleForLodgeLevel('MID_RANGE'), 'midrange');
	assert.equal(styleForLodgeLevel('LUXURY'), 'luxury');
	assert.equal(styleForLodgeLevel('PREMIUM_LUXURY'), 'luxury');
	assert.equal(styleForLodgeLevel(null), 'midrange');
});

test('a luxury itinerary accepts both kinds of luxury lodge', () => {
	assert.deepEqual(lodgeLevelsForStyle('luxury'), ['LUXURY', 'PREMIUM_LUXURY']);
	assert.deepEqual(lodgeLevelsForStyle('budget'), ['BUDGET']);
	assert.equal(lodgeLevelLabel('PREMIUM_LUXURY'), 'Luxury · top-end');
});

test('older free-text budget tiers read as safari styles', () => {
	assert.equal(normalizeSafariStyle('mid_range'), 'midrange');
	assert.equal(normalizeSafariStyle('Mid-range'), 'midrange');
	assert.equal(normalizeSafariStyle('ultra_luxury'), 'luxury');
	assert.equal(normalizeSafariStyle('budget'), 'budget');
	assert.equal(normalizeSafariStyle(''), null);
	assert.equal(normalizeSafariStyle('adventure'), null);
});
