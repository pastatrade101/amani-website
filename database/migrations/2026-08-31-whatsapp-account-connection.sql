-- The WhatsApp account this site sends from, owned by the business rather than
-- by the deployment.
-- Apply by pasting into the Supabase SQL editor.
--
-- Until now the number was fixed in the container's environment, so it was
-- always whoever built the site — changing it meant editing .env and
-- redeploying. This lets the business connect their own WhatsApp Business
-- account from the admin, and their number becomes the sender.
--
-- Deliberately NOT website_settings: that table refuses secret-like keys by
-- design (isForbiddenKey), and an access token has no business sitting beside
-- values the public settings endpoint serves.
--
-- The split that matters:
--   APP level  (stays in env)  app id, app secret, verify token, graph version
--                              — these belong to the Meta app, are shared by
--                              every account it serves, and sign the webhook.
--   ACCOUNT level (this table) WABA id, phone number id, access token
--                              — these belong to the business.

create table if not exists whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),

  waba_id text not null,
  phone_number_id text not null,

  -- Read back from Meta at connection time so the admin can show which number
  -- is connected without another API call, and so a wrong account is obvious.
  display_phone_number text,
  verified_name text,

  -- AES-256-GCM, never the raw value. Encrypted with CREDENTIALS_ENCRYPTION_KEY,
  -- which lives only in the server environment — a database dump on its own
  -- does not yield a working token.
  access_token_encrypted text not null,

  -- How the business handed it over. 'embedded_signup' is Meta's own flow;
  -- 'manual' is credentials typed in while that flow awaits App Review.
  token_source text not null default 'embedded_signup'
    check (token_source in ('embedded_signup', 'manual')),

  status text not null default 'connected'
    check (status in ('connected', 'disconnected', 'error')),
  -- Why a connection stopped working, in words an admin can act on.
  status_detail text,

  connected_at timestamptz not null default now(),
  connected_by uuid references admin_users(id) on delete set null,
  last_verified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- One live account per site. A second connection replaces the first rather than
-- quietly competing with it, so there is never a question of which number sent.
create unique index if not exists whatsapp_accounts_one_live
  on whatsapp_accounts ((true)) where deleted_at is null and status = 'connected';

create index if not exists whatsapp_accounts_phone on whatsapp_accounts (phone_number_id);

comment on table whatsapp_accounts is
  'The WhatsApp Business account this site sends from. Account-level credentials only; app-level secrets stay in the environment.';
comment on column whatsapp_accounts.access_token_encrypted is
  'AES-256-GCM ciphertext. Never returned by any API, never logged, never sent to a browser.';
