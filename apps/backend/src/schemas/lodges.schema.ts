import { z } from 'zod';

const statusSchema = z.enum(['draft', 'published', 'hidden', 'archived']);
const optionalUrl = z.union([z.string().url(), z.literal('')]).optional().nullable();

// East African Community members; kept in step with apps/frontend/src/lib/countries.ts.
export const EAST_AFRICA_COUNTRIES = ['Tanzania', 'Kenya', 'Uganda', 'Rwanda', 'Burundi', 'South Sudan', 'Democratic Republic of the Congo', 'Somalia'] as const;

export const lodgeCreateSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).optional(),
  destination_id: z.union([z.string().uuid(), z.literal('')]).optional().nullable(),
  accommodation_level: z.enum(['BUDGET', 'MID_RANGE', 'LUXURY', 'PREMIUM_LUXURY']).default('MID_RANGE'),
  lodge_type: z.enum(['HOTEL','SAFARI_LODGE','TENTED_CAMP','MOBILE_CAMP','BEACH_RESORT','VILLA','GUEST_HOUSE','ECO_LODGE','BOUTIQUE_HOTEL']).default('SAFARI_LODGE'),
  short_description: z.string().max(500).optional().nullable(),
  country: z.enum(EAST_AFRICA_COUNTRIES).optional().nullable(),
  region: z.string().max(120).optional().nullable(),
  park_area: z.string().max(160).optional().nullable(),
  settings: z.array(z.enum(['INSIDE_NATIONAL_PARK','OUTSIDE_NATIONAL_PARK','CONSERVATION_AREA','PRIVATE_RESERVE','BEACHFRONT','ISLAND','CITY','COUNTRYSIDE','MOUNTAIN','REMOTE_WILDERNESS'])).max(10).optional(),
  recommended_nights: z.coerce.number().int().min(1).max(30).optional().nullable(),
  best_months: z.array(z.string().max(20)).max(12).optional(),
  description: z.string().optional().nullable(),
  why_we_recommend: z.string().optional().nullable(),
  hero_image_url: optionalUrl,
  image_url: optionalUrl,
  mobile_hero_image_url: optionalUrl,
  social_image_url: optionalUrl,
  price_per_night_from: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.string().min(3).max(3).default('USD'),
  best_for: z.array(z.enum(['COUPLES','HONEYMOON','FAMILIES','GROUPS','SOLO_TRAVELERS','SENIORS','LUXURY_TRAVELERS','ADVENTURE_TRAVELERS','PHOTOGRAPHERS'])).optional(),
  google_maps_url: optionalUrl,
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  nearest_airport: z.string().max(180).optional().nullable(),
  transfer_time: z.string().max(120).optional().nullable(),
  distance_airstrip: z.string().max(120).optional().nullable(),
  distance_park_gate: z.string().max(120).optional().nullable(),
  road_accessibility: z.enum(['ALL_VEHICLES','FOUR_BY_FOUR_RECOMMENDED','FOUR_BY_FOUR_REQUIRED','SEASONAL_ACCESS','FLY_IN_ONLY']).optional().nullable(),
  fly_in_available: z.coerce.boolean().optional(),
  transfer_available: z.coerce.boolean().optional(),
  children_allowed: z.coerce.boolean().optional().nullable(),
  minimum_child_age: z.coerce.number().int().min(0).max(18).optional().nullable(),
  family_friendly: z.coerce.boolean().optional().nullable(),
  honeymoon_friendly: z.coerce.boolean().optional().nullable(),
  accessibility: z.enum(['FULLY_ACCESSIBLE','PARTIALLY_ACCESSIBLE','NOT_ACCESSIBLE','UNKNOWN']).optional().nullable(),
  electricity_availability: z.enum(['TWENTY_FOUR_HOURS','LIMITED_HOURS','SOLAR_ONLY','GENERATOR_BACKUP','NO_RELIABLE_POWER']).optional().nullable(),
  wifi_availability: z.enum(['PROPERTY_WIDE','COMMON_AREAS_ONLY','ROOMS_ONLY','LIMITED','NOT_AVAILABLE']).optional().nullable(),
  mobile_networks: z.array(z.enum(['VODACOM','AIRTEL','TIGO','HALOTEL','TTCL','OTHER','NO_RELIABLE_SIGNAL'])).optional(),
  wheelchair_accessible: z.coerce.boolean().optional().nullable(),
  show_rates_publicly: z.coerce.boolean().optional(),
  show_property_publicly: z.coerce.boolean().optional(),
  arrival_instructions: z.string().optional().nullable(),
  traveler_notes: z.string().optional().nullable(),
  romantic_rating: z.coerce.number().min(0).max(10).optional().nullable(),
  family_rating: z.coerce.number().min(0).max(10).optional().nullable(),
  website_url: optionalUrl,
  status: statusSchema.default('draft'),
  is_featured: z.coerce.boolean().default(false),
  seo_title: z.string().optional().nullable(),
  meta_title: z.string().optional().nullable(),
  meta_description: z.string().optional().nullable()
  ,indexable: z.coerce.boolean().optional()
});

export const lodgeUpdateSchema = lodgeCreateSchema.partial();
