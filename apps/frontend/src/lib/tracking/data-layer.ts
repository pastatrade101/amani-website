import { getConsent } from '$lib/admin/consent';
import { debugOn, isProdHost } from './host';
import { tagMode, whenTagsReady } from './tags';

/**
 * The one way an event reaches Google. In GTM mode it is pushed onto the
 * dataLayer as { event, ...params } for a Custom Event trigger; with a direct
 * Google tag it is sent with gtag('event'); never both. Nothing is sent when
 * consent is denied, on a non-production host, or with no tag configured.
 * Callers pass non-personal values only: never a name, email, phone or message.
 */

type Value = string | number | null | undefined;
type Params = Record<string, Value>;
type Campaign = { utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_term?: string; utm_content?: string; gclid?: string; gbraid?: string; wbraid?: string };
type Form = { form_name: string; form_type?: string };

/** The dataLayer events this site sends, and their parameters. */
export type TrackEvents = {
	virtual_page_view: { page_location: string; page_path: string; page_title?: string; page_referrer?: string };
	form_opened: Form;
	form_started: Form;
	form_step_completed: Form & { step_index: number; step_key: string };
	form_validation_error: Form & { step_key: string; field_name: string; error_type: string };
	form_abandoned: Form & { step_index: number; step_key: string };
	form_submit_error: Form & { error_type: 'server_validation' | 'rate_limited' | 'submit_failed' | string };
	generate_lead: Campaign & Form & {
		lead_source: string;
		/** Random per submission, for Google Ads de-duplication; never stored or tied to the enquiry. */
		transaction_id?: string;
		traveller_type?: string;
		duration_days?: number;
		budget_range?: string;
		experience_type?: string;
		accommodation_level?: string;
		destination?: string;
		travel_date?: string;
		cta_clicked?: string;
	};
	cta_click: { cta_name: string; cta_location?: string; cta_type?: string; link_url?: string };
	whatsapp_click: { cta_location?: string; method?: string };
	phone_click: { cta_location?: string; method?: string };
	email_click: { cta_location?: string; method?: string };
};

/** A one-off id for a lead event, so Google Ads counts a conversion once. Never stored. */
export const newTransactionId = (): string => {
	try {
		return crypto.randomUUID();
	} catch {
		return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	}
};

const clean = (params: Params) => Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));

/** Untyped sender, for the event layer in $lib/admin/analytics. */
export function sendToGoogle(event: string, params: Params = {}) {
	if (typeof window === 'undefined' || getConsent() === 'denied') return;
	try {
		const data = clean(params);
		const mode = tagMode();
		if (debugOn()) console.info('[analytics] google', mode ?? 'no tag', event, data);
		if (!mode || !isProdHost()) return;
		whenTagsReady(() => {
			const w = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
			if (mode === 'gtm') {
				w.dataLayer = w.dataLayer || [];
				w.dataLayer.push({ event, ...data });
			} else {
				// A direct Google tag takes page views under GA4's own name.
				w.gtag?.('event', event === 'virtual_page_view' ? 'page_view' : event, data);
			}
		});
	} catch {
		/* measurement must never break the page */
	}
}

export const pushEvent = <E extends keyof TrackEvents>(event: E, params: TrackEvents[E]) => sendToGoogle(event, params as unknown as Params);
