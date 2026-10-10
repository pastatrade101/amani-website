begin;
alter table public.tour_price_options add column if not exists is_addon boolean not null default false;
alter table public.tour_activities add column if not exists is_optional boolean not null default false;
alter table public.tour_activities add column if not exists additional_cost boolean not null default false;
alter table public.tour_activities add column if not exists pricing_option_id uuid references public.tour_price_options(id) on delete restrict;
create or replace function public.validate_tour_activity_price() returns trigger language plpgsql set search_path=public as $$
begin
 if not new.is_optional and (new.additional_cost or new.pricing_option_id is not null) then raise exception 'Additional costs are only available for optional activities.' using errcode='23514'; end if;
 if new.pricing_option_id is not null then
  if not new.additional_cost or not exists(select 1 from tour_price_options where id=new.pricing_option_id and tour_id=new.tour_id and price_type in ('per_person','per_group','per_child','upgrade')) then raise exception 'Choose an additional-cost pricing option from this tour.' using errcode='23514'; end if;
 end if;
 if new.pricing_option_id is not null then update tour_price_options set is_addon=true where id=new.pricing_option_id; end if;
 return new;
end $$;
drop trigger if exists validate_activity_price on public.tour_activities;
create trigger validate_activity_price before insert or update on public.tour_activities for each row execute function public.validate_tour_activity_price();
-- A pricing option cannot be moved away from an activity that uses it.
create or replace function public.protect_activity_price() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from tour_activities where pricing_option_id=new.id and (tour_id<>new.tour_id or new.price_type not in ('per_person','per_group','per_child','upgrade') or not new.is_addon)) then raise exception 'This pricing option is linked to an optional activity. Unlink it before changing its tour or charge type.' using errcode='23514'; end if;
 return new;
end $$;
drop trigger if exists protect_activity_price on public.tour_price_options;
create trigger protect_activity_price before update of tour_id,price_type,is_addon on public.tour_price_options for each row execute function public.protect_activity_price();
create or replace function public.set_tour_activity_links(p_tour_id uuid,p_links jsonb) returns void language plpgsql set search_path=public as $$
declare item jsonb; activity_uuid uuid; n integer:=0;
begin
 perform id from tours where id=p_tour_id and deleted_at is null for update;
 if not found then raise exception 'Tour not found.' using errcode='23514'; end if;
 if p_links is null or jsonb_typeof(p_links)<>'array' or jsonb_array_length(p_links)>50 then raise exception 'Select up to 50 activities.' using errcode='23514'; end if;
 if (select count(*) from jsonb_array_elements(p_links))<>(select count(distinct (x->>'activity_id')::uuid) from jsonb_array_elements(p_links) x) then raise exception 'Select each activity once.' using errcode='23514'; end if;
 for item in select * from jsonb_array_elements(p_links) loop
  activity_uuid:=(item->>'activity_id')::uuid;
  if not exists(select 1 from activities where id=activity_uuid and deleted_at is null) then raise exception 'An activity is unavailable.' using errcode='23514'; end if;
  if item ? 'is_optional' then
   insert into tour_activities(tour_id,activity_id,sort_order,is_optional,additional_cost,pricing_option_id)
   values(p_tour_id,activity_uuid,n,coalesce((item->>'is_optional')::boolean,false),coalesce((item->>'additional_cost')::boolean,false),nullif(item->>'pricing_option_id','')::uuid)
   on conflict(tour_id,activity_id) do update set sort_order=excluded.sort_order,is_optional=excluded.is_optional,additional_cost=excluded.additional_cost,pricing_option_id=excluded.pricing_option_id;
  else
   -- Older clients can reorder links without erasing optional settings.
   if exists(select 1 from tour_activities where tour_id=p_tour_id and activity_id=activity_uuid) then
    update tour_activities set sort_order=n where tour_id=p_tour_id and activity_id=activity_uuid;
   else insert into tour_activities(tour_id,activity_id,sort_order) values(p_tour_id,activity_uuid,n); end if;
  end if;
  n:=n+1;
 end loop;
 delete from tour_activities where tour_id=p_tour_id and activity_id not in(select (x->>'activity_id')::uuid from jsonb_array_elements(p_links) x);
end $$;
revoke all on function public.set_tour_activity_links(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.set_tour_activity_links(uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
