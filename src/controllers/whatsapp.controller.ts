import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { AppError, sendSuccess } from '../utils/api-response';
import { supabase } from '../config/supabase';
import { safeAudit } from '../services/audit.service';
import {
  canSendSessionMessage,
  isWhatsAppConfigured,
  markMessageRead,
  sendTemplateMessage,
  sendTextMessage,
  toWaId,
  whatsappConfig
} from '../services/whatsapp-client.service';
import {
  contactByPhone,
  recordConversationMessage,
  resolveConversation,
  upsertContact
} from '../services/whatsapp-inbox.service';

// ── Webhook verification (GET) ──────────────────────────────────────────────

/**
 * Meta's subscription handshake. Echoes hub.challenge as plain text when the
 * verify token matches, and 403s otherwise — a wrong token must never look
 * like a successful subscription.
 */
export const verifyWebhook = (req: Request, res: Response) => {
  const config = whatsappConfig();
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && typeof token === 'string' && config.verifyToken && token === config.verifyToken) {
    return res.status(200).type('text/plain').send(String(challenge ?? ''));
  }
  return res.status(403).type('text/plain').send('Forbidden');
};

// ── Signature validation ────────────────────────────────────────────────────

/**
 * X-Hub-Signature-256 is an HMAC-SHA256 of the raw request body keyed with the
 * App Secret. Compared with a timing-safe equal so the comparison itself
 * cannot leak the expected value byte by byte.
 */
const signatureValid = (req: Request): boolean => {
  const config = whatsappConfig();
  if (!config.appSecret) return false;

  const header = req.get('x-hub-signature-256');
  if (!header?.startsWith('sha256=')) return false;

  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!raw?.length) return false;

  const expected = createHmac('sha256', config.appSecret).update(raw).digest('hex');
  const received = header.slice('sha256='.length);
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(received, 'utf8');
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
};

// ── Inbound processing ──────────────────────────────────────────────────────

type WhatsAppValue = {
  metadata?: { phone_number_id?: string };
  contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
  messages?: Array<{
    id?: string;
    from?: string;
    type?: string;
    timestamp?: string;
    text?: { body?: string };
    button?: { text?: string };
    interactive?: { list_reply?: { title?: string }; button_reply?: { title?: string } };
  }>;
  statuses?: Array<{
    id?: string;
    status?: string;
    timestamp?: string;
    errors?: Array<{ code?: number; title?: string; message?: string }>;
  }>;
};

/**
 * Record the delivery before acting on it. The unique event_key means a
 * redelivered webhook — Meta retries until it gets a 200 — conflicts here and
 * returns false, so no message, conversation or business action is repeated.
 */
const claimEvent = async (key: string, type: string, payload: unknown): Promise<boolean> => {
  const { error } = await supabase
    .from('whatsapp_webhook_events')
    .insert({ event_key: key, event_type: type, payload: payload as Record<string, unknown> });
  // 23505 = unique violation = already handled.
  if (error && (error as { code?: string }).code === '23505') return false;
  if (error) throw error;
  return true;
};

/** The readable text of an inbound message, whatever shape it arrived in. */
const inboundText = (message: NonNullable<WhatsAppValue['messages']>[number]): string =>
  message.text?.body ??
  message.button?.text ??
  message.interactive?.button_reply?.title ??
  message.interactive?.list_reply?.title ??
  `[${message.type ?? 'unsupported'} message]`;

const handleInbound = async (value: WhatsAppValue) => {
  for (const message of value.messages ?? []) {
    const waMessageId = message.id;
    const from = message.from;
    if (!waMessageId || !from) continue;

    if (!(await claimEvent(`msg:${waMessageId}`, 'message', message))) continue;

    const profileName = value.contacts?.find((c) => c.wa_id === from)?.profile?.name;
    const contact = await upsertContact(toWaId(from), profileName, true);
    const conversationId = await resolveConversation(contact);

    const content = inboundText(message);
    const aiMessageId = await recordConversationMessage(conversationId, 'user', content, {
      wa_message_id: waMessageId,
      message_type: message.type ?? 'text'
    });

    await supabase.from('whatsapp_messages').insert({
      wa_message_id: waMessageId,
      contact_id: contact.id,
      conversation_id: conversationId,
      ai_message_id: aiMessageId,
      direction: 'inbound',
      message_type: message.type ?? 'text',
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      payload: message as unknown as Record<string, unknown>
    });

    // Blue ticks. Best-effort: a failure here must not fail the webhook.
    void markMessageRead(waMessageId).catch(() => undefined);
  }
};

const STATUS_TIMESTAMPS: Record<string, string> = {
  sent: 'sent_at',
  delivered: 'delivered_at',
  read: 'read_at',
  failed: 'failed_at'
};

/** Status callbacks only ever move a message forward, never backwards. */
const STATUS_RANK: Record<string, number> = { accepted: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

const handleStatuses = async (value: WhatsAppValue) => {
  for (const status of value.statuses ?? []) {
    const waMessageId = status.id;
    const next = status.status;
    if (!waMessageId || !next) continue;

    if (!(await claimEvent(`status:${waMessageId}:${next}`, 'status', status))) continue;

    const { data: existing } = await supabase
      .from('whatsapp_messages')
      .select('id, status')
      .eq('wa_message_id', waMessageId)
      .maybeSingle();
    if (!existing) continue;

    // Meta can deliver 'sent' after 'read' on a retry; keep the furthest state.
    if ((STATUS_RANK[next] ?? 0) < (STATUS_RANK[String(existing.status)] ?? 0) && next !== 'failed') continue;

    const patch: Record<string, unknown> = { status: next, updated_at: new Date().toISOString() };
    const column = STATUS_TIMESTAMPS[next];
    if (column) patch[column] = new Date(Number(status.timestamp ?? 0) * 1000 || Date.now()).toISOString();
    if (next === 'failed') {
      patch.error_code = status.errors?.[0]?.code ? String(status.errors[0].code) : null;
      patch.error_message = status.errors?.[0]?.title ?? status.errors?.[0]?.message ?? null;
    }

    await supabase.from('whatsapp_messages').update(patch).eq('id', existing.id);
  }
};

/**
 * Meta retries anything that is not a 2xx, so this answers 200 for every
 * authenticated delivery — including ones it cannot make sense of. A parsing
 * problem is ours to investigate, not a reason to make Meta retry forever.
 */
export const receiveWebhook = asyncHandler(async (req, res) => {
  if (!signatureValid(req)) {
    // 403 rather than 200: an unsigned or wrongly signed request is not from
    // Meta and must not be acknowledged as processed.
    throw new AppError('Invalid webhook signature.', 403);
  }

  const body = req.body as { entry?: Array<{ changes?: Array<{ value?: WhatsAppValue }> }> };

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;
      try {
        await handleInbound(value);
        await handleStatuses(value);
      } catch (error) {
        // Log the shape, never the traveller's message content.
        console.error('[whatsapp] webhook processing failed', {
          messages: value.messages?.length ?? 0,
          statuses: value.statuses?.length ?? 0,
          error: error instanceof Error ? error.message : 'unknown'
        });
      }
    }
  }

  return res.status(200).json({ received: true });
});

// ── Admin send ──────────────────────────────────────────────────────────────

/**
 * Send a message to a traveller from the admin.
 *
 * The 24-hour rule is enforced here rather than left to Meta: outside the
 * service window a free-form reply is refused with an explanation, so an agent
 * learns to use a template instead of seeing an opaque API error.
 */
export const sendMessage = asyncHandler(async (req, res) => {
  if (!isWhatsAppConfigured()) throw new AppError('WhatsApp is not configured on this server.', 503);

  const { to, body, template_name: templateName, language = 'en', parameters = [] } = req.body as {
    to?: string;
    body?: string;
    template_name?: string;
    language?: string;
    parameters?: string[];
  };

  if (!to) throw new AppError('A recipient phone number is required.', 422);
  if (!templateName && !body?.trim()) throw new AppError('A message body or template name is required.', 422);

  const waId = toWaId(to);
  const contact = await upsertContact(waId);
  if (contact.blocked) throw new AppError('This contact has been blocked.', 409);

  const useTemplate = Boolean(templateName);
  if (!useTemplate && !canSendSessionMessage(contact.last_inbound_at)) {
    throw new AppError(
      'This contact is outside the 24-hour customer-service window. Send an approved template instead.',
      409
    );
  }

  const result = useTemplate
    ? await sendTemplateMessage(waId, templateName as string, language, parameters)
    : await sendTextMessage(waId, body as string);

  const conversationId = await resolveConversation(contact);
  const content = useTemplate ? `[template: ${templateName}] ${parameters.join(' | ')}`.trim() : (body as string);
  const aiMessageId = await recordConversationMessage(conversationId, 'agent', content, {
    wa_message_id: result.waMessageId,
    sent_by: req.user?.sub ?? null
  });

  await supabase.from('whatsapp_messages').insert({
    wa_message_id: result.waMessageId,
    contact_id: contact.id,
    conversation_id: conversationId,
    ai_message_id: aiMessageId,
    direction: 'outbound',
    message_type: useTemplate ? 'template' : 'text',
    status: 'accepted',
    template_name: templateName ?? null,
    sent_at: new Date().toISOString(),
    payload: result.raw
  });

  await safeAudit({
    action: 'create',
    entityId: result.waMessageId,
    entityType: 'whatsapp_messages',
    newData: { to: waId, template: templateName ?? null },
    req
  });

  return sendSuccess(res, 'Message sent.', {
    wa_message_id: result.waMessageId,
    conversation_id: conversationId
  });
});

/** Configuration health, without ever returning a credential. */
export const whatsappStatus = asyncHandler(async (_req, res) => {
  const config = whatsappConfig();
  return sendSuccess(res, 'WhatsApp status.', {
    configured: isWhatsAppConfigured(),
    webhook_ready: Boolean(config.verifyToken && config.appSecret),
    graph_version: config.graphVersion,
    // Presence only — never the values.
    has_phone_number_id: Boolean(config.phoneNumberId),
    has_access_token: Boolean(config.accessToken),
    has_app_secret: Boolean(config.appSecret),
    has_business_account_id: Boolean(config.businessAccountId)
  });
});

/** Conversation list for the admin inbox. */
export const listConversations = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, visitor_name, visitor_phone, visitor_country, status, lead_status, handoff_required, booking_request_id, conversation_summary, updated_at, whatsapp_contact_id')
    .eq('channel', 'whatsapp')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw new AppError('Unable to load WhatsApp conversations.', 500, [error]);
  return sendSuccess(res, 'Conversations fetched successfully.', data ?? []);
});

/** Full thread for one conversation, newest last. */
export const getConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [{ data: conversation }, { data: messages }, { data: deliveries }] = await Promise.all([
    supabase.from('ai_conversations').select('*').eq('id', id).maybeSingle(),
    supabase.from('ai_messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true }),
    supabase.from('whatsapp_messages').select('ai_message_id, status, error_message').eq('conversation_id', id)
  ]);
  if (!conversation) throw new AppError('Conversation not found.', 404);

  const statusByMessage = new Map((deliveries ?? []).map((row) => [String(row.ai_message_id), row]));
  return sendSuccess(res, 'Conversation fetched successfully.', {
    conversation,
    messages: (messages ?? []).map((message) => ({
      ...message,
      delivery: statusByMessage.get(String(message.id)) ?? null
    }))
  });
});
