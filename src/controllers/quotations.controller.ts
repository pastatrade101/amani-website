import { randomBytes } from 'node:crypto';
import { syncQuotationToMakutano } from '../services/makutano-connect.service';
import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import { supabase } from '../config/supabase';
import { safeAudit } from '../services/audit.service';
import { deliveredVia, emitNotification } from '../services/notification-events.service';
import {
  CAN_REQUEST_CHANGES,
  isSettled,
  promoteQuotationToBooking,
  snapshotRevision
} from '../services/quotation-lifecycle.service';

/**
 * Quotations — the offer a traveller receives between enquiry and booking.
 *
 * A quotation is a document: it snapshots who it was quoted to and what for,
 * so it keeps saying what it said even if the lead or tour is edited later.
 */

/**
 * Every state a quotation can be in. Mirrors the check constraint on the table;
 * both have to be changed together.
 *
 * `changes_requested` is the traveller asking for something different, and
 * `revised` is the agent's answer to that before it goes back out — distinct
 * from `draft`, which has never been seen by anyone.
 */
const QUOTATION_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'changes_requested',
  'revised',
  'accepted',
  'declined',
  'expired'
];

const SITE_URL = () => (process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || '').replace(/\/+$/, '');

/** Unguessable link token — 32 hex chars, not derived from the id. */
const newToken = () => randomBytes(16).toString('hex');

const newQuoteCode = () => `GFQ-${randomBytes(3).toString('hex').toUpperCase()}`;

const quoteUrl = (token: string) => `${SITE_URL()}/quote/${token}`;

const money = (amount: number, currency: string) =>
  `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * A quotation is honoured through the whole of its valid-until day — the date
 * is a promise about a day, not a moment — so it lapses at the end of it.
 */
const hasLapsed = (validUntil: unknown): boolean => {
  if (!validUntil) return false;
  const end = new Date(`${String(validUntil).slice(0, 10)}T23:59:59.999Z`).getTime();
  return Number.isFinite(end) && end < Date.now();
};

/** Trim and cap anything the traveller typed before it is stored. */
const clean = (value: unknown, max: number): string | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, max) : null;
};

/**
 * Leave a staff-visible note on the linked conversation.
 *
 * A note rather than a message: the inbox shows it to the team without it ever
 * being delivered to the traveller or fed back into the assistant's context.
 * Best-effort — a quotation is accepted whether or not the note lands.
 */
const noteOnConversation = async (conversationId: unknown, body: string) => {
  if (!conversationId) return;
  try {
    await supabase.from('conversation_notes').insert({ conversation_id: conversationId, author_id: null, body });
    await supabase
      .from('ai_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
  } catch {
    // Non-fatal by design.
  }
};

/**
 * Retire offers whose date has passed.
 *
 * Only ones actually made to someone: a draft that sat too long is unfinished
 * work an agent will date afresh before sending, not a promise that lapsed.
 * Swept here so the admin list, the API and the traveller's page agree without
 * every reader recomputing it.
 */
const sweepLapsed = async () => {
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from('quotations')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .in('status', ['sent', 'viewed'])
    .not('valid_until', 'is', null)
    .lt('valid_until', today)
    .is('deleted_at', null);
};

export const listQuotations = asyncHandler(async (req, res) => {
  await sweepLapsed();

  const limit = Math.min(Number(req.query.limit) || 50, 100);
  let query = supabase
    .from('quotations')
    // The lead comes along so the list can show which enquiry a quotation
    // answers — the link is the whole point of raising one from a booking.
    .select('*, tour:tours(title, slug), lead:booking_requests(booking_code, full_name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (typeof req.query.status === 'string' && req.query.status) query = query.eq('status', req.query.status);
  if (typeof req.query.conversation_id === 'string' && req.query.conversation_id) {
    query = query.eq('conversation_id', req.query.conversation_id);
  }
  if (typeof req.query.booking_request_id === 'string' && req.query.booking_request_id) {
    query = query.eq('booking_request_id', req.query.booking_request_id);
  }

  // One box that searches the three things an agent actually remembers: the
  // reference they read out, the traveller's name, or what the trip was.
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search) {
    const term = search.replace(/[%,()]/g, ' ').trim();
    if (term) query = query.or(`quote_code.ilike.%${term}%,customer_name.ilike.%${term}%,title.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw new AppError('Unable to load quotations.', 500, [error]);

  const rows = (data ?? []).map((row) => ({ ...row, public_url: quoteUrl(String(row.public_token)) }));
  return sendSuccess(res, 'Quotations fetched successfully.', rows);
});

/**
 * Soft delete. A quotation is a commercial document — it stays recoverable and
 * keeps answering audit questions long after it stops being relevant, and its
 * link stops resolving the moment it is removed.
 */
export const deleteQuotation = asyncHandler(async (req, res) => {
  const { data: previous } = await supabase.from('quotations').select('*').eq('id', req.params.id).maybeSingle();
  if (!previous) throw new AppError('Quotation not found.', 404);

  const deletedAt = new Date().toISOString();
  const { error } = await supabase
    .from('quotations')
    .update({ deleted_at: deletedAt, updated_at: deletedAt })
    .eq('id', req.params.id);
  if (error) throw new AppError('Unable to delete the quotation.', 500, [error]);

  await safeAudit({ action: 'delete', entityId: req.params.id, entityType: 'quotations', oldData: previous, req });

  // Tell Connect. Without this the mirror only ever reports quotations that
  // still exist, and a deletion here leaves a row over there forever — the
  // deleted_at branch in the service is unreachable from anywhere else.
  void syncQuotationToMakutano({ ...(previous as Record<string, unknown>), deleted_at: deletedAt });

  return sendSuccess(res, 'Quotation deleted.', { id: req.params.id });
});

export const getQuotation = asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('quotations').select('*').eq('id', req.params.id).maybeSingle();
  if (error) throw new AppError('Unable to load the quotation.', 500, [error]);
  if (!data) throw new AppError('Quotation not found.', 404);
  return sendSuccess(res, 'Quotation fetched successfully.', { ...data, public_url: quoteUrl(String(data.public_token)) });
});

export const createQuotation = asyncHandler(async (req, res) => {
  const {
    booking_request_id: bookingRequestId,
    conversation_id: conversationId,
    tour_id: tourId,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    title,
    currency = 'USD',
    adults = 1,
    children = 0,
    travel_date: travelDate,
    items = [],
    total_amount: totalAmount,
    notes,
    valid_until: validUntil,
    inclusions = [],
    exclusions = [],
    deposit_amount: depositAmount,
    payment_terms: paymentTerms
  } = req.body as Record<string, unknown>;

  if (!title || typeof title !== 'string') throw new AppError('A quotation title is required.', 422);
  const total = Number(totalAmount);
  if (!Number.isFinite(total) || total < 0) throw new AppError('A valid total amount is required.', 422);

  const { data, error } = await supabase
    .from('quotations')
    .insert({
      quote_code: newQuoteCode(),
      booking_request_id: bookingRequestId ?? null,
      conversation_id: conversationId ?? null,
      tour_id: tourId ?? null,
      customer_name: customerName ?? null,
      customer_phone: customerPhone ?? null,
      customer_email: customerEmail ?? null,
      title,
      currency,
      adults: Number(adults) || 1,
      children: Number(children) || 0,
      travel_date: travelDate ?? null,
      items: Array.isArray(items) ? items : [],
      total_amount: total,
      notes: notes ?? null,
      valid_until: validUntil ?? null,
      inclusions: Array.isArray(inclusions) ? inclusions : [],
      exclusions: Array.isArray(exclusions) ? exclusions : [],
      // Null, not 0 — "no deposit stated" and "a deposit of nothing" are
      // different things, and the traveller's page hides the block for the
      // first and would print "USD 0.00" for the second.
      deposit_amount: depositAmount === '' || depositAmount === undefined ? null : depositAmount,
      payment_terms: paymentTerms ?? null,
      public_token: newToken(),
      created_by: req.user?.sub ?? null
    })
    .select('*')
    .single();

  if (error) throw new AppError('Unable to create the quotation.', 500, [error]);
  await safeAudit({ action: 'create', entityId: String(data.id), entityType: 'quotations', newData: data, req });
  void syncQuotationToMakutano(data as Record<string, unknown>);
  return sendSuccess(res, 'Quotation created.', { ...data, public_url: quoteUrl(String(data.public_token)) }, 201);
});

export const updateQuotation = asyncHandler(async (req, res) => {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of [
    'title',
    'currency',
    'adults',
    'children',
    'travel_date',
    'items',
    'total_amount',
    'notes',
    'valid_until',
    'tour_id',
    'inclusions',
    'exclusions',
    'deposit_amount',
    'payment_terms'
  ]) {
    if (req.body[field] !== undefined) patch[field] = req.body[field];
  }

  const { data: previous } = await supabase.from('quotations').select('*').eq('id', req.params.id).maybeSingle();
  if (!previous) throw new AppError('Quotation not found.', 404);

  // An accepted quotation is the commercial agreement, and a declined one is a
  // record of something the traveller turned down. Editing either would rewrite
  // history under a document someone has already answered — so changes after
  // acceptance go through a booking amendment instead, which is visible to both
  // sides rather than silent.
  if (isSettled(previous as Record<string, unknown>)) {
    throw new AppError(
      previous.status === 'accepted'
        ? 'This quotation has been accepted and is locked. Raise a booking amendment to change what was agreed.'
        : 'This quotation was declined and is closed. Create a new quotation instead of editing it.',
      409
    );
  }

  const { data, error } = await supabase.from('quotations').update(patch).eq('id', req.params.id).select('*').single();
  if (error) throw new AppError('Unable to update the quotation.', 500, [error]);

  await safeAudit({ action: 'update', entityId: String(data.id), entityType: 'quotations', newData: data, oldData: previous, req });

  // A revision to something the traveller has already seen is worth telling
  // them about; a draft edit is not.
  if (['sent', 'viewed'].includes(String(previous.status))) {
    const url = quoteUrl(String(data.public_token));
    const total = money(Number(data.total_amount), String(data.currency));

    await emitNotification({
      type: 'QUOTATION_UPDATED',
      entityType: 'quotations',
      entityId: String(data.id),
      phone: String(data.customer_phone ?? ''),
      email: String(data.customer_email ?? ''),
      message: `Your quotation ${data.quote_code} has been updated.\n${data.title}\nTotal: ${total}\n\nView it here: ${url}`,
      templateKey: 'quotation_updated',
      templateParameters: [String(data.customer_name ?? 'there'), String(data.quote_code), url],
      emailContent: {
        subject: `Your quotation has been updated — ${data.quote_code}`,
        heading: 'Your quotation has been updated',
        lines: [
          `Hello ${String(data.customer_name ?? 'there')},`,
          `We've revised your quotation ${data.quote_code} for ${data.title}.`,
          `The new total is ${total}.`,
          'Open it to see what changed. The link below always shows the current version.'
        ],
        cta: { label: 'View your quotation', url }
      },
      // Keyed on the row's updated_at so each distinct revision may notify once.
      dedupeKey: `quotation_updated:${data.id}:${data.updated_at}`
    });
  }

  void syncQuotationToMakutano(data as Record<string, unknown>);
  return sendSuccess(res, 'Quotation updated.', { ...data, public_url: quoteUrl(String(data.public_token)) });
});

/** Send the quotation to the traveller over WhatsApp. */
export const sendQuotation = asyncHandler(async (req, res) => {
  const { data: quotation } = await supabase.from('quotations').select('*').eq('id', req.params.id).maybeSingle();
  if (!quotation) throw new AppError('Quotation not found.', 404);

  const phone = (req.body?.phone as string | undefined) ?? (quotation.customer_phone as string | undefined);
  const email = (req.body?.email as string | undefined) ?? (quotation.customer_email as string | undefined);
  // Either channel is enough. Requiring a WhatsApp number would make the email
  // channel unreachable for a traveller who only ever gave us an address.
  if (!phone && !email) {
    throw new AppError('This quotation has no WhatsApp number and no email address to send to.', 422);
  }

  // Sending an answered quotation would ask the traveller to decide something
  // they have already decided, and for an accepted one it would invite them to
  // accept the agreement twice.
  if (isSettled(quotation as Record<string, unknown>)) {
    throw new AppError(
      quotation.status === 'accepted'
        ? 'This quotation has already been accepted. Nothing further needs sending.'
        : 'This quotation was declined. Create a new one rather than sending it again.',
      409
    );
  }

  // Refuse to put a dead price in front of someone. The traveller's page would
  // show it as expired the moment they opened it, which is a worse way to find
  // out than the agent being told here.
  if (hasLapsed(quotation.valid_until)) {
    throw new AppError('This quotation’s valid-until date has passed. Give it a new date before sending.', 422);
  }

  const url = quoteUrl(String(quotation.public_token));

  // A quotation is only its link. Sending one that resolves to a developer's
  // machine puts an unopenable URL in front of a traveller, which is worse than
  // not sending — and it is silent, because the send itself succeeds.
  if (!/^https?:\/\//i.test(url) || /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)([:/]|$)/i.test(url)) {
    throw new AppError(
      'This server has no public site address configured, so the quotation link would not open for the traveller. Set PUBLIC_SITE_URL and try again.',
      500
    );
  }

  // Idempotent by default, so a double click cannot message the traveller
  // twice. An explicit resend — they lost the link, or it went to an old
  // number — gets a fresh key, still bucketed by the minute so the double
  // click is caught on that path too.
  //
  // Keyed on the revision as well as the quotation: without that, v2 would be
  // deduped against v1's send and a traveller who asked for changes would never
  // be told the changes were made.
  const revision = Number(quotation.revision ?? 1);
  const isRevision = revision > 1;
  const resend = req.body?.resend === true;
  const dedupeKey = resend
    ? `quotation_ready:${quotation.id}:v${revision}:${new Date().toISOString().slice(0, 16)}`
    : `quotation_ready:${quotation.id}:v${revision}`;

  const travellers = Number(quotation.adults) + Number(quotation.children);
  const total = money(Number(quotation.total_amount), String(quotation.currency));

  const outcome = await emitNotification({
    type: 'QUOTATION_READY',
    entityType: 'quotations',
    entityId: String(quotation.id),
    phone,
    email,
    // WhatsApp carries the least it can: what it is, what it costs, and the
    // link. The detail belongs in the email, which is where someone reads
    // carefully and where it stays findable months later.
    message: isRevision
      ? `We've updated your quotation 🙂\n\n${quotation.title}\nTravellers: ${travellers}\nTotal: ${total}\n\nSee what changed:\n${url}`
      : `Your safari quotation is ready 🎉\n\n${quotation.title}\nTravellers: ${travellers}\nTotal: ${total}\n\nView your quotation:\n${url}`,
    // A revision is a different thing to say, so it says it with a different
    // template rather than dressing an updated price as a brand new one.
    templateKey: isRevision ? 'quotation_revised' : 'quotation_ready',
    templateParameters: [String(quotation.customer_name ?? 'there'), String(quotation.title), url],
    emailContent: {
      subject: isRevision
        ? `Your updated quotation — ${quotation.title}`
        : `Your quotation is ready — ${quotation.title}`,
      heading: isRevision ? 'Your updated quotation' : 'Your quotation is ready',
      lines: [
        `Hello ${String(quotation.customer_name ?? 'there')},`,
        isRevision
          ? `We've made the changes you asked for. Here is version ${revision} of the quotation for ${quotation.title}, for ${travellers} ${travellers === 1 ? 'traveller' : 'travellers'}${quotation.travel_date ? ` travelling on ${quotation.travel_date}` : ''}.`
          : `Here is the quotation for ${quotation.title}, for ${travellers} ${travellers === 1 ? 'traveller' : 'travellers'}${quotation.travel_date ? ` travelling on ${quotation.travel_date}` : ''}.`,
        `Total: ${total}.`,
        quotation.valid_until ? `This price is held until ${quotation.valid_until}.` : '',
        'Open the link below to see what is included and to accept it. Nothing is payable to accept.'
      ].filter(Boolean),
      cta: { label: 'View your quotation', url }
    },
    dedupeKey
  });

  // Only mark it sent if it actually went, and record which channels carried
  // it. A skipped send must not leave the record claiming the traveller has it.
  if (outcome.status === 'sent') {
    const sentAtIso = new Date().toISOString();
    await supabase
      .from('quotations')
      .update({
        status: 'sent',
        sent_at: sentAtIso,
        sent_via: deliveredVia(outcome),
        updated_at: sentAtIso
      })
      .eq('id', quotation.id);
    void syncQuotationToMakutano({ ...(quotation as Record<string, unknown>), status: 'sent', sent_at: sentAtIso });
  }

  await safeAudit({ action: 'update', entityId: String(quotation.id), entityType: 'quotations', newData: { sent: outcome.status }, req });
  return sendSuccess(res, outcome.status === 'sent' ? 'Quotation sent on WhatsApp.' : `Not sent: ${outcome.detail}`, {
    outcome,
    public_url: url
  });
});

/**
 * Force a quotation's status from the CMS — the manual override.
 *
 * The ordinary path is the traveller answering from their own link, and this is
 * not that. It exists for the cases the link cannot cover: a price agreed on the
 * phone, a walk-in, a booking migrated from the old system, a traveller whose
 * handset will not open the page.
 *
 * Because it puts words in the traveller's mouth, it will not run anonymously.
 * A reason is required and stored alongside who forced it, so a quotation
 * marked accepted can always be traced to either the traveller or a named
 * member of staff — and the two can be told apart months later.
 */
export const setQuotationStatus = asyncHandler(async (req, res) => {
  const status = String(req.body?.status ?? '');
  if (!QUOTATION_STATUSES.includes(status)) {
    throw new AppError('Unknown quotation status.', 422);
  }

  const reason = clean(req.body?.reason, 500);
  if (!reason) {
    throw new AppError(
      'Overriding a quotation status needs a reason — say why this is being set by hand rather than by the traveller.',
      422
    );
  }

  const { data: previous } = await supabase.from('quotations').select('*').eq('id', req.params.id).maybeSingle();
  if (!previous) throw new AppError('Quotation not found.', 404);

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status,
    updated_at: now,
    status_override_reason: reason,
    status_override_by: req.user?.sub ?? null,
    status_override_at: now
  };
  if (status === 'accepted') {
    patch.accepted_at = previous.accepted_at ?? now;
    patch.frozen_at = previous.frozen_at ?? now;
  }
  if (status === 'declined') patch.declined_at = previous.declined_at ?? now;
  if (status === 'changes_requested') patch.changes_requested_at = now;

  const { data, error } = await supabase.from('quotations').update(patch).eq('id', req.params.id).select('*').single();
  if (error) throw new AppError('Unable to update the quotation.', 500, [error]);

  await safeAudit({
    action: 'status_change',
    entityId: String(data.id),
    entityType: 'quotations',
    oldData: previous,
    newData: { status, override_reason: reason },
    req
  });
  void syncQuotationToMakutano(data as Record<string, unknown>);

  // An override to accepted carries the same commercial weight as the traveller
  // pressing the button, so it has to move the booking too — otherwise a phone
  // agreement leaves the pipeline showing an unconfirmed lead.
  let promotion: Awaited<ReturnType<typeof promoteQuotationToBooking>> | null = null;
  if (status === 'accepted' && previous.status !== 'accepted') {
    promotion = await promoteQuotationToBooking(data as Record<string, unknown>);
  }

  return sendSuccess(res, 'Quotation updated.', { ...data, booking_code: promotion?.bookingCode ?? null });
});

/**
 * The customer-facing quotation, fetched by its token alone.
 *
 * No authentication — the traveller has a link, not an account — so the token
 * is the credential and nothing else about the platform is exposed. Only the
 * fields the offer needs are returned; internal ids and admin notes stay out.
 */
export const getPublicQuotation = asyncHandler(async (req, res) => {
  const token = String(req.params.token ?? '');
  if (token.length < 24) throw new AppError('Quotation not found.', 404);

  // Named columns rather than '*': the token is the only credential on this
  // route, so the offer is whitelisted and internal ids, the token itself and
  // admin notes never leave the server.
  const OFFER = 'quote_code, title, currency, adults, children, travel_date, items, total_amount, notes, valid_until, status, tour_id, customer_name, viewed_at, accepted_at, declined_at';
  const REVISION_FIELDS = ', revision, inclusions, exclusions, deposit_amount, payment_terms, changes_requested_at';

  const fetchOffer = async (columns: string) => {
    const result = await supabase
      .from('quotations')
      .select(columns)
      .eq('public_token', token)
      .is('deleted_at', null)
      .maybeSingle();
    return {
      row: result.data as Record<string, any> | null,
      failure: result.error as { code?: string; message?: string } | null
    };
  };

  let { row: data, failure: error } = await fetchOffer(OFFER + REVISION_FIELDS);

  // 42703 = undefined_column. The revision migration has not been applied yet.
  // A traveller opening a link they were sent last week must not meet an error
  // page because a deploy landed ahead of its SQL, so fall back to the columns
  // that have always existed and let the page render without the new blocks.
  if (error?.code === '42703') {
    console.warn('[quotations] revision columns missing — apply 2026-09-02-quotation-revisions.sql');
    ({ row: data, failure: error } = await fetchOffer(OFFER));
  }

  if (error) throw new AppError('Unable to load the quotation.', 500, [error]);
  if (!data) throw new AppError('Quotation not found.', 404);

  const patch: Record<string, unknown> = {};

  // First open flips sent -> viewed, so the agent can see it landed.
  if (!data.viewed_at) {
    patch.viewed_at = new Date().toISOString();
    if (data.status === 'sent') patch.status = 'viewed';
  }

  // A price the traveller can no longer take should say so everywhere, not
  // only on the page that happens to compute it. Settling the status here
  // means the admin list, the API and the page all agree.
  if (hasLapsed(data.valid_until) && ['sent', 'viewed'].includes(String(data.status))) {
    patch.status = 'expired';
  }

  if (Object.keys(patch).length) {
    await supabase.from('quotations').update(patch).eq('public_token', token);
    if (patch.status) data.status = patch.status as string;
  }

  let tour: Record<string, unknown> | null = null;
  if (data.tour_id) {
    const { data: tourRow } = await supabase
      .from('tours')
      .select('title, slug, duration_days, main_image_url')
      .eq('id', data.tour_id)
      .maybeSingle();
    tour = tourRow as Record<string, unknown> | null;
  }

  const { tour_id: _tourId, viewed_at: _viewedAt, ...offer } = data;
  return sendSuccess(res, 'Quotation fetched successfully.', { ...offer, tour });
});

/**
 * The traveller accepting the price, from their own link.
 *
 * Acceptance is agreement, not a booking and not a payment. It records that
 * they said yes and what we need to take the next step; confirming
 * availability and turning it into a booking stays a human decision on the
 * lead that already exists.
 */
export const acceptPublicQuotation = asyncHandler(async (req, res) => {
  const token = String(req.params.token ?? '');
  if (token.length < 24) throw new AppError('Quotation not found.', 404);

  const { data: quotation, error } = await supabase
    .from('quotations')
    .select('*')
    .eq('public_token', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new AppError('Unable to load the quotation.', 500, [error]);
  if (!quotation) throw new AppError('Quotation not found.', 404);

  // Already accepted: say yes again rather than erroring. A double tap on a
  // slow connection must not read as a failure to someone who did nothing
  // wrong — and re-accepting changes nothing.
  if (quotation.status === 'accepted') {
    return sendSuccess(res, 'This quotation is already accepted.', {
      status: 'accepted',
      accepted_at: quotation.accepted_at
    });
  }
  if (quotation.status === 'declined') throw new AppError('This quotation was declined. Message us and we will prepare a new one.', 409);
  if (hasLapsed(quotation.valid_until) || quotation.status === 'expired') {
    await supabase.from('quotations').update({ status: 'expired' }).eq('id', quotation.id).neq('status', 'expired');
    throw new AppError('This quotation has expired. Message us and we will prepare an up-to-date price.', 409);
  }

  // Who is actually travelling and how to reach them. Everything is optional:
  // they have already agreed to the price, and a form is a poor reason to lose
  // that. Whatever they leave blank we ask for in the follow-up.
  const acceptance = {
    lead_traveller: clean(req.body?.lead_traveller, 120) ?? quotation.customer_name ?? null,
    email: clean(req.body?.email, 160) ?? quotation.customer_email ?? null,
    phone: clean(req.body?.phone, 40) ?? quotation.customer_phone ?? null,
    notes: clean(req.body?.notes, 2000),
    accepted_at: new Date().toISOString()
  };

  const acceptedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from('quotations')
    .update({
      status: 'accepted',
      accepted_at: acceptedAt,
      // Locked from this moment. What the document says now is what was agreed.
      frozen_at: acceptedAt,
      acceptance,
      updated_at: acceptedAt
    })
    .eq('id', quotation.id)
    // Only from a state that can still be accepted, so two simultaneous
    // requests cannot both win. A traveller who asked for changes may still
    // accept the version in front of them — asking is not refusing.
    .in('status', ['draft', 'sent', 'viewed', 'changes_requested', 'revised'])
    .select('quote_code, status, accepted_at')
    .maybeSingle();

  if (updateError) throw new AppError('Unable to record your acceptance.', 500, [updateError]);
  if (!updated) {
    return sendSuccess(res, 'This quotation is already accepted.', { status: 'accepted', accepted_at: quotation.accepted_at });
  }

  void syncQuotationToMakutano({ ...(quotation as Record<string, unknown>), status: 'accepted', accepted_at: acceptedAt, acceptance });

  // Acceptance is the commercial agreement, so the booking becomes real here
  // rather than waiting for someone to notice and press a button. Payment is a
  // separate axis and stays untouched: the booking is confirmed AND unpaid, and
  // nothing about accepting a price takes money.
  //
  // Awaited, because what it returns decides what the traveller is told next —
  // but a failure is logged and swallowed inside, never surfaced: their
  // acceptance is recorded either way and must not appear to have failed.
  const promotion = await promoteQuotationToBooking({ ...(quotation as Record<string, unknown>), acceptance });

  await safeAudit({
    action: 'update',
    entityId: String(quotation.id),
    entityType: 'quotations',
    newData: { status: 'accepted', by: 'traveller' },
    req
  });

  const total = money(Number(quotation.total_amount), String(quotation.currency));

  await noteOnConversation(
    quotation.conversation_id,
    `Quotation ${quotation.quote_code} accepted by the traveller — ${quotation.title}, ${total}.` +
      (acceptance.lead_traveller ? `\nLead traveller: ${acceptance.lead_traveller}` : '') +
      (acceptance.notes ? `\nTheir note: ${acceptance.notes}` : '') +
      (promotion.result === 'failed'
        ? '\n⚠️ The booking was NOT confirmed automatically — confirm it by hand.'
        : `\nBooking ${promotion.bookingCode} is confirmed and awaiting payment.`)
  );

  // One event, three recipients' worth of channels: the traveller hears back
  // immediately on WhatsApp and formally by email, and the team is told through
  // the inbox that already receives enquiries. An accepted quotation nobody
  // looks at is a lost booking.
  void emitNotification({
    type: 'QUOTATION_ACCEPTED',
    entityType: 'quotations',
    entityId: String(quotation.id),
    phone: String(quotation.customer_phone ?? acceptance.phone ?? ''),
    email: String(acceptance.email ?? ''),
    message: `Thank you — we've received your acceptance of quotation ${quotation.quote_code}.\n\n${quotation.title}\nTotal: ${total}\n\nNo payment has been taken. Our team will confirm availability and come back to you to arrange the details.`,
    templateKey: 'quotation_accepted',
    templateParameters: [String(acceptance.lead_traveller ?? 'there'), String(quotation.quote_code)],
    emailContent: {
      subject: `We've received your acceptance — ${quotation.quote_code}`,
      heading: 'Thank you — your quotation is accepted',
      lines: [
        `Hello ${String(acceptance.lead_traveller ?? 'there')},`,
        `We've recorded your acceptance of ${quotation.title} (${quotation.quote_code}), totalling ${total}.`,
        'No payment has been taken and nothing is due yet.',
        'Our team will confirm availability for your dates and come back to you with the booking details to complete.',
        acceptance.notes ? `You told us: ${acceptance.notes}` : ''
      ].filter(Boolean),
      cta: { label: 'View your quotation', url: quoteUrl(String(quotation.public_token)) }
    },
    staffEmailContent: {
      subject: `Quotation accepted — ${quotation.quote_code} · ${total}`,
      heading: `Quotation accepted · ${quotation.quote_code}`,
      lines: [
        `${acceptance.lead_traveller || 'A traveller'} accepted ${quotation.title} — ${total}.`,
        `Contact: ${acceptance.email || 'no email'}${acceptance.phone ? ` · ${acceptance.phone}` : ''}`,
        acceptance.notes ? `Their note: ${acceptance.notes}` : '',
        promotion.result === 'failed'
          ? 'The booking could NOT be confirmed automatically — open the lead and confirm it by hand.'
          : `Booking ${promotion.bookingCode} is now confirmed and awaiting payment.`,
        quotation.deposit_amount
          ? `Deposit to request: ${money(Number(quotation.deposit_amount), String(quotation.currency))}.`
          : '',
        'No payment has been taken. Request the deposit to move this forward.'
      ].filter(Boolean),
      replyTo: acceptance.email || undefined
    },
    dedupeKey: `quotation_accepted:${quotation.id}`
  });

  return sendSuccess(res, 'Your acceptance has been recorded.', {
    status: 'accepted',
    accepted_at: updated.accepted_at,
    booking_code: promotion.bookingCode
  });
});

/** The traveller turning the price down, from their own link. */
export const declinePublicQuotation = asyncHandler(async (req, res) => {
  const token = String(req.params.token ?? '');
  if (token.length < 24) throw new AppError('Quotation not found.', 404);

  const { data: quotation } = await supabase
    .from('quotations')
    .select('id, quote_code, title, status, declined_at, conversation_id')
    .eq('public_token', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (!quotation) throw new AppError('Quotation not found.', 404);
  if (quotation.status === 'declined') {
    return sendSuccess(res, 'This quotation is already closed.', { status: 'declined', declined_at: quotation.declined_at });
  }
  if (quotation.status === 'accepted') {
    throw new AppError('This quotation was already accepted. Message us if you need to change it.', 409);
  }

  const reason = clean(req.body?.reason, 1000);
  const declinedAt = new Date().toISOString();

  const { error } = await supabase
    .from('quotations')
    .update({ status: 'declined', declined_at: declinedAt, decline_reason: reason, updated_at: declinedAt })
    .eq('id', quotation.id)
    .in('status', ['draft', 'sent', 'viewed', 'expired']);
  if (error) throw new AppError('Unable to record your response.', 500, [error]);
  void syncQuotationToMakutano({ ...(quotation as Record<string, unknown>), status: 'declined', declined_at: declinedAt, decline_reason: reason });

  await safeAudit({
    action: 'update',
    entityId: String(quotation.id),
    entityType: 'quotations',
    newData: { status: 'declined', by: 'traveller' },
    req
  });

  // Worth a human seeing: a decline with a reason is the most useful feedback
  // a quotation ever produces.
  await noteOnConversation(
    quotation.conversation_id,
    `Quotation ${quotation.quote_code} declined by the traveller — ${quotation.title}.` + (reason ? `\nReason given: ${reason}` : '')
  );

  return sendSuccess(res, 'Thank you for letting us know.', { status: 'declined', declined_at: declinedAt });
});

/**
 * The traveller asking for something different, from their own link.
 *
 * The middle ground the quotation never had. Before this the only answers were
 * yes and no, so "could we do this in June instead" had to happen in WhatsApp
 * — where it left no mark on the document it was about, and got lost the moment
 * the thread moved on. Now it lands on the quotation, and the quotation says it
 * is waiting on us rather than on them.
 *
 * It is not a decline. The current version stays live and acceptable; the
 * traveller may still take it, and often does once one detail is answered.
 */
export const requestChangesOnPublicQuotation = asyncHandler(async (req, res) => {
  const token = String(req.params.token ?? '');
  if (token.length < 24) throw new AppError('Quotation not found.', 404);

  const comment = clean(req.body?.comment, 2000);
  if (!comment) throw new AppError('Tell us what you would like changed.', 422);

  const { data: quotation, error } = await supabase
    .from('quotations')
    .select('*')
    .eq('public_token', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new AppError('Unable to load the quotation.', 500, [error]);
  if (!quotation) throw new AppError('Quotation not found.', 404);

  // Once accepted the document is the agreement, and changing it is a booking
  // amendment rather than a revision — a different conversation, with the
  // booking rather than the quote at the centre of it.
  if (quotation.status === 'accepted') {
    throw new AppError(
      'This quotation has been accepted. Message us and we will handle the change against your booking.',
      409
    );
  }
  if (!CAN_REQUEST_CHANGES.has(String(quotation.status))) {
    throw new AppError('This quotation is closed. Message us and we will prepare a new one.', 409);
  }

  const requestedAt = new Date().toISOString();
  const revision = Number(quotation.revision ?? 1);

  const { error: commentError } = await supabase.from('quotation_comments').insert({
    quotation_id: quotation.id,
    revision,
    author: 'traveller',
    author_name: quotation.customer_name ?? null,
    body: comment
  });
  if (commentError) throw new AppError('Unable to record your message.', 500, [commentError]);

  const { error: statusError } = await supabase
    .from('quotations')
    .update({ status: 'changes_requested', changes_requested_at: requestedAt, updated_at: requestedAt })
    .eq('id', quotation.id)
    .in('status', ['draft', 'sent', 'viewed', 'changes_requested', 'revised']);
  if (statusError) throw new AppError('Unable to record your message.', 500, [statusError]);

  void syncQuotationToMakutano({ ...(quotation as Record<string, unknown>), status: 'changes_requested' });

  await noteOnConversation(
    quotation.conversation_id,
    `Quotation ${quotation.quote_code} — the traveller asked for changes to v${revision}:\n"${comment}"`
  );

  const total = money(Number(quotation.total_amount), String(quotation.currency));

  // Staff only. Telling the traveller what they just typed helps nobody; the
  // point of this event is that a person here reads it and answers.
  void emitNotification({
    type: 'QUOTATION_CHANGES_REQUESTED',
    entityType: 'quotations',
    entityId: String(quotation.id),
    phone: '',
    email: '',
    message: '',
    staffEmailContent: {
      subject: `Changes requested — ${quotation.quote_code} · ${quotation.title}`,
      heading: `Changes requested on ${quotation.quote_code}`,
      lines: [
        `${quotation.customer_name || 'The traveller'} has asked for changes to v${revision} of ${quotation.title} (${total}).`,
        `They wrote: ${comment}`,
        'Open the quotation, revise it, and send the new version.'
      ],
      replyTo: String(quotation.customer_email ?? '') || undefined
    },
    // One nudge per round of comments, not one per keystroke of a traveller who
    // sends three messages in a row while thinking out loud.
    dedupeKey: `quotation_changes:${quotation.id}:${revision}`
  });

  return sendSuccess(res, 'Thank you — we have your message and will come back to you with an updated quotation.', {
    status: 'changes_requested'
  });
});

/**
 * Produce the next version of a quotation.
 *
 * The current version is archived first, exactly as the traveller saw it, and
 * then overwritten — one row per quotation, one snapshot per superseded
 * version. A row per version would mint a new link each time and strand the one
 * already sitting in the traveller's WhatsApp thread.
 *
 * The new version is `revised`, not `sent`: producing it and sending it are
 * separate acts, and an agent should be able to work on a revision across a
 * lunch break without the traveller receiving it half-finished.
 */
export const reviseQuotation = asyncHandler(async (req, res) => {
  const { data: previous } = await supabase.from('quotations').select('*').eq('id', req.params.id).maybeSingle();
  if (!previous) throw new AppError('Quotation not found.', 404);

  if (isSettled(previous as Record<string, unknown>)) {
    throw new AppError(
      previous.status === 'accepted'
        ? 'This quotation has been accepted and is locked. Raise a booking amendment instead.'
        : 'This quotation was declined and is closed. Create a new quotation instead.',
      409
    );
  }

  const patch: Record<string, unknown> = {};
  for (const field of [
    'title',
    'currency',
    'adults',
    'children',
    'travel_date',
    'items',
    'total_amount',
    'notes',
    'valid_until',
    'tour_id',
    'inclusions',
    'exclusions',
    'deposit_amount',
    'payment_terms'
  ]) {
    if (req.body[field] !== undefined) patch[field] = req.body[field];
  }

  // The traveller's own words, where they gave them — the most useful label a
  // revision can carry when someone reads the history back months later.
  const { data: openComments } = await supabase
    .from('quotation_comments')
    .select('body')
    .eq('quotation_id', previous.id)
    .eq('author', 'traveller')
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  const reason = clean(req.body?.reason, 500) ?? (openComments?.[0]?.body ? String(openComments[0].body) : null);

  await snapshotRevision(previous as Record<string, unknown>, reason, req.user?.sub ?? null);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('quotations')
    .update({
      ...patch,
      revision: Number(previous.revision ?? 1) + 1,
      status: 'revised',
      // The new version has not been seen, so the old view timestamp would
      // misreport it as read. Sending it starts that clock again.
      viewed_at: null,
      // The request has been answered by this revision existing. Left set, the
      // quotation would keep reporting an outstanding ask that was just met.
      changes_requested_at: null,
      updated_at: now
    })
    .eq('id', req.params.id)
    .select('*')
    .single();

  if (error) throw new AppError('Unable to revise the quotation.', 500, [error]);

  // Their point has been answered by the act of revising. Left open it would
  // still read as outstanding work on a version that no longer exists.
  //
  // Only the traveller's requests: an agent's own notes are a record, not a
  // task queue, and closing them here would quietly rewrite what they meant.
  await supabase
    .from('quotation_comments')
    .update({ resolved_at: now })
    .eq('quotation_id', previous.id)
    .eq('author', 'traveller')
    .is('resolved_at', null);

  await safeAudit({
    action: 'update',
    entityId: String(data.id),
    entityType: 'quotations',
    oldData: previous,
    newData: { revision: data.revision, status: 'revised' },
    req
  });
  void syncQuotationToMakutano(data as Record<string, unknown>);

  return sendSuccess(res, `Revision v${data.revision} saved. Send it when you are ready.`, data);
});

/**
 * The whole exchange about one quotation: what was said, and what it looked
 * like when it was said. Returned together because the CMS shows them as one
 * timeline, and two round trips to build one list is a waste on a page an agent
 * opens dozens of times a day.
 */
export const getQuotationThread = asyncHandler(async (req, res) => {
  const { data: quotation } = await supabase
    .from('quotations')
    .select('id, revision')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!quotation) throw new AppError('Quotation not found.', 404);

  const [{ data: comments }, { data: revisions }] = await Promise.all([
    supabase
      .from('quotation_comments')
      .select('*')
      .eq('quotation_id', req.params.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('quotation_revisions')
      .select('id, revision, superseded_reason, created_at, snapshot')
      .eq('quotation_id', req.params.id)
      .order('revision', { ascending: false })
  ]);

  return sendSuccess(res, 'Quotation thread fetched successfully.', {
    revision: quotation.revision ?? 1,
    comments: comments ?? [],
    revisions: revisions ?? []
  });
});

/** An agent's reply on the quotation thread. Internal — it notifies nobody. */
export const addQuotationComment = asyncHandler(async (req, res) => {
  const body = clean(req.body?.body, 2000);
  if (!body) throw new AppError('Write something before saving the note.', 422);

  const { data: quotation } = await supabase
    .from('quotations')
    .select('id, revision')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!quotation) throw new AppError('Quotation not found.', 404);

  const { data, error } = await supabase
    .from('quotation_comments')
    .insert({
      quotation_id: quotation.id,
      revision: Number(quotation.revision ?? 1),
      author: 'admin',
      author_user_id: req.user?.sub ?? null,
      author_name: req.user?.name ?? null,
      body
    })
    .select('*')
    .single();

  if (error) throw new AppError('Unable to save the note.', 500, [error]);
  return sendSuccess(res, 'Note added.', data, 201);
});

/** Mark one traveller comment as dealt with, without revising anything. */
export const resolveQuotationComment = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('quotation_comments')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', req.params.commentId)
    .eq('quotation_id', req.params.id)
    .select('*')
    .maybeSingle();

  if (error) throw new AppError('Unable to update the note.', 500, [error]);
  if (!data) throw new AppError('Note not found.', 404);
  return sendSuccess(res, 'Note resolved.', data);
});
