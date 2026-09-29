-- The homepage "When should you go?" section as a CMS row, carrying the copy
-- the site showed from its built-in defaults, so every word of the section is
-- now editable: the header here, the season cards in `seasons`.
--
--   extra_data.eyebrow             small label above the heading
--   subtitle                       intro paragraph under the heading
--   extra_data.quick_guide         [{ label, value, icon }] — the "Quick guide" row
--   extra_data.quick_guide_eyebrow / quick_guide_title / footnote
--
-- Only inserted when the section does not exist yet, so editor changes are
-- never overwritten by a re-run.

insert into homepage_sections (section_key, title, subtitle, extra_data, status, is_active, sort_order)
select
  'when_to_go',
  'When Should You Go?',
  'Every season tells a different story. Choose the landscapes, wildlife and pace that speak to you.',
  jsonb_build_object(
    'eyebrow', 'Best time to visit',
    'quick_guide_eyebrow', 'Quick Guide',
    'quick_guide_title', 'Best Time for Different Experiences',
    'quick_guide', jsonb_build_array(
      jsonb_build_object('label', 'Great Migration', 'value', 'June – October', 'icon', 'footprints'),
      jsonb_build_object('label', 'Best Photography', 'value', 'January – March', 'icon', 'camera'),
      jsonb_build_object('label', 'Green Landscapes', 'value', 'November – March', 'icon', 'trees'),
      jsonb_build_object('label', 'Bird Watching', 'value', 'November – April', 'icon', 'bird'),
      jsonb_build_object('label', 'Climbing Kilimanjaro', 'value', 'January – March & June – October', 'icon', 'mountain'),
      jsonb_build_object('label', 'Zanzibar Beaches', 'value', 'Year Round', 'icon', 'palmtree')
    ),
    'footnote', 'Seasons are a general guide. Rainfall and wildlife movements vary by location and year.'
  ),
  'published',
  true,
  40
where not exists (select 1 from homepage_sections where section_key = 'when_to_go' and deleted_at is null);
