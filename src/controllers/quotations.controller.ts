import { randomBytes } from 'node:crypto';
import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import { supabase } from '../config/supabase';
import { safeAudit } from '../services/audit.service';
import { emitNotification } from '../services/notification-events.service';
import { recipientFor } from '../services/notification.service';
import { emailLayout, escapeHtml, sendEmail } from '../services/email.service';

/**
 * Quotations — the offer a traveller receives between enquiry and booking.
 *
 * A quotation is a document: it snapshots who it was quoted to and what for,
 * so it keeps saying what it said even if the lead or tour is edited later.
 */

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

export const listQuotations = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  let query = supabase
    .from('quotations')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (typeof req.query.status === 'string' && req.query.status) query = query.eq('status', req.query.status);
  if (typeof req.query.conversation_id === 'string' && req.query.conversation_id) {
    query = query.eq('conversation_id', req.query.conversation_id);
  }

  const { data, error } = await query;
  if (error) throw new AppError('Unable to load quotations.', 500, [error]);
  return sendSuccess(res, 'Quotations fetched successfully.', data ?? []);
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
    valid_until: validUntil
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
      public_token: newToken(),
      created_by: req.user?.sub ?? null
    })
    .select('*')
    .single();

  if (error) throw new AppError('Unable to create the quotation.', 500, [error]);
  await safeAudit({ action: 'create', entityId: String(data.id), entityType: 'quotations', newData: data, req });
  return sendSuccess(res, 'Quotation created.', { ...data, public_url: quoteUrl(String(data.public_token)) }, 201);
});

export const updateQuotation = asyncHandler(async (req, res) => {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of ['title', 'currency', 'adults', 'children', 'travel_date', 'items', 'total_amount', 'notes', 'valid_until', 'tour_id']) {
    if (req.body[field] !== undefined) patch[field] = req.body[field];
  }

  const { data: previous } = await supabase.from('quotations').select('*').eq('id', req.params.id).maybeSingle();
  if (!previous) throw new AppError('Quotation not found.', 404);

  const { data, error } = await supabase.from('quotations').update(patch).eq('id', req.params.id).select('*').single();
  if (error) throw new AppError('Unable to update the quotation.', 500, [error]);

  await safeAudit({ action: 'update', entityId: String(data.id), entityType: 'quotations', newData: data, oldData: previous, req });

  // A revision to something the traveller has already seen is worth telling
  // them about; a draft edit is not.
  if (['sent', 'viewed'].includes(String(previous.status))) {
    await emitNotification({
      type: 'QUOTATION_UPDATED',
      entityType: 'quotations',
      entityId: String(data.id),
      phone: String(data.customer_phone ?? ''),
      message: `Your quotation ${data.quote_code} has been updated.\n${data.title}\nTotal: ${money(Number(data.total_amount), String(data.currency))}\n\nView it here: ${quoteUrl(String(data.public_token))}`,
      templateKey: 'quotation_updated',
      templateParameters: [String(data.customer_name ?? 'there'), String(data.quote_code), quoteUrl(String(data.public_token))],
      // Keyed on the row's updated_at so each distinct revision may notify once.
      dedupeKey: `quotation_updated:${data.id}:${data.updated_at}`
    });
  }

  return sendSuccess(res, 'Quotation updated.', { ...data, public_url: quoteUrl(String(data.public_token)) });
});

/** Send the quotation to the traveller over WhatsApp. */
export const sendQuotation = asyncHandler(async (req, res) => {
  const { data: quotation } = await supabase.from('quotations').select('*').eq('id', req.params.id).maybeSingle();
  if (!quotation) throw new AppError('Quotation not found.', 404);

  const phone = (req.body?.phone as string | undefined) ?? (quotation.customer_phone as string | undefined);
  if (!phone) throw new AppError('No WhatsApp number for this quotation.', 422);

  const url = quoteUrl(String(quotation.public_token));
  const outcome = await emitNotification({
    type: 'QUOTATION_READY',
    entityType: 'quotations',
    entityId: String(quotation.id),
    phone,
    message: `Your safari quotation is ready 🎉\n\n${quotation.title}\nTravellers: ${Number(quotation.adults) + Number(quotation.children)}\nTotal: ${money(Number(quotation.total_amount), String(quotation.currency))}\n\nView your quotation:\n${url}`,
    templateKey: 'quotation_ready',
    templateParameters: [String(quotation.customer_name ?? 'there'), String(quotation.title), url],
    dedupeKey: `quotation_ready:${quotation.id}`
  });

  // Only mark it sent if it actually went. A skipped send must not leave the
  // record claiming the traveller has it.
  if (outcome.status === 'sent') {
    await supabase
      .from('quotations')
      .update({ status: 'sent', sent_at: new Date().toISOString(), sent_via: 'whatsapp', updated_at: new Date().toISOString() })
      .eq('id', quotation.id);
  }

  await safeAudit({ action: 'update', entityId: String(quotation.id), entityType: 'quotations', newData: { sent: outcome.status }, req });
  return sendSuccess(res, outcome.status === 'sent' ? 'Quotation sent on WhatsApp.' : `Not sent: ${outcome.detail}`, {
    outcome,
    public_url: url
  });
});

/** Accept or decline on the traveller's behalf, from the admin. */
export const setQuotationStatus = asyncHandler(async (req, res) => {
  const status = String(req.body?.status ?? '');
  if (!['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired'].includes(status)) {
    throw new AppError('Unknown quotation status.', 422);
  }

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'accepted') patch.accepted_at = new Date().toISOString();
  if (status === 'declined') patch.declined_at = new Date().toISOString();

  const { data, error } = await supabase.from('quotations').update(patch).eq('id', req.params.id).select('*').single();
  if (error) throw new AppError('Unable to update the quotation.', 500, [error]);

  await safeAudit({ action: 'update', entityId: String(data.id), entityType: 'quotations', newData: { status }, req });
  return sendSuccess(res, 'Quotation updated.', data);
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

  const { data, error } = await supabase
    .from('quotations')
    .select(
      'quote_code, title, currency, adults, children, travel_date, items, total_amount, notes, valid_until, status, tour_id, customer_name, viewed_at, accepted_at, declined_at'
    )
    .eq('public_token', token)
    .is('deleted_at', null)
    .maybeSingle();

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
  if (hasLapsed(data.valid_until) && ['draft', 'sent', 'viewed'].includes(String(data.status))) {
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
    .update({ status: 'accepted', accepted_at: acceptedAt, acceptance, updated_at: acceptedAt })
    .eq('id', quotation.id)
    // Only from a state that can still be accepted, so two simultaneous
    // requests cannot both win.
    .in('status', ['draft', 'sent', 'viewed'])
    .select('quote_code, status, accepted_at')
    .maybeSingle();

  if (updateError) throw new AppError('Unable to record your acceptance.', 500, [updateError]);
  if (!updated) {
    return sendSuccess(res, 'This quotation is already accepted.', { status: 'accepted', accepted_at: quotation.accepted_at });
  }

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
      (acceptance.notes ? `\nTheir note: ${acceptance.notes}` : '')
  );

  // Tell the team. An accepted quotation nobody looks at is a lost booking, so
  // this goes to the same inbox that already receives enquiries.
  void (async () => {
    try {
      const recipient = await recipientFor('quotation_accepted');
      if (!recipient) return;
      await sendEmail({
        to: recipient,
        replyTo: acceptance.email || undefined,
        subject: `Quotation accepted — ${quotation.quote_code} · ${total}`,
        html: emailLayout(
          `Quotation accepted · ${escapeHtml(String(quotation.quote_code))}`,
          `<p><strong>${escapeHtml(acceptance.lead_traveller || 'A traveller')}</strong> accepted ${escapeHtml(
            String(quotation.title)
          )} — ${escapeHtml(total)}.</p>
           <p>${escapeHtml(acceptance.email || 'no email')}${acceptance.phone ? ` · ${escapeHtml(acceptance.phone)}` : ''}</p>
           ${acceptance.notes ? `<pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;color:#384540">${escapeHtml(acceptance.notes)}</pre>` : ''}
           <p style="color:#6b7280;font-size:13px">No payment has been taken. Confirm availability and follow up to turn this into a booking.</p>`
        ),
        text: `Quotation accepted ${quotation.quote_code}\n${acceptance.lead_traveller || 'A traveller'} — ${quotation.title} — ${total}\n${acceptance.email || 'no email'} ${acceptance.phone || ''}\n\n${acceptance.notes || ''}`
      });
    } catch {
      // Never let a notification failure undo an acceptance.
    }
  })();

  // And confirm to the traveller on the channel they came from.
  void emitNotification({
    type: 'QUOTATION_ACCEPTED',
    entityType: 'quotations',
    entityId: String(quotation.id),
    phone: String(quotation.customer_phone ?? acceptance.phone ?? ''),
    message: `Thank you — we've received your acceptance of quotation ${quotation.quote_code}.\n\n${quotation.title}\nTotal: ${total}\n\nNo payment has been taken. Our team will confirm availability and come back to you to arrange the details.`,
    templateKey: 'quotation_accepted',
    templateParameters: [String(acceptance.lead_traveller ?? 'there'), String(quotation.quote_code)],
    dedupeKey: `quotation_accepted:${quotation.id}`
  });

  return sendSuccess(res, 'Your acceptance has been recorded.', {
    status: 'accepted',
    accepted_at: updated.accepted_at
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
