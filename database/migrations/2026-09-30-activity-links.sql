-- Activities connect to destinations and tours the way tours already connect
-- to destinations.
--
-- activity_destinations  where an activity can be done (many), one primary.
--                        Mirrors tour_destinations; activities.destination_id
--                        stays as the primary, for filters and older readers.
-- tour_activities        which tours include the activity (many to many).
--
-- activities gains best_months (1–12, picked from the Seasons in the CMS, like
-- tour categories), sort_order, and og_image_url for sharing.
--
-- Additive and idempotent; the existing single destination is backfilled as
-- each activity's primary link.

create table if not exists activity_destinations (
  activity_id uuid not null references activities(id) on delete cascade,
  destination_id uuid not null references destinations(id) on delete cascade,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (activity_id, destination_id)
);

create index if not exists idx_activity_destinations_activity on activity_destinations (activity_id, sort_order);
create index if not exists idx_activity_destinations_destination on activity_destinations (destination_id);
create unique index if not exists idx_activity_destinations_one_primary on activity_destinations (activity_id) where is_primary;

create table if not exists tour_activities (
  tour_id uuid not null references tours(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (tour_id, activity_id)
);

create index if not exists idx_tour_activities_tour on tour_activities (tour_id, sort_order);
create index if not exists idx_tour_activities_activity on tour_activities (activity_id);

alter table activities add column if not exists best_months smallint[] not null default '{}';
alter table activities add column if not exists sort_order integer not null default 0;
alter table activities add column if not exists og_image_url text;

insert into activity_destinations (activity_id, destination_id, sort_order, is_primary)
select id, destination_id, 0, true
from activities
where destination_id is not null
  and deleted_at is null
on conflict (activity_id, destination_id) do nothing;

-- Backend-only, like every other table: the API uses the service role.
alter table activity_destinations enable row level security;
alter table tour_activities enable row level security;

notify pgrst, 'reload schema';
