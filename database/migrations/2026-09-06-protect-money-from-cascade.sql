-- Stop a hard delete from silently taking the money trail with it.
-- Apply by pasting into the Supabase SQL editor.
--
-- Deleting a booking currently cascades into everything hanging off it,
-- including booking_payments. Verified by probe: insert a booking, record a
-- payment against it, delete the booking — the payment is gone, with no error
-- and nothing in the row's place.
--
-- Nothing has hit this in anger, because the application soft-deletes: the
-- Archive button sets deleted_at and the row stays. The cascade only fires on a
-- direct delete — a SQL console, a cleanup script, a data migration, a test
-- harness tidying up after itself. Which is precisely when nobody is watching.
--
-- The change is to fail loudly instead. A booking with payments recorded
-- against it can no longer be hard-deleted at all; whoever wants it gone has to
-- deal with the money first, deliberately. That is the correct amount of
-- friction for destroying a financial record.
--
-- Deliberately NOT changed:
--
--   trip_access_tokens  — credentials, not records. They SHOULD die with the
--                         booking; a live magic link to a deleted trip is worse
--                         than no link.
--   connect_webhook_events — already `on delete set null`, which keeps the
--                         delivery log while releasing the reference.

begin;

-- Swap one FK from CASCADE to RESTRICT, whatever Postgres happened to name the
-- constraint. Written as a lookup rather than a hardcoded name because these
-- were created across several migrations and the names are not guaranteed.
create or replace function _repoint_fk_restrict(child regclass, col text, parent regclass)
returns void language plpgsql as $$
declare
  con_name text;
begin
  select c.conname into con_name
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.conrelid = child
    and c.confrelid = parent
    and c.contype = 'f'
    and a.attname = col
  limit 1;

  if con_name is null then
    raise notice 'no FK from %.% to % — skipping', child, col, parent;
    return;
  end if;

  execute format('alter table %s drop constraint %I', child, con_name);
  execute format(
    'alter table %s add constraint %I foreign key (%I) references %s(id) on delete restrict',
    child, con_name, col, parent
  );
  raise notice 'repointed % (%) to RESTRICT', child, con_name;
end $$;

-- Money received. The one that matters most: a payment is evidence someone
-- handed over money, and it must outlive any tidy-up of the record it points at.
select _repoint_fk_restrict('booking_payments', 'booking_id', 'booking_requests');

-- Why a price moved after it was agreed. amount_delta is money in all but name.
select _repoint_fk_restrict('booking_amendments', 'booking_request_id', 'booking_requests');

-- What was actually offered, and what was said about it. The only answer to
-- "what did we quote them on the 3rd" once the live row has moved on.
select _repoint_fk_restrict('quotation_revisions', 'quotation_id', 'quotations');
select _repoint_fk_restrict('quotation_comments', 'quotation_id', 'quotations');

drop function _repoint_fk_restrict(regclass, text, regclass);

commit;

-- ── After applying ────────────────────────────────────────────────────────
--
-- Re-run the probe to confirm: create a booking, record a payment, try to
-- delete the booking. It should now be REFUSED with a foreign key violation
-- (23503) rather than quietly succeeding.
--
-- If a genuine hard delete is ever needed, remove the children explicitly
-- first. That is the point: it becomes a decision rather than a side effect.
