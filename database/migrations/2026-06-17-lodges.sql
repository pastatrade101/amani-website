-- Lodges & Camps — recommended accommodation linked to destinations.
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

create table if not exists lodges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  destination_id uuid references destinations(id) on delete set null,
  accommodation_level text not null default 'mid_range' check (accommodation_level in ('budget', 'mid_range', 'luxury', 'ultra_luxury')),
  lodge_type text not null default 'lodge' check (lodge_type in ('tented_camp', 'lodge', 'hotel', 'mobile_camp', 'treehouse')),
  description text,
  why_we_recommend text,
  hero_image_url text,
  image_url text,
  price_per_night_from numeric(12, 2),
  currency text not null default 'USD',
  best_for text[] not null default '{}',
  romantic_rating numeric(3, 1) check (romantic_rating >= 0 and romantic_rating <= 10),
  family_rating numeric(3, 1) check (family_rating >= 0 and family_rating <= 10),
  website_url text,
  status publish_status not null default 'draft',
  is_featured boolean not null default false,
  seo_title text,
  meta_title text,
  meta_description text,
  created_by uuid references admin_users(id) on delete set null,
  updated_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_lodges_slug on lodges(slug);
create index if not exists idx_lodges_destination_id on lodges(destination_id);
create index if not exists idx_lodges_status on lodges(status);
create index if not exists idx_lodges_accommodation_level on lodges(accommodation_level);

drop trigger if exists set_lodges_updated_at on lodges;
create trigger set_lodges_updated_at before update on lodges for each row execute function set_updated_at();

-- Permissions (and grant them all to super_admin).
insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array[
  'lodges.view','lodges.create','lodges.update','lodges.delete','lodges.publish'
]) as permission_key
on conflict (permission_key) do update set description = excluded.description;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key
from permissions
where permission_key like 'lodges.%'
on conflict do nothing;
