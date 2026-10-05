import { apiGet } from './api';
import type { DestinationDetail } from '$lib/destination-content';
import type { Paginated } from '$lib/types/api';
/** Load every published page; never substitute example destinations. */
export async function destinationCatalogue(fetcher: typeof fetch) {
  const first = await apiGet<Paginated<DestinationDetail>>('destinations?status=published&limit=100',fetcher);
  const items=[...first.items];
  for(let page=2;page<=first.pagination.totalPages;page++) {
    const next=await apiGet<Paginated<DestinationDetail>>(`destinations?status=published&limit=100&page=${page}`,fetcher);
    items.push(...next.items);
  }
  return items.filter(d=>!d.status||d.status==='published');
}
