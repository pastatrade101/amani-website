import { z } from 'zod';

export const BOOKING_STATUSES = [
  'pending',
  'contacted',
  'itinerary_sent',
  'negotiating',
  'confirmed',
  'cancelled',
  'completed',
  'rejected'
] as const;

export const PAYMENT_STATUSES = ['unpaid', 'partially_paid', 'paid', 'refunded', 'failed'] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * The three contextual enquiry forms. These are stored in `source`, which is a
 * free-text column — no migration was needed to introduce them, and the older
 * values below keep working so nothing already in the table is orphaned.
 */
export const ENQUIRY_FORM_TYPES = ['homepage_trip_planner', 'category_enquiry', 'tour_enquiry'] as const;

export type EnquiryFormType = (typeof ENQUIRY_FORM_TYPES)[number];

export const BOOKING_SOURCES = [
  ...ENQUIRY_FORM_TYPES,
  // Retained: existing rows and the older forms still submit these.
  'website_booking_form',
  'plan_my_trip',
  // The tour-page email capture has always sent this and has always been
  // rejected by the enum, so every one of those submissions 400'd.
  'email_itinerary',
  'ai_handoff',
  'whatsapp',
  'admin_created',
  'hubspot_import'
] as const;

const statusEnum = z.enum(BOOKING_STATUSES);
const paymentEnum = z.enum(PAYMENT_STATUSES);
const sourceEnum = z.enum(BOOKING_SOURCES);
const uuidOrEmpty = z.union([z.string().uuid(), z.literal('')]).optional().nullable();
const optionalDate = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}/), z.literal('')])
  .optional()
  .nullable();

/**
 * Flexible lead details captured by the enquiry forms, Plan My Trip and the AI
 * handoff. Deliberately permissive: three older forms already write their own
 * (drifted) key shapes, and tightening this would reject submissions that work
 * today. The contextual forms write the documented shape below; everything else
 * is passed through untouched.
 *
 *   { v, form_type, page: {url,title,referrer}, utm: {...},
 *     category: {id,name,slug}, tour: {id,title,slug,price_from,currency,duration_days},
 *     language, consent: {marketing}, answers: {...} }
 */
const leadContextSchema = z.record(z.unknown()).optional().nullable();

export const bookingCreateSchema = z.object({
  tour_id: uuidOrEmpty,
  full_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6).optional().nullable(),
  country: z.string().optional().nullable(),
  travel_date: optionalDate,
  number_of_adults: z.coerce.number().int().min(1).default(1),
  number_of_children: z.coerce.number().int().min(0).default(0),
  special_requests: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  estimated_amount: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.string().min(3).max(3).default('USD'),
  selected_currency: z.string().min(3).max(3).optional().nullable(),
  source: sourceEnum.default('website_booking_form'),
  ai_conversation_id: uuidOrEmpty,
  lead_context: leadContextSchema,
  // Client-generated, stable for the lifetime of one filled-in form. The unique
  // index on this column is what actually stops double submissions; without it
  // the controller can only fall back to a time-window guess.
  idempotency_key: z.string().min(8).max(128).optional().nullable(),
  // Turnstile token, only ever required once a submitter looks like a script
  // (see form-guard.middleware). Read before validation and dropped here.
  captcha_token: z.string().max(4096).optional().nullable(),
  // Honeypot — must stay empty for humans. Kept in the schema (zod strips unknown
  // keys) so the controller can inspect it, then it is dropped before insert.
  // Explicit transactional consent from a form tick. Never inferred from the
  // presence of a phone number.
  whatsapp_opt_in: z.boolean().optional(),
  hp_company: z.string().max(120).optional().nullable()
});

export const bookingUpdateSchema = z.object({
  tour_id: uuidOrEmpty,
  full_name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  travel_date: optionalDate,
  number_of_adults: z.coerce.number().int().min(1).optional(),
  number_of_children: z.coerce.number().int().min(0).optional(),
  special_requests: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  estimated_amount: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.string().min(3).max(3).optional(),
  selected_currency: z.string().min(3).max(3).optional().nullable(),
  status: statusEnum.optional(),
  payment_status: paymentEnum.optional(),
  admin_notes: z.string().optional().nullable(),
  assigned_to: uuidOrEmpty,
  source: sourceEnum.optional(),
  lead_context: leadContextSchema
});

export const bookingStatusSchema = z.object({
  status: statusEnum,
  admin_notes: z.string().optional().nullable()
});

export const bookingAssignSchema = z.object({
  assigned_to: z.union([z.string().uuid(), z.literal('')]).nullable()
});

export const bookingNotesSchema = z.object({
  admin_notes: z.string().optional().nullable()
});
