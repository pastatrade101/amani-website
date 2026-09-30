import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultSections, circuitFor, mergeSections, routeSentence, routeStops, safeUrl, textContent, tourDuration, tourDurationTitle, tourFilters, tourFromPrice, tourPhotos } from './home-content.js';

test('a disabled CMS section does not leak fallback copy', () => {
	const section = mergeSections([{ section_key: 'hero', is_active: false }]).find((item) => item.section_key === 'hero');
	assert.equal(section?.is_active, false);
	assert.equal(section?.title, undefined);
	assert.equal(section?.content, undefined);
});
test('CMS overrides copy and section ordering without discarding missing defaults', () => {
	const sections = mergeSections([{ section_key: 'destinations', title: 'Choose your park', sort_order: -1 }]);
	assert.equal(sections[0].section_key, 'destinations');
	assert.equal(sections[0].title, 'Choose your park');
	assert.equal(sections.length, defaultSections.length);
});
test('CMS eyebrow becomes the label and the CMS subtitle becomes the paragraph', () => {
	const why = mergeSections([{ section_key: 'why_us', title: 'A local team', subtitle: 'A full sentence of supporting copy for travellers.', extra_data: { eyebrow: 'Why Key2africa' } }]).find((item) => item.section_key === 'why_us');
	assert.equal(why?.subtitle, 'Why Key2africa');
	assert.equal(why?.content, 'A full sentence of supporting copy for travellers.');
});
test('an over-long eyebrow keeps the default label, and an empty paragraph keeps the default copy', () => {
	const fallback = defaultSections.find((item) => item.section_key === 'why_us');
	const why = mergeSections([{ section_key: 'why_us', extra_data: { eyebrow: 'x'.repeat(41) } }]).find((item) => item.section_key === 'why_us');
	assert.equal(why?.subtitle, fallback?.subtitle);
	assert.equal(why?.content, fallback?.content);
});
test('CMS links reject executable and protocol-relative values', () => {
	for (const value of ['javascript:alert(1)', 'data:text/html,test', '//example.com', '/\\example.com']) assert.equal(safeUrl(value), '#request-quote');
	assert.equal(safeUrl('/tours'), '/tours');
	assert.equal(safeUrl('https://example.com/trip'), 'https://example.com/trip');
});
test('search sends supported filters and cannot request draft tours', () => {
	const id = '0de809b1-15ac-4111-b805-5bc25910c0ae';
	const { query } = tourFilters(new URLSearchParams({ destination_id: id, category_id: 'reference-safari', search: '  Serengeti  ', status: 'all', from: '2026-10-01' }));
	assert.equal(query.get('destination_id'), id);
	assert.equal(query.get('search'), 'Serengeti');
	assert.equal(query.get('status'), 'published');
	assert.equal(query.has('category_id'), false);
	assert.equal(query.has('from'), false);
});
test('pagination normalizes invalid, fractional and oversized input', () => {
	for (const [input, expected] of [['-1', '1'], ['oops', '1'], ['2.9', '2'], ['999999', '1000']]) assert.equal(tourFilters(new URLSearchParams({ page: input })).query.get('page'), expected);
});
test('destinations use backend region/name fields and preserve unknown places', () => {
	assert.equal(circuitFor({ id: '1', name: 'Ruaha National Park', slug: 'ruaha' }), 'southern');
	assert.equal(circuitFor({ id: '2', name: 'Pemba Island', slug: 'pemba' }), 'coast');
	assert.equal(circuitFor({ id: '3', name: 'A new park', slug: 'new-park' }), 'other');
});
test('rich descriptions are rendered as text without raw HTML', () => {
	assert.equal(textContent('<p>Wildlife &amp; beaches</p>'), 'Wildlife & beaches');
});

const place = (name: string, slug: string, sort_order: number) => ({ destination_id: slug, sort_order, is_primary: sort_order === 0, destinations: { id: slug, name, slug } });

test('a tour route follows the saved order, shortens park names and counts the rest', () => {
	const tour = { tour_destinations: [place('Ngorongoro Conservation Area', 'ngorongoro', 2), place('Tarangire National Park', 'tarangire', 0), place('Serengeti National Park', 'serengeti', 1), place('Zanzibar', 'zanzibar', 3), place('Lake Manyara National Park', 'manyara', 4)] };
	assert.deepEqual(routeStops(tour), { stops: ['Tarangire', 'Serengeti', 'Ngorongoro'], more: 2 });
	assert.deepEqual(routeStops({ destinations: { name: 'Serengeti National Park', slug: 'serengeti' } }), { stops: ['Serengeti'], more: 0 });
	assert.deepEqual(routeStops({ tour_destinations: [], destinations: null }), { stops: [], more: 0 });
});
test('tour duration shows nights only when they are recorded', () => {
	assert.equal(tourDuration(6, 5), '6 days · 5 nights');
	assert.equal(tourDuration(2, 1), '2 days · 1 night');
	assert.equal(tourDuration(1, 0), '1 day');
	assert.equal(tourDuration(4, null), '4 days');
	assert.equal(tourDuration(0, 3), '');
});
test('a tour advertises its lowest style price, then its own price, else on request', () => {
	assert.equal(tourFromPrice({ currency: 'USD', price_from: 900, pricing_summary: { styles: ['budget', 'luxury'], from: 1450, currency: 'USD' } }), '$1,450');
	assert.equal(tourFromPrice({ currency: 'USD', price_from: '900', pricing_summary: { styles: ['luxury'], from: null, currency: null } }), '$900');
	assert.equal(tourFromPrice({ currency: 'USD', price_from: 0, pricing_summary: null }), null);
	assert.equal(tourFromPrice({ currency: 'USD', price_from: null }), null);
});
test('image-less tours in one list get different photos, and a tour image always wins', () => {
	const serengeti = { tour_destinations: [place('Serengeti National Park', 'serengeti', 0)] };
	const photos = tourPhotos([serengeti, serengeti, { ...serengeti, main_image_url: 'https://cdn.example.com/tour.jpg' }, { destinations: null }]);
	assert.equal(photos[0], '/images/serengeti.jpg');
	assert.notEqual(photos[1], photos[0]);
	assert.equal(photos[2], 'https://cdn.example.com/tour.jpg');
	assert.equal(new Set([photos[0], photos[1], photos[3]]).size, 3);
	assert.equal(tourPhotos([{ main_image_url: 'javascript:alert(1)' }])[0].startsWith('/images/'), true);
});

test('tour cards read "6 Days / 5 Nights" and "Tarangire, Serengeti & Ngorongoro"', () => {
	assert.equal(tourDurationTitle(6, 5), '6 Days / 5 Nights');
	assert.equal(tourDurationTitle(1, 0), '1 Day');
	assert.equal(tourDurationTitle(null), '');
	const link = (name: string, sort_order: number) => ({ destination_id: name, sort_order, is_primary: sort_order === 0, destinations: { id: name, name, slug: name.toLowerCase() } });
	assert.equal(routeSentence({ tour_destinations: [link('Serengeti National Park', 1), link('Tarangire National Park', 0), link('Ngorongoro Crater', 2)] }), 'Tarangire, Serengeti & Ngorongoro Crater');
	assert.equal(routeSentence({ tour_destinations: [link('Zanzibar', 0)] }), 'Zanzibar');
	assert.equal(routeSentence({ tour_destinations: ['A', 'B', 'C', 'D', 'E'].map((name, i) => link(name, i)) }, 3), 'A, B, C +2 more');
	assert.equal(routeSentence({}), '');
});
