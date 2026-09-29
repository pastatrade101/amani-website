-- Attach FAQs to a destination so each destination renders its own Q&A.
-- Nullable: a null destination_id = a general/global FAQ (unchanged behaviour).
-- Idempotent — safe to run more than once.

alter table faqs
  add column if not exists destination_id uuid references destinations(id) on delete set null;

create index if not exists idx_faqs_destination on faqs (destination_id) where deleted_at is null;
