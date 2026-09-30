import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clip, tourSeo } from './tour-seo.js';
import type { TourDetail } from './types/api.js';

const tour = (overrides: Partial<TourDetail> = {}): TourDetail => ({ id: 't1', title: 'Classic Northern Safari', slug: 'classic-northern-safari', duration_days: 6, currency: 'USD', ...overrides });

test('title prefers the meta title, then the SEO title, then the tour title', () => {
	assert.equal(tourSeo(tour({ meta_title: 'Meta', seo_title: 'Seo' }), 'https://site.test', '/images/serengeti.jpg').title, 'Meta | Key2africa');
	assert.equal(tourSeo(tour({ seo_title: 'Seo' }), 'https://site.test', '/images/serengeti.jpg').title, 'Seo | Key2africa');
	assert.equal(tourSeo(tour(), 'https://site.test', '/images/serengeti.jpg').title, 'Classic Northern Safari | Key2africa');
});

test('description falls back to the short description as plain text', () => {
	const seo = tourSeo(tour({ short_description: '<p>Big cats &amp; the <strong>crater</strong>.</p>' }), 'https://site.test', '/images/serengeti.jpg');
	assert.equal(seo.description, 'Big cats & the crater.');
	assert.equal(seo.canonical, 'https://site.test/tours/classic-northern-safari');
});

test('share image is absolute and falls back to the bundled photo', () => {
	assert.equal(tourSeo(tour(), 'https://site.test', '/images/serengeti.jpg').image, 'https://site.test/images/serengeti.jpg');
	assert.equal(tourSeo(tour({ main_image_url: 'https://cdn.example/main.jpg', og_image_url: 'https://cdn.example/og.jpg' }), 'https://site.test', '/x.jpg').image, 'https://cdn.example/og.jpg');
	assert.equal(tourSeo(tour({ main_image_url: 'javascript:alert(1)' }), 'https://site.test', '/x.jpg').image, 'https://site.test/x.jpg');
});

test('JSON-LD lists the days in order and cannot close its script tag', () => {
	const seo = tourSeo(
		tour({ title: 'Evil </script><script>alert(1)</script>', itinerary_days: [{ id: 'b', day_number: 2, title: 'Serengeti', summary: 'Full day' }, { id: 'a', day_number: 1, title: 'Arrive', destination: { id: 'x', name: 'Arusha', slug: 'arusha' } }] }),
		'https://site.test',
		'/x.jpg'
	);
	assert.ok(!seo.jsonLd.includes('<'));
	const schema = JSON.parse(seo.jsonLd);
	assert.equal(schema['@type'], 'TouristTrip');
	assert.deepEqual(schema.itinerary.itemListElement.map((item: { name: string }) => item.name), ['Day 1: Arrive', 'Day 2: Serengeti']);
	assert.equal(schema.itinerary.itemListElement[0].item.name, 'Arusha');
	assert.equal(schema.itinerary.itemListElement[1].description, 'Full day');
	assert.equal(schema.offers, undefined);
});

test('clip cuts long text on a word boundary', () => {
	assert.equal(clip('short'), 'short');
	const text = 'word '.repeat(60).trim();
	const clipped = clip(text);
	assert.ok(clipped.length <= 160);
	assert.ok(clipped.endsWith('word…'));
});
