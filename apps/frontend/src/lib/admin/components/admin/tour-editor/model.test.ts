import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Tour } from '../../../types.js';
import {
  LIMITS,
  blankDay,
  cardPreviewTour,
  contentPayload,
  corePayload,
  dayFromRecord,
  emptyForm,
  findProblems,
  formFromTour,
  formatMeals,
  isEmptyDay,
  lowestFixedPrice,
  parseActivities,
  parseMeals,
  snapshot,
  timelineDay
} from './model.js';

const namedForm = () => {
  const form = emptyForm();
  form.title = 'Seven days';
  form.slug = 'seven-days';
  return form;
};

test('meals read and write as chips, and anything else stays custom', () => {
  assert.deepEqual(parseMeals('Breakfast, Lunch & Dinner'), ['Breakfast', 'Lunch', 'Dinner']);
  assert.deepEqual(parseMeals('B, L, D'), ['Breakfast', 'Lunch', 'Dinner']);
  assert.deepEqual(parseMeals('BLD'), ['Breakfast', 'Lunch', 'Dinner']);
  assert.deepEqual(parseMeals('B/D'), ['Breakfast', 'Dinner']);
  assert.deepEqual(parseMeals('dinner and breakfast'), ['Breakfast', 'Dinner']);
  assert.deepEqual(parseMeals(''), []);
  assert.equal(parseMeals('Breakfast & picnic lunch'), null);
  assert.equal(formatMeals(['Dinner', 'Breakfast']), 'Breakfast & Dinner');
  assert.equal(formatMeals(['Breakfast', 'Lunch', 'Dinner']), 'Breakfast, Lunch & Dinner');
  assert.equal(formatMeals(['Lunch']), 'Lunch');
});

test('activities split by line, or by comma on older single-line days', () => {
  assert.deepEqual(parseActivities('Game drive\nSundowner'), ['Game drive', 'Sundowner']);
  assert.deepEqual(parseActivities('Game drive, sundowner'), ['Game drive', 'sundowner']);
  assert.deepEqual(parseActivities(null), ['']);
});

test('a day saved before per-style stays opens with its lodge as the Midrange overnight', () => {
  const day = dayFromRecord({ id: 'd1', day_number: 1, title: 'Arrival', accommodation_id: 'lodge-1', image_url: 'https://x.test/a.jpg' });
  assert.equal(day.stays.midrange.lodge_id, 'lodge-1');
  assert.equal(day.stays.budget.lodge_id, '');
  assert.deepEqual(day.image_urls, ['https://x.test/a.jpg', '', '']);

  const named = dayFromRecord({ day_number: 2, title: 'Camp', accommodation: 'Seronera camp' });
  assert.deepEqual(named.stays.midrange, { lodge_id: '', accommodation: 'Seronera camp', custom: true });
});

test('per-style stays win over the legacy lodge', () => {
  const day = dayFromRecord({
    id: 'd1',
    day_number: 1,
    title: 'Serengeti',
    accommodation_id: 'legacy',
    stays: [
      { safari_style: 'luxury', lodge_id: 'lux' },
      { safari_style: 'budget', lodge_id: null, accommodation: 'Public campsite' }
    ]
  });
  assert.equal(day.stays.luxury.lodge_id, 'lux');
  assert.equal(day.stays.budget.accommodation, 'Public campsite');
  assert.equal(day.stays.midrange.lodge_id, '');
});

test('the content payload numbers days by position and drops empty stays', () => {
  const form = emptyForm();
  const first = blankDay();
  first.title = 'Arrival';
  first.travel_mode = 'FLY';
  first.stays.midrange.lodge_id = 'lodge-1';
  first.stays.midrange.accommodation = 'ignored when a lodge is set';
  const second = blankDay();
  second.title = 'Tarangire';
  second.travel_mode = 'DRIVE';
  second.activities = ['Game drive', ' ', 'Sundowner'];
  second.stays.budget = { lodge_id: '', accommodation: 'Tented camp', custom: true };
  form.days = [first, second];
  form.inclusions = ['Park fees', '  '];

  const { days, inclusions } = contentPayload(form);
  assert.equal(days[0].day_number, 1);
  assert.equal(days[0].travel_mode, null, 'day 1 has no leg into it');
  assert.deepEqual(days[0].stays, [{ safari_style: 'midrange', lodge_id: 'lodge-1', accommodation: null }]);
  assert.equal(days[1].day_number, 2);
  assert.equal(days[1].travel_mode, 'DRIVE');
  assert.equal(days[1].activities, 'Game drive\nSundowner');
  assert.deepEqual(days[1].stays, [{ safari_style: 'budget', lodge_id: null, accommodation: 'Tented camp' }]);
  assert.deepEqual(inclusions, ['Park fees']);
  assert.equal('id' in days[0], false, 'a new day is sent without an id');
});

test('number inputs that bound as numbers are read safely', () => {
  const form = emptyForm();
  form.title = 'Seven days';
  form.slug = 'seven-days';
  (form as unknown as Record<string, unknown>).duration_days = 7;
  (form as unknown as Record<string, unknown>).duration_nights = null;
  (form as unknown as Record<string, unknown>).price_from = 1850;
  const core = corePayload(form);
  assert.equal(core.duration_days, 7);
  assert.equal(core.duration_nights, 6, 'blank nights are days − 1');
  assert.equal(core.price_from, 1850);
  assert.deepEqual(findProblems(form), []);
});

test('publishing needs a destination, an at-a-glance line and a day', () => {
  const form = emptyForm();
  form.title = 'Seven days';
  form.slug = 'seven-days';
  form.status = 'published';
  const tabs = findProblems(form).map((problem) => problem.tab);
  assert.deepEqual(tabs, ['basics', 'basics', 'itinerary']);
});

test('an untitled day blocks the save and points at that day', () => {
  const form = emptyForm();
  form.title = 'Seven days';
  form.slug = 'seven-days';
  const day = blankDay();
  form.days = [day];
  const [problem] = findProblems(form);
  assert.equal(problem.tab, 'itinerary');
  assert.equal(problem.dayKey, day.key);
});

test('a stored tour round-trips without looking changed', () => {
  const tour = {
    id: 't1',
    title: 'Northern circuit',
    slug: 'northern-circuit',
    status: 'draft',
    duration_days: 3,
    duration_nights: 2,
    price_from: 0,
    currency: 'USD',
    budget_tier: 'mid_range',
    highlights: ['<p><strong>Big five</strong></p>', 'Crater floor'],
    destination_id: 'b',
    tour_destinations: [
      { destination_id: 'a', sort_order: 0 },
      { destination_id: 'b', sort_order: 1 }
    ],
    tour_inclusions: [{ title: 'Park fees', sort_order: 1 }, { title: 'Guide', sort_order: 0 }],
    tour_images: [
      { id: 'i1', image_url: 'https://x.test/1.jpg', is_featured: true, sort_order: 0 },
      { id: 'i2', image_url: 'https://x.test/2.jpg', is_featured: true, sort_order: 1 }
    ],
    itinerary_days: [
      { id: 'd2', day_number: 2, title: 'Crater' },
      { id: 'd1', day_number: 1, title: 'Arrival', meals: 'Dinner' }
    ]
  } as unknown as Tour;

  const form = formFromTour(tour);
  assert.equal(form.budget_tier, 'midrange');
  assert.deepEqual(form.destination_ids, ['b', 'a'], 'the primary destination comes first');
  assert.deepEqual(form.inclusions, ['Guide', 'Park fees']);
  assert.deepEqual(form.days.map((day) => day.id), ['d1', 'd2']);
  assert.deepEqual(form.images.map((image) => image.is_featured), [true, false], 'one featured photo at most');
  assert.deepEqual(form.highlights, ['Big five', 'Crater floor']);
  // An untouched highlight keeps its stored formatting.
  assert.equal(corePayload(form).highlights[0], '<p><strong>Big five</strong></p>');
  assert.equal(snapshot(formFromTour(tour)), snapshot(form));
  assert.ok(isEmptyDay(blankDay()));
  assert.equal(isEmptyDay(form.days[0]), false);
});

test('the lowest fixed price ignores on-request rows and inactive seasons', () => {
  const lowest = lowestFixedPrice([
    {
      safari_style: 'luxury',
      season_type: 'STANDARD_SEASON',
      season_name: 'Standard',
      currency: 'USD',
      pricing_basis: 'PER_PERSON',
      status: 'ACTIVE',
      group_prices: [
        { minimum_travelers: 1, price: 900, price_status: 'FIXED_PRICE' },
        { minimum_travelers: 2, price: null, price_status: 'ON_REQUEST' }
      ]
    },
    {
      safari_style: 'budget',
      season_type: 'STANDARD_SEASON',
      season_name: 'Old',
      currency: 'USD',
      pricing_basis: 'PER_PERSON',
      status: 'INACTIVE',
      group_prices: [{ minimum_travelers: 1, price: 100, price_status: 'FIXED_PRICE' }]
    }
  ]);
  assert.deepEqual(lowest, { amount: 900, currency: 'USD' });
});

test('text past a limit blocks the save on its own step, saying how long it is', () => {
  const form = namedForm();
  form.title = 'x'.repeat(LIMITS.title + 1);
  const [title] = findProblems(form);
  assert.equal(title.tab, 'basics');
  assert.equal(title.field, 'title');
  assert.match(title.message, new RegExp(`it has ${LIMITS.title + 1}`));

  const trip = namedForm();
  trip.highlights = Array(LIMITS.highlights + 1).fill('Crater');
  trip.end_location = 'x'.repeat(LIMITS.location + 1);
  assert.deepEqual(findProblems(trip).map((problem) => problem.tab), ['trip', 'trip']);

  const seo = namedForm();
  seo.meta_description = 'x'.repeat(LIMITS.metaDescription.target + 5);
  assert.deepEqual(findProblems(seo), [], 'past the search target is only a warning');
  seo.meta_description = 'x'.repeat(LIMITS.metaDescription.max + 1);
  assert.deepEqual(findProblems(seo).map((problem) => [problem.tab, problem.field]), [['seo', 'meta_description']]);
});

test('an over-long day points at that day', () => {
  const form = namedForm();
  const day = blankDay();
  day.title = 'Arrival';
  form.days = [blankDay(), day];
  form.days[0].title = 'Welcome';
  day.summary = 'x'.repeat(LIMITS.daySummary + 1);
  day.description = `<p>${'x'.repeat(LIMITS.dayDescription + 1)}</p>`;
  day.activities = Array(LIMITS.activities + 1).fill('Game drive');
  day.stays.luxury = { lodge_id: '', accommodation: 'x'.repeat(LIMITS.stayName + 1), custom: true };
  const problems = findProblems(form);
  assert.equal(problems.length, 4);
  assert.ok(problems.every((problem) => problem.tab === 'itinerary' && problem.dayKey === day.key));
  assert.match(problems[0].message, /^Day 2: keep the summary/);

  // Markup does not count against the description.
  day.summary = '';
  day.activities = ['Game drive'];
  day.stays.luxury.accommodation = 'Camp';
  day.description = Array(30).fill(`<p><strong>${'x'.repeat(90)}</strong></p>`).join('');
  assert.deepEqual(findProblems(form), []);
});

test('the card preview reads the form as the public card will', () => {
  const form = namedForm();
  form.title = '6-Day Tanzania Classic';
  form.duration_days = '6';
  form.destination_ids = ['s', 't'];
  form.main_image_url = '/not-absolute.jpg';
  form.price_from = '1850';
  const tour = cardPreviewTour(
    form,
    [
      { id: 't', name: 'Tarangire National Park', region: '', status: 'published', pinned: true },
      { id: 's', name: 'Serengeti National Park', region: '', status: 'published', pinned: true }
    ],
    []
  );
  assert.equal(tour.title, '6-Day Tanzania Classic');
  assert.equal(tour.duration_nights, 5, 'blank nights save as days − 1');
  assert.deepEqual(tour.tour_destinations?.map((link) => link.destinations?.name), ['Serengeti National Park', 'Tarangire National Park']);
  assert.equal(tour.main_image_url, null, 'the card falls back to a place photo');
  assert.equal(tour.price_from, 1850);
  assert.equal(tour.pricing_summary, null);
  assert.equal(cardPreviewTour(emptyForm(), [], []).title, 'Your safari title');
});

test('the day preview names the stay the timeline will show', () => {
  const day = blankDay();
  day.title = ' Serengeti ';
  day.travel_mode = 'FLY';
  day.stays.midrange = { lodge_id: 'l1', accommodation: '', custom: false };
  day.stays.budget = { lodge_id: '', accommodation: 'Public campsite', custom: true };
  const lodges = [{ id: 'l1', name: 'Four Seasons Safari Lodge', destination_id: '', destination_name: '', level: '', status: 'published' }];
  const preview = timelineDay(day, 1, lodges);
  assert.equal(preview.day_number, 2);
  assert.equal(preview.title, 'Serengeti');
  assert.equal(preview.travel_mode, 'FLY');
  assert.deepEqual(preview.stays?.map((stay) => stay.lodge?.name ?? stay.accommodation), ['Public campsite', 'Four Seasons Safari Lodge']);
  assert.equal(timelineDay(day, 0, lodges).travel_mode, null, 'day 1 has no leg into it');
});

test('photo addresses must be absolute before they reach the API', () => {
  const form = emptyForm();
  form.title = 'Seven days';
  form.slug = 'seven-days';
  const day = blankDay();
  day.title = 'Arrival';
  day.image_urls = ['/uploads/a.jpg', '', ''];
  form.days = [day];
  form.main_image_url = 'https://cdn.test/main.jpg';
  assert.deepEqual(findProblems(form).map((problem) => problem.tab), ['itinerary']);
  day.image_urls = ['https://cdn.test/a.jpg', '', ''];
  assert.deepEqual(findProblems(form), []);
});
