import { optionalActivitySnapshots, type OptionalActivitySnapshot } from '../utils/optional-activities';
export { activitySummary } from '../utils/optional-activities';
import { supabase } from '../config/supabase';
import { AppError } from '../utils/api-response';

const select = 'sort_order,is_optional,additional_cost,pricing_option_id,activity:activities!inner(id,name,slug,description,category,duration_label,hero_image_url,image_url,status,deleted_at),pricing_option:tour_price_options(id,title,price,currency,price_type),tour:tours!inner(id,status,deleted_at)';
export async function optionalActivityLinks(tourId?: string | null, ids?: string[]) {
 let query = supabase.from('tour_activities').select(select).eq('is_optional', true)
  .eq('activity.status','published').is('activity.deleted_at',null)
  .eq('tour.status','published').is('tour.deleted_at',null).order('sort_order').limit(1000);
 if (tourId) query = query.eq('tour_id',tourId);
 if (ids?.length) query = query.in('activity_id',ids);
 const { data,error } = await query;
 if (error) throw new AppError('Unable to load optional activities.',500,[error]);
 return (data ?? []) as unknown as Array<Record<string, any>>;
}
// All names and charges come from the database, never from visitor-supplied labels/prices.
export async function resolveOptionalActivities(tourId: string | null, ids: string[]): Promise<OptionalActivitySnapshot[]> {
 if (!ids.length) return [];
 const links = await optionalActivityLinks(tourId,ids);
 return optionalActivitySnapshots(tourId,ids,links);
}
