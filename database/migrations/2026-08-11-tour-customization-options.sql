-- CMS-managed "Ways to Customize This Trip" content.
-- Run once against the Supabase project, then reload the PostgREST schema cache.
alter table public.tours
  add column if not exists customization_intro text,
  add column if not exists customization_options text[] not null default '{}';

comment on column public.tours.customization_intro is
  'Optional introduction displayed above this tour customisation options.';

comment on column public.tours.customization_options is
  'Ordered CMS-managed options displayed in Ways to Customize This Trip.';

notify pgrst, 'reload schema';
