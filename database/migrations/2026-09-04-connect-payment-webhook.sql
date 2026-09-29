-- Receiving payment events from Makutano Connect.
-- Apply by pasting into the Supabase SQL editor.
--
-- Connect collects the money; this site shows it. The traveller's own trip page
-- prints their payment status, what they have paid and what is left, so without
-- a way back from Connect someone who has paid opens their page and is told
-- they have not. That is the gap this closes.
--
-- Nothing here collects or moves money. It records what Connect says already
-- happened.

begin;

-- ── Idempotency ───────────────────────────────────────────────────────────
--
-- Connect's own payment id, kept so the same event delivered twice — a retry, a
-- redelivery after a timeout, an operator replaying a failed batch — cannot
-- record the same money twice. A webhook that is not idempotent is a webhook
-- that eventually double-counts.

alter table booking_payments add column if not exists external_id text;
alter table booking_payments add column if not exists external_source text;

-- Partial: only rows that came from outside carry an id, and payments entered
-- by hand in the CMS must not collide with each other on a null.
create unique index if not exists booking_payments_external_id
  on booking_payments (external_source, external_id)
  where external_id is not null;

-- ── The delivery log ──────────────────────────────────────────────────────
--
-- Every accepted event, whether or not it changed anything. This is what gets
-- read when someone asks "did their payment ever reach us" — a question that is
-- unanswerable if the only evidence is a row that may or may not exist.
--
-- Deliberately not storing headers or the signature: nothing here should hold
-- anything that could help forge a future request.

create table if not exists connect_webhook_events (
  id uuid primary key default gen_random_uuid(),

  -- Connect's event id. Unique, so a replay is recognised rather than reapplied.
  event_id text not null unique,
  event_type text not null,

  -- Our booking_code, as Connect sent it back. Kept even when it matches
  -- nothing here, because "an event arrived for a booking we do not have" is
  -- exactly the sort of thing worth being able to see.
  external_reference text,
  booking_request_id uuid references booking_requests(id) on delete set null,

  payload jsonb not null,

  status text not null default 'applied'
    check (status in ('applied', 'ignored', 'unmatched', 'failed')),
  detail text,

  received_at timestamptz not null default now()
);

create index if not exists connect_webhook_events_received on connect_webhook_events (received_at desc);
create index if not exists connect_webhook_events_booking on connect_webhook_events (booking_request_id, received_at desc);

commit;

-- ── After applying ────────────────────────────────────────────────────────
--
-- Set CONNECT_WEBHOOK_SECRET in the backend environment to the signing secret
-- Connect gives you. Until it is set the endpoint rejects everything — a
-- webhook that accepts unsigned requests is an open write endpoint on your
-- payment records, so it fails closed rather than open.
