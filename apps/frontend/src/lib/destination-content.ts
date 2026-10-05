import { safeUrl, textContent, circuitFor } from './home-content';
import type { Destination } from './types/api';

export type DestinationDetail = Destination & {
  status?: string; is_featured?: boolean; location?: string | null;
  latitude?: number | null; longitude?: number | null;
  meta_title?: string | null; meta_description?: string | null; og_image_url?: string | null;
  guide?: unknown[] | null; guide_reviewed_at?: string | null;
  safety_overview?: string | null; health_vaccinations?: string | null; security_advice?: string | null;
  travel_insurance_note?: string | null; emergency_contacts?: string | null;
  score_wildlife?: number | null; score_luxury?: number | null; score_family?: number | null;
  score_photography?: number | null; score_adventure?: number | null;
};
export type GuideBlock = { type: string; title: string; body: string; url: string; caption: string; items: {title:string;body:string}[]; columns:string[]; rows:string[][] };
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const str = (value: unknown): string => typeof value === 'string' ? value : '';
export function destinationGuide(value: unknown): GuideBlock[] {
  if (!Array.isArray(value)) return [];
  return value.filter(v => v && typeof v === 'object').map(value => {
    const b = record(value);
    return {
      type: str(b.type) || (Array.isArray(b.items) ? 'facts' : 'richtext'),
      title: textContent(str(b.title) || str(b.heading)), body: str(b.body) || str(b.content),
      url: safeUrl(str(b.url) || str(b.image_url), ''), caption: textContent(str(b.caption)),
      items: Array.isArray(b.items) ? b.items.map(value => { const i=record(value); return {title:textContent(str(i.title)||str(i.label)||str(i.q)||str(i.question)),body:str(i.body)||str(i.value)||str(i.a)||str(i.answer)||str(value)}; }) : [],
      columns: Array.isArray(b.columns) ? b.columns.map(v=>textContent(str(v))) : [],
      rows: Array.isArray(b.rows) ? b.rows.filter(Array.isArray).map(row=>row.map(v=>textContent(String(v ?? '')))) : []
    };
  });
}
export const destinationHref = (destination: Pick<Destination,'slug'>) => `/destinations/${encodeURIComponent(destination.slug)}`;
export const destinationImage = (d: Destination, hero=false) => safeUrl(hero ? d.banner_image_url || d.main_image_url || d.image_url : d.main_image_url || d.image_url || d.banner_image_url, '');
export function filterDestinations(items: Destination[], params: URLSearchParams) {
  const search=(params.get('search')||'').trim().slice(0,120);
  const country=(params.get('country')||'').slice(0,100);
  const circuit=['northern','southern','western','coast','other'].includes(params.get('circuit')||'') ? params.get('circuit')! : '';
  return { search,country,circuit,items:items.filter(d=>(!country||d.country===country)&&(!circuit||circuitFor(d)===circuit)&&(!search||`${d.name} ${d.country||''} ${d.region||''} ${textContent(d.short_description)}`.toLowerCase().includes(search.toLowerCase()))) };
}

/** Local destination imagery used only when a matching place's CMS media is unavailable. */
export function destinationFallbackPhoto(d: Destination): string {
  const name=`${d.name} ${d.slug}`.toLowerCase();
  if(/serengeti|ndutu/.test(name)) return '/images/serengeti.jpg';
  if(/ngorongoro/.test(name)) return '/images/ngorongoro.jpg';
  if(/tarangire/.test(name)) return '/images/tarangire.jpg';
  if(/zanzibar|stone-town|paje|jambiani|nungwi|kendwa/.test(name)) return '/images/zanzibar-menu.jpg';
  return '';
}
