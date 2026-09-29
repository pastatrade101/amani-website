-- WhatsApp Phase 2 — inbox, agent replies, customer context.
-- Apply by pasting into the Supabase SQL editor. Single transaction.
--
-- Still no second CRM: everything here hangs off ai_conversations, which is
-- already the unified thread for website chat, the assistant and WhatsApp.

-- ── Ownership and read state ────────────────────────────────────────────────
alter table ai_conversations add column if not exists assigned_to uuid references admin_users(id) on delete set null;
-- When the assigned agent last opened the thread. Unread is derived by
-- comparing this to the newest inbound message rather than kept as a counter,
-- so it can never drift out of step with the messages themselves.
alter table ai_conversations add column if not exists agent_last_read_at timestamptz;

-- The AI must stop answering once a person takes over (§15). Kept as its own
-- flag so re-enabling is an explicit, auditable act rather than a side effect
-- of some other state change.
alter table ai_conversations add column if not exists ai_enabled boolean not null default true;

-- The handoff lifecycle, separate from `status` so the existing website-chat
-- meaning of status is untouched.
alter table ai_conversations add column if not exists handoff_state text not null default 'AI_ACTIVE';
alter table ai_conversations drop constraint if exists ai_conversations_handoff_state_check;
alter table ai_conversations add constraint ai_conversations_handoff_state_check
  check (handoff_state in ('AI_ACTIVE', 'HUMAN_REQUESTED', 'AGENT_ASSIGNED', 'HUMAN_ACTIVE', 'RESOLVED'));

create index if not exists ai_conversations_assigned on ai_conversations (assigned_to) where assigned_to is not null;
create index if not exists ai_conversations_handoff_state on ai_conversations (handoff_state);

-- Existing conversations that already flagged a handoff should not silently
-- present as AI-managed.
update ai_conversations
set handoff_state = 'HUMAN_REQUESTED'
where handoff_required is true and handoff_state = 'AI_ACTIVE';

-- ── Internal notes ──────────────────────────────────────────────────────────
-- Staff-only annotations on a thread. Never sent to the traveller; kept apart
-- from ai_messages precisely so a note can never be mistaken for a message.
create table if not exists conversation_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  author_id uuid references admin_users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversation_notes_conversation on conversation_notes (conversation_id, created_at desc);
