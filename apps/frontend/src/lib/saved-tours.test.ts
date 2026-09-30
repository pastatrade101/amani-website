import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSavedTours, SAVED_TOURS_MAX, toggleSavedTour, type SavedTour } from './saved-tours.js';

const tour = (slug: string): SavedTour => ({ slug, title: `Tour ${slug}`, image: '/images/serengeti.jpg', duration: '6 Days / 5 Nights' });

test('stored saved tours are read defensively', () => {
	assert.deepEqual(parseSavedTours(null), []);
	assert.deepEqual(parseSavedTours('not json'), []);
	assert.deepEqual(parseSavedTours('{"slug":"a"}'), []);
	const raw = JSON.stringify([tour('a'), { slug: 'Bad Slug!', title: 'x', image: '', duration: '' }, tour('a'), tour('b'), { slug: 'c' }]);
	assert.deepEqual(parseSavedTours(raw).map((item) => item.slug), ['a', 'b']);
});

test('the heart adds a tour at the front and removes it on a second press', () => {
	const once = toggleSavedTour([tour('a')], tour('b'));
	assert.deepEqual(once.map((item) => item.slug), ['b', 'a']);
	assert.deepEqual(toggleSavedTour(once, tour('a')).map((item) => item.slug), ['b']);
	const full = Array.from({ length: SAVED_TOURS_MAX }, (_, i) => tour(`t${i}`));
	assert.equal(toggleSavedTour(full, tour('new')).length, SAVED_TOURS_MAX);
});
