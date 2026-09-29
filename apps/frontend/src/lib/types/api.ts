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
	budget_tier?: string | null;
	destinations?: { name: string; slug: string; country?: string } | null;
};
