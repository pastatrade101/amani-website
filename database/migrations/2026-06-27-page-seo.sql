-- Per-page SEO overrides (Tier 2). One row per public path; when present, the
-- page uses these title/meta/OG/canonical/robots/structured-data values instead
-- of the site defaults. Absence changes nothing — pages fall back to defaults.
-- Hard-deleted (no deleted_at); removing a row simply restores the defaults.
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

create table if not exists page_seo (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  title text,
  meta_description text,
  og_title text,
  og_description text,
  og_image_url text,
  canonical_url text,
  robots text not null default 'index,follow',
  structured_data jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Resolver looks up active overrides by exact path.
create index if not exists idx_page_seo_active_path on page_seo (is_active, path);

drop trigger if exists set_page_seo_updated_at on page_seo;
create trigger set_page_seo_updated_at before update on page_seo for each row execute function set_updated_at();

insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array['page_seo.view', 'page_seo.create', 'page_seo.update', 'page_seo.delete']) as permission_key
on conflict (permission_key) do update set description = excluded.description;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key from permissions where permission_key like 'page_seo.%'
on conflict do nothing;
