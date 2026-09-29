-- Let the legal pages be translated.
-- Apply by pasting into the Supabase SQL editor. Single transaction.
--
-- Privacy Policy, Terms, Cancellation Policy and Data Retention now have a
-- Translations area in Admin → Settings. Their translations are stored like
-- every other one, under entity_type 'legal_pages' with a fixed id per page
-- (backend/src/data/legal-pages.ts). Saving one fails with 23514 until the
-- entity_type check allows the new type — same fix as the safari-package
-- migration: widen the check.
--
-- Additive and idempotent: the constraint is dropped if present and recreated
-- with every type it allowed before plus one. Running it twice is harmless.

begin;

alter table content_translations drop constraint if exists content_translations_entity_type_check;
alter table content_translations add constraint content_translations_entity_type_check
  check (entity_type in (
    'tours', 'tour_categories', 'destinations', 'lodges',
    'blog_posts', 'homepage_sections', 'faqs', 'activities',
    'itinerary_days', 'safari_packages', 'legal_pages'
  ));

commit;

-- Check it took:
--   select pg_get_constraintdef(oid) from pg_constraint
--   where conname = 'content_translations_entity_type_check';
