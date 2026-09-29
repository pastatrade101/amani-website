import { supabase } from '../config/supabase';

/**
 * The commercial half of the dashboard.
 *
 * The existing stats describe the website — tours published, images missing,
 * posts written. None of it answers the questions an operator actually opens
 * the CMS with: is money owed to us, is anyone waiting on a reply, and did the
 * messages we sent this week actually arrive.
 *
 * Everything here is derived from records that already exist. Nothing is
 * estimated, projected or smoothed: a figure on this page is either something
 * that happened or it is absent.
 */

type Row = Record<string, unknown>;

const rows = async <T extends Row = Row>(table: string, select: string, build?: (q: any) => any): Promise<T[]> => {
  try {
    let query = supabase.from(table).select(select);
    if (build) query = build(query);
    const { data, error } = await query;
    if (error) return [];
    return (data ?? []) as unknown as T[];
  } catch {
    return [];
  }
};

const num = (value: unknown) => Number(value ?? 0) || 0;
const dayKey = (value: unknown) => String(value ?? '').slice(0, 10);

/** UTC midnight, `back` days ago. The series is a calendar, not a rolling window. */
const dayStart = (back: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - back);
  return d;
};

export const commerceSnapshot = async (days = 30) => {
  const since = dayStart(days - 1).toISOString();

  const [payments, bookings, quotations, requests, amendments, notifications] = await Promise.all([
    rows<{ amount: unknown; status: unknown; currency: unknown; paid_at: unknown; created_at: unknown }>(
      'booking_payments',
      'amount, status, currency, paid_at, created_at',
      (q) => q.is('deleted_at', null).limit(5000)
    ),
    rows<{ id: unknown; status: unknown; payment_status: unknown; estimated_amount: unknown; currency: unknown; created_at: unknown }>(
      'booking_requests',
      'id, status, payment_status, estimated_amount, currency, created_at',
      (q) => q.is('deleted_at', null).limit(5000)
    ),
    rows<{ status: unknown; total_amount: unknown; currency: unknown; created_at: unknown; accepted_at: unknown }>(
      'quotations',
      'status, total_amount, currency, created_at, accepted_at',
      (q) => q.is('deleted_at', null).limit(5000)
    ),
    rows<{ amount: unknown; currency: unknown; status: unknown; claimed_paid_at: unknown; due_date: unknown }>(
      'payment_requests',
      'amount, currency, status, claimed_paid_at, due_date'
    ),
    rows<{ status: unknown }>('booking_amendments', 'status'),
    rows<{ status: unknown; channel: unknown; created_at: unknown }>('notification_events', 'status, channel, created_at', (q) =>
      q.gte('created_at', since).limit(2000)
    )
  ]);

  // ── Money ───────────────────────────────────────────────────────────────
  //
  // Per currency, never summed across them: a combined total would reconcile
  // against no statement anywhere.
  const money: Record<string, { received: number; refunded: number; outstanding: number }> = {};
  const bump = (code: string) => (money[code] ??= { received: 0, refunded: 0, outstanding: 0 });

  for (const p of payments) {
    const code = String(p.currency ?? 'USD');
    if (p.status === 'paid') bump(code).received += num(p.amount);
    if (p.status === 'refunded') bump(code).refunded += num(p.amount);
  }

  // What confirmed trips still owe. Only confirmed ones: an unconfirmed
  // enquiry owes nothing, and counting it would inflate the figure with work
  // nobody has agreed to.
  //
  // A fully paid booking is excluded on its payment_status, which is itself
  // derived from the payment rows above — so the two figures cannot disagree.
  let unpaidConfirmed = 0;
  for (const b of bookings) {
    if (b.status !== 'confirmed') continue;
    if (b.payment_status === 'paid') continue;
    unpaidConfirmed += 1;
    if (b.estimated_amount != null) bump(String(b.currency ?? 'USD')).outstanding += num(b.estimated_amount);
  }

  // ── Daily series, for the chart ─────────────────────────────────────────
  const series: Array<{ date: string; received: number; enquiries: number; accepted: number }> = [];
  const index = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = dayStart(i).toISOString().slice(0, 10);
    index.set(key, series.length);
    series.push({ date: key, received: 0, enquiries: 0, accepted: 0 });
  }

  const add = (key: string, field: 'received' | 'enquiries' | 'accepted', by: number) => {
    const at = index.get(key);
    if (at !== undefined) series[at][field] += by;
  };

  for (const p of payments) {
    if (p.status !== 'paid') continue;
    add(dayKey(p.paid_at ?? p.created_at), 'received', num(p.amount));
  }
  for (const b of bookings) add(dayKey(b.created_at), 'enquiries', 1);
  for (const q of quotations) if (q.accepted_at) add(dayKey(q.accepted_at), 'accepted', 1);

  // ── The quotation funnel ────────────────────────────────────────────────
  const pipeline: Record<string, number> = {
    draft: 0,
    sent: 0,
    viewed: 0,
    changes_requested: 0,
    revised: 0,
    accepted: 0,
    declined: 0,
    expired: 0
  };
  let quotedValue = 0;
  let acceptedValue = 0;
  for (const q of quotations) {
    const status = String(q.status ?? 'draft');
    if (status in pipeline) pipeline[status] += 1;
    if (['sent', 'viewed', 'changes_requested', 'revised'].includes(status)) quotedValue += num(q.total_amount);
    if (status === 'accepted') acceptedValue += num(q.total_amount);
  }

  // Of the quotations that reached a decision, how many said yes. Undecided
  // ones are excluded rather than counted as losses — a quote sent yesterday
  // is not a rejection.
  const decided = pipeline.accepted + pipeline.declined + pipeline.expired;
  const winRate = decided > 0 ? Math.round((pipeline.accepted / decided) * 100) : null;

  // ── What is actually waiting on someone ─────────────────────────────────
  const attention = {
    quotationsAwaitingReply: pipeline.changes_requested,
    quotationsToSend: pipeline.revised + pipeline.draft,
    paymentClaimsToVerify: requests.filter((r) => r.claimed_paid_at && r.status === 'sent').length,
    paymentRequestsOpen: requests.filter((r) => r.status === 'sent' && !r.claimed_paid_at).length,
    paymentRequestsOverdue: requests.filter(
      (r) => r.status === 'sent' && !r.claimed_paid_at && r.due_date && String(r.due_date) < new Date().toISOString().slice(0, 10)
    ).length,
    amendmentsOpen: amendments.filter((a) => a.status === 'proposed' || a.status === 'agreed').length,
    unpaidConfirmed
  };

  // ── Did our messages actually land ──────────────────────────────────────
  //
  // Worth its own tile because the failure is silent: an email provider
  // rejecting everything looks identical to nobody having emailed anyone.
  const delivery = { sent: 0, skipped: 0, failed: 0 };
  for (const n of notifications) {
    const status = String(n.status ?? '');
    if (status === 'sent') delivery.sent += 1;
    else if (status === 'skipped') delivery.skipped += 1;
    else if (status === 'failed') delivery.failed += 1;
  }

  return {
    days,
    money,
    currencies: Object.keys(money).sort(),
    series,
    pipeline,
    quotedValue,
    acceptedValue,
    winRate,
    attention,
    delivery
  };
};
