import { env } from '$env/dynamic/public';
import { consent, type Consent } from '$lib/admin/consent';
import { debugOn, isProdHost } from './host';

/**
 * Google Tag Manager and/or a direct Google tag (gtag.js), with Consent Mode v2.
 *
 * Read at runtime from the web container's environment, so no rebuild:
 *   PUBLIC_GTM_ID        GTM-XXXXXXX
 *   PUBLIC_GA4_ID        G-… or GT-…, only when GA4 is NOT set up inside GTM
 *   PUBLIC_CONSENT_MODE  'basic' (default: tags load after Accept) or
 *                        'advanced' (tags load at once, cookieless until Accept)
 * With both ids empty nothing loads. Never on /admin or a non-production host.
 * There is no <noscript> GTM iframe: it would load without consent.
 */

type Gtag = (...args: unknown[]) => void;
type TagWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag };

const GRANTED = { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' };
const DENIED = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' };

export type TagConfig = { gtm: string; ga4: string; mode: 'basic' | 'advanced' };

export function tagConfig(): TagConfig {
	const gtm = (env.PUBLIC_GTM_ID ?? '').trim().toUpperCase();
	const ga4 = (env.PUBLIC_GA4_ID ?? '').trim().toUpperCase();
	return {
		gtm: /^GTM-[A-Z0-9]{4,12}$/.test(gtm) ? gtm : '',
		ga4: /^(G|GT)-[A-Z0-9]{4,16}$/.test(ga4) ? ga4 : '',
		mode: (env.PUBLIC_CONSENT_MODE ?? '').trim().toLowerCase() === 'advanced' ? 'advanced' : 'basic'
	};
}

/** Where events go: GTM's dataLayer, a direct gtag.js, or nowhere. Never both. */
export const tagMode = (): 'gtm' | 'ga4' | null => {
	const config = tagConfig();
	return config.gtm ? 'gtm' : config.ga4 ? 'ga4' : null;
};

let started = false;
let scriptsLoaded = false;

/**
 * Events wait here until the tags may hear them: after the Consent Mode
 * defaults (a page can send one before the layout's initTags runs) and, in
 * basic mode, after Accept. Otherwise they would sit in the dataLayer ahead of
 * the consent update and go out as pings without consent once GTM loaded.
 */
const MAX_WAITING = 50;
let ready = false;
const waiting: Array<() => void> = [];

export function whenTagsReady(send: () => void) {
	if (ready) send();
	else if (waiting.length < MAX_WAITING) waiting.push(send);
}

function becomeReady() {
	if (ready) return;
	ready = true;
	for (const send of waiting.splice(0)) send();
}

const tagWindow = () => window as TagWindow;
const gtag: Gtag = (...args) => tagWindow().gtag?.(...args);

function addScript(id: string, src: string) {
	if (document.getElementById(id)) return;
	const script = document.createElement('script');
	script.id = id;
	script.async = true;
	script.src = src;
	document.head.appendChild(script);
}

function loadScripts(config: TagConfig) {
	if (scriptsLoaded) return;
	scriptsLoaded = true;
	if (config.gtm) {
		tagWindow().dataLayer!.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
		addScript('gtm-src', `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(config.gtm)}`);
	}
	if (config.ga4) addScript('ga4-src', `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.ga4)}`);
}

/**
 * Called once from the root layout on public pages. Sets the Consent Mode
 * defaults (all denied) before any tag can read them, then loads the tags
 * when consent allows and follows every later change of consent.
 */
export function initTags() {
	if (started || typeof window === 'undefined' || !isProdHost()) return;
	const config = tagConfig();
	if (!config.gtm && !config.ga4) return;
	started = true;
	if (config.gtm && config.ga4 && debugOn()) console.warn('[analytics] PUBLIC_GTM_ID and PUBLIC_GA4_ID are both set: events go to GTM only, and a GA4 tag inside GTM would count page views twice.');
	const w = tagWindow();
	w.dataLayer = w.dataLayer || [];
	// gtag.js reads its queue as `arguments` objects, so this must not be an arrow function.
	w.gtag = w.gtag || function gtag() {
		w.dataLayer!.push(arguments);
	};
	gtag('consent', 'default', { ...DENIED, functionality_storage: 'granted', security_storage: 'granted', wait_for_update: 500 });
	if (config.ga4) {
		// Queued now so it is read before any event; page views are sent by the layout.
		gtag('js', new Date());
		gtag('config', config.ga4, { send_page_view: false });
	}
	if (config.mode === 'advanced') {
		loadScripts(config);
		becomeReady();
	}
	// Accepted on this page, then withdrawn (via the footer's Cookie settings):
	// the tags already ran with full consent, and only a fresh page unloads them.
	let grantedHere = false;
	consent.subscribe((value: Consent) => {
		if (value === null) return;
		gtag('consent', 'update', value === 'granted' ? GRANTED : DENIED);
		if (value === 'granted') {
			grantedHere = true;
			loadScripts(config);
			becomeReady();
		} else {
			waiting.length = 0;
			if (grantedHere) window.location.reload();
		}
	});
}
