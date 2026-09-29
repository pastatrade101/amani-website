-- Tour-operator accommodation CMS expansion. Additive and idempotent.
alter type publish_status add value if not exists 'hidden';
alter table lodges
  add column if not exists short_description text,
  add column if not exists settings text[] not null default '{}',
  add column if not exists recommended_nights smallint,
  add column if not exists best_months text[] not null default '{}',
  add column if not exists google_maps_url text,
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7),
  add column if not exists nearest_airport text,
  add column if not exists transfer_time text,
  add column if not exists distance_airstrip text,
  add column if not exists distance_park_gate text,
  add column if not exists road_accessibility text,
  add column if not exists fly_in_available boolean not null default false,
  add column if not exists transfer_available boolean not null default false,
  add column if not exists mobile_hero_image_url text,
  add column if not exists social_image_url text,
  add column if not exists indexable boolean not null default true,
  add column if not exists children_allowed boolean,
  add column if not exists minimum_child_age smallint,
  add column if not exists family_friendly boolean,
  add column if not exists honeymoon_friendly boolean,
  add column if not exists accessibility text,
  add column if not exists electricity_availability text,
  add column if not exists wifi_availability text,
  add column if not exists mobile_networks text[] not null default '{}',
  add column if not exists wheelchair_accessible boolean,
  add column if not exists show_rates_publicly boolean not null default false,
  add column if not exists show_property_publicly boolean not null default true,
  add column if not exists arrival_instructions text,
  add column if not exists traveler_notes text;

-- Remove the legacy lowercase checks before converting stored values. Keeping
-- either old check in place would reject the first uppercase UPDATE row.
alter table lodges drop constraint if exists lodges_lodge_type_check;
alter table lodges drop constraint if exists lodges_accommodation_level_check;

update lodges set lodge_type=case lodge_type when 'hotel' then 'HOTEL' when 'lodge' then 'SAFARI_LODGE' when 'tented_camp' then 'TENTED_CAMP' when 'mobile_camp' then 'MOBILE_CAMP' when 'treehouse' then 'ECO_LODGE' else upper(lodge_type) end;
update lodges set accommodation_level=case accommodation_level when 'budget' then 'BUDGET' when 'mid_range' then 'MID_RANGE' when 'luxury' then 'LUXURY' when 'ultra_luxury' then 'PREMIUM_LUXURY' else upper(accommodation_level) end;

alter table lodges add constraint lodges_lodge_type_check check
  (lodge_type in ('HOTEL','SAFARI_LODGE','TENTED_CAMP','MOBILE_CAMP','BEACH_RESORT','VILLA','GUEST_HOUSE','ECO_LODGE','BOUTIQUE_HOTEL'));
alter table lodges add constraint lodges_accommodation_level_check check
  (accommodation_level in ('BUDGET','MID_RANGE','LUXURY','PREMIUM_LUXURY'));

alter table lodge_images
  add column if not exists category text not null default 'EXTERIOR',
  add column if not exists is_featured boolean not null default false;

create table if not exists lodge_highlights (
  id uuid primary key default gen_random_uuid(), lodge_id uuid not null references lodges(id) on delete cascade,
  title text not null, sort_order integer not null default 0
);
create index if not exists idx_lodge_highlights_lodge on lodge_highlights(lodge_id,sort_order);

create table if not exists accommodation_experiences (
  id uuid primary key default gen_random_uuid(), name text not null unique, slug text not null unique,
  is_active boolean not null default true, sort_order integer not null default 0
);
create table if not exists lodge_experiences (
  lodge_id uuid not null references lodges(id) on delete cascade,
  experience_id uuid not null references accommodation_experiences(id) on delete cascade,
  primary key(lodge_id,experience_id)
);

create table if not exists lodge_rooms (
  id uuid primary key default gen_random_uuid(), lodge_id uuid not null references lodges(id) on delete cascade,
  name text not null, room_type text not null default 'STANDARD_ROOM', short_description text, max_adults smallint, max_children smallint, max_guests smallint,
  bed_types text[] not null default '{}', unit_count smallint, views text[] not null default '{}', amenities text[] not null default '{}',
  sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_lodge_rooms_lodge on lodge_rooms(lodge_id,sort_order);
drop trigger if exists set_lodge_rooms_updated_at on lodge_rooms;
create trigger set_lodge_rooms_updated_at before update on lodge_rooms for each row execute function set_updated_at();

create table if not exists lodge_room_images (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references lodge_rooms(id) on delete cascade,
  image_url text not null, alt_text text, caption text, sort_order integer not null default 0
);
create index if not exists idx_lodge_room_images_room on lodge_room_images(room_id,sort_order);

create table if not exists lodge_seasonal_rates (
  id uuid primary key default gen_random_uuid(), lodge_id uuid not null references lodges(id) on delete cascade,
  room_id uuid references lodge_rooms(id) on delete set null, season_type text not null default 'HIGH_SEASON', season_name text,
  valid_from date not null, valid_until date not null, currency char(3) not null default 'USD',
  rack_rate numeric(12,2), net_rate numeric(12,2), single_rate numeric(12,2), double_rate numeric(12,2),
  triple_rate numeric(12,2), child_rate numeric(12,2), single_supplement numeric(12,2),
  pricing_basis text not null default 'PER_PERSON_SHARING', meal_plan text not null default 'FULL_BOARD',
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(valid_until >= valid_from), check(pricing_basis in ('PER_PERSON','PER_PERSON_SHARING','PER_ROOM','PER_UNIT','PER_NIGHT')),
  check(meal_plan in ('ROOM_ONLY','BED_AND_BREAKFAST','HALF_BOARD','FULL_BOARD','ALL_INCLUSIVE','FULL_BOARD_PLUS_ACTIVITIES')),
  check(season_type in ('LOW_SEASON','GREEN_SEASON','SHOULDER_SEASON','HIGH_SEASON','PEAK_SEASON','FESTIVE_SEASON'))
);
create index if not exists idx_lodge_rates_lookup on lodge_seasonal_rates(lodge_id,valid_from,valid_until);
drop trigger if exists set_lodge_rates_updated_at on lodge_seasonal_rates;
create trigger set_lodge_rates_updated_at before update on lodge_seasonal_rates for each row execute function set_updated_at();

create table if not exists lodge_inclusions (
  id uuid primary key default gen_random_uuid(), lodge_id uuid not null references lodges(id) on delete cascade,
  title text not null, is_included boolean not null default true, sort_order integer not null default 0
);

create table if not exists accommodation_suppliers (
  id uuid primary key default gen_random_uuid(), name text not null unique, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
drop trigger if exists set_accommodation_suppliers_updated_at on accommodation_suppliers;
create trigger set_accommodation_suppliers_updated_at before update on accommodation_suppliers for each row execute function set_updated_at();

create table if not exists lodge_suppliers (
  lodge_id uuid primary key references lodges(id) on delete cascade, supplier_id uuid references accommodation_suppliers(id) on delete set null, contact_person text,
  reservation_email text, phone_whatsapp text, commission_percent numeric(5,2), contract_start date, contract_end date,
  payment_terms text, cancellation_terms text, supplier_preference text not null default 'STANDARD', preferred_supplier boolean not null default false,
  personally_inspected boolean not null default false, last_inspection_date date, internal_notes text,
  contract_document_url text, updated_at timestamptz not null default now()
);
alter table lodge_suppliers drop constraint if exists lodge_suppliers_preference_check;
alter table lodge_suppliers add constraint lodge_suppliers_preference_check check (supplier_preference in ('PREFERRED','STANDARD','BACKUP','DO_NOT_USE'));
drop trigger if exists set_lodge_suppliers_updated_at on lodge_suppliers;
create trigger set_lodge_suppliers_updated_at before update on lodge_suppliers for each row execute function set_updated_at();

create table if not exists lodge_destinations (
  lodge_id uuid not null references lodges(id) on delete cascade, destination_id uuid not null references destinations(id) on delete cascade,
  is_primary boolean not null default false, primary key(lodge_id,destination_id)
);
create table if not exists lodge_tours (
  lodge_id uuid not null references lodges(id) on delete cascade, tour_id uuid not null references tours(id) on delete cascade,
  primary key(lodge_id,tour_id)
);
create table if not exists lodge_alternatives (
  lodge_id uuid not null references lodges(id) on delete cascade, alternative_lodge_id uuid not null references lodges(id) on delete cascade,
  primary key(lodge_id,alternative_lodge_id), check(lodge_id <> alternative_lodge_id)
);

insert into accommodation_experiences(name,slug,sort_order) values
 ('Game Drive','GAME_DRIVE',10),('Private Game Drive','PRIVATE_GAME_DRIVE',20),('Walking Safari','WALKING_SAFARI',30),
 ('Night Game Drive','NIGHT_GAME_DRIVE',40),('Balloon Safari','BALLOON_SAFARI',50),('Bush Breakfast','BUSH_BREAKFAST',60),
 ('Bush Lunch','BUSH_LUNCH',70),('Bush Dinner','BUSH_DINNER',80),('Sundowners','SUNDOWNERS',90),
 ('Bird Watching','BIRD_WATCHING',100),('Cultural Visit','CULTURAL_VISIT',110),('Village Visit','VILLAGE_VISIT',120),
 ('Boat Safari','BOAT_SAFARI',130),('Canoeing','CANOEING',140),('Horse Riding','HORSE_RIDING',150),
 ('Beach Activities','BEACH_ACTIVITIES',160),('Snorkeling','SNORKELING',170),('Diving','DIVING',180),
 ('Fishing','FISHING',190),('Hiking','HIKING',200)
on conflict(slug) do nothing;

insert into amenities(name,icon_key,sort_order) values
 ('Ensuite Bathroom','bathroom',190),('Hot Shower','shower',200),('Private Balcony/Veranda','deck',210),
 ('Wheelchair Access','accessibility',220),('Gym','gym',230),('Room Service','room-service',240),
 ('Bathtub','bath',250),('Private Balcony','balcony',260),('Private Veranda','deck',270),
 ('Parking','parking',280),('Generator','generator',290),('Safe','safe',300),('Minibar','minibar',310),
 ('Fireplace','fireplace',320),('Luggage Storage','luggage',330)
on conflict(name) do nothing;
