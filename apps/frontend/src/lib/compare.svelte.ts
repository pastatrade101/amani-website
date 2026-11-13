/**
 * The safaris a visitor is weighing up, up to four, kept in this browser for
 * a week. There is no account to attach a shortlist to, and asking someone to
 * sign up before comparing two trips would be the wrong trade.
 *
 * The /compare page reads its safaris from the URL instead, so a shortlist can
 * be sent to whoever is coming on the trip; this store only decides what the
 * tray shows and what that link holds. Storage can be blocked (private windows,
 * previews), so every read and write is guarded and the page works without it.
 */
const KEY = 'k2a.compare.v1';
const TTL = 7 * 24 * 60 * 60 * 1000;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

/** Four columns is what a laptop shows before the type collapses. */
export const MAX_COMPARE = 4;

export type CompareEntry = { slug: string; title: string; image: string | null };

/** `?tours=a,b,c` → valid, distinct slugs, at most four. */
export function compareSlugs(value: string | null | undefined): string[] {
	const slugs = (value ?? '').split(',').map((slug) => slug.trim()).filter((slug) => slug && slug.length <= 160 && SLUG.test(slug));
	return [...new Set(slugs)].slice(0, MAX_COMPARE);
}

export function compareHref(slugs: string[]): string {
	return slugs.length ? `/compare?tours=${slugs.map(encodeURIComponent).join(',')}` : '/compare';
}

function clean(value: unknown): CompareEntry[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((entry): entry is CompareEntry => Boolean(entry) && typeof entry.slug === 'string' && SLUG.test(entry.slug) && typeof entry.title === 'string')
		.map((entry) => ({ slug: entry.slug, title: entry.title.slice(0, 200), image: typeof entry.image === 'string' ? entry.image : null }))
		.slice(0, MAX_COMPARE);
}

class CompareList {
	/** Empty until restore() runs in the browser, so server and client render the same. */
	items = $state<CompareEntry[]>([]);
	ready = $state(false);

	get count() {
		return this.items.length;
	}
	get full() {
		return this.items.length >= MAX_COMPARE;
	}
	get href() {
		return compareHref(this.items.map((entry) => entry.slug));
	}

	has(slug: string) {
		return this.items.some((entry) => entry.slug === slug);
	}

	toggle(entry: CompareEntry) {
		this.restore();
		if (this.has(entry.slug)) this.remove(entry.slug);
		else if (!this.full) this.#set([...this.items, entry]);
	}

	remove(slug: string) {
		this.#set(this.items.filter((entry) => entry.slug !== slug));
	}

	clear() {
		this.#set([]);
	}

	restore() {
		if (this.ready || typeof window === 'undefined') return;
		try {
			const stored = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as { at?: number; items?: unknown } | null;
			const fresh = Boolean(stored) && Date.now() - Number(stored?.at ?? 0) < TTL;
			this.items = fresh ? clean(stored?.items) : [];
			if (stored && !fresh) window.localStorage.removeItem(KEY);
		} catch {
			this.items = [];
		}
		this.ready = true;
	}

	#set(items: CompareEntry[]) {
		this.items = items;
		try {
			window.localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), items }));
		} catch {
			// The shortlist still works for this visit; it just won't survive a reload.
		}
	}
}

export const compare = new CompareList();
