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
