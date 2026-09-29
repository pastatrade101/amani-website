-- Give Goldfinch's own templates their own names on the shared WABA.
-- Apply by pasting into the Supabase SQL editor. Supersedes the template half
-- of 2026-09-05-payment-requests.sql.
--
-- Goldfinch and Makutano Connect send through the same WhatsApp Business
-- Account, and Meta allows exactly one template per name+language on a WABA.
-- Connect already owns `payment_request` there: approved, five variables
-- (first_name, amount_due, type_label, reference, instructions) and two quick
-- replies. Goldfinch registering the same name against a four-variable body
-- would either collide on creation or, worse, be edited into Connect's live
-- template and break every payment request Connect sends.
--
-- The registry already separates the two ideas this needs:
--
--   internal_key       what this codebase asks for      -> payment_request
--   meta_template_name what Meta is asked to send       -> gf_payment_request
--
-- So the application code is unchanged. Only the name on the wire moves.

begin;

-- ── The payment request ───────────────────────────────────────────────────

update whatsapp_templates
   set meta_template_name = 'gf_payment_request',
       description        = 'Goldfinch payment request. Distinct name from Connect''s payment_request, which lives on the same WABA.',
       -- Null on purpose. The payload is set per SEND, not per template: each
       -- request's button carries that request's own id, so a tap resolves to
       -- one row instead of being guessed at from the phone number and a
       -- timestamp. See templateQuickReplies in payment-requests.controller.ts.
       quick_replies      = null,
       updated_at         = now()
 where internal_key = 'payment_request';

-- ── The two other templates this codebase added ───────────────────────────
--
-- Same reasoning, applied before rather than after a collision. Neither is
-- approved yet, so renaming them costs nothing and removes the chance of
-- walking into Connect's namespace a second time.
--
-- Existing approved templates are deliberately untouched: booking_confirmed,
-- quotation_ready, quotation_accepted and quotation_updated already work on
-- this WABA, and renaming them would break sends that currently succeed.

update whatsapp_templates
   set meta_template_name = 'gf_booking_amended', updated_at = now()
 where internal_key = 'booking_amended' and status <> 'approved';

update whatsapp_templates
   set meta_template_name = 'gf_quotation_revised', updated_at = now()
 where internal_key = 'quotation_revised' and status <> 'approved';

commit;

-- ── What to create in WhatsApp Manager ────────────────────────────────────
--
-- gf_payment_request · Utility · English · ONE quick-reply button
--
--   Hello {{1}}, here are the payment details for your booking {{2}}.
--
--   Amount due: {{3}}
--
--   {{4}}
--
--   Once you have sent it, tap the button below and we will confirm.
--
--   Button (Quick Reply):  I have paid
--
--   {{1}} first name        Maria
--   {{2}} booking reference GF-BKG-000045
--   {{3}} amount due        USD 720.00
--   {{4}} when and how      Due by 15 September 2026. M-Pesa to 0754 000 000.
--
-- Set status = 'approved' here only once Meta has actually approved it.
--
-- The button LABEL is cosmetic — the handler matches on the payload, which
-- Meta sends alongside it. Write it however reads best.
