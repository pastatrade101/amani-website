import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from './api-response';
import {
  dayImageFields,
  legacyStayFields,
  legacyStyleFor,
  normaliseStays,
  normaliseTourDetail,
  planDays,
  planImages,
  referencedIds,
  summariseToursUsingLodge,
  textListRows,
  type DayInput,
  type DayPlan,
  type ExistingDay
} from './tour-content';

const TOUR = 'tour-1';

const rejects422 = (run: () => unknown, message: RegExp) =>
  assert.throws(run, (error: unknown) => error instanceof AppError && error.statusCode === 422 && message.test(error.message));

/**
 * Apply a plan in the service's order, one row at a time, the way Postgres
 * checks a non-deferrable UNIQUE(tour_id, day_number): a clash at any row fails.
 */
const applyPlan = (existing: readonly ExistingDay[], plan: DayPlan) => {
  const numbers = new Map(existing.map((day) => [day.id, day.day_number]));
  const put = (id: string, dayNumber: number) => {
    for (const [other, taken] of numbers) {
      if (other !== id && taken === dayNumber) throw new Error(`day ${dayNumber} is taken by ${other}`);
    }
    numbers.set(id, dayNumber);
  };
  for (const id of plan.remove) numbers.delete(id);
  for (const row of plan.park) put(row.id, row.day_number);
  for (const day of plan.keep) put(day.id, day.row.day_number);
  plan.add.forEach((day, index) => put(`new-${index}`, day.row.day_number));
  return numbers;
};

const day = (id: string, dayNumber: number, extra: Partial<ExistingDay> = {}): ExistingDay => ({
  id,
  day_number: dayNumber,
  title: `Day ${dayNumber}`,
  ...extra
});

describe('stays', () => {
  it('keeps one stay per style in Budget → Luxury order and drops empty ones', () => {
    const stays = normaliseStays([
      { safari_style: 'luxury', lodge_id: 'lodge-l' },
      { safari_style: 'budget', accommodation: '  Tent camp ' },
      { safari_style: 'midrange', lodge_id: '', accommodation: '   ' },
      { safari_style: 'luxury', lodge_id: 'lodge-other' }
    ]);
    assert.deepEqual(stays, [
      { safari_style: 'budget', lodge_id: null, accommodation: 'Tent camp' },
      { safari_style: 'luxury', lodge_id: 'lodge-l', accommodation: null }
    ]);
  });

  it('mirrors the midrange stay into the legacy columns, else the first', () => {
    const all = normaliseStays([
      { safari_style: 'budget', lodge_id: 'b' },
      { safari_style: 'midrange', lodge_id: 'm', accommodation: 'Mid Lodge' },
      { safari_style: 'luxury', lodge_id: 'l' }
    ]);
    assert.deepEqual(legacyStayFields(all), { accommodation_id: 'm', accommodation: 'Mid Lodge' });
    assert.deepEqual(legacyStayFields(all.filter((stay) => stay.safari_style !== 'midrange')), { accommodation_id: 'b', accommodation: null });
    assert.deepEqual(legacyStayFields([]), { accommodation_id: null, accommodation: null });
  });

  it('points a legacy edit at midrange unless the day only has other styles', () => {
    assert.equal(legacyStyleFor([]), 'midrange');
    assert.equal(legacyStyleFor(['luxury', 'midrange']), 'midrange');
    assert.equal(legacyStyleFor(['luxury', 'budget']), 'budget');
    assert.equal(legacyStyleFor(['luxury']), 'luxury');
  });
});

describe('planning the itinerary days', () => {
  it('swaps two days without ever putting both on one number', () => {
    const existing = [day('a', 1), day('b', 2)];
    const plan = planDays(TOUR, existing, [
      { id: 'b', day_number: 1, title: 'Arrive' },
      { id: 'a', day_number: 2, title: 'Serengeti' }
    ]);
    assert.equal(plan.park.length, 2);
    assert.ok(plan.park.every((row) => row.day_number >= 1000));
    assert.deepEqual(Object.fromEntries(applyPlan(existing, plan)), { a: 2, b: 1 });
  });

  it('parks above any number already in use', () => {
    const existing = [day('a', 1), day('odd', 1200)];
    const plan = planDays(TOUR, existing, [
      { id: 'odd', day_number: 1, title: 'First' },
      { id: 'a', day_number: 2, title: 'Second' }
    ]);
    assert.ok(plan.park.every((row) => row.day_number > 1200));
    assert.doesNotThrow(() => applyPlan(existing, plan));
  });

  it('never trips the unique day number for any reorder, removal or addition', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let round = 0; round < 300; round += 1) {
      const existing = Array.from({ length: 1 + Math.floor(random() * 8) }, (_, index) => day(`d${index}`, index + 1));
      const kept = existing.filter(() => random() > 0.25);
      const fresh = Math.floor(random() * 3);
      const order = [...kept.map((item) => item.id), ...Array.from({ length: fresh }, () => '')].sort(() => random() - 0.5);
      const input: DayInput[] = order.map((id, index) => ({ ...(id ? { id } : {}), day_number: index + 1, title: `Day ${index + 1}` }));

      const plan = planDays(TOUR, existing, input);
      const result = applyPlan(existing, plan);
      assert.equal(result.size, input.length);
      assert.deepEqual([...result.values()].sort((a, b) => a - b), input.map((item) => item.day_number));
    }
  });

  it('removes the days the payload no longer lists and keeps ids of the rest', () => {
    const plan = planDays(TOUR, [day('a', 1), day('b', 2), day('c', 3)], [
      { id: 'a', day_number: 1, title: 'One' },
      { id: 'c', day_number: 2, title: 'Two' },
      { day_number: 3, title: 'New' }
    ]);
    assert.deepEqual(plan.remove, ['b']);
    assert.deepEqual(plan.keep.map((item) => item.id), ['a', 'c']);
    assert.equal(plan.add.length, 1);
    assert.equal(plan.add[0].row.tour_id, TOUR);
  });

  it('refuses a day of another tour, a repeated day and a repeated number', () => {
    const existing = [day('a', 1), day('b', 2)];
    rejects422(() => planDays(TOUR, existing, [{ id: 'elsewhere', day_number: 1, title: 'Nope' }]), /not part of this tour/);
    rejects422(
      () => planDays(TOUR, existing, [{ id: 'a', day_number: 1, title: 'One' }, { id: 'a', day_number: 2, title: 'Two' }]),
      /listed twice/
    );
    rejects422(
      () => planDays(TOUR, existing, [{ id: 'a', day_number: 1, title: 'One' }, { day_number: 1, title: 'Also one' }]),
      /appears more than once/
    );
  });

  it('has no travel mode on day 1, however the day got there', () => {
    const plan = planDays(TOUR, [day('a', 2, { travel_mode: 'FLY' })], [
      { id: 'a', day_number: 1, title: 'Now first', travel_mode: 'FLY' },
      { day_number: 2, title: 'Drive on', travel_mode: 'DRIVE' }
    ]);
    assert.equal(plan.keep[0].row.travel_mode, null);
    assert.equal(plan.add[0].row.travel_mode, 'DRIVE');
  });

  it('leads with the first photo and keeps stored photos the payload left out', () => {
    const existing = [day('a', 1, { image_urls: ['https://x.test/1.jpg', 'https://x.test/2.jpg'], image_url: 'https://x.test/1.jpg' })];
    const kept = planDays(TOUR, existing, [{ id: 'a', day_number: 1, title: 'One' }]);
    assert.deepEqual(kept.keep[0].row.image_urls, ['https://x.test/1.jpg', 'https://x.test/2.jpg']);

    const replaced = planDays(TOUR, existing, [
      { id: 'a', day_number: 1, title: 'One', image_urls: ['https://x.test/3.jpg', 'https://x.test/3.jpg', 'https://x.test/1.jpg'] }
    ]);
    assert.deepEqual(replaced.keep[0].row.image_urls, ['https://x.test/3.jpg', 'https://x.test/1.jpg']);
    assert.equal(replaced.keep[0].row.image_url, 'https://x.test/3.jpg');

    const cleared = planDays(TOUR, existing, [{ id: 'a', day_number: 1, title: 'One', image_urls: [] }]);
    assert.equal(cleared.keep[0].row.image_url, null);

    // A day saved before image_urls existed still has its single photo.
    const legacy = planDays(TOUR, [day('a', 1, { image_urls: [], image_url: 'https://x.test/old.jpg' })], [{ id: 'a', day_number: 1, title: 'One' }]);
    assert.deepEqual(legacy.keep[0].row.image_urls, ['https://x.test/old.jpg']);
  });

  it('keeps a stored field the payload leaves out, and clears one sent as null', () => {
    const existing = [day('a', 1, { summary: 'Stored summary', meals: 'Breakfast', destination_id: 'dest-1' })];
    const plan = planDays(TOUR, existing, [{ id: 'a', day_number: 1, title: '  Arrival  ', meals: null }]);
    const row = plan.keep[0].row;
    assert.equal(row.title, 'Arrival');
    assert.equal(row.summary, 'Stored summary');
    assert.equal(row.destination_id, 'dest-1');
    assert.equal(row.meals, null);

    const fresh = planDays(TOUR, [], [{ day_number: 1, title: 'New' }]).add[0].row;
    assert.equal(fresh.summary, null);
    assert.deepEqual(fresh.image_urls, []);
  });

  it('only runs the rich-text sanitiser on a description that was sent', () => {
    const seen: string[] = [];
    const clean = (html: string) => {
      seen.push(html);
      return html.replace(/<script.*?<\/script>/g, '');
    };
    const existing = [day('a', 1, { description: '<p>Stored</p>' }), day('b', 2)];
    const plan = planDays(
      TOUR,
      existing,
      [
        { id: 'a', day_number: 1, title: 'One' },
        { id: 'b', day_number: 2, title: 'Two', description: '<p>Hi</p><script>x</script>' }
      ],
      clean
    );
    assert.deepEqual(seen, ['<p>Hi</p><script>x</script>']);
    assert.equal(plan.keep[0].row.description, '<p>Stored</p>');
    assert.equal(plan.keep[1].row.description, '<p>Hi</p>');
  });

  it('tidies activities into one per line', () => {
    const plan = planDays(TOUR, [], [{ day_number: 1, title: 'One', activities: ' Game drive \n\n  Sundowner\r\n' }]);
    assert.equal(plan.add[0].row.activities, 'Game drive\nSundowner');
  });

  it('replaces stays only when sent, and keeps the legacy columns in step', () => {
    const existing = [
      day('a', 1, { accommodation_id: 'old', accommodation: null, stays: [{ safari_style: 'midrange' }, { safari_style: 'luxury' }] }),
      day('b', 2, { accommodation_id: 'kept', stays: [{ safari_style: 'midrange' }] })
    ];
    const plan = planDays(TOUR, existing, [
      { id: 'a', day_number: 1, title: 'One', stays: [{ safari_style: 'luxury', lodge_id: 'lux' }, { safari_style: 'budget', accommodation: 'Camp' }] },
      { id: 'b', day_number: 2, title: 'Two' }
    ]);
    const [first, second] = plan.keep;
    assert.deepEqual(first.stays?.map((stay) => stay.safari_style), ['budget', 'luxury']);
    assert.deepEqual(first.dropStyles, ['midrange']);
    assert.equal(first.row.accommodation_id, null);
    assert.equal(first.row.accommodation, 'Camp');
    assert.equal(second.stays, undefined);
    assert.deepEqual(second.dropStyles, []);
    assert.equal(second.row.accommodation_id, 'kept');
  });

  it('collects each referenced lodge and destination once', () => {
    assert.deepEqual(
      referencedIds([
        { day_number: 1, title: 'One', destination_id: 'd1', stays: [{ safari_style: 'midrange', lodge_id: 'l1' }] },
        { day_number: 2, title: 'Two', destination_id: 'd1', stays: [{ safari_style: 'budget', lodge_id: 'l1' }, { safari_style: 'luxury', lodge_id: 'l2' }] }
      ]),
      { lodgeIds: ['l1', 'l2'], destinationIds: ['d1'] }
    );
  });
});

describe('lists and gallery', () => {
  it('numbers inclusions in the order given', () => {
    assert.deepEqual(textListRows(TOUR, ['Park fees', '  Guide ']), [
      { tour_id: TOUR, title: 'Park fees', sort_order: 0 },
      { tour_id: TOUR, title: 'Guide', sort_order: 1 }
    ]);
  });

  it('updates, adds and removes gallery photos in the order given', () => {
    const plan = planImages(TOUR, ['i1', 'i2', 'i3'], [
      { image_url: 'https://x.test/new.jpg', is_featured: true },
      { id: 'i3', image_url: 'https://x.test/3.jpg', alt_text: '' }
    ]);
    assert.deepEqual(plan.remove, ['i1', 'i2']);
    assert.equal(plan.add[0].sort_order, 0);
    assert.equal(plan.add[0].is_featured, true);
    assert.deepEqual(plan.keep[0], { id: 'i3', tour_id: TOUR, image_url: 'https://x.test/3.jpg', alt_text: null, caption: null, sort_order: 1, is_featured: false });
  });

  it('refuses two featured photos and a photo of another tour', () => {
    rejects422(
      () => planImages(TOUR, [], [{ image_url: 'https://x.test/a.jpg', is_featured: true }, { image_url: 'https://x.test/b.jpg', is_featured: true }]),
      /one gallery photo/
    );
    rejects422(() => planImages(TOUR, ['i1'], [{ id: 'other', image_url: 'https://x.test/a.jpg' }]), /not part of this tour/);
  });
});

describe('the older single-day form', () => {
  const stored = ['https://x.test/1.jpg', 'https://x.test/2.jpg'];

  it('takes a full photo list as sent', () => {
    assert.deepEqual(dayImageFields({ image_urls: ['https://x.test/9.jpg'] }, stored), {
      image_urls: ['https://x.test/9.jpg'],
      image_url: 'https://x.test/9.jpg'
    });
  });

  it('swaps the lead photo and keeps the others', () => {
    assert.deepEqual(dayImageFields({ image_url: 'https://x.test/9.jpg' }, stored), {
      image_urls: ['https://x.test/9.jpg', 'https://x.test/2.jpg'],
      image_url: 'https://x.test/9.jpg'
    });
  });

  it('moves the next photo up when the lead is cleared', () => {
    assert.deepEqual(dayImageFields({ image_url: '' }, stored), { image_urls: ['https://x.test/2.jpg'], image_url: 'https://x.test/2.jpg' });
  });

  it('writes only image_url before the photo list exists, and nothing when neither was sent', () => {
    assert.deepEqual(dayImageFields({ image_url: 'https://x.test/9.jpg' }, null), { image_url: 'https://x.test/9.jpg' });
    assert.deepEqual(dayImageFields({ title: 'Only a title' }, stored), {});
  });
});

describe('reading a tour back', () => {
  const record = () => ({
    status: 'published',
    itinerary_days: [
      {
        day_number: 2,
        title: 'Two',
        image_url: 'https://x.test/2.jpg',
        stays: [
          { safari_style: 'luxury', lodge_id: 'l' },
          { safari_style: 'budget', lodge_id: 'b' }
        ]
      },
      {
        day_number: 1,
        title: 'One',
        image_urls: [],
        image_url: null,
        accommodation_id: 'legacy-lodge',
        accommodation: null,
        lodge: { id: 'legacy-lodge', name: 'Old Lodge', slug: 'old-lodge', lodge_images: [] }
      }
    ],
    tour_inclusions: [{ title: 'B', sort_order: 2 }, { title: 'A', sort_order: 1 }],
    tour_pricing_seasons: [
      { sort_order: 2, group_prices: [{ minimum_travelers: 2, sort_order: 0 }, { minimum_travelers: 1, sort_order: 0 }] },
      { sort_order: 1, group_prices: [] }
    ],
    tour_activities: [
      { sort_order: 2, activity: { name: 'Draft', status: 'draft' } },
      { sort_order: 1, activity: { name: 'Live', status: 'published' } },
      { sort_order: 0, activity: null }
    ]
  });

  it('orders days, stays, lists and prices', () => {
    const tour = normaliseTourDetail(record(), { staff: false });
    assert.deepEqual(tour.itinerary_days.map((item: any) => item.day_number), [1, 2]);
    assert.deepEqual(tour.itinerary_days[1].stays.map((stay: any) => stay.safari_style), ['budget', 'luxury']);
    assert.deepEqual(tour.tour_inclusions.map((item: any) => item.title), ['A', 'B']);
    assert.deepEqual(tour.tour_pricing_seasons.map((season: any) => season.sort_order), [1, 2]);
    assert.deepEqual(tour.tour_pricing_seasons[1].group_prices.map((price: any) => price.minimum_travelers), [1, 2]);
  });

  it('reads a legacy single stay as the midrange stay, and a single photo as the list', () => {
    const [first, second] = normaliseTourDetail(record(), { staff: false }).itinerary_days;
    assert.deepEqual(first.stays, [
      {
        safari_style: 'midrange',
        lodge_id: 'legacy-lodge',
        accommodation: null,
        lodge: { id: 'legacy-lodge', name: 'Old Lodge', slug: 'old-lodge', lodge_type: null, accommodation_level: null, hero_image_url: null, image_url: null, status: null }
      }
    ]);
    assert.deepEqual(first.image_urls, []);
    assert.deepEqual(second.image_urls, ['https://x.test/2.jpg']);
    assert.equal(first.summary, null);
    assert.equal(first.destination, null);
  });

  it('keeps draft activities off public pages but shows them to the editor', () => {
    assert.deepEqual(normaliseTourDetail(record(), { staff: false }).tour_activities.map((link: any) => link.activity.name), ['Live']);
    assert.deepEqual(normaliseTourDetail(record(), { staff: true }).tour_activities.map((link: any) => link.activity.name), ['Live', 'Draft']);
  });
});

describe('tours that use a lodge', () => {
  it('lists styles and day numbers per tour, skipping deleted tours', () => {
    const safari = { id: 't1', title: 'Serengeti Classic', slug: 'serengeti-classic', status: 'published' };
    const draft = { id: 't2', title: 'Arusha Draft', slug: 'arusha-draft', status: 'draft' };
    const gone = { id: 't3', title: 'Deleted', slug: 'deleted', status: 'published', deleted_at: '2026-01-01' };
    const summary = summariseToursUsingLodge(
      [
        { safari_style: 'luxury', day: { id: 'd3', day_number: 3, tour: safari } },
        { safari_style: 'midrange', day: { id: 'd2', day_number: 2, tour: safari } },
        { safari_style: 'luxury', day: { id: 'd9', day_number: 1, tour: gone } }
      ],
      [
        // Has per-style stays, so they already describe it.
        { id: 'd2', day_number: 2, tour: safari, stays: [{ safari_style: 'midrange' }] },
        // Not migrated to stays yet: counts as midrange.
        { id: 'd5', day_number: 4, tour: draft, stays: [] },
        { id: 'd6', day_number: 1, tour: draft }
      ]
    );
    assert.deepEqual(summary, [
      { id: 't2', title: 'Arusha Draft', slug: 'arusha-draft', status: 'draft', styles: ['midrange'], days: [1, 4] },
      { id: 't1', title: 'Serengeti Classic', slug: 'serengeti-classic', status: 'published', styles: ['midrange', 'luxury'], days: [2, 3] }
    ]);
  });
});
