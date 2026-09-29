import { browser } from '$app/environment';
import { API_URL } from '$lib/admin/config/env';
import { getConsent } from '$lib/admin/consent';

// ----------------------------------------------------------------------------
// Analytics — one place for both layers.
//   1) GA4 (gtag): fires window.gtag if present. Consent-gated + PII-free.
//   2) First-party backend: POST /api/analytics/events (fire-and-forget).
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
  'form_type', 'step_index', 'step_key', 'field_name', 'category_id', 'category_name', 'tour_slug'
] as const;

type SafeKey = (typeof SAFE_KEYS)[number];

export type EventMeta = Partial<Record<SafeKey, string | number | null | undefined>> & {
  metadata?: Record<string, unknown>;
};

const SESSION_KEY = 'gf_sid';

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

const hasGtag = (): ((...args: unknown[]) => void) | null => {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  return typeof w.gtag === 'function' ? w.gtag : null;
};

// A page URL with the query string dropped — the site never puts PII in the
// path, but query params (search terms, ids) can, so GA4/first-party only ever
// see the clean pathname. Campaign (utm/gclid) attribution is captured by GA4
// from the initial landing URL, so nothing is lost by stripping it here.
export const cleanLocation = (): string => {
  if (!browser) return '';
  return `${window.location.origin}${window.location.pathname}`;
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

// Low-level emit: GA4 (recommended name + safe params) + first-party (own name).
const emit = (name: AnalyticsEventName, meta: EventMeta): void => {
  if (!browser) return;
  if (getConsent() === 'denied') return; // explicit decline → nothing at all
  try {
    const params = safeParams(meta);

    // 1) GA4 — only when gtag is loaded (which only happens after 'granted').
    const gtag = hasGtag();
    if (gtag) gtag('event', GA4_EVENT_MAP[name] ?? name, params);

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
export const trackEvent = (eventName: AnalyticsEventName, meta: EventMeta = {}): void => emit(eventName, meta);

// ── Page views ──────────────────────────────────────────────────────────────
// GA4's config sends the initial page_view; for SPA route changes we must send
// it ourselves. Deduped by clean path so the same URL never double-counts, and
// stripped of query params so no search/id ever leaks into GA4.
let lastGa4Path = '';
let lastFirstPartyPath = '';

export const trackPageView = (): void => {
  if (!browser || getConsent() === 'denied') return;
  const path = window.location.pathname;
  const location = cleanLocation();
  try {
    const gtag = hasGtag();
    if (gtag && path !== lastGa4Path) {
      lastGa4Path = path;
      gtag('event', 'page_view', {
        page_path: path,
        page_location: location,
        page_title: document.title,
        page_referrer: document.referrer || undefined
      });
    }
    if (path !== lastFirstPartyPath) {
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
// First-touch: on the first visit we capture UTM + external referrer and persist
// them (localStorage), so a lead submitted later still carries the source that
// brought the visitor. PII-free. Never throws.
const ATTR_KEY = 'gf_attr';
const SESSION_SENT_KEY = 'gf_session_sent';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

const captureAttribution = (): Record<string, string> => {
  const out: Record<string, string> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    for (const key of UTM_KEYS) {
      const v = params.get(key);
      if (v) out[key] = v.slice(0, 200);
    }
    const ref = document.referrer;
    if (ref) {
      try {
        if (new URL(ref).host !== window.location.host) out.referrer = ref.slice(0, 500);
      } catch {
        /* malformed referrer — ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return out;
};

const storedAttribution = (): Record<string, string> => {
  if (!browser) return {};
  try {
    return JSON.parse(localStorage.getItem(ATTR_KEY) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
};

/** First-touch attribution + session id, to attach to a lead's lead_context. */
export const getAttribution = (): Record<string, string> => {
  const sid = getSessionId();
  return { ...(sid ? { session_id: sid } : {}), ...storedAttribution() };
};

/** Fire the session attribution beacon once per browser session. Never throws. */
export const trackSession = (): void => {
  if (!browser) return;
  if (getConsent() === 'denied') return;
  try {
    // First-touch: only persist attribution the first time we ever see this browser.
    if (localStorage.getItem(ATTR_KEY) === null) {
      localStorage.setItem(ATTR_KEY, JSON.stringify(captureAttribution()));
    }
    // Send at most once per tab session.
    if (sessionStorage.getItem(SESSION_SENT_KEY)) return;
    sessionStorage.setItem(SESSION_SENT_KEY, '1');

    const attr = storedAttribution();
    const payload: Record<string, unknown> = {
      session_id: getSessionId(),
      device_type: deviceType(),
      landing_path: window.location.pathname,
      referrer: attr.referrer ?? null
    };
    for (const key of UTM_KEYS) if (attr[key]) payload[key] = attr[key];

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
