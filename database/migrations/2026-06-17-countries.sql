-- Countries — top-level country hub pages (intro, best months, visa & health).
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

create table if not exists countries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  hero_image_url text,
  intro_text text,
  best_months text[] not null default '{}',
  visa_info text,
  health_info text,
  currency text,
  capital text,
  phase text not null default 'live' check (phase in ('live', 'planned', 'future')),
  status publish_status not null default 'draft',
  is_featured boolean not null default false,
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

create index if not exists idx_countries_slug on countries(slug);
create index if not exists idx_countries_status on countries(status);
create index if not exists idx_countries_phase on countries(phase);

drop trigger if exists set_countries_updated_at on countries;
create trigger set_countries_updated_at before update on countries for each row execute function set_updated_at();

-- Permissions (and grant them all to super_admin).
insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array[
  'countries.view','countries.create','countries.update','countries.delete','countries.publish'
]) as permission_key
on conflict (permission_key) do update set description = excluded.description;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key
from permissions
where permission_key like 'countries.%'
on conflict do nothing;
