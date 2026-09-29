-- Allow one tour to appear under multiple destinations while keeping
-- tours.destination_id as the primary/backward-compatible destination.
-- Idempotent: safe to run more than once.

create table if not exists tour_destinations (
  tour_id uuid not null references tours(id) on delete cascade,
  destination_id uuid not null references destinations(id) on delete cascade,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (tour_id, destination_id)
);

create index if not exists idx_tour_destinations_tour on tour_destinations(tour_id, sort_order);
create index if not exists idx_tour_destinations_destination on tour_destinations(destination_id);
create unique index if not exists idx_tour_destinations_one_primary
  on tour_destinations(tour_id)
  where is_primary;

insert into tour_destinations (tour_id, destination_id, sort_order, is_primary)
select id, destination_id, 0, true
from tours
where destination_id is not null
on conflict (tour_id, destination_id) do update
  set sort_order = least(tour_destinations.sort_order, excluded.sort_order),
      is_primary = tour_destinations.is_primary or excluded.is_primary;
