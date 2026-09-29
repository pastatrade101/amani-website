-- Reviews — platform-attributed customer reviews with moderation.
-- Powers trust widgets + AggregateRating JSON-LD (SEO).
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('TripAdvisor', 'SafariBookings', 'Google')),
  author_name text not null,
  author_initials text not null default '',
  author_photo_url text,
  country text not null default '',
  message text not null,
  rating integer not null default 5 check (rating between 1 and 5),
  source_url text not null default '',
  tour_id uuid,
  tour_title text,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_reviews_status_sort_order on reviews(status, sort_order);
create index if not exists idx_reviews_tour_id on reviews(tour_id);

drop trigger if exists set_reviews_updated_at on reviews;
create trigger set_reviews_updated_at before update on reviews for each row execute function set_updated_at();

-- Permissions (and grant them all to super_admin).
insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array['reviews.create', 'reviews.update', 'reviews.delete']) as permission_key
on conflict (permission_key) do update set description = excluded.description;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key
from permissions
where permission_key like 'reviews.%'
on conflict do nothing;
