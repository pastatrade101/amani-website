-- The quotation negotiation loop, and the handover into a booking.
-- Apply by pasting into the Supabase SQL editor.
--
-- Until now a quotation could only be said yes or no to. Everything in between
-- — "can we do this in June instead", "drop the balloon flight" — had to happen
-- in WhatsApp, where it left no trace on the document it was actually about.
-- This adds the middle: the traveller can ask for changes, the admin answers
-- with a new version, and the exchange stays attached to the quotation.
--
--   DRAFT -> SENT -> VIEWED ---> CHANGES_REQUESTED -> REVISED -> SENT ...
--                          \
--                           `-> ACCEPTED -> booking confirmed, payment pending
--
-- Two deliberate choices, both about not duplicating what exists:
--
--   * One row per quotation, not one per version. The traveller's link is the
--     document's identity — it is already in their WhatsApp thread, Connect
--     mirrors on quote_code, and a row per version would break both. The
--     current version lives on `quotations`; superseded ones are snapshotted
--     into `quotation_revisions`.
--
--   * Payment state is NOT introduced here. booking_requests.payment_status
--     already runs unpaid -> partially_paid -> paid -> refunded/failed, and
--     booking_payments already records the money. A second vocabulary saying
--     the same thing in different words would only create disagreement.

begin;

-- ── The negotiation states ────────────────────────────────────────────────
--
-- changes_requested: the traveller has asked for something different and the
--   ball is with the agent.
-- revised: the agent has produced a new version that has not gone out yet.
--   Distinct from draft, which has never been sent to anyone.

alter table quotations drop constraint if exists quotations_status_check;
alter table quotations add constraint quotations_status_check
  check (status in ('draft', 'sent', 'viewed', 'changes_requested', 'revised', 'accepted', 'declined', 'expired'));

-- ── Versioning ────────────────────────────────────────────────────────────

alter table quotations add column if not exists revision integer not null default 1 check (revision >= 1);

-- Set when the traveller accepts. An accepted quotation is the commercial
-- agreement: what it said at that moment is what was agreed, so it stops being
-- editable. Anything that changes afterwards is an amendment to the booking,
-- which is a different document with a different audit trail.
alter table quotations add column if not exists frozen_at timestamptz;

alter table quotations add column if not exists changes_requested_at timestamptz;

-- ── What the agent prepares ───────────────────────────────────────────────
--
-- items already carries the priced breakdown. These carry the prose either
-- side of it: what the price covers, what it pointedly does not, and when
-- money is due. Exclusions matter most — an unstated exclusion is the single
-- most common reason an accepted price turns into an argument later.

alter table quotations add column if not exists inclusions jsonb not null default '[]'::jsonb;
alter table quotations add column if not exists exclusions jsonb not null default '[]'::jsonb;
alter table quotations add column if not exists deposit_amount numeric(12, 2) check (deposit_amount >= 0);
alter table quotations add column if not exists payment_terms text;

-- ── Superseded versions ───────────────────────────────────────────────────
--
-- A snapshot, not a diff: the question this table answers is "what exactly did
-- we offer them on the 3rd", and a diff chain cannot answer that without
-- replaying every step correctly. Storage is not the constraint here.

create table if not exists quotation_revisions (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  revision integer not null check (revision >= 1),

  -- The document as it stood. Deliberately a loose snapshot rather than mirrored
  -- columns: the shape of a quotation will change again, and a historical row
  -- must keep meaning what it meant under the old shape.
  snapshot jsonb not null,

  -- Why it was superseded. Usually the traveller's own words, copied from the
  -- comment that triggered the revision.
  superseded_reason text,
  superseded_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),

  unique (quotation_id, revision)
);

create index if not exists quotation_revisions_quotation on quotation_revisions (quotation_id, revision desc);

-- ── The conversation about the document ───────────────────────────────────
--
-- Tied to the revision it was written against, because "can you drop the
-- balloon flight" only makes sense against the version that still had one.

create table if not exists quotation_comments (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  revision integer not null default 1,

  -- traveller: written from the public quotation link, unauthenticated.
  -- admin: written from the CMS.
  author text not null check (author in ('traveller', 'admin')),
  author_user_id uuid references admin_users(id) on delete set null,
  author_name text,

  body text not null check (length(btrim(body)) > 0),

  -- Set when an agent has dealt with the point. Lets the CMS show what is
  -- still outstanding without deleting anything.
  resolved_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists quotation_comments_quotation on quotation_comments (quotation_id, created_at);
create index if not exists quotation_comments_open on quotation_comments (quotation_id) where resolved_at is null;

-- ── The admin override ────────────────────────────────────────────────────
--
-- The normal path is the traveller accepting from their own link. But offline
-- happens: a phone agreement, a walk-in, a migrated booking, a link that will
-- not open on someone's handset. The override stays, and it is honest about
-- itself — it records who forced the state and why, so a quotation marked
-- accepted can always be traced to either the traveller or a named person.

alter table quotations add column if not exists status_override_reason text;
alter table quotations add column if not exists status_override_by uuid references admin_users(id) on delete set null;
alter table quotations add column if not exists status_override_at timestamptz;

-- ── Booking amendments ────────────────────────────────────────────────────
--
-- After acceptance the quotation is frozen, so changes go here instead. This
-- is a log of what was agreed to change and what it did to the price — not a
-- second quotation system: the booking remains the live record.

create table if not exists booking_amendments (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references booking_requests(id) on delete cascade,
  quotation_id uuid references quotations(id) on delete set null,

  requested_by text not null default 'traveller' check (requested_by in ('traveller', 'admin')),
  summary text not null check (length(btrim(summary)) > 0),
  detail text,

  -- Signed: a reduction is negative. Null means "no price effect agreed yet".
  amount_delta numeric(12, 2),
  currency text not null default 'USD',

  status text not null default 'proposed'
    check (status in ('proposed', 'agreed', 'declined', 'applied')),

  created_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists booking_amendments_booking on booking_amendments (booking_request_id, created_at desc);

-- ── Notification templates ────────────────────────────────────────────────
--
-- Registered as pending, never approved. A template only becomes sendable once
-- it genuinely exists and is approved in WhatsApp Manager — the send path
-- filters on status = 'approved', so a row here cannot cause an unapproved
-- send. Registering them now means the admin can see what is left to create.

insert into whatsapp_templates (internal_key, meta_template_name, language, category, description) values
  ('quotation_revised', 'quotation_revised', 'en', 'UTILITY',
   'Tells the traveller a new version of their quotation is ready after they asked for changes.')
on conflict (internal_key) do nothing;

commit;

-- ── Backfill note ─────────────────────────────────────────────────────────
--
-- Existing accepted quotations are not retro-frozen by this migration: doing so
-- would stamp frozen_at with today's date on documents accepted weeks ago,
-- which is a worse lie than leaving the column null. The application treats
-- status = 'accepted' as frozen regardless of the column, so they are protected
-- either way.
