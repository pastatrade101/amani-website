-- Accommodation: a real photo gallery, reusable amenities, and a link from an
-- itinerary day to the property it stays at.
--
-- Idempotent: safe to run more than once, and safe on the live database. It
-- adds only — nothing is dropped, renamed or backfilled destructively, and
-- itinerary_days.accommodation stays exactly as it is so existing itineraries
-- keep rendering from free text until somebody links them.
--
-- Run in the Supabase SQL editor.

-- ── 1. Gallery ───────────────────────────────────────────────────────────────
-- Deliberately its own table rather than a lodge_id column on gallery_images:
-- /gallery renders every published row in that table, so lodge photography
-- would swamp the curated site gallery.
create table if not exists lodge_images (
  id uuid primary key default gen_random_uuid(),
  lodge_id uuid not null references lodges(id) on delete cascade,
  image_url text not null,
  alt_text text,
  caption text,
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lodge_images_lodge on lodge_images(lodge_id, sort_order);

-- At most one cover per property, enforced by the database rather than by
-- remembering to clear the old one in application code.
create unique index if not exists idx_lodge_images_one_cover
  on lodge_images(lodge_id)
  where is_cover;

drop trigger if exists set_lodge_images_updated_at on lodge_images;
create trigger set_lodge_images_updated_at
  before update on lodge_images
  for each row execute function set_updated_at();

-- ── 2. Amenities ─────────────────────────────────────────────────────────────
create table if not exists amenities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  -- Maps to an icon in the frontend. Kept as a stable key so renaming the
  -- label never changes the picture.
  icon_key text not null default 'dot',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_amenities_active on amenities(is_active, sort_order);

create table if not exists lodge_amenities (
  lodge_id uuid not null references lodges(id) on delete cascade,
  amenity_id uuid not null references amenities(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Composite key: the same amenity cannot be attached twice.
  primary key (lodge_id, amenity_id)
);

create index if not exists idx_lodge_amenities_lodge on lodge_amenities(lodge_id);
create index if not exists idx_lodge_amenities_amenity on lodge_amenities(amenity_id);

-- Seed the starting set. `on conflict do nothing` keeps re-runs harmless and
-- never overwrites a label an admin has edited.
insert into amenities (name, icon_key, sort_order) values
  ('Swimming Pool',     'pool',       10),
  ('Wi-Fi',             'wifi',       20),
  ('Restaurant',        'restaurant', 30),
  ('Bar',               'bar',        40),
  ('Spa',               'spa',        50),
  ('Laundry',           'laundry',    60),
  ('Airport Transfer',  'transfer',   70),
  ('Game Drives',       'safari',     80),
  ('Private Deck',      'deck',       90),
  ('Outdoor Shower',    'shower',    100),
  ('Air Conditioning',  'ac',        110),
  ('Fan',               'fan',       120),
  ('Mosquito Nets',     'net',       130),
  ('Family Rooms',      'family',    140),
  ('Solar Power',       'solar',     150),
  ('Charging Points',   'power',     160),
  ('Campfire',          'campfire',  170),
  ('Bush Dining',       'dining',    180)
on conflict (name) do nothing;

-- ── 3. Itinerary day → property ──────────────────────────────────────────────
-- Nullable and additive. `on delete set null` so removing a lodge degrades a
-- day back to its free text rather than deleting the day.
alter table itinerary_days
  add column if not exists accommodation_id uuid references lodges(id) on delete set null;

create index if not exists idx_itinerary_days_accommodation
  on itinerary_days(accommodation_id)
  where accommodation_id is not null;

-- Auto-link only where the existing free text is exactly a property name once
-- case and whitespace are normalised. Anything ambiguous is left alone and
-- keeps rendering its free text. Re-running changes nothing new.
update itinerary_days d
set accommodation_id = l.id
from lodges l
where d.accommodation_id is null
  and l.deleted_at is null
  and lower(regexp_replace(trim(d.accommodation), '\s+', ' ', 'g'))
    = lower(regexp_replace(trim(l.name), '\s+', ' ', 'g'));

-- Report what the line above linked. Read this before and after running.
select
  (select count(*) from itinerary_days where accommodation_id is not null) as days_linked,
  (select count(*) from itinerary_days where accommodation_id is null and coalesce(trim(accommodation), '') <> '') as days_still_free_text,
  (select count(*) from itinerary_days) as days_total;
