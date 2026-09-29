-- Quotation lifecycle — the acceptance step.
-- Apply by pasting into the Supabase SQL editor. Single transaction.
--
-- Closes the loop DRAFT -> SENT -> VIEWED -> ACCEPTED / DECLINED / EXPIRED.
-- Acceptance is the traveller saying yes to a price; it is NOT a booking and
-- NOT a payment. Both of those remain deliberately unbuilt — booking_requests
-- already owns pending -> confirmed, and payment is a separate decision.

-- What the traveller told us when they accepted: who is actually travelling
-- and how to reach them. Kept on the quotation rather than written straight
-- into the lead, because it is part of the document — evidence of what was
-- agreed, which must not change when the lead is later edited.
alter table quotations add column if not exists acceptance jsonb not null default '{}'::jsonb;

-- Their words, if they gave a reason. Free text, never required.
alter table quotations add column if not exists decline_reason text;

-- Finding a quotation from a code someone typed into WhatsApp.
create index if not exists quotations_quote_code on quotations (upper(quote_code));

-- Acceptance confirmation back to the traveller. Placeholder name until the
-- real approved template exists in WhatsApp Manager; until then this falls
-- back to a session message or is skipped, never sent unapproved.
insert into whatsapp_templates (internal_key, meta_template_name, language, category, description) values
  ('quotation_accepted', 'quotation_accepted', 'en', 'UTILITY', 'Confirms we received the traveller''s acceptance of a quotation.')
on conflict (internal_key) do nothing;
