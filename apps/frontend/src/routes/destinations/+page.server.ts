import { destinationCatalogue } from '$lib/server/destinations';
import { loadSiteChrome } from '$lib/server/site-chrome';
import { filterDestinations } from '$lib/destination-content';
import { enquire } from '$lib/server/enquiry';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = async ({fetch,url,setHeaders}) => {
  setHeaders({'cache-control':'no-store'});
  const [chrome,catalogue]=await Promise.all([loadSiteChrome(fetch),destinationCatalogue(fetch).catch(()=>null)]);
  const all=catalogue??[];
  const filtered=filterDestinations(all,url.searchParams);
  const page=Math.min(10000,Math.max(1,Math.floor(Number(url.searchParams.get('page')))||1));
  return {chrome,siteOrigin:url.origin,unavailable:catalogue===null,filters:{search:filtered.search,country:filtered.country,circuit:filtered.circuit},
    countries:[...new Set(all.map(d=>d.country).filter((v):v is string=>!!v))].sort(),
    total:filtered.items.length, catalogueTotal:all.length,page,pageCount:Math.max(1,Math.ceil(filtered.items.length/12)),
    items:filtered.items.slice((page-1)*12,page*12), featured:all.find(d=>d.is_featured && (d.banner_image_url||d.main_image_url||d.image_url))??all.find(d=>d.banner_image_url||d.main_image_url||d.image_url)??null};
};
export const actions:Actions={enquire};
