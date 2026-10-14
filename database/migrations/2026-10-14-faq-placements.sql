-- FAQs become one shared library. Each question is written once and placed on
-- any of: the home page, travel styles (tour_categories), tours and
-- destinations, as many of each as it fits. Pages read their questions through
-- these placements; the old single attachment (entity_type/entity_id and
-- destination_id on faqs) is carried over below and no longer read.
-- Idempotent: safe to run more than once.
begin;

create table if not exists public.faq_placements (
  id uuid primary key default gen_random_uuid(),
  faq_id uuid not null references public.faqs(id) on delete cascade,
  placement text not null check (placement in ('home', 'category', 'tour', 'destination')),
  category_id uuid references public.tour_categories(id) on delete cascade,
  tour_id uuid references public.tours(id) on delete cascade,
  destination_id uuid references public.destinations(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Exactly the one target column its placement names; the home page has none.
  constraint faq_placements_target_check check (
    (placement = 'home' and category_id is null and tour_id is null and destination_id is null)
    or (placement = 'category' and category_id is not null and tour_id is null and destination_id is null)
    or (placement = 'tour' and tour_id is not null and category_id is null and destination_id is null)
    or (placement = 'destination' and destination_id is not null and category_id is null and tour_id is null)
  )
);

create unique index if not exists faq_placements_unique on public.faq_placements
  (faq_id, placement, coalesce(category_id, tour_id, destination_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists faq_placements_home_idx on public.faq_placements (faq_id) where placement = 'home';
create index if not exists faq_placements_category_idx on public.faq_placements (category_id) where category_id is not null;
create index if not exists faq_placements_tour_idx on public.faq_placements (tour_id) where tour_id is not null;
create index if not exists faq_placements_destination_idx on public.faq_placements (destination_id) where destination_id is not null;

alter table public.faq_placements enable row level security;
grant all on public.faq_placements to service_role;

-- Carry over the one attachment each FAQ had. A general question (no
-- attachment) was what the home page showed, so it becomes a home placement.
-- Safari package, lodge and activity attachments have no public page to show
-- on and are not carried over. Only on the first run: once the CMS writes
-- placements it also clears the old columns, so a re-run would read every
-- edited FAQ as "general" and put it on the home page.
do $$
begin
  if exists (select 1 from public.faq_placements) then return; end if;

  insert into public.faq_placements (faq_id, placement)
  select f.id, 'home' from public.faqs f
  where f.deleted_at is null and f.entity_type is null and f.destination_id is null
  on conflict do nothing;

  insert into public.faq_placements (faq_id, placement, tour_id)
  select f.id, 'tour', t.id from public.faqs f join public.tours t on t.id = f.entity_id
  where f.deleted_at is null and f.entity_type = 'tours'
  on conflict do nothing;

  insert into public.faq_placements (faq_id, placement, category_id)
  select f.id, 'category', c.id from public.faqs f join public.tour_categories c on c.id = f.entity_id
  where f.deleted_at is null and f.entity_type = 'tour_categories'
  on conflict do nothing;

  insert into public.faq_placements (faq_id, placement, destination_id)
  select f.id, 'destination', d.id from public.faqs f
  join public.destinations d on d.id = case when f.entity_type = 'destinations' then f.entity_id else f.destination_id end
  where f.deleted_at is null and (f.entity_type = 'destinations' or (f.entity_type is null and f.destination_id is not null))
  on conflict do nothing;
end $$;

comment on column public.faqs.entity_type is 'Deprecated: replaced by faq_placements. Kept for history; not read by the site.';
comment on column public.faqs.destination_id is 'Deprecated: replaced by faq_placements. Kept for history; not read by the site.';

-- Replaces all of one FAQ's placements in one step. Targets that no longer
-- exist or are deleted are skipped, so a stale choice in an open editor never
-- blocks a save; it simply drops out.
create or replace function public.set_faq_placements(
  p_faq_id uuid,
  p_home boolean,
  p_category_ids uuid[],
  p_tour_ids uuid[],
  p_destination_ids uuid[]
) returns void language plpgsql set search_path = public as $$
begin
  perform 1 from faqs where id = p_faq_id and deleted_at is null for update;
  if not found then raise exception 'FAQ not found.' using errcode = '23514'; end if;
  if coalesce(cardinality(p_category_ids), 0) > 100 or coalesce(cardinality(p_tour_ids), 0) > 500
     or coalesce(cardinality(p_destination_ids), 0) > 200 then
    raise exception 'Too many places for one question.' using errcode = '23514';
  end if;

  delete from faq_placements where faq_id = p_faq_id;
  if coalesce(p_home, false) then
    insert into faq_placements (faq_id, placement) values (p_faq_id, 'home');
  end if;
  insert into faq_placements (faq_id, placement, category_id)
    select p_faq_id, 'category', c.id from tour_categories c
    where c.id = any(coalesce(p_category_ids, '{}')) and c.deleted_at is null;
  insert into faq_placements (faq_id, placement, tour_id)
    select p_faq_id, 'tour', t.id from tours t
    where t.id = any(coalesce(p_tour_ids, '{}')) and t.deleted_at is null;
  insert into faq_placements (faq_id, placement, destination_id)
    select p_faq_id, 'destination', d.id from destinations d
    where d.id = any(coalesce(p_destination_ids, '{}')) and d.deleted_at is null;
end $$;

revoke all on function public.set_faq_placements(uuid, boolean, uuid[], uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.set_faq_placements(uuid, boolean, uuid[], uuid[], uuid[]) to service_role;

notify pgrst, 'reload schema';
commit;
