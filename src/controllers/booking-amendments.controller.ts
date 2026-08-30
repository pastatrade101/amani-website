import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import { supabase } from '../config/supabase';
import { safeAudit } from '../services/audit.service';

/**
 * Changes agreed after a quotation was accepted.
 *
 * An accepted quotation is frozen — it is the record of what was agreed, and
 * editing it would rewrite history under a document the traveller has already
 * answered. So the trip still changes, as trips do: a night added, a lodge
 * swapped, a traveller dropping out. Those land here instead, against the
 * booking, where each one keeps its own before-and-after rather than silently
 * becoming the new version of the original price.
 *
 * This is a log, not a second quotation system. The booking remains the live
 * record and the money still lives in booking_payments; an amendment says what
 * changed and what it did to the price.
 */

export const AMENDMENT_STATUSES = ['proposed', 'agreed', 'declined', 'applied'];

/**
 * What each status may become.
 *
 * Applying something nobody agreed to is the transition worth blocking: it is
 * how a change the traveller never accepted ends up on their invoice. Declined
 * and applied are terminal — reopening one would lose the fact that it was
 * settled, and a fresh amendment describes a fresh change more honestly.
 */
const NEXT: Record<string, string[]> = {
  proposed: ['agreed', 'declined'],
  agreed: ['applied', 'declined'],
  declined: [],
  applied: []
};

/** Exported for its own test: the guard matters more than the plumbing round it. */
export const canTransition = (from: string, to: string): boolean =>
  from === to || (NEXT[from] ?? []).includes(to);

/**
 * What an applied set of amendments does to the quoted figure.
 *
 * Only applied ones count — a proposal is a conversation, and counting it would
 * put a number in front of staff that nobody has agreed to. Returns null when
 * the booking never carried a figure, rather than a total implying the trip
 * costs only the difference.
 */
export const revisedTotal = (
  original: number | null,
  rows: Array<{ status?: unknown; amount_delta?: unknown }>
): { appliedDelta: number; revised: number | null } => {
  const appliedDelta = rows
    .filter((row) => row.status === 'applied' && row.amount_delta != null)
    .reduce((sum, row) => sum + Number(row.amount_delta), 0);
  return { appliedDelta, revised: original == null ? null : original + appliedDelta };
};

const clean = (value: unknown, max: number): string | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, max) : null;
};

const loadBooking = async (id: string) => {
  const { data } = await supabase
    .from('booking_requests')
    .select('id, booking_code, currency, estimated_amount, status')
    .eq('id', id)
    .maybeSingle();
  if (!data) throw new AppError('Booking not found.', 404);
  return data;
};

/**
 * The amendments on a booking, plus what they do to the price.
 *
 * The revised total is computed here rather than written back onto the
 * booking: estimated_amount is read by other screens as "what this trip was
 * quoted at", and silently moving it would make the original figure
 * unrecoverable. The sum is derived, so it can never drift from the log.
 *
 * Only applied amendments count. A proposal is a conversation, and counting it
 * would put a number in front of staff that nobody has agreed to.
 */
export const listAmendments = asyncHandler(async (req, res) => {
  const booking = await loadBooking(req.params.id);

  const { data, error } = await supabase
    .from('booking_amendments')
    .select('*')
    .eq('booking_request_id', req.params.id)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('Unable to load the amendments.', 500, [error]);

  const rows = data ?? [];
  const original = booking.estimated_amount == null ? null : Number(booking.estimated_amount);
  const { appliedDelta, revised } = revisedTotal(original, rows);

  return sendSuccess(res, 'Amendments fetched successfully.', {
    amendments: rows,
    currency: booking.currency ?? 'USD',
    original_amount: original,
    applied_delta: appliedDelta,
    revised_amount: revised,
    open_count: rows.filter((row) => row.status === 'proposed' || row.status === 'agreed').length
  });
});

export const createAmendment = asyncHandler(async (req, res) => {
  const booking = await loadBooking(req.params.id);

  const summary = clean(req.body?.summary, 300);
  if (!summary) throw new AppError('Say what is changing in a line — that is what everyone reads first.', 422);

  const requestedBy = String(req.body?.requested_by ?? 'traveller');
  if (!['traveller', 'admin'].includes(requestedBy)) {
    throw new AppError('An amendment is requested either by the traveller or by us.', 422);
  }

  // Signed and optional. Null means the price effect is not settled yet, which
  // is different from an amendment that genuinely costs nothing — and the
  // difference matters when someone is deciding what to invoice.
  const rawDelta = req.body?.amount_delta;
  let amountDelta: number | null = null;
  if (rawDelta !== undefined && rawDelta !== null && String(rawDelta).trim() !== '') {
    amountDelta = Number(rawDelta);
    if (!Number.isFinite(amountDelta)) throw new AppError('The price change must be a number, or left blank.', 422);
  }

  // Tie it to the quotation this booking came from where there is one, so the
  // amendment can be read against the version that was actually agreed.
  const { data: quote } = await supabase
    .from('quotations')
    .select('id')
    .eq('booking_request_id', req.params.id)
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from('booking_amendments')
    .insert({
      booking_request_id: booking.id,
      quotation_id: quote?.id ?? null,
      requested_by: requestedBy,
      summary,
      detail: clean(req.body?.detail, 2000),
      amount_delta: amountDelta,
      currency: booking.currency ?? 'USD',
      created_by: req.user?.sub ?? null
    })
    .select('*')
    .single();

  if (error) throw new AppError('Unable to record the amendment.', 500, [error]);

  await safeAudit({
    action: 'create',
    entityId: String(data.id),
    entityType: 'booking_amendments',
    newData: data,
    req
  });

  return sendSuccess(res, 'Amendment recorded.', data, 201);
});

export const updateAmendment = asyncHandler(async (req, res) => {
  await loadBooking(req.params.id);

  const { data: previous } = await supabase
    .from('booking_amendments')
    .select('*')
    .eq('id', req.params.amendmentId)
    .eq('booking_request_id', req.params.id)
    .maybeSingle();

  if (!previous) throw new AppError('Amendment not found.', 404);

  const patch: Record<string, unknown> = {};

  if (req.body?.status !== undefined) {
    const status = String(req.body.status);
    if (!AMENDMENT_STATUSES.includes(status)) throw new AppError('Unknown amendment status.', 422);

    if (status !== previous.status) {
      if (!canTransition(String(previous.status), status)) {
        throw new AppError(
          previous.status === 'proposed' && status === 'applied'
            ? 'Agree this amendment before applying it — applying something nobody agreed to is how an unasked-for change reaches an invoice.'
            : `An amendment that is ${previous.status} cannot become ${status}.`,
          409
        );
      }
      patch.status = status;
      // Settled either way. 'agreed' is deliberately not terminal: it is agreed
      // but not yet done, which is still open work for whoever is arranging it.
      if (status === 'declined' || status === 'applied') patch.resolved_at = new Date().toISOString();
    }
  }

  // The figure can still be filled in while the amendment is open — the price
  // effect of "add a night" is often settled after the change is agreed.
  if (req.body?.amount_delta !== undefined) {
    if (previous.status === 'applied' || previous.status === 'declined') {
      throw new AppError('This amendment is settled. Raise a new one rather than changing what it recorded.', 409);
    }
    const raw = req.body.amount_delta;
    if (raw === null || String(raw).trim() === '') {
      patch.amount_delta = null;
    } else {
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new AppError('The price change must be a number, or left blank.', 422);
      patch.amount_delta = value;
    }
  }

  if (!Object.keys(patch).length) return sendSuccess(res, 'Nothing to change.', previous);

  const { data, error } = await supabase
    .from('booking_amendments')
    .update(patch)
    .eq('id', req.params.amendmentId)
    .select('*')
    .single();

  if (error) throw new AppError('Unable to update the amendment.', 500, [error]);

  await safeAudit({
    action: 'update',
    entityId: String(data.id),
    entityType: 'booking_amendments',
    oldData: previous,
    newData: data,
    req
  });

  return sendSuccess(res, 'Amendment updated.', data);
});

export const deleteAmendment = asyncHandler(async (req, res) => {
  await loadBooking(req.params.id);

  // Only while it is still a proposal. Once agreed or settled it is part of
  // the record of what was discussed, and deleting it would remove the reason
  // a price moved.
  const { data: previous } = await supabase
    .from('booking_amendments')
    .select('*')
    .eq('id', req.params.amendmentId)
    .eq('booking_request_id', req.params.id)
    .maybeSingle();

  if (!previous) throw new AppError('Amendment not found.', 404);
  if (previous.status !== 'proposed') {
    throw new AppError('Only a proposal can be removed. Decline it instead — that keeps why it was turned down.', 409);
  }

  const { error } = await supabase.from('booking_amendments').delete().eq('id', req.params.amendmentId);
  if (error) throw new AppError('Unable to remove the amendment.', 500, [error]);

  await safeAudit({
    action: 'delete',
    entityId: String(req.params.amendmentId),
    entityType: 'booking_amendments',
    oldData: previous,
    req
  });

  return sendSuccess(res, 'Proposal removed.', { id: req.params.amendmentId });
});
