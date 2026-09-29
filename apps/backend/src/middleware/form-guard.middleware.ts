import type { NextFunction, Request, Response } from 'express';
import { isTurnstileConfigured, verifyTurnstile } from '../services/turnstile.service';
import { sendError } from '../utils/api-response';

/**
 * Challenge a form submission only once it starts looking like abuse.
 *
 * A CAPTCHA on every enquiry costs conversions from the people we want, and
 * stops the people we don't only briefly. So the first couple of submissions
 * from an address pass untouched; beyond that — a rate no real traveller
 * reaches, but a script does immediately — a Turnstile token is required.
 *
 * If Turnstile is not configured this never blocks anything. That is
 * deliberate: shipping this must not take the forms offline while keys are
 * still being set up. Honeypot, rate limiting and the idempotency key are all
 * still in force in that state.
 */

const WINDOW_MS = 10 * 60 * 1000;
/**
 * Submissions allowed from one address before a challenge is required. Set
 * above what a genuinely interested traveller does — enquiring about two or
 * three trips in one sitting is normal — and far below what a script does.
 */
const FREE_SUBMISSIONS = 3;
/** Bound the map so a flood cannot grow it without limit. */
const MAX_TRACKED = 5000;

const recent = new Map<string, number[]>();

const prune = (now: number) => {
  for (const [key, times] of recent) {
    const live = times.filter((time) => now - time < WINDOW_MS);
    if (live.length) recent.set(key, live);
    else recent.delete(key);
  }
};

const addressOf = (req: Request): string => req.ip ?? req.socket.remoteAddress ?? 'unknown';

/** Exported for tests: how many recent submissions this address has made. */
export const recentCount = (address: string, now = Date.now()): number =>
  (recent.get(address) ?? []).filter((time) => now - time < WINDOW_MS).length;

export const noteSubmission = (address: string, now = Date.now()): void => {
  if (recent.size > MAX_TRACKED) prune(now);
  const times = (recent.get(address) ?? []).filter((time) => now - time < WINDOW_MS);
  times.push(now);
  recent.set(address, times);
};

/** Test seam. */
export const __resetFormGuard = () => recent.clear();

export const formGuard = (req: Request, res: Response, next: NextFunction): void => {
  void (async () => {
    // Admin-authenticated submissions are never challenged.
    if (req.user) {
      next();
      return;
    }

    const address = addressOf(req);
    const now = Date.now();
    const seen = recentCount(address, now);

    // Record this attempt regardless of the outcome, so a bot that fails the
    // challenge still climbs its own counter.
    noteSubmission(address, now);

    if (seen < FREE_SUBMISSIONS || !isTurnstileConfigured()) {
      next();
      return;
    }

    const token = String((req.body as Record<string, unknown> | undefined)?.captcha_token ?? '');
    const ok = await verifyTurnstile(token, address);

    if (ok) {
      next();
      return;
    }

    sendError(res, 'Please complete the verification to send your request.', [{ code: 'captcha_required' }], 428);
  })();
};
