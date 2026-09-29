/**
 * Is this landing page worth indexing, or is it the last one with the nouns
 * swapped?
 *
 * Deterministic. No AI, no network, no I/O — the same page always scores the
 * same, and an editor can be told exactly what is missing. It measures two
 * things:
 *
 *   1. BREADTH — does the page engage with the specifics a real trip page has:
 *      named parks, a stated length, where it departs, when it is good, what it
 *      costs, actual days, where you sleep, how you move, who it suits.
 *      Deliberately NOT "does it mention the destination often" — sprinkling
 *      "Serengeti" through generic copy is the failure this exists to catch.
 *
 *   2. SIMILARITY — with the distinguishing nouns masked out, how much of this
 *      page is word-for-word one of its siblings. Masking is what exposes a
 *      find-and-replace clone: remove "Serengeti"/"Tarangire" and two pages
 *      built that way align almost perfectly.
 *
 * It returns a WARNING. It never blocks a save. The editor decides.
 */

export type AssessablePage = {
  slug?: string | null;
  name?: string | null;
  hero_eyebrow?: string | null;
  hero_title?: string | null;
  hero_subtitle?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  sections?: unknown;
  /** Days from the linked tour count as itinerary detail this page carries. */
  itinerary_day_count?: number | null;
  indexable?: boolean | null;
  status?: string | null;
  id?: string | null;
};

export type SignalKey =
  | 'named_parks'
  | 'stated_duration'
  | 'departure_point'
  | 'seasonality'
  | 'price_specifics'
  | 'itinerary_detail'
  | 'accommodation_named'
  | 'logistics'
  | 'who_its_for'
  | 'inclusions_stated'
  | 'content_spread';

export type Signal = { key: SignalKey; label: string; core: boolean; present: boolean; detail: string };
export type SimilarPage = { slug: string; name: string; overlap: number };
export type Verdict = 'strong' | 'moderate' | 'weak';
export type Assessment = {
  verdict: Verdict;
  signals: Signal[];
  strengths: string[];
  gaps: string[];
  similar: SimilarPage[];
  requiresAcknowledgement: boolean;
};

/** Two pages this alike, once their nouns are masked, are the same page. */
export const CLONE_THRESHOLD = 0.72;
/** Worth showing the editor, even if not disqualifying. */
const REPORT_THRESHOLD = 0.4;

// ── Vocabulary — Key2africa's own subject matter ─────────────────────────────
// Lowercase throughout: `mentions` does not use the `i` flag, and relies on the
// haystack having been lowercased by `normalise`.

const PARKS = [
  'serengeti', 'ngorongoro', 'tarangire', 'lake manyara', 'manyara', 'mikumi', 'nyerere', 'selous',
  'ruaha', 'mahale', 'gombe', 'katavi', 'arusha national park', 'kilimanjaro', 'meru',
  'zanzibar', 'stone town', 'nungwi', 'kendwa', 'paje', 'jambiani', 'mafia island', 'pemba',
  'masai mara', 'maasai mara', 'amboseli', 'tsavo', 'bwindi', 'volcanoes national park', 'ndutu',
  'seronera', 'grumeti', 'olduvai', 'empakaai', 'lake natron'
];

const GATEWAYS = [
  'zanzibar', 'arusha', 'moshi', 'kilimanjaro airport', 'jro', 'dar es salaam', 'nairobi',
  'mwanza', 'entebbe', 'kigali', 'karatu', 'stone town'
];

const SEASON_WORDS = [
  'dry season', 'green season', 'wet season', 'short rains', 'long rains', 'migration',
  'calving', 'river crossing', 'shoulder season', 'high season', 'low season', 'best time',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december'
];

const LOGISTICS_WORDS = [
  'flight', 'flights', 'fly-in', 'fly in', 'light aircraft', 'airstrip', 'transfer', 'transfers',
  'drive', 'driving', 'road', 'game drive', 'game drives', 'pickup', 'pick-up', 'domestic flight',
  'charter', 'ferry', 'crater rim', 'travel time'
];

const MONEY_WORDS = [
  'usd', 'per person', 'price', 'prices', 'priced', 'from $', 'deposit', 'park fees',
  'conservation fee', 'cost', 'costs', 'budget', 'rate', 'rates'
];

const STAY_WORDS = [
  'camp', 'camps', 'lodge', 'lodges', 'tented', 'tented camp', 'mobile camp', 'hotel',
  'guesthouse', 'resort', 'accommodation', 'half board', 'full board'
];

const AUDIENCE_WORDS = [
  'family', 'families', 'children', 'honeymoon', 'couples', 'first-time', 'first time',
  'photographers', 'photography', 'solo', 'small group', 'private', 'group', 'seniors',
  'active', 'wheelchair', 'mobility'
];

const DURATION_RE = /(?:^|[^a-z0-9])(\d{1,2})\s*[- ]?\s*(?:day|days|night|nights)(?:[^a-z0-9]|$)/;

// ── Text extraction ────────────────────────────────────────────────────────

type PageText = { all: string; blocks: { type: string; text: string }[]; words: number };

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, ' ');
const normalise = (value: string) => stripHtml(value).toLowerCase().replace(/\s+/g, ' ').trim();

const sectionsOf = (page: AssessablePage): Record<string, unknown>[] =>
  Array.isArray(page.sections) ? (page.sections as Record<string, unknown>[]) : [];

/** Every string anywhere inside a block. Numbers and booleans are not prose. */
const blockText = (block: unknown): string => {
  const out: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(block);
  return out.join(' ');
};

const readPage = (page: AssessablePage): PageText => {
  const blocks = sectionsOf(page).map((block) => ({
    type: String((block as { type?: unknown })?.type ?? ''),
    text: normalise(blockText(block))
  }));
  // The slug and the admin name are deliberately excluded: naming the trip in
  // the CMS label is not the same as writing about it.
  const chrome = [page.hero_eyebrow, page.hero_title, page.hero_subtitle, page.meta_title, page.meta_description]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .map(normalise);
  const all = [...chrome, ...blocks.map((block) => block.text)].join(' ');
  return { all, blocks, words: all.split(' ').filter(Boolean).length };
};

// ── Whole-word matching ────────────────────────────────────────────────────

const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Boundary is `[^a-z0-9]`, not `\b`.
 *
 * Substring matching is what makes this kind of checker lie: "meru" inside
 * "Kilimanjaro and Meru" is a real hit, but "camp" inside "campaign" is not,
 * and a bare `\b` still lets accented and hyphenated neighbours through
 * inconsistently. Needles may contain spaces and hyphens and match literally.
 */
const mentions = (haystack: string, needles: string[]): boolean =>
  needles.some((needle) => {
    if (!needle) return false;
    return new RegExp(`(?:^|[^a-z0-9])${escapeRe(needle)}(?:[^a-z0-9]|$)`).test(haystack);
  });

const countMentions = (haystack: string, needles: string[]): number =>
  needles.filter((needle) => needle && new RegExp(`(?:^|[^a-z0-9])${escapeRe(needle)}(?:[^a-z0-9]|$)`).test(haystack)).length;

// ── Similarity ─────────────────────────────────────────────────────────────

/** Longest first, so "lake manyara" is removed before "manyara". */
const ALL_DISTINGUISHING = [...new Set([...PARKS, ...GATEWAYS])].sort((a, b) => b.length - a.length);

/**
 * Blank out the words that make two otherwise identical pages look different.
 * Plain substring replacement, deliberately aggressive: the point is to leave
 * behind the sentence skeleton, and a clone's skeleton is its sibling's.
 * Digits go too, so "2 Day" and "5 Day" stop rescuing a copied page.
 */
const maskDistinguishing = (text: string): string => {
  let out = text;
  for (const word of ALL_DISTINGUISHING) out = out.split(word).join(' ');
  return out.replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim();
};

const shingles = (text: string, k = 5): Set<string> => {
  const words = text.split(' ').filter(Boolean);
  const set = new Set<string>();
  for (let i = 0; i + k <= words.length; i += 1) set.add(words.slice(i, i + k).join(' '));
  return set;
};

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const item of a) if (b.has(item)) shared += 1;
  return shared / (a.size + b.size - shared);
};

// ── Signals ────────────────────────────────────────────────────────────────

const detectSignals = (text: PageText, page: AssessablePage): Signal[] => {
  const all = text.all;
  const parkHits = countMentions(all, PARKS);
  const dayCount = Number(page.itinerary_day_count ?? 0);
  const blockTypes = new Set(text.blocks.map((block) => block.type));

  const signal = (key: SignalKey, label: string, core: boolean, present: boolean, detail: string): Signal => ({
    key, label, core, present, detail
  });

  return [
    signal('named_parks', 'Names real places', true, parkHits >= 2,
      parkHits >= 2
        ? `Names ${parkHits} specific places, so the page is about somewhere`
        : 'Names fewer than two specific parks or areas — the copy could be about any trip'),

    signal('stated_duration', 'States how long', true, DURATION_RE.test(all),
      DURATION_RE.test(all)
        ? 'Says how many days or nights the trip runs'
        : 'Never states a length in days or nights'),

    signal('departure_point', 'Says where it starts', true, mentions(all, GATEWAYS),
      mentions(all, GATEWAYS)
        ? 'Names where the trip departs from'
        : 'Does not say where the trip starts — the one thing a search for “safari from …” is asking'),

    signal('seasonality', 'Talks about timing', true, mentions(all, SEASON_WORDS),
      mentions(all, SEASON_WORDS)
        ? 'Explains when this trip is at its best'
        : 'No months or seasons — nothing that helps someone choose dates'),

    signal('price_specifics', 'Gives money detail', true, mentions(all, MONEY_WORDS),
      mentions(all, MONEY_WORDS)
        ? 'Puts real numbers or price bands on the trip'
        : 'No prices or cost guidance anywhere on the page'),

    signal('itinerary_detail', 'Has real days', true, dayCount >= 2,
      dayCount >= 2
        ? `Renders ${dayCount} published days from the linked tour`
        : 'No tour linked, or the linked tour has no published itinerary — the day-by-day block will draw nothing'),

    signal('accommodation_named', 'Says where you sleep', false, mentions(all, STAY_WORDS),
      mentions(all, STAY_WORDS)
        ? 'Describes the kind of accommodation'
        : 'Says nothing about where travellers stay'),

    signal('logistics', 'Explains the moving parts', false, mentions(all, LOGISTICS_WORDS),
      mentions(all, LOGISTICS_WORDS)
        ? 'Covers flights, transfers or drive time'
        : 'No flights, transfers or travel time — the questions this trip actually gets'),

    signal('who_its_for', 'Says who it suits', false, mentions(all, AUDIENCE_WORDS),
      mentions(all, AUDIENCE_WORDS)
        ? 'Says who the trip suits'
        : 'Never says who this trip is for'),

    signal('inclusions_stated', 'Draws the line', false, blockTypes.has('inclusions'),
      blockTypes.has('inclusions')
        ? 'Spells out what is and is not included'
        : 'No inclusions block — nothing states what the price covers'),

    signal('content_spread', 'Enough of a page', false, text.words >= 250 && text.blocks.length >= 4,
      text.words >= 250 && text.blocks.length >= 4
        ? `${text.words} words across ${text.blocks.length} blocks`
        : `Thin: ${text.words} words across ${text.blocks.length} blocks — too little to rank on its own`)
  ];
};

// ── The assessment ─────────────────────────────────────────────────────────

export const assessPackageDifferentiation = (
  page: AssessablePage,
  others: AssessablePage[] = []
): Assessment => {
  const text = readPage(page);
  const signals = detectSignals(text, page);

  const ownShingles = shingles(maskDistinguishing(text.all));
  const similar = others
    .filter((other) => other?.slug && other.slug !== page.slug)
    .map((other) => ({
      slug: String(other.slug),
      name: String(other.name ?? other.slug),
      overlap: jaccard(ownShingles, shingles(maskDistinguishing(readPage(other).all)))
    }))
    .filter((entry) => entry.overlap >= REPORT_THRESHOLD)
    .sort((a, b) => b.overlap - a.overlap);

  const clones = similar.filter((entry) => entry.overlap >= CLONE_THRESHOLD);

  const coreHits = signals.filter((signal) => signal.core && signal.present).length;
  const totalHits = signals.filter((signal) => signal.present).length;

  // A near-duplicate is disqualifying however many boxes the page ticks.
  let verdict: Verdict;
  if (clones.length) verdict = 'weak';
  else if (coreHits >= 4 && totalHits >= 7) verdict = 'strong';
  else if (coreHits >= 2 && totalHits >= 4) verdict = 'moderate';
  else verdict = 'weak';

  const gaps = signals.filter((signal) => !signal.present).map((signal) => signal.detail);
  for (const clone of clones) {
    gaps.push(
      `Reads ${Math.round(clone.overlap * 100)}% identical to “${clone.name}” once place names are ignored — that is a doorway page`
    );
  }

  return {
    verdict,
    signals,
    strengths: signals.filter((signal) => signal.present).map((signal) => signal.detail),
    gaps,
    similar,
    requiresAcknowledgement: verdict === 'weak'
  };
};
