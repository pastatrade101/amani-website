-- Attach CMS-managed travel specialists to tours.
--
-- Specialists are created once in the CMS and can then be assigned to tours.
-- TripAdvisor is optional and renders only when a valid profile/review link is stored.

alter table specialists
  add column if not exists tripadvisor_url text;

alter table tours
  add column if not exists specialist_id uuid references specialists(id) on delete set null;

create index if not exists idx_tours_specialist_id on tours(specialist_id);
