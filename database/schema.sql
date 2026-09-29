create extension if not exists "pgcrypto";

do $$ begin create type user_role as enum ('super_admin', 'admin', 'content_manager', 'booking_manager', 'finance_manager', 'editor', 'viewer'); exception when duplicate_object then null; end $$;
do $$ begin create type publish_status as enum ('draft', 'published', 'archived'); exception when duplicate_object then null; end $$;
do $$ begin create type booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type payment_status as enum ('unpaid', 'partially_paid', 'paid', 'refunded', 'failed'); exception when duplicate_object then null; end $$;
do $$ begin create type contact_status as enum ('new', 'read', 'replied', 'archived'); exception when duplicate_object then null; end $$;
do $$ begin create type media_type as enum ('image', 'video', 'document'); exception when duplicate_object then null; end $$;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  password_hash text not null,
  phone text,
  avatar_url text,
  role user_role not null default 'viewer',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists role_permissions (
  id uuid primary key default gen_random_uuid(),
  role user_role not null,
  permission_key text not null references permissions(permission_key) on delete cascade,
  created_at timestamptz not null default now(),
  unique (role, permission_key)
);

create table if not exists destinations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country text not null default 'Tanzania',
  region text,
  location text,
  short_description text,
  description text,
  image_url text,
  main_image_url text,
  banner_image_url text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  safety_overview text,
  health_vaccinations text,
  security_advice text,
  travel_insurance_note text,
  emergency_contacts text,
  score_wildlife numeric(3, 1) check (score_wildlife >= 0 and score_wildlife <= 10),
  score_luxury numeric(3, 1) check (score_luxury >= 0 and score_luxury <= 10),
  score_family numeric(3, 1) check (score_family >= 0 and score_family <= 10),
  score_photography numeric(3, 1) check (score_photography >= 0 and score_photography <= 10),
  score_adventure numeric(3, 1) check (score_adventure >= 0 and score_adventure <= 10),
  score_budget_from numeric(12, 2),
  status publish_status not null default 'draft',
  is_featured boolean not null default false,
  meta_title text,
  meta_description text,
  og_image_url text,
  created_by uuid references admin_users(id) on delete set null,
  updated_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists countries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  hero_image_url text,
  intro_text text,
  best_months text[] not null default '{}',
  visa_info text,
  health_info text,
  currency text,
  capital text,
  phase text not null default 'live' check (phase in ('live', 'planned', 'future')),
  status publish_status not null default 'draft',
  is_featured boolean not null default false,
  seo_title text,
  meta_title text,
  meta_description text,
  og_image_url text,
  created_by uuid references admin_users(id) on delete set null,
  updated_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists lodges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  destination_id uuid references destinations(id) on delete set null,
  accommodation_level text not null default 'mid_range' check (accommodation_level in ('budget', 'mid_range', 'luxury', 'ultra_luxury')),
  lodge_type text not null default 'lodge' check (lodge_type in ('tented_camp', 'lodge', 'hotel', 'mobile_camp', 'treehouse')),
  description text,
  why_we_recommend text,
  hero_image_url text,
  image_url text,
  price_per_night_from numeric(12, 2),
  currency text not null default 'USD',
  best_for text[] not null default '{}',
  romantic_rating numeric(3, 1) check (romantic_rating >= 0 and romantic_rating <= 10),
  family_rating numeric(3, 1) check (family_rating >= 0 and family_rating <= 10),
  website_url text,
  status publish_status not null default 'draft',
  is_featured boolean not null default false,
  seo_title text,
  meta_title text,
  meta_description text,
  created_by uuid references admin_users(id) on delete set null,
  updated_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  destination_id uuid references destinations(id) on delete set null,
  location_label text,
  category text not null default 'wildlife' check (category in ('wildlife', 'adventure', 'cultural', 'water', 'trekking', 'relaxation')),
  difficulty text check (difficulty in ('easy', 'moderate', 'challenging', 'strenuous')),
  description text,
  why_we_recommend text,
  highlights text[] not null default '{}',
  hero_image_url text,
  image_url text,
  duration_label text,
  price_from numeric(12, 2),
  currency text not null default 'USD',
  price_unit text,
  badge text,
  best_season text[] not null default '{}',
  status publish_status not null default 'draft',
  is_featured boolean not null default false,
  seo_title text,
  meta_title text,
  meta_description text,
  created_by uuid references admin_users(id) on delete set null,
  updated_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists trip_points (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  destination_id uuid references destinations(id) on delete set null,
  role text not null default 'both' check (role in ('start', 'end', 'both')),
  gateway_type text not null default 'airport' check (gateway_type in ('airport', 'city', 'hotel', 'border', 'station')),
  airport_code text,
  description text,
  transfer_info text,
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

create table if not exists tour_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  who_its_for text,
  fitness text,
  fitness_level text,
  min_days integer,
  max_days integer,
  best_months smallint[] not null default '{}',
  planning_notes jsonb,
  landing_page_content jsonb,
  highlights text[] not null default '{}',
  icon_url text,
  image_url text,
  lottie_url text,
  status publish_status not null default 'draft',
  sort_order integer not null default 0,
  meta_title text,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);


create table if not exists specialists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  photo_url text,
  blurb text,
  whatsapp_number text,
  tripadvisor_url text,
  status publish_status not null default 'draft',
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references admin_users(id) on delete set null,
  updated_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table specialists add column if not exists tripadvisor_url text;

create index if not exists idx_specialists_status on specialists(status);
create index if not exists idx_specialists_is_featured on specialists(is_featured);
create index if not exists idx_specialists_sort_order on specialists(sort_order);

create table if not exists tours (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  short_description text,
  full_description text,
  destination_id uuid references destinations(id) on delete set null,
  category_id uuid references tour_categories(id) on delete set null,
  specialist_id uuid references specialists(id) on delete set null,
  experience_type text,
  persona_tags text[] not null default '{}',
  duration_days integer not null default 1 check (duration_days > 0),
  duration_nights integer not null default 0 check (duration_nights >= 0),
  budget_tier text,
  price_from numeric(12, 2) not null default 0 check (price_from >= 0),
  currency text not null default 'USD',
  main_image_url text,
  banner_image_url text,
  sample_itinerary jsonb not null default '[]'::jsonb,
  highlights text[] not null default '{}',
  difficulty_level text,
  group_size text,
  group_size_min integer,
  group_size_max integer,
  minimum_age integer,
  start_location text,
  end_location text,
  is_available boolean not null default true,
  seats_remaining integer,
  status publish_status not null default 'draft',
  is_featured boolean not null default false,
  is_popular boolean not null default false,
  seo_title text,
  meta_title text,
  meta_description text,
  og_image text,
  og_image_url text,
  created_by uuid references admin_users(id) on delete set null,
  updated_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists itinerary_days (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references tours(id) on delete cascade,
  day_number integer not null,
  title text not null,
  description text,
  accommodation text,
  meals text,
  activities text,
  image_url text,
  -- The place this day is spent; its coordinates pin the day on the route map.
  -- A destination is pinned once and every tour that visits it inherits it.
  destination_id uuid references destinations(id) on delete set null,
  -- How the traveller reaches this day's place. Null is "not stated", never a default.
  travel_mode text check (travel_mode is null or travel_mode in ('DRIVE', 'FLY', 'BOAT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tour_id, day_number)
);

create table if not exists tour_inclusions (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references tours(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tour_exclusions (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references tours(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tour_images (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references tours(id) on delete cascade,
  image_url text not null,
  alt_text text,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists available_dates (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references tours(id) on delete cascade,
  start_date date not null,
  end_date date,
  available_slots integer check (available_slots >= 0),
  seats_available integer,
  price numeric(12, 2) check (price >= 0),
  price_override numeric(12, 2),
  currency text not null default 'USD',
  status text not null default 'available' check (status in ('available', 'limited', 'full', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tour_price_options (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references tours(id) on delete cascade,
  title text not null,
  label text not null,
  price numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  price_type text not null default 'per_person' check (price_type in ('per_person', 'per_group', 'per_child', 'single_supplement', 'upgrade', 'discount')),
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists booking_requests (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  tour_id uuid references tours(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  country text,
  travel_date date,
  number_of_adults integer not null default 1,
  number_of_children integer not null default 0,
  total_people integer generated always as (number_of_adults + number_of_children) stored,
  special_requests text,
  message text,
  estimated_amount numeric(12, 2),
  currency text not null default 'USD',
  status booking_status not null default 'pending',
  payment_status payment_status not null default 'unpaid',
  admin_notes text,
  assigned_to uuid references admin_users(id) on delete set null,
  ai_conversation_id uuid,
  source text not null default 'website_booking_form',
  lead_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references booking_requests(id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'USD',
  payment_method text,
  transaction_reference text,
  payment_provider text,
  status payment_status not null default 'unpaid',
  paid_at timestamptz,
  notes text,
  created_by uuid references admin_users(id) on delete set null,
  updated_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists exchange_rate_snapshots (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  base_currency text not null default 'USD',
  rates jsonb,
  provider_timestamp timestamptz,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  status text not null check (status in ('success', 'failed')),
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references admin_users(id) on delete set null
);

create table if not exists exchange_rate_locks (
  lock_key text primary key,
  owner text not null,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create or replace function exchange_rates_try_lock(p_lock_key text, p_owner text, p_ttl_seconds integer)
returns boolean as $$
declare
  v_rows integer;
begin
  insert into exchange_rate_locks(lock_key, owner, locked_at, expires_at)
  values (p_lock_key, p_owner, now(), now() + make_interval(secs => p_ttl_seconds))
  on conflict (lock_key) do update
    set owner = excluded.owner,
        locked_at = excluded.locked_at,
        expires_at = excluded.expires_at
    where exchange_rate_locks.expires_at <= now()
       or exchange_rate_locks.owner = p_owner;

  get diagnostics v_rows = row_count;
  return coalesce(v_rows, 0) > 0;
end;
$$ language plpgsql;

create or replace function exchange_rates_release_lock(p_lock_key text, p_owner text)
returns void as $$
begin
  delete from exchange_rate_locks where lock_key = p_lock_key and owner = p_owner;
end;
$$ language plpgsql;

-- Trip portal: password-less ("magic link") access to a single booking.
-- Only the SHA-256 hash of the token is stored; links expire and can be revoked.
create table if not exists trip_access_tokens (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references booking_requests(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  status publish_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  category_id uuid references blog_categories(id) on delete set null,
  featured_image_url text,
  author_name text,
  status publish_status not null default 'draft',
  meta_title text,
  meta_description text,
  og_image_url text,
  published_at timestamptz,
  created_by uuid references admin_users(id) on delete set null,
  updated_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists gallery_images (
  id uuid primary key default gen_random_uuid(),
  title text,
  image_url text not null,
  alt_text text,
  caption text,
  destination_id uuid references destinations(id) on delete set null,
  tour_id uuid references tours(id) on delete set null,
  media_type media_type not null default 'image',
  status publish_status not null default 'draft',
  sort_order integer not null default 0,
  created_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  client_country text,
  client_image_url text,
  rating integer not null default 5 check (rating between 1 and 5),
  message text not null,
  tour_id uuid references tours(id) on delete set null,
  status publish_status not null default 'draft',
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text,
  status publish_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists homepage_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique,
  title text,
  subtitle text,
  content text,
  image_url text,
  button_text text,
  button_url text,
  extra_data jsonb not null default '{}'::jsonb,
  status publish_status not null default 'draft',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  status contact_status not null default 'new',
  admin_notes text,
  assigned_to uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists media_library (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_url text not null,
  file_path text not null,
  thumbnail_url text,
  thumbnail_path text,
  file_type media_type not null default 'image',
  mime_type text,
  file_size bigint,
  alt_text text,
  caption text,
  uploaded_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists website_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null default '{}'::jsonb,
  setting_group text not null default 'general',
  setting_type text not null default 'text',
  is_public boolean not null default false,
  description text,
  updated_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references admin_users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'website',
  status text not null default 'in_progress',
  lead_context jsonb not null default '{}'::jsonb,
  handoff_at timestamptz,
  handoff_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ai_lead_context (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references ai_conversations(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  destination text,
  travel_timing text,
  duration_days integer,
  budget_tier text,
  persona_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tour_match_results (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  tour_id uuid references tours(id) on delete set null,
  match_score integer not null default 0,
  match_reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists hubspot_sync_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  provider_response jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table tours add column if not exists experience_type text;
alter table tours add column if not exists persona_tags text[] not null default '{}';
alter table tours add column if not exists budget_tier text;
alter table tours add column if not exists sample_itinerary jsonb not null default '[]'::jsonb;
alter table tours add column if not exists highlights text[] not null default '{}';
alter table tours add column if not exists is_available boolean not null default true;
alter table tours add column if not exists seats_remaining integer;
alter table tours add column if not exists seo_title text;
alter table tours add column if not exists specialist_id uuid references specialists(id) on delete set null;
alter table tour_categories add column if not exists lottie_url text;
alter table itinerary_days add column if not exists activities text;
alter table itinerary_days add column if not exists image_url text;
alter table available_dates add column if not exists available_slots integer check (available_slots >= 0);
alter table available_dates add column if not exists price numeric(12, 2) check (price >= 0);
alter table available_dates add column if not exists currency text not null default 'USD';
alter table available_dates add column if not exists notes text;
update available_dates set available_slots = coalesce(available_slots, seats_available) where available_slots is null;
update available_dates set price = coalesce(price, price_override) where price is null;
alter table available_dates alter column status drop default;
alter table available_dates alter column status type text using case
  when status::text = 'published' then 'available'
  when status::text = 'draft' then 'limited'
  when status::text = 'archived' then 'cancelled'
  else status::text
end;
alter table available_dates alter column status set default 'available';
alter table available_dates drop constraint if exists available_dates_status_check;
alter table available_dates add constraint available_dates_status_check check (status in ('available', 'limited', 'full', 'cancelled'));
alter table tour_price_options add column if not exists title text;
update tour_price_options set title = coalesce(title, label) where title is null;
alter table tour_price_options alter column title set not null;
alter table tour_price_options add column if not exists price_type text not null default 'per_person';
alter table tour_price_options drop constraint if exists tour_price_options_price_type_check;
alter table tour_price_options add constraint tour_price_options_price_type_check check (price_type in ('per_person', 'per_group', 'per_child', 'single_supplement', 'upgrade', 'discount'));

alter table tour_images add column if not exists is_featured boolean not null default false;

do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'testimonials' and column_name = 'guest_name')
  then alter table testimonials rename column guest_name to client_name; end if;
end $$;
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'testimonials' and column_name = 'guest_location')
  then alter table testimonials rename column guest_location to client_country; end if;
end $$;
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'testimonials' and column_name = 'quote')
  then alter table testimonials rename column quote to message; end if;
end $$;
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'testimonials' and column_name = 'image_url')
  then alter table testimonials rename column image_url to client_image_url; end if;
end $$;
alter table testimonials add column if not exists tour_id uuid references tours(id) on delete set null;

alter table gallery_images add column if not exists media_type media_type not null default 'image';
alter table gallery_images add column if not exists created_by uuid references admin_users(id) on delete set null;
alter table gallery_images add column if not exists deleted_at timestamptz;

alter table homepage_sections add column if not exists button_text text;
alter table homepage_sections add column if not exists button_url text;
alter table homepage_sections add column if not exists extra_data jsonb not null default '{}'::jsonb;

alter table contact_messages add column if not exists admin_notes text;

-- Booking requests: production lead-pipeline columns + expanded status values.
alter table booking_requests add column if not exists ai_conversation_id uuid;
alter table booking_requests add column if not exists source text not null default 'website_booking_form';
alter table booking_requests add column if not exists lead_context jsonb not null default '{}'::jsonb;
alter type booking_status add value if not exists 'contacted';
alter type booking_status add value if not exists 'itinerary_sent';
alter type booking_status add value if not exists 'negotiating';

alter table website_settings add column if not exists setting_group text not null default 'general';
alter table website_settings add column if not exists setting_type text not null default 'text';
alter table website_settings add column if not exists updated_by uuid references admin_users(id) on delete set null;
alter table website_settings add column if not exists deleted_at timestamptz;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'homepage_sections' and column_name = 'content' and data_type = 'jsonb'
  ) then
    alter table homepage_sections alter column content drop default;
    alter table homepage_sections alter column content drop not null;
    alter table homepage_sections alter column content type text using nullif(content::text, '{}');
  end if;
end $$;

create index if not exists idx_admin_users_email on admin_users(email);
create index if not exists idx_admin_users_role on admin_users(role);
create index if not exists idx_role_permissions_role on role_permissions(role);
create index if not exists idx_permissions_permission_key on permissions(permission_key);
create index if not exists idx_destinations_slug on destinations(slug);
create index if not exists idx_destinations_status on destinations(status);
create index if not exists idx_destinations_is_featured on destinations(is_featured);
create index if not exists idx_countries_slug on countries(slug);
create index if not exists idx_countries_status on countries(status);
create index if not exists idx_countries_phase on countries(phase);
create index if not exists idx_lodges_slug on lodges(slug);
create index if not exists idx_lodges_destination_id on lodges(destination_id);
create index if not exists idx_lodges_status on lodges(status);
create index if not exists idx_lodges_accommodation_level on lodges(accommodation_level);
create index if not exists idx_activities_slug on activities(slug);
create index if not exists idx_activities_destination_id on activities(destination_id);
create index if not exists idx_activities_status on activities(status);
create index if not exists idx_activities_category on activities(category);
create index if not exists idx_trip_points_slug on trip_points(slug);
create index if not exists idx_trip_points_destination_id on trip_points(destination_id);
create index if not exists idx_trip_points_status on trip_points(status);
create index if not exists idx_trip_points_role on trip_points(role);
create index if not exists idx_safety_topics_slug on safety_topics(slug);
create index if not exists idx_safety_topics_status on safety_topics(status);
create index if not exists idx_safety_topics_category on safety_topics(category);
create index if not exists idx_travel_styles_slug on travel_styles(slug);
create index if not exists idx_travel_styles_status on travel_styles(status);
create index if not exists idx_comparisons_slug on comparisons(slug);
create index if not exists idx_comparisons_status on comparisons(status);
create index if not exists idx_tour_categories_slug on tour_categories(slug);
create index if not exists idx_tour_categories_status on tour_categories(status);
create index if not exists idx_tours_slug on tours(slug);
create index if not exists idx_tours_destination_id on tours(destination_id);
create index if not exists idx_tours_category_id on tours(category_id);
create index if not exists idx_tours_specialist_id on tours(specialist_id);
create index if not exists idx_tours_status on tours(status);
create index if not exists idx_tours_is_featured on tours(is_featured);
create index if not exists idx_tours_price_from on tours(price_from);
create index if not exists idx_tours_experience_type on tours(experience_type);
create index if not exists idx_tours_budget_tier on tours(budget_tier);
create index if not exists idx_tours_is_available on tours(is_available);
create index if not exists idx_tours_persona_tags on tours using gin(persona_tags);
create index if not exists idx_itinerary_days_tour_id on itinerary_days(tour_id);
create index if not exists idx_tour_inclusions_tour_id on tour_inclusions(tour_id);
create index if not exists idx_tour_exclusions_tour_id on tour_exclusions(tour_id);
create index if not exists idx_tour_images_tour_id on tour_images(tour_id);
create index if not exists idx_available_dates_tour_id on available_dates(tour_id);
create index if not exists idx_available_dates_start_date on available_dates(start_date);
create index if not exists idx_tour_price_options_tour_id on tour_price_options(tour_id);
create index if not exists idx_booking_requests_booking_code on booking_requests(booking_code);
create index if not exists idx_booking_requests_tour_id on booking_requests(tour_id);
create index if not exists idx_booking_requests_status on booking_requests(status);
create index if not exists idx_booking_requests_payment_status on booking_requests(payment_status);
create index if not exists idx_booking_requests_created_at on booking_requests(created_at);
create index if not exists idx_booking_requests_assigned_to on booking_requests(assigned_to);
create index if not exists idx_booking_requests_source on booking_requests(source);
create index if not exists idx_booking_requests_email on booking_requests(email);
create index if not exists idx_booking_payments_booking_id on booking_payments(booking_id);
create index if not exists idx_booking_payments_status on booking_payments(status);
create index if not exists idx_blog_posts_slug on blog_posts(slug);
create index if not exists idx_blog_posts_status on blog_posts(status);
create index if not exists idx_blog_posts_category_id on blog_posts(category_id);
create index if not exists idx_gallery_images_destination_id on gallery_images(destination_id);
create index if not exists idx_gallery_images_tour_id on gallery_images(tour_id);
create index if not exists idx_gallery_images_status on gallery_images(status);
create index if not exists idx_testimonials_status on testimonials(status);
create index if not exists idx_testimonials_is_featured on testimonials(is_featured);
create index if not exists idx_testimonials_tour_id on testimonials(tour_id);
create index if not exists idx_faqs_status on faqs(status);
create index if not exists idx_faqs_category on faqs(category);
create index if not exists idx_homepage_sections_section_key on homepage_sections(section_key);
create index if not exists idx_homepage_sections_is_active on homepage_sections(is_active);
create index if not exists idx_contact_messages_status on contact_messages(status);
create index if not exists idx_contact_messages_created_at on contact_messages(created_at);
create index if not exists idx_media_library_file_type on media_library(file_type);
create index if not exists idx_media_library_uploaded_by on media_library(uploaded_by);
create index if not exists idx_website_settings_setting_key on website_settings(setting_key);
create index if not exists idx_website_settings_setting_group on website_settings(setting_group);
create index if not exists idx_website_settings_is_public on website_settings(is_public);
create index if not exists idx_audit_logs_admin_user_id on audit_logs(admin_user_id);
create index if not exists idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at);
create index if not exists idx_ai_conversations_status on ai_conversations(status);
create index if not exists idx_ai_conversations_created_at on ai_conversations(created_at);
create index if not exists idx_ai_messages_conversation_id on ai_messages(conversation_id);
create index if not exists idx_ai_lead_context_conversation_id on ai_lead_context(conversation_id);
create index if not exists idx_tour_match_results_conversation_id on tour_match_results(conversation_id);
create index if not exists idx_tour_match_results_tour_id on tour_match_results(tour_id);
create index if not exists idx_hubspot_sync_logs_entity on hubspot_sync_logs(entity_type, entity_id);
create index if not exists idx_hubspot_sync_logs_status on hubspot_sync_logs(status);
create index if not exists idx_exchange_rate_snapshots_latest_success on exchange_rate_snapshots(provider, base_currency, fetched_at desc) where status = 'success';
create index if not exists idx_exchange_rate_snapshots_status on exchange_rate_snapshots(provider, status, fetched_at desc);

drop trigger if exists set_admin_users_updated_at on admin_users;
create trigger set_admin_users_updated_at before update on admin_users for each row execute function set_updated_at();
drop trigger if exists set_destinations_updated_at on destinations;
create trigger set_destinations_updated_at before update on destinations for each row execute function set_updated_at();
drop trigger if exists set_countries_updated_at on countries;
create trigger set_countries_updated_at before update on countries for each row execute function set_updated_at();
drop trigger if exists set_lodges_updated_at on lodges;
create trigger set_lodges_updated_at before update on lodges for each row execute function set_updated_at();
drop trigger if exists set_activities_updated_at on activities;
create trigger set_activities_updated_at before update on activities for each row execute function set_updated_at();
drop trigger if exists set_trip_points_updated_at on trip_points;
create trigger set_trip_points_updated_at before update on trip_points for each row execute function set_updated_at();
drop trigger if exists set_safety_topics_updated_at on safety_topics;
create trigger set_safety_topics_updated_at before update on safety_topics for each row execute function set_updated_at();
drop trigger if exists set_travel_styles_updated_at on travel_styles;
create trigger set_travel_styles_updated_at before update on travel_styles for each row execute function set_updated_at();
drop trigger if exists set_comparisons_updated_at on comparisons;
create trigger set_comparisons_updated_at before update on comparisons for each row execute function set_updated_at();
drop trigger if exists set_tour_categories_updated_at on tour_categories;
create trigger set_tour_categories_updated_at before update on tour_categories for each row execute function set_updated_at();
drop trigger if exists set_tours_updated_at on tours;
create trigger set_tours_updated_at before update on tours for each row execute function set_updated_at();
drop trigger if exists set_itinerary_days_updated_at on itinerary_days;
create trigger set_itinerary_days_updated_at before update on itinerary_days for each row execute function set_updated_at();
drop trigger if exists set_tour_inclusions_updated_at on tour_inclusions;
create trigger set_tour_inclusions_updated_at before update on tour_inclusions for each row execute function set_updated_at();
drop trigger if exists set_tour_exclusions_updated_at on tour_exclusions;
create trigger set_tour_exclusions_updated_at before update on tour_exclusions for each row execute function set_updated_at();
drop trigger if exists set_tour_images_updated_at on tour_images;
create trigger set_tour_images_updated_at before update on tour_images for each row execute function set_updated_at();
drop trigger if exists set_available_dates_updated_at on available_dates;
create trigger set_available_dates_updated_at before update on available_dates for each row execute function set_updated_at();
drop trigger if exists set_tour_price_options_updated_at on tour_price_options;
create trigger set_tour_price_options_updated_at before update on tour_price_options for each row execute function set_updated_at();
drop trigger if exists set_booking_requests_updated_at on booking_requests;
create trigger set_booking_requests_updated_at before update on booking_requests for each row execute function set_updated_at();
drop trigger if exists set_booking_payments_updated_at on booking_payments;
create trigger set_booking_payments_updated_at before update on booking_payments for each row execute function set_updated_at();
drop trigger if exists set_blog_categories_updated_at on blog_categories;
create trigger set_blog_categories_updated_at before update on blog_categories for each row execute function set_updated_at();
drop trigger if exists set_blog_posts_updated_at on blog_posts;
create trigger set_blog_posts_updated_at before update on blog_posts for each row execute function set_updated_at();
drop trigger if exists set_gallery_images_updated_at on gallery_images;
create trigger set_gallery_images_updated_at before update on gallery_images for each row execute function set_updated_at();
drop trigger if exists set_testimonials_updated_at on testimonials;
create trigger set_testimonials_updated_at before update on testimonials for each row execute function set_updated_at();
drop trigger if exists set_faqs_updated_at on faqs;
create trigger set_faqs_updated_at before update on faqs for each row execute function set_updated_at();
drop trigger if exists set_homepage_sections_updated_at on homepage_sections;
create trigger set_homepage_sections_updated_at before update on homepage_sections for each row execute function set_updated_at();
drop trigger if exists set_contact_messages_updated_at on contact_messages;
create trigger set_contact_messages_updated_at before update on contact_messages for each row execute function set_updated_at();
drop trigger if exists set_website_settings_updated_at on website_settings;
create trigger set_website_settings_updated_at before update on website_settings for each row execute function set_updated_at();
drop trigger if exists set_ai_conversations_updated_at on ai_conversations;
create trigger set_ai_conversations_updated_at before update on ai_conversations for each row execute function set_updated_at();
drop trigger if exists set_ai_lead_context_updated_at on ai_lead_context;
create trigger set_ai_lead_context_updated_at before update on ai_lead_context for each row execute function set_updated_at();
