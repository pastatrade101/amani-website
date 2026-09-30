/** Public fields from the existing Express controllers and Zod schemas. */
export type Paginated<T> = {
	items: T[];
	pagination: { page: number; limit: number; total: number; totalPages: number };
};
export type HomepageSection = {
	section_key: string;
	is_active?: boolean;
	title?: string | null;
	subtitle?: string | null;
	content?: string | null;
	image_url?: string | null;
	button_text?: string | null;
	button_url?: string | null;
	extra_data?: Record<string, unknown>;
	sort_order?: number;
};
export type Destination = {
	id: string;
	name: string;
	slug: string;
	country?: string;
	region?: string | null;
	short_description?: string | null;
	description?: string | null;
	main_image_url?: string | null;
	image_url?: string | null;
	banner_image_url?: string | null;
	main_image_url_thumbnail?: string;
	image_url_thumbnail?: string;
};
export type Activity = {
	id: string;
	name: string;
	slug: string;
	description?: string | null;
	image_url?: string | null;
	hero_image_url?: string | null;
	image_url_thumbnail?: string;
	hero_image_url_thumbnail?: string;
	category?: string;
};
export type Category = { id: string; name: string; slug: string };

export type SafariStyleKey = 'budget' | 'midrange' | 'luxury';

/** Computed by the API from a tour's active per-person price seasons. */
export type TourPricingSummary = {
	/** Styles with at least one bookable or on-request price, Budget → Luxury. */
	styles: SafariStyleKey[];
	/** Lowest fixed per-person price across those styles, null when all are on request. */
	from: number | null;
	currency: string | null;
};

export type TourDestinationLink = {
	destination_id: string;
	sort_order: number;
	is_primary: boolean;
	destinations?: { id: string; name: string; slug: string; country?: string } | null;
};

export type Tour = {
	id: string;
	title: string;
	slug: string;
	short_description?: string | null;
	duration_days: number;
	duration_nights?: number | null;
	price_from?: number | string | null;
	currency: string;
	main_image_url?: string | null;
	main_image_url_thumbnail?: string;
	banner_image_url?: string | null;
	budget_tier?: string | null;
	highlights?: string[] | null;
	group_size_min?: number | null;
	group_size_max?: number | null;
	start_location?: string | null;
	end_location?: string | null;
	is_featured?: boolean;
	destinations?: { name: string; slug: string; country?: string } | null;
	tour_destinations?: TourDestinationLink[] | null;
	tour_categories?: { name: string; slug: string } | null;
	pricing_summary?: TourPricingSummary | null;
};

/** A lodge as it appears inside an itinerary day. */
export type StayLodge = {
	id: string;
	name: string;
	slug: string;
	lodge_type?: string | null;
	accommodation_level?: string | null;
	hero_image_url?: string | null;
	image_url?: string | null;
	status?: string | null;
	/** With status 'published', the stay has a public page at /stays/{slug}. */
	show_property_publicly?: boolean | null;
};

/** Where travellers sleep on a day, for one safari style. */
export type DayStay = {
	safari_style: SafariStyleKey;
	lodge_id?: string | null;
	/** Free-text name, used when the property is not in the CMS. */
	accommodation?: string | null;
	lodge?: StayLodge | null;
};

export type ItineraryDay = {
	id: string;
	day_number: number;
	title: string;
	/** One-line summary under the day title. */
	summary?: string | null;
	/** Sanitised rich text. */
	description?: string | null;
	destination_id?: string | null;
	destination?: { id: string; name: string; slug: string } | null;
	travel_mode?: 'DRIVE' | 'FLY' | 'BOAT' | null;
	meals?: string | null;
	activities?: string | null;
	image_url?: string | null;
	/** Day photos, first is the lead photo. The page shows up to three. */
	image_urls?: string[] | null;
	stays?: DayStay[] | null;
	/** Legacy single stay, kept for older days without per-style stays. */
	accommodation?: string | null;
	lodge?: StayLodge | null;
};

export type TourPricingSeasonPublic = {
	id: string;
	safari_style?: SafariStyleKey | null;
	season_type: 'STANDARD_SEASON' | 'PEAK_SEASON' | 'CUSTOM';
	season_name: string;
	start_date?: string | null;
	end_date?: string | null;
	currency: string;
	pricing_basis: 'PER_PERSON' | 'PER_GROUP';
	status: 'ACTIVE' | 'INACTIVE';
	sort_order?: number;
	group_prices: {
		id?: string;
		minimum_travelers: number;
		maximum_travelers?: number | null;
		room_count?: number;
		price?: number | null;
		price_status: 'FIXED_PRICE' | 'ON_REQUEST' | 'NOT_AVAILABLE';
		sort_order?: number;
	}[];
};

export type TourDetail = Tour & {
	full_description?: string | null;
	difficulty_level?: string | null;
	minimum_age?: number | null;
	experience_type?: string | null;
	meta_title?: string | null;
	seo_title?: string | null;
	meta_description?: string | null;
	og_image_url?: string | null;
	itinerary_days?: ItineraryDay[] | null;
	tour_inclusions?: { title: string; sort_order: number }[] | null;
	tour_exclusions?: { title: string; sort_order: number }[] | null;
	tour_images?: { id: string; image_url: string; alt_text?: string | null; caption?: string | null; sort_order: number; is_featured: boolean; image_url_thumbnail?: string }[] | null;
	tour_pricing_seasons?: TourPricingSeasonPublic[] | null;
	/** Published catalogue activities only. */
	tour_activities?: { sort_order: number; activity: { id: string; name: string; slug: string; category?: string | null; duration_label?: string | null; price_from?: number | null; currency?: string | null; price_unit?: string | null; badge?: string | null; hero_image_url?: string | null; image_url?: string | null } }[] | null;
};

/** The lodge enums (apps/backend/src/schemas/lodges.schema.ts). */
export type StayLevel = 'BUDGET' | 'MID_RANGE' | 'LUXURY' | 'PREMIUM_LUXURY';
export type StayType = 'HOTEL' | 'SAFARI_LODGE' | 'TENTED_CAMP' | 'MOBILE_CAMP' | 'BEACH_RESORT' | 'VILLA' | 'GUEST_HOUSE' | 'ECO_LODGE' | 'BOUTIQUE_HOTEL';

/** A published lodge or camp as GET /lodges lists it (the public "Stays"). */
export type Stay = {
	id: string;
	name: string;
	slug: string;
	lodge_type?: StayType | null;
	accommodation_level?: StayLevel | null;
	/** The safari style the level serves, computed by the API. */
	style?: SafariStyleKey | null;
	destination_id?: string | null;
	destinations?: { name: string; slug: string } | null;
	country?: string | null;
	region?: string | null;
	park_area?: string | null;
	short_description?: string | null;
	hero_image_url?: string | null;
	image_url?: string | null;
	mobile_hero_image_url?: string | null;
	social_image_url?: string | null;
	hero_image_url_thumbnail?: string;
	image_url_thumbnail?: string;
	/** Gallery cover, attached by the API when the property has one. */
	cover_image_url?: string | null;
	is_featured?: boolean;
	/** Published tours whose itinerary sleeps here. */
	tour_count?: number;
	show_rates_publicly?: boolean | null;
	price_per_night_from?: number | string | null;
	currency?: string | null;
	recommended_nights?: number | null;
	best_for?: string[] | null;
};

export type StayImage = { id: string; image_url: string; alt_text?: string | null; caption?: string | null; sort_order?: number; is_cover?: boolean };
export type StayAmenity = { id: string; name: string; icon_key?: string | null; sort_order?: number };
export type StayRate = { season_name: string; valid_from?: string | null; valid_until?: string | null; currency?: string | null; rack_rate?: number | null; double_rate?: number | null; pricing_basis?: string | null; meal_plan?: string | null };

/** A published tour that overnights at a stay, with the styles and days it does so. */
export type StayTour = Tour & {
	category_id?: string | null;
	styles: SafariStyleKey[];
	days: number[];
};

/** GET /lodges/:slug for the public stay page. */
export type StayDetail = Stay & {
	description?: string | null;
	why_we_recommend?: string | null;
	latitude?: number | string | null;
	longitude?: number | string | null;
	nearest_airport?: string | null;
	transfer_time?: string | null;
	distance_airstrip?: string | null;
	children_allowed?: boolean | null;
	minimum_child_age?: number | null;
	meta_title?: string | null;
	seo_title?: string | null;
	meta_description?: string | null;
	indexable?: boolean | null;
	destination?: { id: string; name: string; slug: string; region?: string | null; country?: string | null } | null;
	images?: StayImage[] | null;
	amenities?: StayAmenity[] | null;
	highlights?: { id?: string; title: string; sort_order?: number }[] | null;
	/** Empty unless the property shows its rates publicly. */
	rates?: StayRate[] | null;
	related_destinations?: { id: string; name: string; slug: string; country?: string }[] | null;
	featured_in_tours?: StayTour[] | null;
	/** Up to three other public stays in the same destination. */
	nearby_stays?: Stay[] | null;
};
