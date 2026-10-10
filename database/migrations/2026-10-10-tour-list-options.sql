-- Reusable package terms; tour rows are selections, their labels are derived.
begin;
create table if not exists public.tour_list_options (
 id uuid primary key default gen_random_uuid(),
 kind text not null check (kind in ('inclusion','exclusion')),
 title text not null check (length(btrim(title)) > 0),
 is_active boolean not null default true,
 sort_order integer not null default 0 check (sort_order >= 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists tour_list_options_unique_title on public.tour_list_options(kind,lower(regexp_replace(btrim(title),'\s+',' ','g')));
alter table public.tour_list_options enable row level security;
grant all on public.tour_list_options to service_role;

alter table public.tour_inclusions add column if not exists option_id uuid references public.tour_list_options(id) on delete restrict;
alter table public.tour_exclusions add column if not exists option_id uuid references public.tour_list_options(id) on delete restrict;

-- Existing suggestions become selectable data, not hard-coded frontend text.
insert into public.tour_list_options(kind,title,sort_order) values
 ('inclusion','Park entry and conservation fees',0),
 ('inclusion','Private 4x4 safari vehicle with pop-up roof',1),
 ('inclusion','Professional English-speaking driver-guide',2),
 ('inclusion','Accommodation as listed in the itinerary',3),
 ('inclusion','Meals as listed in the itinerary',4),
 ('inclusion','Airport transfers on arrival and departure',5),
 ('inclusion','Drinking water during game drives',6),
 ('exclusion','International flights',0),
 ('exclusion','Tanzania visa',1),
 ('exclusion','Tips and gratuities',2),
 ('exclusion','Travel insurance',3),
 ('exclusion','Drinks not listed in the itinerary',4),
 ('exclusion','Personal expenses such as laundry and phone calls',5),
 ('exclusion','Optional activities not listed in the itinerary',6)
on conflict do nothing;

-- Preserve all current promises; repeated wording shares one library record.
delete from public.tour_inclusions where btrim(title) = '';
delete from public.tour_exclusions where btrim(title) = '';
insert into public.tour_list_options(kind,title)
select distinct 'inclusion', btrim(title) from public.tour_inclusions
union select distinct 'exclusion', btrim(title) from public.tour_exclusions
on conflict do nothing;
update public.tour_inclusions i set option_id = o.id
 from public.tour_list_options o where i.option_id is null and o.kind = 'inclusion'
 and lower(regexp_replace(btrim(i.title),'\s+',' ','g')) = lower(regexp_replace(btrim(o.title),'\s+',' ','g'));
update public.tour_exclusions i set option_id = o.id
 from public.tour_list_options o where i.option_id is null and o.kind = 'exclusion'
 and lower(regexp_replace(btrim(i.title),'\s+',' ','g')) = lower(regexp_replace(btrim(o.title),'\s+',' ','g'));
-- Keep the first occurrence when an old tour repeated the same item.
delete from public.tour_inclusions where id in (select id from (select id,row_number() over(partition by tour_id,option_id order by sort_order,created_at,id) n from public.tour_inclusions) d where n>1);
delete from public.tour_exclusions where id in (select id from (select id,row_number() over(partition by tour_id,option_id order by sort_order,created_at,id) n from public.tour_exclusions) d where n>1);
alter table public.tour_inclusions alter column option_id set not null;
alter table public.tour_exclusions alter column option_id set not null;
create unique index if not exists tour_inclusions_option_unique on public.tour_inclusions(tour_id,option_id);
create unique index if not exists tour_exclusions_option_unique on public.tour_exclusions(tour_id,option_id);

create or replace function public.link_tour_list_option() returns trigger
language plpgsql set search_path=public as $$
declare option_row tour_list_options%rowtype; item_kind text;
begin
 item_kind := case when TG_TABLE_NAME = 'tour_inclusions' then 'inclusion' else 'exclusion' end;
 -- Compatibility for SQL seeds and CSV imports. API/editor writes use IDs only.
 if new.option_id is null then
   if coalesce(btrim(new.title),'') = '' then raise exception 'Select a package option.' using errcode='23514'; end if;
   insert into tour_list_options(kind,title) values(item_kind,btrim(new.title)) on conflict do nothing;
   select id into new.option_id from tour_list_options where kind=item_kind
     and lower(regexp_replace(btrim(title),'\s+',' ','g'))=lower(regexp_replace(btrim(new.title),'\s+',' ','g'));
 end if;
 select * into option_row from tour_list_options where id=new.option_id for share;
 if not found or option_row.kind <> item_kind then raise exception 'This option belongs to the wrong inclusion/exclusion list.' using errcode='23514'; end if;
 if not option_row.is_active and (TG_OP='INSERT' or new.option_id is distinct from old.option_id or new.tour_id is distinct from old.tour_id) then
   raise exception 'This package option is inactive. Choose an active option.' using errcode='23514';
 end if;
 new.title := option_row.title;
 return new;
end $$;
drop trigger if exists inclusions_link_option on public.tour_inclusions;
create trigger inclusions_link_option before insert or update of option_id,title,tour_id on public.tour_inclusions for each row execute function public.link_tour_list_option();
drop trigger if exists exclusions_link_option on public.tour_exclusions;
create trigger exclusions_link_option before insert or update of option_id,title,tour_id on public.tour_exclusions for each row execute function public.link_tour_list_option();

create or replace function public.sync_tour_list_option() returns trigger
language plpgsql set search_path=public as $$
begin
 if new.kind is distinct from old.kind then raise exception 'An option cannot change between inclusion and exclusion.' using errcode='23514'; end if;
 if new.title is distinct from old.title then
   update tour_inclusions set title=new.title,updated_at=now() where option_id=new.id;
   update tour_exclusions set title=new.title,updated_at=now() where option_id=new.id;
 end if;
 return new;
end $$;
drop trigger if exists options_sync_tours on public.tour_list_options;
create trigger options_sync_tours after update of kind,title on public.tour_list_options for each row execute function public.sync_tour_list_option();

-- Both lists replace atomically; retaining inactive items never loses a tour's promises.
create or replace function public.set_tour_list_options(p_tour_id uuid,p_inclusion_ids uuid[] default null,p_exclusion_ids uuid[] default null)
returns void language plpgsql set search_path=public as $$
declare ids uuid[]; item_kind text; item_table text; chosen uuid; position integer; retained boolean; affected integer;
begin
 perform id from tours where id=p_tour_id and deleted_at is null for update;
 if not found then raise exception 'Tour not found.' using errcode='23514'; end if;
 foreach item_kind in array array['inclusion','exclusion'] loop
   ids := case when item_kind='inclusion' then p_inclusion_ids else p_exclusion_ids end;
   if ids is null then continue; end if;
   if cardinality(ids)>20 or exists(select 1 from unnest(ids) x where x is null)
      or cardinality(ids) <> (select count(distinct x) from unnest(ids) x) then
     raise exception 'Select up to 20 different % options.',item_kind using errcode='23514';
   end if;
   item_table := case when item_kind='inclusion' then 'tour_inclusions' else 'tour_exclusions' end;
   foreach chosen in array ids loop
     if not exists(select 1 from tour_list_options where id=chosen and kind=item_kind) then
       raise exception 'An option is missing or belongs to the wrong list.' using errcode='23514';
     end if;
     if not (select is_active from tour_list_options where id=chosen) then
       execute format('select exists(select 1 from %I where tour_id=$1 and option_id=$2)',item_table) into retained using p_tour_id,chosen;
       if not retained then raise exception 'Inactive options cannot be newly selected.' using errcode='23514'; end if;
     end if;
   end loop;
   -- Delete only removed links. Retained inactive options can still be reordered.
   execute format('delete from %I where tour_id=$1 and not(option_id=any($2))',item_table) using p_tour_id,ids;
   position := 0;
   foreach chosen in array ids loop
     execute format('update %I set sort_order=$3 where tour_id=$1 and option_id=$2',item_table) using p_tour_id,chosen,position;
     get diagnostics affected = row_count;
     if affected=0 then
       execute format('insert into %I(tour_id,option_id,sort_order) values($1,$2,$3)',item_table) using p_tour_id,chosen,position;
     end if;
     position := position + 1;
   end loop;
 end loop;
end $$;
revoke all on function public.set_tour_list_options(uuid,uuid[],uuid[]) from public,anon,authenticated;
grant execute on function public.set_tour_list_options(uuid,uuid[],uuid[]) to service_role;

create or replace function public.add_tour_list_options(p_kind text,p_titles text[]) returns setof public.tour_list_options
language plpgsql set search_path=public as $$
declare title_value text;
begin
 if p_kind is null or p_titles is null or p_kind not in ('inclusion','exclusion') or cardinality(p_titles)>200 or cardinality(p_titles)<1 then
   raise exception 'Provide an inclusion or exclusion list with 1 to 200 items.' using errcode='23514';
 end if;
 foreach title_value in array p_titles loop
   title_value := regexp_replace(btrim(title_value),'\s+',' ','g');
   if coalesce(length(title_value),0)=0 or length(title_value)>100 then raise exception 'Keep each option between 1 and 100 characters.' using errcode='23514'; end if;
   insert into tour_list_options(kind,title) values(p_kind,title_value) on conflict do nothing;
 end loop;
 return query select * from tour_list_options where kind=p_kind and lower(regexp_replace(btrim(title),'\s+',' ','g')) in
   (select lower(regexp_replace(btrim(t),'\s+',' ','g')) from unnest(p_titles) t) order by sort_order,title;
end $$;
revoke all on function public.add_tour_list_options(text,text[]) from public,anon,authenticated;
grant execute on function public.add_tour_list_options(text,text[]) to service_role;

notify pgrst,'reload schema';
commit;
