import assert from 'node:assert/strict';
import { test } from 'node:test';
import { staySeo } from './stay-seo.js';
import type { StayDetail } from './types/api.js';

const stay = (overrides: Partial<StayDetail> = {}): StayDetail => ({ id: 's1', name: 'Kuro Camp', slug: 'kuro-camp', ...overrides });

test('title prefers the meta title and the description is plain text', () => {
	assert.equal(staySeo(stay({ meta_title: 'Kuro Tarangire' }), 'https://site.test').title, 'Kuro Tarangire | Key2africa');
	const seo = staySeo(stay({ short_description: '<p>Tents by the <strong>river</strong> .</p>' }), 'https://site.test');
	assert.equal(seo.description, 'Tents by the river.');
	assert.equal(seo.canonical, 'https://site.test/stays/kuro-camp');
});

test('a stay without copy gets a factual description', () => {
	const seo = staySeo(stay({ lodge_type: 'TENTED_CAMP', park_area: 'Tarangire', country: 'Tanzania' }), 'https://site.test');
	assert.match(seo.description, /^Tented camp in Tarangire, Tanzania\./);
});

test('the share image is the property’s own photo or nothing', () => {
	assert.equal(staySeo(stay(), 'https://site.test').image, '');
	assert.equal(staySeo(stay({ images: [{ id: 'a', image_url: 'https://cdn.example/a.jpg', is_cover: true }] }), 'https://site.test').image, 'https://cdn.example/a.jpg');
	assert.equal(staySeo(stay({ social_image_url: 'https://cdn.example/og.jpg', hero_image_url: 'https://cdn.example/hero.jpg' }), 'https://site.test').image, 'https://cdn.example/og.jpg');
	assert.equal(staySeo(stay({ social_image_url: 'javascript:alert(1)' }), 'https://site.test').image, '');
});

test('LodgingBusiness holds only real fields and cannot close its script tag', () => {
	const seo = staySeo(
		stay({ name: 'Evil </script><script>alert(1)</script>', country: 'Tanzania', region: 'Manyara', latitude: -3.9, longitude: 35.9, destination: { id: 'd1', name: 'Tarangire National Park', slug: 'tarangire' } }),
		'https://site.test'
	);
	assert.ok(!seo.jsonLd.includes('<'));
	const [lodging, breadcrumbs] = JSON.parse(seo.jsonLd)['@graph'];
	assert.equal(lodging['@type'], 'LodgingBusiness');
	assert.deepEqual(lodging.address, { '@type': 'PostalAddress', addressRegion: 'Manyara', addressCountry: 'Tanzania' });
	assert.deepEqual(lodging.geo, { '@type': 'GeoCoordinates', latitude: -3.9, longitude: 35.9 });
	for (const key of ['aggregateRating', 'review', 'priceRange', 'starRating', 'image']) assert.equal(lodging[key], undefined);
	assert.deepEqual(breadcrumbs.itemListElement.map((item: { name: string }) => item.name), ['Home', 'Stays', 'Tarangire National Park', 'Evil </script><script>alert(1)</script>']);
});

test('a stay hidden from search engines says so', () => {
	assert.equal(staySeo(stay({ indexable: false }), 'https://site.test').noindex, true);
	assert.equal(staySeo(stay(), 'https://site.test').noindex, false);
});
