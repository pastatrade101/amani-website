import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultSections, circuitFor, mergeSections, safeUrl, textContent, tourFilters } from './home-content.js';

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
