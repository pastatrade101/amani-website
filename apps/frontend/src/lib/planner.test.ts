import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyAnswers, travellersText, whenText, type PlanAnswers } from './planner/options.js';
import { planHref } from './planner/plan-href.js';
import { budgetScale, comfortOptions, plannerTour, popularLength, recommend, seasonFor, tripTypes, type PlannerTour } from './planner/planner.js';
import type { Tour } from './types/api.js';

const tour = (overrides: Partial<PlannerTour> = {}): PlannerTour => ({
	id: overrides.slug ?? 't', title: 'Northern safari', slug: 't', days: 6, category: 'wildlife', price: 2000, styles: ['midrange'], places: [{ slug: 'serengeti', name: 'Serengeti' }], text: 'northern safari game drives', thumbnail: '', ...overrides
});
const answers = (overrides: Partial<PlanAnswers> = {}): PlanAnswers => ({ ...emptyAnswers(2027), ...overrides });

test('planHref carries only slugs and the place of the link', () => {
	assert.equal(planHref({ from: 'header' }), '/plan-my-trip?from=header');
	assert.equal(planHref({ tour: 'serengeti-classic', from: 'tour_page' }), '/plan-my-trip?tour=serengeti-classic&from=tour_page');
	assert.equal(planHref({ destination: 'a b@c.com', from: 'Bad From!' }), '/plan-my-trip');
});

test('trip types are the categories with published tours, busiest first', () => {
	const tours = [tour({ slug: 'a', category: 'beach', days: 4 }), tour({ slug: 'b', category: 'wildlife', days: 7 }), tour({ slug: 'c', category: 'wildlife', days: 3 })];
	const types = tripTypes([{ slug: 'beach', name: 'Beach' }, { slug: 'wildlife', name: 'Wildlife' }, { slug: 'empty', name: 'Empty' }], tours);
	assert.deepEqual(types.map((type) => [type.slug, type.count, type.minDays]), [['wildlife', 2, 3], ['beach', 1, 4]]);
});

test('a season can wrap the year end', () => {
	const seasons = [{ name: 'Short rains', start_month: 11, end_month: 2, best_for: null, description: null }, { name: 'Dry season', start_month: 6, end_month: 10, best_for: 'Game viewing', description: null }];
	assert.equal(seasonFor(seasons, 0)?.name, 'Short rains');
	assert.equal(seasonFor(seasons, 7)?.name, 'Dry season');
	assert.equal(seasonFor(seasons, 3), null);
});

test('plannerTour keeps a USD price only and falls back to the budget tier', () => {
	const base = { id: '1', title: 'T', slug: 't', duration_days: 5, currency: 'EUR', price_from: 900, budget_tier: 'mid_range' } as Tour;
	assert.equal(plannerTour(base).price, null);
	assert.deepEqual(plannerTour(base).styles, ['midrange']);
	const priced = plannerTour({ ...base, currency: 'USD', pricing_summary: { styles: ['budget', 'luxury'], from: 1500, currency: 'USD' } });
	assert.equal(priced.price, 1500);
	assert.deepEqual(priced.styles, ['budget', 'luxury']);
});

test('comfort, budget and length figures are counted from the catalogue', () => {
	const tours = [tour({ slug: 'a', price: 1000, styles: ['budget'], days: 3 }), tour({ slug: 'b', price: 3000, styles: ['midrange'], days: 6 }), tour({ slug: 'c', price: 5000, styles: ['midrange'], days: 7 })];
	const comfort = comfortOptions(tours, [{ id: 's', name: 'Camp', slug: 'camp', style: 'luxury', place: '' }]);
	assert.deepEqual(comfort.map((c) => [c.id, c.tours, c.stays, c.from]), [['budget', 1, 0, 1000], ['midrange', 2, 0, 3000], ['luxury', 0, 1, null]]);
	assert.deepEqual(budgetScale(tours), { min: 1000, max: 5000, step: 100, start: 3000 });
	assert.equal(popularLength(tours), '5-7');
});

test('recommend keeps to the chosen type, except the tour the visitor came from', () => {
	const tours = [tour({ slug: 'beach-week', category: 'beach' }), tour({ slug: 'safari-6', category: 'wildlife', days: 6 }), tour({ slug: 'safari-12', category: 'wildlife', days: 12, price: 9000 })];
	const picks = recommend(answers({ types: [{ slug: 'wildlife', name: 'Wildlife' }], length: '5-7', budget: 3000 }), tours);
	assert.deepEqual(picks.map((p) => p.tour.slug), ['safari-6', 'safari-12']);
	assert.match(picks[0].reasons.join(' | '), /6 days, about the length you want/);
	const fromBeach = recommend(answers({ types: [{ slug: 'wildlife', name: 'Wildlife' }], context: { kind: 'tour', slug: 'beach-week', name: 'Beach week' } }), tours);
	assert.equal(fromBeach[0].tour.slug, 'beach-week');
	assert.equal(fromBeach[0].reasons[0], 'The trip you were looking at');
	assert.deepEqual(recommend(answers(), tours), []);
});

test('answers read back in plain words', () => {
	assert.equal(travellersText(answers({ party: 'family', adults: 2, children: 2, childAges: [8, null] })), 'Family · 2 adults, 2 children (age 8)');
	assert.equal(travellersText(answers({ party: 'couple', adults: 5 })), 'Couple · 2 adults');
	assert.equal(whenText(answers({ month: 6 })), 'July 2027');
	assert.equal(whenText(answers({ dateMode: 'exact', startDate: '2027-07-04', endDate: '2027-07-15' })), '4 Jul 2027 to 15 Jul 2027');
	assert.equal(whenText(answers({ dateUnsure: true })), 'Not sure yet');
});
