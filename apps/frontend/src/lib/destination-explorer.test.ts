import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestFor, combinations, explore, locator, queryString, readQuery, regionsOf, safarisByPlace, sortsFor, toPlace, type Place } from './destination-explorer';
import type { DestinationDetail } from './destination-content';
import type { Tour } from './types/api';

const dest = (over: Partial<DestinationDetail>): DestinationDetail => ({ id: over.slug ?? 'x', name: 'Place', slug: 'place', country: 'Tanzania', ...over });
const tour = (over: Partial<Tour> & { stops: [string, string][] }): Tour => ({
	id: over.slug ?? 't', slug: 't', title: 'Trip', duration_days: 5, status: 'published', currency: 'USD',
	tour_destinations: over.stops.map(([id, name], i) => ({ destination_id: id, sort_order: i, destinations: { id, name } })),
	...over
} as unknown as Tour);

const tours = [
	tour({ slug: 'a', title: 'Three parks', price_from: 1750, is_featured: true, stops: [['tar', 'Tarangire'], ['ser', 'Serengeti'], ['ngo', 'Ngorongoro']] }),
	tour({ slug: 'b', title: 'Two parks', price_from: 920, stops: [['ngo', 'Ngorongoro'], ['tar', 'Tarangire']] }),
	tour({ slug: 'c', title: 'Long way', price_from: 2920, stops: [['tar', 'Tarangire'], ['ser', 'Serengeti'], ['ngo', 'Ngorongoro'], ['znz', 'Zanzibar']] })
];
const safaris = safarisByPlace(tours);
const places: Place[] = [
	toPlace(dest({ id: 'ser', slug: 'serengeti', name: 'Serengeti National Park', region: 'Northern Circuit', score_wildlife: 10, score_photography: 10, score_family: 8, latitude: -2.33, longitude: 34.83 }), safaris),
	toPlace(dest({ id: 'ngo', slug: 'ngorongoro', name: 'Ngorongoro Crater', region: 'Northern Circuit', score_wildlife: 9, latitude: -3.16, longitude: 35.59 }), safaris),
	toPlace(dest({ id: 'znz', slug: 'zanzibar', name: 'Zanzibar', region: 'Zanzibar & the Coast', score_wildlife: 3, score_luxury: 9, latitude: -6.16, longitude: 39.19 }), safaris),
	toPlace(dest({ id: 'nbo', slug: 'nairobi', name: 'Nairobi', country: 'Kenya', region: 'Nairobi', latitude: -1.29, longitude: 36.82 }), safaris)
];

test('counts the safaris that visit each place and keeps the lowest dollar price', () => {
	assert.deepEqual(safaris.get('ngo'), { count: 3, from: { amount: 920, currency: 'USD' } });
	assert.deepEqual(safaris.get('znz'), { count: 1, from: { amount: 2920, currency: 'USD' } });
	assert.equal(places[3].safaris.count, 0);
});

test('regions list only regions with places, and name a one-country "more places" after it', () => {
	assert.deepEqual(regionsOf(places).map((r) => [r.key, r.title, r.count]), [['northern', 'Northern circuit', 2], ['coast', 'Zanzibar & coast', 1], ['other', 'Kenya', 1]]);
});

test('best-for reads the two strongest scores of 8 or more, and says nothing otherwise', () => {
	assert.equal(bestFor(places[0]), 'Best for wildlife and photography');
	assert.equal(bestFor(places[2]), 'Best for comfort');
	assert.equal(bestFor(places[3]), '');
});

test('explore filters by region and words, and ranks by a score with unscored places last', () => {
	assert.deepEqual(explore(places, { search: '', region: 'northern', country: '', sort: 'recommended' }).map((p) => p.slug), ['serengeti', 'ngorongoro']);
	assert.deepEqual(explore(places, { search: 'crater', region: '', country: '', sort: 'recommended' }).map((p) => p.slug), ['ngorongoro']);
	assert.deepEqual(explore(places, { search: '', region: '', country: '', sort: 'luxury' }).map((p) => p.slug), ['zanzibar', 'serengeti', 'ngorongoro', 'nairobi']);
	assert.deepEqual(sortsFor(places), ['recommended', 'wildlife']);
});

test('the query round-trips through the address, ignoring unknown values', () => {
	const query = readQuery(new URLSearchParams('circuit=coast&sort=wildlife&search=%20beach%20'));
	assert.deepEqual(query, { search: 'beach', region: 'coast', country: '', sort: 'wildlife' });
	assert.equal(queryString(query), '?search=beach&circuit=coast&sort=wildlife');
	assert.deepEqual(readQuery(new URLSearchParams('circuit=mars&sort=price')), { search: '', region: '', country: '', sort: 'recommended' });
});

test('combinations are real safaris with three or more stops, featured first', () => {
	const routes = combinations(tours, places);
	assert.deepEqual(routes.map((r) => r.slug), ['a', 'c']);
	assert.deepEqual(routes[1].stops.map((s) => s.slug), [null, 'serengeti', 'ngorongoro', 'zanzibar']);
});

test('the locator marks the place inside the frame', () => {
	const map = locator({ lat: -2.33, lng: 34.83 }, [{ lat: -6.16, lng: 39.19 }]);
	assert.ok(map.outline.startsWith('M') && map.outline.endsWith('Z'));
	assert.ok(map.x > 0 && map.x < 160 && map.y > 0 && map.y < 120);
	assert.equal(map.dots.length, 1);
});
