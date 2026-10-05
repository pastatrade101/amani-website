import type { HomepageSection } from './types/api';

export type GuideRow = { label: string; title: string; text: string };
export type GuestReview = { id: string; author_name: string; country?: string; message: string; rating: number; platform?: string; source_url?: string; status?: string };
export const guideKeys = ['why_tanzania', 'safari_duration', 'safari_inclusions', 'safari_day'];

/** Shared defaults for the public page and the Homepage CMS's friendly editors. */
export const guideSections: HomepageSection[] = [
  { section_key: 'why_tanzania', sort_order: 3, title: 'One country. So many ways to feel alive.', subtitle: 'WHY TANZANIA', content: 'Open savannah, ancient volcanic landscapes and the Indian Ocean. Connect the places you dream of in a journey with room to breathe.', image_url: '/images/ngorongoro.jpg', extra_data: { rows: [
    { label: '01', title: 'Wildlife on a remarkable scale', text: 'Explore the Serengeti, Ngorongoro and Tarangire with a route shaped around your interests.' },
    { label: '02', title: 'More than game drives', text: 'Make space for local culture, beautiful landscapes and quieter moments along the way.' },
    { label: '03', title: 'The wild, then the water', text: 'Bring a safari and time on Zanzibar’s coast together in one thoughtfully paced trip.' }
  ] } },
  { section_key: 'cost_ranges', sort_order: 41, title: 'Your safari. Your priorities. Your budget.', subtitle: 'A CLEARER PICTURE OF COST', content: 'Your dates, route, number of travellers and choice of camps shape the price. Start with your comfort level; we’ll help you decide where to spend and where to keep things simple.', button_text: 'Plan around my budget', button_url: '#request-quote', extra_data: { ranges: [
    { label: 'Budget', from: 'Tailored quote', note: 'A focus on the wildlife and the route. Discuss practical accommodation and the essentials that matter to you.' },
    { label: 'Midrange', from: 'Tailored quote', note: 'Comfortable lodges and tented camps, with a considered balance of location, comfort and value.' },
    { label: 'Luxury', from: 'Tailored quote', note: 'Distinctive camps, thoughtful service and more personal touches, chosen around your preferred pace.' }
  ], note: 'Ask for a dated, itemised quote. Any prices shown are indicative; your itinerary confirms the duration, currency, inclusions and final cost.' } },
  { section_key: 'safari_duration', sort_order: 42, title: 'How much time do you have?', subtitle: 'FIND YOUR PACE', content: 'A few unforgettable days or a longer escape: choose the time you have, then build a route that makes the most of it.', button_text: 'Help me shape my route', button_url: '#request-quote', image_url: '/images/itinerary-game-drive.jpg', extra_data: { rows: [
    { label: '2–3 days', title: 'A taste of the wild', text: 'Focus on a small number of parks and keep transfers realistic. A short safari works best with a clear priority.' },
    { label: '4–5 days', title: 'The classic introduction', text: 'Combine a few contrasting landscapes, with time for wildlife and a comfortable rhythm between stops.' },
    { label: '6–7 days', title: 'Room to explore', text: 'Give the Serengeti more time, enjoy unhurried game drives and spend fewer days moving between camps.' },
    { label: '8–10 days', title: 'Take the longer way', text: 'Explore more deeply, linger in favourite places and add a different landscape without rushing.' },
    { label: '10+ days', title: 'Safari meets the sea', text: 'Connect wildlife experiences with Zanzibar or another region, allowing time for both travel and rest.' }
  ] } },
  { section_key: 'safari_inclusions', sort_order: 44, title: 'Know what goes into your safari.', subtitle: 'THE DETAILS, TAKEN CARE OF', content: 'These are the elements we discuss when building your trip. Your final itinerary and quotation confirm exactly what is included.', extra_data: { rows: [
    { label: 'Stay', title: 'Lodges & camps', text: 'Accommodation selected for your route, dates and preferred comfort level.' },
    { label: 'Explore', title: 'Park & conservation fees', text: 'Fees for the parks and conservation areas specified in your itinerary.' },
    { label: 'Travel', title: 'Safari vehicle', text: 'Your vehicle arrangements and game drives are detailed in your safari plan.' },
    { label: 'Discover', title: 'Local guiding', text: 'A guide for the experiences and activities included in your confirmed programme.' },
    { label: 'Dine', title: 'Meals & drinking water', text: 'Your meal plan and drinking-water arrangements are set out in the quotation.' },
    { label: 'Connect', title: 'Transfers & domestic flights', text: 'Airport transfers and internal flights are included only when specified.' }
  ], note: 'International flights, visas, travel insurance, tips and personal expenses are usually separate. Optional activities and upgrades should be confirmed before booking.' } },
  { section_key: 'safari_day', sort_order: 45, title: 'A day guided by the rhythm of the wild.', subtitle: 'FROM FIRST LIGHT TO FIRELIGHT', content: 'A glimpse of how a day could unfold. Exact times and activities depend on your camp, park, season and itinerary.', image_url: '/images/itinerary-baobab-sunset.jpg', extra_data: { rows: [
    { label: '06:00', title: 'Out with the first light', text: 'Set off as the landscape wakes, with your guide looking for the day’s first wildlife encounters.' },
    { label: '08:30', title: 'Breakfast, with a view', text: 'Pause for breakfast at camp or a picnic stop, depending on your plan for the day.' },
    { label: '10:00', title: 'Follow your curiosity', text: 'Explore a different corner of the park and take time to watch, photograph and ask questions.' },
    { label: '13:00', title: 'Time to slow down', text: 'Enjoy lunch, shade and a little rest before the afternoon unfolds.' },
    { label: '15:30', title: 'Back into the landscape', text: 'Head out for another game drive as the light softens and the air cools.' },
    { label: '18:30', title: 'The golden hour', text: 'Take in the changing colours as you return towards camp. Sundowners depend on your itinerary.' },
    { label: '19:30', title: 'Stories around the table', text: 'Dinner and a chance to share the day’s moments before a restful night.' }
  ] } },
  { section_key: 'reviews_section', sort_order: 47, title: 'Their journeys. In their own words.', subtitle: 'TRAVELLER STORIES', content: 'Experiences shared by guests and published by our team.' }
];

export function sectionDefault(key: string) { return guideSections.find(s => s.section_key === key); }
const string = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export function guideRows(section: HomepageSection): GuideRow[] {
  const rows = section.extra_data?.rows ?? sectionDefault(section.section_key)?.extra_data?.rows;
  if (!Array.isArray(rows)) return [];
  return rows.filter(r => r && typeof r === 'object').map(r => ({ label: string(r.label), title: string(r.title), text: string(r.text) })).filter(r => r.title);
}
export function costRows(section: HomepageSection): {label:string; from:string; note:string}[] {
  const rows = section.extra_data?.ranges ?? sectionDefault('cost_ranges')?.extra_data?.ranges;
  if (!Array.isArray(rows)) return [];
  return rows.filter(r => r && typeof r === 'object').map(r => ({label:string(r.label),from:string(r.from),note:string(r.note)})).filter(r => r.label);
}
export function approvedReviews(rows: GuestReview[]): GuestReview[] {
  return rows.filter(r => r.status === 'approved' && r.message?.trim() && r.author_name?.trim() && Number.isFinite(Number(r.rating)) && Number(r.rating) >= 1 && Number(r.rating) <= 5).slice(0, 3);
}
