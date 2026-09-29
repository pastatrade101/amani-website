import { browser } from '$app/environment';
import { api } from '$lib/admin/api/client';
import type { ItineraryDay } from '$lib/admin/types';

/**
 * Photographs of the property a day stays at.
 *
 * The tour page worked this out for itself, the day renderer had its own copy,
 * and the safari-package routes panel had a third, thinner one that showed a
 * single thumbnail. Three answers to "which pictures belong to this stay" is
 * two too many, so it lives here and every caller gets the same gallery.
 */

export type Stay = NonNullable<ItineraryDay['lodge']>;
export type MediaImage = { src: string; caption: string; record?: Record<string, unknown>; fields?: string[] };

/** Identity of a stay across payloads: the id when joined, the slug otherwise. */
export const stayKey = (stay: Stay | null | undefined): string => String(stay?.id || stay?.slug || '').trim();

export const imageFromStay = (stay: Stay): MediaImage | null => {
  const src = stay.hero_image_url || stay.image_url || '';
  return src
    ? {
        src,
        caption: stay.name,
        record: stay as unknown as Record<string, unknown>,
        fields: ['hero_image_url', 'image_url', 'cover_image_url']
      }
    : null;
};

export const imageFromLodgeMedia = (row: Record<string, unknown>, stay: Stay): MediaImage | null => {
  const src = String(row.image_url || row.file_url || row.url || '').trim();
  if (!src) return null;
  return {
    src,
    caption: String(row.caption || row.alt_text || stay.name),
    record: row,
    fields: ['image_url', 'file_url', 'url']
  };
};

/**
 * The stay's own picture first, then whatever the record carries, then anything
 * fetched separately. Duplicates are dropped by source URL, so a cover image
 * that appears in both lists is shown once.
 */
export const galleryForStay = (stay: Stay, extra: MediaImage[] = []): MediaImage[] => {
  const gallery: MediaImage[] = [];
  const add = (image: MediaImage | null | undefined) => {
    if (!image?.src || gallery.some((item) => item.src === image.src)) return;
    gallery.push(image);
  };
  add(imageFromStay(stay));
  for (const row of stay.lodge_images ?? []) add(imageFromLodgeMedia(row as unknown as Record<string, unknown>, stay));
  for (const image of extra) add(image);
  return gallery;
};

/**
 * Fetches the gallery of every stay not already in `existing` and returns the
 * merged record, keyed by `stayKey`.
 *
 * By lodge id, not slug: itinerary data can carry a stale slug while the public
 * gallery endpoint is id-based. A property that answers with nothing is still
 * recorded, so an empty gallery is not re-requested on every tab switch. Never
 * runs on the server — this is below-the-fold decoration, not page content.
 *
 * Pass a `requested` set to survive overlapping calls: `existing` only grows
 * once a request has come back, so two runs in the same tick would otherwise
 * both fetch the same galleries. Keys are marked in it before the first await.
 */
export const loadLodgeMedia = async (
  stays: Array<Stay | null | undefined>,
  existing: Record<string, MediaImage[]> = {},
  requested?: Set<string>,
  limit = 6
): Promise<Record<string, MediaImage[]>> => {
  if (!browser) return existing;

  const pending = new Map<string, Stay>();
  for (const stay of stays) {
    const key = stayKey(stay);
    if (!key || !stay?.id || key in existing || pending.has(key) || requested?.has(key)) continue;
    pending.set(key, stay);
  }
  if (!pending.size) return existing;
  for (const key of pending.keys()) requested?.add(key);

  const results = await Promise.allSettled(
    [...pending].map(async ([key, stay]) => {
      const response = await api.lodges.gallery(stay.id);
      const images = (response.data.images ?? [])
        .map((row) => imageFromLodgeMedia(row as unknown as Record<string, unknown>, stay))
        .filter(Boolean) as MediaImage[];
      return [key, images.slice(0, limit)] as const;
    })
  );

  const next: Record<string, MediaImage[]> = { ...existing };
  for (const result of results) {
    if (result.status === 'fulfilled') next[result.value[0]] = result.value[1];
  }
  return next;
};
