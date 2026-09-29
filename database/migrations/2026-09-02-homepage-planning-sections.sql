-- Exact homepage content for the three planning-led editorial sections.
-- Existing advisor/how-planned media is intentionally retained so applying the
-- migration never replaces an image already selected in the CMS.

insert into homepage_sections (
  section_key,
  title,
  subtitle,
  content,
  image_url,
  button_text,
  button_url,
  extra_data,
  status,
  is_active,
  sort_order
)
values
  (
    'why_us',
    'A Local Team to Help You Make Sense of Tanzania',
    'Tanzania has many possible routes. That is the good part — and also the confusing part. We help you understand what fits your dates, budget, pace and travel style before you commit to anything.',
    null,
    null,
    'Plan Your Trip',
    '#lead-form',
    jsonb_build_object(
      'eyebrow', 'Why Goldfinch',
      'title_highlight', 'Tanzania',
      'features', jsonb_build_array(
        jsonb_build_object('icon_url', '/images/icons-home/icon-planned.png', 'title', 'Planned Around Your Trip', 'text', 'We do not force every traveller into the same route. Safari, Zanzibar, Kilimanjaro, culture and beach can be shaped around what you actually want.'),
        jsonb_build_object('icon_url', '/images/icons-home/icon-local-knowledge.png', 'title', 'Local Knowledge, Real Experience', 'text', 'We understand the parks, roads, seasons, lodge areas, domestic flights and beach regions because this is where we work.'),
        jsonb_build_object('icon_url', '/images/icons-home/icon-real-support.png', 'title', 'Real Support, Real People', 'text', 'From first enquiry to final drop-off, you speak with people who know your route and can help when plans need adjusting.'),
        jsonb_build_object('icon_url', '/images/icons-home/icon-transparent-planning.png', 'title', 'Transparent Planning', 'text', 'We explain what affects cost — lodges, park fees, transfers, domestic flights, route style and comfort level — before you confirm.'),
        jsonb_build_object('icon_url', '/images/icons-home/icon-we-care.png', 'title', 'We Actually Care', 'text', 'Tanzania is our home. The goal is not to sell the longest trip. It is to help you experience the country properly.'),
        jsonb_build_object('icon_url', '/images/icons-home/icon-connected.png', 'title', 'Connected From Start to Finish', 'text', 'Safari, Zanzibar, Kilimanjaro, culture, airport pickups, domestic flights, guides and transfers are planned as one connected journey.')
      )
    ),
    'published',
    true,
    5
  ),
  (
    'advisor_note',
    'The Trip Is Won or Lost in the Planning Details',
    'Most travel mistakes happen before arrival. The wrong route, too many one-night stops, poor lodge locations or badly timed transfers can make even a beautiful trip feel tiring.',
    null,
    null,
    null,
    null,
    jsonb_build_object(
      'eyebrow', 'Advisor''s Note',
      'author_name', 'Deo Robert',
      'author_role', 'Founder & Advisor, Goldfinch Adventures',
      'footnote', 'That is why we start with your dates, travel style and priorities — not with a fixed package.',
      'columns', jsonb_build_array(
        jsonb_build_object(
          'icon_url', '/images/icons-home/icon-big-choices.png',
          'title', 'The big choices',
          'items', jsonb_build_array(
            'When to travel — migration timing, dry season, shoulder-season value, beach conditions and Kilimanjaro weather.',
            'Which places to include — and which to leave out so the trip has enough space.',
            'How to combine safari, Zanzibar, Kilimanjaro or culture without wasting days in transit.',
            'Accommodation style — mobile camp, tented camp, lodge, boutique hotel, beach resort or mountain hotel.'
          )
        ),
        jsonb_build_object(
          'icon_url', '/images/icons-home/icon-quiet-details.png',
          'title', 'The quiet details',
          'items', jsonb_build_array(
            'Vehicle style, road time and where open-side game-drive vehicles make sense.',
            'Which Zanzibar coast fits your month, swimming preference and travel style.',
            'Family logistics, gentler safari days, connecting rooms and realistic drive times.',
            'Photography, birding, walking, culture or trekking interests matched to the right guide and pace.'
          )
        )
      )
    ),
    'published',
    true,
    6
  ),
  (
    'how_it_works',
    'Simple Planning. Clear Routes. Local Support.',
    'You do not need to arrive with a finished itinerary. Share the basics, and we''ll help turn the idea into a route that makes sense.',
    null,
    null,
    null,
    null,
    jsonb_build_object(
      'eyebrow', 'How Your Trip Is Planned',
      'caption_eyebrow', 'Planned With You',
      'caption', 'From first message to arrival, we shape it together.',
      'steps', jsonb_build_array(
        jsonb_build_object('title', 'Tell Us What You Have in Mind', 'text', 'Share your dates, starting point, number of travellers, budget range and whether you want safari, Zanzibar, Kilimanjaro, culture or a mix.'),
        jsonb_build_object('title', 'We Shape the Right Route', 'text', 'We suggest what fits, what to avoid and how the journey could flow from arrival to departure.'),
        jsonb_build_object('title', 'We Refine the Details', 'text', 'Lodges, camps, beach areas, domestic flights, transfers, guides and timing are matched to your season and comfort level.'),
        jsonb_build_object('title', 'You Travel With Local Support', 'text', 'You travel with trusted guides and a Tanzania-based team reachable from arrival to departure.')
      )
    ),
    'published',
    true,
    7
  )
on conflict (section_key) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  content = excluded.content,
  image_url = coalesce(homepage_sections.image_url, excluded.image_url),
  button_text = excluded.button_text,
  button_url = excluded.button_url,
  extra_data = coalesce(homepage_sections.extra_data, '{}'::jsonb) || excluded.extra_data,
  status = excluded.status,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  deleted_at = null,
  updated_at = now();
