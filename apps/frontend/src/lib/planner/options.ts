/**
 * The answers the "Plan my trip" planner collects, shared by the page (which
 * asks) and the server action (which checks them and writes the enquiry).
 * Every fixed answer is one of these ids, so the server can refuse anything
 * else, and the words staff read come from one place. Plain TS, so it is testable.
 */

/** The answer for anyone who has not decided yet, offered on every question. */
export const NOT_SURE = 'not_sure';
export const NOT_SURE_LABEL = 'Not sure yet';

export const MAX_TYPES = 3;
export const MAX_PRIORITIES = 3;
export const MAX_NOTES = 2000;

export const PARTIES = [
	{ id: 'solo', label: 'Solo', hint: 'Just me' },
	{ id: 'couple', label: 'Couple', hint: 'The two of us' },
	{ id: 'family', label: 'Family', hint: 'With children' },
	{ id: 'group', label: 'Group', hint: 'Friends or a larger party' }
] as const;
export type PartyId = (typeof PARTIES)[number]['id'];

/** Trip length bands. `max` of the open band is only used to score matches. */
export const LENGTHS = [
	{ id: '2-4', label: '2–4 days', min: 2, max: 4 },
	{ id: '5-7', label: '5–7 days', min: 5, max: 7 },
	{ id: '8-10', label: '8–10 days', min: 8, max: 10 },
	{ id: '11-14', label: '11–14 days', min: 11, max: 14 },
	{ id: '15+', label: '15+ days', min: 15, max: 21 }
] as const;
export type LengthId = (typeof LENGTHS)[number]['id'];

export const PACES = [
	{ id: 'relaxed', label: 'Relaxed', desc: 'More nights in fewer places, with time to rest.' },
	{ id: 'balanced', label: 'Balanced', desc: 'A mix of game drives, downtime and variety.' },
	{ id: 'active', label: 'Active', desc: 'More places and fuller days on the move.' }
] as const;
export type PaceId = (typeof PACES)[number]['id'];

/** The three safari styles the tours are priced in (pricing_summary.styles). */
export const COMFORTS = [
	{ id: 'budget', label: 'Value', desc: 'Comfortable camps and lodges, simply done.' },
	{ id: 'midrange', label: 'Mid-range', desc: 'Well-placed lodges with more space and comfort.' },
	{ id: 'luxury', label: 'Luxury', desc: 'The finest camps and lodges, with more privacy.' }
] as const;
export type ComfortId = (typeof COMFORTS)[number]['id'];

export const STAGES = [
	{ id: 'exploring', label: 'Just exploring ideas', desc: 'I’d like help understanding what’s possible.' },
	{ id: 'comparing', label: 'Comparing options', desc: 'I’m weighing up routes, styles and prices.' },
	{ id: 'ready', label: 'Ready to plan in detail', desc: 'I know roughly what I want and when.' },
	{ id: 'booking_soon', label: 'Booking within a month', desc: 'I’d like a proposal I can confirm soon.' },
	{ id: 'flights_booked', label: 'Flights already booked', desc: 'My dates are set; I need the trip around them.' }
] as const;
export type StageId = (typeof STAGES)[number]['id'];

export const CONTACTS = [
	{ id: 'whatsapp', label: 'WhatsApp' },
	{ id: 'email', label: 'Email' },
	{ id: 'phone', label: 'Phone call' }
] as const;
export type ContactId = (typeof CONTACTS)[number]['id'];

/** Country codes offered beside the phone number. None is preselected. */
export const DIAL_CODES = [
	{ code: '+255', country: 'Tanzania' },
	{ code: '+254', country: 'Kenya' },
	{ code: '+256', country: 'Uganda' },
	{ code: '+250', country: 'Rwanda' },
	{ code: '+27', country: 'South Africa' },
	{ code: '+44', country: 'United Kingdom' },
	{ code: '+353', country: 'Ireland' },
	{ code: '+1', country: 'USA / Canada' },
	{ code: '+49', country: 'Germany' },
	{ code: '+33', country: 'France' },
	{ code: '+34', country: 'Spain' },
	{ code: '+39', country: 'Italy' },
	{ code: '+31', country: 'Netherlands' },
	{ code: '+32', country: 'Belgium' },
	{ code: '+41', country: 'Switzerland' },
	{ code: '+43', country: 'Austria' },
	{ code: '+46', country: 'Sweden' },
	{ code: '+47', country: 'Norway' },
	{ code: '+45', country: 'Denmark' },
	{ code: '+48', country: 'Poland' },
	{ code: '+351', country: 'Portugal' },
	{ code: '+971', country: 'United Arab Emirates' },
	{ code: '+91', country: 'India' },
	{ code: '+86', country: 'China' },
	{ code: '+61', country: 'Australia' },
	{ code: '+64', country: 'New Zealand' }
] as const;

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A catalogue answer (a trip type or a priority): its slug, and the name staff read. */
export type Named = { slug: string; name: string };
/** The tour, stay or destination the visitor came from. Slugs only reach the URL. */
export type PlanContext = { kind: 'tour' | 'stay' | 'destination'; slug: string; name: string };

/** Everything the planner sends besides the contact details and free-text notes. */
export type PlanAnswers = {
	types: Named[];
	party: PartyId | '';
	adults: number;
	children: number;
	/** One per child; null where the age was not given. */
	childAges: (number | null)[];
	dateMode: 'flexible' | 'exact';
	year: number;
	/** 0–11, null until a month is picked. */
	month: number | null;
	dateUnsure: boolean;
	/** YYYY-MM-DD, exact dates only. */
	startDate: string;
	endDate: string;
	length: LengthId | typeof NOT_SURE | '';
	pace: PaceId | typeof NOT_SURE | '';
	priorities: Named[];
	comfort: ComfortId | typeof NOT_SURE | '';
	/** USD per person; null until the slider is moved. */
	budget: number | null;
	budgetUnsure: boolean;
	stage: StageId | typeof NOT_SURE | '';
	contact: ContactId;
	whatsappOk: boolean;
	context: PlanContext | null;
	/** Titles of the trips the planner suggested. */
	suggested: string[];
	/** Where the link to the planner sat (planHref's `from`). */
	from: string;
	/** The last call to action clicked this visit, "location:name". */
	lastCta: string;
	/** Campaign tags, landing path and referrer host, for the staff-only block. */
	campaign: Record<string, string>;
};

export const notSure = (): Named => ({ slug: NOT_SURE, name: NOT_SURE_LABEL });

export const emptyAnswers = (year: number): PlanAnswers => ({
	types: [],
	party: '',
	adults: 2,
	children: 0,
	childAges: [],
	dateMode: 'flexible',
	year,
	month: null,
	dateUnsure: false,
	startDate: '',
	endDate: '',
	length: '',
	pace: '',
	priorities: [],
	comfort: '',
	budget: null,
	budgetUnsure: false,
	stage: '',
	contact: 'whatsapp',
	whatsappOk: false,
	context: null,
	suggested: [],
	from: '',
	lastCta: '',
	campaign: {}
});

// ── Words, shared by the page, the summary and the enquiry staff read ─────────

const labelIn = (list: readonly { id: string; label: string }[], id: string) =>
	id === NOT_SURE ? NOT_SURE_LABEL : (list.find((item) => item.id === id)?.label ?? '');

export const partyLabel = (id: string) => labelIn(PARTIES, id);
export const lengthLabel = (id: string) => labelIn(LENGTHS, id);
export const paceLabel = (id: string) => labelIn(PACES, id);
export const comfortLabel = (id: string) => labelIn(COMFORTS, id);
export const stageLabel = (id: string) => labelIn(STAGES, id);
export const contactLabel = (id: string) => labelIn(CONTACTS, id);

/** "$4,000": staff read in USD, the currency tours are priced in. */
export const usd = (amount: number) => `$${Math.round(amount).toLocaleString('en-US')}`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Solo and Couple fix the head count; Family and Group use the counters. */
export const travellerCount = (a: Pick<PlanAnswers, 'party' | 'adults' | 'children'>) => ({
	adults: a.party === 'solo' ? 1 : a.party === 'couple' ? 2 : a.adults,
	children: a.party === 'family' || a.party === 'group' ? a.children : 0
});

/** The ages given, for parties that can include children. */
export const childAgesOf = (a: Pick<PlanAnswers, 'party' | 'adults' | 'children' | 'childAges'>): number[] =>
	a.childAges.slice(0, travellerCount(a).children).filter((age): age is number => typeof age === 'number');

/** "2 adults, 1 child". */
export const travellersShort = (a: Pick<PlanAnswers, 'party' | 'adults' | 'children'>) => {
	const { adults, children } = travellerCount(a);
	return [plural(adults, 'adult', 'adults'), children ? plural(children, 'child', 'children') : ''].filter(Boolean).join(', ');
};

/** "Family · 2 adults, 1 child (ages 8)". */
export const travellersText = (a: Pick<PlanAnswers, 'party' | 'adults' | 'children' | 'childAges'>) => {
	if (!a.party) return '';
	const ages = childAgesOf(a);
	return `${partyLabel(a.party)} · ${travellersShort(a)}${ages.length ? ` (${ages.length === 1 ? 'age' : 'ages'} ${ages.join(', ')})` : ''}`;
};

/** "4 Jul 2027" from "2027-07-04". */
export const shortDate = (iso: string) => {
	const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	return match ? `${Number(match[3])} ${MONTH_SHORT[Number(match[2]) - 1]} ${match[1]}` : '';
};

/** The month the trip falls in (0–11), from the exact start date or the month picked. */
export const activeMonth = (a: Pick<PlanAnswers, 'dateMode' | 'startDate' | 'month' | 'dateUnsure'>): number | null => {
	if (a.dateMode === 'exact') return /^\d{4}-\d{2}-\d{2}$/.test(a.startDate) ? Number(a.startDate.slice(5, 7)) - 1 : null;
	return a.dateUnsure ? null : a.month;
};

/** "July 2027", "4 Jul 2027 to 15 Jul 2027", "From 4 Jul 2027" or "Not sure yet". */
export const whenText = (a: Pick<PlanAnswers, 'dateMode' | 'year' | 'month' | 'dateUnsure' | 'startDate' | 'endDate'>) => {
	if (a.dateMode === 'exact') {
		if (!a.startDate) return '';
		return a.endDate ? `${shortDate(a.startDate)} to ${shortDate(a.endDate)}` : `From ${shortDate(a.startDate)}`;
	}
	if (a.dateUnsure) return NOT_SURE_LABEL;
	return a.month === null ? '' : `${MONTH_NAMES[a.month]} ${a.year}`;
};

/** "Jul 2027" or "4 Jul 2027", for subject lines. Empty when unknown. */
export const whenShort = (a: Pick<PlanAnswers, 'dateMode' | 'year' | 'month' | 'dateUnsure' | 'startDate'>) => {
	if (a.dateMode === 'exact') return shortDate(a.startDate);
	return a.dateUnsure || a.month === null ? '' : `${MONTH_SHORT[a.month]} ${a.year}`;
};

export const namesText = (list: Named[]) => list.map((item) => item.name).join(', ');

export const budgetText = (a: Pick<PlanAnswers, 'budget' | 'budgetUnsure'>) =>
	a.budgetUnsure ? NOT_SURE_LABEL : a.budget !== null ? `Up to ${usd(a.budget)} per person` : '';
