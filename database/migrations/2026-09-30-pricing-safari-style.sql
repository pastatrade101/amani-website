-- Safari style on pricing seasons: each tour can hold per-person prices by
-- group size for Budget, Midrange and Luxury. A season (Standard, Peak or a
-- custom date range) now belongs to one style; its tour_group_prices rows are
-- unchanged.
--
-- Existing seasons become 'midrange', which is also the style the public price
-- table opens on. Additive and idempotent.

alter table tour_pricing_seasons
  add column if not exists safari_style text not null default 'midrange';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tour_pricing_seasons_safari_style_check') then
    alter table tour_pricing_seasons
      add constraint tour_pricing_seasons_safari_style_check check (safari_style in ('budget', 'midrange', 'luxury'));
  end if;
end
$$;

create index if not exists idx_tour_pricing_seasons_style on tour_pricing_seasons (tour_id, safari_style, sort_order);

notify pgrst, 'reload schema';
