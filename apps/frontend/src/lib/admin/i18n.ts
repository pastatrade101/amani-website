/**
 * Locale plumbing — the one place that knows how a locale is encoded in a URL.
 *
 * URL strategy: the default language is served UNPREFIXED and every other
 * language is prefixed.
 *
 *   English  /tours/serengeti      (unchanged — every existing URL still works)
 *   German   /de/tours/serengeti
 *
 * The spec's example shows /en/... for English too, which would mean 301ing
 * every indexed URL on a live site to a new address. Prefix-except-default is
 * the standard way to add locales to an established site without touching its
 * existing addresses or splitting its ranking signals; /en/... still resolves
 * and redirects to the canonical unprefixed form, so both shapes work and only
 * one is canonical.
 */

/**
 * Locales the router will recognise in a path. Must match the `languages`
 * table, which is the source of truth everywhere else — the switcher, hreflang,
 * the admin's translation tabs and the machine-translation target all read it
 * over the wire. This list exists only because routing has to decide what is a
 * locale prefix before any request has been made, and it is the one place a new
 * language has to be named twice.
 */
export const KNOWN_LOCALES = ['en', 'sw', 'de', 'fr', 'es', 'it'] as const;
export type KnownLocale = (typeof KNOWN_LOCALES)[number];

/** Served without a prefix. Mirrors languages.is_default in the database. */
export const DEFAULT_LOCALE: KnownLocale = 'en';

const LOCALE_PATTERN = new RegExp(`^/(${KNOWN_LOCALES.join('|')})(?=/|$)`, 'i');

export const isKnownLocale = (value: string): value is KnownLocale =>
  (KNOWN_LOCALES as readonly string[]).includes(value.toLowerCase());

/** The locale a path asks for, or the default when it carries no prefix. */
export const localeFromPath = (pathname: string): KnownLocale => {
  const match = LOCALE_PATTERN.exec(pathname);
  return match ? (match[1].toLowerCase() as KnownLocale) : DEFAULT_LOCALE;
};

/** The same path with any locale prefix removed — what the router matches. */
export const stripLocale = (pathname: string): string => {
  const stripped = pathname.replace(LOCALE_PATTERN, '');
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
};

/**
 * The address of `pathname` in `locale`. Used by the language switcher and by
 * hreflang, so a visitor changing language lands on the equivalent page rather
 * than back at the homepage.
 */
/**
 * Add ?locale= to an API URL, correctly whether or not it already has a query.
 * The default language is never sent — the API serves it by definition, and
 * omitting it keeps the default-language cache keys identical to before.
 */
export const withLocale = (apiUrl: string, locale: string): string => {
  if (locale === DEFAULT_LOCALE) return apiUrl;
  return `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}locale=${locale}`;
};

export const localizeHref = (pathname: string, locale: string): string => {
  const base = stripLocale(pathname);
  if (locale === DEFAULT_LOCALE) return base;
  return base === '/' ? `/${locale}` : `/${locale}${base}`;
};

/**
 * The flag for a locale, from the region in the locale itself.
 *
 * Every language row stores one — en-US, sw-TZ, de-DE — so the flag is read
 * from the record rather than from a table of guesses kept in the markup. A
 * locale with no region subtag gets nothing, and the caller shows the code
 * instead.
 *
 * Regional indicator pairs: 'TZ' becomes U+1F1F9 U+1F1FF, which a font renders
 * as one flag.
 */
export const localeFlag = (locale: string): string => {
  const region = String(locale ?? '').split('-').pop()?.toUpperCase() ?? '';
  if (!/^[A-Z]{2}$/.test(region)) return '';
  return String.fromCodePoint(...[...region].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
};

/**
 * The chosen language, remembered between visits.
 *
 * The locale lives in the address, which survives a refresh and a shared link
 * on its own. What it cannot survive is arriving at the site without a prefix —
 * typing the domain, or following an old bookmark — so the choice is also kept
 * in a cookie and applied on arrival. Same shape as the currency cookie beside
 * it: readable by the visitor, no personal data, a year long.
 */
export const LOCALE_COOKIE = 'gf_locale';

export const rememberLocale = (locale: string): void => {
  if (typeof document === 'undefined' || !isKnownLocale(locale)) return;
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
};

export const rememberedLocale = (): KnownLocale | null => {
  if (typeof document === 'undefined') return null;
  const match = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`).exec(document.cookie);
  const value = match ? decodeURIComponent(match[1]) : '';
  return isKnownLocale(value) ? value : null;
};
