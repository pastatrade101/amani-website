-- Let an FAQ belong to something.
--
-- Today a question can be attached to a destination and nothing else, and even
-- that has no admin UI — so a tour page, a safari style and a safari package
-- all render the same generic list. "How fit do I need to be?" reads very
-- differently under a Kilimanjaro climb than under a beach stay.
--
-- The pair is deliberately generic rather than one nullable foreign key per
-- table. It is the shape content_translations already uses in this schema, and
-- it means attaching FAQs to the next collection is a check-constraint change
-- rather than another column.
--
--   entity_type null  -> a general question, shown where nothing more specific
--                        applies. Unchanged behaviour for every existing row.
--   entity_type set   -> belongs to that record, and only that record.
--
-- Idempotent and additive. Safe to run on the live database, safe to re-run.

begin;

alter table faqs add column if not exists entity_type text;
alter table faqs add column if not exists entity_id uuid;

-- The tables an FAQ may be attached to. Plural table names, matching
-- content_translations, so one spelling of "which collection" exists.
alter table faqs drop constraint if exists faqs_entity_type_check;
alter table faqs add constraint faqs_entity_type_check
  check (entity_type is null or entity_type in (
    'destinations', 'tours', 'tour_categories', 'safari_packages', 'lodges', 'activities'
  ));

-- Both halves or neither. A type with no id would match every record of that
-- type; an id with no type is unresolvable.
alter table faqs drop constraint if exists faqs_entity_pair_check;
alter table faqs add constraint faqs_entity_pair_check
  check ((entity_type is null and entity_id is null) or (entity_type is not null and entity_id is not null));

-- ── Carry the existing destination links over ──────────────────────────────
--
-- destination_id stays on the table and keeps working; this simply makes those
-- rows visible to the generic reader too. Only rows not already attached are
-- touched, so re-running cannot overwrite a later, deliberate attachment.
update faqs
   set entity_type = 'destinations',
       entity_id = destination_id
 where destination_id is not null
   and entity_type is null;

create index if not exists idx_faqs_entity on faqs (entity_type, entity_id) where deleted_at is null;
-- The common read: this record's published questions, in order.
create index if not exists idx_faqs_entity_published
  on faqs (entity_type, entity_id, sort_order) where deleted_at is null and status = 'published';

commit;

-- ── After applying ────────────────────────────────────────────────────────
--
-- Nothing changes for a visitor until an editor attaches a question. Every
-- existing FAQ stays general and keeps appearing exactly where it does now;
-- destination FAQs keep working through both the old column and the new pair.
