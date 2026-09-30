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
  /**
   * The heading this field sits under in the translation panel. Only records
   * built from blocks use it — a safari package can carry sixty fields, and
   * sixty unlabelled rows in one column is not something anyone can work in.
   */
  group?: string;
};

/**
 * One step of a path. `#abc` picks the element of an array whose `_id` is
 * `abc`; anything else is an ordinary key.
 *
 * Identity rather than position, for content kept as a list of blocks: an
 * editor who moves the FAQ above the overview must not move the Italian
 * overview into the FAQ. A block that has since been deleted simply no longer
 * matches, so its old translation drops out instead of landing elsewhere.
 */
const stepInto = (value: unknown, step: string): unknown => {
  if (value === null || typeof value !== 'object') return undefined;
  if (step.startsWith('#') && Array.isArray(value)) {
    const id = step.slice(1);
    return value.find(
      (item) => item !== null && typeof item === 'object' && (item as Record<string, unknown>)._id === id
    );
  }
  return (value as Record<string, unknown>)[step];
};

/** Reads `a.b.c` (or `sections.#id.title`) out of a record. Undefined for any missing step. */
export const readPath = (record: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>((value, step) => stepInto(value, step), record);

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
    const next = stepInto(target, step);
    if (next === null || typeof next !== 'object') return;
    target = next as Record<string, unknown>;
  }
  // The last step names a field, never an array element: a translation
  // replaces words, it does not swap whole blocks.
  if (last.startsWith('#')) return;
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
  /*
   * A homepage section's visible copy, which is not only its heading: the
   * eyebrow above it and the button under it are read by the same visitor, and
   * a translated heading between an English eyebrow and an English button
   * reads worse than leaving the section in one language.
   *
   * Sections are not alike — most have an eyebrow and a button, the Advisor's
   * Note also names a person and signs off. Registering all of it is safe
   * because the editor only shows a field the section actually uses.
   *
   * button_url and image_url are deliberately absent. A translation changes
   * words, not where a link goes or which photograph loads.
   */
  homepage_sections: [
    { key: 'title', label: 'Heading', kind: 'text', required: true },
    { key: 'subtitle', label: 'Sub-heading', kind: 'textarea' },
    { key: 'content', label: 'Body', kind: 'rich' },
    { key: 'button_text', label: 'Button', kind: 'text' },
    { key: 'extra_data.eyebrow', label: 'Small label above the heading', kind: 'text' },
    { key: 'extra_data.author_name', label: "Advisor's Note — name", kind: 'text' },
    { key: 'extra_data.author_role', label: "Advisor's Note — role", kind: 'text' },
    { key: 'extra_data.footnote', label: "Advisor's Note — closing line", kind: 'text' }
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
    { key: 'summary', label: 'One-line summary', kind: 'text' },
    { key: 'description', label: 'What happens that day', kind: 'rich', required: true },
    { key: 'accommodation', label: 'Where they stay', kind: 'text' },
    { key: 'meals', label: 'Meals included', kind: 'text' },
    { key: 'activities', label: 'Activities', kind: 'textarea' }
  ],
  /*
   * A safari package's own columns. The rest of its copy lives in `sections`,
   * a list of blocks that differs from page to page, so those fields are
   * listed per record by packageBlockFields below rather than here.
   *
   * Only the name is required: the hero and SEO fields are often left to fall
   * back to it, and a translation cannot be kept from publishing over a field
   * the default language never filled in.
   */
  safari_packages: [
    { key: 'name', label: 'Package name', kind: 'text', required: true, group: 'Page' },
    { key: 'hero_eyebrow', label: 'Hero — small label', kind: 'text', group: 'Page' },
    { key: 'hero_title', label: 'Hero — headline', kind: 'text', group: 'Page' },
    { key: 'hero_subtitle', label: 'Hero — sub-headline', kind: 'textarea', group: 'Page' },
    { key: 'meta_title', label: 'SEO title', kind: 'text', group: 'Search engines' },
    { key: 'seo_title', label: 'SEO title (alternative)', kind: 'text', group: 'Search engines' },
    { key: 'meta_description', label: 'SEO description', kind: 'textarea', group: 'Search engines' }
  ],
  /**
   * Privacy Policy, Terms, Cancellation Policy and Data Retention. Not a table:
   * each page is a fixed id whose English is its built-in wording plus any
   * edits in Settings (data/legal-pages.ts).
   */
  legal_pages: [
    { key: 'title', label: 'Page title', kind: 'text', required: true },
    { key: 'updated', label: 'Last updated', kind: 'text' },
    { key: 'intro', label: 'Introduction', kind: 'textarea' },
    { key: 'body', label: 'Page text', kind: 'rich', required: true },
    { key: 'meta_description', label: 'Search description', kind: 'textarea' }
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
  itinerary_days: 'tours.update',
  safari_packages: 'safari_packages.update',
  // The legal pages are edited in Settings, so translating them is too.
  legal_pages: 'settings.update'
};

// ── Safari packages: fields that live in blocks ──────────────────────────────

type BlockTextField = { key: string; label: string; kind: FieldKind };
type BlockTextSpec = {
  label: string;
  fields?: BlockTextField[];
  /** Lists of rows inside the block, each row with its own text fields. */
  items?: Record<string, { label: string; fields: BlockTextField[] }>;
};

/** Every block may carry these three above its own content. */
const BLOCK_HEADING_FIELDS: BlockTextField[] = [
  { key: 'eyebrow', label: 'Small label above the heading', kind: 'text' },
  { key: 'title', label: 'Heading', kind: 'text' },
  { key: 'intro', label: 'Intro paragraph', kind: 'textarea' }
];

/**
 * The words in each kind of block, mirroring the package editor's own field
 * list (frontend src/lib/safariPackageBlocks.ts). Only language is listed —
 * photos, icons, tour links, accommodation choices and route selections are
 * the same page in every language and never enter a translation.
 *
 * A block type missing here is not an error: its content just stays in the
 * default language until it is added.
 */
const PACKAGE_BLOCK_TEXT: Record<string, BlockTextSpec> = {
  facts: {
    label: 'Quick facts',
    items: {
      items: {
        label: 'Fact',
        fields: [
          { key: 'label', label: 'Label', kind: 'text' },
          { key: 'value', label: 'Detail', kind: 'text' }
        ]
      }
    }
  },
  prose: {
    label: 'Overview',
    fields: [
      { key: 'body', label: 'Trip overview', kind: 'rich' },
      { key: 'aside_title', label: 'Side card label', kind: 'text' },
      { key: 'aside_body', label: 'Side card text', kind: 'textarea' }
    ]
  },
  highlights: { label: 'Highlights', fields: [{ key: 'items', label: 'Highlights', kind: 'rich_list' }] },
  tiers: {
    label: 'Price tiers',
    fields: [{ key: 'note', label: 'Small print', kind: 'textarea' }],
    items: {
      tiers: {
        label: 'Tier',
        fields: [
          { key: 'label', label: 'Tier name', kind: 'text' },
          { key: 'price', label: 'Price', kind: 'text' },
          { key: 'body', label: 'What it includes', kind: 'textarea' }
        ]
      }
    }
  },
  itinerary: { label: 'Day-by-day itinerary' },
  compare: {
    label: 'Comparison table',
    fields: [{ key: 'columns', label: 'Column headings', kind: 'rich_list' }],
    items: {
      rows: {
        label: 'Row',
        fields: [
          { key: 'label', label: 'Row label', kind: 'text' },
          { key: 'values', label: 'Cells', kind: 'rich_list' }
        ]
      }
    }
  },
  inclusions: {
    label: 'Included / not included',
    fields: [
      { key: 'included', label: 'Included', kind: 'rich_list' },
      { key: 'excluded', label: 'Not included', kind: 'rich_list' }
    ]
  },
  gallery: {
    label: 'Photo grid',
    items: { images: { label: 'Photo', fields: [{ key: 'caption', label: 'Caption', kind: 'text' }] } }
  },
  tours: { label: 'Related trips' },
  faq: {
    label: 'Questions and answers',
    items: {
      items: {
        label: 'Question',
        fields: [
          { key: 'question', label: 'Question', kind: 'text' },
          { key: 'answer', label: 'Answer', kind: 'rich' }
        ]
      }
    }
  },
  enquiry: { label: 'Enquiry band' },
  routes: {
    label: 'Route options',
    fields: [{ key: 'cta_label', label: 'Button under each route', kind: 'text' }],
    items: {
      routes: {
        label: 'Route',
        fields: [
          { key: 'tab', label: 'Tab name', kind: 'text' },
          { key: 'best_for', label: 'Best for', kind: 'text' },
          { key: 'note', label: 'Route note', kind: 'textarea' },
          { key: 'stay_note', label: 'Introduction above accommodation', kind: 'textarea' },
          { key: 'stay_disclaimer', label: 'Paragraph below accommodation', kind: 'textarea' }
        ]
      }
    }
  },
  expectations: {
    label: 'What it can and cannot be',
    fields: [
      { key: 'can_title', label: 'Left heading', kind: 'text' },
      { key: 'can', label: 'Can', kind: 'rich_list' },
      { key: 'cannot_title', label: 'Right heading', kind: 'text' },
      { key: 'cannot', label: 'Cannot', kind: 'rich_list' },
      { key: 'note', label: 'Closing line', kind: 'textarea' }
    ]
  },
  priceguide: {
    label: 'Price guide',
    fields: [
      { key: 'small_print', label: 'Line under the table', kind: 'textarea' },
      { key: 'factors_title', label: 'Factors heading', kind: 'text' },
      { key: 'factors_note', label: 'Line under the factors', kind: 'textarea' },
      { key: 'note_label', label: 'Pull-quote label', kind: 'text' },
      { key: 'note', label: 'Pull quote', kind: 'textarea' },
      { key: 'cta_label', label: 'Button', kind: 'text' }
    ],
    items: {
      rows: {
        label: 'Option',
        fields: [
          { key: 'route', label: 'Option', kind: 'text' },
          { key: 'price', label: 'Price', kind: 'text' },
          { key: 'best_for', label: 'Usually best for', kind: 'text' },
          { key: 'tendency', label: 'Price tendency', kind: 'text' },
          { key: 'why', label: 'Why it costs that way', kind: 'textarea' }
        ]
      },
      factors: { label: 'Factor', fields: [{ key: 'text', label: 'Factor', kind: 'text' }] }
    }
  },
  advisor: {
    label: "Advisor's note",
    fields: [
      { key: 'body', label: 'The note', kind: 'rich' },
      { key: 'footnote', label: 'Closing line', kind: 'textarea' },
      { key: 'author_name', label: 'Advisor name', kind: 'text' },
      { key: 'author_role', label: 'Advisor role', kind: 'text' }
    ],
    items: {
      columns: {
        label: 'List',
        fields: [
          { key: 'title', label: 'List heading', kind: 'text' },
          { key: 'items', label: 'Points', kind: 'rich_list' }
        ]
      }
    }
  }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasId = (value: Record<string, unknown>) => typeof value._id === 'string' && value._id.trim().length > 0;

/**
 * Gives every block, and every row inside a block, the `_id` its translations
 * are keyed by — in memory, on this copy of the record.
 *
 * Packages saved from now on carry their ids in the database; the editor adds
 * them. Older ones do not, so they get the one rule the editor also follows
 * when it first opens such a page: block N is `bN`, row N of a list is `rN`.
 * The two sides agree without either having to write to the other, and once
 * the page is saved the same ids are simply stored.
 */
export const ensurePackageIds = (record: Record<string, unknown>): void => {
  const sections = record.sections;
  if (!Array.isArray(sections)) return;
  sections.forEach((block, blockIndex) => {
    if (!isPlainObject(block)) return;
    if (!hasId(block)) block._id = `b${blockIndex}`;
    for (const value of Object.values(block)) {
      if (!Array.isArray(value)) continue;
      value.forEach((row, rowIndex) => {
        if (isPlainObject(row) && !hasId(row)) row._id = `r${rowIndex}`;
      });
    }
  });
};

/** A short, readable name for a block or row in the panel: its own heading if it has one. */
const excerpt = (value: unknown, length = 48): string => {
  const text = toPlainText(typeof value === 'string' ? value : '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
};

/**
 * The translatable fields inside one package's blocks, in page order.
 *
 * Every field is listed whether or not the default language has filled it in
 * — sourceFieldsFor keeps only the ones with text, and the panel hides the
 * rest — so a translation's keys never depend on what happens to be written
 * today. None is required: blocks come and go, and publishing must not hang on
 * one that was added after the translation was done.
 */
export const packageBlockFields = (record: Record<string, unknown>): TranslatableField[] => {
  ensurePackageIds(record);
  const sections = Array.isArray(record.sections) ? record.sections : [];
  const out: TranslatableField[] = [];

  for (const block of sections) {
    if (!isPlainObject(block)) continue;
    const spec = PACKAGE_BLOCK_TEXT[String(block.type)];
    if (!spec) continue;
    const blockId = String(block._id);
    const named = excerpt(block.title);
    const group = named ? `${spec.label} — ${named}` : spec.label;

    for (const field of [...BLOCK_HEADING_FIELDS, ...(spec.fields ?? [])]) {
      out.push({ key: `sections.#${blockId}.${field.key}`, label: field.label, kind: field.kind, group });
    }

    for (const [listKey, list] of Object.entries(spec.items ?? {})) {
      const rows = Array.isArray(block[listKey]) ? (block[listKey] as unknown[]) : [];
      rows.forEach((row, rowIndex) => {
        if (!isPlainObject(row)) return;
        const rowName = excerpt(row.tab ?? row.question ?? row.label ?? row.title ?? row.route ?? row.text, 32);
        const prefix = `${list.label} ${rowIndex + 1}${rowName ? ` (${rowName})` : ''}`;
        for (const field of list.fields) {
          out.push({
            key: `sections.#${blockId}.${listKey}.#${String(row._id)}.${field.key}`,
            label: `${prefix} — ${field.label}`,
            kind: field.kind,
            group
          });
        }
      });
    }
  }
  return out;
};

/**
 * The fields of one record: the registry's, plus — for an entity whose copy
 * lives in a list of blocks — the ones that list holds. Pass the record
 * wherever it is known; without it only the registry's fields exist.
 */
export const fieldsFor = (entityType: string, record?: Record<string, unknown> | null): TranslatableField[] => {
  const base = TRANSLATABLE_ENTITIES[entityType] ?? [];
  if (entityType === 'safari_packages' && record) return [...base, ...packageBlockFields(record)];
  return base;
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
  for (const field of fieldsFor(entityType, record)) {
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
/**
 * The required fields that actually apply. A field is only required when the
 * default language has text in it — twelve safari styles have no English short
 * description, and demanding a translation of nothing left them unpublishable.
 * Without `source`, every required field counts.
 */
const requiredFor = (entityType: string, source?: TranslationFields): TranslatableField[] =>
  (TRANSLATABLE_ENTITIES[entityType] ?? []).filter(
    (field) => field.required && (!source || filled(source[field.key]))
  );

export const completenessFor = (entityType: string, fields: TranslationFields, source?: TranslationFields): number => {
  const required = requiredFor(entityType, source);
  if (!required.length) return 0;
  const done = required.filter((field) => filled(fields[field.key])).length;
  return Math.round((done / required.length) * 100);
};

export const missingRequiredFields = (
  entityType: string,
  fields: TranslationFields,
  source?: TranslationFields
): string[] =>
  requiredFor(entityType, source)
    .filter((field) => !filled(fields[field.key]))
    .map((field) => field.label);

/**
 * Keep only registered keys and sanitise every value — translation input is
 * CMS content like any other, whether it came from a person or a model. Rich
 * kinds go through the HTML sanitiser; plain kinds are stripped to text.
 */
export const cleanTranslationFields = (
  entityType: string,
  raw: unknown,
  record?: Record<string, unknown> | null
): TranslationFields => {
  const out: TranslationFields = {};
  if (!raw || typeof raw !== 'object') return out;
  const input = raw as Record<string, unknown>;
  // With the record, fields that live in its blocks are accepted too; without
  // it, only the registry's — an unknown key is dropped, never stored.
  for (const field of fieldsFor(entityType, record)) {
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
    // Block translations are keyed by id; a package saved before ids existed
    // needs the same in-memory ids its translation was written against.
    if (entityType === 'safari_packages') ensurePackageIds(record);
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
