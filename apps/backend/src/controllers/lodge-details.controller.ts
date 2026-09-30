import { supabase } from '../config/supabase';
import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import { safeAudit } from '../services/audit.service';
import { toursUsingLodges } from '../services/lodge-stays.service';
import { isPublicStay } from '../utils/lodge-stays';
import type { TourUsingLodge } from '../utils/tour-content';

type Row = Record<string, any>;

const tables = {
  highlights: 'lodge_highlights', rooms: 'lodge_rooms', rates: 'lodge_seasonal_rates',
  inclusions: 'lodge_inclusions', destinations: 'lodge_destinations', tours: 'lodge_tours',
  alternatives: 'lodge_alternatives', experiences: 'lodge_experiences'
} as const;

const lodgeExists = async (id: string) => {
  const { data } = await supabase.from('lodges').select('id').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!data) throw new AppError('Property not found.', 404);
};

export const publicDetailsForLodge = async (id: string) => {
  const [highlights,rooms,rates,inclusions,experiences,destinations,alternatives] = await Promise.all([
    supabase.from('lodge_highlights').select('id,title,sort_order').eq('lodge_id',id).order('sort_order'),
    supabase.from('lodge_rooms').select('*, lodge_room_images(*)').eq('lodge_id',id).order('sort_order'),
    supabase.from('lodge_seasonal_rates').select('season_name,valid_from,valid_until,currency,rack_rate,single_rate,double_rate,triple_rate,child_rate,single_supplement,pricing_basis,meal_plan,room_id').eq('lodge_id',id).order('valid_from'),
    supabase.from('lodge_inclusions').select('title,is_included,sort_order').eq('lodge_id',id).order('sort_order'),
    supabase.from('lodge_experiences').select('accommodation_experiences(id,name,slug)').eq('lodge_id',id),
    supabase.from('lodge_destinations').select('destinations(id,name,slug,country,status)').eq('lodge_id',id),
    supabase.from('lodge_alternatives').select('lodges!lodge_alternatives_alternative_lodge_id_fkey(id,name,slug,image_url,hero_image_url,accommodation_level,lodge_type,status,show_property_publicly,deleted_at)').eq('lodge_id',id)
  ]);
  const rows=(q:any)=>q.error?[]:q.data??[];
  // Public page data: a draft destination or a hidden/draft property is never
  // linked from it. The visibility columns are read only to decide that.
  const publicDestination=(x:Row)=>{ if(!x||x.status!=='published') return null; const {status:_s,...destination}=x; return destination; };
  const publicAlternative=(x:Row)=>{ if(!isPublicStay(x)) return null; const {status:_s,show_property_publicly:_v,deleted_at:_d,...lodge}=x; return lodge; };
  return {highlights:rows(highlights),rooms:rows(rooms),rates:rows(rates),inclusions:rows(inclusions),
    experiences:rows(experiences).map((x:Row)=>x.accommodation_experiences).filter(Boolean),
    related_destinations:rows(destinations).map((x:Row)=>publicDestination(x.destinations)).filter(Boolean),
    alternatives:rows(alternatives).map((x:Row)=>publicAlternative(x.lodges)).filter(Boolean)};
};

/**
 * Tours whose itinerary sleeps at this lodge, per style and day, for the CMS —
 * drafts included. Fail-soft: before the stays migration only the legacy
 * links are read.
 */
const toursUsingLodge = async (id: string): Promise<TourUsingLodge[]> =>
  (await toursUsingLodges([id], { publishedOnly: false })).get(id) ?? [];

export const getLodgeDetails = asyncHandler(async (req, res) => {
  await lodgeExists(req.params.id);
  const id = req.params.id;
  // Started alongside the other reads; never allowed to fail the editor.
  const toursUsing = toursUsingLodge(id).catch((): TourUsingLodge[] => []);
  const queries = await Promise.all([
    supabase.from('lodge_highlights').select('*').eq('lodge_id', id).order('sort_order'),
    supabase.from('lodge_rooms').select('*, lodge_room_images(*)').eq('lodge_id', id).order('sort_order'),
    supabase.from('lodge_seasonal_rates').select('*').eq('lodge_id', id).order('valid_from'),
    supabase.from('lodge_inclusions').select('*').eq('lodge_id', id).order('sort_order'),
    supabase.from('lodge_suppliers').select('*').eq('lodge_id', id).maybeSingle(),
    supabase.from('lodge_destinations').select('destination_id,is_primary').eq('lodge_id', id),
    supabase.from('lodge_tours').select('tour_id').eq('lodge_id', id),
    supabase.from('lodge_alternatives').select('alternative_lodge_id').eq('lodge_id', id),
    supabase.from('lodge_experiences').select('experience_id').eq('lodge_id', id),
    supabase.from('accommodation_experiences').select('*').eq('is_active', true).order('sort_order')
  ]);
  const value = (at: number) => queries[at].error ? [] : queries[at].data ?? [];
  return sendSuccess(res, 'Accommodation details fetched.', {
    highlights:value(0), rooms:value(1), rates:value(2), inclusions:value(3), supplier:queries[4].data ?? null,
    destination_ids:value(5).map((x:Row)=>x.destination_id), tour_ids:value(6).map((x:Row)=>x.tour_id),
    alternative_ids:value(7).map((x:Row)=>x.alternative_lodge_id), experience_ids:value(8).map((x:Row)=>x.experience_id),
    experiences:value(9),
    tours_using: await toursUsing
  });
});

export const listAccommodationMeta = asyncHandler(async (_req,res)=>{
  const [experiences,suppliers]=await Promise.all([supabase.from('accommodation_experiences').select('*').eq('is_active',true).order('sort_order'),supabase.from('accommodation_suppliers').select('id,name').eq('is_active',true).order('name')]);
  return sendSuccess(res,'Accommodation metadata fetched.',{experiences:experiences.data??[],suppliers:suppliers.data??[]});
});

const replace = async (table: string, lodgeId: string, rows: Row[]) => {
  const deleted = await supabase.from(table).delete().eq('lodge_id', lodgeId);
  if (deleted.error) throw new AppError(`Unable to update ${table}. Apply the accommodation management migration.`, 503, [deleted.error]);
  if (rows.length) {
    const inserted = await supabase.from(table).insert(rows.map((row) => ({ ...row, lodge_id: lodgeId })));
    if (inserted.error) throw new AppError(`Unable to save ${table}.`, 500, [inserted.error]);
  }
};

export const replaceLodgeDetails = asyncHandler(async (req, res) => {
  const id = req.params.id;
  await lodgeExists(id);
  const body = req.body as Row;
  await replace(tables.highlights,id,(body.highlights??[]).map((x:Row,i:number)=>({title:x.title,sort_order:i})));
  await replace(tables.rates,id,(body.rates??[]).map(({id:_id,lodge_id:_l,...x}:Row)=>x));
  await replace(tables.inclusions,id,(body.inclusions??[]).map((x:Row,i:number)=>({title:x.title,is_included:x.is_included!==false,sort_order:i})));
  await replace(tables.destinations,id,(body.destination_ids??[]).map((destination_id:string,i:number)=>({destination_id,is_primary:i===0})));
  await replace(tables.tours,id,(body.tour_ids??[]).map((tour_id:string)=>({tour_id})));
  await replace(tables.alternatives,id,(body.alternative_ids??[]).filter((x:string)=>x!==id).map((alternative_lodge_id:string)=>({alternative_lodge_id})));
  await replace(tables.experiences,id,(body.experience_ids??[]).map((experience_id:string)=>({experience_id})));

  // Rooms need their generated ids before room images can be attached.
  await supabase.from('lodge_rooms').delete().eq('lodge_id',id);
  for (const [index, room] of (body.rooms??[] as Row[]).entries()) {
    const { images = [], id:_id, lodge_id:_l, lodge_room_images:_old, ...roomRow } = room;
    const created = await supabase.from('lodge_rooms').insert({...roomRow,lodge_id:id,sort_order:index}).select('id').single();
    if (created.error) throw new AppError('Unable to save room types.',500,[created.error]);
    if (images.length) {
      const saved = await supabase.from('lodge_room_images').insert(images.map((image:Row,at:number)=>({room_id:created.data.id,image_url:image.image_url,alt_text:image.alt_text||null,caption:image.caption||null,sort_order:at})));
      if(saved.error) throw new AppError('Unable to save room images.',500,[saved.error]);
    }
  }

  if (body.supplier) {
    const { lodge_id:_l, new_supplier_name, ...supplier } = body.supplier;
    if (!supplier.supplier_id && new_supplier_name) {
      const created=await supabase.from('accommodation_suppliers').upsert({name:String(new_supplier_name).trim()},{onConflict:'name'}).select('id').single();
      if(created.error) throw new AppError('Unable to create supplier.',500,[created.error]);
      supplier.supplier_id=created.data.id;
    }
    const saved = await supabase.from('lodge_suppliers').upsert({ ...supplier, lodge_id:id });
    if(saved.error) throw new AppError('Unable to save supplier details.',500,[saved.error]);
  } else await supabase.from('lodge_suppliers').delete().eq('lodge_id',id);

  await safeAudit({action:'update',entityId:id,entityType:'lodge_details',newData:{sections:Object.keys(body)},req});
  return sendSuccess(res,'Accommodation details saved.',{id});
});
