-- Travel styles — persona-led landing pages (/travel-styles).
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

create table if not exists travel_styles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  emotional_promise text,
  description text,
  desires text[] not null default '{}',
  concerns text[] not null default '{}',
  persona text,
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
create index if not exists idx_travel_styles_slug on travel_styles(slug);
create index if not exists idx_travel_styles_status on travel_styles(status);
drop trigger if exists set_travel_styles_updated_at on travel_styles;
create trigger set_travel_styles_updated_at before update on travel_styles for each row execute function set_updated_at();

insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array['travel_styles.view','travel_styles.create','travel_styles.update','travel_styles.delete','travel_styles.publish']) as permission_key
on conflict (permission_key) do update set description = excluded.description;
insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key from permissions where permission_key like 'travel_styles.%'
on conflict do nothing;
