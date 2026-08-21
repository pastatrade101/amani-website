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
  key: string;
  label: string;
  kind: FieldKind;
  /** Required for a translation to be publishable and counted in completeness. */
  required?: boolean;
};

export const TRANSLATABLE_ENTITIES: Record<string, TranslatableField[]> = {
  tour_categories: [
    { key: 'name', label: 'Name', kind: 'text', required: true },
    { key: 'short_description', label: 'Short description', kind: 'textarea', required: true },
    { key: 'description', label: 'Description', kind: 'rich', required: true },
    { key: 'who_its_for', label: "Who it's for", kind: 'textarea' },
    { key: 'highlights', label: 'Highlights', kind: 'rich_list' },
    { key: 'meta_title', label: 'SEO title', kind: 'text' },
    { key: 'meta_description', label: 'SEO description', kind: 'textarea' }
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
  ]
};

/** Maps entity type -> the existing permission key guarding its writes. */
export const ENTITY_PERMISSIONS: Record<string, string> = {
  tour_categories: 'categories.update',
  tours: 'tours.update',
  destinations: 'destinations.update',
  lodges: 'lodges.update'
};

export type TranslationFields = Record<string, string | string[]>;

export const isTranslatableEntity = (entityType: string): boolean =>
  Object.hasOwn(TRANSLATABLE_ENTITIES, entityType);

/** Current source-language values for an entity, from its own columns. */
export const sourceFieldsFor = (entityType: string, record: Record<string, unknown>): TranslationFields => {
  const out: TranslationFields = {};
  for (const field of TRANSLATABLE_ENTITIES[entityType] ?? []) {
    const value = record[field.key];
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
    for (const [key, value] of Object.entries(fields)) {
      if (Array.isArray(value) ? value.length : String(value).trim()) record[key] = value;
    }
    if (translation.translated_slug) record.translated_slug = translation.translated_slug;
    record.locale = locale;
  }
};
