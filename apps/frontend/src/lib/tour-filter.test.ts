import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeChips, ageChoices, EMPTY_QUERY, facetGroups, filterTours, parseTourQuery, placeLabel, reviewsFirst, routePlaces, tourFacts, tourPriceValue, tourQueryParams, toggleOption, type TourQuery } from './tour-filter';
import { tourFromPrice } from './home-content';
import type { Tour } from './types/api';

const SERENGETI = '11111111-1111-4111-8111-111111111111';
const NGORONGORO = '22222222-2222-4222-8222-222222222222';
const ZANZIBAR = '33333333-3333-4333-8333-333333333333';
const TARANGIRE = '44444444-4444-4444-8444-444444444444';
const MIGRATION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BEACH = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const place = (id: string, name: string, sort_order: number) => ({ destination_id: id, sort_order, is_primary: sort_order === 0, destinations: { id, name, slug: name.toLowerCase() } });
const tour = (overrides: Partial<Tour>): Tour => ({ id: overrides.slug ?? 'x', title: 'A safari', slug: 'x', duration_days: 5, currency: 'USD', ...overrides });

const tours: Tour[] = [
	tour({ slug: 'migration', title: '5-Day Fly-In Tanzania Migration Safari', duration_days: 5, duration_nights: 4, price_from: 1850, pricing_summary: { styles: [], from: null, currency: null }, budget_tier: 'midrange', category_id: MIGRATION, experience_type: 'Migration, Big Five Safari', minimum_age: 3, start_location: 'Arusha, Tanzania', tour_destinations: [place(SERENGETI, 'Serengeti National Park', 0), place(NGORONGORO, 'Ngorongoro Crater', 1)] }),
	tour({ slug: 'beach', title: '8-Day Tanzania Safari & Zanzibar Beach Escape', duration_days: 8, duration_nights: 7, price_from: 2920, pricing_summary: { styles: ['midrange'], from: 2920, currency: 'USD' }, category_id: BEACH, highlights: ['Elephants and baobabs in Tarangire National Park'], start_point: { id: 'k', name: 'Kilimanjaro International Airport', slug: 'kia', role: 'both', gateway_type: 'airport', status: 'published' }, tour_destinations: [place(TARANGIRE, 'Tarangire National Park', 0), place(SERENGETI, 'Serengeti National Park', 1), place(NGORONGORO, 'Ngorongoro Crater', 2), place(ZANZIBAR, 'Zanzibar', 3)] }),
	tour({ slug: 'short', title: '2 Days Safari From Zanzibar', duration_days: 2, duration_nights: 1, price_from: 920, pricing_summary: { styles: ['midrange'], from: 920, currency: 'USD' }, category_id: BEACH, minimum_age: 12, start_location: 'zanzibar', tour_destinations: [place(NGORONGORO, 'Ngorongoro Crater', 0), place(TARANGIRE, 'Tarangire National Park', 1)] }),
	tour({ slug: 'luxury', title: '12-Day Luxury Northern Circuit', duration_days: 12, price_from: null, pricing_summary: { styles: ['luxury'], from: null, currency: null }, is_featured: true, start_location: 'Arusha', tour_destinations: [place(SERENGETI, 'Serengeti National Park', 0)] })
];
const facts = tours.map(tourFacts);
const slugs = (query: Partial<TourQuery>) => filterTours(facts, { ...EMPTY_QUERY, ...query }).map((item) => item.tour.slug);

test('the URL round-trips, keeps old single-value links and drops anything malformed', () => {
	const query = parseTourQuery(new URLSearchParams(`destination_id=${SERENGETI}&destination_id=${ZANZIBAR}&destination_id=all&category_id=nope&days=4-6&days=99&budget=on-request&start=arusha&start=../x&comfort=luxury&age=5&sort=price-low&search=%20big%20%20five%20`));
	assert.deepEqual(query, { search: 'big five', places: [SERENGETI, ZANZIBAR], styles: [], days: ['4-6'], budget: ['on-request'], start: ['arusha'], comfort: ['luxury'], age: 5, sort: 'price-low' });
	assert.deepEqual(parseTourQuery(tourQueryParams(query)), query);
	assert.equal(tourQueryParams(EMPTY_QUERY).toString(), '');
	assert.equal(parseTourQuery(new URLSearchParams('age=18&sort=cheapest')).age, null);
	assert.equal(parseTourQuery(new URLSearchParams('sort=cheapest')).sort, 'recommended');
});

test('places must all be on the route; other facets match any chosen option', () => {
	assert.deepEqual(slugs({ places: [SERENGETI] }), ['luxury', 'migration', 'beach']);
	assert.deepEqual(slugs({ places: [SERENGETI, ZANZIBAR] }), ['beach']);
	assert.deepEqual(slugs({ styles: [MIGRATION, BEACH] }), ['migration', 'beach', 'short']);
	assert.deepEqual(slugs({ days: ['1-3', '11-plus'] }), ['luxury', 'short']);
	assert.deepEqual(slugs({ budget: ['under-1000', 'on-request'] }), ['luxury', 'short']);
	assert.deepEqual(slugs({ start: ['arusha'] }), ['luxury', 'migration']);
	assert.deepEqual(slugs({ comfort: ['midrange'] }), ['migration', 'beach', 'short']);
	assert.deepEqual(slugs({ age: 4 }), ['luxury', 'migration', 'beach']);
	assert.deepEqual(slugs({ age: 12 }), ['luxury', 'migration', 'beach', 'short']);
});

test('search reads every word against the title, route, highlights, style and start', () => {
	assert.deepEqual(slugs({ search: 'zanzibar beach' }), ['beach']);
	assert.deepEqual(slugs({ search: 'Zanzibar' }), ['beach', 'short']);
	assert.deepEqual(slugs({ search: 'elephants' }), ['beach']);
	assert.deepEqual(slugs({ search: 'big 5' }), ['migration']);
	assert.deepEqual(slugs({ search: 'migrat' }), ['migration']);
	assert.deepEqual(slugs({ search: 'ngorongoro crater tours' }), ['migration', 'beach', 'short']);
	assert.deepEqual(slugs({ search: 'kilimanjaro' }), ['beach']);
	assert.deepEqual(slugs({ search: 'Sérengeti & luxury' }), ['luxury']);
	assert.deepEqual(slugs({ search: 'gorilla' }), []);
});

test('sorting puts unknown prices and lengths last', () => {
	assert.deepEqual(slugs({}), ['luxury', 'migration', 'beach', 'short']);
	assert.deepEqual(slugs({ sort: 'price-low' }), ['short', 'migration', 'beach', 'luxury']);
	assert.deepEqual(slugs({ sort: 'price-high' }), ['beach', 'migration', 'short', 'luxury']);
	assert.deepEqual(slugs({ sort: 'days-short' }), ['short', 'migration', 'beach', 'luxury']);
	assert.deepEqual(slugs({ sort: 'days-long' }), ['luxury', 'beach', 'migration', 'short']);
});

test('the filter price is the price the card shows', () => {
	for (const item of tours) {
		const value = tourPriceValue(item);
		assert.equal(Boolean(value), Boolean(tourFromPrice(item)), item.slug);
	}
	assert.equal(facts[0].price, 1850);
	assert.equal(facts[3].budgetKey, 'on-request');
	assert.equal(tourFacts(tour({ price_from: 1500, currency: 'EUR' }), 0).budgetKey, null);
});

test('start points read as places', () => {
	assert.equal(placeLabel('Arusha, Tanzania'), 'Arusha');
	assert.equal(placeLabel('zanzibar'), 'Zanzibar');
	assert.equal(placeLabel('Kilimanjaro International Airport'), 'Kilimanjaro International Airport');
	assert.deepEqual(facts.map((item) => item.start?.key), ['arusha', 'kilimanjaro-international-airport', 'zanzibar', 'arusha']);
});

test('options count what each would show, and options no tour has are left out', () => {
	const categories = [{ id: MIGRATION, name: 'Great Migration Safaris', slug: 'm' }, { id: BEACH, name: 'Safari & Zanzibar Beach Holidays', slug: 'b' }, { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Southern Circuit Safaris', slug: 's' }];
	const query: TourQuery = { ...EMPTY_QUERY, places: [SERENGETI], styles: [BEACH] };
	const groups = facetGroups(facts, query, { categories });
	const options = (id: string) => Object.fromEntries(groups.find((item) => item.id === id)!.options.map((option) => [option.label, `${option.count}${option.checked ? '*' : ''}`]));
	// Serengeti is on every route but one, so it leads; picking Zanzibar too still leaves the beach safari.
	assert.deepEqual(options('places'), { Serengeti: '1*', 'Ngorongoro Crater': '1', Tarangire: '1', Zanzibar: '1' });
	// A style with no published tours is not offered; counts ignore the style already picked.
	assert.deepEqual(options('styles'), { 'Great Migration Safaris': '1', 'Safari & Zanzibar Beach Holidays': '1*' });
	assert.deepEqual(options('days'), { '1–3 days': '0', '4–6 days': '0', '7–10 days': '1', '11 days or more': '0' });
	assert.deepEqual(activeChips(query, groups).map((chip) => chip.label), ['Serengeti', 'Safari & Zanzibar Beach Holidays']);
	assert.deepEqual(toggleOption(query, 'places', SERENGETI).places, []);
});

test('a group that could never narrow the list is hidden, unless it was chosen', () => {
	const allMidrange = tours.slice(0, 3).map(tourFacts);
	assert.equal(facetGroups(allMidrange, EMPTY_QUERY, { categories: [] }).some((item) => item.id === 'comfort'), false);
	assert.equal(facetGroups(allMidrange, { ...EMPTY_QUERY, comfort: ['midrange'] }, { categories: [] }).some((item) => item.id === 'comfort'), true);
});

test('ages count the safaris that welcome the youngest traveller', () => {
	const choices = ageChoices(facts, EMPTY_QUERY);
	assert.equal(choices[0].count, 4);
	assert.equal(choices.find((choice) => choice.value === '2')!.count, 2);
	assert.equal(choices.find((choice) => choice.value === '12')!.count, 4);
	assert.deepEqual(ageChoices([tourFacts(tour({}), 0)], EMPTY_QUERY), []);
});

test('the places under the list follow the safaris on show', () => {
	assert.deepEqual(routePlaces(filterTours(facts, { ...EMPTY_QUERY, search: 'zanzibar' })).map((place) => `${place.name} ${place.count}`), ['Tarangire National Park 2', 'Ngorongoro Crater 2', 'Serengeti National Park 1', 'Zanzibar 1']);
	assert.deepEqual(routePlaces([]), []);
});

test('reviews of the safaris on show come first', () => {
	const reviews = [{ id: 'a' }, { id: 'b', is_featured: true }, { id: 'c', tour_id: 'beach' }, { id: 'd', tour_id: 'other' }];
	assert.deepEqual(reviewsFirst(reviews, new Set(['beach'])).map((review) => review.id), ['c', 'b', 'a', 'd']);
});
