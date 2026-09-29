begin;

create table if not exists tour_pricing_seasons (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references tours(id) on delete cascade,
  season_type text not null default 'CUSTOM' check (season_type in ('STANDARD_SEASON','PEAK_SEASON','CUSTOM')),
  season_name text not null,
  start_date date,
  end_date date,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  pricing_basis text not null default 'PER_PERSON' check (pricing_basis in ('PER_PERSON','PER_GROUP')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists tour_group_prices (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references tour_pricing_seasons(id) on delete cascade,
  minimum_travelers integer not null check (minimum_travelers >= 1),
  maximum_travelers integer check (maximum_travelers is null or maximum_travelers >= minimum_travelers),
  room_count integer not null default 1 check (room_count >= 0),
  price numeric(12,2) check (price is null or price >= 0),
  price_status text not null default 'FIXED_PRICE' check (price_status in ('FIXED_PRICE','ON_REQUEST','NOT_AVAILABLE')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, minimum_travelers, maximum_travelers),
  check ((price_status = 'FIXED_PRICE' and price is not null) or (price_status <> 'FIXED_PRICE' and price is null))
);

create index if not exists idx_tour_pricing_seasons_tour on tour_pricing_seasons(tour_id, sort_order);
create index if not exists idx_tour_group_prices_season on tour_group_prices(season_id, sort_order);

drop trigger if exists set_tour_pricing_seasons_updated_at on tour_pricing_seasons;
create trigger set_tour_pricing_seasons_updated_at before update on tour_pricing_seasons for each row execute function set_updated_at();
drop trigger if exists set_tour_group_prices_updated_at on tour_group_prices;
create trigger set_tour_group_prices_updated_at before update on tour_group_prices for each row execute function set_updated_at();

commit;
