-- Canonical route endpoints. Itinerary boundary days inherit these tour links.
begin;
alter table public.tours add column if not exists start_trip_point_id uuid references public.trip_points(id) on delete restrict;
alter table public.tours add column if not exists end_trip_point_id uuid references public.trip_points(id) on delete restrict;
create index if not exists tours_start_trip_point_idx on public.tours(start_trip_point_id);
create index if not exists tours_end_trip_point_idx on public.tours(end_trip_point_id);

-- Preserve legacy names exactly; no airport codes, destinations or coordinates are guessed.
-- Prefer compatible existing CMS records. Unmatched names become shared Trip Points.
do $$
declare t record; endpoint text; point_id uuid; side text;
begin
  for t in select * from public.tours where deleted_at is null loop
    foreach side in array array['start','end'] loop
      endpoint := btrim(case when side = 'start' then t.start_location else t.end_location end);
      if (case when side = 'start' then t.start_trip_point_id else t.end_trip_point_id end) is not null or coalesce(endpoint,'') = '' then continue; end if;
      select id into point_id from public.trip_points
        where deleted_at is null and status <> 'archived' and role in (side,'both')
          and lower(btrim(name)) = lower(endpoint)
          and (t.status <> 'published' or status = 'published')
        order by (role = 'both') desc, created_at, id limit 1;
      if point_id is null then
        insert into public.trip_points(name,slug,role,gateway_type,status)
          values(endpoint,'legacy-endpoint-' || md5(lower(endpoint)),'both','city',
            case when t.status = 'published' then 'published'::publish_status else 'draft'::publish_status end)
          on conflict(slug) do update set status = case when excluded.status = 'published' then excluded.status else trip_points.status end
          returning id into point_id;
      end if;
      if side = 'start' then
        update public.tours set start_trip_point_id = point_id where id = t.id;
      else
        update public.tours set end_trip_point_id = point_id where id = t.id;
      end if;
    end loop;
  end loop;
end $$;

create or replace function public.validate_tour_trip_points() returns trigger
language plpgsql set search_path = public as $$
declare p trip_points%rowtype; side text; point_id uuid;
begin
  if new.deleted_at is not null then return new; end if;
  foreach side in array array['start','end'] loop
    point_id := case when side = 'start' then new.start_trip_point_id else new.end_trip_point_id end;
    if point_id is null then
      if new.status = 'published' then raise exception 'Select a % Trip Point before publishing this tour.', side using errcode = '23514'; end if;
      if side = 'start' then
        if new.start_location is not null and (TG_OP = 'INSERT' or new.start_location is distinct from old.start_location) then raise exception 'Start location must reference a Trip Point.' using errcode = '23514'; end if;
      else
        if new.end_location is not null and (TG_OP = 'INSERT' or new.end_location is distinct from old.end_location) then raise exception 'End location must reference a Trip Point.' using errcode = '23514'; end if;
      end if;
    else
      select * into p from trip_points where id = point_id for share;
      if not found or p.deleted_at is not null or p.status = 'archived' or p.role not in (side,'both') then
        raise exception 'Selected % Trip Point is unavailable or has the wrong role.', side using errcode = '23514';
      end if;
      if new.status = 'published' and p.status <> 'published' then
        raise exception 'Publish the selected % Trip Point first.', side using errcode = '23514';
      end if;
    end if;
    -- Compatibility labels are generated from the linked record, never independently editable.
    if side = 'start' then new.start_location := case when point_id is null then null else p.name end;
    else new.end_location := case when point_id is null then null else p.name end; end if;
  end loop;
  return new;
end $$;
drop trigger if exists tours_validate_trip_points on public.tours;
create trigger tours_validate_trip_points before insert or update of start_trip_point_id,end_trip_point_id,start_location,end_location,status
  on public.tours for each row execute function public.validate_tour_trip_points();

create or replace function public.protect_tour_trip_point() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists(select 1 from tours t where t.deleted_at is null
    and (t.start_trip_point_id = new.id or t.end_trip_point_id = new.id)
    and (new.deleted_at is not null or new.status = 'archived'
      or (t.status = 'published' and new.status <> 'published')
      or (t.start_trip_point_id = new.id and new.role not in ('start','both'))
      or (t.end_trip_point_id = new.id and new.role not in ('end','both')))) then
    raise exception 'This Trip Point is used by a tour. Reassign the tour endpoints before changing its role, unpublishing, archiving or deleting it.' using errcode = '23514';
  end if;
  if new.name is distinct from old.name then
    update tours set start_location = new.name where start_trip_point_id = new.id;
    update tours set end_location = new.name where end_trip_point_id = new.id;
  end if;
  return new;
end $$;
-- AFTER ensures a renamed point is already visible to the tour validation trigger.
drop trigger if exists trip_points_protect_tours on public.trip_points;
create trigger trip_points_protect_tours after update of name,role,status,deleted_at on public.trip_points
  for each row execute function public.protect_tour_trip_point();
notify pgrst, 'reload schema';
commit;
