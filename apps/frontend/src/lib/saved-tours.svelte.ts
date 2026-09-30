import { parseSavedTours, SAVED_TOURS_KEY, toggleSavedTour, type SavedTour } from './saved-tours';

/**
 * One shared, reactive list for every card and the "Saved safaris" row.
 * Storage can be missing or blocked (private windows, previews), so every
 * read and write is guarded and the page works the same without it.
 */
class SavedTours {
	items = $state<SavedTour[]>([]);
	#loaded = false;

	load() {
		if (this.#loaded || typeof window === 'undefined') return;
		this.#loaded = true;
		try {
			this.items = parseSavedTours(window.localStorage.getItem(SAVED_TOURS_KEY));
		} catch {
			this.items = [];
		}
	}

	has(slug: string) {
		return this.items.some((item) => item.slug === slug);
	}

	toggle(tour: SavedTour) {
		this.load();
		this.items = toggleSavedTour(this.items, tour);
		try {
			window.localStorage.setItem(SAVED_TOURS_KEY, JSON.stringify(this.items));
		} catch {
			// Saving still works for this visit; it just won't survive a reload.
		}
	}
}

export const savedTours = new SavedTours();
