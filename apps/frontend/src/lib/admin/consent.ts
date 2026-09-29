import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Analytics/cookie consent. 'granted' = GA4 + first-party tracking on;
// 'denied' = everything off; null = undecided (first-party anonymous tracking
// runs under legitimate interest, but GA4 cookies wait for an explicit 'granted').
export type Consent = 'granted' | 'denied' | null;

const KEY = 'gf_consent';
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days

const valid = (value: string | null | undefined): Consent =>
  value === 'granted' || value === 'denied' ? value : null;

const readCookie = (): Consent => {
  if (!browser) return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${KEY}=([^;]*)`));
  return valid(match ? decodeURIComponent(match[1]) : null);
};

const read = (): Consent => {
  if (!browser) return null;
  try {
    return valid(localStorage.getItem(KEY)) ?? readCookie();
  } catch {
    return readCookie();
  }
};

export const consent = writable<Consent>(read());

export const getConsent = (): Consent => read();

export const setConsent = (value: 'granted' | 'denied') => {
  if (browser) {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* storage unavailable — still applies in-session */
    }
    document.cookie = `${KEY}=${encodeURIComponent(value)}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax`;
  }
  consent.set(value);
};
