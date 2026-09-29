-- The route map: where each day of a tour actually is, and how the traveller
-- gets there.
--
-- An itinerary day has never been linked to a place. It had a title, prose and
-- an optional lodge — and the lodge's destination was reachable only by NAME,
-- through a second join, and only on days that happened to name a property.
-- A map needs a coordinate per day, and there was nowhere to keep one.
--
-- The day points at a DESTINATION rather than carrying its own latitude and
-- longitude. Destinations already hold coordinates, so a place is pinned once
-- and every tour that visits it inherits the pin; typing coordinates into each
-- day would give the same park fifty slightly different positions.

alter table itinerary_days
  add column if not exists destination_id uuid references destinations(id) on delete set null;

-- How the traveller REACHES this day's place from the previous one. It draws the
-- leg into this stop, which is why it belongs to the arriving day. Null is not a
-- default mode, it is "not stated": the map draws a neutral line rather than
-- claiming a flight nobody promised.
alter table itinerary_days
  add column if not exists travel_mode text
  check (travel_mode is null or travel_mode in ('DRIVE', 'FLY', 'BOAT'));

create index if not exists itinerary_days_destination_id_idx on itinerary_days (destination_id);

comment on column itinerary_days.destination_id is
  'The place this day is spent. Its coordinates pin the day on the route map.';
comment on column itinerary_days.travel_mode is
  'DRIVE, FLY or BOAT: how the traveller reaches this day''s place. Null means not stated.';

-- Backfill ONLY what is already recorded: a day that sleeps at a linked lodge is
-- spent at that lodge's destination. Nothing is inferred from a title or from
-- prose — a wrong pin on a map a traveller books from is worse than no pin.
update itinerary_days d
set destination_id = l.destination_id
from lodges l
where d.accommodation_id = l.id
  and d.destination_id is null
  and l.destination_id is not null;

notify pgrst, 'reload schema';
