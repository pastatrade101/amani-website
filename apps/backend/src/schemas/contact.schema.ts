import { z } from 'zod';

/** Which public form a contact message came from. Picks the email wording. */
export const CONTACT_SOURCES = ['contact_form', 'plan_my_trip'] as const;

/** Reference the Plan my trip form shows the traveller, e.g. K2A-1A2B3C4D. */
export const PLAN_REFERENCE = /^K2A-[0-9A-F]{8}$/;

/**
 * source, reference and captcha_token are not columns on contact_messages: the
 * controller takes them off before the insert. All three are optional, so the
 * enquiry form keeps working as it is.
 */
export const contactCreateSchema = z.object({
  full_name: z.string().min(2).max(150),
  email: z.string().email().max(254),
  phone: z.string().max(50).optional().nullable(),
  // 250, not 200: the enquiry form sends "Safari enquiry: " plus an interest of
  // up to 200 characters.
  subject: z.string().max(250).optional().nullable(),
  message: z.string().min(10).max(10000),
  source: z.enum(CONTACT_SOURCES).optional(),
  reference: z.string().regex(PLAN_REFERENCE).optional(),
  captcha_token: z.string().max(4096).optional()
});

export const contactStatusSchema = z.object({
  status: z.enum(['new', 'read', 'replied', 'archived'])
});

export const contactAssignSchema = z.object({
  assigned_to: z.union([z.string().uuid(), z.literal('')]).nullable()
});

export const contactNotesSchema = z.object({
  admin_notes: z.string().optional().nullable()
});
