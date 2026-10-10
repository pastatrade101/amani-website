import { supabase } from '../config/supabase';
import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import { cleanSearch, getPagination, getQueryString, paginationMeta } from '../utils/query';
import { safeAudit } from '../services/audit.service';

const fail = (error: {code?:string; message?:string} | null, message:string) => {
  if (!error) return;
  if (error.code === '23505') throw new AppError('This option already exists in the library.',409);
  if (error.code === '23503') throw new AppError('This option is selected by a tour. Deactivate it to hide it from new selections, or remove it from the tours first.',409);
  throw new AppError(message, error.code === '23514' ? 422 : 500, [error]);
};
export const listTourListOptions = asyncHandler(async(req,res)=>{
  const {page,limit,from,to}=getPagination(req.query);
  const kind=getQueryString(req.query,'kind');
  const active=getQueryString(req.query,'is_active');
  const search=cleanSearch(getQueryString(req.query,'search'));
  let query=supabase.from('tour_list_options').select('*',{count:'exact'}).order('sort_order').order('title');
  if (kind && ['inclusion','exclusion'].includes(kind)) query=query.eq('kind',kind);
  if (active==='true'||active==='false') query=query.eq('is_active',active==='true');
  if(search)query=query.ilike('title',`%${search}%`);
  const {data,error,count}=await query.range(from,to);
  fail(error,'Unable to load the inclusion/exclusion library.');
  return sendSuccess(res,'Package options loaded.',{items:data??[],pagination:paginationMeta(page,limit,count??0)});
});
export const createTourListOption=asyncHandler(async(req,res)=>{
  const {data,error}=await supabase.from('tour_list_options').insert(req.body).select('*').single();
  fail(error,'Unable to add this package option.');
  await safeAudit({action:'create',entityType:'tour_list_options',entityId:data.id,newData:data,req});
  return sendSuccess(res,'Package option added.',data,201);
});
export const updateTourListOption=asyncHandler(async(req,res)=>{
  const {data:previous,error:readError}=await supabase.from('tour_list_options').select('*').eq('id',req.params.id).maybeSingle();
  fail(readError,'Unable to read this package option.');
  if(!previous)throw new AppError('Package option not found.',404);
  const {data,error}=await supabase.from('tour_list_options').update({...req.body,updated_at:new Date().toISOString()}).eq('id',req.params.id).select('*').single();
  fail(error,'Unable to update this package option.');
  await safeAudit({action:'update',entityType:'tour_list_options',entityId:data.id,oldData:previous,newData:data,req});
  return sendSuccess(res,'Option updated on every linked tour.',data);
});
export const deleteTourListOption=asyncHandler(async(req,res)=>{
  const {data,error}=await supabase.from('tour_list_options').delete().eq('id',req.params.id).select('id').maybeSingle();
  fail(error,'Unable to remove this package option.');
  if(!data)throw new AppError('Package option not found.',404);
  await safeAudit({action:'delete',entityType:'tour_list_options',entityId:data.id,req});
  return sendSuccess(res,'Package option removed.');
});
export const bulkCreateTourListOptions=asyncHandler(async(req,res)=>{
  // A transaction prevents a pasted list being only partly inserted.
  const {data,error}=await supabase.rpc('add_tour_list_options',{p_kind:req.body.kind,p_titles:req.body.titles});
  fail(error,'Unable to add the package options.');
  await safeAudit({action:'create',entityType:'tour_list_options',newData:{kind:req.body.kind,count:data?.length??0},req});
  return sendSuccess(res,'Package options added. Existing options were reused.',data??[],201);
});
