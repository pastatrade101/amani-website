-- Consent evidence for WhatsApp, and the transactional/marketing split.
-- Apply by pasting into the Supabase SQL editor.
--
-- Most of this already existed: whatsapp_contacts has carried
-- whatsapp_opt_in / _at / _source since Phase 1. What was missing was the
-- matching source column for marketing, and a written statement of which
-- column means what — because the two consents are legally different things
-- and the difference has to survive whoever reads this next.
--
--   whatsapp_opt_in   TRANSACTIONAL. Permission to send this traveller
--                     messages about their own trip: enquiry acknowledgement,
--                     quotation, booking update. Gates every WhatsApp send.
--
--   marketing_opt_in  MARKETING. Permission to send offers and travel ideas.
--                     Checked IN ADDITION to the above, never instead of it.
--
-- Deliberately NOT renamed to whatsapp_transactional_opt_in: the distinction is
-- already enforced in code by two independent gates, and renaming a live column
-- would churn every caller and the existing evidence for no change in meaning.
--
-- NOTHING IS BACKFILLED. Consent that was never given is not created here, and
-- a traveller having supplied a phone number is not treated as consent.

alter table whatsapp_contacts add column if not exists marketing_opt_in_source text;

comment on column whatsapp_contacts.whatsapp_opt_in is
  'TRANSACTIONAL consent: messages about this traveller''s own trip. Gates all WhatsApp sends.';
comment on column whatsapp_contacts.whatsapp_opt_in_source is
  'How it was given: inbound_message, or the form name, e.g. website_booking_form.';
comment on column whatsapp_contacts.marketing_opt_in is
  'MARKETING consent: offers and travel ideas. Required IN ADDITION to whatsapp_opt_in, never instead of it.';

-- Finding a contact by the number a form supplied.
create index if not exists whatsapp_contacts_phone on whatsapp_contacts (phone_e164);
