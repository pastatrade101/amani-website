import { fail, type RequestEvent } from '@sveltejs/kit';
import { HERO_STYLES, validateHeroEnquiry, type HeroEnquiryResult, type HeroEnquiryValues } from '../hero-enquiry';

/** Uses the same bookings API and form guard as the detailed trip planner. */
export function createHeroEnquiry(send:(payload:Record<string,unknown>,event:RequestEvent)=>Promise<unknown>) {
 return async (event:RequestEvent) => {
  const data=await event.request.formData();
  const get=(key:string)=>String(data.get(key)??'').trim();
  const values:HeroEnquiryValues={full_name:get('full_name'),email:get('email'),details:get('details'),travel_date:get('travel_date'),adults:get('adults'),children:get('children'),accommodation_style:get('accommodation_style')};
  const errors=validateHeroEnquiry(values);
  const response=(success:boolean,message:string):HeroEnquiryResult=>({formKind:'hero',success,message,values:success?null:values,errors});
  if(get('website'))return fail(400,response(false,'Unable to send this enquiry.'));
  if(Object.keys(errors).length)return fail(400,response(false,'Please check the highlighted fields.'));
  // Only what the visitor actually gave is forwarded; nothing is assumed.
  const adults=values.adults?Number(values.adults):undefined;
  const children=values.children?Number(values.children):undefined;
  const style=HERO_STYLES.find(item=>item.id===values.accommodation_style);
  const trip=[style?`${style.label} safari`:'',values.travel_date?`starting ${values.travel_date}`:'',adults?`${adults} ${adults===1?'adult':'adults'}${children?` and ${children} ${children===1?'child':'children'}`:''}`:''].filter(Boolean).join(', ');
  const message=values.details||(trip?`Please help me plan a safari: ${trip}.`:'Please help me plan a safari. Travel dates and party size are not yet specified.');
  try {
   await send({full_name:values.full_name,email:values.email,message,...(values.travel_date?{travel_date:values.travel_date}:{}),...(adults?{number_of_adults:adults}:{}),...(children!==undefined&&adults?{number_of_children:children}:{}),source:'homepage_trip_planner',idempotency_key:get('idempotency_key')||undefined,hp_company:'',lead_context:{v:1,form_type:'homepage_trip_planner',form_variant:'hero',page:{url:event.url.href,title:'Plan your safari'},answers:{details:values.details,...(values.travel_date?{travel_date:values.travel_date}:{}),...(adults?{adults}:{}),...(children!==undefined?{children}:{}),...(style?{accommodation_style:style.id}:{}),party_size_unconfirmed:!adults}}},event);
   return response(true,'Thank you — your safari request has been received. Our team will reply by email.');
  } catch(reason) {
   const status=reason && typeof reason==='object' && 'status' in reason ? Number(reason.status):503;
   return fail([428,429].includes(status)?429:503,response(false,[428,429].includes(status)?'Please wait a few minutes before sending another enquiry.':'We couldn’t send your enquiry. Your details are still here; please try again.'));
  }
 };
}
