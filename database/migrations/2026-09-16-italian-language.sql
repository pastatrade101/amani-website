-- Add Italian to the languages a page can be translated into.
-- Apply by pasting into the Supabase SQL editor. Single transaction.
--
-- `languages` is the source of truth for the whole translation feature: the
-- switcher, hreflang, the admin's per-language tabs and the machine-translation
-- target all read it, and content_translations.language_code is a foreign key
-- into it. So this row is the entire database side of adding a language —
-- nothing else has a list to widen. The frontend keeps one matching list, for
-- URL routing only (KNOWN_LOCALES in src/lib/i18n.ts).
--
-- sort_order 5 continues the seeded run (en 0, sw 1, de 2, fr 3, es 4).
--
-- enabled = true, matching every other seeded language. That makes /it/ live
-- and puts Italian in the switcher straight away, with pages falling back to
-- English until they are translated — the same thing German, French and Spanish
-- already do. hreflang is unaffected either way: it is built per page from the
-- locales that actually have a published translation, so Italian is not
-- advertised to a crawler until a page genuinely exists in it. To hold it back
-- from visitors until there is Italian content, switch it off in
-- Admin -> Settings -> Languages, or change `true` to `false` below.
--
-- Idempotent: re-running changes nothing.

begin;

insert into languages (code, name, native_name, locale, enabled, is_default, sort_order) values
  ('it', 'Italian', 'Italiano', 'it-IT', true, false, 5)
on conflict (code) do nothing;

commit;
