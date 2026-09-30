import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	bestForLabels,
	childrenPolicy,
	dayList,
	mapUrl,
	nightlyRate,
	nightsLabel,
	overnightNote,
	placeLine,
	stayCoordinates,
	stayFilters,
	stayGallery,
	stayLocation,
	stayPhoto,
	staysHref,
	stayStyle,
	stayStyleLabel,
	STAY_STYLES,
	stayTypeLabel,
	tourCategories
} from './stay-content.js';
import type { Stay } from './types/api.js';

const stay = (overrides: Partial<Stay> = {}): Stay => ({ id: 's1', name: 'Kuro Camp', slug: 'kuro-camp', ...overrides });
const id = '0de809b1-15ac-4111-b805-5bc25910c0ae';

test('filters keep known values only and always ask for published stays', () => {
	const { filters, page, query } = stayFilters(new URLSearchParams({ destination_id: id, style: 'Luxury', lodge_type: 'tented_camp', search: '  river  ', country: 'kenya', page: '3', status: 'draft' }));
	assert.deepEqual(filters, { search: 'river', destination_id: id, style: 'luxury', lodge_type: 'TENTED_CAMP', country: 'Kenya' });
	assert.equal(page, 3);
	assert.equal(query.get('status'), 'published');
	assert.equal(query.get('limit'), '12');
	assert.equal(query.get('style'), 'luxury');

	const junk = stayFilters(new URLSearchParams({ destination_id: 'all', style: 'ultra', lodge_type: 'CASTLE', country: 'France', page: '-4', search: 'x'.repeat(200) }));
	assert.deepEqual({ ...junk.filters, search: junk.filters.search.length }, { search: 150, destination_id: '', style: '', lodge_type: '', country: '' });
	assert.equal(junk.page, 1);
	for (const key of ['destination_id', 'style', 'lodge_type', 'country']) assert.equal(junk.query.has(key), false);
});

test('listing links drop empty values and page 1', () => {
	assert.equal(staysHref({ search: '', style: 'budget', destination_id: '' }), '/stays?style=budget#stay-results');
	assert.equal(staysHref({ style: 'budget' }, { style: '', page: '1' }), '/stays#stay-results');
	assert.equal(staysHref({ style: 'luxury' }, { page: '2' }, ''), '/stays?style=luxury&page=2');
});

test('style comes from the API, else from the lodge level', () => {
	assert.equal(stayStyle(stay({ style: 'budget', accommodation_level: 'LUXURY' })), 'budget');
	assert.equal(stayStyle(stay({ accommodation_level: 'PREMIUM_LUXURY' })), 'luxury');
	assert.equal(stayStyle(stay()), 'midrange');
	assert.equal(stayStyleLabel(stay({ accommodation_level: 'PREMIUM_LUXURY', style: 'luxury' })), 'Luxury · top-end');
	assert.equal(stayStyleLabel(stay({ style: 'budget' })), 'Budget');
	assert.deepEqual(STAY_STYLES.map((style) => style.label), ['Budget', 'Midrange', 'Luxury']);
	assert.ok(STAY_STYLES.every((style) => style.hint.length > 0));
});

test('type and location read as words', () => {
	assert.equal(stayTypeLabel('TENTED_CAMP'), 'Tented camp');
	assert.equal(stayTypeLabel('castle'), '');
	assert.equal(stayLocation(stay({ park_area: 'Central Serengeti', country: 'Tanzania', destinations: { name: 'Serengeti National Park', slug: 'serengeti' } })), 'Central Serengeti, Tanzania');
	assert.equal(stayLocation(stay({ country: 'Tanzania', destinations: { name: 'Tarangire National Park', slug: 'tarangire' } })), 'Tarangire National Park, Tanzania');
	assert.equal(stayLocation(stay({ region: 'Tanzania', country: 'Tanzania' })), 'Tanzania');
	assert.equal(stayLocation(stay()), '');
	assert.equal(placeLine(['Western rim of the Ngorongoro Crater', 'Ngorongoro Crater', 'Arusha Region']), 'Western rim of the Ngorongoro Crater, Arusha Region');
	assert.equal(placeLine([null, ' Tarangire ', 'tarangire', '']), 'Tarangire');
});

test('a stay without its own photo never borrows one that pretends to be it', () => {
	assert.deepEqual(stayPhoto(stay({ hero_image_url: 'https://cdn.example/hero.jpg', cover_image_url: 'https://cdn.example/cover.jpg' })), { kind: 'own', src: 'https://cdn.example/cover.jpg' });
	assert.deepEqual(stayPhoto(stay({ image_url_thumbnail: 'https://cdn.example/card.webp', image_url: 'https://cdn.example/card.jpg' })), { kind: 'own', src: 'https://cdn.example/card.webp' });
	// The park's landscape, named on the photo.
	assert.deepEqual(stayPhoto(stay({ destinations: { name: 'Tarangire National Park', slug: 'tarangire-national-park' } })), { kind: 'place', src: '/images/tarangire.jpg', place: 'Tarangire National Park' });
	assert.deepEqual(stayPhoto(stay({ park_area: 'Central Serengeti' })), { kind: 'place', src: '/images/serengeti.jpg', place: 'Central Serengeti' });
	// The destination's own CMS photo is a photo of that place too.
	assert.deepEqual(stayPhoto(stay(), { id, name: 'Katavi', slug: 'katavi', main_image_url: 'https://cdn.example/katavi.jpg' }), { kind: 'place', src: 'https://cdn.example/katavi.jpg', place: 'Katavi' });
	// Unknown place: no rotating spare wildlife shot, just the branded placeholder.
	assert.deepEqual(stayPhoto(stay({ destinations: { name: 'Katavi', slug: 'katavi' } })), { kind: 'none' });
	assert.deepEqual(stayPhoto(stay({ image_url: 'javascript:alert(1)' })), { kind: 'none' });
});

test('gallery leads with the chosen hero, then the cover, without repeats', () => {
	const photos = stayGallery({
		name: 'Kuro Camp',
		hero_image_url: 'https://cdn.example/hero.jpg',
		image_url: 'https://cdn.example/b.jpg',
		images: [
			{ id: 'b', image_url: 'https://cdn.example/b.jpg', sort_order: 1, caption: 'Tent interior' },
			{ id: 'a', image_url: 'https://cdn.example/a.jpg', sort_order: 0, alt_text: 'Main deck' },
			{ id: 'c', image_url: 'https://cdn.example/c.jpg', sort_order: 2, is_cover: true },
			{ id: 'x', image_url: 'javascript:alert(1)', sort_order: 3 }
		]
	});
	assert.deepEqual(photos.map((photo) => photo.src.split('/').pop()), ['hero.jpg', 'c.jpg', 'a.jpg', 'b.jpg']);
	assert.equal(photos[2].alt, 'Main deck');
	assert.equal(photos[3].alt, 'Tent interior');
	assert.equal(photos[1].alt, 'Kuro Camp: photo 2');
	assert.deepEqual(stayGallery({ name: 'Empty' }), []);
});

test('facts only say what the CMS says', () => {
	assert.equal(childrenPolicy({ children_allowed: false, minimum_child_age: 6 }), 'Adults only');
	assert.equal(childrenPolicy({ children_allowed: true, minimum_child_age: 6 }), 'Children aged 6 and over');
	assert.equal(childrenPolicy({ children_allowed: true }), 'Children welcome');
	assert.equal(childrenPolicy({}), '');
	assert.deepEqual(bestForLabels(['HONEYMOON', 'FAMILIES', 'families', 'Birders']), ['Honeymooners', 'Families', 'Birders']);
	assert.equal(nightsLabel(1), '1 night');
	assert.equal(nightsLabel(3), '3 nights');
	assert.equal(nightsLabel(null), '');
});

test('map links need real coordinates', () => {
	assert.deepEqual(stayCoordinates({ latitude: '-2.33', longitude: 34.83 }), { latitude: -2.33, longitude: 34.83 });
	assert.equal(stayCoordinates({ latitude: 0, longitude: 0 }), null);
	assert.equal(stayCoordinates({ latitude: 95, longitude: 10 }), null);
	assert.equal(stayCoordinates({ latitude: null, longitude: 10 }), null);
	assert.equal(stayCoordinates({ latitude: '', longitude: '' }), null);
	assert.equal(mapUrl({ latitude: -2.33, longitude: 34.83 }), 'https://www.google.com/maps?q=-2.33,34.83');
});

test('a nightly rate shows only when the property shares its rates', () => {
	assert.equal(nightlyRate({ show_rates_publicly: true, price_per_night_from: '450', currency: 'USD' }), 'From $450 per night');
	assert.equal(nightlyRate({ show_rates_publicly: false, price_per_night_from: 450 }), '');
	assert.equal(nightlyRate({ price_per_night_from: 450 }), '');
	assert.equal(nightlyRate({ show_rates_publicly: true, price_per_night_from: 0 }), '');
});

test('overnight notes name the styles and days', () => {
	assert.equal(dayList([1]), 'Day 1');
	assert.equal(dayList([3, 2]), 'Days 2–3');
	assert.equal(dayList([1, 4, 6, 7]), 'Days 1, 4 & 6–7');
	assert.equal(dayList([]), '');
	assert.equal(overnightNote({ styles: ['midrange'], days: [1] }), 'Midrange · Day 1');
	assert.equal(overnightNote({ styles: ['luxury', 'budget'], days: [2, 3] }), 'Budget & Luxury · Days 2–3');
	assert.equal(overnightNote({ styles: [], days: [4] }), 'Day 4');
});

test('tour categories are listed once each', () => {
	const other = '9a4b3a0e-7f7e-4c55-a1d3-2d7d41d1d0f1';
	assert.deepEqual(
		tourCategories([
			{ category_id: id, tour_categories: { name: 'Wildlife', slug: 'wildlife' } },
			{ category_id: id, tour_categories: { name: 'Wildlife', slug: 'wildlife' } },
			{ category_id: other, tour_categories: { name: 'Honeymoon', slug: 'honeymoon' } },
			{ category_id: null, tour_categories: { name: 'Orphan', slug: 'orphan' } }
		]),
		[{ id, name: 'Wildlife' }, { id: other, name: 'Honeymoon' }]
	);
});
