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
