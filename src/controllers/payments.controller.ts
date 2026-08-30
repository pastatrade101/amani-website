import { asyncHandler } from '../utils/async-handler';
import { createRecord, getRecordById, listRecords, softDeleteRecord, updateRecord } from '../utils/supabase-helpers';
import { supabase } from '../config/supabase';
import { rollUpPaymentStatus } from '../services/payment-rollup.service';

const select = '*, booking_requests(booking_code,full_name,email,status)';

/**
 * Recompute the booking's payment_status after its payments change.
 *
 * Every one of these handlers used to write booking_payments and stop there,
 * so recording a deposit left the booking still saying 'unpaid' — on the admin
 * list, and on the traveller's own trip page next to the payment they had just
 * made. The rollup derives the status from what is actually recorded, so the
 * two can no longer disagree.
 *
 * Best-effort and after the response is already decided: the payment itself is
 * saved either way, and a failed recompute must not turn a successful record
 * into an error.
 */
const refresh = async (bookingId: unknown) => {
  const id = typeof bookingId === 'string' ? bookingId : '';
  if (!id) return;
  try {
    await rollUpPaymentStatus(id);
  } catch (error) {
    console.error('[payments] could not refresh payment_status:', (error as Error).message);
  }
};

/** The booking a payment row belongs to, read before the row is changed. */
const bookingFor = async (paymentId: string): Promise<string | null> => {
  const { data } = await supabase.from('booking_payments').select('booking_id').eq('id', paymentId).maybeSingle();
  return data?.booking_id ? String(data.booking_id) : null;
};

export const listPayments = asyncHandler(async (req, res) => {
  return listRecords(req, res, {
    table: 'booking_payments',
    select,
    searchColumns: ['transaction_reference', 'payment_provider', 'payment_method'],
    statusColumn: 'status',
    filters: ['booking_id']
  });
});

export const getPayment = asyncHandler(async (req, res) => getRecordById(res, 'booking_payments', req.params.id, select));

export const createPayment = asyncHandler(async (req, res) => {
  const result = await createRecord(req, res, 'booking_payments', req.body, { userFields: true });
  await refresh((req.body as Record<string, unknown>)?.booking_id);
  return result;
});

export const updatePayment = asyncHandler(async (req, res) => {
  // Read the booking before the update, in case the payment is being moved to
  // a different one — both sides then need recomputing.
  const before = await bookingFor(req.params.id);
  const result = await updateRecord(req, res, 'booking_payments', req.params.id, req.body);

  const after = (req.body as Record<string, unknown>)?.booking_id;
  await refresh(before);
  if (typeof after === 'string' && after !== before) await refresh(after);
  return result;
});

export const deletePayment = asyncHandler(async (req, res) => {
  const bookingId = await bookingFor(req.params.id);
  const result = await softDeleteRecord(res, 'booking_payments', req.params.id, req);
  // A removed payment is money the booking no longer has, so the status has to
  // fall back rather than keep claiming it was paid.
  await refresh(bookingId);
  return result;
});
