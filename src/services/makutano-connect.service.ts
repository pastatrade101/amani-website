import { AppError } from '../utils/api-response';

/**
 * Makutano Connect — the central WhatsApp/booking infrastructure this site is a
 * tenant of (https://connect.makutano.co.tz).
 *
 * Two integrations live here, both gated by environment so the direct-to-Meta
 * paths remain the instant rollback:
 *
 *   WHATSAPP_TRANSPORT=makutano   outbound WhatsApp goes through Connect's API
 *                                 instead of this server calling Meta itself
 *   MAKUTANO_SYNC_BOOKINGS=on     public booking enquiries are dual-written to
 *                                 Connect (fire-and-forget, never blocks)
 *
 * The API key is server-only. Nothing from this file is importable by the
 * frontend, and the key never appears in a response or a log.
 */

const apiUrl = (): string => (process.env.MAKUTANO_API_URL ?? '').replace(/\/+$/, '');
const apiKey = (): string => process.env.MAKUTANO_API_KEY ?? '';

const configured = (): boolean => Boolean(apiUrl() && apiKey());

/** Outbound WhatsApp routes through Connect only when explicitly switched on. */
export const connectTransportEnabled = (): boolean =>
  configured() && process.env.WHATSAPP_TRANSPORT === 'makutano';

/** Booking enquiries dual-write to Connect only when explicitly switched on. */
export const connectBookingSyncEnabled = (): boolean =>
  configured() && process.env.MAKUTANO_SYNC_BOOKINGS === 'on';

type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

const post = async <T>(
  path: string,
  body: unknown,
  { idempotencyKey, timeoutMs = 25_000 }: { idempotencyKey?: string; timeoutMs?: number } = {}
): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiUrl()}/api/v1${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const payload = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!payload) throw new AppError(`Makutano Connect returned a non-JSON response (HTTP ${res.status}).`, 502);
    if (!payload.success) {
      // Shape matches describeSendFailure's expectations: message + a coded first error.
      throw new AppError(payload.error.message, res.status, [{ code: payload.error.code }]);
    }
    return payload.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    const timedOut = error instanceof Error && error.name === 'AbortError';
    throw new AppError(timedOut ? 'Makutano Connect timed out.' : 'Makutano Connect is unreachable.', 504);
  } finally {
    clearTimeout(timer);
  }
};

type ConnectSendResult = { id: string; waMessageId: string; status: string };

type ConnectContent =
  | { type: 'text'; text: string; previewUrl?: boolean }
  | { type: 'template'; templateName: string; language: string; components?: unknown[] };

/**
 * Send one WhatsApp message through Connect, synchronously. dispatch:'sync'
 * makes Connect perform the Meta call inside the request and hand back the real
 * wamid — which the inbox threads statuses on — preserving this codebase's
 * "no message id means the send failed" contract exactly.
 */
export const sendViaConnect = async (
  to: string,
  content: ConnectContent
): Promise<{ waMessageId: string; raw: Record<string, unknown> }> => {
  const result = await post<ConnectSendResult>('/whatsapp/messages', { to, content, dispatch: 'sync' });
  if (!result.waMessageId) throw new AppError('Makutano Connect accepted the send but returned no message id.', 502);
  return { waMessageId: result.waMessageId, raw: result as unknown as Record<string, unknown> };
};

/**
 * Dual-write a stored booking enquiry to Connect. Fire-and-forget: every
 * failure is logged and swallowed, because the local row is already safe and
 * the traveller's submission must never fail on an infrastructure hop.
 *
 * The local row id doubles as the Idempotency-Key, so retries and double
 * invocations cannot create two enquiries in Connect. Connect's own WhatsApp
 * acknowledgement is disabled — this site already sends one.
 */
export const syncBookingToMakutano = async (booking: Record<string, unknown>): Promise<void> => {
  if (!connectBookingSyncEnabled()) return;
  try {
    const fullName = String(booking.full_name ?? '').trim();
    const [firstName, ...rest] = fullName.split(/\s+/);
    const travelDate = String(booking.travel_date ?? '').slice(0, 10);
    const estimated = booking.estimated_amount == null ? null : Number(booking.estimated_amount);

    await post(
      '/booking-requests',
      {
        customer: {
          firstName: firstName || 'Traveller',
          lastName: rest.join(' '),
          email: String(booking.email ?? '') || null,
          phone: String(booking.phone ?? '') || null,
          whatsappPhone: String(booking.phone ?? '') || null
        },
        source: 'WEBSITE',
        currency: String(booking.currency ?? 'USD'),
        startDate: /^\d{4}-\d{2}-\d{2}$/.test(travelDate) ? `${travelDate}T00:00:00.000Z` : null,
        adults: Number(booking.number_of_adults ?? 1) || 1,
        children: Number(booking.number_of_children ?? 0) || 0,
        estimatedTotal: estimated && estimated > 0 ? estimated.toFixed(2) : null,
        notes:
          [String(booking.message ?? ''), String(booking.special_requests ?? '')].filter(Boolean).join('\n\n') || null,
        externalReference: String(booking.booking_code ?? booking.id ?? ''),
        externalSource: 'goldfinch',
        metadata: {
          goldfinch_booking_id: String(booking.id ?? ''),
          goldfinch_source: String(booking.source ?? ''),
          lead_context: (booking.lead_context as Record<string, unknown>) ?? null
        },
        sendAcknowledgement: false
      },
      { idempotencyKey: `gf-booking-${String(booking.id ?? booking.booking_code ?? '')}` }
    );
  } catch (error) {
    console.error('[makutano-connect] booking sync failed (local booking unaffected):', (error as Error).message);
  }
};
