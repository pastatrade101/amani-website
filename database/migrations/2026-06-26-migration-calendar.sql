-- Serengeti Great Migration calendar — month-by-month guide widget.
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

create table if not exists serengeti_migration_calendar (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  location text not null default '',
  note text not null default '',
  image_url text not null default '',
  display_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_serengeti_migration_calendar_published_order
  on serengeti_migration_calendar (is_published, display_order);

drop trigger if exists set_serengeti_migration_calendar_updated_at on serengeti_migration_calendar;
create trigger set_serengeti_migration_calendar_updated_at before update on serengeti_migration_calendar for each row execute function set_updated_at();

insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array['migration_calendar.create','migration_calendar.update','migration_calendar.delete']) as permission_key
on conflict (permission_key) do update set description = excluded.description;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key from permissions where permission_key like 'migration_calendar.%'
on conflict do nothing;
