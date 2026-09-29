import { browser } from '$app/environment';
import BigNumber from 'bignumber.js';
import { get, writable } from 'svelte/store';
import { api } from '$lib/admin/api/client';
import type { CurrencyApiState, CurrencyConfig } from '$lib/admin/types';

const STORAGE_KEY = 'goldfinch_selected_currency';
const COOKIE_KEY = 'gf_currency';
const CACHE_KEY = 'goldfinch_currency_state';

const USD: CurrencyConfig = {
  code: 'USD',
  name: 'US Dollar',
  symbol: '$',
  locale: 'en-US',
  decimalDigits: 2,
  enabled: true,
  available: true
};

export type CurrencyStoreState = CurrencyApiState & {
  selectedCurrency: string;
  loading: boolean;
  error: string;
};

const initialState: CurrencyStoreState = {
  provider: 'open_exchange_rates',
  baseCurrency: 'USD',
  supportedCurrencies: [USD],
  rates: { USD: '1' },
  lastUpdated: null,
  providerTimestamp: null,
  expiresAt: null,
  nextRefresh: null,
  isStale: true,
  status: 'missing',
  markupPercent: 0,
  selectedCurrency: 'USD',
  loading: false,
  error: ''
};

export const currency = writable<CurrencyStoreState>(initialState);

const formatterCache = new Map<string, Intl.NumberFormat>();
let initPromise: Promise<void> | null = null;
let loadedOnce = false;
let lastLoadedAt = 0;
const CLIENT_REFRESH_MS = 10 * 60 * 1000;

const normalize = (code?: string | null) => String(code ?? '').trim().toUpperCase();

const readCookie = () => {
  if (!browser) return '';
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
};

const persist = (code: string) => {
  if (!browser) return;
  localStorage.setItem(STORAGE_KEY, code);
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(code)};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
};

const persistedCurrency = () => {
  if (!browser) return '';
  return normalize(localStorage.getItem(STORAGE_KEY)) || normalize(readCookie());
};

const readCachedCurrencyState = () => {
  if (!browser) return null;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as CurrencyApiState | null;
    if (!cached || !Array.isArray(cached.supportedCurrencies) || !cached.rates || typeof cached.rates !== 'object') return null;
    return cached;
  } catch {
    return null;
  }
};

const persistCurrencyState = (state: CurrencyApiState) => {
  if (!browser) return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(state));
};

const browserCurrency = () => {
  if (!browser) return '';
  const regions: Record<string, string> = {
    TZ: 'TZS',
    KE: 'KES',
    ZA: 'ZAR',
    GB: 'GBP',
    AU: 'AUD',
    CA: 'CAD',
    US: 'USD'
  };
  const euroRegions = new Set(['AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK']);
  for (const locale of navigator.languages ?? [navigator.language]) {
    const region = locale.split('-')[1]?.toUpperCase();
    if (!region) continue;
    if (regions[region]) return regions[region];
    if (euroRegions.has(region)) return 'EUR';
  }
  return '';
};

const isAvailable = (code: string, state: Pick<CurrencyStoreState, 'supportedCurrencies' | 'rates'>) => {
  const normalized = normalize(code);
  const config = state.supportedCurrencies.find((item) => item.code === normalized);
  return Boolean(config?.enabled && (normalized === 'USD' || state.rates[normalized]));
};

// Empty until the visitor actually picks a currency this session. The store starts
// on 'USD' as a placeholder, and USD is always available — so passing that value in
// as "the previous choice" made it win the candidate list every time, which both
// discarded the saved preference on reload and suppressed region detection for
// first-time visitors.
let explicitSelection = '';

// Order matters: a stored pick beats an in-session pick (setCurrency writes to
// localStorage synchronously, so storage is never staler), an in-session pick beats
// region detection, and detection beats the USD fallback. `explicitSelection` covers
// the case where storage is unavailable, e.g. private browsing.
const chooseCurrency = (state: CurrencyStoreState) => {
  const candidates = [persistedCurrency(), explicitSelection, browserCurrency(), 'USD'];
  for (const candidate of candidates) {
    const code = normalize(candidate);
    if (code && isAvailable(code, state)) return code;
  }
  return 'USD';
};

const hydrateCurrencyState = () => {
  const cached = readCachedCurrencyState();
  if (cached) {
    const nextState: CurrencyStoreState = {
      ...initialState,
      ...cached,
      selectedCurrency: 'USD',
      loading: true,
      error: ''
    };
    nextState.selectedCurrency = chooseCurrency(nextState);
    currency.set(nextState);
    return;
  }

  // With no cached state the only known config is USD, so a saved non-USD code
  // cannot be validated or formatted yet. Leave the selection alone; initCurrency
  // restores it as soon as the real currency list arrives.
};

const formatter = (config: CurrencyConfig) => {
  const key = `${config.locale}:${config.code}:${config.decimalDigits}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;
  const next = new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.code,
    minimumFractionDigits: config.decimalDigits,
    maximumFractionDigits: config.decimalDigits
  });
  formatterCache.set(key, next);
  return next;
};

export const initCurrency = async (options: { force?: boolean } = {}) => {
  if (!browser) return;
  const state = get(currency);
  const recentlyLoaded = loadedOnce && Date.now() - lastLoadedAt < CLIENT_REFRESH_MS;
  if (!options.force && recentlyLoaded && state.status !== 'missing') return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    hydrateCurrencyState();
    currency.update((state) => ({ ...state, loading: true, error: '' }));
    try {
      const response = await api.currencies.get();
      const nextState: CurrencyStoreState = {
        ...initialState,
        ...response.data,
        selectedCurrency: 'USD',
        loading: false,
        error: ''
      };
      nextState.selectedCurrency = chooseCurrency(nextState);
      persist(nextState.selectedCurrency);
      persistCurrencyState(response.data);
      currency.set(nextState);
      loadedOnce = true;
      lastLoadedAt = Date.now();
    } catch (error) {
      currency.update((state) => ({
        ...state,
        selectedCurrency: isAvailable(state.selectedCurrency, state) ? state.selectedCurrency : 'USD',
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to load currencies.'
      }));
    } finally {
      initPromise = null;
    }
  })();
  return initPromise;
};

export const setCurrency = (code: string) => {
  const normalized = normalize(code);
  currency.update((state) => {
    if (!isAvailable(normalized, state)) return state;
    explicitSelection = normalized;
    persist(normalized);
    return { ...state, selectedCurrency: normalized };
  });
};

export const convertUsd = (amountUsd: string | number | null | undefined, state = get(currency), targetCurrency = state.selectedCurrency) => {
  if (amountUsd === null || amountUsd === undefined || amountUsd === '') return null;
  const config = state.supportedCurrencies.find((item) => item.code === targetCurrency) ?? USD;
  const rateRaw = targetCurrency === 'USD' ? '1' : state.rates[targetCurrency];
  const amount = new BigNumber(amountUsd);
  const rate = new BigNumber(rateRaw ?? Number.NaN);
  if (!amount.isFinite() || !rate.isFinite() || !rate.gt(0)) return null;
  const markup = new BigNumber(1).plus(new BigNumber(state.markupPercent || 0).div(100));
  return amount.times(rate).times(markup).decimalPlaces(config.decimalDigits, BigNumber.ROUND_HALF_UP);
};

export const formatAmount = (amount: BigNumber | string | number, currencyCode: string, state = get(currency)) => {
  const config = state.supportedCurrencies.find((item) => item.code === currencyCode) ?? USD;
  const value = new BigNumber(amount).decimalPlaces(config.decimalDigits, BigNumber.ROUND_HALF_UP);
  return formatter(config).format(value.toNumber());
};

export const formatUsd = (amountUsd: string | number | null | undefined, state = get(currency), targetCurrency = state.selectedCurrency) => {
  const converted = convertUsd(amountUsd, state, targetCurrency);
  if (!converted) return '';
  return formatAmount(converted, targetCurrency, state);
};

export const selectedCurrencyMeta = (state = get(currency)) =>
  state.supportedCurrencies.find((item) => item.code === state.selectedCurrency) ?? USD;
