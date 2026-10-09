import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Analytics/cookie consent, set by the public cookie banner. 'granted' = Google
// tags + first-party tracking on; 'denied' = everything off; null = undecided
// (first-party anonymous tracking runs under legitimate interest, but Google
// tags wait for an explicit 'granted'). $lib/tracking/tags follows the store and
// sends Google's Consent Mode update when it changes.
export type Consent = 'granted' | 'denied' | null;

const KEY = 'k2a_consent';
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

/** Ask again (the footer's "Cookie settings"): forget the choice so the banner returns. */
export const resetConsent = () => {
  if (browser) {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* storage unavailable */
    }
    document.cookie = `${KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
  consent.set(null);
};
