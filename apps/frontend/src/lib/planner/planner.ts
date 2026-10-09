import { COMFORTS, LENGTHS, MONTH_NAMES, NOT_SURE, comfortLabel, lengthLabel, travellerCount, usd, type ComfortId, type LengthId, type PlanAnswers, type PlanContext } from './options.js';
import type { Season } from '../seasons.js';
import type { Category, Stay, Tour } from '../types/api.js';

/**
 * The logic behind /plan-my-trip: what to offer and what to suggest. Every
 * option and figure is read from Key2africa's own published tours, stays,
 * categories and seasons, so nothing here invents a trip, a price or a season.
 * A request with no packaged match says so and goes to the team as a custom plan.
 */

/** A published tour, cut down to what the planner reads. */
export type PlannerTour = {
	id: string;
	title: string;
	slug: string;
	days: number;
	category: string;
	/** Lowest per-person starting price in USD; null when on request or priced in another currency. */
	price: number | null;
	styles: ComfortId[];
	places: { slug: string; name: string }[];
	text: string;
	thumbnail: string;
};

export type PlannerStay = { id: string; name: string; slug: string; style: ComfortId | null; place: string };
export type PlannerSeason = Pick<Season, 'name' | 'start_month' | 'end_month' | 'best_for' | 'description'>;

const isComfort = (value: unknown): value is ComfortId => COMFORTS.some((item) => item.id === value);
// Older tours carry budget_tier instead of priced styles.
const TIER_STYLE: Record<string, ComfortId> = { budget: 'budget', mid_range: 'midrange', midrange: 'midrange', luxury: 'luxury' };

export function plannerTour(tour: Tour): PlannerTour {
	const summary = tour.pricing_summary;
	const currency = (summary?.from != null ? summary.currency : null) || tour.currency || 'USD';
	const amount = Number(summary?.from ?? tour.price_from);
	const styles = (summary?.styles ?? []).filter(isComfort);
	const tier = TIER_STYLE[String(tour.budget_tier ?? '').toLowerCase()];
	const places = new Map<string, string>();
	if (tour.destinations?.slug) places.set(tour.destinations.slug, tour.destinations.name);
	for (const link of tour.tour_destinations ?? []) if (link.destinations?.slug && !places.has(link.destinations.slug)) places.set(link.destinations.slug, link.destinations.name);
	return {
		id: tour.id,
		title: tour.title,
		slug: tour.slug,
		days: Number(tour.duration_days) || 0,
		category: tour.tour_categories?.slug ?? '',
		price: currency.toUpperCase() === 'USD' && Number.isFinite(amount) && amount > 0 ? amount : null,
		styles: styles.length ? styles : tier ? [tier] : [],
		places: [...places].map(([slug, name]) => ({ slug, name })),
		text: `${tour.title} ${tour.short_description ?? ''}`.toLowerCase().slice(0, 400),
		thumbnail: tour.main_image_url_thumbnail || tour.main_image_url || ''
	};
}

export const plannerStay = (stay: Stay): PlannerStay => ({
	id: stay.id,
	name: stay.name,
	slug: stay.slug,
	style: isComfort(stay.style) ? stay.style : null,
	place: stay.destinations?.slug ?? ''
});

// ── Trip types: the categories that have published tours ──────────────────────

export type TripType = { slug: string; name: string; count: number; minDays: number };

/** Categories with at least one published tour, the busiest first. */
export function tripTypes(categories: Pick<Category, 'slug' | 'name'>[], tours: PlannerTour[]): TripType[] {
	return categories
		.map((category) => {
			const own = tours.filter((tour) => tour.category === category.slug);
			const days = own.map((tour) => tour.days).filter((n) => n > 0);
			return { slug: category.slug, name: category.name, count: own.length, minDays: days.length ? Math.min(...days) : 0 };
		})
		.filter((type) => type.count > 0)
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

const definite = (a: Pick<PlanAnswers, 'types'>) => a.types.map((type) => type.slug).filter((slug) => slug !== NOT_SURE);

/** The tours of the chosen kinds; every tour when none (or "Not sure yet") is chosen. */
export const poolFor = (a: Pick<PlanAnswers, 'types'>, tours: PlannerTour[]) => {
	const slugs = definite(a);
	return slugs.length ? tours.filter((tour) => slugs.includes(tour.category)) : tours;
};

// ── Seasons ──────────────────────────────────────────────────────────────────

/** A season may wrap the year end, e.g. November to February. `month` is 0–11. */
export function seasonFor(seasons: PlannerSeason[], month: number): PlannerSeason | null {
	const m = month + 1;
	return seasons.find((season) => (season.start_month <= season.end_month ? m >= season.start_month && m <= season.end_month : m >= season.start_month || m <= season.end_month)) ?? null;
}

export const seasonNote = (season: PlannerSeason | null) => (season?.best_for || season?.description || '').trim();

// ── Length ───────────────────────────────────────────────────────────────────

export const lengthOf = (days: number): LengthId | null => (days > 0 ? (LENGTHS.find((band) => days >= band.min && (band.id === '15+' || days <= band.max))?.id ?? null) : null);

/** The middle of a band, in days; 0 when unknown. */
export const bandDays = (id: string) => {
	const band = LENGTHS.find((item) => item.id === id);
	return band ? (band.id === '15+' ? 16 : Math.round((band.min + band.max) / 2)) : 0;
};

/** The length most of the matching tours fall into: a count of the catalogue, not a guess. */
export function popularLength(pool: PlannerTour[]): LengthId | null {
	const counts = LENGTHS.map((band) => pool.filter((tour) => lengthOf(tour.days) === band.id).length);
	const best = Math.max(0, ...counts);
	return best > 0 ? LENGTHS[counts.indexOf(best)].id : null;
}

// ── Comfort and budget ───────────────────────────────────────────────────────

export type ComfortOption = { id: ComfortId; label: string; desc: string; tours: number; stays: number; from: number | null };

/**
 * One option per style the catalogue offers, with how many tours and stays
 * sit in it and the lowest starting price. Without a catalogue (the API
 * failed) all three styles are offered with no figures.
 */
export function comfortOptions(tours: PlannerTour[], stays: PlannerStay[]): ComfortOption[] {
	const options = COMFORTS.map((style) => {
		const own = tours.filter((tour) => tour.styles.includes(style.id));
		const prices = own.map((tour) => tour.price).filter((n): n is number => n !== null);
		return { id: style.id, label: style.label, desc: style.desc, tours: own.length, stays: stays.filter((stay) => stay.style === style.id).length, from: prices.length ? Math.min(...prices) : null };
	});
	const offered = options.filter((option) => option.tours || option.stays);
	return offered.length ? offered : options;
}

const prices = (tours: PlannerTour[]) => tours.map((tour) => tour.price).filter((n): n is number => n !== null).sort((a, b) => a - b);

export type BudgetScale = { min: number; max: number; step: number; start: number };

/** From our lowest to our highest starting price per person (USD), starting at the median. */
export function budgetScale(tours: PlannerTour[]): BudgetScale | null {
	const list = prices(tours);
	if (!list.length) return null;
	const spread = list[list.length - 1] - list[0];
	const step = spread > 20000 ? 500 : spread > 8000 ? 250 : 100;
	const min = Math.floor(list[0] / step) * step;
	const max = Math.max(min + step, Math.ceil(list[list.length - 1] / step) * step);
	const mid = list.length % 2 ? list[(list.length - 1) / 2] : (list[list.length / 2 - 1] + list[list.length / 2]) / 2;
	return { min, max, step, start: Math.min(max, Math.max(min, Math.round(mid / step) * step)) };
}

export const startingAtOrUnder = (tours: PlannerTour[], amount: number) => prices(tours).filter((n) => n <= amount).length;

// ── Suggestions ──────────────────────────────────────────────────────────────

export type Recommendation = { tour: PlannerTour; reasons: string[] };

// Words in an activity name too general to say a tour offers it.
const GENERIC = new Set(['safari', 'safaris', 'tour', 'tours', 'trip', 'trips', 'tanzania', 'experience', 'experiences', 'with', 'and', 'the', 'day', 'days']);
const keywords = (name: string) => name.toLowerCase().split(/[^a-z]+/).filter((word) => word.length >= 4 && !GENERIC.has(word));

/**
 * The three tours that fit the answers best: trip type, length, comfort,
 * budget, the page the visitor came from and their priorities. A tour of
 * another type is left out, unless it is the tour they came from.
 */
export function recommend(a: PlanAnswers, tours: PlannerTour[], stays: PlannerStay[] = []): Recommendation[] {
	if (!a.types.length) return [];
	const slugs = definite(a);
	const band = LENGTHS.find((item) => item.id === a.length);
	const context: PlanContext | null = a.context;
	const stayPlace = context?.kind === 'stay' ? (stays.find((stay) => stay.slug === context.slug)?.place ?? '') : '';
	const wanted = a.priorities.filter((p) => p.slug !== NOT_SURE).map((p) => ({ name: p.name, words: keywords(p.name) })).filter((p) => p.words.length);

	return tours
		.map((tour) => {
			const reasons: string[] = [];
			const fromHere = context?.kind === 'tour' && context.slug === tour.slug;
			let score = 1;
			if (slugs.length) {
				if (!slugs.includes(tour.category) && !fromHere) return { tour, score: -Infinity, reasons };
				score += 3;
			}
			if (fromHere) {
				score += 5;
				reasons.push('The trip you were looking at');
			}
			if (band && tour.days) {
				if (lengthOf(tour.days) === band.id) {
					score += 2;
					reasons.push(`${tour.days} days, about the length you want`);
				} else score -= Math.min(Math.abs(tour.days - (band.min + band.max) / 2), 8) * 0.4;
			}
			if (a.comfort && a.comfort !== NOT_SURE && tour.styles.length) {
				if (tour.styles.includes(a.comfort)) {
					score += 1.5;
					reasons.push(`Offered in ${comfortLabel(a.comfort).toLowerCase()} style`);
				} else score -= 0.5;
			}
			if (a.budget !== null && !a.budgetUnsure && tour.price) {
				if (tour.price <= a.budget) {
					score += 2;
					reasons.push(`From ${usd(tour.price)} per person, within your budget`);
				} else score -= tour.price > a.budget * 1.15 ? 2 : 0.5;
			}
			const place = context?.kind === 'destination' ? context.slug : stayPlace;
			const visited = place ? tour.places.find((p) => p.slug === place) : undefined;
			if (visited) {
				score += 2;
				reasons.push(context?.kind === 'stay' ? `Visits ${visited.name}, where ${context.name} is` : `Visits ${visited.name}`);
			}
			const hits = wanted.filter((p) => p.words.some((word) => tour.text.includes(word))).map((p) => p.name);
			if (hits.length) {
				score += hits.length * 1.5;
				reasons.push(`Fits your ${hits.length > 1 ? 'priorities' : 'priority'}: ${hits.join(', ')}`);
			}
			return { tour, score, reasons };
		})
		.filter((item) => Number.isFinite(item.score))
		.sort((x, y) => y.score - x.score)
		.slice(0, 3)
		.map(({ tour, reasons }) => ({ tour, reasons }));
}

// ── Tips ─────────────────────────────────────────────────────────────────────

/** Up to four tips, each counted from the catalogue or read from a published season. */
export function plannerTips(a: PlanAnswers, tours: PlannerTour[], seasons: PlannerSeason[], comfort: ComfortOption[], month: number | null): string[] {
	const out: string[] = [];
	const trips = (n: number) => (n === 1 ? 'trip' : 'trips');
	if (month !== null) {
		const season = seasonFor(seasons, month);
		const note = seasonNote(season);
		if (season) out.push(`${MONTH_NAMES[month]} falls in ${season.name}${note ? `: ${note}` : '.'}`.slice(0, 220));
	}
	if (!a.types.length) return out;
	const pool = poolFor(a, tours);
	const band = LENGTHS.find((item) => item.id === a.length);
	if (band && pool.length) {
		const n = pool.filter((tour) => lengthOf(tour.days) === band.id).length;
		out.push(n ? `${n} of the ${pool.length} published ${trips(pool.length)} that match your trip type ${n === 1 ? 'runs' : 'run'} ${lengthLabel(band.id)}.` : `None of our published trips of this kind runs ${lengthLabel(band.id)} yet. We’ll plan yours as a custom trip.`);
	}
	const style = comfort.find((option) => option.id === a.comfort);
	if (style?.from) out.push(`Our ${style.label.toLowerCase()} trips start from ${usd(style.from)} per person${style.stays ? `, and we work with ${style.stays} ${style.label.toLowerCase()} ${style.stays === 1 ? 'stay' : 'stays'}` : ''}.`);
	if (a.budget !== null && !a.budgetUnsure && pool.length) {
		const n = startingAtOrUnder(pool, a.budget);
		out.push(`${n} of the ${pool.length} matching ${trips(pool.length)} ${n === 1 ? 'starts' : 'start'} at or under ${usd(a.budget)} per person.`);
	}
	if (travellerCount(a).children > 0) out.push('Some camps set a minimum age for children. We’ll check every stay against your children’s ages.');
	return out.slice(0, 4);
}
