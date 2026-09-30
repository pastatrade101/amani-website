-- The lodge API schema has always accepted country, region and park_area, but
-- no migration ever created them, so any save that sent one failed with
-- PGRST204. The simplified lodge editor asks for them on its Location step.
--
-- Additive and idempotent.

alter table lodges add column if not exists country text;
alter table lodges add column if not exists region text;
alter table lodges add column if not exists park_area text;

comment on column lodges.park_area is 'Where in the park or area the property sits, e.g. "Central Serengeti — north-west of Seronera".';

notify pgrst, 'reload schema';
