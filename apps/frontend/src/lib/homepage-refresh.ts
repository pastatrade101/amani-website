import type { HomepageSection, Category, Activity } from './types/api';

export const TRIPADVISOR_URL = 'https://www.tripadvisor.com/Attraction_Review-g297913-d26997963-Reviews-Key2Africa_Safaris-Arusha_Arusha_Region.html';
export const WHATSAPP_URL = 'https://wa.me/255743900014';
export const refreshSections: HomepageSection[] = [
  { section_key: 'company_intro', sort_order: 1, title: 'The Key2Africa Safaris Difference', subtitle: 'YOUR LOCAL TANZANIA SAFARI EXPERTS', content: 'Discover Tanzania with a locally owned safari company based in Arusha. We create personalized wildlife safaris, Zanzibar beach extensions, and authentic cultural experiences shaped around your interests, comfort, and budget. From your first enquiry to your journey home, our team helps make every detail feel seamless.', image_url: '/images/itinerary-game-drive.jpg', button_text: 'Help Me Plan', button_url: '#plan-form', extra_data: { footnote: 'Locally Owned in Tanzania · Personalized Safari Experiences' } },
  { section_key: 'planning_cta', sort_order: 3, title: 'Ready for Your Dream Safari?', content: 'Fully customize your safari with a free quote from our tour consultant.', image_url: '/images/expert.jpg', button_text: 'Request a Free Quote', button_url: '#plan-form', extra_data: { secondary_cta_text: 'WhatsApp Us', secondary_cta_url: WHATSAPP_URL } },
  { section_key: 'trust_features', sort_order: 4, title: 'Why Travellers Trust Us', subtitle: 'PEACE OF MIND', extra_data: { rows: [
    { label: 'Local', title: 'Local Safari Experts', text: 'Local knowledge of Tanzania’s wildlife, nature, and culture.' },
    { label: 'Support', title: 'Personal Support', text: 'Dedicated support from planning to the end of your safari.' },
    { label: 'Pricing', title: 'Transparent Pricing', text: 'Clear quotes with inclusions explained upfront.' },
    { label: 'Booking', title: 'Secure Booking', text: 'Clear booking terms and straightforward payment arrangements.' }
  ] } },
  { section_key: 'safari_offers', sort_order: 32, title: 'Amazing Safari Experiences in Tanzania', subtitle: 'WHAT WE OFFER', content: 'Can’t find what you’re looking for? We can create a custom safari for you.', button_text: 'Create My Safari', button_url: '#plan-form' }
];
export const refreshLabels: Record<string,string> = {company_intro:'Company introduction',planning_cta:'Safari consultant CTA',trust_features:'Why travellers trust us',safari_offers:'What we offer carousel'};
export type HomeExperience = {name:string;slug:string;description:string;image_url:string;href:string;meta:string;cta_label:string};
const str = (value:unknown) => typeof value === 'string' ? value.trim() : '';
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

/** Use relevant bundled photography only until the CMS supplies a card image. */
export function experiencePhoto(card: Pick<HomeExperience,'name'|'image_url'>):string {
 if(card.image_url)return card.image_url;
 const name=card.name.toLowerCase();
 const matches:[RegExp,string][]=[[/zanzibar|beach|island/,'experience-zanzibar'],[/migration/,'related-wildebeest'],[/gorilla|rwanda/,'rwanda-gorillas'],[/balloon/,'activity-balloon'],[/cultur|maasai/,'activity-maasai'],[/photo/,'activity-photographer'],[/northern|crater|ngorongoro/,'itinerary-crater'],[/southern|elephant/,'itinerary-elephants'],[/big five|wildlife/,'itinerary-lions']];
 return `/images/${matches.find(([pattern])=>pattern.test(name))?.[1]||'itinerary-game-drive'}.jpg`;
}
