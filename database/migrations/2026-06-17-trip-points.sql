-- Trip points — start & end gateways (airports, hub cities) linked to
-- destinations. Surfaced as "Getting there" on destination pages.
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

create table if not exists trip_points (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  destination_id uuid references destinations(id) on delete set null,
  role text not null default 'both' check (role in ('start', 'end', 'both')),
  gateway_type text not null default 'airport' check (gateway_type in ('airport', 'city', 'hotel', 'border', 'station')),
  airport_code text,
  description text,
  transfer_info text,
  hero_image_url text,
  image_url text,
  status publish_status not null default 'draft',
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  seo_title text,
  meta_title text,
  meta_description text,
  created_by uuid references admin_users(id) on delete set null,
  updated_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_trip_points_slug on trip_points(slug);
create index if not exists idx_trip_points_destination_id on trip_points(destination_id);
create index if not exists idx_trip_points_status on trip_points(status);
create index if not exists idx_trip_points_role on trip_points(role);

drop trigger if exists set_trip_points_updated_at on trip_points;
create trigger set_trip_points_updated_at before update on trip_points for each row execute function set_updated_at();

-- Permissions (and grant them all to super_admin).
insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array[
  'trip_points.view','trip_points.create','trip_points.update','trip_points.delete','trip_points.publish'
]) as permission_key
on conflict (permission_key) do update set description = excluded.description;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key
from permissions
where permission_key like 'trip_points.%'
on conflict do nothing;
