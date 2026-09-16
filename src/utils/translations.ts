import { createHash } from 'node:crypto';
import { supabase } from '../config/supabase';
import { sanitizeRichText, toPlainText } from './rich-text';

/**
 * The translatable-field registry — the single place that says which columns
 * of which entity carry human language. Everything else (validation,
 * completeness, copy-from-default, AI translation, public merging) reads this,
 * so adding an entity or field is configuration, not new code.
 *
 * Anything not listed here — prices, coordinates, images, relationship ids,
 * availability — is shared data and never enters a translation record.
 */
export type FieldKind = 'text' | 'textarea' | 'rich' | 'rich_list';

export type TranslatableField = {
  /**
   * A column name, or a dotted path into a jsonb column —
   * `landing_page_content.hero.headline`.
   *
   * Most translatable copy is a column of its own, but the safari-style landing
   * pages keep theirs inside one jsonb blob, and a visitor on /it/ was meeting
   * an Italian page under an English headline because a flat key could not
   * reach into it. The path is the storage key too, so a translation records
   * exactly which field it belongs to.
   */
  key: string;
  label: string;
  kind: FieldKind;
  /** Required for a translation to be publishable and counted in completeness. */
  required?: boolean;
};

/** Reads `a.b.c` out of a record. Undefined for any missing step. */
export const readPath = (record: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>((value, step) => {
    if (value === null || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[step];
  }, record);

/**
 * Writes `a.b.c` into a record, but only where the containers already exist.
 *
 * A translation must never bring a structure into being: if a category has no
 * landing_page_content, it has no landing page, and writing a lone translated
 * headline into a blank object would produce a half-formed page that the
 * default language does not have.
 */
export const writePath = (record: Record<string, unknown>, path: string, value: unknown): void => {
  const steps = path.split('.');
  const last = steps.pop();
  if (!last) return;
  let target: Record<string, unknown> = record;
  for (const step of steps) {
    const next = target[step];
    if (next === null || typeof next !== 'object') return;
    target = next as Record<string, unknown>;
  }
  target[last] = value;
};

export const TRANSLATABLE_ENTITIES: Record<string, TranslatableField[]> = {
  tour_categories: [
    { key: 'name', label: 'Name', kind: 'text', required: true },
    { key: 'short_description', label: 'Short description', kind: 'textarea', required: true },
    { key: 'description', label: 'Description', kind: 'rich', required: true },
    { key: 'who_its_for', label: "Who it's for", kind: 'textarea' },
    { key: 'highlights', label: 'Highlights', kind: 'rich_list' },
    { key: 'meta_title', label: 'SEO title', kind: 'text' },
    { key: 'meta_description', label: 'SEO description', kind: 'textarea' },
    /*
     * The landing hero, reached inside the landing_page_content blob.
     *
     * Not marked required: plenty of categories have no landing page, and a
     * translation cannot be blocked from publishing over a field the default
     * language never filled in. Labels match what the landing editor calls
     * them, so a translator is looking at the same words the author was.
     */
    { key: 'landing_page_content.hero.eyebrow', label: 'Hero — small label', kind: 'text' },
    { key: 'landing_page_content.hero.headline', label: 'Hero — headline', kind: 'text' },
    { key: 'landing_page_content.hero.subheadline', label: 'Hero — sub-headline', kind: 'textarea' },
    { key: 'landing_page_content.hero.primaryCtaLabel', label: 'Hero — main button', kind: 'text' },
    { key: 'landing_page_content.hero.secondaryCtaLabel', label: 'Hero — second button', kind: 'text' },
    { key: 'landing_page_content.hero.trustLine', label: 'Hero — trust line', kind: 'text' }
  ],
  tours: [
    { key: 'title', label: 'Title', kind: 'text', required: true },
    { key: 'short_description', label: 'Short description', kind: 'textarea', required: true },
    // Keys are real column names — the resolver merges translated values onto
    // the record by key, so `full_description` must not be shortened here.
    { key: 'full_description', label: 'Description', kind: 'rich', required: true },
    { key: 'highlights', label: 'Highlights', kind: 'rich_list' },
    { key: 'seo_title', label: 'SEO title', kind: 'text' },
    { key: 'meta_description', label: 'SEO description', kind: 'textarea' }
  ],
  destinations: [
    { key: 'name', label: 'Name', kind: 'text', required: true },
    { key: 'short_description', label: 'Short description', kind: 'textarea', required: true },
    { key: 'description', label: 'Description', kind: 'rich', required: true },
    { key: 'meta_title', label: 'SEO title', kind: 'text' },
    { key: 'meta_description', label: 'SEO description', kind: 'textarea' }
  ],
  lodges: [
    { key: 'name', label: 'Name', kind: 'text', required: true },
    { key: 'short_description', label: 'Short description', kind: 'textarea' },
    { key: 'description', label: 'Description', kind: 'rich', required: true },
    { key: 'why_we_recommend', label: 'Why we recommend it', kind: 'rich' }
  ],
  // Homepage copy is the highest-traffic text on the site; without it a
  // visitor on /de/ met an entirely English homepage. Only the flat headline
  // fields are covered — the nested lists inside extra_data need a richer
  // field kind than the registry has today.
  homepage_sections: [
    { key: 'title', label: 'Heading', kind: 'text', required: true },
    { key: 'subtitle', label: 'Sub-heading', kind: 'textarea' }
  ],
  faqs: [
    { key: 'question', label: 'Question', kind: 'text', required: true },
    { key: 'answer', label: 'Answer', kind: 'rich', required: true }
  ],
  blog_posts: [
    { key: 'title', label: 'Title', kind: 'text', required: true },
    { key: 'excerpt', label: 'Excerpt', kind: 'textarea' },
    { key: 'content', label: 'Content', kind: 'rich', required: true },
    { key: 'meta_title', label: 'SEO title', kind: 'text' },
    { key: 'meta_description', label: 'SEO description', kind: 'textarea' }
  ],
  activities: [
    { key: 'name', label: 'Name', kind: 'text', required: true },
    { key: 'description', label: 'Description', kind: 'rich', required: true },
    { key: 'meta_title', label: 'SEO title', kind: 'text' },
    { key: 'meta_description', label: 'SEO description', kind: 'textarea' }
  ],
  /**
   * The day-by-day plan. Translated per day, because that is the unit a
   * traveller reads and the unit an editor works in.
   *
   * accommodation is free text here — the property NAME, where a day is not
   * linked to a lodge record. A linked lodge carries its own translation, so
   * this only covers the days that spell it out by hand.
   *
   * day_number, image_url and accommodation_id are deliberately absent: a day
   * is the same day in every language, and its photo and linked property are
   * shared data, not language.
   */
  itinerary_days: [
    { key: 'title', label: 'Day title', kind: 'text', required: true },
    { key: 'description', label: 'What happens that day', kind: 'rich', required: true },
    { key: 'accommodation', label: 'Where they stay', kind: 'text' },
    { key: 'meals', label: 'Meals included', kind: 'text' },
    { key: 'activities', label: 'Activities', kind: 'textarea' }
  ]
};

/** Maps entity type -> the existing permission key guarding its writes. */
export const ENTITY_PERMISSIONS: Record<string, string> = {
  tour_categories: 'categories.update',
  tours: 'tours.update',
  destinations: 'destinations.update',
  lodges: 'lodges.update',
  homepage_sections: 'homepage.update',
  faqs: 'faqs.update',
  blog_posts: 'blog.update',
  activities: 'activities.update',
  // A day belongs to its tour, so editing one is editing that tour.
  itinerary_days: 'tours.update'
};

export type TranslationFields = Record<string, string | string[]>;

export const isTranslatableEntity = (entityType: string): boolean =>
  Object.hasOwn(TRANSLATABLE_ENTITIES, entityType);

/** Reads ?locale= from a query value, accepting `de` or `de-DE`. */
export const localeOf = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[a-z]{2}(-[A-Za-z]{2})?$/.test(value) ? value.toLowerCase().slice(0, 2) : undefined;

/** Current source-language values for an entity, from its own columns. */
export const sourceFieldsFor = (entityType: string, record: Record<string, unknown>): TranslationFields => {
  const out: TranslationFields = {};
  for (const field of TRANSLATABLE_ENTITIES[entityType] ?? []) {
    const value = readPath(record, field.key);
    if (field.kind === 'rich_list') {
      if (Array.isArray(value)) out[field.key] = value.map(String);
    } else if (typeof value === 'string' && value.trim()) {
      out[field.key] = value;
    }
  }
  return out;
};

/**
 * Stable hash of the source values. Stored on every translation when it is
 * saved; when the source is edited later the hashes diverge and the
 * translation is flagged as possibly outdated rather than assumed correct.
 */
export const sourceHashFor = (entityType: string, record: Record<string, unknown>): string => {
  const source = sourceFieldsFor(entityType, record);
  const canonical = JSON.stringify(
    Object.keys(source)
      .sort()
      .map((key) => [key, source[key]])
  );
  return createHash('md5').update(canonical).digest('hex');
};

const filled = (value: unknown): boolean =>
  Array.isArray(value)
    ? value.some((item) => toPlainText(item).trim().length > 0)
    : toPlainText(value).trim().length > 0;

/** Percent complete over REQUIRED fields only — optional gaps don't penalise. */
export const completenessFor = (entityType: string, fields: TranslationFields): number => {
  const required = (TRANSLATABLE_ENTITIES[entityType] ?? []).filter((field) => field.required);
  if (!required.length) return 0;
  const done = required.filter((field) => filled(fields[field.key])).length;
  return Math.round((done / required.length) * 100);
};

export const missingRequiredFields = (entityType: string, fields: TranslationFields): string[] =>
  (TRANSLATABLE_ENTITIES[entityType] ?? [])
    .filter((field) => field.required && !filled(fields[field.key]))
    .map((field) => field.label);

/**
 * Keep only registered keys and sanitise every value — translation input is
 * CMS content like any other, whether it came from a person or a model. Rich
 * kinds go through the HTML sanitiser; plain kinds are stripped to text.
 */
export const cleanTranslationFields = (entityType: string, raw: unknown): TranslationFields => {
  const out: TranslationFields = {};
  if (!raw || typeof raw !== 'object') return out;
  const input = raw as Record<string, unknown>;
  for (const field of TRANSLATABLE_ENTITIES[entityType] ?? []) {
    const value = input[field.key];
    if (value === undefined) continue;
    if (field.kind === 'rich_list') {
      const items = (Array.isArray(value) ? value : [])
        .map((item) => sanitizeRichText(String(item ?? '')))
        .filter((item) => toPlainText(item).trim().length > 0);
      out[field.key] = items;
    } else if (field.kind === 'rich') {
      out[field.key] = sanitizeRichText(String(value ?? ''));
    } else {
      out[field.key] = toPlainText(String(value ?? '')).trim();
    }
  }
  return out;
};

export const getDefaultLanguage = async (): Promise<string> => {
  const { data } = await supabase.from('languages').select('code').eq('is_default', true).maybeSingle();
  return (data?.code as string | undefined) ?? 'en';
};

/**
 * Merge published translations of `locale` over a batch of records — ONE query
 * for the whole batch, never one per row. Records keep their shape; translated
 * values overwrite the source columns, and `translated_slug`/`locale` are
 * attached so callers can build localized URLs. Fallback is per-field by
 * construction: a field with no translated value keeps the default-language
 * text already on the record.
 */
/**
 * Attach `available_locales` — the default language plus every locale with a
 * PUBLISHED translation — so the frontend can emit hreflang only for pages
 * that genuinely exist in that language, as the spec requires. One query for
 * the whole batch.
 */
export const attachAvailableLocales = async (
  entityType: string,
  records: Array<Record<string, unknown>>
): Promise<void> => {
  if (!records.length || !isTranslatableEntity(entityType)) return;

  const [defaultLanguage, { data: rows }] = await Promise.all([
    getDefaultLanguage(),
    supabase
      .from('content_translations')
      .select('entity_id, language_code')
      .eq('entity_type', entityType)
      .eq('translation_status', 'published')
      .in('entity_id', records.map((record) => record.id).filter(Boolean))
  ]);

  // Only languages an admin still has switched on may be advertised.
  const { data: enabled } = await supabase.from('languages').select('code').eq('enabled', true);
  const live = new Set((enabled ?? []).map((row) => String(row.code)));

  const byId = new Map<string, string[]>();
  for (const row of rows ?? []) {
    const code = String(row.language_code);
    if (!live.has(code)) continue;
    const list = byId.get(String(row.entity_id)) ?? [];
    list.push(code);
    byId.set(String(row.entity_id), list);
  }

  for (const record of records) {
    const codes = new Set(byId.get(String(record.id)) ?? []);
    if (live.has(defaultLanguage)) codes.add(defaultLanguage);
    record.available_locales = [...codes].sort();
  }
};

export const localizeRecords = async (
  entityType: string,
  records: Array<Record<string, unknown>>,
  locale: string | undefined
): Promise<void> => {
  if (!locale || !records.length || !isTranslatableEntity(entityType)) return;

  const { data: language } = await supabase
    .from('languages')
    .select('code, is_default, enabled')
    .eq('code', locale)
    .maybeSingle();
  // Unsupported or disabled locales quietly serve the default language rather
  // than erroring a public page.
  if (!language || !language.enabled || language.is_default) return;

  const ids = records.map((record) => record.id).filter(Boolean);
  const { data: rows } = await supabase
    .from('content_translations')
    .select('entity_id, fields, translated_slug')
    .eq('entity_type', entityType)
    .eq('language_code', locale)
    .eq('translation_status', 'published')
    .in('entity_id', ids);

  const byId = new Map((rows ?? []).map((row) => [String(row.entity_id), row]));
  for (const record of records) {
    const translation = byId.get(String(record.id));
    if (!translation) continue;
    const fields = (translation.fields ?? {}) as TranslationFields;
    const applied: string[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if (Array.isArray(value) ? value.length : String(value).trim()) {
        writePath(record, key, value);
        applied.push(key);
      }
    }
    // Which keys actually came from the translation. A merged record otherwise
    // looks uniform, so a page cannot tell translated copy from a field that
    // fell back to the default language — which matters for SEO, where a
    // translated summary beats an untranslated meta description.
    record.translated_fields = applied;
    if (translation.translated_slug) record.translated_slug = translation.translated_slug;
    record.locale = locale;
  }
};
