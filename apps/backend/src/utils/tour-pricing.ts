import { SAFARI_STYLES, type SafariStyle } from './tour-content';

/**
 * The "from" price and safari styles a tour card shows, computed from the same
 * per-person seasons the tour page's price table reads.
 *
 * The season picked for each style mirrors seasonForStyle in the frontend's
 * safari-pricing.ts (active, per person; the one whose dates hold today, else
 * the Standard Season, else the first by sort order), so a card never quotes a
 * price the tour page does not show.
 */

type GroupPrice = { price?: number | string | null; price_status?: string | null };

export type SeasonForSummary = {
  safari_style?: string | null;
  season_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  currency?: string | null;
  pricing_basis?: string | null;
  status?: string | null;
  sort_order?: number | null;
  group_prices?: GroupPrice[] | null;
};

export type PricingSummary = { styles: SafariStyle[]; from: number | null; currency: string | null };

// Seasons saved before styles existed read as midrange, like the frontend.
const styleOf = (season: SeasonForSummary): SafariStyle =>
  season.safari_style === 'budget' || season.safari_style === 'luxury' ? season.safari_style : 'midrange';

const inRange = (season: SeasonForSummary, today: string) =>
  Boolean(season.start_date && season.end_date && season.start_date <= today && today <= season.end_date);

export const seasonForStyle = (seasons: readonly SeasonForSummary[], style: SafariStyle, today: string): SeasonForSummary | null => {
  const candidates = seasons
    .filter((season) => styleOf(season) === style && season.status === 'ACTIVE' && season.pricing_basis === 'PER_PERSON')
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  return (
    candidates.find((season) => inRange(season, today)) ??
    candidates.find((season) => season.season_type === 'STANDARD_SEASON') ??
    candidates[0] ??
    null
  );
};

const fixedPrice = (row: GroupPrice): number | null => {
  if (row.price_status !== 'FIXED_PRICE' || row.price == null) return null;
  const price = Number(row.price);
  return Number.isFinite(price) && price > 0 ? price : null;
};

export const pricingSummary = (
  seasons: readonly SeasonForSummary[] | null | undefined,
  today = new Date().toISOString().slice(0, 10)
): PricingSummary => {
  const styles: SafariStyle[] = [];
  let from: number | null = null;
  let currency: string | null = null;

  for (const style of SAFARI_STYLES) {
    const season = seasonForStyle(seasons ?? [], style, today);
    // A style shows when its season has a row that is bookable or on request.
    const rows = (season?.group_prices ?? []).filter((row) => row.price_status !== 'NOT_AVAILABLE');
    if (!season || !rows.length) continue;
    styles.push(style);
    currency ??= season.currency ?? null;
    for (const row of rows) {
      const price = fixedPrice(row);
      if (price !== null && (from === null || price < from)) {
        from = price;
        currency = season.currency ?? currency;
      }
    }
  }

  return { styles, from, currency };
};
