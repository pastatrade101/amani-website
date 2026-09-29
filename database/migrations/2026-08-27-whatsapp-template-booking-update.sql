-- The first approved Meta template, and the registry columns that let the
-- next four arrive without a code change.
-- Apply by pasting into the Supabase SQL editor.
--
-- The registry exists so that Meta's name for a template and ours are allowed
-- to differ. Meta approved this one as `booking_update`; what it actually says
-- is an enquiry acknowledgement, which is the event we already call
-- `inquiry_received`. Mapping one to the other is a data change — no caller
-- changes, and nothing in the conversation architecture moves.

-- What the approved template actually says. Held here so an agent can read a
-- template before sending it: outside the 24-hour window they are choosing a
-- message they would otherwise be sending blind.
alter table whatsapp_templates add column if not exists body_text text;

-- A human name for the picker, so agents are not choosing between snake_case
-- internal keys.
alter table whatsapp_templates add column if not exists label text;

-- ── The approved template ───────────────────────────────────────────────────
update whatsapp_templates set
  meta_template_name = 'booking_update',
  language           = 'en',
  category           = 'UTILITY',
  status             = 'approved',
  label              = 'Enquiry received',
  -- Ordered to match {{1}}, {{2}}. The send path checks the count against this
  -- before calling Meta, so a caller passing the wrong number of parameters is
  -- refused here rather than rejected by the API.
  variables          = '["customer_name", "reference"]'::jsonb,
  body_text          = 'Hello {{1}}, your travel inquiry has been received.' || chr(10) ||
                       'Reference: {{2}}.' || chr(10) || chr(10) ||
                       'Our travel team will contact you shortly.',
  description        = 'Acknowledges a new enquiry with its reference. Approved by Meta as booking_update.',
  updated_at         = now()
where internal_key = 'inquiry_received';

-- ── Everything else is honestly marked unapproved ───────────────────────────
-- These names do not exist in WhatsApp Manager yet. Left registered so the
-- events that reference them keep working, but marked so the send path skips
-- them with a reason instead of asking Meta for a template it has never seen.
update whatsapp_templates set status = 'pending', updated_at = now()
where internal_key <> 'inquiry_received' and status <> 'approved';

update whatsapp_templates set label = 'Quotation ready'    where internal_key = 'quotation_ready'    and label is null;
update whatsapp_templates set label = 'Quotation updated'  where internal_key = 'quotation_updated'  and label is null;
update whatsapp_templates set label = 'Quotation accepted' where internal_key = 'quotation_accepted' and label is null;
update whatsapp_templates set label = 'Booking confirmed'  where internal_key = 'booking_confirmed'  and label is null;

-- Only approved templates are offered to agents or used outside the window.
create index if not exists whatsapp_templates_approved on whatsapp_templates (status, internal_key);
