-- Asking a traveller to pay, and remembering that we asked.
-- Apply by pasting into the Supabase SQL editor.
--
-- A quotation is accepted, the booking is confirmed and priced, and then
-- somebody has to actually ask for the money. That step had nowhere to live:
-- an agent asked in WhatsApp by hand, and nothing here knew it had happened —
-- so nobody could tell a traveller who had never been asked from one who had
-- been asked twice.
--
-- This records the ask. It does not collect anything: no gateway, no card, no
-- charge. Money arriving is still recorded through booking_payments, either by
-- hand or from Connect's webhook, and payment_status is derived from that.

begin;

create table if not exists payment_requests (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references booking_requests(id) on delete cascade,

  -- Which slice of the price this is for. Kept because "we asked for the
  -- deposit" and "we asked for the balance" are different conversations, and a
  -- bare amount cannot tell them apart later.
  kind text not null default 'deposit' check (kind in ('deposit', 'balance', 'full')),

  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'USD',
  due_date date,

  -- How to pay, in the operator's own words. Copied from the quotation's
  -- payment_terms when there are any, so the traveller reads the same thing
  -- they agreed to rather than something new.
  instructions text,

  -- sent: the traveller has it. cancelled: superseded or asked in error.
  -- Deliberately no 'paid' state — whether it has been covered is derived from
  -- booking_payments, and a second copy of that truth would drift from it.
  status text not null default 'sent' check (status in ('sent', 'cancelled')),

  -- Which channels carried it, as reported by the outbox. Null means it was
  -- recorded but never actually delivered.
  sent_via text,
  sent_at timestamptz not null default now(),

  -- The traveller tapping "I've paid". Not proof of anything — it is a nudge
  -- to go and check, and it is stored as their claim, not as a payment.
  claimed_paid_at timestamptz,

  created_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists payment_requests_booking on payment_requests (booking_request_id, created_at desc);
create index if not exists payment_requests_open on payment_requests (booking_request_id) where status = 'sent';

-- ── Template buttons ──────────────────────────────────────────────────────
--
-- A quick-reply button is not free text: WhatsApp requires the payload to be
-- named in the send, in the same order as the buttons on the approved
-- template. Stored per template so the send path does not hardcode a payload
-- for one message.
--
-- Null or empty means the template has no buttons, which is every existing one.

alter table whatsapp_templates add column if not exists quick_replies jsonb;

-- ── The template ──────────────────────────────────────────────────────────
--
-- Registered without an approved status, so it cannot send until it genuinely
-- exists in WhatsApp Manager. Until then a payment request still reaches the
-- traveller: as ordinary text inside the 24-hour window, and by email outside
-- it, with the WhatsApp channel honestly recorded as skipped.
--
-- Four variables, in this order. They must match what the controller passes or
-- parameterMismatch() skips the send rather than delivering wrong wording:
--
--   {{1}} first name          e.g. Maria
--   {{2}} booking reference   e.g. GF-BKG-000044
--   {{3}} amount due          e.g. USD 700.00
--   {{4}} when and how        e.g. "Due by 15 September. Pay by M-Pesa to …"

insert into whatsapp_templates
  (internal_key, meta_template_name, language, category, description, variables, body_text, quick_replies)
values
  (
    'payment_request',
    'payment_request',
    'en',
    'UTILITY',
    'Asks the traveller for a deposit or balance on a confirmed booking, with a button to say they have paid.',
    '["first_name","booking_reference","amount_due","terms"]'::jsonb,
    E'Hello {{1}}, here are the payment details for your booking {{2}}.\n\nAmount due: {{3}}\n\n{{4}}\n\nOnce you have sent it, tap the button below and we will confirm.',
    '["PAID_CLAIM"]'::jsonb
  )
on conflict (internal_key) do update
  set meta_template_name = excluded.meta_template_name,
      category           = excluded.category,
      description        = excluded.description,
      variables          = excluded.variables,
      body_text          = excluded.body_text,
      quick_replies      = excluded.quick_replies,
      updated_at         = now();

commit;

-- ── After applying ────────────────────────────────────────────────────────
--
-- Create `payment_request` in WhatsApp Manager with ONE quick-reply button
-- labelled "I've paid". The payload above (PAID_CLAIM) is what comes back when
-- a traveller taps it — the inbox matches on it to mark the request claimed.
-- Set the row to 'approved' only once Meta has actually approved it.
