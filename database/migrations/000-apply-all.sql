-- ============================================================================
-- APPLY-ALL (COMPLETE • IDEMPOTENT) — the full Goldfinch CMS schema in one run.
-- Regenerated to include EVERY migration through 2026-08-02, including the
-- merged Emnel features (destination-guide, specialists, faq-destination,
-- responsive-images) and the Goldfinch Tier-1/2 features (reviews, page-seo,
-- migration-calendar, slug-redirects, error-logs, login-rate-limits,
-- analytics-sessions). Safe to run repeatedly (Supabase SQL editor).
--
-- Run order:  1) schema.sql   2) seed.sql   3) THIS FILE   4) seed-demo.sql
--
-- COUNTRIES: intentionally NOT created — the Countries content type is dropped;
-- countries are the `country` attribute on destinations. An existing DB may
-- carry a dormant `countries` table; harmless. Remove fully (optional):
--   drop table if exists countries cascade;
-- ============================================================================
-- ========== 2026-06-17-lodges.sql ==========
-- Lodges & Camps — recommended accommodation linked to destinations.
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

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

create index if not exists idx_lodges_slug on lodges(slug);
create index if not exists idx_lodges_destination_id on lodges(destination_id);
create index if not exists idx_lodges_status on lodges(status);
create index if not exists idx_lodges_accommodation_level on lodges(accommodation_level);

drop trigger if exists set_lodges_updated_at on lodges;
create trigger set_lodges_updated_at before update on lodges for each row execute function set_updated_at();

-- Permissions (and grant them all to super_admin).
insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array[
  'lodges.view','lodges.create','lodges.update','lodges.delete','lodges.publish'
]) as permission_key
on conflict (permission_key) do update set description = excluded.description;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key
from permissions
where permission_key like 'lodges.%'
on conflict do nothing;

-- ========== 2026-06-17-activities.sql ==========
-- Activities — things to do, linked to destinations. Surfaced on destination
-- pages ("Top experiences") and the homepage Popular Activities slider.
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

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

create index if not exists idx_activities_slug on activities(slug);
create index if not exists idx_activities_destination_id on activities(destination_id);
create index if not exists idx_activities_status on activities(status);
create index if not exists idx_activities_category on activities(category);

drop trigger if exists set_activities_updated_at on activities;
create trigger set_activities_updated_at before update on activities for each row execute function set_updated_at();

-- Permissions (and grant them all to super_admin).
insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array[
  'activities.view','activities.create','activities.update','activities.delete','activities.publish'
]) as permission_key
on conflict (permission_key) do update set description = excluded.description;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key
from permissions
where permission_key like 'activities.%'
on conflict do nothing;

-- ========== 2026-06-17-trip-points.sql ==========
-- Trip points — start & end gateways (airports, hub cities) linked to
-- destinations. Surfaced as "Getting there" on destination pages.
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

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

create index if not exists idx_trip_points_slug on trip_points(slug);
create index if not exists idx_trip_points_destination_id on trip_points(destination_id);
create index if not exists idx_trip_points_status on trip_points(status);
create index if not exists idx_trip_points_role on trip_points(role);

drop trigger if exists set_trip_points_updated_at on trip_points;
create trigger set_trip_points_updated_at before update on trip_points for each row execute function set_updated_at();

-- Permissions (and grant them all to super_admin).
insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array[
  'trip_points.view','trip_points.create','trip_points.update','trip_points.delete','trip_points.publish'
]) as permission_key
on conflict (permission_key) do update set description = excluded.description;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key
from permissions
where permission_key like 'trip_points.%'
on conflict do nothing;

-- ========== 2026-06-17-safety.sql ==========
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

-- ========== 2026-06-18-experiences-and-scores.sql ==========
-- Experiences enrichment (on tour_categories) + Destination scores (on destinations).
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

alter table tour_categories add column if not exists who_its_for text;
alter table tour_categories add column if not exists fitness text;
alter table tour_categories add column if not exists highlights text[] not null default '{}';

alter table destinations add column if not exists score_wildlife numeric(3, 1) check (score_wildlife >= 0 and score_wildlife <= 10);
alter table destinations add column if not exists score_luxury numeric(3, 1) check (score_luxury >= 0 and score_luxury <= 10);
alter table destinations add column if not exists score_family numeric(3, 1) check (score_family >= 0 and score_family <= 10);
alter table destinations add column if not exists score_photography numeric(3, 1) check (score_photography >= 0 and score_photography <= 10);
alter table destinations add column if not exists score_adventure numeric(3, 1) check (score_adventure >= 0 and score_adventure <= 10);
alter table destinations add column if not exists score_budget_from numeric(12, 2);

-- ========== 2026-06-18-travel-styles.sql ==========
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

-- ========== 2026-06-18-comparisons.sql ==========
-- Comparisons — decision-stage "X vs Y" pages (/compare).
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

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
create index if not exists idx_comparisons_slug on comparisons(slug);
create index if not exists idx_comparisons_status on comparisons(status);
drop trigger if exists set_comparisons_updated_at on comparisons;
create trigger set_comparisons_updated_at before update on comparisons for each row execute function set_updated_at();

insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array['comparisons.view','comparisons.create','comparisons.update','comparisons.delete','comparisons.publish']) as permission_key
on conflict (permission_key) do update set description = excluded.description;
insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key from permissions where permission_key like 'comparisons.%'
on conflict do nothing;


-- ========== 2026-06-22-ai-advisor-v2.sql ==========
-- ============================================================================
-- Goldfinch AI Travel Advisor — v2 hardening (ADDITIVE ONLY)
-- ----------------------------------------------------------------------------
-- This migration only ADDS: new extensions, new nullable columns, new tables,
-- new enum values, new indexes and new triggers. It never alters or drops an
-- existing column, so it is safe to apply on top of the live schema.
--
-- Apply order:  migrations/000-apply-all.sql  ->  seed.sql  ->  seed-demo.sql
--               (this file is also appended to 000-apply-all.sql)
-- ============================================================================

-- pgvector for the semantic layer (FAQ/tour matching + answer cache).
create extension if not exists vector;

-- ----------------------------------------------------------------------------
-- booking_status: add the AI lead-pipeline values (§2). Adding enum values is
-- additive and non-destructive; existing values (pending, confirmed, cancelled,
-- completed, rejected) are untouched. `pending` stays the table default.
-- ----------------------------------------------------------------------------
alter type booking_status add value if not exists 'ai_draft';
alter type booking_status add value if not exists 'pending_review';
alter type booking_status add value if not exists 'contacted';
alter type booking_status add value if not exists 'qualified';
alter type booking_status add value if not exists 'lost';

-- ----------------------------------------------------------------------------
-- ai_conversations — new nullable columns (§15). Existing columns retained.
-- ----------------------------------------------------------------------------
alter table ai_conversations add column if not exists session_id text;
alter table ai_conversations add column if not exists visitor_name text;
alter table ai_conversations add column if not exists visitor_email text;
alter table ai_conversations add column if not exists visitor_phone text;
alter table ai_conversations add column if not exists visitor_country text;
alter table ai_conversations add column if not exists lead_status text default 'new';
alter table ai_conversations add column if not exists lead_score integer not null default 0;
alter table ai_conversations add column if not exists handoff_required boolean not null default false;
alter table ai_conversations add column if not exists handoff_reason text;
alter table ai_conversations add column if not exists source_page text;
alter table ai_conversations add column if not exists preferred_tour_id uuid references tours(id) on delete set null;
alter table ai_conversations add column if not exists preferred_departure_id uuid references available_dates(id) on delete set null;
alter table ai_conversations add column if not exists booking_request_id uuid references booking_requests(id) on delete set null;
alter table ai_conversations add column if not exists conversation_summary text;
alter table ai_conversations add column if not exists total_estimated_cost_usd numeric(12, 6) not null default 0;
alter table ai_conversations add column if not exists ai_message_count integer not null default 0;
alter table ai_conversations add column if not exists last_ai_call_at timestamptz;
alter table ai_conversations add column if not exists language text not null default 'en';
alter table ai_conversations add column if not exists consent_given boolean not null default false;
alter table ai_conversations add column if not exists consent_at timestamptz;
alter table ai_conversations add column if not exists turnstile_verified boolean not null default false;
alter table ai_conversations add column if not exists degraded boolean not null default false;

-- ----------------------------------------------------------------------------
-- ai_messages — allow the new 'tool' role (§3.4 / §15). Re-points the CHECK
-- constraint only; the column itself is unchanged.
-- ----------------------------------------------------------------------------
alter table ai_messages drop constraint if exists ai_messages_role_check;
alter table ai_messages add constraint ai_messages_role_check
  check (role in ('user', 'assistant', 'system', 'tool'));

-- ----------------------------------------------------------------------------
-- ai_lead_context — richer structured lead fields (§15). Existing columns
-- (full_name, email, phone, destination, travel_timing, duration_days,
-- budget_tier, persona_tags) retained.
-- ----------------------------------------------------------------------------
alter table ai_lead_context add column if not exists traveler_type text;
alter table ai_lead_context add column if not exists adults integer;
alter table ai_lead_context add column if not exists children integer;
alter table ai_lead_context add column if not exists total_travelers integer;
alter table ai_lead_context add column if not exists destination_interest text[] not null default '{}';
alter table ai_lead_context add column if not exists experience_interest text[] not null default '{}';
alter table ai_lead_context add column if not exists preferred_month text;
alter table ai_lead_context add column if not exists start_date date;
alter table ai_lead_context add column if not exists end_date date;
alter table ai_lead_context add column if not exists comfort_level text;
alter table ai_lead_context add column if not exists special_interests text[] not null default '{}';
alter table ai_lead_context add column if not exists dietary_needs text;
alter table ai_lead_context add column if not exists accessibility_needs text;
alter table ai_lead_context add column if not exists message_summary text;
alter table ai_lead_context add column if not exists urgency text;
alter table ai_lead_context add column if not exists contact_preference text;
alter table ai_lead_context add column if not exists extracted_json jsonb not null default '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- tour_match_results — user-facing label + reasons/limitations (§9/§15).
-- Existing match_score / match_reasons retained; `score` mirrors match_score.
-- ----------------------------------------------------------------------------
alter table tour_match_results add column if not exists departure_id uuid references available_dates(id) on delete set null;
alter table tour_match_results add column if not exists score integer;
alter table tour_match_results add column if not exists confidence_label text;
alter table tour_match_results add column if not exists reasons jsonb not null default '[]'::jsonb;
alter table tour_match_results add column if not exists limitations jsonb not null default '[]'::jsonb;
alter table tour_match_results add column if not exists availability_status text;
alter table tour_match_results add column if not exists price_note text;

-- ----------------------------------------------------------------------------
-- ai_tool_calls (new) — audit of every native tool invocation (§3.4).
-- ----------------------------------------------------------------------------
create table if not exists ai_tool_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references ai_conversations(id) on delete cascade,
  tool_name text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  success boolean not null default true,
  error_message text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ai_usage_logs (new) — per-call usage + estimated cost, incl. cache tokens.
-- ----------------------------------------------------------------------------
create table if not exists ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references ai_conversations(id) on delete set null,
  session_id text,
  ip_hash text,
  model text,
  route_type text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_creation_input_tokens integer not null default 0,
  cache_read_input_tokens integer not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  request_status text not null default 'success',
  error_message text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- cms_embeddings (new) — semantic vectors for tours/destinations/faqs (§10).
-- NOTE: vector dimension must match AI_EMBEDDING_DIMENSIONS / the chosen
-- provider (1536 = OpenAI text-embedding-3-small; use 1024 for Voyage voyage-3).
-- ----------------------------------------------------------------------------
create table if not exists cms_embeddings (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('tour', 'destination', 'faq')),
  source_id uuid not null,
  content text not null,
  embedding vector(1536),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id)
);

-- ----------------------------------------------------------------------------
-- ai_answer_cache (new) — repeat-question cache; never store prices/availability.
-- ----------------------------------------------------------------------------
create table if not exists ai_answer_cache (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  question_embedding vector(1536),
  answer text not null,
  source text,
  hit_count integer not null default 0,
  created_at timestamptz not null default now(),
  last_hit_at timestamptz
);

-- ----------------------------------------------------------------------------
-- ai_eval_runs (new) — nightly golden-set + LLM-as-judge results (§14).
-- ----------------------------------------------------------------------------
create table if not exists ai_eval_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  scenario_key text not null,
  passed boolean not null default false,
  failure_mode text,
  transcript jsonb not null default '[]'::jsonb,
  judge_notes text
);

-- ----------------------------------------------------------------------------
-- booking_requests — idempotency key for AI-created requests (§13).
-- ----------------------------------------------------------------------------
alter table booking_requests add column if not exists idempotency_key text;

-- ----------------------------------------------------------------------------
-- Indexes (§15)
-- ----------------------------------------------------------------------------
create index if not exists idx_ai_conversations_status on ai_conversations(status);
create index if not exists idx_ai_conversations_lead_status on ai_conversations(lead_status);
create index if not exists idx_ai_conversations_created_at on ai_conversations(created_at);
create index if not exists idx_ai_conversations_session_id on ai_conversations(session_id);
create index if not exists idx_ai_messages_conversation_id on ai_messages(conversation_id);
create index if not exists idx_ai_lead_context_conversation_id on ai_lead_context(conversation_id);
create index if not exists idx_tour_match_results_conversation_id on tour_match_results(conversation_id);
create index if not exists idx_tour_match_results_tour_id on tour_match_results(tour_id);
create index if not exists idx_ai_tool_calls_conversation_id on ai_tool_calls(conversation_id);
create index if not exists idx_ai_usage_logs_conversation_id on ai_usage_logs(conversation_id);
create index if not exists idx_ai_usage_logs_session_id on ai_usage_logs(session_id);
create index if not exists idx_ai_usage_logs_ip_hash on ai_usage_logs(ip_hash);
create index if not exists idx_ai_usage_logs_created_at on ai_usage_logs(created_at);
create index if not exists idx_ai_usage_logs_route_type on ai_usage_logs(route_type);
create unique index if not exists idx_booking_requests_idempotency_key
  on booking_requests(idempotency_key) where idempotency_key is not null;

-- Vector indexes (HNSW). Created only when the embedding columns are populated
-- with a fixed dimension; safe to (re)run.
create index if not exists idx_cms_embeddings_embedding
  on cms_embeddings using hnsw (embedding vector_cosine_ops);
create index if not exists idx_ai_answer_cache_embedding
  on ai_answer_cache using hnsw (question_embedding vector_cosine_ops);

-- ----------------------------------------------------------------------------
-- updated_at triggers for new tables that carry an updated_at column.
-- (set_updated_at() is defined in schema.sql.)
-- ----------------------------------------------------------------------------
drop trigger if exists set_cms_embeddings_updated_at on cms_embeddings;
create trigger set_cms_embeddings_updated_at before update on cms_embeddings
  for each row execute function set_updated_at();


-- ========== 2026-06-22-ai-vector-search.sql ==========
-- ============================================================================
-- Goldfinch AI Travel Advisor — v2 semantic layer search functions (§10).
-- ADDITIVE: creates two stable SQL functions used by aiRetrieval. Requires the
-- pgvector tables from 2026-06-22-ai-advisor-v2.sql.
--
-- NOTE: the vector(1536) dimension must match cms_embeddings.embedding /
-- ai_answer_cache.question_embedding and AI_EMBEDDING_DIMENSIONS. If you switch
-- to a 1024-dim provider (e.g. Voyage voyage-3), change 1536 -> 1024 here AND
-- in the column definitions.
-- ============================================================================

-- Nearest CMS embeddings (tours/destinations/faqs) by cosine similarity.
create or replace function match_cms_embeddings(
  query_embedding vector(1536),
  match_source_type text default null,
  match_count int default 5
)
returns table (source_type text, source_id uuid, content text, similarity float)
language sql stable as $$
  select e.source_type, e.source_id, e.content,
         1 - (e.embedding <=> query_embedding) as similarity
  from cms_embeddings e
  where e.embedding is not null
    and (match_source_type is null or e.source_type = match_source_type)
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- Nearest cached answer by cosine similarity (semantic answer cache).
create or replace function match_answer_cache(
  query_embedding vector(1536),
  match_count int default 1
)
returns table (id uuid, question text, answer text, source text, similarity float)
language sql stable as $$
  select c.id, c.question, c.answer, c.source,
         1 - (c.question_embedding <=> query_embedding) as similarity
  from ai_answer_cache c
  where c.question_embedding is not null
  order by c.question_embedding <=> query_embedding
  limit match_count;
$$;

-- ========== 2026-06-24-media-thumbnails.sql ==========
-- Media thumbnails: store a small, web-optimized derivative for each uploaded
-- image so the Media Library picker (and cards) load fast instead of pulling
-- the full-size original. Generated server-side on upload (sharp -> webp).
-- thumbnail_url is nullable: older images fall back to file_url until backfilled.
alter table media_library add column if not exists thumbnail_url text;
alter table media_library add column if not exists thumbnail_path text;

-- ========== 2026-06-24-analytics-events.sql ==========
-- Analytics: first-party event stream (Phase 1).
-- Stores ONLY safe, non-personal analytics events. Personal lead data lives in
-- booking_requests (the lead store). Never store name/email/phone/notes here.
create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  session_id text,            -- anonymous client session (not a user identity)
  user_id uuid,               -- nullable; admin user if fired from the dashboard
  page_path text,
  source_page_url text,
  tour_id uuid,               -- informational (no FK, so analytics never blocks)
  tour_title text,
  destination text,
  experience_type text,
  budget_range text,
  traveller_type text,
  device_type text,           -- 'mobile' | 'tablet' | 'desktop'
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text,               -- hashed only; raw IP is never stored
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_name_created on analytics_events (event_name, created_at desc);
create index if not exists idx_analytics_events_created on analytics_events (created_at desc);
create index if not exists idx_analytics_events_session on analytics_events (session_id);

comment on table analytics_events is 'First-party, PII-free analytics events. Lead PII stays in booking_requests.';

-- ========== 2026-06-25-trip-portal.sql ==========
-- Trip portal: secure, password-less ("magic link") access to a single booking.
-- The link carries a 256-bit random token; we store ONLY its SHA-256 hash, so a
-- DB leak can't reveal working links. Tokens expire and can be revoked, and the
-- admin can regenerate a fresh one at any time. Opening a valid link mints a
-- short-lived httpOnly session cookie (handled in the app, not stored here).
create table if not exists trip_access_tokens (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references booking_requests(id) on delete cascade,
  token_hash text not null unique,        -- sha256(raw token); raw token is never stored
  expires_at timestamptz not null,
  revoked_at timestamptz,                 -- set when regenerated/disabled
  last_used_at timestamptz,
  created_by uuid references admin_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists trip_access_tokens_booking_idx on trip_access_tokens (booking_id);
create index if not exists trip_access_tokens_hash_idx on trip_access_tokens (token_hash);

-- ========== 2026-06-26-error-logs.sql ==========
-- Error logs — aggregated 404 / broken-URL tracking.
-- Public frontends report a broken URL; we aggregate by (url, error_type) so a
-- repeatedly-hit link is one row with a rising count instead of N rows. Admins
-- view the list and mark entries resolved (optionally recording the redirect).
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

create table if not exists error_logs (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  error_type text not null default '404',
  referrer text,
  resolved_to text,
  count integer not null default 1,
  error_message text,
  is_resolved boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- One row per broken URL + error type; the ingest handler upserts against this.
create unique index if not exists error_logs_url_type_key on error_logs (url, error_type);

-- Admin list view: unresolved first, most-recent hits first.
create index if not exists idx_error_logs_resolved_last_seen on error_logs (is_resolved, last_seen_at desc);

comment on table error_logs is 'Aggregated 404 / broken-URL tracking. Public ingest, admin view (error_logs.view).';

insert into permissions (permission_key, description)
values ('error_logs.view', 'error logs view')
on conflict (permission_key) do update set description = excluded.description;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, 'error_logs.view'
on conflict do nothing;

-- ========== 2026-06-26-login-rate-limits.sql ==========
-- Admin login brute-force protection. Our admin auth is custom JWT (not Supabase
-- Auth), so it doesn't get login throttling for free. Keyed by identifier (email).
create table if not exists login_rate_limits (
  identifier text primary key,
  attempt_count integer not null default 0,
  locked_until timestamptz,
  last_attempt_at timestamptz not null default now()
);

-- ========== 2026-06-26-migration-calendar.sql ==========
-- Serengeti Great Migration calendar — month-by-month guide widget.
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

create table if not exists serengeti_migration_calendar (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  location text not null default '',
  note text not null default '',
  image_url text not null default '',
  display_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_serengeti_migration_calendar_published_order
  on serengeti_migration_calendar (is_published, display_order);

drop trigger if exists set_serengeti_migration_calendar_updated_at on serengeti_migration_calendar;
create trigger set_serengeti_migration_calendar_updated_at before update on serengeti_migration_calendar for each row execute function set_updated_at();

insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array['migration_calendar.create','migration_calendar.update','migration_calendar.delete']) as permission_key
on conflict (permission_key) do update set description = excluded.description;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key from permissions where permission_key like 'migration_calendar.%'
on conflict do nothing;

-- ========== 2026-06-26-reviews.sql ==========
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

-- ========== 2026-06-26-slug-redirects.sql ==========
-- Slug redirects — 301/302 map for changed or retired URLs (SEO link equity).
-- The frontend calls GET /api/redirects/resolve?path=… and issues the redirect.
-- Hard-deleted (no deleted_at); a retired redirect should simply be removed.
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

create table if not exists slug_redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique,
  to_path text not null,
  status_code integer not null default 301 check (status_code in (301, 302, 307, 308)),
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Resolver looks up active redirects by exact from_path.
create index if not exists idx_slug_redirects_active_from_path on slug_redirects (is_active, from_path);

drop trigger if exists set_slug_redirects_updated_at on slug_redirects;
create trigger set_slug_redirects_updated_at before update on slug_redirects for each row execute function set_updated_at();

insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array['redirects.view', 'redirects.create', 'redirects.update', 'redirects.delete']) as permission_key
on conflict (permission_key) do update set description = excluded.description;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key from permissions where permission_key like 'redirects.%'
on conflict do nothing;

-- ========== 2026-06-27-page-seo.sql ==========
-- Per-page SEO overrides (Tier 2). One row per public path; when present, the
-- page uses these title/meta/OG/canonical/robots/structured-data values instead
-- of the site defaults. Absence changes nothing — pages fall back to defaults.
-- Hard-deleted (no deleted_at); removing a row simply restores the defaults.
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

create table if not exists page_seo (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  title text,
  meta_description text,
  og_title text,
  og_description text,
  og_image_url text,
  canonical_url text,
  robots text not null default 'index,follow',
  structured_data jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Resolver looks up active overrides by exact path.
create index if not exists idx_page_seo_active_path on page_seo (is_active, path);

drop trigger if exists set_page_seo_updated_at on page_seo;
create trigger set_page_seo_updated_at before update on page_seo for each row execute function set_updated_at();

insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array['page_seo.view', 'page_seo.create', 'page_seo.update', 'page_seo.delete']) as permission_key
on conflict (permission_key) do update set description = excluded.description;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key from permissions where permission_key like 'page_seo.%'
on conflict do nothing;

-- ========== 2026-06-28-analytics-sessions.sql ==========
-- Analytics sessions (Tier 2): first-touch campaign attribution per anonymous
-- visitor session. PII-free (same policy as analytics_events). The session_id is
-- the existing anonymous client id (localStorage gf_sid); leads carry the same id
-- in booking_requests.lead_context.attribution.session_id, so every lead can be
-- traced back to the source/campaign that produced it.
-- Idempotent: safe to run on the live database. Run in the Supabase SQL editor.

create table if not exists analytics_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,             -- external referrer only (same-origin stripped client-side)
  landing_path text,
  device_type text,          -- 'mobile' | 'tablet' | 'desktop'
  ip_hash text,              -- hashed only; raw IP is never stored
  page_views integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_analytics_sessions_last_seen on analytics_sessions (last_seen_at desc);
create index if not exists idx_analytics_sessions_source on analytics_sessions (utm_source);
create index if not exists idx_analytics_sessions_campaign on analytics_sessions (utm_campaign);

comment on table analytics_sessions is 'First-touch, PII-free campaign attribution per anonymous session. Reads reuse dashboard.view.';

-- ========== 2026-07-21-destination-guide.sql ==========
-- Destination long-form guide (the "destination template" content system).
--
-- Adds a structured jsonb `guide` column — an ordered array of typed content
-- blocks (part / richtext / field_notes / callout / did_you_know / table / photo /
-- facts / faq) rendered by the frontend DestinationGuide component — plus a
-- `guide_reviewed_at` freshness date so a guide can display "last reviewed".
--
-- Non-breaking: both columns are additive and defaulted, so existing rows and the
-- REST/CSV write paths keep working unchanged.

alter table destinations
  add column if not exists guide jsonb not null default '[]'::jsonb,
  add column if not exists guide_reviewed_at date;

-- ========== 2026-07-21-specialists.sql ==========
-- Specialists (named travel specialists / team / advisors).
--
-- The human face of the brand on tour pages and after enquiry (SRS v2.0 §5 trust).
-- Mirrors the `testimonials` entity in structure: a flat, admin-managed content
-- table with publish_status, is_featured and sort_order, exposed through the same
-- generic REST list/get/create/update/soft-delete helpers.
--
-- Non-breaking: `create table if not exists` plus additive, idempotent permission
-- grants — safe to run repeatedly. Run the companion seed
-- (database/seeds/specialists.seed.sql) afterwards to load the starter rows.

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

alter table specialists
  add column if not exists tripadvisor_url text;

create index if not exists idx_specialists_status on specialists(status);
create index if not exists idx_specialists_is_featured on specialists(is_featured);
create index if not exists idx_specialists_sort_order on specialists(sort_order);

drop trigger if exists set_specialists_updated_at on specialists;
create trigger set_specialists_updated_at before update on specialists for each row execute function set_updated_at();

-- Permissions: mirror the testimonials permission set (view/create/update/delete/publish).
insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array[
  'specialists.view','specialists.create','specialists.update','specialists.delete','specialists.publish'
]) as permission_key
on conflict (permission_key) do update set description = excluded.description;

-- super_admin + admin get the full specialists permission set.
insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key
from permissions where permission_key like 'specialists.%'
on conflict (role, permission_key) do nothing;

insert into role_permissions (role, permission_key)
select 'admin'::user_role, permission_key
from permissions where permission_key like 'specialists.%'
on conflict (role, permission_key) do nothing;

-- content_manager: view/create/update/publish (mirrors testimonials).
insert into role_permissions (role, permission_key)
select 'content_manager'::user_role, permission_key
from permissions
where permission_key = any(array['specialists.view','specialists.create','specialists.update','specialists.publish'])
on conflict (role, permission_key) do nothing;

-- editor + viewer: read-only.
insert into role_permissions (role, permission_key)
values ('editor'::user_role, 'specialists.view'), ('viewer'::user_role, 'specialists.view')
on conflict (role, permission_key) do nothing;

-- ========== 2026-07-31-faq-destination.sql ==========
-- Attach FAQs to a destination so each destination renders its own Q&A.
-- Nullable: a null destination_id = a general/global FAQ (unchanged behaviour).
-- Idempotent — safe to run more than once.

alter table faqs
  add column if not exists destination_id uuid references destinations(id) on delete set null;

create index if not exists idx_faqs_destination on faqs (destination_id) where deleted_at is null;

-- ========== 2026-08-02-responsive-images.sql ==========
-- Responsive image pipeline metadata.
--
-- Each uploaded image now stores its intrinsic dimensions + a blurhash/dominant
-- colour placeholder, plus which responsive widths were generated. The image
-- derivatives themselves live in storage at a deterministic path:
--   <folder>/<uuid>.<ext>  ->  <folder>/responsive/<uuid>/<width>.{avif,webp}
-- so the frontend can build an AVIF/WebP srcset straight from the original URL.
--
-- Apply once, then run:  npm run backfill:responsive:prod

alter table media_library
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists aspect_ratio numeric(7,4),
  add column if not exists blurhash text,
  add column if not exists dominant_color text,
  add column if not exists variant_widths integer[] not null default '{}',
  add column if not exists has_avif boolean not null default false;

-- ========== 2026-08-10-tour-specialists.sql ==========
-- Attach CMS-managed travel specialists to tours.

alter table specialists
  add column if not exists tripadvisor_url text;

alter table tours
  add column if not exists specialist_id uuid references specialists(id) on delete set null;

create index if not exists idx_tours_specialist_id on tours(specialist_id);
