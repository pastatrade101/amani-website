import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import { supabase } from '../config/supabase';
import { safeAudit } from '../services/audit.service';
import { deliveredVia, emitNotification } from '../services/notification-events.service';
import { revisedTotal } from './booking-amendments.controller';

/**
 * Asking a traveller to pay.
 *
 * The step between "the price is agreed" and "the money arrived" had nowhere to
 * live: an agent asked by hand in WhatsApp, and nothing here knew it had
 * happened — so a traveller who had never been asked looked exactly like one
 * who had been asked three times.
 *
 * This sends the ask and records it. It collects nothing. Money arriving is
 * still recorded through booking_payments, by hand or from Connect's webhook,
 * and payment_status is derived from that.
 */

const money = (amount: number, currency: string) =>
  `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const clean = (value: unknown, max: number): string | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, max) : null;
};

const prettyDate = (value: unknown): string => {
  if (!value) return '';
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parsed);
};

/**
 * What this booking still owes, and what the accepted quotation said about how
 * it should be paid.
 *
 * The total settles against applied amendments, not the original quote — asking
 * for the pre-amendment figure would under-bill a trip that grew and over-bill
 * one that shrank.
 */
const financials = async (bookingId: string) => {
  const { data: booking } = await supabase
    .from('booking_requests')
    .select('id, booking_code, full_name, email, phone, currency, estimated_amount, status')
    .eq('id', bookingId)
    .maybeSingle();
  if (!booking) throw new AppError('Booking not found.', 404);

  const [{ data: payments }, { data: amendments }, { data: quote }] = await Promise.all([
    supabase.from('booking_payments').select('amount, status').eq('booking_id', bookingId).is('deleted_at', null),
    supabase.from('booking_amendments').select('status, amount_delta').eq('booking_request_id', bookingId),
    supabase
      .from('quotations')
      .select('deposit_amount, payment_terms')
      .eq('booking_request_id', bookingId)
      .eq('status', 'accepted')
      .order('accepted_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const rows = payments ?? [];
  const paid = rows.filter((r) => r.status === 'paid').reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const refunded = rows.filter((r) => r.status === 'refunded').reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  const original = booking.estimated_amount == null ? null : Number(booking.estimated_amount);
  const { revised } = revisedTotal(original, amendments ?? []);

  return {
    booking,
    total: revised,
    paid: paid - refunded,
    outstanding: revised == null ? null : Math.max(0, revised - (paid - refunded)),
    deposit: quote?.deposit_amount == null ? null : Number(quote.deposit_amount),
    terms: quote?.payment_terms ? String(quote.payment_terms) : null,
    currency: String(booking.currency ?? 'USD')
  };
};

/** What the CMS needs to offer the action sensibly, before anyone clicks it. */
export const getPaymentPosition = asyncHandler(async (req, res) => {
  const f = await financials(req.params.id);

  const { data: requests } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('booking_request_id', req.params.id)
    .order('created_at', { ascending: false });

  return sendSuccess(res, 'Payment position fetched successfully.', {
    currency: f.currency,
    total: f.total,
    paid: f.paid,
    outstanding: f.outstanding,
    suggested_deposit: f.deposit,
    terms: f.terms,
    requests: requests ?? []
  });
});

export const requestPayment = asyncHandler(async (req, res) => {
  const f = await financials(req.params.id);
  const booking = f.booking;

  // Asking someone to pay for a trip nobody has agreed to is the wrong order,
  // and it is a message that cannot be taken back.
  if (booking.status !== 'confirmed' && booking.status !== 'completed') {
    throw new AppError(
      'This booking is not confirmed yet. Agree the price first — a payment request on an unconfirmed booking asks for money against nothing.',
      409
    );
  }

  if (!booking.phone && !booking.email) {
    throw new AppError('This booking has no WhatsApp number and no email address to send to.', 422);
  }

  const kind = String(req.body?.kind ?? 'deposit');
  if (!['deposit', 'balance', 'full'].includes(kind)) throw new AppError('Unknown payment request type.', 422);

  // An explicit amount wins; otherwise the sensible default for the kind. A
  // deposit falls back to the whole outstanding balance only when the quotation
  // never named one — better to ask for the real figure than invent a fraction.
  const explicit = req.body?.amount;
  let amount: number;
  if (explicit !== undefined && explicit !== null && String(explicit).trim() !== '') {
    amount = Number(explicit);
  } else if (kind === 'deposit' && f.deposit != null && f.deposit > 0) {
    amount = f.deposit;
  } else if (f.outstanding != null && f.outstanding > 0) {
    amount = f.outstanding;
  } else {
    throw new AppError(
      'There is no amount to ask for. Set a deposit on the quotation, give the booking a price, or enter an amount here.',
      422
    );
  }

  if (!Number.isFinite(amount) || amount <= 0) throw new AppError('The amount must be a positive number.', 422);

  // Refuse to ask for more than is owed. Overshooting is the mistake nobody
  // notices until a traveller queries the figure.
  if (f.outstanding != null && amount > f.outstanding + 0.005) {
    throw new AppError(
      `That is more than the ${money(f.outstanding, f.currency)} still outstanding on this booking.`,
      422
    );
  }

  const dueDate = clean(req.body?.due_date, 10);
  const instructions = clean(req.body?.instructions, 1000) ?? f.terms;

  const { data: record, error } = await supabase
    .from('payment_requests')
    .insert({
      booking_request_id: booking.id,
      kind,
      amount,
      currency: f.currency,
      due_date: dueDate,
      instructions,
      created_by: req.user?.sub ?? null
    })
    .select('*')
    .single();

  if (error) throw new AppError('Unable to record the payment request.', 500, [error]);

  const firstName = String(booking.full_name ?? 'there').split(' ')[0];
  const code = String(booking.booking_code ?? '');
  const due = money(amount, f.currency);

  // One paragraph doing the work of the template's fourth variable: when, and
  // how. Assembled here so WhatsApp and email say exactly the same thing.
  const whenAndHow = [dueDate ? `Due by ${prettyDate(dueDate)}.` : '', instructions ?? '']
    .filter(Boolean)
    .join('\n')
    .trim() || 'Reply here and we will send you the payment details.';

  const outcome = await emitNotification({
    type: 'PAYMENT_REQUESTED',
    entityType: 'payment_requests',
    entityId: String(record.id),
    phone: String(booking.phone ?? ''),
    email: String(booking.email ?? ''),
    message: `Hello ${firstName}, here are the payment details for your booking ${code}.\n\nAmount due: ${due}\n\n${whenAndHow}\n\nOnce you have sent it, reply here and we will confirm.`,
    templateKey: 'payment_request',
    // Order matches the approved template: first name, booking reference,
    // amount due, then when-and-how.
    templateParameters: [firstName, code, due, whenAndHow],
    // The button carries THIS request's id, so a tap resolves to one row rather
    // than being guessed at from the phone number and a timestamp. Namespaced
    // `gf:` so it can never be confused with Connect's own button on the same
    // WhatsApp number.
    templateQuickReplies: [`gf:payment_report:${record.id}`],
    emailContent: {
      subject: `Payment for your booking — ${code}`,
      heading: kind === 'deposit' ? 'Your deposit' : kind === 'balance' ? 'Your balance' : 'Payment for your trip',
      lines: [
        `Hello ${String(booking.full_name ?? 'there')},`,
        `Here are the payment details for booking ${code}.`,
        `Amount due: ${due}.`,
        f.total != null ? `Trip total: ${money(f.total, f.currency)}${f.paid > 0 ? `, of which ${money(f.paid, f.currency)} is already received.` : '.'}` : '',
        dueDate ? `Due by ${prettyDate(dueDate)}.` : '',
        instructions ?? '',
        'Once you have sent it, reply to this email or message us on WhatsApp and we will confirm.'
      ].filter(Boolean)
    },
    // One request per row. Pressing the button twice on a slow connection must
    // not ask the traveller for the same money twice.
    dedupeKey: `payment_requested:${record.id}`
  });

  const via = deliveredVia(outcome);
  await supabase.from('payment_requests').update({ sent_via: via }).eq('id', record.id);

  await safeAudit({
    action: 'create',
    entityId: String(record.id),
    entityType: 'payment_requests',
    newData: { amount, currency: f.currency, kind, sent: outcome.status },
    req
  });

  return sendSuccess(
    res,
    outcome.status === 'sent' ? `Asked for ${due}.` : `Recorded, but not delivered: ${outcome.detail}`,
    { ...record, sent_via: via, outcome }
  );
});

/**
 * Withdraw a request that should not have gone out, or has been superseded.
 *
 * Cancelled rather than deleted: the traveller has the message either way, and
 * a record that we asked is the only thing that explains why they might pay
 * something nobody is expecting.
 */
export const cancelPaymentRequest = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('payment_requests')
    .update({ status: 'cancelled' })
    .eq('id', req.params.requestId)
    .eq('booking_request_id', req.params.id)
    .select('*')
    .maybeSingle();

  if (error) throw new AppError('Unable to cancel the request.', 500, [error]);
  if (!data) throw new AppError('Payment request not found.', 404);

  await safeAudit({
    action: 'update',
    entityId: String(data.id),
    entityType: 'payment_requests',
    newData: { status: 'cancelled' },
    req
  });

  return sendSuccess(res, 'Request cancelled.', data);
});
