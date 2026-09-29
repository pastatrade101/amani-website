-- Outbound transport states that tell the truth.
-- Apply by pasting into the Supabase SQL editor.
--
-- The status column could previously only describe a message that had already
-- reached Meta. There was no way to record one that was refused before the API
-- call, or that Meta rejected — those simply left no row at all, so a failed
-- send was invisible to the agent who made it.
--
--   pending    row created, transport not yet attempted or not yet confirmed
--   accepted   Meta took the request and returned a wamid (kept: this is the
--              literal word Meta uses, and existing rows already hold it)
--   sent       Meta's own 'sent' status callback
--   delivered  delivery callback received
--   read       read callback received
--   failed     Meta attempted transport and returned an error
--   skipped    a business rule stopped it before Meta was ever called
--
-- 'accepted' deliberately stays distinct from 'delivered'. It means Meta has
-- the request, not that a phone has the message, and the inbox must not draw
-- them the same way.

alter table whatsapp_messages drop constraint if exists whatsapp_messages_status_check;

alter table whatsapp_messages add constraint whatsapp_messages_status_check
  check (status in ('pending', 'accepted', 'sent', 'delivered', 'read', 'failed', 'skipped'));

-- Why a message never reached the traveller, in words an agent can act on.
-- error_message already exists for Meta's own failures; this one covers the
-- refusals we make ourselves, before any API call.
alter table whatsapp_messages add column if not exists skipped_reason text;

comment on column whatsapp_messages.status is
  'Transport truth. accepted = Meta holds the request; delivered/read only ever come from a webhook.';
comment on column whatsapp_messages.skipped_reason is
  'Set with status=skipped when a business rule stopped the send before Meta was called.';

-- Finding the messages that never landed.
create index if not exists whatsapp_messages_unlanded
  on whatsapp_messages (status) where status in ('pending', 'failed', 'skipped');
