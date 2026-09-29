import { supabase } from '../config/supabase';
import { revisedTotal } from '../controllers/booking-amendments.controller';
import type { PaymentStatus } from '../schemas/bookings.schema';

/**
 * What a booking's payment_status should say, given the money recorded against
 * it.
 *
 * Derived on every change rather than set by hand at each call site. The field
 * is read in two places that matter — the CMS list, and the traveller's own
 * trip page — and a status that is written independently of the payments it
 * describes drifts from them the first time anyone forgets.
 */

/**
 * Compare against the REVISED total, not the original.
 *
 * A booking whose amendments added a night is not paid off by the original
 * price, and one whose amendments removed a traveller should not sit at
 * partially_paid forever waiting for money nobody owes.
 */
export const paymentStatusFor = (
  totalDue: number | null,
  paid: number,
  refunded: number
): PaymentStatus => {
  // A refund reverses the story regardless of what is left: someone asking why
  // a trip says 'paid' when the money went back is a worse question than one
  // asking why it says 'refunded'.
  if (refunded > 0 && paid - refunded <= 0.005) return 'refunded';

  const net = paid - refunded;
  if (net <= 0.005) return 'unpaid';

  // No figure to settle against, but money has arrived. Not 'paid' — nothing
  // here knows the trip is fully covered — and not 'unpaid', which would be a
  // plain contradiction of the payments listed beside it.
  if (totalDue == null || totalDue <= 0) return 'partially_paid';

  // Half a cent of slack. Currency arithmetic across providers rounds, and a
  // booking should not stay 'partially_paid' over a rounding artefact nobody
  // can pay off.
  return net + 0.005 >= totalDue ? 'paid' : 'partially_paid';
};

export type RollupResult = {
  status: PaymentStatus;
  paid: number;
  refunded: number;
  totalDue: number | null;
};

/**
 * Recompute one booking's payment_status from what is actually recorded, and
 * write it back only if it changed.
 *
 * Reads every payment and every applied amendment rather than adjusting a
 * running figure: an out-of-order delivery, a manually corrected row or a
 * refund arriving before its payment all land on the same answer.
 */
export const rollUpPaymentStatus = async (bookingId: string): Promise<RollupResult | null> => {
  const { data: booking } = await supabase
    .from('booking_requests')
    .select('id, estimated_amount, payment_status')
    .eq('id', bookingId)
    .maybeSingle();
  if (!booking) return null;

  const [{ data: payments }, { data: amendments }] = await Promise.all([
    supabase.from('booking_payments').select('amount, status').eq('booking_id', bookingId).is('deleted_at', null),
    supabase.from('booking_amendments').select('status, amount_delta').eq('booking_request_id', bookingId)
  ]);

  const rows = payments ?? [];
  const paid = rows
    .filter((row) => row.status === 'paid')
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const refunded = rows
    .filter((row) => row.status === 'refunded')
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  const original = booking.estimated_amount == null ? null : Number(booking.estimated_amount);
  const { revised } = revisedTotal(original, amendments ?? []);

  const status = paymentStatusFor(revised, paid, refunded);

  if (status !== booking.payment_status) {
    const { error } = await supabase
      .from('booking_requests')
      .update({ payment_status: status, updated_at: new Date().toISOString() })
      .eq('id', bookingId);
    if (error) console.error('[payments] could not update payment_status:', error.message);
  }

  return { status, paid, refunded, totalDue: revised };
};
