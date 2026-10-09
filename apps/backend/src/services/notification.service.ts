import { env } from '../config/env';
import { supabase } from '../config/supabase';
import {
  EMAIL_COLORS,
  emailCaption,
  emailDetails,
  emailLayout,
  escapeHtml,
  loadEmailBrand,
  sendEmail,
  type EmailDetail
} from './email.service';
import { syncToHubSpot } from './hubspot.service';

/**
 * Where a staff notification goes, resolved per form type so tour enquiries and
 * general trip planning can reach different inboxes.
 *
 * Settings first (editable in the CMS without a redeploy), then the env var,
 * then the contact email the website shows. That last step matters: with no
 * enquiry inbox configured every alert used to be skipped, so enquiries only
 * ever appeared in the CMS. Enquiry keys are stored with is_public false, so
 * they never reach the unauthenticated public settings endpoint.
 */
export const recipientFor = async (source: string): Promise<string> => {
  const keys = [`enquiry_email_${source}`, 'enquiry_email_default'];
  let contactEmail = '';

  try {
    const { data } = await supabase
      .from('website_settings')
      .select('setting_key,setting_value')
      .in('setting_key', [...keys, 'contact_email']);

    const map = new Map((data ?? []).map((row: { setting_key: string; setting_value: unknown }) => [row.setting_key, row.setting_value]));
    for (const key of keys) {
      const value = String(map.get(key) ?? '').replace(/^"|"$/g, '').trim();
      if (value.includes('@')) return value;
    }
    contactEmail = String(map.get('contact_email') ?? '').replace(/^"|"$/g, '').trim();
  } catch {
    // Settings unavailable — fall through to the env default.
  }

  return env.SPECIALIST_EMAIL || (contactEmail.includes('@') ? contactEmail : '');
};

/** Human label for the form an enquiry came from. */
const FORM_LABELS: Record<string, string> = {
  homepage_trip_planner: 'Trip planner (homepage)',
  category_enquiry: 'Category enquiry',
  tour_enquiry: 'Tour enquiry',
  website_booking_form: 'Booking form',
  plan_my_trip: 'Plan my trip',
  email_itinerary: 'Itinerary by email',
  ai_handoff: 'AI advisor handoff',
  ai_travel_advisor: 'AI Travel Advisor',
  contact_form: 'Contact form',
  quotation: 'Quotation'
};

// ── Shared senders ─────────────────────────────────────────────────────────────
// Every form reaches the team the same way: who it is from, everything they
// filled in as a table, a button to the record in the CMS, and Reply-To set to
// the visitor. Travellers get a branded acknowledgement of what they sent.

const phoneHref = (phone: string) => (phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : undefined);

/** Who a message is from, as rows for the details table. */
export const contactRows = (name: string, email: string, phone: string, country = ''): EmailDetail[] => [
  { label: 'Name', value: name },
  { label: 'Email', value: email, href: email ? `mailto:${email}` : undefined },
  { label: 'Phone', value: phone, href: phoneHref(phone) },
  { label: 'Country', value: country }
];

/** "Label: value" lines as table rows; a line without a label keeps its text. */
export const summaryRows = (summary: string): EmailDetail[] =>
  summary
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.indexOf(': ');
      return at > 0 && at <= 40 ? { label: line.slice(0, at), value: line.slice(at + 2) } : { label: 'Request', value: line };
    });

const detailsText = (rows: EmailDetail[]) =>
  rows.filter((row) => row.value.trim()).map((row) => `${row.label}: ${row.value.trim()}`).join('\n');

export type StaffAlert = {
  /** Form key: picks the inbox (enquiry_email_<source>) and the label. */
  source: string;
  subject: string;
  heading: string;
  /** One plain-text sentence above the tables. */
  intro?: string;
  contact: EmailDetail[];
  details: EmailDetail[];
  detailsTitle?: string;
  /** The visitor's address, so a reply goes straight to them. */
  replyTo?: string;
  /** Path of the record in the CMS, e.g. /admin/bookings. */
  cmsPath?: string;
  preheader?: string;
};

/** Emails the team about a submission. Never throws; false when nothing was sent. */
export const sendStaffAlert = async (alert: StaffAlert): Promise<boolean> => {
  try {
    const recipient = await recipientFor(alert.source);
    if (!recipient) {
      console.warn(`[notification] No staff inbox configured — "${alert.subject}" was not emailed.`);
      return false;
    }
    const { siteUrl } = await loadEmailBrand();
    const cta = alert.cmsPath && siteUrl ? { label: 'Open in the CMS', url: escapeHtml(`${siteUrl}${alert.cmsPath}`) } : undefined;
    const body = `${alert.intro ? `<p style="margin:0 0 6px">${escapeHtml(alert.intro)}</p>` : ''}
      ${alert.replyTo ? `<p style="margin:0;font-size:13px;color:${EMAIL_COLORS.muted}">Reply to this email to answer them directly.</p>` : ''}
      ${emailCaption('From')}${emailDetails(alert.contact)}
      ${emailCaption(alert.detailsTitle ?? 'Details')}${emailDetails(alert.details)}`;
    return await sendEmail({
      to: recipient,
      replyTo: alert.replyTo || undefined,
      subject: alert.subject,
      html: await emailLayout(escapeHtml(alert.heading), body, cta, { audience: 'staff', preheader: alert.preheader ?? alert.intro }),
      text: `${alert.heading}\n\n${detailsText(alert.contact)}\n\n${detailsText(alert.details)}`
    });
  } catch (error) {
    console.error('[notification] Staff alert failed:', error instanceof Error ? error.message : error);
    return false;
  }
};

export type TravellerAcknowledgement = {
  to: string;
  subject: string;
  heading: string;
  /** Paragraphs of HTML the caller has already escaped. */
  paragraphs: string[];
  reference?: string;
  details?: EmailDetail[];
  detailsTitle?: string;
  preheader?: string;
  text: string;
};

/** Tells a visitor we have what they sent, in the branded layout. Never throws. */
export const sendTravellerAcknowledgement = async (ack: TravellerAcknowledgement): Promise<boolean> => {
  try {
    if (!ack.to.includes('@')) return false;
    const body = `${ack.paragraphs.map((p) => `<p style="margin:0 0 14px">${p}</p>`).join('')}
      ${
        ack.reference
          ? `<p style="margin:0 0 6px;font-size:13px;color:${EMAIL_COLORS.muted}">Your reference: <strong style="display:inline-block;margin-left:4px;padding:3px 10px;border-radius:999px;background:${EMAIL_COLORS.cream};color:${EMAIL_COLORS.forest};font-size:13px;letter-spacing:.5px">${escapeHtml(ack.reference)}</strong></p>`
          : ''
      }
      ${ack.details?.length ? `${emailCaption(ack.detailsTitle ?? 'What you sent us')}${emailDetails(ack.details)}` : ''}`;
    return await sendEmail({
      to: ack.to,
      subject: ack.subject,
      html: await emailLayout(escapeHtml(ack.heading), body, undefined, { audience: 'traveller', preheader: ack.preheader }),
      text: ack.text
    });
  } catch (error) {
    console.error('[notification] Acknowledgement failed:', error instanceof Error ? error.message : error);
    return false;
  }
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
  // Multi-choice answers arrive as arrays; String(array) would print "Beach,Culture".
  const asText = (value: unknown): string => (Array.isArray(value) ? value.map(str).filter(Boolean).join(', ') : str(value));
  const pick = (key: string): string => asText(answers[key]) || asText(lc[key]);

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
    // Everything the visitor filled in, as a table; Reply-To is the visitor.
    const request = summaryRows(lead.summary);
    await sendStaffAlert({
      source,
      subject: `${formLabel} — ${lead.tripTitle || lead.destinationInterest || lead.country || lead.fullName || 'new enquiry'}`,
      heading: `${formLabel}${lead.bookingCode ? ` · ${lead.bookingCode}` : ''}`,
      intro: `New ${formLabel.toLowerCase()} from ${lead.fullName || 'a traveller'}${lead.tripTitle ? ` about ${lead.tripTitle}` : ''}.`,
      contact: [...contactRows(lead.fullName, lead.email, lead.phone, lead.country), { label: 'Reference', value: lead.bookingCode }],
      details: request,
      detailsTitle: 'Their request',
      replyTo: lead.email || undefined,
      cmsPath: '/admin/bookings'
    });

    // ── Traveller confirmation ────────────────────────────────────────────────
    // Sent after the staff alert so a failure here cannot stop the team hearing
    // about a live lead.
    if (lead.email) {
      const firstName = lead.firstName || lead.fullName || 'there';
      const what = lead.tripTitle
        ? `your enquiry about <strong>${escapeHtml(lead.tripTitle)}</strong>`
        : 'your trip enquiry';

      await sendTravellerAcknowledgement({
        to: lead.email,
        subject: lead.tripTitle ? `We've got your enquiry — ${lead.tripTitle}` : "We've got your trip enquiry",
        heading: `Thank you, ${firstName}`,
        paragraphs: [
          `We have received ${what}. A local specialist will confirm availability and send you a personalised quotation within one business day.`,
          `<span style="color:${EMAIL_COLORS.muted};font-size:13px">No payment is required at this stage.</span>`
        ],
        reference: lead.bookingCode,
        details: request,
        detailsTitle: 'What you told us',
        preheader: 'We have your enquiry — a local specialist will reply within one business day.',
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

/** Where the trip planner starts the campaign details meant only for staff. */
export const TEAM_ONLY_MARKER = '\n— For our team —';

/**
 * What the traveller gets back of their own message: everything before the
 * staff-only block, so campaign and click ids are never emailed to them. Cut at
 * the first marker, so nothing after it can reach them whatever they typed.
 */
export const travellerCopy = (message: string): string => {
  const at = message.indexOf(TEAM_ONLY_MARKER);
  return (at === -1 ? message : message.slice(0, at)).trimEnd();
};

export type ContactNotifyOptions = { source?: 'contact_form' | 'plan_my_trip'; reference?: string };

/**
 * The contact form and the Plan my trip planner, which both save to
 * contact_messages. Both alert the contact_form inbox, so trip plans reach the
 * same people enquiries always have.
 */
export const notifyContactMessage = async (message: Record<string, unknown>, options: ContactNotifyOptions = {}): Promise<void> => {
  const name = str(message.full_name);
  const email = str(message.email);
  const subject = str(message.subject);
  const text = str(message.message);
  const firstName = name.split(/\s+/)[0] || 'there';
  const isPlan = options.source === 'plan_my_trip';
  const reference = str(options.reference);
  const sent: EmailDetail[] = [
    ...(isPlan && reference ? [{ label: 'Reference', value: reference }] : []),
    { label: 'Subject', value: subject },
    { label: 'Message', value: text }
  ];

  await sendStaffAlert({
    source: 'contact_form',
    subject: isPlan ? `Plan my trip — ${subject || name || 'new trip plan'}` : `Contact form — ${subject || name || 'new message'}`,
    heading: isPlan ? `Trip plan from ${name || 'the website'}` : `New message from ${name || 'the website'}`,
    intro: isPlan ? `${name || 'Someone'} sent a trip plan through Plan my trip.` : `${name || 'Someone'} sent a message through the contact form.`,
    contact: contactRows(name, email, str(message.phone)),
    details: sent,
    detailsTitle: isPlan ? 'Trip plan' : 'Message',
    replyTo: email || undefined,
    cmsPath: '/admin/messages'
  });

  if (!email) return;
  const ownCopy = travellerCopy(text);

  if (isPlan) {
    await sendTravellerAcknowledgement({
      to: email,
      subject: "We've got your trip plan",
      heading: `Thank you, ${firstName}`,
      paragraphs: ['We have received your trip plan. A local specialist will read it and get back to you with ideas and a personalised quotation.'],
      reference: reference || undefined,
      details: [{ label: 'Your trip plan', value: ownCopy }],
      detailsTitle: 'What you told us',
      preheader: 'We have your trip plan — a local specialist will be in touch.',
      text: `Thank you, ${firstName}.\n\nWe have received your trip plan. A local specialist will read it and get back to you.\n${
        reference ? `\nYour reference: ${reference}\n` : ''
      }\nWhat you told us:\n${ownCopy}`
    });
    return;
  }

  await sendTravellerAcknowledgement({
    to: email,
    subject: 'We have received your message',
    heading: `Thank you, ${firstName}`,
    paragraphs: ['We have received your message. A member of our team will read it and get back to you soon.'],
    details: [
      { label: 'Subject', value: subject },
      { label: 'Message', value: ownCopy }
    ],
    detailsTitle: 'What you sent us',
    preheader: 'Thanks for getting in touch — we have your message.',
    text: `Thank you, ${firstName}.\n\nWe have received your message and will get back to you soon.\n\n${subject ? `Subject: ${subject}\n` : ''}${ownCopy}`
  });
};

/**
 * A booking request made in the AI Travel Advisor chat. Stored in
 * booking_requests, a table no email ever read from.
 */
export const notifyAiBookingRequest = async (request: Record<string, unknown>): Promise<void> => {
  const lc = (request.lead_context as Record<string, unknown> | null) ?? {};
  const list = (value: unknown) => (Array.isArray(value) ? value.map((item) => str(item)).filter(Boolean).join(', ') : str(value));
  const name = str(request.full_name);
  const rawEmail = str(request.email);
  // The advisor stores a placeholder when the traveller only gave a phone.
  const email = rawEmail.endsWith('.local') ? '' : rawEmail;
  const adults = Number(request.number_of_adults ?? 0) || 0;
  const children = Number(request.number_of_children ?? 0) || 0;
  const details: EmailDetail[] = [
    { label: 'Travel date', value: str(request.travel_date) },
    { label: 'Travellers', value: adults || children ? `${adults} adults, ${children} children` : '' },
    { label: 'Interests', value: list(lc.experience_interest) },
    { label: 'Destinations', value: list(lc.destination_interest ?? lc.destinations) },
    { label: 'Budget', value: str(lc.budget_range ?? lc.budget) },
    { label: 'Special interests', value: str(request.special_requests) },
    { label: 'Summary', value: str(request.message) }
  ];

  await sendStaffAlert({
    source: 'ai_travel_advisor',
    subject: `AI Travel Advisor booking request — ${name || 'new traveller'}`,
    heading: 'Booking request from the AI Travel Advisor',
    intro: `${name || 'A traveller'} asked for a booking in the AI Travel Advisor chat.`,
    contact: contactRows(name, email, str(request.phone), str(request.country)),
    details,
    detailsTitle: 'Their request',
    replyTo: email || undefined,
    cmsPath: '/admin/ai-conversations'
  });

  if (email) {
    const firstName = name.split(/\s+/)[0] || 'there';
    await sendTravellerAcknowledgement({
      to: email,
      subject: "We've got your booking request",
      heading: `Thank you, ${firstName}`,
      paragraphs: ['We have received your booking request from our AI Travel Advisor. A local specialist will review it and get back to you with availability and a personalised quotation.'],
      details,
      detailsTitle: 'What you told us',
      preheader: 'A local specialist will review your request.',
      text: `Thank you, ${firstName}.\n\nWe have received your booking request. A local specialist will review it and get back to you.\n\n${detailsText(details)}`
    });
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
