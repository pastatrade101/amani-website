/**
 * Tours a visitor hearts on a card. They live in that visitor's browser only
 * (no account), so the list is small, validated on the way in, and never trusted
 * for anything but showing links back to the tours.
 */
export type SavedTour = { slug: string; title: string; image: string; duration: string };

export const SAVED_TOURS_KEY = 'key2africa:saved-tours';
export const SAVED_TOURS_MAX = 24;

const isSaved = (value: unknown): value is SavedTour => {
	const item = value as Partial<SavedTour> | null;
	return Boolean(item) && typeof item?.slug === 'string' && /^[a-z0-9-]{1,160}$/.test(item.slug) && typeof item.title === 'string' && item.title.length > 0 && item.title.length <= 200 && typeof item.image === 'string' && item.image.length <= 2000 && typeof item.duration === 'string' && item.duration.length <= 60;
};

/** Whatever was stored, as a clean list: bad entries and duplicates dropped, newest first kept. */
export function parseSavedTours(raw: string | null): SavedTour[] {
	try {
		const value: unknown = JSON.parse(raw ?? '[]');
		if (!Array.isArray(value)) return [];
		const seen = new Set<string>();
		return value.filter(isSaved).filter((item) => !seen.has(item.slug) && Boolean(seen.add(item.slug))).slice(0, SAVED_TOURS_MAX);
	} catch {
		return [];
	}
}

/** Adds the tour at the front, or removes it when it is already saved. */
export const toggleSavedTour = (items: SavedTour[], tour: SavedTour): SavedTour[] =>
	items.some((item) => item.slug === tour.slug) ? items.filter((item) => item.slug !== tour.slug) : [tour, ...items].slice(0, SAVED_TOURS_MAX);
