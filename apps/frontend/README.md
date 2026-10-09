# Key2africa Safaris frontend

SvelteKit with TypeScript, Svelte 5, Tailwind CSS 4, shadcn-svelte, and the Node adapter. The start page adapts the supplied Tanzania safari UI and local photo assets to the existing Express API.

See the [root README](../../README.md) for commands and environment setup, and the [integration guide](../../docs/frontend-integration.md) for endpoint and field mappings.

Run `npm run dev:frontend` from the repository root. Backend credentials stay in `apps/backend/.env`; the private frontend `API_BASE_URL` points to the API. The reference assets keep the page available while the database is unconfigured. Actual tour inventory and enquiry storage require a working API/database.

## Plan my trip

`/plan-my-trip` is a seven-step trip planner (`src/routes/plan-my-trip`, logic in `src/lib/planner`). Its options come from the published tours, stays, categories, activities and seasons. A sent plan goes through the same enquiry pipeline as the enquiry form (`POST /api/contact`): it lands in **CMS → Messages** with the reference (`K2A-…`) in the subject and the answers in the message. "Plan my safari" buttons link to it with `planHref()` (`src/lib/planner/plan-href.ts`), which only ever puts catalogue slugs and the link's place (`from`) in the address.

## Google Tag Manager / GA4

Add `PUBLIC_GTM_ID=GTM-XXXXXXX` (no quotes) to the web container's env file in `~/app/config` and restart the web container. No rebuild is needed. Leave `PUBLIC_GA4_ID` empty when GA4 is set up inside GTM. Tags run only on the live domain, and only after the visitor clicks Accept (`PUBLIC_CONSENT_MODE=advanced` loads them earlier, in cookieless mode). Consent Mode v2 defaults (all denied) are set before any tag loads, and Accept/Decline sends the update. Events wait in the page until then (until Accept in basic mode), so nothing reaches Google without consent. Visitors can change their choice with **Cookie settings** in the footer.

In GTM:

1. Google tag with the GA4 ID, `send_page_view=false`, trigger *Initialization – All Pages*.
2. GA4 Event `page_view` on Custom Event `virtual_page_view` (parameters `page_location`, `page_path`, `page_title`, `page_referrer`).
3. GA4 Event named `{{Event}}` on Custom Event regex `^(generate_lead|form_.*|cta_click|whatsapp_click|phone_click|email_click|view_item|select_item|view_item_list|filter_applied|search)$`, with Data Layer variables for the parameters.
4. Google Ads Conversion on `generate_lead`, Transaction ID `{{DLV transaction_id}}` (a random id per lead, never the K2A reference), plus a Conversion Linker on All Pages.
5. In GA4, register `lead_source`, `form_name`, `step_key` and `cta_location` as custom dimensions and mark `generate_lead` as a key event.
6. In GA4 → Admin → Data streams → Enhanced measurement, turn **off** "Page changes based on browser history events" (the site sends `virtual_page_view` itself, so leaving it on counts every page twice) and "Site search".

Events (`src/lib/tracking`, `src/lib/admin/analytics.ts`), none with personal data:

| Event | Parameters |
|---|---|
| `virtual_page_view` | `page_location` (query string dropped except cleaned `utm_*`, `gclid`, `gbraid`, `wbraid`, `srsltid`, so GA4 keeps the visit's source), `page_path`, `page_title`, `page_referrer` (origin only) |
| `form_opened`, `form_started` | `form_name: plan_my_trip`, `form_type: trip_planner` |
| `form_step_completed`, `form_abandoned` | `step_index`, `step_key` |
| `form_validation_error` | `step_key`, `field_name`, `error_type` |
| `form_submit_error` | `error_type`: `server_validation`, `rate_limited` or `submit_failed` |
| `generate_lead` | `lead_source` (`plan_my_trip` or `enquiry_form`), `form_name`, `transaction_id`, `traveller_type`, `duration_days`, `budget_range`, `experience_type`, `accommodation_level`, `destination`, `travel_date`, `cta_clicked`, `utm_*`, `gclid`, `gbraid`, `wbraid` |
| `cta_click` | `cta_name`, `cta_location`, `cta_type`, `link_url` (path only) |
| `whatsapp_click`, `phone_click`, `email_click` | `cta_location`, `method` |

To check: set `localStorage.k2a_analytics_debug='1'` (events are logged to the console on any host; nothing is sent from localhost), then use GTM Preview on the live site.

If a Content Security Policy is added later, allow `www.googletagmanager.com`, `*.google-analytics.com`, `www.googleadservices.com` and `googleads.g.doubleclick.net` in `script-src`; `*.google-analytics.com`, `*.analytics.google.com`, `www.googletagmanager.com` and `www.google.com` in `connect-src` and `img-src`; and `www.googletagmanager.com` in `frame-src`.
