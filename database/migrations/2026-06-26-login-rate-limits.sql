-- Admin login brute-force protection. Our admin auth is custom JWT (not Supabase
-- Auth), so it doesn't get login throttling for free. Keyed by identifier (email).
create table if not exists login_rate_limits (
  identifier text primary key,
  attempt_count integer not null default 0,
  locked_until timestamptz,
  last_attempt_at timestamptz not null default now()
);
