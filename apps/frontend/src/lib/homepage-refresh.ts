import type { HomepageSection, Category, Activity, Destination } from './types/api';
import { PHOTO } from './media-photos';

export const TRIPADVISOR_URL = 'https://www.tripadvisor.com/Attraction_Review-g297913-d26997963-Reviews-Key2Africa_Safaris-Arusha_Arusha_Region.html';
export const WHATSAPP_URL = 'https://wa.me/255743900014';

export type OfferFact = { label: string; value: string };
/** One editorial row of the "What we offer" section. `category`/`destination` are slugs resolved to a live link. */
export type OfferRow = { title: string; text: string; image: string; facts: OfferFact[]; cta_label: string; href?: string; category?: string; destination?: string };

const offerRows: OfferRow[] = [
  { title: 'Serengeti Migration Safaris', image: PHOTO.wildebeest, category: 'great-migration-safaris', cta_label: 'Explore migration safaris',
    text: 'The Great Migration is not a single event but a year-round circuit. More than a million wildebeest, along with zebra and gazelle, move through the Serengeti ecosystem following the rains and fresh grass. Where you stay, and when, decides what you see.\n\nCalving season on the southern plains usually runs from January to March, with predators close behind the newborns. The dramatic river crossings in the north are most often seen from roughly July to October. We match your dates to the herds, so you are in the right part of the park.',
    facts: [{ label: 'Best for', value: 'Big herds & river crossings' }, { label: 'Where', value: 'Serengeti National Park' }, { label: 'Time of year', value: 'Year-round, location changes' }] },
  { title: 'Tanzania Wildlife Safaris', image: PHOTO.elephant, category: 'northern-circuit-safaris', cta_label: 'Explore wildlife safaris',
    text: 'Tanzania’s northern circuit packs a remarkable range of habitats into a few days of driving. Tarangire is known for its elephant herds and ancient baobab trees, Lake Manyara for its birdlife and tree-climbing lions, and the Serengeti for classic big-cat country.\n\nOur guides know where animals tend to be at each time of day, and we keep vehicle numbers small so you spend more time watching wildlife and less time waiting in a queue. Game drives are usually in the early morning and late afternoon, when animals are most active.',
    facts: [{ label: 'Best for', value: 'Elephants, big cats & birdlife' }, { label: 'Where', value: 'Tarangire, Manyara, Serengeti' }, { label: 'Time of year', value: 'June to October is the driest' }] },
  { title: 'Ngorongoro Crater Safaris', image: PHOTO.ngorongoroGate, destination: 'ngorongoro-crater', cta_label: 'Explore Ngorongoro safaris',
    text: 'The Ngorongoro Crater is the world’s largest intact volcanic caldera, around 600 metres deep and some 260 square kilometres across. Its floor holds a dense, permanent community of wildlife, and it is one of the best places in Africa to see black rhino.\n\nBecause the animals live on the crater floor all year, sightings are reliable in any season. We usually plan a full-day descent so you can reach the floor early, before the crowds, and enjoy a picnic lunch beside the hippo pool.',
    facts: [{ label: 'Best for', value: 'Lions, rhino & reliable sightings' }, { label: 'Where', value: 'Ngorongoro Conservation Area' }, { label: 'Time of year', value: 'All year' }] },
  { title: 'Safari from Zanzibar', image: PHOTO.zanzibarBeach, category: 'safari-zanzibar-beach-holidays', cta_label: 'Explore safaris from Zanzibar',
    text: 'You do not have to choose between the beach and the bush. Short flights connect Zanzibar to the mainland, so you can add a safari to your island holiday without long transfers or lost days.\n\nMost travellers fly to northern Tanzania for two to four nights, then return to the coast to relax. We arrange the flights, the park fees, the lodges and the guide, so it all fits together as one trip.',
    facts: [{ label: 'Best for', value: 'Beach and bush in one trip' }, { label: 'Where', value: 'Zanzibar + northern parks' }, { label: 'Time of year', value: 'All year' }] }
];

// The home page blocks drawn from the homepage design. Each is on unless a CMS
// record switches it off; the CMS text and images replace these defaults.
export const refreshSections: HomepageSection[] = [
  { section_key: 'company_intro', sort_order: 1, title: 'Your Tanzania safari, planned by locals', subtitle: 'YOUR LOCAL TANZANIA SAFARI EXPERTS', content: 'A locally owned safari company based in Arusha, creating wildlife safaris, Zanzibar beach extensions and authentic cultural experiences.', image_url: PHOTO.teamWithGuests, button_text: 'Plan My Safari', button_url: '#plan-form', extra_data: { footnote: 'Locally Owned in Tanzania · Tailor-Made Experiences · Private 4x4 Safaris', points: ['Locally owned and run from Arusha', 'Tailor-made around your interests, comfort and budget', 'One team from your first enquiry to your journey home'] } },
  { section_key: 'planning_cta', sort_order: 3, title: 'Ready for Your Dream Safari?', subtitle: 'TALK TO OUR TEAM', content: 'Fully customize your safari with a free quote from our tour consultant.', image_url: PHOTO.guidePicnic, button_text: 'Request a Free Quote', button_url: '#plan-form', extra_data: { title_highlight: 'Dream Safari?', footnote: 'Free quote · No obligation', secondary_cta_text: 'WhatsApp Us', secondary_cta_url: WHATSAPP_URL } },
  { section_key: 'trust_features', sort_order: 4, title: 'Why Travellers Trust Us', subtitle: 'PEACE OF MIND', content: 'Choosing a safari is a big decision, especially when you are planning it from far away. That is why Key2africa is locally owned and run from Tanzania: you deal with people who know the parks, the seasons and the roads first-hand. We keep our pricing clear, our support personal and your booking secure, so you can look forward to the adventure instead of worrying about the details.', extra_data: { rows: [
    { label: 'Local', title: 'Local Safari Experts', text: 'Local knowledge of Tanzania’s wildlife, nature, and culture.' },
    { label: 'Support', title: 'Personal Support', text: 'Dedicated support from planning to the end of your safari.' },
    { label: 'Pricing', title: 'Transparent Pricing', text: 'Clear quotes with inclusions explained upfront.' },
    { label: 'Booking', title: 'Secure Booking', text: 'Clear booking terms and straightforward payment arrangements.' }
  ] } },
  { section_key: 'safari_offers', sort_order: 32, title: 'Amazing Safari Experiences in Tanzania', subtitle: 'WHAT WE OFFER', content: 'Every safari we run is built around one question: what do you most want to see? Here are the four experiences travellers ask us about most. Each one can be taken on its own or combined into a single trip, and every itinerary is planned and guided by our team in Tanzania.', button_text: 'Create My Safari', button_url: '#plan-form', extra_data: { rows: offerRows, cta_title: 'Can’t find what you’re looking for?', cta_text: 'We can create a custom safari around your dates, budget and interests.' } }
];
export const refreshLabels: Record<string,string> = {company_intro:'Company introduction',planning_cta:'Safari consultant CTA',trust_features:'Why travellers trust us',safari_offers:'What we offer'};

const str = (value:unknown) => typeof value === 'string' ? value.trim() : '';

/**
 * The editorial rows: the CMS cards when the section has its own (name, description,
 * image, link, "best for" and `meta` as the place), otherwise the defaults above.
 */
export function offerRowsFor(section:HomepageSection):OfferRow[] {
  const items = section.extra_data?.items;
  if (Array.isArray(items) && items.length) return items.filter(r=>r && typeof r==='object').map(r=>({
    title:str(r.name), text:str(r.description), image:str(r.image_url), href:str(r.href), cta_label:str(r.cta_label)||`Explore ${str(r.name)}`,
    facts:[{label:'Best for',value:Array.isArray(r.best_for)?r.best_for.map(str).filter(Boolean).join(', '):str(r.best_for)},{label:'Where',value:str(r.meta)}].filter(f=>f.value)
  })).filter(r=>r.title);
  const rows = section.extra_data?.rows;
  return Array.isArray(rows) && rows.length ? rows.filter(r=>r && typeof r==='object' && str(r.title)) as OfferRow[] : offerRows;
}

/** A row's link: its category's tours, its destination page, its own link, else a tour search. */
export function offerHref(row:OfferRow, categories:Category[], destinations:Destination[]):string {
  const category = row.category && categories.find(c=>c.slug===row.category);
  if (category) return `/tours?category_id=${encodeURIComponent(category.id)}`;
  const destination = row.destination && destinations.find(d=>d.slug===row.destination);
  // Same path as destinationHref; imported from there it would loop back through home-content.
  if (destination) return `/destinations/${encodeURIComponent(destination.slug)}`;
  return row.href || `/tours?search=${encodeURIComponent(row.title.replace(/\s+safaris?$/i,''))}`;
}

export type HomeExperience = {name:string;slug:string;description:string;image_url:string;href:string;meta:string;cta_label:string};
export function homeExperiences(section:HomepageSection, categories:Category[], activities:Activity[]):HomeExperience[] {
  // An explicitly empty saved list stays empty. Otherwise use the published catalogue.
  const rows = Array.isArray(section.extra_data?.items) ? section.extra_data.items : categories.length ? categories.slice(0,9).map(c=>({...c,href:`/tours?category_id=${encodeURIComponent(c.id)}`})) : activities.map(a=>({...a,description:a.description,image_url:a.image_url||a.hero_image_url,href:`/plan-my-trip?interest=${encodeURIComponent(a.name)}`}));
  return rows.filter(r=>r && typeof r==='object').map(r=>({name:str(r.name),slug:str(r.slug)||str(r.id),description:str(r.description)||str(r.short_description),image_url:str(r.image_url)||str(r.main_image_url),href:experienceHref(r,categories),meta:str(r.meta),cta_label:str(r.cta_label)||'Explore'})).filter(r=>r.name);
}

function experienceHref(row:Record<string,unknown>,categories:Category[]):string {
 const href=str(row.href);
 if(href && !href.startsWith('/safari-styles/'))return href;
 const category=categories.find(c=>c.slug===str(row.slug));
 return category?`/tours?category_id=${encodeURIComponent(category.id)}`:`/tours?search=${encodeURIComponent(str(row.name))}`;
}

const THEME_PHOTOS:[RegExp,string][]=[[/zanzibar|beach|island/,PHOTO.zanzibarBeach],[/migration/,PHOTO.wildebeest],[/balloon/,PHOTO.balloonsDawn],[/cultur|maasai|hadza/,PHOTO.hadzabe],[/honeymoon/,PHOTO.zanzibarSunset],[/family/,PHOTO.guestPopUpRoof],[/luxury/,PHOTO.tentPlains],[/camping|budget/,PHOTO.campTent],[/short/,PHOTO.vehicleAbovePlains],[/photo/,PHOTO.guestPopUpRoof],[/northern|crater|ngorongoro/,PHOTO.ngorongoroGate],[/southern/,PHOTO.lionPride],[/elephant/,PHOTO.elephant],[/big five|wildlife/,PHOTO.lionPride],[/lunch|picnic/,PHOTO.guidePicnic]];
const SPARE_THEME_PHOTOS=[PHOTO.vehiclesAcacia,PHOTO.acaciaHaze,PHOTO.baobabVehicles,PHOTO.balloonPlains,PHOTO.openPlains,PHOTO.acaciaAlone,PHOTO.popUpRoofView];

/** A media library photo that fits the card, only until the CMS supplies a card image. */
export function experiencePhoto(card: Pick<HomeExperience,'name'|'image_url'>):string {
 if(card.image_url)return card.image_url;
 const name=card.name.toLowerCase();
 return THEME_PHOTOS.find(([pattern])=>pattern.test(name))?.[1]||PHOTO.popUpRoofView;
}

/** One photo per card in a row: the card's own image, else a fitting one no other card in the row uses yet. */
export function experiencePhotos(cards:Pick<HomeExperience,'name'|'image_url'>[]):string[] {
 const used=new Set<string>();
 return cards.map((card,index)=>{
  if(card.image_url)return card.image_url;
  const name=card.name.toLowerCase();
  const fits=THEME_PHOTOS.filter(([pattern])=>pattern.test(name)).map(([,photo])=>photo);
  const photo=[...fits,...SPARE_THEME_PHOTOS].find(candidate=>!used.has(candidate))??SPARE_THEME_PHOTOS[index%SPARE_THEME_PHOTOS.length];
  used.add(photo);
  return photo;
 });
}
