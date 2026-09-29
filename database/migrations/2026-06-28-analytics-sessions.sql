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
