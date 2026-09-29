import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { sendSuccess } from '../utils/api-response';
import { supabase } from '../config/supabase';
import { rollUpPaymentStatus } from '../services/payment-rollup.service';

/**
 * Payment events arriving from Makutano Connect.
 *
 * Connect collects the money; this site shows it. The traveller's own trip page
 * prints their payment status, what they have paid and what is left — so with
 * no way back from Connect, someone who has paid opens their page and is told
 * they have not. That is what this endpoint exists to prevent.
 *
 * It records what Connect says already happened. Nothing here moves money,
 * charges anyone, or tells Connect to.
 *
 * Two rules shape everything below:
 *
 *   It fails closed. No signing secret, a bad signature, a stale timestamp —
 *   all rejected. This writes to payment records, so an unauthenticated version
 *   of it would be an open door onto exactly the rows worth forging.
 *
 *   It is idempotent. Retries, redeliveries after a timeout and replayed
 *   batches are all normal webhook traffic; a handler that is not idempotent
 *   eventually counts the same money twice.
 */

const secret = (): string => process.env.CONNECT_WEBHOOK_SECRET ?? '';

/** How far out of date a signed request may be. */
const MAX_SKEW_MS = 5 * 60 * 1000;

/**
 * HMAC-SHA256 over the exact bytes Connect sent, timestamp prefixed so a
 * captured body cannot be replayed indefinitely. Compared timing-safely, so the
 * comparison cannot leak the expected value a byte at a time.
 *
 * Signed as `<timestamp>.<raw body>`, which is the shape Connect's own
 * WhatsApp-side signing already uses.
 */
const signatureValid = (req: Request): { ok: boolean; reason?: string } => {
  const key = secret();
  if (!key) return { ok: false, reason: 'no signing secret configured' };

  const header = req.get('x-connect-signature');
  const timestamp = req.get('x-connect-timestamp');
  if (!header || !timestamp) return { ok: false, reason: 'missing signature headers' };

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) return { ok: false, reason: 'unreadable timestamp' };
  // Milliseconds or seconds, whichever Connect sends.
  const sentMs = sentAt > 1e12 ? sentAt : sentAt * 1000;
  if (Math.abs(Date.now() - sentMs) > MAX_SKEW_MS) return { ok: false, reason: 'timestamp outside the accepted window' };

  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!raw?.length) return { ok: false, reason: 'no raw body captured' };

  const expected = createHmac('sha256', key).update(`${timestamp}.`).update(raw).digest('hex');
  const received = header.startsWith('sha256=') ? header.slice('sha256='.length) : header;

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  if (a.length !== b.length) return { ok: false, reason: 'signature mismatch' };
  return timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: 'signature mismatch' };
};

type ConnectEvent = {
  id?: string;
  event?: string;
  type?: string;
  occurred_at?: string;
  data?: Record<string, unknown>;
};

/** Map Connect's payment vocabulary onto this codebase's. */
const PAYMENT_STATE: Record<string, 'paid' | 'refunded' | 'failed'> = {
  'payment.received': 'paid',
  'payment.succeeded': 'paid',
  'payment.refunded': 'refunded',
  'payment.failed': 'failed'
};

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const text = (value: unknown, max = 200): string | null => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw ? raw.slice(0, max) : null;
};

/**
 * Record the event, whatever came of it.
 *
 * Written for every accepted delivery — applied, ignored or unmatched — because
 * the question this answers later is "did their payment ever reach us", and
 * that is unanswerable if the only evidence is a row that may not exist.
 */
const logEvent = async (row: {
  eventId: string;
  eventType: string;
  reference: string | null;
  bookingId: string | null;
  payload: unknown;
  status: 'applied' | 'ignored' | 'unmatched' | 'failed';
  detail?: string;
}) => {
  const { error } = await supabase.from('connect_webhook_events').insert({
    event_id: row.eventId,
    event_type: row.eventType,
    external_reference: row.reference,
    booking_request_id: row.bookingId,
    payload: row.payload,
    status: row.status,
    detail: row.detail ?? null
  });
  // 23505 = this event id is already logged, which is a replay and not a
  // problem. Anything else is worth seeing but must not fail the request.
  if (error && error.code !== '23505') {
    console.error('[connect-webhook] could not log the event:', error.code);
  }
  return error?.code === '23505';
};

export const receiveConnectWebhook = asyncHandler(async (req, res) => {
  const check = signatureValid(req);
  if (!check.ok) {
    // The reason is logged for whoever is wiring this up, never returned: an
    // attacker probing the endpoint should learn nothing about why they failed.
    console.warn('[connect-webhook] rejected a delivery:', check.reason);
    return res.status(401).json({ success: false, message: 'Unauthorised.', errors: [] });
  }

  const body = (req.body ?? {}) as ConnectEvent;
  const eventType = String(body.event ?? body.type ?? '').trim();
  const eventId = text(body.id, 120);

  // Without an id there is no way to recognise a redelivery, and this endpoint
  // writes money. Refused rather than guessed at.
  if (!eventId) {
    return res.status(422).json({ success: false, message: 'Every event needs an id.', errors: [] });
  }

  const data = (body.data ?? {}) as Record<string, unknown>;
  const reference = text(data.external_reference ?? data.externalReference ?? data.booking_code, 60);

  // Events this site has no use for are acknowledged, not argued with. A 4xx
  // would make Connect retry something that will never succeed.
  const state = PAYMENT_STATE[eventType];
  if (!state) {
    await logEvent({ eventId, eventType, reference, bookingId: null, payload: body, status: 'ignored', detail: 'Event type not handled here.' });
    return sendSuccess(res, 'Received.', { handled: false });
  }

  if (!reference) {
    await logEvent({ eventId, eventType, reference: null, bookingId: null, payload: body, status: 'unmatched', detail: 'No booking reference on the event.' });
    return sendSuccess(res, 'Received.', { handled: false });
  }

  const { data: booking } = await supabase
    .from('booking_requests')
    .select('id, currency')
    .eq('booking_code', reference)
    .maybeSingle();

  if (!booking) {
    // Logged rather than errored: an event for a booking this site does not
    // have is worth being able to see, and retrying it will not conjure one.
    await logEvent({ eventId, eventType, reference, bookingId: null, payload: body, status: 'unmatched', detail: 'No booking with that reference.' });
    return sendSuccess(res, 'Received.', { handled: false });
  }

  const replayed = await logEvent({
    eventId,
    eventType,
    reference,
    bookingId: String(booking.id),
    payload: body,
    status: 'applied'
  });

  // Already logged under this id, so the money it describes is already
  // recorded. Acknowledge and stop.
  if (replayed) return sendSuccess(res, 'Already recorded.', { handled: true, replay: true });

  const amount = num(data.amount);
  if (amount === null) {
    return sendSuccess(res, 'Received.', { handled: false });
  }

  const externalId = text(data.payment_id ?? data.id, 120) ?? eventId;

  const { error: insertError } = await supabase.from('booking_payments').insert({
    booking_id: booking.id,
    amount,
    currency: text(data.currency, 3) ?? booking.currency ?? 'USD',
    status: state,
    payment_method: text(data.method ?? data.payment_method),
    payment_provider: text(data.provider ?? data.payment_provider) ?? 'makutano_connect',
    transaction_reference: text(data.reference ?? data.transaction_reference),
    paid_at: text(data.paid_at ?? data.occurred_at ?? body.occurred_at, 40),
    external_id: externalId,
    external_source: 'makutano_connect',
    notes: 'Recorded from a Makutano Connect payment event.'
  });

  // 23505 = this payment is already recorded under a different event id — a
  // redelivery Connect gave a fresh envelope. The unique index is what stops
  // the same money being counted twice; reaching it is success, not failure.
  if (insertError && insertError.code !== '23505') {
    console.error('[connect-webhook] could not record the payment:', insertError.code);
    await supabase
      .from('connect_webhook_events')
      .update({ status: 'failed', detail: `Insert failed (${insertError.code}).` })
      .eq('event_id', eventId);
    // 500 so Connect retries: the event is genuinely unprocessed.
    return res.status(500).json({ success: false, message: 'Could not record the payment.', errors: [] });
  }

  const rollup = await rollUpPaymentStatus(String(booking.id));

  return sendSuccess(res, 'Recorded.', {
    handled: true,
    payment_status: rollup?.status ?? null
  });
});
