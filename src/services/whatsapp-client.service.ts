import { AppError } from '../utils/api-response';

/**
 * WhatsApp Business Cloud API transport.
 *
 * Credentials live in the environment and are read here only — nothing in this
 * file is importable by the frontend, and no token, App Secret or phone number
 * id is ever returned to a caller or written to a log.
 */

export type WhatsAppConfig = {
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
  graphVersion: string;
  businessAccountId: string;
};

export const whatsappConfig = (): WhatsAppConfig => ({
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
  appSecret: process.env.WHATSAPP_APP_SECRET ?? '',
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
  graphVersion: process.env.WHATSAPP_GRAPH_VERSION || 'v21.0',
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? ''
});

/** Whether sending is possible at all. Reads as a boolean, never as a secret. */
export const isWhatsAppConfigured = (): boolean => {
  const config = whatsappConfig();
  return Boolean(config.phoneNumberId && config.accessToken);
};

/** Digits only, no plus — the shape Meta calls wa_id. */
export const toWaId = (phone: string): string => phone.replace(/[^0-9]/g, '');

export type SendResult = {
  waMessageId: string;
  raw: Record<string, unknown>;
};

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POST to the Graph API with a bounded retry.
 *
 * 429 and 5xx are transient — Meta rate-limits per phone number and sheds load
 * — so they are retried with exponential backoff, honouring Retry-After when
 * Meta sends one. 4xx other than 429 means the request itself is wrong and
 * retrying would only repeat the mistake, so those fail immediately.
 */
const graphPost = async (path: string, body: unknown): Promise<Record<string, unknown>> => {
  const config = whatsappConfig();
  if (!isWhatsAppConfigured()) {
    throw new AppError('WhatsApp is not configured on this server.', 503);
  }

  let lastError: AppError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.accessToken}`
        },
        body: JSON.stringify(body)
      });
    } catch (cause) {
      // Network-level failure: worth another try.
      lastError = new AppError('Could not reach WhatsApp.', 502);
      if (attempt < MAX_ATTEMPTS) await sleep(2 ** attempt * 250);
      continue;
    }

    if (response.ok) return (await response.json()) as Record<string, unknown>;

    const detail = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number; error_subcode?: number };
    };
    // Meta's message is safe to surface; the request body (which may carry a
    // traveller's phone number) deliberately is not.
    const message = detail.error?.message ?? `WhatsApp request failed (${response.status}).`;

    if (!RETRYABLE_STATUS.has(response.status) || attempt === MAX_ATTEMPTS) {
      throw new AppError(message, response.status === 429 ? 429 : 502, [
        { code: detail.error?.code, subcode: detail.error?.error_subcode }
      ]);
    }

    const retryAfter = Number(response.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 250);
    lastError = new AppError(message, 502);
  }

  throw lastError ?? new AppError('WhatsApp request failed.', 502);
};

const extractMessageId = (raw: Record<string, unknown>): string => {
  const messages = raw.messages as Array<{ id?: string }> | undefined;
  return messages?.[0]?.id ?? '';
};

/**
 * Free-form session message. Only valid inside the 24-hour customer-service
 * window; outside it Meta rejects the send and a template must be used. The
 * caller is expected to have checked the window — see canSendSessionMessage.
 */
export const sendTextMessage = async (to: string, body: string): Promise<SendResult> => {
  const config = whatsappConfig();
  const raw = await graphPost(`${config.phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toWaId(to),
    type: 'text',
    text: { preview_url: true, body }
  });
  return { waMessageId: extractMessageId(raw), raw };
};

/**
 * Approved template message — the only thing that may open a conversation or
 * reach a contact outside the service window.
 */
export const sendTemplateMessage = async (
  to: string,
  templateName: string,
  languageCode: string,
  bodyParameters: string[] = []
): Promise<SendResult> => {
  const config = whatsappConfig();
  const components = bodyParameters.length
    ? [{ type: 'body', parameters: bodyParameters.map((text) => ({ type: 'text', text })) }]
    : undefined;

  const raw = await graphPost(`${config.phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toWaId(to),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {})
    }
  });
  return { waMessageId: extractMessageId(raw), raw };
};

/** Mark an inbound message read, so the traveller sees the blue ticks. */
export const markMessageRead = async (waMessageId: string): Promise<void> => {
  const config = whatsappConfig();
  await graphPost(`${config.phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: waMessageId
  });
};

/** The 24-hour customer-service window, measured from the last inbound message. */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const canSendSessionMessage = (lastInboundAt: string | null | undefined): boolean => {
  if (!lastInboundAt) return false;
  const last = new Date(lastInboundAt).getTime();
  return Number.isFinite(last) && Date.now() - last < SERVICE_WINDOW_MS;
};
