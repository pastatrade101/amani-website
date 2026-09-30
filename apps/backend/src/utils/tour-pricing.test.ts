import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pricingSummary, type SeasonForSummary } from './tour-pricing';

/**
 * A tour card's "from" price must be one the tour page's price table actually
 * shows, so the season picked per style follows the frontend's seasonForStyle.
 */

const TODAY = '2026-10-15';

const season = (overrides: Partial<SeasonForSummary>): SeasonForSummary => ({
  safari_style: 'midrange',
  season_type: 'STANDARD_SEASON',
  currency: 'USD',
  pricing_basis: 'PER_PERSON',
  status: 'ACTIVE',
  sort_order: 0,
  group_prices: [],
  ...overrides
});

const fixed = (price: number) => ({ price, price_status: 'FIXED_PRICE' });

describe('tour pricing summary', () => {
  it('lists the styles with prices in Budget → Luxury order and the lowest fixed price', () => {
    const summary = pricingSummary(
      [
        season({ safari_style: 'luxury', group_prices: [fixed(5200), fixed(4100)] }),
        season({ safari_style: 'budget', group_prices: [fixed(1450)] }),
        season({ safari_style: 'midrange', group_prices: [fixed(2600)] })
      ],
      TODAY
    );
    assert.deepEqual(summary, { styles: ['budget', 'midrange', 'luxury'], from: 1450, currency: 'USD' });
  });

  it('prices from the season the page shows today, not a cheaper one out of dates', () => {
    const summary = pricingSummary(
      [
        season({ season_type: 'STANDARD_SEASON', group_prices: [fixed(1800)] }),
        season({ season_type: 'PEAK_SEASON', start_date: '2026-10-01', end_date: '2026-10-31', sort_order: 1, group_prices: [fixed(2400)] })
      ],
      TODAY
    );
    assert.equal(summary.from, 2400);
  });

  it('shows an on-request style without inventing a price', () => {
    const summary = pricingSummary([season({ safari_style: 'luxury', group_prices: [{ price: null, price_status: 'ON_REQUEST' }] })], TODAY);
    assert.deepEqual(summary, { styles: ['luxury'], from: null, currency: 'USD' });
  });

  it('leaves out styles that are unavailable, inactive or priced per group', () => {
    const summary = pricingSummary(
      [
        season({ safari_style: 'budget', group_prices: [{ price: 900, price_status: 'NOT_AVAILABLE' }] }),
        season({ safari_style: 'midrange', status: 'INACTIVE', group_prices: [fixed(1000)] }),
        season({ safari_style: 'luxury', pricing_basis: 'PER_GROUP', group_prices: [fixed(8000)] })
      ],
      TODAY
    );
    assert.deepEqual(summary, { styles: [], from: null, currency: null });
  });

  it('reads a season saved before styles existed as midrange', () => {
    const summary = pricingSummary([season({ safari_style: null, group_prices: [fixed(2100)] })], TODAY);
    assert.deepEqual(summary.styles, ['midrange']);
  });

  it('copes with no seasons at all', () => {
    assert.deepEqual(pricingSummary(null, TODAY), { styles: [], from: null, currency: null });
  });
});
