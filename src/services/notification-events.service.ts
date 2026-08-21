import { supabase } from '../config/supabase';
import {
  canSendSessionMessage,
  isWhatsAppConfigured,
  sendTemplateMessage,
  sendTextMessage,
  toWaId
} from './whatsapp-client.service';
import { recordConversationMessage, resolveConversation, upsertContact } from './whatsapp-inbox.service';

/**
 * Event-driven notifications (§14).
 *
 * Business code emits an event and stops caring how it reaches the traveller.
 * Channels consume events, so adding email or SMS later means registering
 * another channel rather than editing every place that wants to notify.
 *
 *   BUSINESS EVENT -> notification service -> [ whatsapp | email* | sms* ]
 *                                              (*not built yet)
 *
 * Separate from notification.service.ts, which is the existing per-booking
 * email + HubSpot path. That one fires for a specific thing that happened;
 * this one is the generic outbox any future channel can subscribe to.
 */

export type NotificationEventType =
  | 'LEAD_CREATED'
  | 'QUOTATION_READY'
  | 'QUOTATION_UPDATED'
  | 'QUOTATION_ACCEPTED'
  | 'BOOKING_CONFIRMED';

export type NotificationEvent = {
  type: NotificationEventType;
  entityType?: string;
  entityId?: string;
  /** Recipient. No phone means nothing to send — recorded as skipped. */
  phone?: string | null;
  /** Body for a session message, and the fallback if no template is mapped. */
  message: string;
  /** Internal template key; resolved through whatsapp_templates. */
  templateKey?: string;
  templateParameters?: string[];
  /**
   * Makes the event idempotent. Two emits with the same key send once — a
   * retry, a double-click or a replayed webhook collides instead of messaging
   * the traveller twice.
   */
  dedupeKey: string;
  /**
   * Marketing sends need explicit marketing consent; transactional ones ride
   * on the WhatsApp opt-in the traveller gave by messaging us.
   */
  marketing?: boolean;
};

type Outcome = { status: 'sent' | 'skipped' | 'failed'; detail?: string };

const claim = async (event: NotificationEvent): Promise<string | null> => {
  const { data, error } = await supabase
    .from('notification_events')
    .insert({
      event_type: event.type,
      entity_type: event.entityType ?? null,
      entity_id: event.entityId ?? null,
      channel: 'whatsapp',
      dedupe_key: event.dedupeKey,
      payload: {
        message: event.message,
        template_key: event.templateKey ?? null,
        parameters: event.templateParameters ?? []
      }
    })
    .select('id')
    .single();

  // 23505 = this event was already emitted; do not send again.
  if (error && (error as { code?: string }).code === '23505') return null;
  if (error) throw error;
  return String(data.id);
};

const settle = async (id: string, outcome: Outcome) => {
  await supabase
    .from('notification_events')
    .update({
      status: outcome.status,
      detail: outcome.detail ?? null,
      sent_at: outcome.status === 'sent' ? new Date().toISOString() : null
    })
    .eq('id', id);
};

const templateFor = async (key: string) => {
  const { data } = await supabase
    .from('whatsapp_templates')
    .select('meta_template_name, language')
    .eq('internal_key', key)
    .maybeSingle();
  return data as { meta_template_name: string; language: string } | null;
};

/**
 * Deliver over WhatsApp, respecting consent and the messaging rules.
 *
 * Inside the 24-hour service window a plain message is allowed. Outside it,
 * only an approved template — and if no template is mapped yet, the event is
 * recorded as skipped with the reason rather than attempted and failed. That
 * keeps the platform on the right side of Meta's rules by construction.
 */
const deliverWhatsApp = async (event: NotificationEvent): Promise<Outcome> => {
  if (!isWhatsAppConfigured()) return { status: 'skipped', detail: 'WhatsApp is not configured.' };
  if (!event.phone) return { status: 'skipped', detail: 'No WhatsApp number for this recipient.' };

  const waId = toWaId(event.phone);
  if (!waId) return { status: 'skipped', detail: 'Unusable phone number.' };

  const contact = await upsertContact(waId);
  if (contact.blocked) return { status: 'skipped', detail: 'Contact is blocked.' };
  if (!contact.whatsapp_opt_in) return { status: 'skipped', detail: 'No WhatsApp opt-in on record.' };
  if (event.marketing) {
    const { data } = await supabase.from('whatsapp_contacts').select('marketing_opt_in').eq('id', contact.id).maybeSingle();
    if (!data?.marketing_opt_in) return { status: 'skipped', detail: 'No marketing opt-in on record.' };
  }

  const inWindow = canSendSessionMessage(contact.last_inbound_at);
  const template = event.templateKey ? await templateFor(event.templateKey) : null;

  try {
    let waMessageId = '';
    let usedTemplate: string | null = null;

    if (inWindow) {
      ({ waMessageId } = await sendTextMessage(waId, event.message));
    } else if (template) {
      ({ waMessageId } = await sendTemplateMessage(
        waId,
        template.meta_template_name,
        template.language,
        event.templateParameters ?? []
      ));
      usedTemplate = template.meta_template_name;
    } else {
      return {
        status: 'skipped',
        detail: 'Outside the 24-hour window and no approved template is mapped for this event.'
      };
    }

    // Mirror it into the conversation so the inbox shows what the traveller
    // received — an automated message is still part of the thread.
    const conversationId = await resolveConversation(contact);
    const aiMessageId = await recordConversationMessage(conversationId, 'assistant', event.message, {
      wa_message_id: waMessageId,
      notification_event: event.type
    });

    await supabase.from('whatsapp_messages').insert({
      wa_message_id: waMessageId,
      contact_id: contact.id,
      conversation_id: conversationId,
      ai_message_id: aiMessageId,
      direction: 'outbound',
      message_type: usedTemplate ? 'template' : 'text',
      status: 'accepted',
      template_name: usedTemplate,
      sent_at: new Date().toISOString(),
      payload: { notification_event: event.type }
    });

    return { status: 'sent' };
  } catch (error) {
    return { status: 'failed', detail: error instanceof Error ? error.message : 'Send failed.' };
  }
};

/**
 * Emit a business event.
 *
 * Never throws: a notification failing must not roll back the thing that
 * happened. The outcome is recorded on the event so the admin can see what
 * was sent, skipped or failed, and why.
 */
export const emitNotification = async (event: NotificationEvent): Promise<Outcome> => {
  try {
    const id = await claim(event);
    if (!id) return { status: 'skipped', detail: 'Already sent for this event.' };

    const outcome = await deliverWhatsApp(event);
    await settle(id, outcome);
    return outcome;
  } catch (error) {
    // Log the shape only — never the traveller's message or number.
    console.error('[notifications] emit failed', {
      type: event.type,
      error: error instanceof Error ? error.message : 'unknown'
    });
    return { status: 'failed', detail: 'Notification could not be recorded.' };
  }
};
