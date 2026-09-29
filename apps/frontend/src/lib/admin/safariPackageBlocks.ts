/**
 * The block vocabulary for safari-package landing pages.
 *
 * One list, read by two things: the editor builds its form from it, and the
 * renderer draws whatever the editor produced. Adding a block type means adding
 * an entry here and a branch in the renderer — no migration, and no second
 * place where the field names have to be kept in step.
 *
 * A page is `sections: Block[]`, each `{ type, ...fields }`. The renderer skips
 * a type it does not recognise rather than throwing, so removing a block type
 * cannot break a page that still has one saved.
 */

export type Block = Record<string, unknown> & { type: string };

/** How the editor draws one field. The renderer never reads these. */
export type FieldKind =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'image'
  /** A controlled, visual choice from the package icon set. */
  | 'icon'
  /** A simple list of strings, one per line. */
  | 'lines'
  /** A list of objects; `fields` describes one row. */
  | 'items'
  /** A route's accommodation-category tabs, tours and selected properties. */
  | 'routeComforts';

export type FieldSpec = {
  key: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  placeholder?: string;
  /** 'items' only — the shape of one row. */
  fields?: FieldSpec[];
};

export type BlockSpec = {
  type: string;
  label: string;
  /** One line telling an editor what this block is for. */
  blurb: string;
  fields: FieldSpec[];
};

/** Icons the quick-facts strip can draw. The renderer maps these to Lucide. */
export const FACT_ICONS = ['plane', 'pin', 'clock', 'route', 'price', 'people', 'vehicle', 'tent'] as const;

const eyebrow: FieldSpec = { key: 'eyebrow', label: 'Small label above the heading', kind: 'text', placeholder: 'Why this trip' };
const title: FieldSpec = { key: 'title', label: 'Heading', kind: 'text' };
const intro: FieldSpec = { key: 'intro', label: 'Intro paragraph', kind: 'textarea' };

export const BLOCK_TYPES: BlockSpec[] = [
  {
    type: 'facts',
    label: 'Quick facts strip',
    blurb: 'The short bar of trip facts — where it starts, how long, what it covers.',
    fields: [
      {
        key: 'items',
        label: 'Quick facts',
        kind: 'items',
        hint: 'Add the essential trip details travellers compare first. Three to five facts read best; incomplete facts stay off the page.',
        fields: [
          { key: 'label', label: 'What is this?', kind: 'text', placeholder: 'Duration' },
          { key: 'value', label: 'Trip detail', kind: 'text', placeholder: '2 days, 1 night' },
          { key: 'icon', label: 'Matching icon', kind: 'icon', hint: 'Choose the icon that makes this fact easiest to scan.' }
        ]
      }
    ]
  },
  {
    type: 'prose',
    label: 'Overview & story',
    blurb: 'Tell the story of the trip. Typography and the companion note use the page’s fixed layout.',
    fields: [
      eyebrow,
      title,
      { key: 'body', label: 'Trip overview', kind: 'richtext', hint: 'Write in short paragraphs. Use lists for highlights; spacing and text sizes are automatic.' },
      { key: 'aside_title', label: 'Side card label', kind: 'text', hint: 'Fill both to show a card beside the copy; leave either empty and the copy runs full width.', placeholder: 'Keep in mind' },
      { key: 'aside_body', label: 'Side card text', kind: 'textarea' }
    ]
  },
  {
    type: 'highlights',
    label: 'Highlights with a photo',
    blurb: 'A picture beside a list of what makes this trip worth taking.',
    fields: [
      eyebrow,
      title,
      intro,
      { key: 'image_url', label: 'Photo', kind: 'image' },
      { key: 'items', label: 'Highlights', kind: 'lines', hint: 'One per line.' }
    ]
  },
  {
    type: 'tiers',
    label: 'Price tiers',
    blurb: 'Comfort levels side by side. Leave a price empty and only the name shows.',
    fields: [
      eyebrow,
      title,
      intro,
      {
        key: 'tiers',
        label: 'Tiers',
        kind: 'items',
        fields: [
          { key: 'label', label: 'Tier name', kind: 'text', placeholder: 'Mid-range' },
          { key: 'price', label: 'Price', kind: 'text', placeholder: 'From $1,450 pp' },
          { key: 'body', label: 'What it includes', kind: 'textarea' }
        ]
      },
      { key: 'note', label: 'Small print', kind: 'textarea' }
    ]
  },
  {
    type: 'itinerary',
    label: 'Day-by-day itinerary',
    blurb: "Renders the linked tour's real published days. Nothing to type — set the tour on the page itself.",
    fields: [eyebrow, title, intro]
  },
  {
    type: 'compare',
    label: 'Comparison table',
    blurb: 'This trip against the alternatives, so a reader can rule one in.',
    fields: [
      eyebrow,
      title,
      intro,
      { key: 'columns', label: 'Column headings', kind: 'lines', hint: 'One per line. The first column is the row label.' },
      {
        key: 'rows',
        label: 'Rows',
        kind: 'items',
        fields: [
          { key: 'label', label: 'Row label', kind: 'text' },
          { key: 'values', label: 'Cells', kind: 'lines', hint: 'One per line, in column order.' }
        ]
      }
    ]
  },
  {
    type: 'inclusions',
    label: 'Included / not included',
    blurb: 'Two columns. Either one alone is fine.',
    fields: [
      title,
      { key: 'included', label: 'Included', kind: 'lines' },
      { key: 'excluded', label: 'Not included', kind: 'lines' }
    ]
  },
  {
    type: 'gallery',
    label: 'Photo grid',
    blurb: 'Pictures of the actual trip.',
    fields: [
      eyebrow,
      title,
      {
        key: 'images',
        label: 'Photos',
        kind: 'items',
        fields: [
          { key: 'image_url', label: 'Photo', kind: 'image' },
          { key: 'caption', label: 'Caption', kind: 'text' }
        ]
      }
    ]
  },
  {
    type: 'tours',
    label: 'Related trips',
    blurb: 'Cards linking to real tours. They stay the product pages; this only points at them.',
    fields: [
      eyebrow,
      title,
      intro,
      { key: 'tour_slugs', label: 'Tour slugs', kind: 'lines', hint: 'One slug per line, in the order you want them shown.' }
    ]
  },
  {
    type: 'faq',
    label: 'Questions and answers',
    blurb:
      'The questions this trip actually gets asked. Type them here and they are this page\'s own; leave the list empty and the page falls back to whatever the FAQ module has attached to this package, so shared questions stay in one place.',
    fields: [
      eyebrow,
      title,
      intro,
      {
        key: 'items',
        label: 'Questions',
        kind: 'items',
        hint: 'A question with no answer, or an answer with no question, is left out.',
        fields: [
          { key: 'question', label: 'Question', kind: 'text' },
          // The accordion has always drawn answers through RichText; the editor
          // was the only half of that pair still handing it plain text.
          { key: 'answer', label: 'Answer', kind: 'richtext' }
        ]
      }
    ]
  },
  {
    type: 'enquiry',
    label: 'Enquiry band',
    blurb: 'The trip planner, on the dark band. One per page is plenty.',
    fields: [eyebrow, title, intro]
  },
  {
    type: 'routes',
    label: 'Route options',
    blurb:
      'Choose the tours travellers can take. Photos, prices and day-by-day details come from those tours automatically.',
    fields: [
      eyebrow,
      title,
      intro,
      {
        key: 'routes',
        label: 'Routes',
        kind: 'items',
        hint: 'Give each route a descriptive name, such as Tarangire & Ngorongoro. Three or four routes work best.',
        fields: [
          { key: 'tab', label: 'Tab name', kind: 'text', placeholder: 'Option 1', hint: 'What travellers see on the tab, exactly as you write it — Option 1, Tarangire & Ngorongoro, anything. Leave blank to use the selected tour’s title.' },
          {
            key: 'comforts',
            label: 'Accommodation levels',
            kind: 'routeComforts',
            hint: 'Select a comfort level, then its published tour. Optionally feature properties from the accommodation library. The tour’s own stays remain in its itinerary.'
          },
          { key: 'best_for', label: 'Best for', kind: 'text', placeholder: 'first-time safari travellers who want the classic route.' },
          { key: 'note', label: 'Useful route note', kind: 'textarea', placeholder: 'This route is busier and needs careful flight and lodge timing.' },
          { key: 'stay_note', label: 'Introduction above accommodation cards (optional)', kind: 'textarea', hint: 'Appears below “Accommodation Options”, before the property photos.', placeholder: 'A comfortable lodge or tented camp with better rest between safari activities.' },
          { key: 'stay_disclaimer', label: 'Paragraph below accommodation cards', kind: 'textarea', hint: 'This is the note below the lodge cards. Leave blank to keep the standard availability note shown here.', placeholder: 'Final accommodation depends on route choice, travel date, availability and preferred comfort level.' }
        ]
      },
      { key: 'cta_label', label: 'Button under each route', kind: 'text', placeholder: 'Send request for this route' }
    ]
  },
  {
    type: 'expectations',
    label: 'What it can and cannot be',
    blurb: 'Two honest lists. Sets expectations before someone books a trip that is too short for what they want.',
    fields: [
      eyebrow,
      title,
      intro,
      { key: 'can_title', label: 'Left heading', kind: 'text', placeholder: 'Two days can give you' },
      { key: 'can', label: 'Can', kind: 'lines' },
      { key: 'cannot_title', label: 'Right heading', kind: 'text', placeholder: 'Two days cannot give you' },
      { key: 'cannot', label: 'Cannot', kind: 'lines' },
      { key: 'note', label: 'Closing line', kind: 'textarea' }
    ]
  },
  {
    type: 'priceguide',
    label: 'Price guide',
    blurb: 'What the options cost and why they differ, plus what moves a quote.',
    fields: [
      eyebrow,
      title,
      intro,
      {
        key: 'rows',
        label: 'Options',
        kind: 'items',
        fields: [
          { key: 'route', label: 'Option', kind: 'text', placeholder: 'Mikumi overnight' },
          { key: 'price', label: 'Price', kind: 'text', placeholder: 'From ~$850 pp' },
          { key: 'best_for', label: 'Usually best for', kind: 'text' },
          { key: 'tendency', label: 'Price tendency', kind: 'text', placeholder: 'Usually lower' },
          { key: 'why', label: 'Why it costs that way', kind: 'textarea' }
        ]
      },
      { key: 'small_print', label: 'Line under the table', kind: 'textarea' },
      { key: 'factors_title', label: 'Factors heading', kind: 'text', placeholder: 'Why your quote may change' },
      {
        key: 'factors',
        label: 'What moves the price',
        kind: 'items',
        hint: 'Add one factor at a time and choose its icon.',
        fields: [
          { key: 'icon', label: 'Icon', kind: 'icon' },
          { key: 'text', label: 'Factor', kind: 'text', placeholder: 'Travel date' }
        ]
      },
      { key: 'factors_note', label: 'Line under the factors', kind: 'textarea' },
      { key: 'note_label', label: 'Pull-quote label', kind: 'text', placeholder: 'Key2africa note' },
      { key: 'note', label: 'Pull quote', kind: 'textarea' },
      { key: 'cta_label', label: 'Button', kind: 'text', placeholder: 'Check My Date and Group Size' }
    ]
  },
  {
    type: 'advisor',
    label: "Advisor's note",
    blurb:
      'The same note the rest of the site carries, in this trip\'s own words. Anything left empty keeps what the site-wide note says — so a page that only needs a different paragraph writes only that paragraph, and an edit to the site-wide note still reaches it. Switching the note off under Homepage → Advisor\'s note takes it off every page, this one included.',
    fields: [
      eyebrow,
      title,
      { key: 'body', label: 'The note', kind: 'richtext' },
      { key: 'footnote', label: 'Closing line', kind: 'textarea', hint: 'Set in italics under the lists.' },
      { key: 'author_name', label: 'Advisor name', kind: 'text' },
      { key: 'author_role', label: 'Advisor role', kind: 'text' },
      { key: 'image_url', label: 'Advisor photo', kind: 'image', hint: 'Empty keeps the site-wide portrait.' },
      {
        key: 'columns',
        label: 'Lists beside the note',
        kind: 'items',
        hint: 'Two read best, and only the first two are drawn. Add none and the site-wide lists stand.',
        fields: [
          { key: 'title', label: 'List heading', kind: 'text', placeholder: 'What this trip gets right' },
          { key: 'icon_url', label: 'Icon', kind: 'image' },
          { key: 'items', label: 'Points', kind: 'lines', hint: 'One per line.' }
        ]
      }
    ]
  }
];

/**
 * "Mid-range | 2-day-tarangire-midrange" → { label, slug }.
 *
 * A line with no pipe is taken as a bare slug and labelled from the tour it
 * resolves to, so a single-comfort route needs no ceremony.
 */
export const parseRouteTour = (line: string): { label: string; slug: string } => {
  const [first, ...rest] = str(line).split('|');
  const slug = (rest.length ? rest.join('|') : first).trim();
  return { label: rest.length ? first.trim() : '', slug };
};

/** Generic numbering is a placeholder, never a useful traveller-facing name. */
/**
 * The name on a route tab.
 *
 * Whatever the editor typed, verbatim. This used to treat "Option 1" and
 * friends as placeholder text and quietly swap in the tour title instead —
 * so an editor who deliberately wanted short, numbered tabs could not have
 * them, and nothing on the screen explained why. The tour title is the
 * fallback for a blank field, not an override of a filled one.
 */
export const routeDisplayName = (label: unknown, tourTitle: unknown): string =>
  str(label).trim() || str(tourTitle).trim();

/** Use current selections when present; legacy tour lines are fallback only. */
export const routeTourSlugs = (route: Record<string, unknown>): string[] => {
  const comforts = Array.isArray(route.comforts) ? route.comforts : [];
  return comforts.length
    ? comforts.map((entry) => str(entry?.tour_slug).trim()).filter(Boolean)
    : lines(route.tours).map((line) => parseRouteTour(line).slug).filter(Boolean);
};

export const blockSpec = (type: string): BlockSpec | undefined => BLOCK_TYPES.find((spec) => spec.type === type);

/** A new block with every field present and empty, so the editor has rows to fill. */
// ── Stable ids ────────────────────────────────────────────────────────────────
//
// Translations of a package's blocks are keyed by `_id`, not by position, so an
// editor who moves a section does not move its Italian into another section.
// The backend reads the same ids (ensurePackageIds in backend
// src/utils/translations.ts); the two rules below must stay identical to it.

/** A fresh id for a block or row created in the editor. */
export const newBlockId = (prefix: 'x' | 'y'): string =>
  `${prefix}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

const isRow = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const hasId = (value: Record<string, unknown>) => typeof value._id === 'string' && value._id.trim().length > 0;

/**
 * Ids for blocks and rows saved before ids existed: block N is `bN`, row N of a
 * list is `rN` — counted in STORED order, before any re-sorting, because that
 * is the order the backend counts in when it translates a page nobody has
 * re-saved yet. Anything that already has an id keeps it.
 */
export const withLegacyIds = (blocks: Block[]): Block[] => {
  blocks.forEach((block, blockIndex) => {
    if (!hasId(block)) block._id = `b${blockIndex}`;
    for (const value of Object.values(block)) {
      if (!Array.isArray(value)) continue;
      value.forEach((row, rowIndex) => {
        if (isRow(row) && !hasId(row)) row._id = `r${rowIndex}`;
      });
    }
  });
  return blocks;
};

/** A safety net at save time: anything still without an id gets a fresh one. */
const withFreshIds = (blocks: Block[]): Block[] => {
  for (const block of blocks) {
    if (!hasId(block)) block._id = newBlockId('x');
    for (const value of Object.values(block)) {
      if (!Array.isArray(value)) continue;
      for (const row of value) if (isRow(row) && !hasId(row)) row._id = newBlockId('y');
    }
  }
  return blocks;
};

export const emptyBlock = (type: string): Block => {
  const spec = blockSpec(type);
  // Given at birth, not at save: an id minted on each save would be a new id
  // every time, and every translation of the block would be orphaned.
  const block: Block = { type, _id: newBlockId('x') };
  for (const field of spec?.fields ?? []) {
    if (field.kind === 'items') block[field.key] = [];
    else if (field.kind === 'lines') block[field.key] = [];
    else if (field.kind === 'number') block[field.key] = null;
    else block[field.key] = '';
  }
  return block;
};

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// ── Reading a stored block safely ───────────────────────────────────────────
//
// Everything below assumes nothing about what is in the jsonb. A block written
// by an older version of the editor, or by hand, must not be able to throw.

export const str = (value: unknown): string => (typeof value === 'string' ? value : '');

export const arr = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** Non-blank strings only — an empty line an editor left behind is not content. */
export const lines = (value: unknown): string[] =>
  (typeof value === 'string' ? value.split('\n') : arr<unknown>(value))
    .map((entry) => str(entry).trim())
    .filter(Boolean);

const iconName = (value: unknown): string => {
  const icon = str(value).trim().toLowerCase();
  return (FACT_ICONS as readonly string[]).includes(icon) ? icon : '';
};

/** Older price factors were written as `icon | label` text lines. */
const priceFactorsForEditing = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? (value as unknown[])
        .map((factor) => {
          if (factor && typeof factor === 'object') {
            const row = factor as Record<string, unknown>;
            return { ...row, icon: iconName(row.icon) };
          }
          const [maybeIcon, ...rest] = str(factor).split('|');
          const hasIcon = rest.length > 0 && Boolean(iconName(maybeIcon));
          return { icon: hasIcon ? iconName(maybeIcon) : '', text: (hasIcon ? rest.join('|') : maybeIcon).trim() };
        })
        .filter((factor) => str(factor.text).trim())
    : [];

/** Older routes used `Label | tour-slug` lines rather than connected CMS choices. */
const routeComfortsForEditing = (value: unknown): Record<string, unknown>[] =>
  lines(value).map((line) => {
    const parsed = parseRouteTour(line);
    const candidate = parsed.label.trim().toUpperCase().replace(/[\s-]+/g, '_');
    const accommodation_level = ['BUDGET', 'MID_RANGE', 'LUXURY', 'PREMIUM_LUXURY'].includes(candidate) ? candidate : '';
    return { accommodation_level, tour_slug: parsed.slug, accommodation_ids: [], label: parsed.label };
  });

/** Rows that carry at least one non-blank value of their own. */
export const rows = <T extends Record<string, unknown>>(value: unknown): T[] =>
  arr<T>(value).filter((row) => row && typeof row === 'object' && Object.values(row).some((v) => (Array.isArray(v) ? v.length : str(v).trim())));

// ── Editing shape vs stored shape ───────────────────────────────────────────
//
// A `lines` field is an array in the database and a textarea in the editor. The
// two conversions live here rather than in the form, so the editor can bind
// every control straight to the block — the components in this codebase expose
// `bind:value` and do not forward input events, and a handler that never fires
// silently drops what an editor typed.

const eachLinesField = (block: Block, run: (key: string) => void) => {
  for (const field of blockSpec(block.type)?.fields ?? []) {
    if (field.kind === 'lines') run(field.key);
    if (field.kind === 'items') {
      for (const sub of field.fields ?? []) if (sub.kind === 'lines') run(`${field.key}.${sub.key}`);
    }
  }
};

/** Stored → editable: arrays of lines become one string per line. */
export const blocksForEditing = (source: unknown): Block[] =>
  withLegacyIds(arr<Block>(source).map((block) => structuredClone(block))).map((block) => {
    const next: Block = { ...structuredClone(block), type: str(block.type) };
    if (next.type === 'priceguide') next.factors = priceFactorsForEditing(next.factors);
    if (next.type === 'routes') {
      next.routes = arr<Record<string, unknown>>(next.routes).map((route) => ({
        ...route,
        comforts: Array.isArray(route.comforts) ? route.comforts : routeComfortsForEditing(route.tours)
      }));
    }
    eachLinesField(next, (path) => {
      const [key, sub] = path.split('.');
      if (sub) {
        next[key] = arr<Record<string, unknown>>(next[key]).map((row) => ({ ...row, [sub]: lines(row[sub]).join('\n') }));
      } else {
        next[key] = lines(next[key]).join('\n');
      }
    });
    return next;
  });

/** Editable → stored: those strings become arrays again, blanks dropped. */
export const blocksForSaving = (source: unknown): Block[] =>
  withFreshIds(arr<Block>(source).map((block) => structuredClone(block))).map((block) => {
    const next: Block = { ...structuredClone(block), type: str(block.type) };
    eachLinesField(next, (path) => {
      const [key, sub] = path.split('.');
      const split = (value: unknown) => lines(value);
      if (sub) {
        next[key] = arr<Record<string, unknown>>(next[key]).map((row) => ({ ...row, [sub]: split(row[sub]) }));
      } else {
        next[key] = split(next[key]);
      }
    });
    return next;
  });
