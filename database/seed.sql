insert into permissions (permission_key, description)
select permission_key, replace(permission_key, '.', ' ')
from unnest(array[
  'dashboard.view',
  'tours.view','tours.create','tours.update','tours.delete','tours.publish',
  'destinations.view','destinations.create','destinations.update','destinations.delete','destinations.publish',
  'countries.view','countries.create','countries.update','countries.delete','countries.publish',
  'lodges.view','lodges.create','lodges.update','lodges.delete','lodges.publish',
  'activities.view','activities.create','activities.update','activities.delete','activities.publish',
  'trip_points.view','trip_points.create','trip_points.update','trip_points.delete','trip_points.publish',
  'safety_topics.view','safety_topics.create','safety_topics.update','safety_topics.delete','safety_topics.publish',
  'travel_styles.view','travel_styles.create','travel_styles.update','travel_styles.delete','travel_styles.publish',
  'comparisons.view','comparisons.create','comparisons.update','comparisons.delete','comparisons.publish',
  'categories.view','categories.create','categories.update','categories.delete',
  'bookings.view','bookings.update','bookings.delete','bookings.assign',
  'payments.view','payments.create','payments.update','payments.refund',
  'blog.view','blog.create','blog.update','blog.delete','blog.publish',
  'gallery.view','gallery.upload','gallery.delete',
  'media.view','media.upload','media.delete',
  'testimonials.view','testimonials.create','testimonials.update','testimonials.delete','testimonials.publish',
  'faqs.view','faqs.create','faqs.update','faqs.delete',
  'homepage.view','homepage.update',
  'messages.view','messages.update','messages.archive',
  'settings.view','settings.update',
  'exchange_rates.view','exchange_rates.refresh',
  'admin_users.view','admin_users.create','admin_users.update','admin_users.delete',
  'roles.view','roles.update',
  'audit_logs.view',
  'ai_conversations.view','ai_conversations.handoff','tour_matches.view','hubspot.sync'
]) as permission_key
on conflict (permission_key) do update set description = excluded.description;

delete from role_permissions;

insert into role_permissions (role, permission_key)
select 'super_admin'::user_role, permission_key from permissions;

insert into role_permissions (role, permission_key)
select 'admin'::user_role, permission_key from permissions where permission_key <> 'audit_logs.view';

insert into role_permissions (role, permission_key)
select 'content_manager'::user_role, permission_key
from permissions
where permission_key = any(array[
  'dashboard.view',
  'tours.view','tours.create','tours.update','tours.publish',
  'destinations.view','destinations.create','destinations.update','destinations.publish',
  'categories.view','categories.create','categories.update',
  'blog.view','blog.create','blog.update','blog.publish',
  'gallery.view','gallery.upload','gallery.delete',
  'media.view','media.upload','media.delete',
  'testimonials.view','testimonials.create','testimonials.update','testimonials.publish',
  'faqs.view','faqs.create','faqs.update',
  'homepage.view','homepage.update'
]);

insert into role_permissions (role, permission_key)
select 'booking_manager'::user_role, permission_key
from permissions
where permission_key = any(array['dashboard.view','bookings.view','bookings.update','bookings.assign','messages.view','messages.update','messages.archive']);

insert into role_permissions (role, permission_key)
select 'finance_manager'::user_role, permission_key
from permissions
where permission_key = any(array['dashboard.view','bookings.view','payments.view','payments.create','payments.update','payments.refund','exchange_rates.view','exchange_rates.refresh']);

insert into role_permissions (role, permission_key)
select 'editor'::user_role, permission_key
from permissions
where permission_key = any(array[
  'dashboard.view','tours.view','tours.create','tours.update',
  'destinations.view','destinations.create','destinations.update',
  'blog.view','blog.create','blog.update','gallery.view','media.view',
  'testimonials.view','faqs.view','homepage.view'
]);

insert into role_permissions (role, permission_key)
select 'viewer'::user_role, permission_key
from permissions
where permission_key like '%.view';

insert into admin_users (id, full_name, email, password_hash, role, is_active)
values (
  '00000000-0000-4000-8000-000000000001',
  'Goldfinch Super Admin',
  'admin@goldfinch.local',
  '$2a$12$CylUu5yBD7NCj2uu5dvdvujscWMAju8gtVm4kBHya56LLjmad668O',
  'super_admin',
  true
)
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  password_hash = excluded.password_hash,
  role = excluded.role,
  is_active = excluded.is_active,
  deleted_at = null,
  updated_at = now();

insert into destinations (id, name, slug, country, region, short_description, description, main_image_url, status, is_featured, meta_title, meta_description, created_by, updated_by)
values
  ('00000000-0000-4000-8000-000000000101', 'Tanzania', 'tanzania', 'Tanzania', 'Northern Circuit and Coast', 'Safari plains, Kilimanjaro climbs, and island extensions.', 'Tanzania is Goldfinch Adventures'' flagship planning region for Serengeti, Ngorongoro, Kilimanjaro, and Zanzibar trips.', 'https://images.unsplash.com/photo-1516426122078-c23e76319801', 'published', true, 'Tanzania Safari and Kilimanjaro Tours', 'Plan Tanzania safaris, Kilimanjaro climbs, and beach extensions with confidence.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000102', 'Kenya', 'kenya', 'Kenya', 'Masai Mara and Coast', 'Big cat safaris, migration crossings, and Indian Ocean beach stays.', 'Kenya is prepared for Masai Mara, Amboseli, Laikipia, and Diani beach planning content.', 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5', 'published', true, 'Kenya Safari Tours', 'Plan Kenya safari and beach holidays with Goldfinch Adventures.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000103', 'Rwanda', 'rwanda', 'Rwanda', 'Volcanoes and Lake Kivu', 'Gorilla trekking, green highlands, and conservation-led travel.', 'Rwanda is prepared for gorilla trekking, cultural travel, and premium conservation itineraries.', 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e', 'published', true, 'Rwanda Gorilla Trekking', 'Plan Rwanda gorilla trekking and highlands travel with Goldfinch Adventures.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  country = excluded.country,
  region = excluded.region,
  short_description = excluded.short_description,
  description = excluded.description,
  main_image_url = excluded.main_image_url,
  status = excluded.status,
  is_featured = excluded.is_featured,
  meta_title = excluded.meta_title,
  meta_description = excluded.meta_description;

insert into countries (id, name, slug, hero_image_url, intro_text, best_months, visa_info, health_info, currency, capital, phase, status, is_featured, seo_title, meta_description, created_by, updated_by)
values
  ('00000000-0000-4000-8000-000000000401', 'Tanzania', 'tanzania', 'https://images.unsplash.com/photo-1516426122078-c23e76319801', 'Tanzania is East Africa''s flagship safari country — home to the Serengeti, Ngorongoro Crater, Mount Kilimanjaro and the islands of Zanzibar. It is ideal for first safaris, families and a classic safari-and-beach combination.', array['June','July','August','September','October'], 'Most nationalities get a visa on arrival or via the eVisa portal. A passport valid for at least six months is required.', 'A yellow fever certificate may be required if arriving from an endemic country. Antimalarials are recommended for safari regions — talk to your doctor.', 'TZS', 'Dodoma', 'live', 'published', true, 'Tanzania Travel Guide', 'Plan a Tanzania safari, Kilimanjaro climb or Zanzibar escape with local experts.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000402', 'Kenya', 'kenya', 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5', 'Kenya pairs the Masai Mara''s big-cat action and Great Migration river crossings with easy access from Nairobi and Indian Ocean beaches. Great value and dramatic wildlife make it a superb first or repeat safari.', array['July','August','September','October'], 'An eVisa (eTA) is required before travel for most nationalities. A passport valid for six months is required.', 'A yellow fever certificate may be required from endemic countries. Antimalarials are recommended for most safari areas.', 'KES', 'Nairobi', 'live', 'published', true, 'Kenya Travel Guide', 'Plan a Kenya safari and beach holiday with Goldfinch Adventures.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000403', 'Rwanda', 'rwanda', 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e', 'Rwanda offers world-class mountain gorilla trekking in Volcanoes National Park, green highland scenery and a polished, conservation-led experience — an easy, premium add-on to a safari.', array['June','July','August','September'], 'Visas are available on arrival or via the online portal for most nationalities. Gorilla permits must be booked well in advance.', 'A yellow fever certificate is required. Antimalarials are recommended for lower-altitude areas.', 'RWF', 'Kigali', 'live', 'published', true, 'Rwanda Travel Guide', 'Plan Rwanda gorilla trekking and highland travel with Goldfinch Adventures.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000404', 'Uganda', 'uganda', 'https://images.unsplash.com/photo-1502784444187-359ac186c5bb', 'Uganda is the adventurous choice — affordable gorilla trekking in Bwindi, chimpanzees in Kibale and classic savanna safari in Queen Elizabeth National Park, often combined in one trip.', array['June','July','August','September','December','January','February'], 'An eVisa is required before travel for most nationalities. The East Africa Tourist Visa covers Uganda, Kenya and Rwanda.', 'A yellow fever certificate is required. Antimalarials are recommended throughout.', 'UGX', 'Kampala', 'planned', 'published', false, 'Uganda Travel Guide', 'Plan Uganda gorilla trekking, chimps and safari with Goldfinch Adventures.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  hero_image_url = excluded.hero_image_url,
  intro_text = excluded.intro_text,
  best_months = excluded.best_months,
  visa_info = excluded.visa_info,
  health_info = excluded.health_info,
  currency = excluded.currency,
  capital = excluded.capital,
  phase = excluded.phase,
  status = excluded.status,
  is_featured = excluded.is_featured,
  seo_title = excluded.seo_title,
  meta_description = excluded.meta_description;

insert into lodges (id, name, slug, destination_id, accommodation_level, lodge_type, description, why_we_recommend, hero_image_url, image_url, price_per_night_from, currency, best_for, romantic_rating, family_rating, status, is_featured, meta_title, meta_description, created_by, updated_by)
values
  ('00000000-0000-4000-8000-000000000501', 'Serengeti Migration Camp', 'serengeti-migration-camp', '00000000-0000-4000-8000-000000000101', 'luxury', 'tented_camp', 'A classic luxury tented camp positioned for front-row Great Migration views, with spacious canvas suites and open-air dining under the stars.', 'We love it for migration season — the camp moves with the herds, so you wake up steps from the action without sacrificing comfort.', 'https://images.unsplash.com/photo-1504432842672-1a79f78e4084', 'https://images.unsplash.com/photo-1504432842672-1a79f78e4084', 650, 'USD', array['Couples','First safari','Migration'], 9.0, 7.5, 'published', true, 'Serengeti Migration Camp', 'A luxury tented camp built for Great Migration safaris in the Serengeti.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000502', 'Ngorongoro Crater Lodge', 'ngorongoro-crater-lodge', '00000000-0000-4000-8000-000000000101', 'ultra_luxury', 'lodge', 'Perched on the crater rim, this ultra-luxury lodge pairs dramatic views with butler service and richly decorated suites.', 'Unmatched for a once-in-a-lifetime stay — the crater-rim setting and service make it the most romantic address in northern Tanzania.', 'https://images.unsplash.com/photo-1516426122078-c23e76319801', 'https://images.unsplash.com/photo-1516426122078-c23e76319801', 1450, 'USD', array['Honeymoon','Special occasion','Crater'], 9.8, 6.5, 'published', true, 'Ngorongoro Crater Lodge', 'An ultra-luxury crater-rim lodge for honeymoons and special-occasion safaris.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000503', 'Mara Family Tented Lodge', 'mara-family-tented-lodge', '00000000-0000-4000-8000-000000000102', 'mid_range', 'tented_camp', 'A relaxed, family-friendly tented lodge in the Masai Mara with interconnecting tents, a pool, and a flexible game-drive schedule.', 'Our top pick for families — connecting tents, kid-friendly meals, and guides who are brilliant with first-time young safari-goers.', 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5', 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5', 320, 'USD', array['Families','Big cats','Value'], 6.5, 9.5, 'published', true, 'Mara Family Tented Lodge', 'A family-friendly Masai Mara tented lodge with connecting tents and a pool.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000504', 'Volcanoes Gorilla Retreat', 'volcanoes-gorilla-retreat', '00000000-0000-4000-8000-000000000103', 'luxury', 'lodge', 'A warm highland retreat at the foot of the Virunga volcanoes, with fireplaces, forest views, and easy access to gorilla-trek briefings.', 'Perfect base for gorilla trekking in Volcanoes National Park — cosy after a cold, muddy trek and minutes from the park gate.', 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e', 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e', 780, 'USD', array['Gorilla trekking','Couples','Highlands'], 8.5, 7.0, 'published', false, 'Volcanoes Gorilla Retreat', 'A luxury highland retreat for gorilla trekking in Rwanda''s Volcanoes National Park.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  destination_id = excluded.destination_id,
  accommodation_level = excluded.accommodation_level,
  lodge_type = excluded.lodge_type,
  description = excluded.description,
  why_we_recommend = excluded.why_we_recommend,
  hero_image_url = excluded.hero_image_url,
  image_url = excluded.image_url,
  price_per_night_from = excluded.price_per_night_from,
  currency = excluded.currency,
  best_for = excluded.best_for,
  romantic_rating = excluded.romantic_rating,
  family_rating = excluded.family_rating,
  status = excluded.status,
  is_featured = excluded.is_featured,
  meta_title = excluded.meta_title,
  meta_description = excluded.meta_description;

insert into activities (id, name, slug, destination_id, location_label, category, difficulty, description, why_we_recommend, highlights, hero_image_url, image_url, duration_label, price_from, currency, price_unit, badge, best_season, status, is_featured, meta_title, meta_description, created_by, updated_by)
values
  ('00000000-0000-4000-8000-000000000601', 'Hot Air Balloon Safari', 'hot-air-balloon-safari', '00000000-0000-4000-8000-000000000101', 'Serengeti National Park', 'adventure', 'easy', 'Drift silently over the Serengeti plains at dawn, watching wildlife wake below, then land to a champagne bush breakfast.', 'The single most magical add-on to a Serengeti safari — book it for at least one morning of your trip.', array['Sunrise over the plains','Champagne bush breakfast','Aerial wildlife views','Once-in-a-lifetime photos'], 'https://images.unsplash.com/photo-1507608616759-54f48f0af0ee', 'https://images.unsplash.com/photo-1507608616759-54f48f0af0ee', 'Approx. 1 hour in the air', 599, 'USD', 'Per person', 'Popular', array['June','July','August','September','October'], 'published', true, 'Hot Air Balloon Safari, Serengeti', 'Dawn balloon flight over the Serengeti with a bush breakfast.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000602', 'Ngorongoro Crater Game Drive', 'ngorongoro-crater-game-drive', '00000000-0000-4000-8000-000000000101', 'Ngorongoro Crater', 'wildlife', 'easy', 'A full day descending into the world''s largest intact caldera — a natural amphitheatre packed with lions, elephants, rhino and flamingos.', 'Your best single-day shot at the Big Five in one compact, scenic location.', array['Big Five in one day','Black rhino sightings','Flamingo-lined lakes','Picnic lunch on the crater floor'], 'https://images.unsplash.com/photo-1516426122078-c23e76319801', 'https://images.unsplash.com/photo-1516426122078-c23e76319801', 'Full day', 250, 'USD', 'Per person', null, array['June','July','August','September','October'], 'published', true, 'Ngorongoro Crater Game Drive', 'Full-day Big Five game drive on the Ngorongoro Crater floor.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000603', 'Mountain Gorilla Trek', 'mountain-gorilla-trek', '00000000-0000-4000-8000-000000000103', 'Volcanoes National Park', 'trekking', 'challenging', 'Hike through misty bamboo forest to spend a permitted hour with a habituated mountain gorilla family.', 'A profoundly moving wildlife encounter — limited permits make it exclusive, so plan well ahead.', array['One hour with a gorilla family','Expert trackers & guides','Limited daily permits','Stunning Virunga scenery'], 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e', 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e', 'Half to full day', 1500, 'USD', 'Per person (permit incl.)', 'Limited permits', array['June','July','August','September','December','January','February'], 'published', true, 'Mountain Gorilla Trek, Rwanda', 'Permitted hour with a mountain gorilla family in Volcanoes NP.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000604', 'Stone Town & Spice Tour', 'stone-town-spice-tour', '00000000-0000-4000-8000-000000000101', 'Zanzibar', 'cultural', 'easy', 'Wander the UNESCO-listed lanes of Stone Town and visit a working spice farm to taste and smell the island''s famous spices.', 'The perfect relaxed culture day to bookend a Zanzibar beach stay.', array['UNESCO Stone Town','Working spice farm','Local history & markets','Tropical fruit tasting'], 'https://images.unsplash.com/photo-1558998708-ce92a9c8da00', 'https://images.unsplash.com/photo-1558998708-ce92a9c8da00', 'Half day', 45, 'USD', 'Per person', null, array['June','July','August','September','October','December','January','February'], 'published', false, 'Stone Town & Spice Tour, Zanzibar', 'Guided Stone Town walk and Zanzibar spice farm visit.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000605', 'Masai Mara Big Cat Drive', 'masai-mara-big-cat-drive', '00000000-0000-4000-8000-000000000102', 'Masai Mara', 'wildlife', 'easy', 'Morning and afternoon game drives in the Mara''s open grasslands, the best place in Africa to see lion, cheetah and leopard.', 'Unbeatable for big-cat action and, in season, dramatic Mara River crossings.', array['Lion, cheetah & leopard','Great Migration crossings','Open-plain photography','Expert Maasai guides'], 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5', 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5', 'Full day', 180, 'USD', 'Per person', 'Popular', array['July','August','September','October'], 'published', false, 'Masai Mara Big Cat Game Drive', 'Full-day big-cat game drive in Kenya''s Masai Mara.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  destination_id = excluded.destination_id,
  location_label = excluded.location_label,
  category = excluded.category,
  difficulty = excluded.difficulty,
  description = excluded.description,
  why_we_recommend = excluded.why_we_recommend,
  highlights = excluded.highlights,
  hero_image_url = excluded.hero_image_url,
  image_url = excluded.image_url,
  duration_label = excluded.duration_label,
  price_from = excluded.price_from,
  currency = excluded.currency,
  price_unit = excluded.price_unit,
  badge = excluded.badge,
  best_season = excluded.best_season,
  status = excluded.status,
  is_featured = excluded.is_featured,
  meta_title = excluded.meta_title,
  meta_description = excluded.meta_description;

insert into trip_points (id, name, slug, destination_id, role, gateway_type, airport_code, description, transfer_info, hero_image_url, image_url, status, is_featured, sort_order, meta_title, meta_description, created_by, updated_by)
values
  ('00000000-0000-4000-8000-000000000701', 'Kilimanjaro International Airport', 'kilimanjaro-international-airport', '00000000-0000-4000-8000-000000000101', 'both', 'airport', 'JRO', 'The main gateway for northern Tanzania safaris and Kilimanjaro climbs, sitting between Arusha and Moshi.', 'Most Serengeti, Ngorongoro and Kilimanjaro trips start and end here. It is about a 45-minute transfer to Arusha; we arrange a private airport pick-up for every guest.', 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05', 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05', 'published', true, 1, 'Kilimanjaro International Airport (JRO)', 'JRO is the main gateway for northern Tanzania safaris and Kilimanjaro climbs.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000702', 'Arusha', 'arusha', '00000000-0000-4000-8000-000000000101', 'start', 'city', null, 'The safari capital of Tanzania and the usual starting town for the northern circuit.', 'Trips typically begin with a night in Arusha before driving or flying to the Serengeti. Transfers from JRO take around 45 minutes.', 'https://images.unsplash.com/photo-1523805009345-7448845a9e53', 'https://images.unsplash.com/photo-1523805009345-7448845a9e53', 'published', false, 2, 'Arusha — Tanzania''s safari capital', 'Arusha is the usual starting town for northern Tanzania safaris.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000703', 'Jomo Kenyatta International Airport', 'jomo-kenyatta-international-airport', '00000000-0000-4000-8000-000000000102', 'both', 'airport', 'NBO', 'Nairobi''s main international airport and the gateway to Kenya''s Masai Mara and beyond.', 'Kenya safaris start and end here. From Nairobi you connect by light aircraft to the Masai Mara (about 45 minutes) or drive (4-5 hours).', 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd', 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd', 'published', true, 3, 'Nairobi JKIA (NBO)', 'NBO is the gateway to Kenya''s Masai Mara and safari circuits.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000704', 'Kigali International Airport', 'kigali-international-airport', '00000000-0000-4000-8000-000000000103', 'both', 'airport', 'KGL', 'Rwanda''s clean, efficient gateway and the starting point for gorilla trekking in Volcanoes National Park.', 'Gorilla trips start and end in Kigali. It is roughly a 2.5-3 hour scenic drive to Volcanoes National Park, which we arrange privately.', 'https://images.unsplash.com/photo-1612257999691-1f0e3a2a0a3a', 'https://images.unsplash.com/photo-1612257999691-1f0e3a2a0a3a', 'published', false, 4, 'Kigali International Airport (KGL)', 'KGL is the gateway for Rwanda gorilla trekking in Volcanoes NP.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  destination_id = excluded.destination_id,
  role = excluded.role,
  gateway_type = excluded.gateway_type,
  airport_code = excluded.airport_code,
  description = excluded.description,
  transfer_info = excluded.transfer_info,
  hero_image_url = excluded.hero_image_url,
  image_url = excluded.image_url,
  status = excluded.status,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order,
  meta_title = excluded.meta_title,
  meta_description = excluded.meta_description;

-- Per-destination health & safety content (feeds the /safety hub).
update destinations set
  safety_overview = 'Tanzania is one of Africa''s most popular and well-trodden safari destinations, and travelling here with a reputable operator is very safe. Game drives are run by trained guides, and the main tourist areas are stable and welcoming.',
  health_vaccinations = 'A yellow fever certificate may be required if arriving from an endemic country. Antimalarial medication is recommended for safari areas — speak to your doctor 4-6 weeks before travel. Routine vaccinations should be up to date.',
  security_advice = 'Petty theft can occur in towns and cities, so keep valuables secure and use hotel safes. Safari camps and lodges are secure. Follow your guide''s instructions at all times during game viewing.',
  travel_insurance_note = 'Comprehensive travel insurance covering medical evacuation is mandatory on all our trips, especially for Kilimanjaro climbs and remote safari areas.',
  emergency_contacts = 'Your guide and our 24/7 in-country support line are your first point of contact. Tanzania emergency services: 112 (general) / 114 (police).'
where id = '00000000-0000-4000-8000-000000000101';

update destinations set
  safety_overview = 'Kenya is a long-established safari destination and the main wildlife areas are safe and well-managed. Travelling with a trusted operator and following local guidance makes for a smooth, secure trip.',
  health_vaccinations = 'A yellow fever certificate may be required from endemic countries. Antimalarials are recommended for most safari areas. Ensure routine vaccinations are current and carry any personal medication.',
  security_advice = 'Exercise normal precautions in Nairobi and Mombasa — avoid displaying valuables and use trusted transfers. Safari areas and beach resorts are secure. We follow up-to-date routing advice on all trips.',
  travel_insurance_note = 'Travel insurance including emergency medical evacuation is required on all our Kenya trips.',
  emergency_contacts = 'Your guide and our 24/7 support line handle any issue. Kenya emergency services: 999 / 112.'
where id = '00000000-0000-4000-8000-000000000102';

update destinations set
  safety_overview = 'Rwanda is widely regarded as one of the safest, cleanest and most welcoming countries in Africa. Gorilla trekking is highly regulated and conducted in small, guided groups.',
  health_vaccinations = 'A yellow fever certificate is required for entry. Antimalarials are recommended for lower-altitude areas. A good fitness level helps for the forest trek to the gorillas.',
  security_advice = 'Rwanda has very low crime levels and is comfortable for travellers. Follow ranger instructions during gorilla and primate treks, and keep the recommended distance from wildlife.',
  travel_insurance_note = 'Travel insurance with medical evacuation cover is required. Gorilla permits are non-refundable, so cancellation cover is strongly advised.',
  emergency_contacts = 'Your guide and our 24/7 support line are available throughout. Rwanda emergency services: 112.'
where id = '00000000-0000-4000-8000-000000000103';

insert into safety_topics (id, title, slug, category, icon, summary, content, status, is_featured, sort_order, meta_title, meta_description, created_by, updated_by)
values
  ('00000000-0000-4000-8000-000000000801', 'Is an African safari safe?', 'is-an-african-safari-safe', 'general', 'ShieldCheck', 'The short answer: yes. Travelling with a reputable operator in established safari regions is very safe.', 'Our destinations — Tanzania, Kenya and Rwanda — are well-established, stable safari countries. Game drives are led by trained, licensed guides, lodges and camps are secure, and we monitor conditions on every route. The vast majority of travellers have a completely trouble-free trip.', 'published', true, 1, 'Is an African safari safe?', 'Honest guidance on safety for safaris in Tanzania, Kenya and Rwanda.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000802', 'Health & vaccinations', 'health-and-vaccinations', 'health', 'HeartPulse', 'Yellow fever certificates, malaria prevention and routine vaccinations — what to plan before you travel.', 'Requirements vary by country and your route. A yellow fever certificate may be required, antimalarial medication is recommended for most safari areas, and routine vaccinations should be up to date. See your doctor or a travel clinic 4-6 weeks before departure, and we''ll confirm the specifics for your itinerary.', 'published', true, 2, 'Travel health & vaccinations for East Africa', 'Vaccination and malaria guidance for safaris in East Africa.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000803', 'Wildlife & game drives', 'wildlife-and-game-drives', 'wildlife', 'PawPrint', 'Wild animals are wild — a few simple rules keep game viewing safe and unforgettable.', 'Always follow your guide''s instructions, stay inside the vehicle unless told otherwise, keep noise down, and never feed or approach animals. On walking safaris and gorilla treks, keep the recommended distance. Our guides are trained to read animal behaviour and keep you safe.', 'published', false, 3, 'Wildlife safety on game drives', 'How to stay safe around wildlife on game drives and treks.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000804', 'Money, valuables & personal security', 'money-valuables-personal-security', 'security', 'Lock', 'Sensible precautions in towns and cities, plus secure lodges, keep your trip stress-free.', 'Petty theft can occur in busy urban areas, so keep valuables in hotel safes, avoid displaying expensive items, and use trusted transfers and guides. Safari camps, lodges and beach resorts are secure. We arrange private airport pick-ups so you''re looked after from arrival.', 'published', false, 4, 'Personal security on safari', 'Practical advice on valuables and personal security while travelling.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000805', 'Travel insurance', 'travel-insurance', 'practical', 'FileCheck', 'Comprehensive insurance with medical evacuation cover is mandatory on all our trips.', 'We require all travellers to hold travel insurance that includes emergency medical treatment and evacuation — essential for remote safari areas and Kilimanjaro climbs. We also strongly recommend cancellation cover, particularly where non-refundable gorilla permits are involved.', 'published', true, 5, 'Travel insurance for safaris', 'Why medical-evacuation travel insurance is required on our trips.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000806', '24/7 support while you travel', 'support-while-you-travel', 'general', 'Headset', 'You''re never on your own — your guide and our in-country team are reachable around the clock.', 'Every trip includes a dedicated guide and access to our 24/7 in-country support line. Whether it''s a flight change, a health question or a last-minute request, there''s always someone to help. We share all emergency contacts in your final travel pack before departure.', 'published', false, 6, '24/7 traveller support', 'Round-the-clock support from your guide and our in-country team.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')
on conflict (id) do update set
  title = excluded.title,
  slug = excluded.slug,
  category = excluded.category,
  icon = excluded.icon,
  summary = excluded.summary,
  content = excluded.content,
  status = excluded.status,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order,
  meta_title = excluded.meta_title,
  meta_description = excluded.meta_description;

insert into tour_categories (id, name, slug, description, status, sort_order)
values
  ('00000000-0000-4000-8000-000000000201', 'Safari', 'safari', 'Wildlife safari packages and private game drives.', 'published', 1),
  ('00000000-0000-4000-8000-000000000202', 'Beach Holiday', 'beach-holiday', 'Coastal and island travel packages.', 'published', 2),
  ('00000000-0000-4000-8000-000000000203', 'Kilimanjaro', 'kilimanjaro', 'Kilimanjaro climb routes, preparation, and mountain support.', 'published', 3)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  status = excluded.status,
  sort_order = excluded.sort_order;

insert into tours (id, title, slug, short_description, full_description, destination_id, category_id, duration_days, duration_nights, price_from, currency, main_image_url, difficulty_level, group_size_min, group_size_max, minimum_age, start_trip_point_id, end_trip_point_id, status, is_featured, is_popular, meta_title, meta_description, created_by, updated_by)
values
  ('00000000-0000-4000-8000-000000000301', 'Tanzania Confidence Safari', 'tanzania-confidence-safari', 'A guided Tanzania safari built around clear advice, wildlife timing, and lodge confidence.', 'Explore Serengeti and Ngorongoro with professional guides, comfortable lodges, and planning support that explains tradeoffs clearly.', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000201', 5, 4, 1850, 'USD', 'https://images.unsplash.com/photo-1516426122078-c23e76319801', 'Easy', 2, 12, 8, '00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000701', 'published', true, true, 'Tanzania Confidence Safari', 'Book a 5-day Tanzania safari with Goldfinch Adventures.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000302', 'Kenya Safari and Coast', 'kenya-safari-and-coast', 'A Kenya safari with a relaxed beach extension for travelers who want balance.', 'Combine Masai Mara wildlife planning with a soft landing on the Kenya coast.', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000202', 7, 6, 2400, 'USD', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e', 'Easy', 2, 10, 5, '00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000703', 'published', true, true, 'Kenya Safari and Coast', 'Book a Kenya safari and beach holiday with Goldfinch Adventures.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000303', 'Kilimanjaro Confidence Climb', 'kilimanjaro-confidence-climb', 'A Kilimanjaro planning starter for travelers who want honest route and readiness advice.', 'Climb Kilimanjaro with guides, mountain crew, meals, route support, and preparation guidance.', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000203', 6, 5, 2150, 'USD', 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5', 'Challenging', 1, 8, 12, '00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000701', 'published', false, false, 'Kilimanjaro Confidence Climb', 'Book a guided Kilimanjaro climb with Goldfinch Adventures.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')
on conflict (id) do update set
  title = excluded.title,
  slug = excluded.slug,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  destination_id = excluded.destination_id,
  category_id = excluded.category_id,
  duration_days = excluded.duration_days,
  duration_nights = excluded.duration_nights,
  price_from = excluded.price_from,
  currency = excluded.currency,
  main_image_url = excluded.main_image_url,
  difficulty_level = excluded.difficulty_level,
  group_size_min = excluded.group_size_min,
  group_size_max = excluded.group_size_max,
  minimum_age = excluded.minimum_age,
  start_trip_point_id = coalesce(tours.start_trip_point_id, excluded.start_trip_point_id),
  end_trip_point_id = coalesce(tours.end_trip_point_id, excluded.end_trip_point_id),
  status = excluded.status,
  is_featured = excluded.is_featured,
  is_popular = excluded.is_popular,
  meta_title = excluded.meta_title,
  meta_description = excluded.meta_description;

update tours set
  experience_type = 'Safari',
  persona_tags = array['family','wildlife','first-time'],
  budget_tier = 'Premium',
  highlights = array['Local guide advice','Wildlife timing explained','Lodge tradeoffs made clear'],
  sample_itinerary = '[{"day":1,"title":"Arrive and brief"},{"day":2,"title":"Game drive with guide"}]'::jsonb,
  is_available = true,
  seats_remaining = 4,
  seo_title = 'Tanzania Confidence Safari'
where slug = 'tanzania-confidence-safari';

update tours set
  experience_type = 'Beach Holiday',
  persona_tags = array['family','couples','relaxed'],
  budget_tier = 'Luxury',
  highlights = array['Safari and coast pairing','Advisor-reviewed pacing','Beach extension'],
  sample_itinerary = '[{"day":1,"title":"Safari arrival"},{"day":5,"title":"Coast extension"}]'::jsonb,
  is_available = true,
  seats_remaining = 8,
  seo_title = 'Kenya Safari and Coast'
where slug = 'kenya-safari-and-coast';

update tours set
  experience_type = 'Kilimanjaro',
  persona_tags = array['adventure','trekking','challenge'],
  budget_tier = 'Comfort',
  highlights = array['Route readiness advice','Mountain crew support','Preparation checklist'],
  sample_itinerary = '[{"day":1,"title":"Gate briefing"},{"day":2,"title":"Mountain hut climb"}]'::jsonb,
  is_available = true,
  seats_remaining = 6,
  seo_title = 'Kilimanjaro Confidence Climb'
where slug = 'kilimanjaro-confidence-climb';

insert into itinerary_days (tour_id, day_number, title, description)
values
  ('00000000-0000-4000-8000-000000000301', 1, 'Arrival and Briefing', 'Meet your guide and prepare for the safari.'),
  ('00000000-0000-4000-8000-000000000301', 2, 'Serengeti Game Drive', 'Full-day game drive across key wildlife areas.'),
  ('00000000-0000-4000-8000-000000000302', 1, 'Stone Town Arrival', 'Arrival, transfer, and guided Stone Town walk.'),
  ('00000000-0000-4000-8000-000000000302', 2, 'Beach Day', 'Relax at the beach with optional water activities.'),
  ('00000000-0000-4000-8000-000000000303', 1, 'Marangu Gate', 'Start the mountain climb and hike to Mandara Hut.'),
  ('00000000-0000-4000-8000-000000000303', 2, 'Horombo Hut', 'Continue through changing vegetation zones.')
on conflict (tour_id, day_number) do update set title = excluded.title, description = excluded.description;

insert into tour_inclusions (tour_id, title, sort_order)
values
  ('00000000-0000-4000-8000-000000000301', 'Professional safari guide', 1),
  ('00000000-0000-4000-8000-000000000301', 'Park fees', 2),
  ('00000000-0000-4000-8000-000000000302', 'Airport transfers', 1),
  ('00000000-0000-4000-8000-000000000303', 'Mountain guide and crew', 1);

insert into tour_exclusions (tour_id, title, sort_order)
values
  ('00000000-0000-4000-8000-000000000301', 'International flights', 1),
  ('00000000-0000-4000-8000-000000000302', 'Personal expenses', 1),
  ('00000000-0000-4000-8000-000000000303', 'Climbing gear rental', 1);

insert into tour_images (tour_id, image_url, alt_text, sort_order)
values
  ('00000000-0000-4000-8000-000000000301', 'https://images.unsplash.com/photo-1516426122078-c23e76319801', 'Serengeti wildlife safari', 1),
  ('00000000-0000-4000-8000-000000000302', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e', 'Kenya coast beach', 1),
  ('00000000-0000-4000-8000-000000000303', 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5', 'Kilimanjaro landscape', 1);

insert into available_dates (tour_id, start_date, end_date, available_slots, seats_available, status)
values
  ('00000000-0000-4000-8000-000000000301', current_date + interval '30 days', current_date + interval '34 days', 8, 8, 'available'),
  ('00000000-0000-4000-8000-000000000302', current_date + interval '21 days', current_date + interval '24 days', 12, 12, 'available'),
  ('00000000-0000-4000-8000-000000000303', current_date + interval '45 days', current_date + interval '50 days', 6, 6, 'available');

insert into testimonials (client_name, client_country, message, rating, status, is_featured, sort_order)
values
  ('Amelia Carter', 'United Kingdom', 'The safari planning was clear, organized, and easy to follow.', 5, 'published', true, 1),
  ('Daniel Kim', 'United States', 'Kenya was exactly the relaxed family trip we needed.', 5, 'published', true, 2),
  ('Asha Patel', 'Kenya', 'The team handled every detail before and during the climb.', 5, 'published', false, 3);

insert into faqs (question, answer, category, status, sort_order)
values
  ('Can I customize a tour?', 'Yes. The CMS and booking flow support custom itinerary requests.', 'booking', 'published', 1),
  ('Do prices include flights?', 'International flights are not included unless clearly listed in a package.', 'pricing', 'published', 2),
  ('Can I upload images from the CMS?', 'Yes. Supabase Storage uploads save metadata to the media library.', 'media', 'published', 3),
  ('Are payments supported?', 'The project includes payments-ready records and status fields for provider integration.', 'payments', 'published', 4),
  ('Can editors publish content?', 'Editors can create and edit. Publishing is controlled by permissions.', 'roles', 'published', 5);

insert into blog_categories (id, name, slug, description, status, sort_order)
values
  ('00000000-0000-4000-8000-000000000401', 'Safari Planning', 'safari-planning', 'Guides for wildlife travel planning.', 'published', 1),
  ('00000000-0000-4000-8000-000000000402', 'Beach Travel', 'beach-travel', 'Island and coastal travel tips.', 'published', 2),
  ('00000000-0000-4000-8000-000000000403', 'Trekking Guides', 'trekking-guides', 'Mountain travel preparation content.', 'published', 3)
on conflict (slug) do update set name = excluded.name, status = excluded.status;

insert into blog_posts (title, slug, excerpt, content, category_id, featured_image_url, author_name, status, meta_title, meta_description, published_at, created_by, updated_by)
values
  ('How to Plan a Serengeti Safari', 'how-to-plan-a-serengeti-safari', 'A short guide for choosing dates, routes, and lodges.', 'Use this starter article as a CMS placeholder for safari planning content.', '00000000-0000-4000-8000-000000000401', 'https://images.unsplash.com/photo-1516426122078-c23e76319801', 'Goldfinch Team', 'published', 'How to Plan a Serengeti Safari', 'Serengeti safari planning tips.', now(), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('Best Kenya Coast Experiences', 'best-kenya-coast-experiences', 'Ideas for coast, culture, and relaxed beach extensions.', 'Use this starter article as a CMS placeholder for Kenya beach content.', '00000000-0000-4000-8000-000000000402', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e', 'Goldfinch Team', 'published', 'Best Kenya Coast Experiences', 'Kenya coast travel ideas.', now(), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('Kilimanjaro Packing Basics', 'kilimanjaro-packing-basics', 'Starter packing guidance for a climb.', 'Use this starter article as a CMS placeholder for Kilimanjaro trekking content.', '00000000-0000-4000-8000-000000000403', 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5', 'Goldfinch Team', 'published', 'Kilimanjaro Packing Basics', 'Kilimanjaro packing basics.', now(), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')
on conflict (slug) do update set title = excluded.title, status = excluded.status;

insert into homepage_sections (section_key, title, subtitle, content, image_url, button_text, button_url, extra_data, status, is_active, sort_order)
values
  ('hero', 'Plan East Africa With Confidence', 'Honest safari, Kilimanjaro, gorilla trekking and beach advice from local experts.', null, '/images/surf-hero.jpg', 'Plan My Trip', '/plan-my-trip', '{"secondary_cta_text":"Talk to a Travel Advisor","secondary_cta_url":"/contact"}', 'published', true, 1),
  ('featured_tours', 'Goldfinch Tours', 'A curated list of trusted East Africa travel ideas.', null, null, 'View All Tours', '/tours', '{}', 'published', true, 2),
  ('featured_destinations', 'Destinations', 'Explore the regions our local experts know best.', null, null, 'Browse Destinations', '/destinations', '{}', 'published', true, 3),
  ('why_choose_us', 'Why Travel With Goldfinch', 'Local experts, honest advice, and confidence at every step.', 'We help travelers plan East Africa with clarity and trust — no guesswork, just honest guidance from people who live and travel here every day.', null, null, null, '{}', 'published', true, 4),
  ('testimonials', 'What Our Travelers Say', 'Real stories from guests who travelled with confidence.', null, null, null, null, '{}', 'published', true, 5),
  ('ai_advisor_cta', 'Meet Your Goldfinch AI Travel Advisor', 'Get instant, honest answers and a tailored plan in minutes.', null, null, 'Talk to a Travel Advisor', '/plan-my-trip', '{}', 'published', true, 6),
  ('final_cta', 'Ready to Plan Your East Africa Adventure?', 'Talk to a local expert and travel with confidence.', null, null, 'Plan My Trip', '/plan-my-trip', '{}', 'published', true, 7),
  -- Partner / company logo strip. Logos are managed in Admin → Homepage →
  -- "Trusted by leading travel partners"; add transparent PNG/SVG assets there.
  ('partners', 'Trusted by leading travel partners', 'Airlines, lodges, hotels and travel platforms you work with to plan with confidence.', null, null, null, null, '{"logos":[]}', 'published', true, 8),
  -- Image slider shown on the admin login screen. Managed in Admin → Homepage → "login_slider".
  ('login_slider', 'Login slider', 'Image slides shown on the admin login screen.', null, null, null, null, '{"slides":[{"image_url":"https://images.unsplash.com/photo-1516426122078-c23e76319801","title":"Plan East Africa with confidence","subtitle":"Honest safari, Kilimanjaro and beach advice from local experts."},{"image_url":"https://images.unsplash.com/photo-1516026672322-bc52d61a55d5","title":"Travel is the journey of a lifetime","subtitle":"Tailored adventures across Tanzania, Kenya and Rwanda."}]}', 'published', true, 9),
  -- "What trips typically cost" band on the homepage. Edit rows in Admin → Homepage → "cost_ranges".
  ('cost_ranges', 'What trips typically cost', 'A confident brand is upfront about price — here are honest starting points by trip type.', null, null, null, null, '{"ranges":[{"label":"Safari","from":"from $1,500","note":"Guiding, park fees & lodges"},{"label":"Kilimanjaro","from":"from $1,900","note":"Guides, crew, meals & route support"},{"label":"Zanzibar beach","from":"from $850","note":"Beach stays & transfers"},{"label":"Gorilla trekking","from":"from $2,400","note":"Includes the gorilla permit"}]}', 'published', true, 10)
on conflict (section_key) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  content = excluded.content,
  image_url = excluded.image_url,
  button_text = excluded.button_text,
  button_url = excluded.button_url,
  extra_data = excluded.extra_data,
  status = excluded.status,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

insert into website_settings (setting_key, setting_value, setting_group, setting_type, is_public, description) values
  -- Brand
  ('site_name', '"Goldfinch Adventures"', 'brand', 'text', true, 'Public website name.'),
  ('company_name', '"Goldfinch Adventures Limited"', 'brand', 'text', true, 'Registered company name.'),
  ('tagline', '"Africa''s Most Trusted Travel Planning Brand"', 'brand', 'text', true, 'Brand tagline.'),
  ('brand_statement', '"Travelers do not need more options. They need more confidence."', 'brand', 'textarea', true, 'Brand positioning statement.'),
  ('logo_url', '""', 'brand', 'image', true, 'Public logo image URL.'),
  ('favicon_url', '""', 'brand', 'image', true, 'Favicon image URL.'),
  ('primary_color', '"#1f4d3a"', 'brand', 'color', true, 'Primary brand color.'),
  ('secondary_color', '"#0F2F24"', 'brand', 'color', true, 'Secondary brand color.'),
  ('accent_color', '"#D9A441"', 'brand', 'color', true, 'Accent brand color.'),
  -- Contact
  ('contact_email', '"hello@goldfinch.local"', 'contact', 'email', true, 'Public contact email.'),
  ('contact_phone', '"+255 700 000 000"', 'contact', 'phone', true, 'Public contact phone.'),
  ('whatsapp_number', '"+255 700 000 000"', 'contact', 'phone', true, 'WhatsApp number.'),
  ('office_address', '""', 'contact', 'text', true, 'Office street address.'),
  ('city', '"Arusha"', 'contact', 'text', true, 'Office city.'),
  ('country', '"Tanzania"', 'contact', 'text', true, 'Office country.'),
  ('google_maps_url', '""', 'contact', 'url', true, 'Google Maps location URL.'),
  ('business_hours', '"Mon–Sat, 8am–6pm EAT"', 'contact', 'text', true, 'Business operating hours.'),
  -- Social
  ('facebook_url', '""', 'social', 'url', true, 'Facebook page URL.'),
  ('instagram_url', '""', 'social', 'url', true, 'Instagram profile URL.'),
  ('youtube_url', '""', 'social', 'url', true, 'YouTube channel URL.'),
  ('tiktok_url', '""', 'social', 'url', true, 'TikTok profile URL.'),
  ('linkedin_url', '""', 'social', 'url', true, 'LinkedIn page URL.'),
  ('tripadvisor_url', '""', 'social', 'url', true, 'TripAdvisor URL.'),
  -- SEO
  ('default_meta_title', '"Goldfinch Adventures | East Africa Travel Planning"', 'seo', 'text', true, 'Default SEO meta title.'),
  ('default_meta_description', '"Plan safaris, Kilimanjaro climbs, gorilla trekking and beach holidays across East Africa with trusted local experts."', 'seo', 'textarea', true, 'Default SEO meta description.'),
  ('default_og_image_url', '""', 'seo', 'image', true, 'Default Open Graph share image.'),
  ('canonical_base_url', '""', 'seo', 'url', true, 'Canonical base URL of the site.'),
  ('robots_indexing_enabled', 'true', 'seo', 'boolean', true, 'Allow search engines to index the site.'),
  -- Booking
  ('booking_enabled', 'true', 'booking', 'boolean', true, 'Enable booking request submissions.'),
  ('booking_success_message', '"Thank you. Your trip request has been received. A Goldfinch travel specialist will contact you shortly."', 'booking', 'textarea', true, 'Message shown after a booking request.'),
  ('default_response_time_message', '"We typically respond within 24 hours."', 'booking', 'text', true, 'Expected response time message.'),
  ('require_phone_number', 'false', 'booking', 'boolean', true, 'Require phone number on booking forms.'),
  ('allow_general_plan_my_trip', 'true', 'booking', 'boolean', true, 'Allow general Plan My Trip requests without a tour.'),
  -- Currencies
  ('default_currency', '"USD"', 'currencies', 'select', true, 'Default display currency for visitors who have not selected one.'),
  ('supported_currencies', '[
    {"code":"USD","name":"US Dollar","symbol":"$","locale":"en-US","decimalDigits":2,"enabled":true},
    {"code":"EUR","name":"Euro","symbol":"€","locale":"de-DE","decimalDigits":2,"enabled":true},
    {"code":"GBP","name":"British Pound","symbol":"£","locale":"en-GB","decimalDigits":2,"enabled":true},
    {"code":"TZS","name":"Tanzanian Shilling","symbol":"TSh","locale":"sw-TZ","decimalDigits":0,"enabled":true},
    {"code":"KES","name":"Kenyan Shilling","symbol":"KSh","locale":"en-KE","decimalDigits":0,"enabled":true},
    {"code":"ZAR","name":"South African Rand","symbol":"R","locale":"en-ZA","decimalDigits":2,"enabled":true},
    {"code":"AUD","name":"Australian Dollar","symbol":"A$","locale":"en-AU","decimalDigits":2,"enabled":true},
    {"code":"CAD","name":"Canadian Dollar","symbol":"CA$","locale":"en-CA","decimalDigits":2,"enabled":true}
  ]', 'currencies', 'json', false, 'CMS-managed supported display currencies for exchange-rate fetching and frontend selection.'),
  -- WhatsApp
  ('whatsapp_enabled', 'true', 'whatsapp', 'boolean', true, 'Enable the WhatsApp CTA.'),
  ('whatsapp_button_text', '"Chat on WhatsApp"', 'whatsapp', 'text', true, 'WhatsApp button label.'),
  ('whatsapp_default_message', '"Hello Goldfinch, I would like help planning a trip."', 'whatsapp', 'textarea', true, 'Pre-filled WhatsApp message.'),
  ('whatsapp_display_pages', '["home","tours","contact"]', 'whatsapp', 'json', true, 'Pages where the WhatsApp CTA appears.'),
  -- AI Advisor
  ('ai_enabled', 'true', 'ai', 'boolean', true, 'Enable the AI travel advisor.'),
  ('ai_widget_enabled', 'true', 'ai', 'boolean', true, 'Show the AI chat widget on the public site.'),
  ('ai_display_name', '"Goldfinch AI Travel Advisor"', 'ai', 'text', true, 'AI assistant display name.'),
  ('ai_intro_message', '"Hi, I am the Goldfinch AI Travel Advisor. I can help you plan the right East Africa trip based on who is travelling, your timing, budget and comfort level."', 'ai', 'textarea', true, 'AI intro message.'),
  ('ai_handoff_message', '"Let me connect you with a Goldfinch travel specialist."', 'ai', 'textarea', true, 'AI human-handoff message.'),
  ('ai_status_label', '"Online"', 'ai', 'text', true, 'AI status label.'),
  -- HubSpot (admin-only status indicators — token stays in .env)
  ('hubspot_enabled', 'false', 'hubspot', 'boolean', false, 'HubSpot integration enabled flag.'),
  ('hubspot_sync_enabled', 'false', 'hubspot', 'boolean', false, 'Sync new leads/bookings to HubSpot.'),
  ('hubspot_pipeline_name', '"Sales Pipeline"', 'hubspot', 'text', false, 'Target HubSpot pipeline name.'),
  -- Analytics
  ('ga4_measurement_id', '""', 'analytics', 'text', true, 'Google Analytics 4 measurement ID.'),
  ('gsc_verification_code', '""', 'analytics', 'text', true, 'Google Search Console verification code.'),
  ('enable_cookie_notice', 'true', 'analytics', 'boolean', true, 'Show a cookie consent notice.'),
  -- Legal
  ('privacy_policy_url', '""', 'legal', 'url', true, 'Privacy policy URL.'),
  ('terms_url', '""', 'legal', 'url', true, 'Terms & conditions URL.'),
  ('cancellation_policy_url', '""', 'legal', 'url', true, 'Cancellation policy URL.'),
  ('data_retention_notice', '""', 'legal', 'textarea', true, 'Data retention notice text.'),
  -- General (infrastructure)
  ('storage_bucket', '"goldfinch-media"', 'general', 'text', false, 'Supabase Storage bucket for CMS uploads.')
on conflict (setting_key) do update set
  setting_group = excluded.setting_group,
  setting_type = excluded.setting_type,
  description = excluded.description;

insert into admin_users (full_name, email, password_hash, role, is_active, deleted_at)
values (
  'Pastory Joseph',
  'pastory56@gmail.com',
  '$2a$12$CylUu5yBD7NCj2uu5dvdvujscWMAju8gtVm4kBHya56LLjmad668O',
  'super_admin',
  true,
  null
)
on conflict (email) do update set
  role = 'super_admin',
  is_active = true,
  deleted_at = null,
  updated_at = now();

-- Default admin login:
-- Email: admin@goldfinch.local
-- Password: Admin12345!
-- Promoted super admin:
-- Email: pastory56@gmail.com
-- Password for newly inserted account: Admin12345!
-- Password hash generated with bcryptjs:
-- node -e "const bcrypt=require('bcryptjs'); console.log(bcrypt.hashSync('Admin12345!', 12));"

-- =====================================================================
-- "Finished" content for Experiences, Destination Scores, Travel Styles
-- and Comparisons (formerly static frontend config). Runs after the
-- destinations and tour_categories inserts above.
-- =====================================================================

-- Experience enrichment on tour categories (who it's for / fitness / highlights).
update tour_categories set
  who_its_for = 'First-timers, families and photographers — anyone who wants the iconic East Africa wildlife experience.',
  fitness = 'Easy — game drives, no walking required.',
  highlights = array['The Great Migration','Big Five game viewing','Ngorongoro Crater','Sunsets on the plains']
where slug = 'safari';

update tour_categories set
  who_its_for = 'Active travellers ready for a multi-day high-altitude trek to the roof of Africa.',
  fitness = 'Challenging — good fitness and proper acclimatisation needed.',
  highlights = array['Uhuru Peak (5,895m)','Machame & Marangu routes','Glaciers & alpine desert','Expert mountain crew']
where slug = 'kilimanjaro';

update tour_categories set
  who_its_for = 'Couples, honeymooners and families wanting to unwind — the perfect safari finale.',
  fitness = 'Easy — pure relaxation.',
  highlights = array['Zanzibar white-sand beaches','Spice tours & Stone Town','Snorkelling & dhow cruises','Safari + beach combos']
where slug = 'beach-holiday';

-- Destination scores (1-10 honest ratings + indicative budget).
update destinations set score_wildlife = 10, score_luxury = 9, score_family = 8, score_photography = 10, score_adventure = 9, score_budget_from = 1500
where id = '00000000-0000-4000-8000-000000000101';
update destinations set score_wildlife = 9, score_luxury = 8, score_family = 8, score_photography = 9, score_adventure = 8, score_budget_from = 1300
where id = '00000000-0000-4000-8000-000000000102';
update destinations set score_wildlife = 7, score_luxury = 9, score_family = 6, score_photography = 8, score_adventure = 8, score_budget_from = 2400
where id = '00000000-0000-4000-8000-000000000103';

-- Travel styles (persona-led landing pages).
insert into travel_styles (id, name, slug, emotional_promise, description, desires, concerns, persona, status, is_featured, sort_order, meta_description, created_by, updated_by)
values
  ('00000000-0000-4000-8000-000000000901', 'Honeymoon', 'honeymoon', 'The most romantic start to forever', 'Private moments, sundowners and barefoot beach time — a safari by day and romance by night, planned so you never think about logistics.', array['Private, intimate camps','Safari + Zanzibar combinations','Special-occasion touches','Effortless, handled planning'], array['Will it feel romantic, not rushed?','Best beach to pair with safari','Privacy at lodges'], 'couple', 'published', true, 1, 'Plan a romantic honeymoon safari and Zanzibar escape with Goldfinch Adventures.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000902', 'Family Travel', 'family-travel', 'The trip your kids will never forget', 'Safaris paced for children — shorter drives, safe family lodges, and guides who turn young travellers into wide-eyed explorers.', array['Kid-friendly pace & rooms','Big Five without long drives','Flexible meals & downtime','Educational, hands-on moments'], array['Is it safe for children?','Malaria and health','Will younger kids cope?'], 'family', 'published', true, 2, 'Plan a family safari in East Africa, paced and priced for children.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000903', 'Luxury Travel', 'luxury-travel', 'Africa at its most effortless and exclusive', 'The finest camps, private guiding and seamless transfers — every detail anticipated so all you do is experience it.', array['Ultra-luxury lodges & camps','Private vehicles & guides','Light-aircraft transfers','Total discretion'], array['Is the lodge genuinely top-tier?','Privacy & exclusivity','Seamless connections'], null, 'published', false, 3, 'Plan a luxury East Africa safari with the finest camps and private guiding.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000904', 'Photography', 'photography', 'Be in the right place at the right light', 'Itineraries built around golden hours, wildlife density and vehicle access — with guides who understand a photographer''s patience.', array['Prime light & positioning','Time at sightings, not rushing','Bean bags & vehicle space','Migration & predator timing'], array['Will the guide wait for the shot?','Best season for my subjects','Gear handling on safari'], null, 'published', false, 4, 'Plan a photography safari built around light, wildlife density and access.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000905', 'Group Travel', 'group-travel', 'One shared adventure, every detail handled', 'Friends, celebrations or reunions — a single coordinated plan with fair group pricing and everyone looked after.', array['Fair group pricing & rooming','One coordinated itinerary','Range of fitness levels','Celebration-ready moments'], array['Keeping everyone together','Mixed budgets & interests','Rooming logistics'], 'group', 'published', false, 5, 'Plan a group safari with one coordinated itinerary and fair group pricing.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000906', 'Solo Travel', 'solo-travel', 'Go it alone, with confidence', 'Trusted guides, sociable scheduled departures and honest safety advice — independence without the worry.', array['Safety & trusted guides','Optional group departures','No single-supplement surprises','Flexible, independent pace'], array['Is it safe to travel solo?','Will I feel isolated?','Single-supplement cost'], 'solo', 'published', false, 6, 'Plan a solo safari with trusted guides and sociable scheduled departures.', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')
on conflict (id) do update set
  name = excluded.name, slug = excluded.slug, emotional_promise = excluded.emotional_promise,
  description = excluded.description, desires = excluded.desires, concerns = excluded.concerns,
  persona = excluded.persona, status = excluded.status, is_featured = excluded.is_featured,
  sort_order = excluded.sort_order, meta_description = excluded.meta_description;

-- Comparisons (decision-stage "X vs Y" pages).
insert into comparisons (id, title, slug, eyebrow, intro, a_name, a_image_url, b_name, dimensions, verdict, cta_label, cta_href, faqs, status, is_featured, sort_order, created_by, updated_by)
values
  ('00000000-0000-4000-8000-000000000a01', 'Tanzania vs Kenya Safari', 'tanzania-vs-kenya-safari', 'Safari comparison', 'Both are world-class — and very different in feel. Here is an honest look at how a Tanzania safari compares to Kenya, so you can pick the right one (or do both).', 'Tanzania', 'https://images.unsplash.com/photo-1516426122078-c23e76319801', 'Kenya',
   '[{"label":"Signature wildlife","a":"Serengeti holds the Great Migration for most of the year; Ngorongoro Crater for incredible density.","b":"Masai Mara delivers the dramatic Mara River crossings (roughly Jul–Oct)."},{"label":"Cost","a":"Higher park fees — a more premium, exclusive feel.","b":"Often better value, with more mid-range options."},{"label":"Crowds","a":"The vast Serengeti spreads vehicles out.","b":"The Mara can get busy at peak crossing time."},{"label":"Getting there","a":"Fly into Kilimanjaro (JRO), safari from Arusha.","b":"Nairobi (NBO) is a major, well-connected hub."},{"label":"Beach add-on","a":"Zanzibar — arguably the best safari + beach combo in Africa.","b":"Diani and the Kenyan coast."},{"label":"Best for","a":"First-timers wanting the iconic, bucket-list trip.","b":"Value-seekers and the Mara crossing spectacle."}]'::jsonb,
   'For a first safari with the iconic Serengeti and a Zanzibar beach finish, choose Tanzania. If value and the Mara river crossings (Jul–Oct) matter most, Kenya is hard to beat. Plenty of travellers combine both — and we are happy to plan that.', 'Plan a Tanzania or Kenya safari', '/plan-my-trip?experience=safari',
   '[{"q":"Can I visit both Tanzania and Kenya in one trip?","a":"Yes — a combined Serengeti + Masai Mara itinerary is popular and we can route it smoothly. It works best across 10+ days."},{"q":"Which is safer?","a":"Both are well-established safari destinations with strong tourism infrastructure. We plan around trusted lodges, guides and routes in either country."}]'::jsonb,
   'published', true, 1, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000a02', 'Serengeti vs Masai Mara', 'serengeti-vs-masai-mara', 'Park comparison', 'They are two halves of the same ecosystem — the migration moves between them. Here is how the Serengeti (Tanzania) and the Masai Mara (Kenya) actually differ.', 'Serengeti', null, 'Masai Mara',
   '[{"label":"Size & space","a":"Enormous (~15,000 km²) — endless plains, fewer vehicles per sighting.","b":"Compact and game-dense — more action in a smaller area."},{"label":"Migration timing","a":"Calving in the south (Jan–Mar); central/northern movement mid-year.","b":"The famous river crossings, roughly Jul–Oct."},{"label":"Predators","a":"Big lion prides, cheetah on the plains.","b":"Exceptional big-cat viewing in a concentrated area."},{"label":"Cost","a":"Higher park fees.","b":"Often more affordable."},{"label":"Pace","a":"Longer drives between areas — feels remote and wild.","b":"Shorter drives, quicker sightings."}]'::jsonb,
   'Want space, fewer crowds and the full migration story across the year? Serengeti. Want the river-crossing drama and dense big-cat action in a shorter trip? Masai Mara. We will match the park to your travel month.', 'Plan a migration safari', '/plan-my-trip?experience=safari', '[]'::jsonb,
   'published', false, 2, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000a03', 'Uganda vs Rwanda Gorilla Trekking', 'uganda-vs-rwanda-gorilla-trekking', 'Gorilla trekking comparison', 'Both offer life-changing time with mountain gorillas. The honest differences come down to permit cost, trek difficulty and how you combine the trip.', 'Uganda', null, 'Rwanda',
   '[{"label":"Permit cost","a":"More affordable — better value for the same experience.","b":"Premium permit price — a more exclusive, polished experience."},{"label":"Getting there","a":"Longer drive from Entebbe to Bwindi (or a short flight).","b":"Quick ~2–3 hr drive from Kigali to Volcanoes NP."},{"label":"Trek difficulty","a":"Bwindi can be steep and demanding.","b":"Often slightly more accessible terrain."},{"label":"Combine with","a":"Chimps (Kibale), savanna safari (Queen Elizabeth NP).","b":"A short, seamless add-on to a Tanzania/Kenya safari."}]'::jsonb,
   'On a budget, or want to pair gorillas with chimps and a savanna safari? Uganda. Short on time and want the quickest, most polished gorilla add-on (often after a safari)? Rwanda. Either way, permits must be secured early.', 'Plan gorilla trekking', '/plan-my-trip?experience=gorilla', '[]'::jsonb,
   'published', false, 3, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')
on conflict (id) do update set
  title = excluded.title, slug = excluded.slug, eyebrow = excluded.eyebrow, intro = excluded.intro,
  a_name = excluded.a_name, a_image_url = excluded.a_image_url, b_name = excluded.b_name,
  dimensions = excluded.dimensions, verdict = excluded.verdict, cta_label = excluded.cta_label,
  cta_href = excluded.cta_href, faqs = excluded.faqs, status = excluded.status,
  is_featured = excluded.is_featured, sort_order = excluded.sort_order;
