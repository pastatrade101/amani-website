-- Extend translation coverage to the rest of the CMS.
-- Apply by pasting into the Supabase SQL editor. Single transaction.
--
-- Phase 1 covered tours, categories, destinations and lodges. The homepage
-- copy, FAQs, blog posts and activities had nowhere to store a translation at
-- all, which meant a visitor on /de/ still met an entirely English homepage.
-- This widens the entity_type check and backfills English records for the new
-- types, exactly as the first migration did.

-- The check constraint is recreated rather than altered — Postgres has no
-- "alter check", and dropping/adding inside one transaction is atomic.
alter table content_translations drop constraint if exists content_translations_entity_type_check;
alter table content_translations add constraint content_translations_entity_type_check
  check (entity_type in (
    'tours', 'tour_categories', 'destinations', 'lodges',
    'blog_posts', 'homepage_sections', 'faqs', 'activities'
  ));

-- ── Backfill: existing copy becomes the English translation record ──────────
-- Idempotent, and jsonb_strip_nulls drops columns that are null on a row.

insert into content_translations (entity_type, entity_id, language_code, fields, translation_status, translated_at, published_at)
select 'homepage_sections', h.id, 'en',
  jsonb_strip_nulls(jsonb_build_object(
    'title', h.title,
    'subtitle', h.subtitle
  )),
  'published', now(), now()
from homepage_sections h
where h.deleted_at is null
on conflict (entity_type, entity_id, language_code) do nothing;

insert into content_translations (entity_type, entity_id, language_code, fields, translation_status, translated_at, published_at)
select 'faqs', f.id, 'en',
  jsonb_strip_nulls(jsonb_build_object(
    'question', f.question,
    'answer', f.answer
  )),
  'published', now(), now()
from faqs f
where f.deleted_at is null
on conflict (entity_type, entity_id, language_code) do nothing;

insert into content_translations (entity_type, entity_id, language_code, fields, translation_status, translated_at, published_at)
select 'blog_posts', b.id, 'en',
  jsonb_strip_nulls(jsonb_build_object(
    'title', b.title,
    'excerpt', b.excerpt,
    'content', b.content,
    'meta_title', b.meta_title,
    'meta_description', b.meta_description
  )),
  'published', now(), now()
from blog_posts b
where b.deleted_at is null
on conflict (entity_type, entity_id, language_code) do nothing;

insert into content_translations (entity_type, entity_id, language_code, fields, translation_status, translated_at, published_at)
select 'activities', a.id, 'en',
  jsonb_strip_nulls(jsonb_build_object(
    'name', a.name,
    'description', a.description,
    'meta_title', a.meta_title,
    'meta_description', a.meta_description
  )),
  'published', now(), now()
from activities a
where a.deleted_at is null
on conflict (entity_type, entity_id, language_code) do nothing;
