-- Safari packages — the landing-page engine (/safari-packages/[slug]).
--
-- One row is one landing page. `sections` holds an ordered array of typed
-- content blocks, so an editor composes a page in the admin without a developer
-- and without a migration every time a new kind of block is wanted.
--
-- Two deliberate defaults:
--   status    = 'draft'  — nothing is public until someone publishes it.
--   indexable = false    — and nothing is offered to a search engine until an
--                          editor confirms the page says something its siblings
--                          do not. The column is named `indexable`, matching
--                          the one `lodges` already carries; no is_ prefix, so
--                          there is one spelling of this idea in the schema.
--
-- Idempotent and additive. Safe to run on the live database, safe to re-run.
-- Paste into the Supabase SQL editor.

begin;

create table if not exists safari_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,

  -- The trip this page is about. The itinerary block renders THIS tour's real
  -- itinerary_days — including their published translations — so the days are
  -- never retyped into the page and cannot drift away from the tour itself.
  -- on delete set null: losing a tour must not delete the landing page.
  tour_id uuid references tours(id) on delete set null,
  category_id uuid references tour_categories(id) on delete set null,

  hero_eyebrow text,
  hero_title text,
  hero_subtitle text,
  hero_image_url text,

  -- The engine: an ordered array of { "type": "...", ... } blocks. Loose by
  -- design — the block vocabulary grows without a migration, and the renderer
  -- skips a type it does not recognise rather than throwing.
  sections jsonb not null default '[]'::jsonb,

  status publish_status not null default 'draft',
  indexable boolean not null default false,
  is_featured boolean not null default false,
  sort_order integer not null default 0,

  seo_title text,
  meta_title text,
  meta_description text,
  og_image_url text,

  created_by uuid references admin_users(id) on delete set null,
  updated_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- For a database that already has an earlier version of this table.
alter table safari_packages add column if not exists tour_id uuid references tours(id) on delete set null;
alter table safari_packages add column if not exists category_id uuid references tour_categories(id) on delete set null;
alter table safari_packages add column if not exists sections jsonb not null default '[]'::jsonb;
alter table safari_packages add column if not exists indexable boolean not null default false;
alter table safari_packages add column if not exists og_image_url text;

create index if not exists idx_safari_packages_slug on safari_packages(slug);
create index if not exists idx_safari_packages_status on safari_packages(status);
create index if not exists idx_safari_packages_tour on safari_packages(tour_id);
-- Exactly the question the sitemap asks: which live rows may be crawled.
create index if not exists idx_safari_packages_indexable
  on safari_packages(status, indexable) where deleted_at is null;

drop trigger if exists set_safari_packages_updated_at on safari_packages;
create trigger set_safari_packages_updated_at
  before update on safari_packages
  for each row execute function set_updated_at();

-- The renderer iterates `sections`. An object written here instead of an array
-- would reach it as something it cannot loop over, so the shape is enforced
-- where it cannot be bypassed rather than only in the API layer.
alter table safari_packages drop constraint if exists safari_packages_sections_is_array;
alter table safari_packages add constraint safari_packages_sections_is_array
  check (jsonb_typeof(sections) = 'array');

insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array[
  'safari_packages.view',
  'safari_packages.create',
  'safari_packages.update',
  'safari_packages.delete',
  'safari_packages.publish'
]) as permission_key
on conflict (permission_key) do update set description = excluded.description;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key
from permissions where permission_key like 'safari_packages.%'
on conflict do nothing;

commit;

-- ── After applying ────────────────────────────────────────────────────────
--
-- Nothing appears anywhere yet. A page becomes public when an editor sets it
-- to published, and becomes crawlable only when they additionally tick
-- indexable — which the sitemap and the robots meta tag both read.
