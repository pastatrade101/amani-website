import { error } from '@sveltejs/kit';
import { apiGet, ApiError } from '$lib/server/api';
import { loadSiteChrome } from '$lib/server/site-chrome';
import { enquire } from '$lib/server/enquiry';
import type { DestinationDetail } from '$lib/destination-content';
import type { Activity, Paginated, Stay, Tour } from '$lib/types/api';
import type { Actions, PageServerLoad } from './$types';
export const load:PageServerLoad=async({fetch,params,url,setHeaders})=>{
  setHeaders({'cache-control':'no-store'});
  const [destination,chrome]=await Promise.all([
    apiGet<DestinationDetail>(`destinations/${encodeURIComponent(params.slug)}`,fetch).catch((e:unknown)=>e instanceof ApiError?e:new ApiError(503)),
    loadSiteChrome(fetch)
  ]);
  if(destination instanceof ApiError) error(destination.status===404?404:503,destination.status===404?'This destination is no longer available.':'We couldn’t load this destination. Please try again shortly.');
  if(destination.status && destination.status!=='published') error(404,'This destination is no longer available.');
  const id=encodeURIComponent(destination.id);
  const [tours,stays,activities,faqs]=await Promise.allSettled([
    apiGet<Paginated<Tour>>(`tours?status=published&destination_id=${id}&limit=6`,fetch),
    apiGet<Paginated<Stay>>(`lodges?status=published&destination_id=${id}&limit=6`,fetch),
    apiGet<Paginated<Activity>>(`activities?status=published&destination_id=${id}&limit=24`,fetch),
    apiGet<Paginated<{id:string;question:string;answer:string}>>(`faqs?status=published&destination_id=${id}&limit=100`,fetch)
  ]);
  return {destination,chrome,siteOrigin:url.origin,
    tours:tours.status==='fulfilled'?tours.value.items:[],tourTotal:tours.status==='fulfilled'?tours.value.pagination.total:0,
    stays:stays.status==='fulfilled'?stays.value.items:[],stayTotal:stays.status==='fulfilled'?stays.value.pagination.total:0,
    activities:activities.status==='fulfilled'?activities.value.items:[],faqs:faqs.status==='fulfilled'?faqs.value.items:[],
    relatedUnavailable:[tours,stays,activities,faqs].some(r=>r.status==='rejected')};
};
export const actions:Actions={enquire};
