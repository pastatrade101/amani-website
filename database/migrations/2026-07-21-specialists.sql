-- Specialists (named travel specialists / team / advisors).
--
-- The human face of the brand on tour pages and after enquiry (SRS v2.0 §5 trust).
-- Mirrors the `testimonials` entity in structure: a flat, admin-managed content
-- table with publish_status, is_featured and sort_order, exposed through the same
-- generic REST list/get/create/update/soft-delete helpers.
--
-- Non-breaking: `create table if not exists` plus additive, idempotent permission
-- grants — safe to run repeatedly. Run the companion seed
-- (database/seeds/specialists.seed.sql) afterwards to load the starter rows.

create table if not exists specialists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  photo_url text,
  blurb text,
  whatsapp_number text,
  tripadvisor_url text,
  status publish_status not null default 'draft',
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references admin_users(id) on delete set null,
  updated_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table specialists
  add column if not exists tripadvisor_url text;

create index if not exists idx_specialists_status on specialists(status);
create index if not exists idx_specialists_is_featured on specialists(is_featured);
create index if not exists idx_specialists_sort_order on specialists(sort_order);

drop trigger if exists set_specialists_updated_at on specialists;
create trigger set_specialists_updated_at before update on specialists for each row execute function set_updated_at();

-- Permissions: mirror the testimonials permission set (view/create/update/delete/publish).
insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array[
  'specialists.view','specialists.create','specialists.update','specialists.delete','specialists.publish'
]) as permission_key
on conflict (permission_key) do update set description = excluded.description;

-- super_admin + admin get the full specialists permission set.
insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key
from permissions where permission_key like 'specialists.%'
on conflict (role, permission_key) do nothing;

insert into role_permissions (role, permission_key)
select 'admin'::user_role, permission_key
from permissions where permission_key like 'specialists.%'
on conflict (role, permission_key) do nothing;

-- content_manager: view/create/update/publish (mirrors testimonials).
insert into role_permissions (role, permission_key)
select 'content_manager'::user_role, permission_key
from permissions
where permission_key = any(array['specialists.view','specialists.create','specialists.update','specialists.publish'])
on conflict (role, permission_key) do nothing;

-- editor + viewer: read-only.
insert into role_permissions (role, permission_key)
values ('editor'::user_role, 'specialists.view'), ('viewer'::user_role, 'specialists.view')
on conflict (role, permission_key) do nothing;
