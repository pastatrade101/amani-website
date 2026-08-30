import { supabase } from '../config/supabase';
import { generateBookingCode } from './booking-code.service';

/**
 * What happens to a quotation either side of the traveller's answer.
 *
 * The controller owns the HTTP conversation; this owns the rules that outlive
 * it — when a document stops being editable, what a superseded version leaves
 * behind, and what acceptance does to the booking. Those rules have to hold
 * whether a status change arrives from the traveller's link, from the CMS, or
 * from an admin override, so they live in one place rather than three.
 */

/**
 * Statuses in which the document is settled and must not be edited.
 *
 * `accepted` is the commercial agreement — what it said when they said yes is
 * what was agreed. `declined` is closed; editing it would silently rewrite a
 * record of something the traveller already turned down.
 *
 * Deliberately keyed on status rather than on frozen_at: quotations accepted
 * before frozen_at existed have a null column, and they are no less agreed for
 * having been accepted early.
 */
const SETTLED = new Set(['accepted', 'declined']);

export const isSettled = (quotation: Record<string, unknown>): boolean =>
  SETTLED.has(String(quotation.status ?? '')) || Boolean(quotation.frozen_at);

/**
 * The states from which a traveller can still ask for something different.
 *
 * Not `draft` — they have never seen it — and not `expired`, where the answer
 * is a fresh quotation rather than a revision of a dead one.
 */
export const CAN_REQUEST_CHANGES = new Set(['sent', 'viewed', 'changes_requested', 'revised']);

/**
 * Put the current version beyond reach before it is overwritten.
 *
 * Called immediately before an edit that produces version n+1, so what is
 * stored is version n exactly as the traveller saw it. Best-effort by design:
 * losing the history is bad, but refusing to let an agent revise a quotation
 * because the archive write failed would be worse.
 */
export const snapshotRevision = async (
  quotation: Record<string, unknown>,
  reason: string | null,
  userId: string | null
): Promise<void> => {
  try {
    await supabase.from('quotation_revisions').insert({
      quotation_id: quotation.id,
      revision: Number(quotation.revision ?? 1),
      snapshot: quotation,
      superseded_reason: reason,
      superseded_by: userId
    });
  } catch (error) {
    console.error('[quotations] could not archive the previous revision:', (error as Error).message);
  }
};

export type PromotionOutcome = {
  bookingId: string | null;
  bookingCode: string | null;
  /** created: no lead existed. promoted: the enquiry became a booking. already: it was confirmed before. */
  result: 'created' | 'promoted' | 'already' | 'failed';
};

/**
 * Turn an accepted quotation into a confirmed booking.
 *
 * A quotation almost always descends from an enquiry, and that enquiry is
 * already the lead in the pipeline — so acceptance PROMOTES it rather than
 * creating anything. Inserting a second row here would give every accepted
 * quotation a duplicate customer in the inbox, which is exactly the split
 * record this codebase has been careful to avoid.
 *
 * Only when there is no lead at all — an agent composed the quotation from
 * scratch for someone who walked in — is a booking created, and it is created
 * from the quotation's own snapshot of the customer.
 *
 * Booking status and payment status are set independently and on purpose:
 * accepting settles the commercial agreement and says nothing about money.
 * A confirmed booking starts unpaid, and stays that way until a payment is
 * actually recorded.
 */
export const promoteQuotationToBooking = async (
  quotation: Record<string, unknown>
): Promise<PromotionOutcome> => {
  const failed: PromotionOutcome = { bookingId: null, bookingCode: null, result: 'failed' };

  try {
    const existingId = quotation.booking_request_id ? String(quotation.booking_request_id) : '';

    if (existingId) {
      const { data: lead } = await supabase
        .from('booking_requests')
        .select('id, booking_code, status, payment_status')
        .eq('id', existingId)
        .maybeSingle();

      if (lead) {
        if (String(lead.status) === 'confirmed') {
          return { bookingId: String(lead.id), bookingCode: String(lead.booking_code ?? ''), result: 'already' };
        }

        const patch: Record<string, unknown> = { status: 'confirmed', updated_at: new Date().toISOString() };
        // Only seed the payment state if it has none. A booking that has
        // already taken a deposit must not be reset to unpaid because the
        // quotation it came from was accepted a second time.
        if (!lead.payment_status) patch.payment_status = 'unpaid';

        const { data: updated, error } = await supabase
          .from('booking_requests')
          .update(patch)
          .eq('id', existingId)
          .select('id, booking_code')
          .maybeSingle();

        if (error || !updated) {
          console.error('[quotations] could not confirm the linked booking:', error?.message ?? 'no row returned');
          return failed;
        }

        return { bookingId: String(updated.id), bookingCode: String(updated.booking_code ?? ''), result: 'promoted' };
      }
    }

    // No lead behind this quotation. Build one from what the document itself
    // records about the customer — it is a snapshot taken when the quote was
    // raised, which is the best information that exists.
    const acceptance = (quotation.acceptance as Record<string, unknown> | null) ?? {};
    const fullName =
      (typeof acceptance.lead_traveller === 'string' && acceptance.lead_traveller.trim()) ||
      String(quotation.customer_name ?? '').trim();

    if (!fullName) {
      console.error('[quotations] cannot create a booking: the quotation names no customer.');
      return failed;
    }

    const bookingCode = await generateBookingCode();
    const { data: created, error } = await supabase
      .from('booking_requests')
      .insert({
        booking_code: bookingCode,
        full_name: fullName,
        email:
          (typeof acceptance.email === 'string' && acceptance.email.trim()) || quotation.customer_email || null,
        phone:
          (typeof acceptance.phone === 'string' && acceptance.phone.trim()) || quotation.customer_phone || null,
        tour_id: quotation.tour_id ?? null,
        travel_date: quotation.travel_date ?? null,
        number_of_adults: Number(quotation.adults ?? 1) || 1,
        number_of_children: Number(quotation.children ?? 0) || 0,
        status: 'confirmed',
        payment_status: 'unpaid',
        source: 'admin_created',
        special_requests: typeof acceptance.notes === 'string' ? acceptance.notes : null,
        lead_context: { v: 1, origin: 'quotation_accepted', quote_code: quotation.quote_code ?? null }
      })
      .select('id, booking_code')
      .maybeSingle();

    if (error || !created) {
      console.error('[quotations] could not create a booking from the quotation:', error?.message ?? 'no row returned');
      return failed;
    }

    // Point the quotation at what it produced, so the two are navigable in
    // both directions from here on.
    await supabase.from('quotations').update({ booking_request_id: created.id }).eq('id', quotation.id);

    return { bookingId: String(created.id), bookingCode: String(created.booking_code ?? ''), result: 'created' };
  } catch (error) {
    console.error('[quotations] promotion to booking failed:', (error as Error).message);
    return failed;
  }
};
