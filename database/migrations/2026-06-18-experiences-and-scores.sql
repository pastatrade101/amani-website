-- Experiences enrichment (on tour_categories) + Destination scores (on destinations).
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

alter table tour_categories add column if not exists who_its_for text;
alter table tour_categories add column if not exists fitness text;
alter table tour_categories add column if not exists highlights text[] not null default '{}';

alter table destinations add column if not exists score_wildlife numeric(3, 1) check (score_wildlife >= 0 and score_wildlife <= 10);
alter table destinations add column if not exists score_luxury numeric(3, 1) check (score_luxury >= 0 and score_luxury <= 10);
alter table destinations add column if not exists score_family numeric(3, 1) check (score_family >= 0 and score_family <= 10);
alter table destinations add column if not exists score_photography numeric(3, 1) check (score_photography >= 0 and score_photography <= 10);
alter table destinations add column if not exists score_adventure numeric(3, 1) check (score_adventure >= 0 and score_adventure <= 10);
alter table destinations add column if not exists score_budget_from numeric(12, 2);
