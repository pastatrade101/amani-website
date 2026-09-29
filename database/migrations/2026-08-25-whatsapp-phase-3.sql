-- WhatsApp Phase 3 — quotations, event-driven notifications, template registry.
-- Apply by pasting into the Supabase SQL editor. Single transaction.
--
-- Payments are deliberately NOT part of this migration. booking_requests
-- already carries payment_status, and building a payments ledger is a separate
-- decision that should not be smuggled in behind a messaging change.
--
-- Bookings are likewise not a new table: booking_requests already moves
-- pending -> confirmed -> completed / cancelled, so "booking confirmed" is a
-- status transition on the record that already exists.

-- ── Quotations ──────────────────────────────────────────────────────────────
create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  -- Human reference an agent can read aloud on a call.
  quote_code text not null unique,

  -- What this quote answers. The lead and the conversation are both optional
  -- so a quote can be raised from the inbox, from an enquiry, or standalone.
  booking_request_id uuid references booking_requests(id) on delete set null,
  conversation_id uuid references ai_conversations(id) on delete set null,
  tour_id uuid references tours(id) on delete set null,

  -- Snapshot of who it was quoted to. A quotation is a document: it must keep
  -- saying what it said even if the lead is later edited or deleted.
  customer_name text,
  customer_phone text,
  customer_email text,

  title text not null,
  currency text not null default 'USD',
  adults integer not null default 1 check (adults >= 0),
  children integer not null default 0 check (children >= 0),
  travel_date date,
  -- Optional line breakdown; the total is authoritative.
  items jsonb not null default '[]'::jsonb,
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  notes text,
  valid_until date,

  status text not null default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),

  -- Unguessable token for the customer-facing URL. Long random hex rather than
  -- the id, so a quotation link cannot be walked by incrementing anything and
  -- knowing one quote reveals nothing about another.
  public_token text not null unique,

  sent_at timestamptz,
  sent_via text,
  viewed_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,

  created_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists quotations_lead on quotations (booking_request_id);
create index if not exists quotations_conversation on quotations (conversation_id);
create index if not exists quotations_status on quotations (status, created_at desc);

-- ── Notification events ─────────────────────────────────────────────────────
-- The outbox behind §14. Business code emits an event; channels consume it.
-- Adding email or SMS later means adding a channel, not touching the callers.
create table if not exists notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text,
  entity_id uuid,
  channel text not null default 'whatsapp',
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),

  -- What stops a traveller being messaged twice for the same thing. A retry,
  -- a double click or a replayed webhook collides here instead of sending.
  dedupe_key text not null unique,

  payload jsonb not null default '{}'::jsonb,
  -- Why a send was skipped (no consent, outside the window, not configured)
  -- or how it failed. Read by the admin, so it stays human-readable.
  detail text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notification_events_status on notification_events (status, created_at desc);
create index if not exists notification_events_entity on notification_events (entity_type, entity_id);

-- ── WhatsApp template registry ──────────────────────────────────────────────
-- Maps our internal notion of a message to an approved Meta template, so
-- renaming or re-approving a template in Meta is a data change here rather
-- than a code change.
create table if not exists whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  internal_key text not null unique,
  meta_template_name text not null,
  language text not null default 'en',
  category text,
  status text not null default 'unknown',
  -- Ordered names of the body variables, so the admin can see what a template
  -- expects without opening Meta.
  variables jsonb not null default '[]'::jsonb,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The internal keys Phase 3 emits. meta_template_name is a placeholder until
-- the real approved names are filled in from WhatsApp Manager; nothing sends
-- a template until then, it falls back to a session message or is skipped.
insert into whatsapp_templates (internal_key, meta_template_name, language, category, description) values
  ('inquiry_received',   'inquiry_received',   'en', 'UTILITY', 'Acknowledges a new enquiry with its reference.'),
  ('quotation_ready',    'quotation_ready',    'en', 'UTILITY', 'Tells the traveller their quotation is ready, with the secure link.'),
  ('quotation_updated',  'quotation_updated',  'en', 'UTILITY', 'Tells the traveller their quotation has been revised.'),
  ('booking_confirmed',  'booking_confirmed',  'en', 'UTILITY', 'Confirms a booking and its reference.')
on conflict (internal_key) do nothing;
