-- What an activity shows on a tour page's activities popup: a short
-- description and up to three quick highlights ("Approx. 4 hours"). Kept
-- separate from the long description and the activity page's highlight list,
-- and capped here so a card never outgrows its design.
-- Idempotent: safe to run more than once.
begin;

alter table public.activities add column if not exists short_description text;
alter table public.activities add column if not exists quick_highlights text[] not null default '{}';

alter table public.activities drop constraint if exists activities_short_description_length;
alter table public.activities add constraint activities_short_description_length
  check (short_description is null or char_length(short_description) <= 200);

alter table public.activities drop constraint if exists activities_quick_highlights_count;
alter table public.activities add constraint activities_quick_highlights_count
  check (cardinality(quick_highlights) <= 3);

notify pgrst, 'reload schema';
commit;
