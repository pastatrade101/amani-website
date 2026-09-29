-- Multilingual foundation (Phase 1 of the staged plan).
-- Apply by pasting into the Supabase SQL editor. Single transaction; a failure
-- rolls everything back. Nothing here drops or rewrites existing columns —
-- source content stays exactly where it is (Phase 5 much later, only after
-- reads are proven).
--
-- Architecture: shared/non-translatable data stays on the main entity;
-- human-readable content is stored per language in ONE generic table,
-- content_translations, keyed by (entity_type, entity_id, language_code).
-- One table instead of five *_translations clones: the set of translatable
-- fields per entity lives in a code registry, so adding an entity or a field
-- is configuration, not DDL — while keeping every constraint the per-table
-- design would have had (uniqueness per entity+language, status checks,
-- localized-slug uniqueness per locale).

-- ── Languages ────────────────────────────────────────────────────────────────
create table if not exists languages (
  code text primary key,
  name text not null,
  native_name text not null,
  locale text not null,
  enabled boolean not null default false,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exactly one default language, enforced by the database.
create unique index if not exists languages_single_default
  on languages (is_default) where is_default;

insert into languages (code, name, native_name, locale, enabled, is_default, sort_order) values
  ('en', 'English',  'English',   'en-US', true,  true,  0),
  ('sw', 'Swahili',  'Kiswahili', 'sw-TZ', true,  false, 1),
  ('de', 'German',   'Deutsch',   'de-DE', true,  false, 2),
  ('fr', 'French',   'Français',  'fr-FR', true,  false, 3),
  ('es', 'Spanish',  'Español',   'es-ES', true,  false, 4)
on conflict (code) do nothing;

-- ── Content translations ─────────────────────────────────────────────────────
create table if not exists content_translations (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('tours', 'tour_categories', 'destinations', 'lodges', 'blog_posts')),
  entity_id uuid not null,
  language_code text not null references languages(code),
  -- Translated field values keyed by source column name; strings, or arrays of
  -- strings for list fields (highlights). Which keys are valid, required and
  -- rich-text is defined by the backend registry and enforced there.
  fields jsonb not null default '{}'::jsonb,
  -- Optional localized slug; null means the entity's canonical slug is shared.
  translated_slug text,
  translation_status text not null default 'not_started'
    check (translation_status in ('not_started', 'draft', 'translated', 'needs_review', 'published')),
  -- Hash of the source-language values at the moment this translation was
  -- saved. When the source is edited later the hashes stop matching and the
  -- translation surfaces as "may be outdated" — never silently assumed fresh.
  source_hash text,
  translated_at timestamptz,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_by uuid,
  updated_by uuid,
  translated_by uuid,
  reviewed_by uuid,
  published_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, language_code)
);

create index if not exists content_translations_lookup
  on content_translations (entity_type, language_code, translation_status);
create index if not exists content_translations_entity
  on content_translations (entity_type, entity_id);
-- Localized slugs are unique per entity type and locale, only where used.
create unique index if not exists content_translations_slug_unique
  on content_translations (entity_type, language_code, translated_slug)
  where translated_slug is not null;

-- ── Backfill: existing content becomes the English translation record ───────
-- Source columns keep working untouched; these records make English a normal
-- language in the system instead of a special case. Idempotent (on conflict
-- do nothing), and jsonb_strip_nulls drops columns that are null on a row.

insert into content_translations (entity_type, entity_id, language_code, fields, translation_status, translated_at, published_at)
select 'tour_categories', c.id, 'en',
  jsonb_strip_nulls(jsonb_build_object(
    'name', c.name,
    'short_description', c.short_description,
    'description', c.description,
    'who_its_for', c.who_its_for,
    'highlights', to_jsonb(c.highlights),
    'meta_title', c.meta_title,
    'meta_description', c.meta_description
  )),
  'published', now(), now()
from tour_categories c
where c.deleted_at is null
on conflict (entity_type, entity_id, language_code) do nothing;

insert into content_translations (entity_type, entity_id, language_code, fields, translation_status, translated_at, published_at)
select 'tours', t.id, 'en',
  jsonb_strip_nulls(jsonb_build_object(
    'title', t.title,
    'short_description', t.short_description,
    -- tours store their long copy in full_description, not description; the
    -- jsonb key must match the real column name because the read-side
    -- resolver writes translated values back onto that exact key.
    'full_description', t.full_description,
    'highlights', to_jsonb(t.highlights),
    'seo_title', t.seo_title,
    'meta_description', t.meta_description
  )),
  'published', now(), now()
from tours t
where t.deleted_at is null
on conflict (entity_type, entity_id, language_code) do nothing;

insert into content_translations (entity_type, entity_id, language_code, fields, translation_status, translated_at, published_at)
select 'destinations', d.id, 'en',
  jsonb_strip_nulls(jsonb_build_object(
    'name', d.name,
    'short_description', d.short_description,
    'description', d.description,
    'meta_title', d.meta_title,
    'meta_description', d.meta_description
  )),
  'published', now(), now()
from destinations d
where d.deleted_at is null
on conflict (entity_type, entity_id, language_code) do nothing;

insert into content_translations (entity_type, entity_id, language_code, fields, translation_status, translated_at, published_at)
select 'lodges', l.id, 'en',
  jsonb_strip_nulls(jsonb_build_object(
    'name', l.name,
    'short_description', l.short_description,
    'description', l.description,
    'why_we_recommend', l.why_we_recommend
  )),
  'published', now(), now()
from lodges l
where l.deleted_at is null
on conflict (entity_type, entity_id, language_code) do nothing;
