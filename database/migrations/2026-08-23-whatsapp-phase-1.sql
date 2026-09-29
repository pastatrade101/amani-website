-- WhatsApp Business Cloud API — Phase 1 (foundation).
-- Apply by pasting into the Supabase SQL editor. Single transaction.
--
-- Deliberately NOT a second CRM. This platform already has the unified
-- conversation the spec asks for: ai_conversations carries channel, status,
-- lead_context, handoff_at/by/required/reason, visitor identity, lead_status
-- and booking_request_id, with ai_messages holding the turns. WhatsApp becomes
-- another `channel` on those same tables, so one traveller has one thread
-- whether they arrived through the website assistant or WhatsApp.
--
-- Two new tables only, both transport-level:
--   whatsapp_contacts  — phone identity, consent, and the 24h service window
--   whatsapp_messages  — the Meta delivery record, keyed by its message id
-- Message CONTENT still lives in ai_messages; whatsapp_messages points at it.

-- ── Contacts ────────────────────────────────────────────────────────────────
create table if not exists whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  -- Meta's wa_id: the phone number in international digits, no plus.
  wa_id text not null unique,
  phone_e164 text,
  profile_name text,
  -- Consent, kept separate for transactional vs marketing as the spec requires.
  whatsapp_opt_in boolean not null default false,
  whatsapp_opt_in_at timestamptz,
  whatsapp_opt_in_source text,
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  -- Last inbound message from this contact. WhatsApp only allows free-form
  -- replies inside 24 hours of it; outside that a template is required. Stored
  -- so the send path can enforce the rule rather than discovering it as an API
  -- error.
  last_inbound_at timestamptz,
  blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_contacts_phone on whatsapp_contacts (phone_e164);

-- ── Conversation linkage ────────────────────────────────────────────────────
-- ai_conversations.channel has no CHECK constraint, so 'whatsapp' needs no DDL;
-- this column is the fast path from a contact to their thread.
alter table ai_conversations add column if not exists whatsapp_contact_id uuid references whatsapp_contacts(id);
create index if not exists ai_conversations_whatsapp_contact on ai_conversations (whatsapp_contact_id);
create index if not exists ai_conversations_channel_status on ai_conversations (channel, status);

-- Human agent replies are a distinct voice from the assistant's, and the AI
-- must be able to tell "a person already answered this" from its own output.
alter table ai_messages drop constraint if exists ai_messages_role_check;
alter table ai_messages add constraint ai_messages_role_check
  check (role in ('user', 'assistant', 'system', 'tool', 'agent'));

-- ── Transport log ───────────────────────────────────────────────────────────
create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  -- Meta's message id (wamid...). UNIQUE is what makes webhook processing
  -- idempotent: a redelivered webhook conflicts here instead of inserting a
  -- second copy of the same message.
  wa_message_id text not null unique,
  contact_id uuid references whatsapp_contacts(id) on delete set null,
  conversation_id uuid references ai_conversations(id) on delete set null,
  -- The conversation turn this delivery carries. Content lives there, not here.
  ai_message_id uuid references ai_messages(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null default 'text',
  status text not null default 'accepted'
    check (status in ('accepted', 'sent', 'delivered', 'read', 'failed')),
  error_code text,
  error_message text,
  -- Set when the message was sent as an approved template rather than a
  -- free-form session reply.
  template_name text,
  -- Raw Meta payload for support and replay. No credentials pass through here.
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_messages_conversation on whatsapp_messages (conversation_id, created_at desc);
create index if not exists whatsapp_messages_contact on whatsapp_messages (contact_id, created_at desc);
create index if not exists whatsapp_messages_status on whatsapp_messages (status) where status in ('accepted', 'sent', 'failed');

-- ── Webhook idempotency ─────────────────────────────────────────────────────
-- Meta retries webhooks, and a retry can carry events already applied. Every
-- delivery is recorded here first; a repeat conflicts and is skipped before any
-- business logic runs.
create table if not exists whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  received_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists whatsapp_webhook_events_received on whatsapp_webhook_events (received_at desc);
