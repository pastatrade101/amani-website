import { fail, type RequestEvent } from '@sveltejs/kit';
import { validateHeroEnquiry, type HeroEnquiryResult, type HeroEnquiryValues } from '../hero-enquiry';

/** Uses the same bookings API and form guard as the detailed trip planner. */
export function createHeroEnquiry(send:(payload:Record<string,unknown>,event:RequestEvent)=>Promise<unknown>) {
 return async (event:RequestEvent) => {
  const data=await event.request.formData();
  const get=(key:string)=>String(data.get(key)??'').trim();
  const values:HeroEnquiryValues={full_name:get('full_name'),email:get('email'),details:get('details')};
  const errors=validateHeroEnquiry(values);
  const response=(success:boolean,message:string):HeroEnquiryResult=>({formKind:'hero',success,message,values:success?null:values,errors});
  if(get('website'))return fail(400,response(false,'Unable to send this enquiry.'));
  if(Object.keys(errors).length)return fail(400,response(false,'Please check the highlighted fields.'));
  try {
   await send({full_name:values.full_name,email:values.email,message:values.details||'Please help me plan a safari. Travel dates and party size are not yet specified.',source:'homepage_trip_planner',idempotency_key:get('idempotency_key')||undefined,hp_company:'',lead_context:{v:1,form_type:'homepage_trip_planner',form_variant:'hero',page:{url:event.url.href,title:'Plan your safari'},answers:{details:values.details,party_size_unconfirmed:true}}},event);
   return response(true,'Thank you — your safari request has been received. Our team will reply by email.');
  } catch(reason) {
   const status=reason && typeof reason==='object' && 'status' in reason ? Number(reason.status):503;
   return fail([428,429].includes(status)?429:503,response(false,[428,429].includes(status)?'Please wait a few minutes before sending another enquiry.':'We couldn’t send your enquiry. Your details are still here; please try again.'));
  }
 };
}
