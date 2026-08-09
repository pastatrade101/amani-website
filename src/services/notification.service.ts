import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { emailLayout, escapeHtml, sendEmail } from './email.service';
import { syncToHubSpot } from './hubspot.service';

/**
 * Where a staff notification goes, resolved per form type so tour enquiries and
 * general trip planning can reach different inboxes.
 *
 * Settings first (editable in the CMS without a redeploy), then the env var.
 * Keys are stored with is_public false, so they never reach the unauthenticated
 * public settings endpoint.
 */
const recipientFor = async (source: string): Promise<string> => {
  const keys = [`enquiry_email_${source}`, 'enquiry_email_default'];

  try {
    const { data } = await supabase
      .from('website_settings')
      .select('setting_key,setting_value')
      .in('setting_key', keys);

    const map = new Map((data ?? []).map((row: { setting_key: string; setting_value: unknown }) => [row.setting_key, row.setting_value]));
    for (const key of keys) {
      const value = String(map.get(key) ?? '').replace(/^"|"$/g, '').trim();
      if (value.includes('@')) return value;
    }
  } catch {
    // Settings unavailable — fall through to the env default.
  }

  return env.SPECIALIST_EMAIL || '';
};

/** Human label for the form an enquiry came from. */
const FORM_LABELS: Record<string, string> = {
  homepage_trip_planner: 'Trip planner (homepage)',
  category_enquiry: 'Category enquiry',
  tour_enquiry: 'Tour enquiry',
  website_booking_form: 'Booking form',
  plan_my_trip: 'Plan my trip',
  email_itinerary: 'Itinerary by email',
  ai_handoff: 'AI advisor handoff'
};

type BookingLike = Record<string, unknown>;

/**
 * Normalised, CRM-ready view of a booking request. This is the single shape we
 * hand to every downstream integration (HubSpot contact/deal, email, WhatsApp)
 * so each one reads tidy fields instead of digging through the raw row +
 * `lead_context` blob. Add a new channel by consuming a `CrmLead`.
 */
export type CrmLead = {
  bookingCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  tripId: string | null;
  tripTitle: string;
  destinationInterest: string;
  travelDate: string;
  travelMonth: string;
  travellerType: string;
  adults: number;
  children: number;
  budgetRange: string;
  tripDuration: string;
  dateFlexibility: string;
  travelInterests: string;
  accommodationPreference: string;
  specialRequests: string;
  message: string;
  sourcePageUrl: string;
  leadSource: string;
  stage: string;
  summary: string;
};

const str = (value: unknown): string => (value == null ? '' : String(value)).trim();

/** Flattens a booking row (+ its lead_context) into a CRM-ready lead. */
export const buildLeadFromBooking = (booking: BookingLike): CrmLead => {
  const lc = (booking.lead_context as Record<string, unknown> | null) ?? {};
  const tour = (booking.tours as Record<string, unknown> | null) ?? null;

  // The contextual forms nest their data ({ form_type, category, tour, answers,
  // ... }); the older forms write flat keys. Read both so one lead builder keeps
  // serving every form, old and new.
  const answers = (lc.answers as Record<string, unknown> | null) ?? {};
  const ctxCategory = (lc.category as Record<string, unknown> | null) ?? {};
  const ctxTour = (lc.tour as Record<string, unknown> | null) ?? {};
  const pick = (key: string): string => str(answers[key]) || str(lc[key]);

  const fullName = str(booking.full_name);
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const destinationInterest = pick('destination_interest') || str(ctxCategory.name);
  const tripTitle = str(lc.selected_trip) || str(tour?.title) || str(ctxTour.title) || str(ctxCategory.name) || destinationInterest;

  // Exact dates (Plan My Trip) read back into a friendly travel-date string.
  const exactStart = str(lc.exact_start_date);
  const exactEnd = str(lc.exact_end_date);
  const travelDate = str(booking.travel_date) || exactStart;

  const lead: CrmLead = {
    bookingCode: str(booking.booking_code),
    firstName: nameParts[0] ?? '',
    lastName: nameParts.slice(1).join(' '),
    fullName,
    email: str(booking.email),
    phone: str(booking.phone),
    country: str(booking.country),
    tripId: (booking.tour_id as string | null) ?? null,
    tripTitle,
    destinationInterest,
    travelDate,
    travelMonth: pick('travel_month'),
    travellerType: pick('traveller_type'),
    adults: Number(booking.number_of_adults ?? 0),
    children: Number(booking.number_of_children ?? 0),
    budgetRange: pick('budget_range') || pick('budget_per_person'),
    tripDuration: pick('trip_duration'),
    dateFlexibility: pick('date_flexibility'),
    travelInterests: pick('travel_interests') || pick('experience_interests') || pick('trip_interests'),
    accommodationPreference: pick('accommodation_preference') || pick('accommodation_style'),
    specialRequests: str(booking.special_requests),
    message: str(booking.message),
    sourcePageUrl: str(lc.source_page_url) || str((lc.page as Record<string, unknown> | null)?.url),
    leadSource: str(lc.lead_source) || 'Website Booking Request',
    stage: 'New Lead',
    summary: ''
  };

  // When/duration line prefers exact dates, then month, then a duration band.
  const whenLine = exactStart && exactEnd
    ? `Dates: ${exactStart} → ${exactEnd}`
    : lead.travelMonth
      ? `Travel month: ${lead.travelMonth}`
      : lead.travelDate
        ? `Preferred date: ${lead.travelDate}`
        : '';

  // Anything the visitor answered that is not already one of the named lines
  // above. Category-specific questions live only here, so without this a
  // "river crossings vs calving season" answer would never reach a human.
  const NAMED = new Set([
    'destination_interest', 'travel_month', 'traveller_type', 'budget_range', 'budget_per_person',
    'trip_duration', 'date_flexibility', 'travel_interests', 'experience_interests', 'trip_interests',
    'accommodation_preference', 'accommodation_style', 'special_requests', 'message',
    'full_name', 'email', 'phone', 'country', 'adults', 'children'
  ]);
  const label = (key: string) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const show = (value: unknown): string => {
    if (Array.isArray(value)) return value.map((item) => str(item)).filter(Boolean).join(', ');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return str(value);
  };
  const extras = Object.entries(answers)
    .filter(([key]) => !NAMED.has(key))
    .map(([key, value]) => [label(key), show(value)] as const)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}: ${value}`);

  // Human-readable brief — handy for the email body, WhatsApp message and the
  // HubSpot note/message field (which accepts free text without custom props).
  const lines = [
    lead.tripTitle ? `Trip: ${lead.tripTitle}` : 'General trip request',
    str(ctxCategory.name) && str(ctxCategory.name) !== lead.tripTitle ? `Category: ${str(ctxCategory.name)}` : '',
    whenLine ? `${whenLine}${lead.dateFlexibility ? ` (flexibility: ${lead.dateFlexibility})` : ''}` : '',
    lead.tripDuration ? `Duration: ${lead.tripDuration}` : '',
    `Travellers: ${lead.adults} adults, ${lead.children} children${lead.travellerType ? ` — ${lead.travellerType}` : ''}`,
    lead.budgetRange ? `Budget: ${lead.budgetRange}` : '',
    lead.accommodationPreference ? `Accommodation: ${lead.accommodationPreference}` : '',
    lead.travelInterests ? `Interests: ${lead.travelInterests}` : '',
    ...extras,
    lead.specialRequests ? `Special requests: ${lead.specialRequests}` : '',
    lead.message ? `Notes: ${lead.message}` : '',
    lead.sourcePageUrl ? `Enquired from: ${lead.sourcePageUrl}` : ''
  ].filter(Boolean);
  lead.summary = lines.join('\n');

  return lead;
};

/**
 * Internal notification hook. No email/WhatsApp provider is wired yet, so in
 * development we log a clean brief. This NEVER throws — booking creation must
 * not be blocked by a notification failure.
 */
export const sendBookingNotification = async (booking: BookingLike): Promise<void> => {
  try {
    const lead = buildLeadFromBooking(booking);

    if (env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.info(
        `[notification] New booking ${lead.bookingCode || '(no code)'} from ` +
          `${lead.fullName || 'unknown'} <${lead.email || 'no-email'}>\n${lead.summary}`
      );
    }

    const source = str(booking.source) || 'website_booking_form';
    const formLabel = FORM_LABELS[source] ?? source;

    // ── Staff notification ────────────────────────────────────────────────────
    // Every interpolated value is escaped: the summary carries the visitor's own
    // message and special requests.
    const recipient = await recipientFor(source);
    if (recipient) {
      await sendEmail({
        to: recipient,
        replyTo: lead.email || undefined,
        subject: `${formLabel} — ${lead.tripTitle || lead.destinationInterest || lead.country || lead.fullName || 'new enquiry'}`,
        html: emailLayout(
          `${escapeHtml(formLabel)} · ${escapeHtml(lead.bookingCode)}`,
          `<p><strong>${escapeHtml(lead.fullName || 'A traveller')}</strong> &lt;${escapeHtml(lead.email || 'no email')}&gt;${
            lead.phone ? ` · ${escapeHtml(lead.phone)}` : ''
          }</p>
           <pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;color:#384540">${escapeHtml(lead.summary)}</pre>`
        ),
        text: `${formLabel} ${lead.bookingCode}\n${lead.fullName} <${lead.email}>\n\n${lead.summary}`
      });
    }

    // ── Traveller confirmation ────────────────────────────────────────────────
    // Sent after the staff alert so a failure here cannot stop the team hearing
    // about a live lead.
    if (lead.email) {
      const firstName = lead.firstName || lead.fullName || 'there';
      const what = lead.tripTitle
        ? `your enquiry about <strong>${escapeHtml(lead.tripTitle)}</strong>`
        : 'your trip enquiry';

      await sendEmail({
        to: lead.email,
        subject: lead.tripTitle ? `We've got your enquiry — ${lead.tripTitle}` : "We've got your trip enquiry",
        html: emailLayout(
          `Thank you, ${escapeHtml(firstName)}`,
          `<p>We have received ${what}. A local specialist will confirm availability and send you a personalised quotation within one business day.</p>
           <p style="color:#8a948f;font-size:13px">No payment is required at this stage.</p>
           ${lead.bookingCode ? `<p style="font-size:13px">Your reference: <strong>${escapeHtml(lead.bookingCode)}</strong></p>` : ''}
           <p style="margin-top:18px;font-size:13px;color:#8a948f">What you told us:</p>
           <pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;color:#384540;background:#f4f6f4;padding:12px;border-radius:8px">${escapeHtml(
             lead.summary
           )}</pre>`
        ),
        text: `Thank you, ${firstName}.\n\nWe have received your enquiry. A local specialist will confirm availability and send a personalised quotation within one business day. No payment is required at this stage.\n${
          lead.bookingCode ? `\nYour reference: ${lead.bookingCode}\n` : ''
        }\nWhat you told us:\n${lead.summary}`
      });
    }
    // TODO(whatsapp): notify the on-call specialist with a short brief.
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[notification] Failed to send booking notification', error);
  }
};

/**
 * Best-effort HubSpot lead sync. Skips silently (and logs) when no token is
 * configured. Never throws — wrapped so booking creation is never blocked.
 */
export const syncBookingToHubSpot = async (booking: BookingLike): Promise<void> => {
  try {
    const lead = buildLeadFromBooking(booking);
    await syncToHubSpot('booking', {
      booking_code: lead.bookingCode,
      full_name: lead.fullName,
      email: lead.email,
      phone: lead.phone,
      country: lead.country,
      destination: lead.tripTitle,
      budget_tier: lead.budgetRange,
      message: lead.summary || lead.message,
      lead_source: lead.leadSource,
      stage: lead.stage,
      // Carry the full structured lead so the deal-creation step (and the sync
      // log) has everything it needs without re-deriving it.
      lead
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[hubspot] Booking sync skipped due to error', error);
  }
};
