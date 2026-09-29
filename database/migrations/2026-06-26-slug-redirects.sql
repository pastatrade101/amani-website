-- Slug redirects — 301/302 map for changed or retired URLs (SEO link equity).
-- The frontend calls GET /api/redirects/resolve?path=… and issues the redirect.
-- Hard-deleted (no deleted_at); a retired redirect should simply be removed.
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

create table if not exists slug_redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique,
  to_path text not null,
  status_code integer not null default 301 check (status_code in (301, 302, 307, 308)),
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Resolver looks up active redirects by exact from_path.
create index if not exists idx_slug_redirects_active_from_path on slug_redirects (is_active, from_path);

drop trigger if exists set_slug_redirects_updated_at on slug_redirects;
create trigger set_slug_redirects_updated_at before update on slug_redirects for each row execute function set_updated_at();

insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array['redirects.view', 'redirects.create', 'redirects.update', 'redirects.delete']) as permission_key
on conflict (permission_key) do update set description = excluded.description;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key from permissions where permission_key like 'redirects.%'
on conflict do nothing;
