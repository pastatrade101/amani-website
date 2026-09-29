-- Category form upgrade: travel information, publishing flags and SEO.
-- Apply by pasting into the Supabase SQL editor (single transaction: a failure
-- rolls the whole file back, nothing half-applies).
--
-- Adds to tour_categories:
--   short_description  card/preview copy, capped at 250 chars
--   fitness_level      structured enum replacing free-text `fitness` in the
--                      admin form. The legacy `fitness` column is kept and left
--                      untouched — the public page falls back to it wherever
--                      fitness_level has not been set yet, so nothing is lost.
--   min_days/max_days  recommended duration range
--   best_months        months (1-12) suited to the category, for filtering
--   is_featured        homepage/featured-section eligibility (NOT sort order)
--   seo_image_url      Open Graph image; frontend falls back to image_url

alter table tour_categories add column if not exists short_description text;
alter table tour_categories add column if not exists fitness_level text;
alter table tour_categories add column if not exists min_days integer;
alter table tour_categories add column if not exists max_days integer;
alter table tour_categories add column if not exists best_months smallint[] not null default '{}';
alter table tour_categories add column if not exists is_featured boolean not null default false;
alter table tour_categories add column if not exists seo_image_url text;

-- Constraints, added idempotently. Values the API can write are validated by
-- zod first; these keep any other write path honest.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tour_categories_short_description_len') then
    alter table tour_categories add constraint tour_categories_short_description_len
      check (short_description is null or char_length(short_description) <= 250);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tour_categories_fitness_level_check') then
    alter table tour_categories add constraint tour_categories_fitness_level_check
      check (fitness_level is null or fitness_level in ('easy', 'moderate', 'active', 'challenging', 'strenuous'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tour_categories_min_days_check') then
    alter table tour_categories add constraint tour_categories_min_days_check
      check (min_days is null or min_days >= 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tour_categories_max_days_check') then
    alter table tour_categories add constraint tour_categories_max_days_check
      check (max_days is null or max_days >= 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tour_categories_days_range_check') then
    alter table tour_categories add constraint tour_categories_days_range_check
      check (min_days is null or max_days is null or max_days >= min_days);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tour_categories_best_months_check') then
    alter table tour_categories add constraint tour_categories_best_months_check
      check (best_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]);
  end if;
end $$;

-- Backfill fitness_level from the legacy free text — only where the text
-- clearly starts with one of the enum words ("Easy — game drives, no walking
-- required." -> easy). Anything ambiguous is left null rather than guessed.
update tour_categories
set fitness_level = case
  when fitness ~* '^\s*easy\M' then 'easy'
  when fitness ~* '^\s*moderate\M' then 'moderate'
  when fitness ~* '^\s*active\M' then 'active'
  when fitness ~* '^\s*challenging\M' then 'challenging'
  when fitness ~* '^\s*strenuous\M' then 'strenuous'
end
where fitness_level is null
  and fitness ~* '^\s*(easy|moderate|active|challenging|strenuous)\M';

-- Slug uniqueness as a DB fact, not just an app-side convention. The API
-- already dedups via createUniqueSlug, so collisions should not exist; if one
-- does, this statement fails and the whole file rolls back untouched — fix the
-- duplicate slug and re-run.
create unique index if not exists tour_categories_slug_unique
  on tour_categories (slug)
  where deleted_at is null;
