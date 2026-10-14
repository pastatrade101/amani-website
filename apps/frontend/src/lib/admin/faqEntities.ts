import { api } from '$lib/admin/api/client';
import { DEFAULT_LOCALE } from '$lib/admin/i18n';

/**
 * `?locale=` for a FAQ request, omitted for the default language.
 *
 * Same rule withLocale follows for the routes that build their URLs by hand:
 * the API serves the default language by definition, and leaving the parameter
 * off keeps the default-language cache keys identical to what they were.
 */
export const localeParam = (locale?: string): Record<string, string> =>
  locale && locale !== DEFAULT_LOCALE ? { locale } : {};

/** The record types a question can be placed on, besides the home page. */
export type FaqPlacementKind = 'category' | 'tour' | 'destination';

/** One record an editor can place a question on. */
export type FaqPickerRecord = { id: string; label: string; slug: string | null };

/**
 * In the order an editor sees them. `value` is the API's `?placement=` spelling;
 * `key` is the matching list in an FAQ's `placements`, and `field` the id list
 * a save sends. "Category" is the tour_categories table, which visitors and
 * editors know as travel styles.
 */
export const FAQ_PLACEMENT_KINDS = [
  { value: 'category', label: 'Travel style', plural: 'Travel styles', key: 'categories', field: 'category_ids' },
  { value: 'tour', label: 'Tour', plural: 'Tours', key: 'tours', field: 'tour_ids' },
  { value: 'destination', label: 'Destination', plural: 'Destinations', key: 'destinations', field: 'destination_ids' }
] as const satisfies ReadonlyArray<{ value: FaqPlacementKind; label: string; plural: string; key: string; field: string }>;

/** Where a placement shows on the public site, for the admin's chip links. */
export const faqPlacementHref = (kind: FaqPlacementKind | 'home', target?: { id: string; slug?: string | null }) => {
  if (kind === 'home') return '/';
  if (!target) return '';
  // Travel styles have no page of their own here; the tours list filtered to
  // the style is where its questions are read.
  if (kind === 'category') return `/tours?category_id=${encodeURIComponent(target.id)}`;
  if (!target.slug) return '';
  return kind === 'tour' ? `/tours/${target.slug}` : `/destinations/${target.slug}`;
};

const PAGE_SIZE = 100; // the API's cap
const MAX_PAGES = 10;

/**
 * Every record of one kind, for the placement pickers. Drafts are included on
 * purpose: questions are usually written alongside the page they belong to,
 * before either goes live. The API returns at most 100 a page, so the rest are
 * fetched in parallel once the first page says how many there are.
 */
export const loadFaqPlacementRecords = async (kind: FaqPlacementKind): Promise<FaqPickerRecord[]> => {
  const fetchPage = async (page: number) => {
    const params = { status: 'all', limit: PAGE_SIZE, page };
    switch (kind) {
      case 'category':
        return (await api.categories.list(params)).data;
      case 'tour':
        return (await api.tours.list(params)).data;
      case 'destination':
        return (await api.destinations.list(params)).data;
    }
  };

  const first = await fetchPage(1);
  const pages = Math.min(first.pagination?.totalPages ?? 1, MAX_PAGES);
  const rest = await Promise.all(Array.from({ length: Math.max(pages - 1, 0) }, (_, index) => fetchPage(index + 2)));
  const rows = [first, ...rest].flatMap((result) => (result.items ?? []) as unknown as Array<Record<string, unknown>>);

  const nameKey = kind === 'tour' ? 'title' : 'name';
  return rows
    .filter((row) => typeof row?.id === 'string')
    .map((row) => ({
      id: String(row.id),
      label: String(row[nameKey] ?? row.slug ?? 'Untitled'),
      slug: typeof row.slug === 'string' ? row.slug : null
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * "Shows on the home page, 2 travel styles and 1 tour" — the editor's one-line
 * read-back of what a save will do. Empty when the question is placed nowhere.
 */
export const describeFaqPlacements = (placements: {
  home: boolean;
  categories: number;
  tours: number;
  destinations: number;
}) => {
  const parts = [
    placements.home ? 'the home page' : '',
    placements.categories ? plural(placements.categories, 'travel style', 'travel styles') : '',
    placements.tours ? plural(placements.tours, 'tour', 'tours') : '',
    placements.destinations ? plural(placements.destinations, 'destination', 'destinations') : ''
  ].filter(Boolean);
  if (!parts.length) return '';
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `Shows on ${list}`;
};
