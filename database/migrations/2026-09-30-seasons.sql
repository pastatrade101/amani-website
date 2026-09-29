-- Seasons for the homepage "When should you go?" section.
--
-- One row paints both halves of that section: the month strip (every month
-- between start_month and end_month takes the season's tone) and the season
-- card (icon, name, month range, description, the advantages/disadvantages
-- behind "Travel considerations", and the "Best for" line).
--
-- A range may wrap the year end, e.g. November (11) to February (2).
-- `icon` and `tone` are keys the frontend maps to a Lucide icon and a colour
-- set; the API validates them against the same lists.
--
-- Additive and idempotent. The seed only runs on an empty table, so re-running
-- never overwrites what an editor has changed.

create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_month smallint not null check (start_month between 1 and 12),
  end_month smallint not null check (end_month between 1 and 12),
  description text,
  icon text not null default 'leaf',
  tone text not null default 'green',
  advantages text[] not null default '{}',
  disadvantages text[] not null default '{}',
  best_for text,
  status publish_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_seasons_sort on seasons (sort_order) where deleted_at is null;

drop trigger if exists set_seasons_updated_at on seasons;
create trigger set_seasons_updated_at before update on seasons for each row execute function set_updated_at();

-- Backend-only, like every other table here: the API uses the service role.
alter table seasons enable row level security;

insert into seasons (name, start_month, end_month, description, icon, tone, advantages, disadvantages, best_for, status, sort_order)
select * from (values
  ('Green Season', 1, 3,
   'The landscape is lush and green with beautiful scenery. It''s a quieter time to travel with fewer crowds and excellent photography opportunities.',
   'leaf', 'green',
   array['Lush green landscapes', 'Beautiful scenery', 'Fewer crowds', 'Great photography opportunities', 'Lower prices'],
   array['More rain, especially in March', 'Some lodges may be closed', 'Wildlife can be more dispersed', 'Some roads can be challenging'],
   'Green landscapes, photography and fewer crowds', 'published'::publish_status, 10),
  ('Long Rains', 4, 5,
   'This is the long rainy season with heavier and more frequent rains. The landscapes are at their greenest, with dramatic skies and fewer tourists.',
   'cloud-rain', 'blue',
   array['Lush, beautiful landscapes', 'Very few tourists', 'Lower prices', 'Excellent bird watching'],
   array['Heavier and more frequent rains', 'Some lodges may be closed', 'Game viewing can be more challenging', 'Some roads may be difficult'],
   'Budget travelers, bird watching and lush scenery', 'published'::publish_status, 20),
  ('Dry Season (Peak)', 6, 10,
   'This is a popular time for safari, with dry weather, excellent wildlife viewing and opportunities to follow the Great Migration in the northern Serengeti.',
   'sun', 'amber',
   array['Excellent wildlife viewing', 'Great Migration opportunities', 'Little to no rain', 'Clear skies and beautiful weather'],
   array['More tourists', 'Higher prices', 'Popular lodges can be fully booked', 'Parks can be busier'],
   'Great Migration, river crossings and excellent game viewing', 'published'::publish_status, 30),
  ('Short Rains', 11, 12,
   'Short rains bring a fresh, green landscape and fewer crowds. Wildlife viewing remains good, and it''s a great time to combine a safari with a beach holiday in Zanzibar.',
   'leaf', 'green',
   array['Landscapes turn green again', 'Fewer crowds', 'Great bird watching', 'Good wildlife viewing', 'Perfect for combining safari and beach'],
   array['Short rains, usually in the afternoons', 'Some roads can be muddy', 'Wildlife can be more spread out'],
   'Fewer crowds, green landscapes and bird watching', 'published'::publish_status, 40)
) as seed(name, start_month, end_month, description, icon, tone, advantages, disadvantages, best_for, status, sort_order)
where not exists (select 1 from seasons);

notify pgrst, 'reload schema';
