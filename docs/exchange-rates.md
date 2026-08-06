# Exchange-Rate Pricing

All package, lodge, activity, destination-budget, and departure prices are stored in USD. Visitor currency selection is a display conversion only.

## Provider

The backend uses Open Exchange Rates `latest.json` with USD as the base currency and a limited `symbols` list.

The default symbols are:

`USD,EUR,GBP,TZS,KES,ZAR,AUD,CAD`

Admins can manage the supported display currencies in CMS Settings → Currencies. Each row must include code, name, symbol, Intl locale, decimal digits, and enabled state. USD must remain present and enabled because all source prices are stored in USD.

After adding or enabling a new currency, run a manual refresh from Admin → Exchange Rates or wait for the next scheduled refresh. Until a successful snapshot includes that currency, it will be listed but unavailable in the public selector.

The App ID is read from `OPEN_EXCHANGE_RATES_APP_ID` on the backend only. It is never returned by an API endpoint and never used in Svelte/browser code.

## Caching

Successful snapshots are inserted into `exchange_rate_snapshots`; previous snapshots are kept for audit/debugging. Failed refreshes are logged as failed rows without replacing the latest successful snapshot.

If the provider is unavailable, the platform keeps serving the latest successful snapshot. If no successful snapshot exists, the public currency API returns USD-only rates so public prices remain valid and no fake rates are invented.

## Scheduler

`startExchangeRateScheduler()` runs inside the Express process when `EXCHANGE_RATE_REFRESH_ENABLED=true`.

Default schedule:

`EXCHANGE_RATE_REFRESH_CRON=0 6,18 * * *`

Timezone:

`EXCHANGE_RATE_TIMEZONE=Africa/Dar_es_Salaam`

Refreshes acquire `exchange_rate_locks` through database RPC functions so only one backend instance calls Open Exchange Rates.

## Markup

`EXCHANGE_RATE_MARKUP_PERCENT` defaults to `0`. Markup is applied only when converting displayed USD prices. Provider rates are stored unchanged.

## APIs

Public:

`GET /api/currencies`

Returns supported currencies, cached rates, timestamps, stale state, markup, and next refresh. It does not return database IDs, provider credentials, provider URL, or internal error traces.

Admin:

`GET /api/internal/exchange-rates`

`POST /api/internal/exchange-rates/refresh`

Both require existing admin authentication and exchange-rate permissions. Manual refresh is rate-limited.

## Frontend

`src/lib/currency.ts` is the single currency store. It persists anonymous selection in `localStorage` and a same-site cookie, falls back to browser locale where possible, then USD.

Components call `formatUsd()` for display. No page reload is required when switching currency.
