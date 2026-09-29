-- Safety guide: site-wide safety_topics (the /safety hub) plus per-destination
-- health & safety fields that feed into it.
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

-- 1. Per-destination health & safety fields.
alter table destinations add column if not exists safety_overview text;
alter table destinations add column if not exists health_vaccinations text;
alter table destinations add column if not exists security_advice text;
alter table destinations add column if not exists travel_insurance_note text;
alter table destinations add column if not exists emergency_contacts text;

-- 2. Site-wide safety topics.
create table if not exists safety_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null default 'general' check (category in ('general', 'health', 'security', 'wildlife', 'practical')),
  icon text,
  summary text,
  content text,
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

create index if not exists idx_safety_topics_slug on safety_topics(slug);
create index if not exists idx_safety_topics_status on safety_topics(status);
create index if not exists idx_safety_topics_category on safety_topics(category);

drop trigger if exists set_safety_topics_updated_at on safety_topics;
create trigger set_safety_topics_updated_at before update on safety_topics for each row execute function set_updated_at();

-- 3. Permissions (and grant them all to super_admin).
insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array[
  'safety_topics.view','safety_topics.create','safety_topics.update','safety_topics.delete','safety_topics.publish'
]) as permission_key
on conflict (permission_key) do update set description = excluded.description;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key
from permissions
where permission_key like 'safety_topics.%'
on conflict do nothing;
