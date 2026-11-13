import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterStays, readStayQuery, recommended, stayPlaces, stayQueryString, styleCounts, toStayItem, typeCounts } from './stay-explorer';
import type { Stay } from './types/api';

const SER = '11111111-1111-4111-8111-111111111111';
const ZNZ = '22222222-2222-4222-8222-222222222222';
const stay = (over: Partial<Stay>): Stay => ({ id: over.slug ?? 's', name: 'Stay', slug: 's', country: 'Tanzania', ...over });
const items = [
	toStayItem(stay({ slug: 'camp', name: 'Sound of Silence', lodge_type: 'TENTED_CAMP', accommodation_level: 'MID_RANGE', destination_id: SER, destinations: { name: 'Serengeti National Park', slug: 'serengeti' } })),
	toStayItem(stay({ slug: 'lodge', name: 'Serengeti Explorer', lodge_type: 'SAFARI_LODGE', accommodation_level: 'PREMIUM_LUXURY', destination_id: SER, destinations: { name: 'Serengeti National Park', slug: 'serengeti' }, image_url: 'https://cdn.example.com/a.jpg', tour_count: 2 })),
	toStayItem(stay({ slug: 'hotel', name: 'Park Hyatt', lodge_type: 'HOTEL', accommodation_level: 'LUXURY', destination_id: ZNZ, destinations: { name: 'Zanzibar', slug: 'zanzibar' }, short_description: 'Seafront rooms in Stone Town', recommended_nights: 3 }))
];

test('a stay becomes a list item with its style, type and place', () => {
	assert.equal(items[1].style, 'luxury');
	assert.equal(items[1].styleLabel, 'Luxury · top-end');
	assert.equal(items[0].typeLabel, 'Tented camp');
	assert.equal(items[2].nights, '3 nights');
	assert.equal(items[0].photo, '');
});

test('recommended puts stays with photos and safaris first', () => {
	assert.deepEqual(recommended(items).map((i) => i.slug), ['lodge', 'camp', 'hotel']);
});

test('places are counted, positioned from the destination, most stays first', () => {
	const places = stayPlaces(items, [{ id: SER, name: 'Serengeti National Park', slug: 'serengeti', latitude: -2.33, longitude: 34.83 }, { id: ZNZ, name: 'Zanzibar', slug: 'zanzibar', latitude: null, longitude: null }]);
	assert.deepEqual(places.map((p) => [p.name, p.count, p.lat]), [['Serengeti National Park', 2, -2.33], ['Zanzibar', 1, null]]);
});

test('filters combine, and counts can leave one filter out', () => {
	const query = readStayQuery(new URLSearchParams(`style=luxury&destination_id=${SER}`));
	assert.deepEqual(filterStays(items, query).map((i) => i.slug), ['lodge']);
	assert.deepEqual(filterStays(items, query, 'style').map((i) => i.slug), ['camp', 'lodge']);
	assert.deepEqual(filterStays(items, { ...query, style: '', place: '', search: 'stone town' }).map((i) => i.slug), ['hotel']);
	assert.deepEqual(styleCounts(items).map((s) => s.count), [0, 1, 2]);
	assert.deepEqual(typeCounts(items).map((t) => t.value), ['SAFARI_LODGE', 'TENTED_CAMP', 'HOTEL']);
});

test('the address keeps the stays page parameters and drops unknown values', () => {
	assert.equal(stayQueryString(readStayQuery(new URLSearchParams(`style=Budget&lodge_type=tented_camp&destination_id=${ZNZ}`))), `?destination_id=${ZNZ}&style=budget&lodge_type=TENTED_CAMP`);
	assert.deepEqual(readStayQuery(new URLSearchParams('style=gold&lodge_type=castle&destination_id=nope')), { search: '', place: '', style: '', type: '', country: '' });
});
