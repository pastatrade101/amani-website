/** Where every "plan my trip" call to action leads. */
export const PLANNER_PATH = '/plan-my-trip';

export type PlanHrefOptions = {
	tour?: string | null;
	stay?: string | null;
	destination?: string | null;
	category?: string | null;
	activity?: string | null;
	/** Where the link sits, e.g. 'header' or 'tour_page'. Becomes cta_location. */
	from: string;
};

const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/i;
const FROM = /^[a-z0-9_]{1,40}$/;

/**
 * The planner, opened from a page about something specific. Only catalogue
 * slugs and the link's place on the site go into the address, never anything
 * a visitor typed, so the URL (and analytics that read it) carries no personal data.
 */
export function planHref(options: PlanHrefOptions): string {
	const query = new URLSearchParams();
	for (const key of ['tour', 'stay', 'destination', 'category', 'activity'] as const) {
		const value = String(options[key] ?? '').trim();
		if (SLUG.test(value)) query.set(key, value);
	}
	if (FROM.test(options.from)) query.set('from', options.from);
	const qs = query.toString();
	return qs ? `${PLANNER_PATH}?${qs}` : PLANNER_PATH;
}
