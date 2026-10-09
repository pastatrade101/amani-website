import {
	CONTACTS, DIAL_CODES, LENGTHS, MAX_NOTES, MAX_PRIORITIES, MAX_TYPES, NOT_SURE, NOT_SURE_LABEL, PACES, PARTIES, STAGES, COMFORTS,
	budgetText, comfortLabel, contactLabel, emptyAnswers, lengthLabel, namesText, paceLabel, stageLabel, travellersShort, travellersText, whenShort, whenText,
	type ContactId, type Named, type PlanAnswers, type PlanContext
} from './options.js';

/**
 * The server side of the planner: checks what the page sent and writes the
 * enquiry staff read in /admin/messages and the alert email. The answers go
 * into the contact message as a fixed block of "Label: value" lines, because
 * contact_messages has no column for them. Plain TS, so it is testable.
 */

export const MAX_PLAN_BYTES = 8192;
/** The backend cuts the traveller's copy of the message here (notification.service TEAM_ONLY_MARKER). */
export const TEAM_MARKER = '— For our team —';
const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'landing', 'referrer'] as const;

// Control characters (newline and tab kept only where text may span lines).
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028\u2029]/g;
export const cleanLine = (value: unknown, max: number) => String(value ?? '').replace(CONTROL, '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** Notes keep their line breaks; a typed copy of the staff-only marker is defused. */
export const cleanNotes = (value: unknown) =>
	String(value ?? '').replace(/\r\n?/g, '\n').replace(CONTROL, '').replace(/—\s*For our team\s*—/gi, 'For our team').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_NOTES);

const oneOf = <T extends string>(ids: readonly { id: T }[], value: unknown, notSure = true): T | typeof NOT_SURE | '' =>
	notSure && value === NOT_SURE ? NOT_SURE : (ids.find((item) => item.id === value)?.id ?? '');
const int = (value: unknown, min: number, max: number, fallback: number) => {
	const n = Number(value);
	return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};
const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/i;
const named = (value: unknown, max: number): Named[] => {
	if (!Array.isArray(value)) return [];
	const out: Named[] = [];
	for (const item of value) {
		const slug = String((item as Named)?.slug ?? '');
		const name = cleanLine((item as Named)?.name, 120);
		if (slug === NOT_SURE) return [{ slug: NOT_SURE, name: NOT_SURE_LABEL }];
		if (SLUG.test(slug) && name && !out.some((entry) => entry.slug === slug)) out.push({ slug, name });
	}
	return out.slice(0, max);
};
const isRealDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/**
 * Every answer coerced to the shared options: an unknown id becomes "not
 * given", free-text names are capped at 120 characters, and dates must be
 * real ones no earlier than `today` (YYYY-MM-DD).
 */
export function coercePlan(raw: unknown, today: string): PlanAnswers {
	const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const year = Number(today.slice(0, 4));
	const a = emptyAnswers(year);
	a.types = named(input.types, MAX_TYPES);
	a.party = (oneOf(PARTIES, input.party, false) || '') as PlanAnswers['party'];
	a.adults = int(input.adults, 1, 20, 2);
	a.children = int(input.children, 0, 20, 0);
	a.childAges = (Array.isArray(input.childAges) ? input.childAges : []).slice(0, a.children).map((age) => (age === null || age === '' ? null : int(age, 0, 17, -1))).map((age) => (age === -1 ? null : age));
	a.dateMode = input.dateMode === 'exact' ? 'exact' : 'flexible';
	a.year = int(input.year, year, year + 2, year);
	a.month = input.month === null || input.month === undefined ? null : int(input.month, 0, 11, -1);
	if (a.month === -1) a.month = null;
	a.dateUnsure = input.dateUnsure === true;
	const start = String(input.startDate ?? '');
	const end = String(input.endDate ?? '');
	a.startDate = isRealDate(start) && start >= today ? start : '';
	a.endDate = a.startDate && isRealDate(end) && end >= a.startDate ? end : '';
	a.length = oneOf(LENGTHS, input.length);
	a.pace = oneOf(PACES, input.pace);
	a.priorities = named(input.priorities, MAX_PRIORITIES);
	a.comfort = oneOf(COMFORTS, input.comfort);
	const budget = Number(input.budget);
	a.budgetUnsure = input.budgetUnsure === true;
	a.budget = !a.budgetUnsure && input.budget !== null && Number.isFinite(budget) && budget > 0 && budget <= 1_000_000 ? Math.round(budget) : null;
	a.stage = oneOf(STAGES, input.stage);
	a.contact = (oneOf(CONTACTS, input.contact, false) || 'whatsapp') as ContactId;
	a.whatsappOk = input.whatsappOk === true;
	const context = input.context as Partial<PlanContext> | null | undefined;
	a.context = context && ['tour', 'stay', 'destination'].includes(String(context.kind)) && SLUG.test(String(context.slug)) && cleanLine(context.name, 120)
		? { kind: context.kind as PlanContext['kind'], slug: String(context.slug), name: cleanLine(context.name, 120) }
		: null;
	a.suggested = (Array.isArray(input.suggested) ? input.suggested : []).map((title) => cleanLine(title, 160)).filter(Boolean).slice(0, 3);
	a.from = /^[a-z0-9_]{1,40}$/.test(String(input.from ?? '')) ? String(input.from) : '';
	a.lastCta = /^[a-z0-9_:-]{1,90}$/i.test(String(input.lastCta ?? '')) ? String(input.lastCta) : '';
	const campaign = (input.campaign && typeof input.campaign === 'object' ? input.campaign : {}) as Record<string, unknown>;
	for (const key of CAMPAIGN_KEYS) {
		const value = cleanLine(campaign[key], 200);
		if (value) a.campaign[key] = value;
	}
	return a;
}

/** The page's answers, from the JSON it posts. Null when missing, oversized or unreadable. */
export function parsePlan(json: string, today: string): PlanAnswers | null {
	if (!json || new TextEncoder().encode(json).length > MAX_PLAN_BYTES) return null;
	try {
		return coercePlan(JSON.parse(json), today);
	} catch {
		return null;
	}
}

// The enquiry form's check, plus the backend's own (zod) email rule, so an
// address the planner accepts is never refused when it is sent on.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZOD_EMAIL = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;
export const validEmail = (email: string) => email.length <= 254 && EMAIL.test(email) && ZOD_EMAIL.test(email);

/** The digits of a phone number as dialled from abroad: spaces and dashes out, leading zeros dropped. */
export const phoneDigits = (phone: string) => phone.replace(/[\s().-]/g, '').replace(/^0+/, '');

export type ContactFields = { full_name: string; email: string; dial_code: string; phone: string };
export type ContactCheck = { ok: true; full_name: string; email: string; phone: string | null } | { ok: false; field: 'full_name' | 'email' | 'phone'; message: string };

/** A phone number is required unless the visitor asked to be contacted by email. */
export function checkContact(fields: ContactFields, contact: ContactId): ContactCheck {
	const full_name = cleanLine(fields.full_name, 151);
	const email = fields.email.trim();
	if (full_name.length < 2 || full_name.length > 150) return { ok: false, field: 'full_name', message: 'Please enter your full name.' };
	if (!validEmail(email)) return { ok: false, field: 'email', message: 'Please enter a valid email address.' };
	const digits = phoneDigits(fields.phone);
	if (!digits && contact === 'email') return { ok: true, full_name, email, phone: null };
	if (!/^\d{6,14}$/.test(digits)) return { ok: false, field: 'phone', message: 'Please enter a phone number of 6 to 14 digits.' };
	if (!DIAL_CODES.some((item) => item.code === fields.dial_code)) return { ok: false, field: 'phone', message: 'Please choose the country code for your phone number.' };
	return { ok: true, full_name, email, phone: `${fields.dial_code} ${digits}` };
}

/** "K2A-1A2B3C4D", from the one-per-page request key. */
export const planReference = (requestKey: string) => {
	const hex = requestKey.replace(/-/g, '');
	return /^[0-9a-f]{8,64}$/i.test(hex) ? `K2A-${hex.slice(0, 8).toUpperCase()}` : null;
};

const typesLabel = (a: PlanAnswers) => namesText(a.types) || NOT_SURE_LABEL;

export function composeSubject(a: PlanAnswers, reference: string): string {
	return ['Plan my trip', reference, typesLabel(a), whenShort(a)].filter(Boolean).join(' · ').slice(0, 200);
}

/** One row per answer, in the order the planner asks. */
export function planRows(a: PlanAnswers): { label: string; value: string }[] {
	const when = whenText(a);
	return [
		{ label: 'Trip type', value: typesLabel(a) },
		{ label: 'Travellers', value: travellersText(a) },
		{ label: 'When', value: when && when !== NOT_SURE_LABEL ? `${a.dateMode === 'exact' ? 'Exact dates' : 'Flexible'} · ${when}` : when },
		{ label: 'Length', value: lengthLabel(a.length) },
		{ label: 'Pace', value: paceLabel(a.pace) },
		{ label: 'Priorities', value: namesText(a.priorities) },
		{ label: 'Comfort', value: comfortLabel(a.comfort) },
		{ label: 'Budget', value: a.budgetUnsure ? NOT_SURE_LABEL : a.budget !== null ? `${budgetText(a)} (USD)` : '' },
		{ label: 'Planning stage', value: stageLabel(a.stage) },
		{ label: 'Interested in', value: a.context ? `${a.context.name} (${a.context.kind})` : '' },
		{ label: 'Suggested trips', value: a.suggested.join('; ') },
		{ label: 'Preferred contact', value: `${contactLabel(a.contact)}${a.whatsappOk ? ' (happy to receive WhatsApp messages)' : ''}` }
	].filter((row) => row.value);
}

/** Campaign and entry details. Staff only: the backend never emails this part to the traveller. */
export function teamLines(a: PlanAnswers): string[] {
	const c = a.campaign;
	const clickId = c.gclid || c.gbraid || c.wbraid;
	const source = c.utm_source || (clickId ? 'google' : '');
	const medium = c.utm_medium || (clickId ? 'cpc' : '');
	const visit = [
		source || medium ? `Came from: ${[source, medium].filter(Boolean).join(' / ')}` : '',
		c.utm_campaign ? `Campaign: ${c.utm_campaign}` : '',
		c.utm_term ? `Term: ${c.utm_term}` : '',
		c.utm_content ? `Content: ${c.utm_content}` : '',
		c.gclid ? `gclid: ${c.gclid}` : '',
		c.gbraid ? `gbraid: ${c.gbraid}` : '',
		c.wbraid ? `wbraid: ${c.wbraid}` : '',
		c.fbclid ? `fbclid: ${c.fbclid}` : '',
		c.landing || c.referrer ? `First visit: ${[c.landing, c.referrer].filter(Boolean).join(', ')}` : ''
	].filter(Boolean);
	const entry = [a.from ? `Planner opened from: ${a.from}` : '', a.lastCta ? `Last CTA: ${a.lastCta}` : ''].filter(Boolean);
	return [visit.join(' · '), entry.join(' · ')].filter(Boolean);
}

/**
 * The message staff read. The first line is the /admin/messages preview; the
 * traveller's own words come next, then the plan, then the staff-only block.
 */
export function composeMessage(a: PlanAnswers, reference: string, notes: string): string {
	const headline = `Trip plan ${reference}: ${[typesLabel(a), whenText(a), a.party ? travellersShort(a) : ''].filter(Boolean).join(' · ')}`;
	const team = teamLines(a);
	return [
		headline,
		...(notes ? ['', 'Their message:', notes] : []),
		'',
		'— Trip plan —',
		...planRows(a).map((row) => `${row.label}: ${row.value}`),
		...(team.length ? ['', TEAM_MARKER, ...team] : [])
	].join('\n');
}

/** What the success screen lists back to the traveller. */
export const recapRows = (a: PlanAnswers) =>
	planRows(a).filter((row) => ['Trip type', 'When', 'Travellers', 'Comfort', 'Priorities'].includes(row.label));
