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
