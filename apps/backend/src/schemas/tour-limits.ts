/**
 * How much text each tour field may hold, sized to the public pages that show
 * it (tour card, tour hero, itinerary timeline).
 *
 * Mirror of apps/frontend/src/lib/tour-limits.ts, which the admin editor uses
 * for its counters and `maxlength`s — same keys, same numbers. Change both
 * together; the frontend's tour-limits.test.ts fails when they differ.
 */
export const TOUR_LIMITS = {
  title: 60,
  shortDescription: 220,
  highlight: 100,
  highlights: 10,
  location: 60,
  experienceType: 40,
  seoTitle: { target: 60, max: 70 },
  metaDescription: { target: 160, max: 200 },
  dayTitle: 70,
  daySummary: 140,
  dayDescription: 3000,
  activity: 80,
  activities: 8,
  meals: 40,
  stayName: 60,
  dayPhotos: 3,
  listItem: 100,
  listItems: 20,
  altText: 125,
  caption: 150,
  customizationOption: 100
} as const;

const L = TOUR_LIMITS;

// Same counting as the editor's counter (frontend richTextLength), so a value
// the counter shows as fitting is one the API accepts.
const BLOCK_END = /<br\s*\/?>|<\/(?:p|h[1-6]|li|blockquote)>/gi;
const TAG = /<\/?[a-z][^>]*>/gi;
const ENTITY = /&(?:#x?[0-9a-f]+|[a-z]+);/gi;

/** Characters of text in a rich-text value: tags do not count, an entity is one, whitespace runs are one. */
export const richTextLength = (value: unknown): number =>
  String(value ?? '')
    .replace(BLOCK_END, ' ')
    .replace(TAG, '')
    .replace(ENTITY, '_')
    .replace(/\s+/g, ' ')
    .trim().length;

/** A day's activities are stored one per line; each line is one chip on the tour page. */
export const activityLines = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

/** What is wrong with a day's activities text, if anything; empty when it fits. */
export const activityProblems = (value: string): string[] => {
  const lines = activityLines(value);
  return [
    ...(lines.length > L.activities ? [LIMIT_MESSAGES.activities] : []),
    ...(lines.some((line) => line.length > L.activity) ? [LIMIT_MESSAGES.activity] : [])
  ];
};

/**
 * The editor shows these as they are (prefixed with the field), so each one
 * says what to do and why.
 */
export const LIMIT_MESSAGES = {
  title: `Keep the safari title to ${L.title} characters so it fits on a tour card.`,
  shortDescription: `Keep “At a glance” to ${L.shortDescription} characters — it is the short introduction at the top of the tour page.`,
  highlight: `Keep each highlight to ${L.highlight} characters.`,
  highlights: `List at most ${L.highlights} highlights.`,
  location: `Keep the start and end locations to ${L.location} characters.`,
  experienceType: `Keep the experience type to ${L.experienceType} characters.`,
  seoTitle: `Keep the search title to ${L.seoTitle.max} characters — search results cut it after about ${L.seoTitle.target}.`,
  metaDescription: `Keep the meta description to ${L.metaDescription.max} characters — search results cut it after about ${L.metaDescription.target}.`,
  customizationOption: `Keep each customisation option to ${L.customizationOption} characters.`,
  dayTitle: `Keep the day title to ${L.dayTitle} characters so it fits the itinerary timeline.`,
  daySummary: `Keep the day summary to ${L.daySummary} characters so it fits under the day title.`,
  dayDescription: `Keep the day description to ${L.dayDescription} characters of text.`,
  activity: `Keep each activity to ${L.activity} characters so it fits on one chip.`,
  activities: `List at most ${L.activities} activities a day.`,
  meals: `Keep the meals to ${L.meals} characters.`,
  stayName: `Keep the property name to ${L.stayName} characters so it fits the Overnight line.`,
  dayPhotos: `A day shows at most ${L.dayPhotos} photos.`,
  listItem: `Keep each included or excluded item to ${L.listItem} characters.`,
  listItems: `List at most ${L.listItems} included and ${L.listItems} excluded items.`,
  altText: `Keep photo alt text to ${L.altText} characters.`,
  caption: `Keep photo captions to ${L.caption} characters.`
} as const;
