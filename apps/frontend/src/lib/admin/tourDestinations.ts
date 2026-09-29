import type { Tour } from '$lib/admin/types';

export type TourDestinationSummary = {
  country?: string;
  id?: string;
  name: string;
  slug: string;
};

export const getTourDestinations = (tour: Tour | null | undefined): TourDestinationSummary[] => {
  if (!tour) return [];

  const seen = new Set<string>();
  const rawRows = tour.tour_destinations;
  const rows = (Array.isArray(rawRows) ? [...rawRows] : rawRows ? [rawRows] : []).sort(
    (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
  );

  const destinations: TourDestinationSummary[] = [];
  for (const row of rows) {
    const destination = row.destinations;
    const key = String(row.destination_id || destination?.id || destination?.slug || '').trim();
    if (!key || seen.has(key) || !destination?.name || !destination?.slug) continue;
    seen.add(key);
    destinations.push({
      id: destination.id || row.destination_id || undefined,
      name: destination.name,
      slug: destination.slug,
      country: destination.country
    });
  }

  if (!destinations.length && tour.destinations?.name && tour.destinations?.slug) {
    destinations.push({
      name: tour.destinations.name,
      slug: tour.destinations.slug,
      country: tour.destinations.country
    });
  }

  return destinations;
};

export const getPrimaryTourDestination = (tour: Tour | null | undefined): TourDestinationSummary | null =>
  getTourDestinations(tour)[0] ?? null;

export const getTourDestinationLabel = (tour: Tour | null | undefined, visible = 2): string => {
  const destinations = getTourDestinations(tour);
  if (!destinations.length) return '';
  const names = destinations.slice(0, visible).map((destination) => destination.name);
  const extra = destinations.length - names.length;
  return extra > 0 ? `${names.join(', ')} + ${extra} more` : names.join(', ');
};

export const getTourDestinationNames = (tour: Tour | null | undefined): string =>
  getTourDestinations(tour).map((destination) => destination.name).join(' ');

export const matchesTourDestinationSlug = (tour: Tour | null | undefined, slug: string): boolean =>
  Boolean(slug && getTourDestinations(tour).some((destination) => destination.slug === slug));
