import { derived, writable } from 'svelte/store';
import { DEFAULT_LOCALE, type KnownLocale } from '$lib/admin/i18n';
import de from '$lib/admin/locales/de.json';
import en from '$lib/admin/locales/en.json';
import es from '$lib/admin/locales/es.json';
import fr from '$lib/admin/locales/fr.json';
import it from '$lib/admin/locales/it.json';
import sw from '$lib/admin/locales/sw.json';

/**
 * Static interface copy — buttons, labels, navigation. Deliberately separate
 * from CMS content translations: these strings ship with the build and never
 * belong in the database (§21). CMS records go through content_translations;
 * this is everything the app itself says.
 */
type Dictionary = Record<string, string>;

/*
 * Keyed by KnownLocale on purpose: adding a locale to that list without adding
 * its dictionary here is a type error, so a new language cannot ship with the
 * interface silently still in English.
 */
const DICTIONARIES: Record<KnownLocale, Dictionary> = { en, sw, de, fr, es, it };

/** Active locale, set once per navigation by the root layout. */
export const locale = writable<KnownLocale>(DEFAULT_LOCALE);

/**
 * `$t('cta.book_now')` — falls back to the default language for a key a
 * translation has not covered, and to the key itself if it is unknown, so a
 * missing string is visible in review rather than rendering as blank.
 */
export const t = derived(locale, ($locale) => (key: string): string => {
  const dictionary = DICTIONARIES[$locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  return dictionary[key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
});
