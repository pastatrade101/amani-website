-- Complete, validated content document for /safari-styles/[slug].
-- The JSON keys mirror the shared public template, so a page export can be
-- pasted into the Categories CMS without changing Svelte code.

alter table tour_categories
  add column if not exists landing_page_content jsonb;

-- This migration sorts before the earlier planning-notes migration on a
-- fresh install, while existing databases may already have the column.
-- Creating it here as well keeps both migration paths idempotent.
alter table tour_categories
  add column if not exists planning_notes jsonb;

comment on column tour_categories.landing_page_content is
  'Complete safari-style page document: hero, trustChips, overview, planner, tourCollection, planningGuide, advisor, howItsPlanned, reviews, faq and finalCta.';

-- Give every existing style a complete document before the publication
-- constraint is enabled. Editors can then replace this generated copy with
-- page-specific content from the CMS without any blank public sections.
update tour_categories c
set landing_page_content = jsonb_build_object(
  'hero', jsonb_build_object(
    'eyebrow', c.name,
    'headline', c.name || ' Planned With Local Expertise',
    'subheadline', coalesce(nullif(c.short_description, ''), nullif(c.description, ''), 'Explore ' || lower(c.name) || ' with local planning support.'),
    'primaryCtaLabel', 'Request a Safari Plan',
    'secondaryCtaLabel', 'View Safari Ideas',
    'trustLine', array_to_string((coalesce(c.highlights, '{}'::text[]) || array['Private safari routes','Local Tanzania guides','Tailor-made planning','Clear local support']::text[])[1:4], ' · ')
  ),
  'trustChips', to_jsonb((coalesce(c.highlights, '{}'::text[]) || array['Private safari routes','Local Tanzania guides','Tailor-made planning','Clear local support']::text[])[1:4]),
  'overview', jsonb_build_object(
    'label', c.name,
    'headline', c.name || ', Done Properly',
    'paragraphs', to_jsonb(array[
      coalesce(nullif(c.short_description, ''), nullif(c.description, ''), 'Explore ' || lower(c.name) || ' with local planning support.'),
      'The right ' || lower(c.name) || ' depends on your dates, available time, comfort level and preferred pace.'
    ]::text[]),
    'imageUrl', c.image_url
  ),
  'planner', jsonb_build_object(
    'label', 'Plan This Experience',
    'headline', 'Want This Style of Tanzania Trip?',
    'intro', 'Share a few details and we''ll help shape the route, timing and comfort level around your dates.'
  ),
  'tourCollection', jsonb_build_object(
    'label', 'Safari Ideas',
    'headline', c.name || ' Safari Ideas',
    'subheadline', 'Explore published routes for this safari style. Use the filters to compare by duration, comfort level and starting price.',
    'resultsNoun', lower(c.name) || ' safari ideas',
    'loadMoreLabel', 'Load More Safaris'
  ),
  'planningGuide', jsonb_build_object(
    'label', 'Planning Guide',
    'title', 'How to Plan ' || c.name,
    'intro', 'Start with your available time, dates and priorities. The strongest trip balances the places you want to see with realistic travel time, well-located stays and the right comfort level.',
    'blocks', jsonb_build_array(
      jsonb_build_object(
        'title','Best time to go',
        'body','The best season depends on wildlife, weather and availability. We match your dates to the strongest route for that time of year.',
        'links',jsonb_build_array(jsonb_build_object('label','Read our Tanzania travel advice','href','/expert-advice'))
      ),
      jsonb_build_object(
        'title','Best safari parks',
        'body','We select the parks that best support this safari style, then balance wildlife time with realistic transfers and well-located stays.',
        'links',jsonb_build_array(jsonb_build_object('label','Explore safari destinations','href','/destinations'))
      ),
      jsonb_build_object(
        'title','Travel costs',
        'body',coalesce(nullif(c.planning_notes->>'costs',''),'The final price depends on your dates, group size, route, flights and preferred lodge standard.'),
        'links',jsonb_build_array(jsonb_build_object('label','Read our safari planning advice','href','/expert-advice'))
      ),
      jsonb_build_object(
        'title','Route planning',
        'body',coalesce(nullif(c.planning_notes->>'route',''),'We order the route around travel time, flight connections and enough nights in each key area.'),
        'links',jsonb_build_array(jsonb_build_object('label','Request a safari plan','href','#lead-form'))
      )
    )
  ),
  'advisor', jsonb_build_object(
    'headline', 'What We Help You Get Right',
    'intro', c.name || ' can look simple on paper, but the quality of the trip depends on route order, timing, stay choice and daily pacing.',
    'big', jsonb_build_array(
      'How many days to give ' || lower(c.name) || '.',
      'Which parks and places to include and which to skip.',
      'Whether to drive, fly or combine both.',
      'How to balance wildlife, travel time and comfort.'
    ),
    'quiet', jsonb_build_array(
      'Lodge location inside or outside key areas.',
      'Avoiding rushed one-night stops.',
      'Matching the guide and activity style to your interests.',
      'Planning around season, road time and transfer logistics.'
    )
  ),
  'howItsPlanned', jsonb_build_object(
    'label', 'How Your Trip Is Planned',
    'title', 'From First Note to Final Sundowner',
    'intro', 'Simple planning, clear proposals and no pressure.',
    'steps', jsonb_build_array(
      jsonb_build_object('title','Tell Us Your Travel Style','text','A short conversation about who''s travelling, your dates and the pace you enjoy.'),
      jsonb_build_object('title','We Shape the Right Route','text','We suggest which parks, coast, number of nights and route make sense.'),
      jsonb_build_object('title','We Refine Lodges, Flights & Pacing','text','Camps and transfers are matched to season, budget and travel style.'),
      jsonb_build_object('title','You Travel With Support on the Ground','text','Local guides and someone reachable from arrival to departure.')
    )
  ),
  'reviews', jsonb_build_object(
    'label', 'Traveller Stories',
    'title', 'Travellers Who Planned Tanzania With Us',
    'intro', 'Real guests, real routes and the planning details that made their trips work.'
  ),
  'faq', jsonb_build_object('title','Questions About ' || c.name,'answeredBy','Goldfinch Adventures'),
  'finalCta', jsonb_build_object(
    'label', 'Start Planning',
    'headline', 'Request Your ' || c.name || ' Plan',
    'subheadline', 'Tell us your travel dates, group size and preferred safari style. We''ll recommend a route that fits your time, budget and pace.',
    'proofs', jsonb_build_array('Tailored to your dates and budget','Local Tanzania safari experts','Clear proposal with no obligation','Response within 24 hours'),
    'buttonLabel', 'Request Your Safari Plan',
    'whatsappLabel', 'Prefer WhatsApp? Message us here →'
  )
)
where c.landing_page_content is null
  and c.deleted_at is null;

alter table tour_categories
  drop constraint if exists tour_categories_published_landing_page_check;

alter table tour_categories
  add constraint tour_categories_published_landing_page_check
  check (
    status <> 'published'
    or coalesce((
      landing_page_content is not null
      and jsonb_typeof(landing_page_content) = 'object'
      and landing_page_content ?& array[
        'hero','trustChips','overview','planner','tourCollection','planningGuide',
        'advisor','howItsPlanned','reviews','faq','finalCta'
      ]
      and case when jsonb_typeof(landing_page_content->'trustChips') = 'array'
        then jsonb_array_length(landing_page_content->'trustChips') = 4 else false end
      and case when jsonb_typeof(landing_page_content->'planningGuide'->'blocks') = 'array'
        then jsonb_array_length(landing_page_content->'planningGuide'->'blocks') = 4 else false end
      and case when jsonb_typeof(landing_page_content->'planningGuide'->'blocks'->0->'links') = 'array'
        then jsonb_array_length(landing_page_content->'planningGuide'->'blocks'->0->'links') between 1 and 8 else false end
      and case when jsonb_typeof(landing_page_content->'planningGuide'->'blocks'->1->'links') = 'array'
        then jsonb_array_length(landing_page_content->'planningGuide'->'blocks'->1->'links') between 1 and 8 else false end
      and case when jsonb_typeof(landing_page_content->'planningGuide'->'blocks'->2->'links') = 'array'
        then jsonb_array_length(landing_page_content->'planningGuide'->'blocks'->2->'links') between 1 and 8 else false end
      and case when jsonb_typeof(landing_page_content->'planningGuide'->'blocks'->3->'links') = 'array'
        then jsonb_array_length(landing_page_content->'planningGuide'->'blocks'->3->'links') between 1 and 8 else false end
      and case when jsonb_typeof(landing_page_content->'advisor'->'big') = 'array'
        then jsonb_array_length(landing_page_content->'advisor'->'big') = 4 else false end
      and case when jsonb_typeof(landing_page_content->'advisor'->'quiet') = 'array'
        then jsonb_array_length(landing_page_content->'advisor'->'quiet') = 4 else false end
      and case when jsonb_typeof(landing_page_content->'howItsPlanned'->'steps') = 'array'
        then jsonb_array_length(landing_page_content->'howItsPlanned'->'steps') = 4 else false end
      and case when jsonb_typeof(landing_page_content->'finalCta'->'proofs') = 'array'
        then jsonb_array_length(landing_page_content->'finalCta'->'proofs') = 4 else false end
    ), false)
  );
