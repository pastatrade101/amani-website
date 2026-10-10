import { supabase } from '../config/supabase';
import { AppError } from '../utils/api-response';
export const syncTourStartingPrice = async (tourId: string) => {
  if (!tourId) return;
  const { data: links, error: linkError } = await supabase.from('tour_activities').select('pricing_option_id').eq('tour_id',tourId).eq('is_optional',true).not('pricing_option_id','is',null);
  if (linkError) throw new AppError('Unable to validate optional activity rates.',500,[linkError]);
  const addOns = (links ?? []).map(row => row.pricing_option_id);
  let query = supabase
    .from('tour_price_options')
    .select('price')
    .eq('tour_id', tourId)
    .eq('price_type', 'per_person')
    .eq('is_addon', false)
    .order('price', { ascending: true });
  if (addOns.length) query = query.not('id','in',`(${addOns.join(',')})`);
  const { data, error } = await query
    .limit(1)
    .maybeSingle();

  if (error) throw new AppError('Pricing option saved, but the tour starting price could not be synchronized.', 500, [error]);
  if (!data && addOns.length) return;
  const nextPrice = data?.price ?? 0;

  const { error: updateError } = await supabase
    .from('tours')
    .update({ price_from: nextPrice })
    .eq('id', tourId);
  if (updateError) throw new AppError('Pricing option saved, but the tour starting price could not be synchronized.', 500, [updateError]);
};

