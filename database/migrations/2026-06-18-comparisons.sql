-- Comparisons — decision-stage "X vs Y" pages (/compare).
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

create table if not exists comparisons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  eyebrow text,
  intro text,
  a_name text not null,
  a_image_url text,
  b_name text not null,
  b_image_url text,
  dimensions jsonb not null default '[]'::jsonb,
  verdict text,
  cta_label text,
  cta_href text,
  faqs jsonb not null default '[]'::jsonb,
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
create index if not exists idx_comparisons_slug on comparisons(slug);
create index if not exists idx_comparisons_status on comparisons(status);
drop trigger if exists set_comparisons_updated_at on comparisons;
create trigger set_comparisons_updated_at before update on comparisons for each row execute function set_updated_at();

insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array['comparisons.view','comparisons.create','comparisons.update','comparisons.delete','comparisons.publish']) as permission_key
on conflict (permission_key) do update set description = excluded.description;
insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key from permissions where permission_key like 'comparisons.%'
on conflict do nothing;
