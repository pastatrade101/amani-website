/**
 * Where a visitor came from: campaign tags, Google click ids, the landing
 * path and the external referrer's host. Kept for this visit in sessionStorage
 * and, once the visitor accepts cookies, as a first-touch copy in localStorage,
 * so a lead sent later still carries the source that brought them. No personal
 * data: the referrer is reduced to its host and the landing page to its path.
 */
const VISIT_KEY = 'k2a_visit';
const FIRST_KEY = 'k2a_attr';
const LAST_CTA_KEY = 'k2a_last_cta';
export const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'fbclid'] as const;

type Visit = Record<string, string>;

const read = (storage: () => Storage, key: string): Visit => {
	try {
		const value = JSON.parse(storage().getItem(key) || '{}');
		return value && typeof value === 'object' ? (value as Visit) : {};
	} catch {
		return {};
	}
};
const write = (storage: () => Storage, key: string, value: Visit) => {
	try {
		storage().setItem(key, JSON.stringify(value));
	} catch {
		/* storage unavailable: attribution is a nice-to-have */
	}
};
const session = () => sessionStorage;
const local = () => localStorage;

const CLICK_IDS = new Set(['gclid', 'gbraid', 'wbraid', 'fbclid', 'srsltid']);

/**
 * A campaign tag fit to send on. Click ids are plain tokens. Email tools often
 * put the subscriber's address in utm_content or utm_term, so a value with an
 * @ or a long run of digits is dropped and only plain characters are kept.
 */
export function safeCampaignValue(key: string, raw: string | null | undefined): string {
	const value = (raw ?? '').trim();
	if (!value) return '';
	if (CLICK_IDS.has(key)) return /^[\w-]{1,200}$/.test(value) ? value : '';
	if (/@|\d{7,}/.test(value)) return '';
	return value.replace(/[^\p{L}\p{N}_.\-+~% ]/gu, '').trim().slice(0, 200);
}

/** This landing's campaign tags, path and external referrer host. Exported for tests. */
export function landingFrom(url: URL, referrer: string): Visit {
	const out: Visit = {};
	for (const key of CAMPAIGN_KEYS) {
		const value = safeCampaignValue(key, url.searchParams.get(key));
		if (value) out[key] = value;
	}
	out.landing = url.pathname.slice(0, 200);
	try {
		const host = referrer ? new URL(referrer).hostname : '';
		if (host && host !== url.hostname) out.referrer = host.slice(0, 200);
	} catch {
		/* a malformed referrer is no referrer */
	}
	return out;
}

/**
 * On every full page load: a landing with campaign tags (a new ad click)
 * replaces this visit's record; otherwise the first landing of the visit is kept.
 */
export function captureVisit(granted: boolean) {
	if (typeof window === 'undefined') return;
	const landing = landingFrom(new URL(window.location.href), document.referrer);
	const tagged = CAMPAIGN_KEYS.some((key) => landing[key]);
	if (tagged || !Object.keys(read(session, VISIT_KEY)).length) write(session, VISIT_KEY, landing);
	if (granted) rememberFirstTouch();
}

/** Keep the first visit that brought this browser here. Only after consent. */
export function rememberFirstTouch() {
	if (typeof window === 'undefined' || Object.keys(read(local, FIRST_KEY)).length) return;
	const visit = read(session, VISIT_KEY);
	if (Object.keys(visit).length) write(local, FIRST_KEY, visit);
}

/** This visit's record, falling back to the first touch: tags, click ids, landing and referrer. */
export function visitDetails(): Visit {
	if (typeof window === 'undefined') return {};
	const visit = read(session, VISIT_KEY);
	return CAMPAIGN_KEYS.some((key) => visit[key]) || !Object.keys(read(local, FIRST_KEY)).length ? visit : read(local, FIRST_KEY);
}

/** utm_*, gclid, gbraid and wbraid for a conversion event. */
export function campaignTags(): Record<string, string> {
	const visit = visitDetails();
	const out: Record<string, string> = {};
	for (const key of CAMPAIGN_KEYS) if (key !== 'fbclid' && visit[key]) out[key] = visit[key];
	return out;
}

export function rememberCta(value: string) {
	try {
		sessionStorage.setItem(LAST_CTA_KEY, value.slice(0, 90));
	} catch {
		/* ignore */
	}
}

/** "location:name" of the last call to action clicked this visit. */
export function lastCta(): string {
	try {
		return typeof window === 'undefined' ? '' : (sessionStorage.getItem(LAST_CTA_KEY) ?? '');
	} catch {
		return '';
	}
}
