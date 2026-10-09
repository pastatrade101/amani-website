import { browser } from '$app/environment';
import { API_URL } from '$lib/admin/config/env';
import { getConsent } from '$lib/admin/consent';
import { captureVisit, safeCampaignValue, visitDetails } from '$lib/tracking/attribution';
import { sendToGoogle, pushEvent } from '$lib/tracking/data-layer';
import { debugOn, isProdHost } from '$lib/tracking/host';

// ----------------------------------------------------------------------------
// Analytics — one place for both layers.
//   1) Google: GTM's dataLayer or a direct gtag.js, whichever is configured
//      ($lib/tracking/data-layer), never both. Consent-gated + PII-free.
//   2) First-party backend: POST /api/analytics/events (fire-and-forget).
// Both send only from the live site ($lib/tracking/host): the dev server
// shares the production database, so its traffic must never be counted.
//
// Design rules:
//   • NEVER send names / emails / phones / WhatsApp numbers / trip notes / form
//     values anywhere — only the SAFE_KEYS whitelist below is ever forwarded.
//   • First-party keeps the site's own (custom) event names for continuity;
//     GA4 receives the GA4-recommended event name where one exists (see
//     GA4_EVENT_MAP) so GA4 reports & key-events use the standard vocabulary.
//   • Everything fails silently — blocked analytics must never break the site.
// ----------------------------------------------------------------------------

// First-party (custom) event names. Backward-compatible with existing reporting.
export type AnalyticsEventName =
  | 'page_view'
  | 'tour_page_view'
  | 'destination_page_view'
  | 'safari_style_view'
  | 'accommodation_view'
  | 'tour_list_view'
  | 'tour_card_click'
  | 'related_tour_click'
  | 'tour_filter_used'
  | 'search'
  | 'no_search_results'
  | 'plan_my_trip_opened'
  | 'plan_my_trip_submitted'
  | 'begin_journey_opened'
  | 'begin_journey_submitted'
  | 'request_trip_opened'
  | 'request_trip_submitted'
  | 'quotation_download'
  | 'form_submit_error'
  // Contextual enquiry forms (homepage / category / tour).
  | 'form_opened'
  | 'form_started'
  | 'form_step_completed'
  | 'form_validation_error'
  | 'form_abandoned'
  | 'form_submitted'
  | 'ai_advisor_opened'
  | 'ai_advisor_message_sent'
  | 'ai_advisor_lead_created'
  | 'cta_click'
  | 'whatsapp_click'
  | 'phone_click'
  | 'email_click';

// Forward these to gtag under their GA4-recommended name (GA4 only — the
// first-party layer still receives the original name for report continuity).
const GA4_EVENT_MAP: Partial<Record<AnalyticsEventName, string>> = {
  tour_page_view: 'view_item',
  destination_page_view: 'view_item',
  safari_style_view: 'view_item',
  accommodation_view: 'view_item',
  tour_list_view: 'view_item_list',
  tour_card_click: 'select_item',
  related_tour_click: 'select_item',
  tour_filter_used: 'filter_applied',
  plan_my_trip_submitted: 'generate_lead',
  begin_journey_submitted: 'generate_lead',
  request_trip_submitted: 'generate_lead',
  form_submitted: 'generate_lead'
  // page_view, search, and the whatsapp/phone/email/cta clicks keep their name.
};

// The ONLY keys ever forwarded to GA4 / the first-party backend. All non-PII.
const SAFE_KEYS = [
  'tour_id', 'tour_title', 'tour_name', 'destination', 'safari_style', 'experience_type',
  'accommodation_level', 'duration_days', 'price_from', 'currency', 'budget_range', 'traveller_type',
  'list_name', 'item_position', 'cta_name', 'cta_type', 'cta_location', 'page_section',
  'search_term', 'results_count', 'sort_option', 'filter_name', 'lead_type', 'transaction_id',
  'form_name', 'method', 'error_type', 'error_code',
  // Enquiry-form context. Deliberately no name, email, phone or free text —
  // SAFE_KEYS is the boundary that keeps contact details out of GA4.
  'form_type', 'step_index', 'step_key', 'field_name', 'category_id', 'category_name', 'tour_slug',
  // Lead and click context: a channel name, a place on the page, a path. Never the
  // K2A reference: it is stored with the traveller's contact details.
  'lead_source', 'form_location', 'link_url'
] as const;

type SafeKey = (typeof SAFE_KEYS)[number];

export type EventMeta = Partial<Record<SafeKey, string | number | null | undefined>> & {
  metadata?: Record<string, unknown>;
};

const SESSION_KEY = 'k2a_sid';

const getSessionId = (): string => {
  if (!browser) return '';
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
};

const deviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  if (!browser) return 'desktop';
  const ua = navigator.userAgent;
  const w = window.innerWidth;
  if (/Mobi|Android|iPhone/i.test(ua) || w < 640) return 'mobile';
  if (/iPad|Tablet/i.test(ua) || (w >= 640 && w < 1024)) return 'tablet';
  return 'desktop';
};

// A page URL without its query string, except the campaign tags (cleaned): GA4
// reads a visit's source from the landing page's utm/gclid, so dropping them
// would file paid and campaign traffic as direct. Other query params (search
// terms, ids) can carry personal data and never leave the page.
const PAGE_CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'srsltid'];
export const cleanLocation = (): string => {
  if (!browser) return '';
  const kept = new URLSearchParams();
  for (const key of PAGE_CAMPAIGN_KEYS) {
    const value = safeCampaignValue(key, new URLSearchParams(window.location.search).get(key));
    if (value) kept.set(key, value);
  }
  const query = kept.toString();
  return `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ''}`;
};

// Search terms are the one field a visitor could paste anything into — never
// forward one that looks like it might carry personal data (email/phone/very long).
const safeSearchTerm = (raw: string): string | undefined => {
  const s = (raw ?? '').trim();
  if (!s || s.length > 64) return undefined;
  if (/@|\d{7,}/.test(s)) return undefined; // looks like an email / phone
  return s.slice(0, 64);
};

// Collect only whitelisted, non-empty params.
const safeParams = (meta: EventMeta): Record<string, string | number> => {
  const out: Record<string, string | number> = {};
  for (const key of SAFE_KEYS) {
    const v = meta[key];
    if (v !== undefined && v !== null && v !== '') out[key] = v as string | number;
  }
  return out;
};

/** Extra Google-only parameters (campaign tags on a lead). Never personal data. */
export type GoogleExtras = Record<string, string | number | null | undefined>;

// Low-level emit: Google (recommended name + safe params) + first-party (own name).
const emit = (name: AnalyticsEventName, meta: EventMeta, google: GoogleExtras = {}): void => {
  if (!browser) return;
  if (getConsent() === 'denied') return; // explicit decline → nothing at all
  try {
    const params = safeParams(meta);

    // 1) Google: GTM or gtag.js (data-layer decides, and checks consent and host).
    const googleName = GA4_EVENT_MAP[name] ?? name;
    // A lead says which channel it came through, for the GA4 per-channel split.
    const lead = googleName === 'generate_lead' ? { lead_source: params.lead_source ?? params.lead_type } : {};
    sendToGoogle(googleName, { ...params, ...lead, ...google });

    if (debugOn()) console.info('[analytics] first-party', name, params);
    if (!isProdHost()) return;
    // 2) First-party backend — fire-and-forget, keepalive for unload safety.
    const payload: Record<string, unknown> = {
      event_name: name,
      session_id: getSessionId(),
      page_path: window.location.pathname,
      source_page_url: cleanLocation(),
      device_type: deviceType(),
      ...params
    };
    if (meta.metadata) payload.metadata = meta.metadata;
    void fetch(`${API_URL}/analytics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  } catch {
    // analytics must never throw
  }
};

/** Generic event helper (backward compatible). Prefer the typed helpers below. */
export const trackEvent = (eventName: AnalyticsEventName, meta: EventMeta = {}, google: GoogleExtras = {}): void => emit(eventName, meta, google);

// ── Page views ──────────────────────────────────────────────────────────────
// The Google tags are configured not to send their own page_view, so the root
// layout calls this on every navigation, the first page included: GTM gets
// virtual_page_view, a direct Google tag gets page_view. Deduped by clean path
// so the same URL never double-counts, and stripped of query params so no
// search/id ever leaks into Google.
let lastGooglePath = '';
let lastFirstPartyPath = '';

export const trackPageView = (): void => {
  if (!browser || getConsent() === 'denied') return;
  const path = window.location.pathname;
  const location = cleanLocation();
  try {
    if (path !== lastGooglePath) {
      lastGooglePath = path;
      // The referrer is reduced to its origin: a full URL may carry a query string.
      let referrer = '';
      try {
        referrer = document.referrer ? new URL(document.referrer).origin : '';
      } catch {
        referrer = '';
      }
      pushEvent('virtual_page_view', { page_location: location, page_path: path, page_title: document.title, page_referrer: referrer });
    }
    if (path !== lastFirstPartyPath && isProdHost()) {
      lastFirstPartyPath = path;
      void fetch(`${API_URL}/analytics/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'page_view',
          session_id: getSessionId(),
          page_path: path,
          source_page_url: location,
          device_type: deviceType()
        }),
        keepalive: true
      }).catch(() => {});
    }
  } catch {
    /* never throw */
  }
};

// ── Reusable CTA tracking ─────────────────────────────────────────────────────
export type CtaMeta = {
  cta_name: string; // e.g. "Book Now", "Request a Quote"
  cta_type?: string; // "button" | "link" | "whatsapp" | "phone" | "email"
  cta_location?: string; // "hero", "sticky_bar", "footer", "tour_detail"…
  page_section?: string;
} & Pick<EventMeta, 'tour_id' | 'tour_title' | 'destination'>;

/** Track any important CTA click through one place instead of per-button code. */
export const trackCta = (meta: CtaMeta): void =>
  emit('cta_click', { cta_type: 'button', ...meta });

// ── Search tracking ───────────────────────────────────────────────────────────
export type SearchMeta = {
  search_term?: string;
  results_count?: number;
  list_name?: string;
} & Pick<EventMeta, 'destination' | 'safari_style' | 'budget_range' | 'sort_option'>;

/** Fire on a *submitted / settled* search (never per keystroke). */
export const trackSearch = (meta: SearchMeta): void => {
  const term = meta.search_term ? safeSearchTerm(String(meta.search_term)) : undefined;
  const zero = meta.results_count === 0;
  emit(zero ? 'no_search_results' : 'search', { ...meta, search_term: term });
};

// ── Session attribution (Tier 2) ─────────────────────────────────────────────
// Campaign tags, click ids, landing path and referrer host are kept by
// $lib/tracking/attribution (this visit, and a first-touch copy after consent),
// so a lead submitted later still carries the source that brought the visitor.
// PII-free. Never throws.
const SESSION_SENT_KEY = 'k2a_session_sent';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

/** Visit attribution + session id, to attach to a lead. */
export const getAttribution = (): Record<string, string> => {
  const sid = getSessionId();
  return { ...(sid ? { session_id: sid } : {}), ...visitDetails() };
};

/** Record this landing, then fire the session beacon once per tab session. Never throws. */
export const trackSession = (): void => {
  if (!browser) return;
  const choice = getConsent();
  if (choice === 'denied') return;
  try {
    captureVisit(choice === 'granted');
    if (!isProdHost()) return;
    // Send at most once per tab session.
    if (sessionStorage.getItem(SESSION_SENT_KEY)) return;
    sessionStorage.setItem(SESSION_SENT_KEY, '1');

    const attr = visitDetails();
    const payload: Record<string, unknown> = {
      session_id: getSessionId(),
      device_type: deviceType(),
      landing_path: attr.landing || window.location.pathname,
      referrer: attr.referrer ?? null
    };
    for (const key of UTM_KEYS) if (attr[key]) payload[key] = attr[key];
    // A Google Ads click with no UTMs is still paid search.
    if (!payload.utm_source && (attr.gclid || attr.gbraid || attr.wbraid)) {
      payload.utm_source = 'google';
      payload.utm_medium = 'cpc';
    }

    void fetch(`${API_URL}/analytics/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  } catch {
    // analytics must never throw
  }
};
