import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countryFromSlug, countryGroups, countryHref, countrySlug, homeFirst } from './countries';

test('country slugs round-trip, and only East African countries are pages', () => {
	assert.equal(countrySlug('Democratic Republic of the Congo'), 'democratic-republic-of-the-congo');
	assert.equal(countryFromSlug('south-sudan'), 'South Sudan');
	assert.equal(countryFromSlug('kenya'), 'Kenya');
	assert.equal(countryFromSlug('serengeti-national-park'), null);
	assert.equal(countryHref('Uganda'), '/destinations/uganda');
});

test('countries are counted from the places, Tanzania first, blank counted as Tanzania', () => {
	const places = [{ country: 'Kenya' }, { country: 'Tanzania' }, { country: '' }, { country: 'uganda' }, { country: 'Kenya' }];
	assert.deepEqual(countryGroups(places).map((c) => [c.name, c.count, c.href]), [['Tanzania', 2, '/destinations/tanzania'], ['Kenya', 2, '/destinations/kenya'], ['Uganda', 1, '/destinations/uganda']]);
	assert.deepEqual(homeFirst([{ country: 'Kenya', n: 1 }, { country: 'Tanzania', n: 2 }, { country: 'Uganda', n: 3 }, { n: 4 }]).map((p) => p.n), [2, 4, 1, 3]);
});
