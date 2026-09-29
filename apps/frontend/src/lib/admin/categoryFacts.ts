/**
 * Facts a tour category can state about itself, formatted for display.
 *
 * Every value here comes from a column an editor fills in — duration, fitness
 * level, best months, highlights, who it's for. Nothing is inferred and nothing
 * is invented: a category with no `min_days` gets no duration, and a category
 * with none of the three gets no meta line at all rather than a plausible one.
 *
 * The month-run collapsing matches what the experience page already does, so
 * "Jan, Feb, Jun, Jul, Aug, Sep, Oct" reads as "Jan–Feb, Jun–Oct" in both
 * places — the way a travel guide writes a season, not twelve filter chips.
 */
import { toPlainText } from '$lib/admin/richText';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const FITNESS_LABELS: Record<string, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  active: 'Active',
  challenging: 'Challenging',
  strenuous: 'Strenuous'
};

/** "Jan–Feb, Jun–Oct". A run crossing the year end merges; all twelve is one phrase. */
export const monthRanges = (value: unknown): string => {
  const months = [...new Set((Array.isArray(value) ? value : []).map(Number).filter((m) => m >= 1 && m <= 12))].sort(
    (a, b) => a - b
  );
  if (!months.length) return '';
  if (months.length === 12) return 'All year round';

  const runs: Array<[number, number]> = [];
  for (const month of months) {
    const last = runs[runs.length - 1];
    if (last && month === last[1] + 1) last[1] = month;
    else runs.push([month, month]);
  }
  // Nov, Dec, Jan is one season, not two.
  if (runs.length > 1 && runs[0][0] === 1 && runs[runs.length - 1][1] === 12) {
    const wrap = runs.pop();
    if (wrap) runs[0][0] = wrap[0];
  }
  return runs.map(([from, to]) => (from === to ? MONTH_SHORT[from - 1] : `${MONTH_SHORT[from - 1]}–${MONTH_SHORT[to - 1]}`)).join(', ');
};

/** "3–10 days", or a one-ended version when only one bound is set. */
export const durationText = (min: unknown, max: unknown): string => {
  const from = typeof min === 'number' && min > 0 ? min : null;
  const to = typeof max === 'number' && max > 0 ? max : null;
  if (from && to) return from === to ? `${from} day${from === 1 ? '' : 's'}` : `${from}–${to} days`;
  if (from) return `From ${from} day${from === 1 ? '' : 's'}`;
  if (to) return `Up to ${to} day${to === 1 ? '' : 's'}`;
  return '';
};

/**
 * "3–10 days · Easy · Jan–Feb, Jun–Oct" — only the parts this category has.
 * Returns '' when it has none, so the caller renders no line rather than an
 * empty one.
 */
export const categoryMeta = (category: Record<string, unknown>): string => {
  const level = typeof category.fitness_level === 'string' ? FITNESS_LABELS[category.fitness_level] : undefined;
  // The structured level wins; the legacy free-text column still displays for
  // categories that have not been re-saved on the newer form.
  const fitness = level ?? (typeof category.fitness === 'string' ? category.fitness.trim() : '');
  return [durationText(category.min_days, category.max_days), fitness, monthRanges(category.best_months)]
    .filter(Boolean)
    .join(' · ');
};

/**
 * The audience lines from `who_its_for`. Editors write one per line, but the
 * column is free text and older records hold a single sentence — so this
 * splits and lets the caller decide how to present what comes back.
 */
export const categoryAudience = (value: unknown): string[] =>
  String(value ?? '')
    .split(/\r?\n|[•·]/)
    .map((entry) => toPlainText(entry).trim().replace(/^[-–—]\s*/, ''))
    .filter(Boolean);

/** The highlight chips, with any rich-text markup stripped back to words. */
export const categoryHighlights = (value: unknown, limit = 4): string[] =>
  (Array.isArray(value) ? value : [])
    .map((entry) => toPlainText(entry).trim())
    .filter(Boolean)
    .slice(0, limit);
