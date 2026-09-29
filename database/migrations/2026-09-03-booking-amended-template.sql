-- Register the booking_amended template.
-- Apply by pasting into the Supabase SQL editor.
--
-- Registered as 'pending', never 'approved'. The send path filters on
-- status = 'approved', so this row cannot cause an unapproved send — it exists
-- so the admin can see what is left to create in WhatsApp Manager, and so the
-- key resolves once Meta approves it.
--
-- Until then an applied amendment still reaches the traveller:
--   * inside the 24-hour customer-service window, as a normal text message —
--     no template is involved at all;
--   * outside it, by email, with the WhatsApp channel honestly recorded as
--     skipped rather than marked sent.
--
-- Three variables, in this order. They must match what
-- booking-amendments.controller.ts passes, or parameterMismatch() skips the
-- send rather than delivering a message with the wrong words in it:
--
--   {{1}} the traveller's first name        e.g. Maria
--   {{2}} the booking reference             e.g. GFB-000042
--   {{3}} what changed, and its price effect
--         e.g. "Added a third night at Ngorongoro
--               Your total changes by +USD 420.00."

-- `variables` is a jsonb ARRAY OF NAMES, not a count — parameterMismatch()
-- compares its length against what the controller supplies and names them in
-- the skip reason. A number here would make Array.isArray() false and silently
-- disable the check that stops a message going out with the wrong words in it.

insert into whatsapp_templates (internal_key, meta_template_name, language, category, description, variables, body_text) values
  (
    'booking_amended',
    'booking_amended',
    'en',
    'UTILITY',
    'Tells the traveller a change to their confirmed booking has been applied, and what it does to the price.',
    '["customer_name","booking_reference","change_summary"]'::jsonb,
    E'Hello {{1}}, there''s an update to your booking {{2}}.\n\n{{3}}\n\nEverything else about your trip stays as arranged. Reply here if you have any questions.'
  )
on conflict (internal_key) do update
  set meta_template_name = excluded.meta_template_name,
      category           = excluded.category,
      description        = excluded.description,
      variables          = excluded.variables,
      body_text          = excluded.body_text,
      updated_at         = now();

-- Deliberately NOT setting status = 'approved'. Do that only once Meta has
-- actually approved it, otherwise the first send outside the window fails at
-- Meta with 132001 (template not found) instead of skipping cleanly.
