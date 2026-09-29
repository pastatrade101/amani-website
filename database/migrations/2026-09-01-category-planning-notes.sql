-- Per-style planning guidance for the safari-style pages.
-- Apply by pasting into the Supabase SQL editor.
--
-- The "how to plan" band on a style page wants four facts. Three already have
-- somewhere to live and are already editable in the Categories admin:
--
--   best time to go   -> tour_categories.best_months
--   trip length       -> tour_categories.min_days / max_days
--   fitness           -> tour_categories.fitness_level
--
-- and the parks a style actually visits are derived from its published tours,
-- so they need no field at all — they cannot go stale.
--
-- What had nowhere to live is the prose: what a trip of this style tends to
-- cost, and how the route is usually put together. Both are per-style, both are
-- editorial, and neither belongs in a column of its own — hence one jsonb the
-- admin edits as two boxes.
--
--   { "costs": "…", "route": "…" }
--
-- Every key is optional. A style with neither renders no block, which is the
-- point: an empty planning band is better than an invented one.

alter table tour_categories add column if not exists planning_notes jsonb;

comment on column tour_categories.planning_notes is
  'Optional per-style planning prose: { costs, route }. Absent keys hide their block rather than rendering a placeholder.';
