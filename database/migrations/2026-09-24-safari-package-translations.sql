-- Let safari packages be translated.
-- Apply by pasting into the Supabase SQL editor. Single transaction.
--
-- The CMS now offers a Translations tab on every safari package — the page's
-- name, hero and SEO fields, and the words inside each of its blocks. Saving one
-- failed with 23514 and the CMS reported "Unable to save the translation.",
-- because the entity_type check had no room for the new type. Same fix as the
-- itinerary-days migration: widen the check.
--
-- Additive and idempotent: the constraint is dropped if present and recreated
-- with every type it allowed before plus one. Running it twice is harmless.
--
-- No English backfill this time. A package's block fields are keyed by each
-- block's id (`sections.#b3.title`), which the application assigns; the English
-- is always read live from the package itself, so there is nothing to copy.

begin;

-- Postgres has no "alter check", so the constraint is dropped and recreated.
-- Atomic inside the transaction.
alter table content_translations drop constraint if exists content_translations_entity_type_check;
alter table content_translations add constraint content_translations_entity_type_check
  check (entity_type in (
    'tours', 'tour_categories', 'destinations', 'lodges',
    'blog_posts', 'homepage_sections', 'faqs', 'activities',
    'itinerary_days', 'safari_packages'
  ));

commit;

-- ── After applying ────────────────────────────────────────────────────────
--
-- Nothing changes for a visitor until a package is translated AND published in
-- the CMS: localizeRecords only reads rows with translation_status = 'published',
-- so a draft translation never reaches the website.
--
-- Check it took:
--   select pg_get_constraintdef(oid) from pg_constraint
--   where conname = 'content_translations_entity_type_check';
