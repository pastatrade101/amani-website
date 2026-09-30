-- Itinerary days get a one-line summary, several photos, and a place to sleep
-- for each safari style.
--
-- itinerary_days.summary      one line under the day title.
-- itinerary_days.image_urls   the day's photos, first is the lead. image_url is
--                             kept equal to image_urls[1] for older readers.
-- itinerary_day_stays         where travellers sleep that day, per safari style
--                             (budget / midrange / luxury): a lodge in the CMS,
--                             or a free-text name for a property that is not.
--                             itinerary_days.accommodation_id / accommodation
--                             stay in step with the midrange stay (else the
--                             first one) for older readers.
--
-- Additive and idempotent. Existing photos and stays are backfilled; a day that
-- already has stays is never backfilled again.

alter table itinerary_days add column if not exists summary text;
alter table itinerary_days add column if not exists image_urls text[] not null default '{}';

comment on column itinerary_days.summary is 'One line shown under the day title.';
comment on column itinerary_days.image_urls is
  'Day photos, first is the lead. image_url mirrors the first one for older readers.';

update itinerary_days
set image_urls = array[image_url]
where coalesce(btrim(image_url), '') <> ''
  and cardinality(image_urls) = 0;

create table if not exists itinerary_day_stays (
  itinerary_day_id uuid not null,
  safari_style text not null,
  lodge_id uuid,
  accommodation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint itinerary_day_stays_pkey primary key (itinerary_day_id, safari_style),
  -- Named so the API's embed hints stay stable.
  constraint itinerary_day_stays_itinerary_day_id_fkey
    foreign key (itinerary_day_id) references itinerary_days(id) on delete cascade,
  constraint itinerary_day_stays_lodge_id_fkey
    foreign key (lodge_id) references lodges(id) on delete set null,
  constraint itinerary_day_stays_safari_style_check
    check (safari_style in ('budget', 'midrange', 'luxury')),
  -- A stay names somewhere: a linked lodge, or at least a property name.
  constraint itinerary_day_stays_place_check
    check (lodge_id is not null or coalesce(btrim(accommodation), '') <> '')
);

create index if not exists idx_itinerary_day_stays_lodge on itinerary_day_stays (lodge_id) where lodge_id is not null;

drop trigger if exists set_itinerary_day_stays_updated_at on itinerary_day_stays;
create trigger set_itinerary_day_stays_updated_at
  before update on itinerary_day_stays
  for each row execute function set_updated_at();

-- `on delete set null` would break the place check for a stay that only had
-- the lodge link. Removing a property therefore keeps its name on the stay
-- first, so the day degrades to free text instead of blocking the delete.
create or replace function itinerary_day_stays_keep_lodge_name() returns trigger
language plpgsql as $$
begin
  update itinerary_day_stays
  set accommodation = old.name
  where lodge_id = old.id
    and coalesce(btrim(accommodation), '') = '';
  return old;
end;
$$;

drop trigger if exists keep_lodge_name_on_itinerary_day_stays on lodges;
create trigger keep_lodge_name_on_itinerary_day_stays
  before delete on lodges
  for each row execute function itinerary_day_stays_keep_lodge_name();

-- Every existing single stay becomes that day's midrange stay, which is the
-- style the public pages open on.
insert into itinerary_day_stays (itinerary_day_id, safari_style, lodge_id, accommodation)
select d.id, 'midrange', d.accommodation_id, nullif(btrim(d.accommodation), '')
from itinerary_days d
where (d.accommodation_id is not null or coalesce(btrim(d.accommodation), '') <> '')
  and not exists (select 1 from itinerary_day_stays s where s.itinerary_day_id = d.id)
on conflict (itinerary_day_id, safari_style) do nothing;

-- Backend-only, like every other table: the API uses the service role.
alter table itinerary_day_stays enable row level security;

notify pgrst, 'reload schema';
