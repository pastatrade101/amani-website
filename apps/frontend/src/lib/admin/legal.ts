import { error } from '@sveltejs/kit';
import { localeFromPath, withLocale } from '$lib/admin/i18n';

/**
 * The four legal pages: Privacy Policy, Terms, Cancellation Policy and Data
 * Retention.
 *
 * Their wording lives on the server (backend/src/data/legal-pages.ts) so the
 * website, Admin → Settings and the translation tools all read one text. The
 * website asks for a page in the visitor's language and gets it ready to
 * render: Settings edits applied, translated where a translation is published.
 */

export type LegalDocKey = 'privacy' | 'terms' | 'cancellation' | 'data_retention';

/** The parts an editor can change, stored under legal_<doc>_<part>. */
export const LEGAL_PARTS = ['title', 'updated', 'intro', 'body', 'meta_description'] as const;
export type LegalPart = (typeof LEGAL_PARTS)[number];

export type LegalPage = Record<LegalPart, string> & {
  id: string;
  /** Languages this page is published in — drives hreflang and the switcher. */
  available_locales?: string[];
};

/** Built-in wording and fixed id per page, as the Settings form receives it. */
export type LegalDefaults = Record<LegalDocKey, Record<LegalPart, string> & { id: string }>;

export const legalSettingKey = (doc: LegalDocKey, part: LegalPart): string => `legal_${doc}_${part}`;

/** Page loader shared by the four routes. */
export const loadLegalPage = async (fetchFn: typeof fetch, doc: LegalDocKey, url: URL) => {
  const locale = localeFromPath(url.pathname);
  let page: LegalPage | null = null;
  try {
    const res = await fetchFn(withLocale(`/api/public/legal/${doc}`, locale));
    if (res.ok) page = ((await res.json()) as { data?: LegalPage }).data ?? null;
  } catch {
    page = null;
  }
  if (!page?.body) throw error(503, 'This page is temporarily unavailable. Please try again shortly.');
  return {
    legal: page,
    // Read by the root layout: a page is only announced in languages it is
    // actually published in, like every other translated page.
    availableLocales: page.available_locales ?? null,
    // The layout writes the one <title> and description; a page adding its own
    // left two description tags, the site default first.
    seo: { title: `${page.title} | Key2africa Safaris`, description: page.meta_description }
  };
};
