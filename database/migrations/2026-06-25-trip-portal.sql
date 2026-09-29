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
