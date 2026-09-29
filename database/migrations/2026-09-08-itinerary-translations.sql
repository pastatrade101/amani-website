-- Let itinerary days be translated.
-- Apply by pasting into the Supabase SQL editor. Single transaction.
--
-- A tour could be translated but its day-by-day plan could not, so a visitor on
-- /de/ met a German page whose entire itinerary was still in English — the
-- half-translated result that reads worse than leaving the page in one
-- language. The entity_type check simply had no room for it: saving a day's
-- translation failed with 23514 and the CMS reported "unable to save".
--
-- Same shape as the last two coverage migrations: widen the check, then backfill
-- the existing English text as the English record.

begin;

-- Postgres has no "alter check", so the constraint is dropped and recreated.
-- Atomic inside the transaction.
alter table content_translations drop constraint if exists content_translations_entity_type_check;
alter table content_translations add constraint content_translations_entity_type_check
  check (entity_type in (
    'tours', 'tour_categories', 'destinations', 'lodges',
    'blog_posts', 'homepage_sections', 'faqs', 'activities',
    'itinerary_days'
  ));

-- ── Backfill: the day's current copy becomes its English record ─────────────
--
-- Only the five fields the registry treats as language. day_number, image_url
-- and accommodation_id are deliberately absent: a day is the same day in every
-- language, and its photo and linked property are shared data.
--
-- Idempotent, and jsonb_strip_nulls drops fields that are null on a row so an
-- empty column does not become an empty string in the translation record.

insert into content_translations (entity_type, entity_id, language_code, fields, translation_status, translated_at, published_at)
select 'itinerary_days', d.id, 'en',
  jsonb_strip_nulls(jsonb_build_object(
    'title', d.title,
    'description', d.description,
    'accommodation', d.accommodation,
    'meals', d.meals,
    'activities', d.activities
  )),
  'published', now(), now()
from itinerary_days d
on conflict (entity_type, entity_id, language_code) do nothing;

commit;

-- ── After applying ────────────────────────────────────────────────────────
--
-- Nothing changes for a visitor until a day is translated AND published in the
-- CMS: localizeRecords only reads rows with translation_status = 'published',
-- so a draft translation never reaches the website.
