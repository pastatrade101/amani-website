/**
 * How much text each tour field may hold, sized to the public pages that show
 * it: the tour card, the tour hero and the itinerary timeline. The admin tour
 * editor takes its counters, `maxlength`s and list sizes from here.
 *
 * The API enforces the same numbers in apps/backend/src/schemas/tour-limits.ts.
 * Change both together; tour-limits.test.ts fails when they differ.
 *
 * Plain TS with no imports, so the editor, the public pages and node:test can
 * all load it.
 */
export const TOUR_LIMITS = {
	/**
	 * Measured in Poppins at the card's real widths: 60 characters stay within
	 * three lines on every tour card and within the hero's four lines on a
	 * phone (three from sm). 70 ran to four lines on the three-column grid.
	 */
	title: 60,
	/** The opening paragraph of the tour page, and the search description when none is set. */
	shortDescription: 220,
	highlight: 100,
	highlights: 10,
	location: 60,
	experienceType: 40,
	/** Search results cut a title after about 60 characters and a description after about 160. */
	seoTitle: { target: 60, max: 70 },
	metaDescription: { target: 160, max: 200 },
	dayTitle: 70,
	/** The line under the day title on the itinerary timeline. */
	daySummary: 140,
	/** Characters of text, not markup: see richTextLength. */
	dayDescription: 3000,
	/** One chip each on the day card. */
	activity: 80,
	activities: 8,
	meals: 40,
	/** A property typed by name; the page adds "or similar". */
	stayName: 60,
	/** The day card shows three photos. */
	dayPhotos: 3,
	/** One included / excluded line. */
	listItem: 100,
	listItems: 20,
	altText: 125,
	caption: 150,
	customizationOption: 100
} as const;

/** Tags that end a block: the gap between two paragraphs reads as one space. */
const BLOCK_END = /<br\s*\/?>|<\/(?:p|h[1-6]|li|blockquote)>/gi;
// A letter right after `<` makes it a tag; "under < 5 years" stays text.
const TAG = /<\/?[a-z][^>]*>/gi;
const ENTITY = /&(?:#x?[0-9a-f]+|[a-z]+);/gi;

/**
 * Characters of text in a rich-text value, as a reader sees them: tags do not
 * count, an entity such as `&amp;` is one character, and each run of
 * whitespace (including the break between paragraphs) is one. Plain text is
 * counted the same way, so a value measures the same before and after the
 * editor turns it into paragraphs.
 */
export const richTextLength = (value: unknown): number =>
	String(value ?? '')
		.replace(BLOCK_END, ' ')
		.replace(TAG, '')
		.replace(ENTITY, '_')
		.replace(/\s+/g, ' ')
		.trim().length;

export type LimitTone = 'ok' | 'soft' | 'over';

/**
 * How a counter should look: 'over' past the hard cap, 'soft' past a softer
 * target that is still allowed (a search snippet cut short), else 'ok'.
 */
export const limitTone = (length: number, max: number, target: number = max): LimitTone =>
	length > max ? 'over' : length > target ? 'soft' : 'ok';
