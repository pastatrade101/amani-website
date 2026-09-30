/**
 * Safari style pricing: per-person prices by group size for each comfort
 * level. One tour has pricing seasons (tour_pricing_seasons), each tagged with
 * a safari_style; each season holds its group-size rows (tour_group_prices).
 */
export type SafariStyle = 'budget' | 'midrange' | 'luxury';

/** Icons are mapped in the selector component, so this file stays plain TS (and testable). */
export const SAFARI_STYLES: { id: SafariStyle; title: string; subtitle: string }[] = [
	{ id: 'budget', title: 'Budget Safari', subtitle: 'Great value adventures' },
	{ id: 'midrange', title: 'Midrange Safari', subtitle: 'Comfort & great value' },
	{ id: 'luxury', title: 'Luxury Safari', subtitle: 'Premium experiences' }
];

/** Only the selected tab, the table border and the prices take the style's colour. */
export const SAFARI_STYLE_THEME: Record<SafariStyle, { primary: string; priceColor: string; light: string; tabBg: string; activeText: string | null }> = {
	budget: { primary: '#4F8A5B', priceColor: '#4F8A5B', light: '#F2F8F3', tabBg: '#F2F8F3', activeText: '#4F8A5B' },
	midrange: { primary: '#FFCC00', priceColor: '#D9A900', light: '#FFF9E5', tabBg: '#FFF9E5', activeText: null },
	luxury: { primary: '#7656A8', priceColor: '#7656A8', light: '#F6F2FA', tabBg: '#F6F2FA', activeText: '#7656A8' }
};

export const DEFAULT_STYLE: SafariStyle = 'midrange';

export type GroupPrice = {
	id?: string;
	minimum_travelers: number;
	maximum_travelers?: number | null;
	room_count?: number;
	price?: number | null;
	price_status: 'FIXED_PRICE' | 'ON_REQUEST' | 'NOT_AVAILABLE';
	sort_order?: number;
};

export type PricingSeason = {
	id?: string;
	safari_style?: SafariStyle | null;
	season_type: 'STANDARD_SEASON' | 'PEAK_SEASON' | 'CUSTOM';
	season_name: string;
	start_date?: string | null;
	end_date?: string | null;
	currency: string;
	pricing_basis: 'PER_PERSON' | 'PER_GROUP';
	status: 'ACTIVE' | 'INACTIVE';
	sort_order?: number;
	group_prices: GroupPrice[];
};

export type PriceTier = { key: string; label: string; price: number | null; status: GroupPrice['price_status'] };

export const styleOf = (season: Pick<PricingSeason, 'safari_style'>): SafariStyle =>
	season.safari_style === 'budget' || season.safari_style === 'luxury' ? season.safari_style : DEFAULT_STYLE;

export const groupLabel = (price: Pick<GroupPrice, 'minimum_travelers' | 'maximum_travelers'>) => {
	const min = price.minimum_travelers;
	const max = price.maximum_travelers;
	if (max == null) return `${min}+ Pax`;
	return max === min ? `${min} Pax` : `${min}–${max} Pax`;
};

/** The standard 1–6 traveller rows a new season starts with. */
export const standardGroupPrices = (): GroupPrice[] =>
	[1, 2, 3, 4, 5, 6].map((n, i) => ({
		minimum_travelers: n,
		maximum_travelers: n,
		room_count: Math.ceil(n / 2),
		price: null,
		price_status: 'FIXED_PRICE',
		sort_order: i * 10
	}));

const inRange = (season: PricingSeason, today: string) =>
	Boolean(season.start_date && season.end_date && season.start_date <= today && today <= season.end_date);

/**
 * The season a traveller should see for a style: the active per-person season
 * whose dates contain today, else the Standard Season, else the first by sort
 * order. Null when the style has nothing to show.
 */
export function seasonForStyle(seasons: PricingSeason[], style: SafariStyle, today = new Date().toISOString().slice(0, 10)): PricingSeason | null {
	const candidates = seasons
		.filter((season) => styleOf(season) === style && season.status === 'ACTIVE' && season.pricing_basis === 'PER_PERSON')
		.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
	return candidates.find((season) => inRange(season, today)) ?? candidates.find((season) => season.season_type === 'STANDARD_SEASON') ?? candidates[0] ?? null;
}

/** Rows for the price table; empty when every row is unavailable. */
export function tiersForStyle(seasons: PricingSeason[], style: SafariStyle, today?: string): PriceTier[] {
	const season = seasonForStyle(seasons, style, today);
	if (!season) return [];
	const tiers = [...season.group_prices]
		.filter((price) => price.price_status !== 'NOT_AVAILABLE')
		.sort((a, b) => a.minimum_travelers - b.minimum_travelers)
		.map((price) => ({
			key: `${price.minimum_travelers}-${price.maximum_travelers ?? 'plus'}`,
			label: groupLabel(price),
			price: price.price_status === 'FIXED_PRICE' && price.price != null ? Number(price.price) : null,
			status: price.price_status
		}));
	return tiers;
}

/** Styles that have something to show, in the fixed Budget → Luxury order. */
export const stylesWithPrices = (seasons: PricingSeason[], today?: string): SafariStyle[] =>
	SAFARI_STYLES.map((style) => style.id).filter((id) => tiersForStyle(seasons, id, today).length > 0);

export const formatPrice = (amount: number, currency = 'USD') => {
	try {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
	} catch {
		return `${currency} ${Math.round(amount).toLocaleString('en-US')}`;
	}
};
