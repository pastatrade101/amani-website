import { createSubscriber } from 'svelte/reactivity';

/**
 * The visitor's display currency. Every price is stored in US dollars; the API
 * (`/api/currencies`) serves the rates it fetched from Open Exchange Rates, and
 * prices are converted for display only, so enquiries and bookings stay in USD.
 *
 * A plain module rather than runes, so `formatPrice` can read it anywhere (and
 * in node tests): `createSubscriber` makes a template that formats a price
 * re-render when the currency changes, and does nothing on the server, where
 * every page renders in US dollars.
 */

export type CurrencyOption = { code: string; name: string; symbol: string; locale: string; decimalDigits: number; enabled: boolean; available?: boolean };
type ApiState = { supportedCurrencies?: CurrencyOption[]; rates?: Record<string, string>; markupPercent?: number; lastUpdated?: string | null; status?: string };
type State = { options: CurrencyOption[]; rates: Record<string, string>; markup: number; updated: string | null; selected: string };

const USD: CurrencyOption = { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US', decimalDigits: 2, enabled: true, available: true };
const CHOICE_KEY = 'k2a.currency';
const CACHE_KEY = 'k2a.currency.rates.v1';
const CODE = /^[A-Z]{3}$/;
const REFRESH_MS = 10 * 60 * 1000;

let state: State = { options: [USD], rates: { USD: '1' }, markup: 0, updated: null, selected: 'USD' };
let notify: (() => void) | null = null;
const track = createSubscriber((update) => {
	notify = update;
	return () => { notify = null; };
});
const commit = (next: Partial<State>) => {
	state = { ...state, ...next };
	notify?.();
};

const storage = () => {
	try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
};
const normal = (code: unknown) => String(code ?? '').trim().toUpperCase();
const rateOf = (code: string, rates = state.rates) => {
	const rate = Number(code === 'USD' ? 1 : rates[code]);
	return Number.isFinite(rate) && rate > 0 ? rate : null;
};
const usable = (code: string, next: Pick<State, 'options' | 'rates'> = state) =>
	CODE.test(code) && next.options.some((item) => item.code === code && item.enabled) && rateOf(code, next.rates) !== null;

/** The currencies a visitor can pick right now: enabled, with a rate. */
export function currencyChoices(): CurrencyOption[] {
	track();
	return state.options.filter((item) => usable(item.code));
}

export function selectedCurrency(): string {
	track();
	return state.selected;
}

/** "1 USD ≈ 2,610 TZS", or '' while showing dollars. */
export function rateLine(): string {
	track();
	const rate = rateOf(state.selected);
	if (state.selected === 'USD' || !rate) return '';
	const digits = rate >= 100 ? 0 : rate >= 1 ? 2 : 4;
	return `1 USD ≈ ${rate.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${state.selected}`;
}

/** When the rates were fetched, for the picker's footnote. */
export function ratesUpdated(): string | null {
	track();
	return state.updated;
}

const formatters = new Map<string, Intl.NumberFormat>();
const formatter = (code: string) => {
	let format = formatters.get(code);
	if (!format) {
		format = new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: 'symbol', maximumFractionDigits: 0 });
		formatters.set(code, format);
	}
	return format;
};

/**
 * A US-dollar amount in the visitor's currency, or null while that is dollars
 * (or the amount is in another currency, or there is no rate): callers then
 * show the stored price as it is.
 */
export function convertedPrice(amount: number, from = 'USD'): { code: string; amount: number; text: string } | null {
	track();
	const code = state.selected;
	if (code === 'USD' || normal(from) !== 'USD' || !Number.isFinite(amount)) return null;
	const rate = rateOf(code);
	if (!rate) return null;
	const value = Math.round(amount * rate * (1 + state.markup / 100));
	try {
		return { code, amount: value, text: formatter(code).format(value) };
	} catch {
		return { code, amount: value, text: `${code} ${value.toLocaleString('en-US')}` };
	}
}

// Region → currency, for a first visit with nothing saved.
const REGION: Record<string, string> = { TZ: 'TZS', KE: 'KES', ZA: 'ZAR', GB: 'GBP', AU: 'AUD', CA: 'CAD', US: 'USD' };
const EURO = new Set(['AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK']);
const regionCurrency = () => {
	if (typeof navigator === 'undefined') return '';
	for (const locale of navigator.languages ?? [navigator.language]) {
		const region = locale.split('-')[1]?.toUpperCase();
		if (!region) continue;
		if (REGION[region]) return REGION[region];
		if (EURO.has(region)) return 'EUR';
	}
	return '';
};

const apply = (data: ApiState) => {
	const options = (data.supportedCurrencies ?? []).filter((item) => item && CODE.test(normal(item.code))).map((item) => ({ ...item, code: normal(item.code) }));
	const next = {
		options: options.some((item) => item.code === 'USD') ? options : [USD, ...options],
		rates: { USD: '1', ...(data.rates ?? {}) },
		markup: Number.isFinite(Number(data.markupPercent)) ? Number(data.markupPercent) : 0,
		updated: data.lastUpdated ?? null
	};
	// A saved pick beats the visitor's region, which beats dollars.
	const saved = normal(storage()?.getItem(CHOICE_KEY));
	const selected = [saved, saved ? '' : regionCurrency(), 'USD'].find((code) => code && usable(code, next)) ?? 'USD';
	commit({ ...next, selected });
};

let loading: Promise<void> | null = null;
let loadedAt = 0;

/** Start in the browser after the page has hydrated in dollars. */
export function initCurrency(): Promise<void> {
	if (typeof window === 'undefined') return Promise.resolve();
	if (loading) return loading;
	if (Date.now() - loadedAt < REFRESH_MS) return Promise.resolve();
	try {
		const cached = JSON.parse(storage()?.getItem(CACHE_KEY) || 'null') as ApiState | null;
		if (cached?.supportedCurrencies && cached.rates) apply(cached);
	} catch { /* a bad cache is ignored */ }
	loading = fetch('/api/currencies', { headers: { accept: 'application/json' } })
		.then((response) => (response.ok ? response.json() : null))
		.then((body: { data?: ApiState } | null) => {
			if (!body?.data) return;
			apply(body.data);
			loadedAt = Date.now();
			try { storage()?.setItem(CACHE_KEY, JSON.stringify(body.data)); } catch { /* storage full or blocked */ }
		})
		.catch(() => { /* keep whatever is showing; prices fall back to dollars */ })
		.finally(() => { loading = null; });
	return loading;
}

export function setCurrency(code: string) {
	const next = normal(code);
	if (!usable(next)) return;
	try { storage()?.setItem(CHOICE_KEY, next); } catch { /* private mode */ }
	commit({ selected: next });
}
