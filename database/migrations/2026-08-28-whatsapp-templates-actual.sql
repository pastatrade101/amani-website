-- Corrects 2026-08-27-whatsapp-template-booking-update.sql.
-- Apply by pasting into the Supabase SQL editor.
--
-- That migration mapped `inquiry_received` to a Meta template named
-- `booking_update`. No such template exists on the WhatsApp Business Account
-- the platform is now pointed at — the WABA id was corrected afterwards, and
-- `booking_update` belonged to whatever the previous id referred to.
--
-- This file records what Meta actually holds, read back from
-- GET /{WABA_ID}/message_templates on 2026-08-28 and verified by a live send
-- (booking_confirmed, accepted, wamid.HBgMMjU1NzUyMDkzMDE0...).
--
-- Already applied to production as a data sync; this exists so a fresh
-- environment lands in the same state.

-- ── Approved, and matching what the callers pass ────────────────────────────
update whatsapp_templates set
  meta_template_name = 'quotation_ready', language = 'en', category = 'UTILITY',
  status = 'approved', label = 'Quotation ready',
  variables = '["customer_name", "trip_title", "quotation_link"]'::jsonb,
  body_text = 'Hello {{1}}, your quotation for {{2}} is ready.' || chr(10) || chr(10) ||
              'View it here: {{3}}' || chr(10) || chr(10) ||
              'No payment is required to accept.',
  updated_at = now()
where internal_key = 'quotation_ready';

update whatsapp_templates set
  meta_template_name = 'quotation_updated', language = 'en', category = 'UTILITY',
  status = 'approved', label = 'Quotation updated',
  variables = '["customer_name", "quote_reference", "quotation_link"]'::jsonb,
  body_text = 'Hello {{1}}, your quotation {{2}} has been updated.' || chr(10) || chr(10) ||
              'View the latest version here: {{3}}' || chr(10) || chr(10) ||
              'The price shown there is the current one.',
  updated_at = now()
where internal_key = 'quotation_updated';

update whatsapp_templates set
  meta_template_name = 'quotation_accepted', language = 'en', category = 'UTILITY',
  status = 'approved', label = 'Quotation accepted',
  variables = '["traveller_name", "quote_reference"]'::jsonb,
  body_text = 'Hello {{1}}, thank you for accepting quotation {{2}}.' || chr(10) || chr(10) ||
              'No payment has been taken. Our team will confirm availability and contact you with the next steps.',
  updated_at = now()
where internal_key = 'quotation_accepted';

update whatsapp_templates set
  meta_template_name = 'booking_confirmed', language = 'en', category = 'UTILITY',
  status = 'approved', label = 'Booking confirmed',
  variables = '["first_name", "booking_reference"]'::jsonb,
  body_text = 'Hello {{1}}, your booking is confirmed.' || chr(10) ||
              'Reference: {{2}}.' || chr(10) || chr(10) ||
              'We will follow up with your itinerary and joining instructions.',
  updated_at = now()
where internal_key = 'booking_confirmed';

-- ── Not yet created in WhatsApp Manager ─────────────────────────────────────
-- Pointing this at a name Meta does not have would fail at send time. Marked
-- pending so an enquiry outside the 24-hour window is skipped with a readable
-- reason instead, and starts working the moment the template is approved.
update whatsapp_templates set
  meta_template_name = 'inquiry_received', language = 'en', category = 'UTILITY',
  status = 'pending', label = 'Enquiry received',
  variables = '[]'::jsonb, body_text = null, updated_at = now()
where internal_key = 'inquiry_received';
