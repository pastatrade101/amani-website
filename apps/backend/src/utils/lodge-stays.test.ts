import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  featuredTourCards,
  isPublicStay,
  lodgeLevelsForStyle,
  nearbyStayCard,
  parseStayFilters,
  stayDestination,
  staySearchTerm,
  styleForLodgeLevel,
  toursUsingEachLodge,
  withoutPrivateRates
} from './lodge-stays';

/**
 * The public Stays pages filter, count and link lodges by these rules, so a
 * visitor never meets a draft, a hidden property or a price the operator keeps
 * private, and a lodge is tied to a tour only by a real itinerary link.
 */

describe('lodge levels and safari styles', () => {
  it('maps each level to the style the frontend uses', () => {
    assert.equal(styleForLodgeLevel('BUDGET'), 'budget');
    assert.equal(styleForLodgeLevel('MID_RANGE'), 'midrange');
    assert.equal(styleForLodgeLevel('LUXURY'), 'luxury');
    assert.equal(styleForLodgeLevel('PREMIUM_LUXURY'), 'luxury');
    assert.equal(styleForLodgeLevel('luxury'), 'luxury');
  });

  it('reads unknown or missing levels as midrange', () => {
    assert.equal(styleForLodgeLevel(null), 'midrange');
    assert.equal(styleForLodgeLevel('CONSTRUCTOR'), 'midrange');
  });

  it('lists every level that fits a style', () => {
    assert.deepEqual(lodgeLevelsForStyle('luxury'), ['LUXURY', 'PREMIUM_LUXURY']);
    assert.deepEqual(lodgeLevelsForStyle('budget'), ['BUDGET']);
  });
});

describe('stay list filters', () => {
  it('leaves everything open when nothing is asked for', () => {
    assert.deepEqual(parseStayFilters({}), { levels: null, country: null, destination: { kind: 'any' }, matchesNothing: false });
    assert.equal(parseStayFilters({ style: 'all', country: 'all', destination_id: 'all' }).matchesNothing, false);
  });

  it('turns a style into its accommodation levels', () => {
    assert.deepEqual(parseStayFilters({ style: 'Luxury' }).levels, ['LUXURY', 'PREMIUM_LUXURY']);
  });

  it('matches countries from the East African list without regard to case', () => {
    assert.equal(parseStayFilters({ country: 'kenya' }).country, 'Kenya');
    assert.equal(parseStayFilters({ country: 'democratic republic of the congo' }).country, 'Democratic Republic of the Congo');
  });

  it('answers empty for values no stay can have, instead of ignoring them', () => {
    assert.equal(parseStayFilters({ style: 'glamping' }).matchesNothing, true);
    assert.equal(parseStayFilters({ country: 'France' }).matchesNothing, true);
    // The id is written into a PostgREST or() filter, so it must be an id.
    assert.equal(parseStayFilters({ destination_id: 'x),status.eq.draft' }).matchesNothing, true);
    // Postgres would reject these booleans and fail the list with a 500.
    assert.equal(parseStayFilters({ is_featured: 'maybe' }).matchesNothing, true);
    assert.equal(parseStayFilters({ show_property_publicly: 'yes-please' }).matchesNothing, true);
    assert.equal(parseStayFilters({ is_featured: 'TRUE', show_property_publicly: 'null' }).matchesNothing, false);
  });

  it('reads a destination id, or "null" for stays with none', () => {
    const id = '290915D2-EF48-4DA3-9488-FA28806A2FE4';
    assert.deepEqual(parseStayFilters({ destination_id: id }).destination, { kind: 'id', id: id.toLowerCase() });
    assert.deepEqual(parseStayFilters({ destination_id: 'null' }).destination, { kind: 'none' });
  });

  it('keeps search text from closing the or() group', () => {
    assert.equal(staySearchTerm(' Serengeti (north), "camp" 100% '), 'Serengeti north camp 100');
  });
});

describe('what a visitor may see', () => {
  it('shows only published, public, live properties', () => {
    assert.equal(isPublicStay({ status: 'published', show_property_publicly: true }), true);
    assert.equal(isPublicStay({ status: 'published', show_property_publicly: null }), true);
    assert.equal(isPublicStay({ status: 'draft', show_property_publicly: true }), false);
    assert.equal(isPublicStay({ status: 'published', show_property_publicly: false }), false);
    assert.equal(isPublicStay({ status: 'published', deleted_at: '2026-01-01' }), false);
    assert.equal(isPublicStay(null), false);
  });

  it('drops the nightly price unless the property shows its rates', () => {
    assert.equal(withoutPrivateRates({ price_per_night_from: 450, show_rates_publicly: false }).price_per_night_from, null);
    assert.equal(withoutPrivateRates({ price_per_night_from: 450 }).price_per_night_from, null);
    assert.equal(withoutPrivateRates({ price_per_night_from: 450, show_rates_publicly: true }).price_per_night_from, 450);
  });

  it('links a destination only when its page is published, except for the CMS', () => {
    const draft = { id: 'd1', name: 'Tarangire National Park', slug: 'tarangire', region: 'Northern Circuit', country: 'Tanzania', status: 'draft' };
    assert.equal(stayDestination(draft, { staff: false }), null);
    assert.deepEqual(stayDestination({ ...draft, status: 'published' }, { staff: false }), {
      id: 'd1',
      name: 'Tarangire National Park',
      slug: 'tarangire',
      region: 'Northern Circuit',
      country: 'Tanzania'
    });
    assert.equal(stayDestination(draft, { staff: true })?.slug, 'tarangire');
    assert.equal(stayDestination(null, { staff: false }), null);
  });
});

describe('tours that sleep at each lodge', () => {
  const classic = { id: 't1', title: 'Serengeti Classic', slug: 'serengeti-classic', status: 'published' };
  const draft = { id: 't2', title: 'Arusha Draft', slug: 'arusha-draft', status: 'draft' };
  const northern = { id: 't3', title: 'Northern Circuit', slug: 'northern-circuit', status: 'published' };

  const stays = [
    { lodge_id: 'lodge-a', safari_style: 'luxury', day: { id: 'd1', day_number: 2, tour: classic } },
    { lodge_id: 'lodge-a', safari_style: 'midrange', day: { id: 'd1', day_number: 2, tour: classic } },
    { lodge_id: 'lodge-a', safari_style: 'luxury', day: { id: 'd2', day_number: 3, tour: classic } },
    { lodge_id: 'lodge-b', safari_style: 'budget', day: { id: 'd7', day_number: 1, tour: draft } }
  ];
  const legacy = [
    // Has per-style stays, which already describe it.
    { accommodation_id: 'lodge-a', id: 'd1', day_number: 2, tour: classic, stays: [{ safari_style: 'midrange' }] },
    // Not moved to stays yet: counts as midrange.
    { accommodation_id: 'lodge-b', id: 'd9', day_number: 4, tour: northern, stays: [] }
  ];

  it('groups one batched read per lodge, with styles and days', () => {
    const usage = toursUsingEachLodge(stays, legacy, { publishedOnly: false });
    assert.deepEqual(usage.get('lodge-a'), [
      { id: 't1', title: 'Serengeti Classic', slug: 'serengeti-classic', status: 'published', styles: ['midrange', 'luxury'], days: [2, 3] }
    ]);
    assert.deepEqual(usage.get('lodge-b')?.map((tour) => tour.id), ['t2', 't3']);
  });

  it('counts only published tours for public pages', () => {
    const usage = toursUsingEachLodge(stays, legacy, { publishedOnly: true });
    assert.deepEqual(usage.get('lodge-b')?.map((tour) => [tour.id, tour.styles]), [['t3', ['midrange']]]);
    assert.equal(usage.get('lodge-c'), undefined);
  });
});

describe('featured_in_tours cards', () => {
  const TODAY = '2026-10-15';
  const usage = [
    { id: 't1', title: 'A', slug: 'a', status: 'published', styles: ['luxury' as const], days: [2, 3] },
    { id: 't9', title: 'Gone', slug: 'gone', status: 'published', styles: ['budget' as const], days: [1] }
  ];
  const tour = {
    id: 't1',
    title: 'A',
    slug: 'a',
    short_description: 'Short',
    duration_days: 5,
    duration_nights: 4,
    price_from: 2100,
    currency: 'USD',
    main_image_url: 'https://cdn.example/a.jpg',
    main_image_url_thumbnail: 'https://cdn.example/a-thumb.webp',
    banner_image_url: null,
    category_id: 'c1',
    tour_categories: { name: 'Wildlife', slug: 'wildlife' },
    tour_destinations: [
      { destination_id: 'x2', sort_order: 1, destinations: { id: 'x2', name: 'Ngorongoro', slug: 'ngorongoro' } },
      { destination_id: 'x1', sort_order: 0, destinations: { id: 'x1', name: 'Serengeti', slug: 'serengeti' } }
    ],
    tour_pricing_seasons: [
      {
        safari_style: 'luxury',
        season_type: 'STANDARD_SEASON',
        currency: 'USD',
        pricing_basis: 'PER_PERSON',
        status: 'ACTIVE',
        sort_order: 0,
        group_prices: [{ price: 4100, price_status: 'FIXED_PRICE' }]
      }
    ],
    full_description: 'never sent on a card'
  };

  it('keeps the tour-card fields, the pricing summary and where the lodge is used', () => {
    const [card, ...rest] = featuredTourCards(usage, [tour], TODAY);
    assert.equal(rest.length, 0, 'a tour the card read did not return is left out');
    assert.deepEqual(card.styles, ['luxury']);
    assert.deepEqual(card.days, [2, 3]);
    assert.deepEqual(card.pricing_summary, { styles: ['luxury'], from: 4100, currency: 'USD' });
    assert.deepEqual((card.tour_destinations as Array<{ destination_id: string }>).map((row) => row.destination_id), ['x1', 'x2']);
    assert.deepEqual(card.tour_categories, { name: 'Wildlife', slug: 'wildlife' });
    assert.equal(card.main_image_url_thumbnail, 'https://cdn.example/a-thumb.webp');
    assert.equal('full_description' in card, false);
    assert.equal('tour_pricing_seasons' in card, false);
  });

  it('says the pricing is unknown when the seasons could not be read', () => {
    const { tour_pricing_seasons: _seasons, ...withoutSeasons } = tour;
    assert.equal(featuredTourCards(usage, [withoutSeasons], TODAY)[0].pricing_summary, null);
  });
});

describe('nearby_stays cards', () => {
  it('carries identity, style, images and destination only', () => {
    const card = nearbyStayCard({
      id: 'l2',
      name: 'Tarangire Camp',
      slug: 'tarangire-camp',
      lodge_type: 'TENTED_CAMP',
      accommodation_level: 'PREMIUM_LUXURY',
      hero_image_url: null,
      image_url: null,
      cover_image_url: 'https://cdn.example/cover.jpg',
      destinations: { name: 'Tarangire National Park', slug: 'tarangire' },
      description: '<p>Long text</p>',
      price_per_night_from: 900
    });
    assert.equal(card.style, 'luxury');
    assert.equal(card.cover_image_url, 'https://cdn.example/cover.jpg');
    assert.equal('image_url_thumbnail' in card, false);
    assert.equal('description' in card, false);
    assert.equal('price_per_night_from' in card, false);
  });
});
