-- Activities — things to do, linked to destinations. Surfaced on destination
-- pages ("Top experiences") and the homepage Popular Activities slider.
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  destination_id uuid references destinations(id) on delete set null,
  location_label text,
  category text not null default 'wildlife' check (category in ('wildlife', 'adventure', 'cultural', 'water', 'trekking', 'relaxation')),
  difficulty text check (difficulty in ('easy', 'moderate', 'challenging', 'strenuous')),
  description text,
  why_we_recommend text,
  highlights text[] not null default '{}',
  hero_image_url text,
  image_url text,
  duration_label text,
  price_from numeric(12, 2),
  currency text not null default 'USD',
  price_unit text,
  badge text,
  best_season text[] not null default '{}',
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

create index if not exists idx_activities_slug on activities(slug);
create index if not exists idx_activities_destination_id on activities(destination_id);
create index if not exists idx_activities_status on activities(status);
create index if not exists idx_activities_category on activities(category);

drop trigger if exists set_activities_updated_at on activities;
create trigger set_activities_updated_at before update on activities for each row execute function set_updated_at();

-- Permissions (and grant them all to super_admin).
insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array[
  'activities.view','activities.create','activities.update','activities.delete','activities.publish'
]) as permission_key
on conflict (permission_key) do update set description = excluded.description;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key
from permissions
where permission_key like 'activities.%'
on conflict do nothing;
