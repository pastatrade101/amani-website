import { api } from '$lib/admin/api/client';
import { DEFAULT_LOCALE } from '$lib/admin/i18n';
import type { FAQ, FaqEntityType } from '$lib/admin/types';

/**
 * `?locale=` for a FAQ request, omitted for the default language.
 *
 * Same rule withLocale follows for the routes that build their URLs by hand:
 * the API serves the default language by definition, and leaving the parameter
 * off keeps the default-language cache keys identical to what they were.
 */
export const localeParam = (locale?: string): Record<string, string> =>
  locale && locale !== DEFAULT_LOCALE ? { locale } : {};

/**
 * The collections an FAQ can be attached to, in the order an editor sees them.
 * `value` is the database table name — the same spelling the API filters on and
 * the `faqs_entity_type_check` constraint allows.
 */
export const FAQ_ENTITY_TYPES: Array<{ value: FaqEntityType; label: string; plural: string }> = [
  { value: 'destinations', label: 'Destination', plural: 'Destinations' },
  { value: 'tours', label: 'Tour', plural: 'Tours' },
  { value: 'tour_categories', label: 'Travel style', plural: 'Travel styles' },
  { value: 'safari_packages', label: 'Safari package', plural: 'Safari packages' },
  { value: 'lodges', label: 'Lodge', plural: 'Lodges' },
  { value: 'activities', label: 'Activity', plural: 'Activities' }
];

export const faqEntityLabel = (type?: string | null) =>
  FAQ_ENTITY_TYPES.find((entry) => entry.value === type)?.label ?? '';

/** Where an attached record lives on the public site, for the admin's preview link. */
const ENTITY_PATH: Record<FaqEntityType, (slug: string) => string> = {
  destinations: (slug) => `/destinations/${slug}`,
  tours: (slug) => `/tours/${slug}`,
  tour_categories: (slug) => `/safari-styles/${slug}`,
  safari_packages: (slug) => `/${slug}`,
  // Lodges and activities are published under the visitor-facing words for
  // them, not the table names.
  lodges: (slug) => `/accommodation/${slug}`,
  activities: (slug) => `/experiences/${slug}`
};

export const faqEntityHref = (type?: string | null, slug?: string | null) => {
  if (!type || !slug) return '';
  const build = ENTITY_PATH[type as FaqEntityType];
  return build ? build(slug) : '';
};

/**
 * The records an editor can attach an FAQ to, for the picker. Drafts are
 * included on purpose — questions are usually written alongside the page they
 * belong to, before either goes live.
 */
export const loadFaqEntityRecords = async (type: FaqEntityType): Promise<Array<{ id: string; label: string }>> => {
  const params = { status: 'all', limit: 200 } as const;

  const named = (items: Array<Record<string, unknown>>, key: 'name' | 'title') =>
    items
      .filter((row) => typeof row?.id === 'string')
      .map((row) => ({ id: String(row.id), label: String(row[key] ?? row.slug ?? 'Untitled') }))
      .sort((a, b) => a.label.localeCompare(b.label));

  switch (type) {
    case 'destinations':
      return named((await api.destinations.list(params)).data.items ?? [], 'name');
    case 'tours':
      return named((await api.tours.list(params)).data.items ?? [], 'title');
    case 'tour_categories':
      return named((await api.categories.list(params)).data.items ?? [], 'name');
    case 'safari_packages':
      return named((await api.safariPackages.list(params)).data.items ?? [], 'name');
    case 'lodges':
      return named((await api.lodges.list(params)).data.items ?? [], 'name');
    case 'activities':
      return named((await api.activities.list(params)).data.items ?? [], 'name');
    default:
      return [];
  }
};

/**
 * Attached questions first, then general ones to fill the remaining slots.
 *
 * A page that has its own questions should lead with them; the general set
 * ("do I need a visa?", "how do I pay?") is genuinely useful everywhere and
 * keeps a page from showing a two-item FAQ. Because an unattached library
 * behaves exactly like it did before, attaching nothing changes nothing.
 */
export const mergeFaqs = (attached: FAQ[], general: FAQ[], limit: number): FAQ[] => {
  const seen = new Set<string>();
  const out: FAQ[] = [];

  for (const faq of [...attached, ...general]) {
    if (!faq?.id || !faq.question || seen.has(faq.id)) continue;
    seen.add(faq.id);
    out.push(faq);
    if (out.length >= limit) break;
  }

  return out;
};

const itemsOf = (result: PromiseSettledResult<{ data: { items?: FAQ[] } }>): FAQ[] =>
  result.status === 'fulfilled' ? result.value.data.items ?? [] : [];

/**
 * Questions for a page, narrowest attachment first.
 *
 * A tour belongs to a travel style, and most of what a reader wants to know
 * about a 6-day migration safari was answered once on the migration style
 * rather than retyped onto each of its tours. Asking only about the tour meant
 * those questions existed in the CMS, were attached to something this page is
 * part of, and still never appeared — so the page fell through to the general
 * library and answered nothing specific to it.
 *
 * Attachments are read in the order given and concatenated in that order, so
 * the tour's own questions lead, its style's follow, and the general library
 * fills whatever is left. mergeFaqs dedupes, so a question attached at two
 * levels is shown once, at its more specific position.
 *
 * An attachment with no id is skipped rather than requested — a tour with no
 * category is not a tour whose category has no questions.
 */
export const loadFaqsFor = async (
  attachments: Array<{ type: FaqEntityType; id?: string | null }>,
  limit = 8,
  /**
   * Passed rather than read from the locale store: this module is also
   * imported by `+page.ts` loaders, and a module-level store is one value
   * shared by every request the server is handling at once.
   */
  locale?: string
): Promise<FAQ[]> => {
  const named = attachments.filter((entry): entry is { type: FaqEntityType; id: string } => Boolean(entry.id));
  const lang = localeParam(locale);

  const results = await Promise.allSettled([
    ...named.map((entry) =>
      api.faqs.list({ entity_type: entry.type, entity_id: entry.id, status: 'published', limit, ...lang })
    ),
    // "null" is the API's spelling for IS NULL — the general library.
    api.faqs.list({ entity_type: 'null', status: 'published', limit, ...lang })
  ]);

  const general = itemsOf(results[results.length - 1]);
  const attached = results.slice(0, -1).flatMap(itemsOf);
  return mergeFaqs(attached, general, limit);
};

/** Client-side loader for a public page that knows which record it is. */
export const loadEntityFaqs = async (
  type: FaqEntityType,
  id: string,
  limit = 8,
  locale?: string
): Promise<FAQ[]> => {
  if (!id) return [];
  return loadFaqsFor([{ type, id }], limit, locale);
};

/** Query strings for the same two reads, for routes that load in `+page.ts`. */
export const attachedFaqQuery = (type: FaqEntityType, id: string, limit: number) =>
  `entity_type=${type}&entity_id=${encodeURIComponent(id)}&status=published&limit=${limit}`;

export const generalFaqQuery = (limit: number) => `entity_type=null&status=published&limit=${limit}`;
