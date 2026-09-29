import type { Destination, HomepageSection } from './types/api.js';

export const defaultSections: HomepageSection[] = [
	{ section_key: 'hero', title: 'Tanzania Safari Tours', subtitle: 'DISCOVER. EXPLORE. BELONG.', content: 'Follow the wild. Find your quiet. Discover Tanzania on a private journey from the Serengeti plains to the shores of Zanzibar — thoughtfully planned around you.', button_text: 'Plan My Safari', button_url: '#request-quote', sort_order: 0 },
	{ section_key: 'why_us', title: 'More than a safari. A connection to Tanzania.', subtitle: 'THE KEY2AFRICA APPROACH', content: 'The best journeys feel personal. We bring local insight and thoughtful planning to the moments you’ve been dreaming of, and the ones you haven’t imagined yet.', button_text: 'Create my Tanzania journey', button_url: '#request-quote', sort_order: 5 },
	{ section_key: 'experiences', title: 'Moments that become your favourite stories.', subtitle: 'EXPERIENCE SOMETHING EXTRAORDINARY', content: 'Feel the thrill of the wild, the stillness of the plains and the freedom to explore your way.', sort_order: 10 },
	{ section_key: 'destinations', title: 'Where Will Your Tanzania Safari Take You?', subtitle: 'EXPLORE TANZANIA', content: 'Discover the iconic parks, landscapes and wildlife areas that make Tanzania an unforgettable safari destination.', sort_order: 20 },
	{ section_key: 'safari_packages', title: 'Find a Safari That Feels Like You', subtitle: 'YOUR JOURNEY STARTS HERE', content: 'Explore our published itineraries, then make them your own with our local team.', sort_order: 30 },
	{ section_key: 'when_to_go', title: 'When Should You Go?', subtitle: 'BEST TIME TO VISIT', content: 'Every season tells a different story. Choose the landscapes, wildlife and pace that speak to you.', sort_order: 40 },
	{ section_key: 'how_it_works', title: 'Your dream safari, thoughtfully put together.', subtitle: 'FROM A FIRST IDEA TO A GREAT ADVENTURE', content: 'You bring the curiosity. We help with the details. Together, we’ll turn your ideas into a journey that feels right for you.', sort_order: 43 },
	{ section_key: 'faq', title: 'A few things you might be wondering.', subtitle: 'GOOD TO KNOW', content: 'A little clarity before your next adventure.', sort_order: 46 },
	{ section_key: 'enquiry', title: 'Let’s Plan Your Tanzania Story', subtitle: 'MADE AROUND YOU', content: 'Tell us a little about your dream trip. Our team will help turn your ideas into a safari designed around you.', sort_order: 50 }
];

/** Disabled CMS markers must never be replaced with fallback copy. */
export function mergeSections(rows: HomepageSection[]): HomepageSection[] {
	return defaultSections.map((fallback) => {
		const row = rows.find((item) => item.section_key === fallback.section_key);
		if (row?.is_active === false) return { section_key: fallback.section_key, is_active: false, sort_order: row.sort_order ?? fallback.sort_order };
		const filled = Object.fromEntries(Object.entries(row ?? {}).filter(([, value]) => value !== null && value !== undefined));
		return { ...fallback, is_active: true, ...filled };
	}).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export function safeUrl(value: string | null | undefined, fallback = '#request-quote'): string {
	if (!value || value.includes('\\')) return fallback;
	if ((value.startsWith('/') && !value.startsWith('//')) || value.startsWith('#')) return value;
	try {
		const url = new URL(value);
		return ['https:', 'http:'].includes(url.protocol) ? url.href : fallback;
	} catch { return fallback; }
}

export const textContent = (value?: string | null): string => (value ?? '')
	.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
	.replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

export function circuitFor(destination: Destination): string {
	const location = `${destination.region ?? ''} ${destination.name} ${destination.slug}`.toLowerCase();
	if (/zanzibar|pemba|mafia|coast|stone town|saadani|dar es salaam/.test(location)) return 'coast';
	if (/southern|ruaha|nyerere|mikumi|udzungwa|rufiji|iringa|selous/.test(location)) return 'southern';
	if (/western|mahale|katavi|tanganyika|gombe|rubondo|kigoma/.test(location)) return 'western';
	if (/northern|serengeti|manyara|ngorongoro|tarangire|arusha|kilimanjaro|migration|natron/.test(location)) return 'northern';
	return 'other';
}

export function tourFilters(params: URLSearchParams) {
	const search = (params.get('search') ?? '').trim().slice(0, 150);
	const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	const destination = params.get('destination_id') ?? '';
	const category = params.get('category_id') ?? '';
	const filters = { search, destination_id: uuid.test(destination) ? destination : '', category_id: uuid.test(category) ? category : '' };
	const page = Math.min(1000, Math.max(1, Math.floor(Number(params.get('page')) || 1)));
	const query = new URLSearchParams({ status: 'published', limit: '12', page: String(page) });
	for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
	return { filters, query };
}
