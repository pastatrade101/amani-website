import rateLimit from 'express-rate-limit';

const tooMany = {
  success: false,
  message: 'Too many submissions. Please try again later.',
  errors: []
};

/**
 * Two layers rather than one, because a single hourly cap has to choose between
 * stopping a bot and serving a shared IP.
 *
 * The burst limiter is the anti-bot one: nothing legitimate submits five
 * enquiries in two minutes. The hourly limiter is the backstop, and is set high
 * enough that an office, hotel or conference behind one NAT'd address can all
 * enquire — which the previous five-an-hour cap made impossible. Double-taps
 * are not this layer's job at all; the idempotency key handles those without
 * spending any budget.
 */
export const publicFormBurstLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany
});

export const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany
});

// Trip portal: throttle token exchange (slows brute force, though 256-bit
// tokens are unguessable) and traveller messages (anti-spam) per IP.
export const tripAccessLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please wait a few minutes and try again.', errors: [] }
});

// Analytics events fire far more often than form posts (clicks, opens), so this
// limiter is generous per-IP but still caps abusive flooding.
export const analyticsEventLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many events.', errors: [] }
});

export const exchangeRateRefreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 4,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many manual refresh attempts. Please wait and try again.', errors: [] }
});
