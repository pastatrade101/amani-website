-- Destination long-form guide (the "destination template" content system).
--
-- Adds a structured jsonb `guide` column — an ordered array of typed content
-- blocks (part / richtext / field_notes / callout / did_you_know / table / photo /
-- facts / faq) rendered by the frontend DestinationGuide component — plus a
-- `guide_reviewed_at` freshness date so a guide can display "last reviewed".
--
-- Non-breaking: both columns are additive and defaulted, so existing rows and the
-- REST/CSV write paths keep working unchanged.

alter table destinations
  add column if not exists guide jsonb not null default '[]'::jsonb,
  add column if not exists guide_reviewed_at date;
