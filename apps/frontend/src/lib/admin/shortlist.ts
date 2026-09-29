import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Client-side "save trips" shortlist (spec §7). Persists across sessions so a
// returning visitor keeps their saved trips and the enquiry form can pre-fill.
export type ShortlistItem = {
  slug: string;
  title: string;
  image_url?: string;
  destination?: string;
  duration_days?: number;
  price_from?: number;
  currency?: string;
};

const KEY = 'goldfinch_shortlist';

const load = (): ShortlistItem[] => {
  if (!browser) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as ShortlistItem[]) : [];
  } catch {
    return [];
  }
};

export const shortlist = writable<ShortlistItem[]>(load());

if (browser) {
  shortlist.subscribe((items) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      // storage may be unavailable (private mode) — fail silently
    }
  });
}

export const toggleShortlist = (item: ShortlistItem) =>
  shortlist.update((items) =>
    items.some((i) => i.slug === item.slug)
      ? items.filter((i) => i.slug !== item.slug)
      : [...items, item]
  );

export const removeShortlist = (slug: string) =>
  shortlist.update((items) => items.filter((i) => i.slug !== slug));

export const clearShortlist = () => shortlist.set([]);
