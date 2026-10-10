import { AppError } from './api-response';
export type OptionalActivitySnapshot = {
 activity_id: string; name: string; additional_cost: boolean; price: number | null;
 currency: string | null; price_type: string | null; pricing_option_id: string | null;
};
export function optionalActivitySnapshots(tourId: string | null, ids: string[], links: Array<Record<string,any>>): OptionalActivitySnapshot[] {
 if (ids.length > 50 || new Set(ids).size !== ids.length) throw new AppError('Select up to 50 distinct optional activities.',422);
 return ids.map(id => {
  const matches = links.filter(row => row.activity?.id === id && row.is_optional === true && row.activity.status === 'published' && !row.activity.deleted_at && row.tour?.status === 'published' && !row.tour.deleted_at && (!tourId || row.tour.id === tourId));
  if (!matches.length) throw new AppError('An optional activity is no longer available for this safari. Please refresh and select again.',422);
  const row = matches[0];
  // A general inquiry has no chosen tour/rate yet; never promise another tour's rate.
  const price = tourId && row.additional_cost ? row.pricing_option : null;
  return { activity_id:id,name:row.activity.name,additional_cost:tourId ? row.additional_cost : matches.some(row => row.additional_cost),
   price:price ? Number(price.price) : null,currency:price?.currency ?? null,price_type:price?.price_type ?? null,pricing_option_id:price?.id ?? null };
 });
}
export function activitySummary(row: OptionalActivitySnapshot): string {
 const cost = !row.additional_cost ? 'No additional cost' : row.price === null ? 'Price on request' : `${row.currency} ${row.price} ${String(row.price_type).replace(/_/g,' ')}`;
 return `${row.name} — ${cost}`;
}
