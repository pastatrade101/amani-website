/**
 * The tours page filter. Every published tour is loaded once and filtered
 * here, on the server for the first paint and in the browser after that, so
 * results change as the visitor picks options and every option shows how many
 * safaris it leaves. Options come from the tours themselves: a place, a length
 * or a price band only appears when a published tour has it.
 */
import { normalizeSafariStyle } from './lodge-levels';
import { shortPlaceName, textContent, tourDuration } from './home-content';
import type { SafariStyle } from './safari-pricing.js';
import type { Category, Tour } from './types/api.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DAY_RANGES = [
	{ key: '1-3', label: '1–3 days', min: 1, max: 3 },
	{ key: '4-6', label: '4–6 days', min: 4, max: 6 },
	{ key: '7-10', label: '7–10 days', min: 7, max: 10 },
	{ key: '11-plus', label: '11 days or more', min: 11, max: Infinity }
] as const;

/** Per-person USD bands: min inclusive, max exclusive. */
export const BUDGETS = [
	{ key: 'under-1000', label: 'Under $1,000', min: 0, max: 1000 },
	{ key: '1000-2000', label: '$1,000–2,000', min: 1000, max: 2000 },
	{ key: '2000-3000', label: '$2,000–3,000', min: 2000, max: 3000 },
	{ key: '3000-5000', label: '$3,000–5,000', min: 3000, max: 5000 },
	{ key: '5000-plus', label: '$5,000+', min: 5000, max: Infinity },
	{ key: 'on-request', label: 'Price on request', min: NaN, max: NaN }
] as const;

export const COMFORT: { key: SafariStyle; label: string }[] = [
	{ key: 'budget', label: 'Budget' },
	{ key: 'midrange', label: 'Midrange' },
	{ key: 'luxury', label: 'Luxury' }
];

export const SORTS = [
	{ key: 'recommended', label: 'Recommended' },
	{ key: 'price-low', label: 'Price: low to high' },
	{ key: 'price-high', label: 'Price: high to low' },
	{ key: 'days-short', label: 'Shortest first' },
	{ key: 'days-long', label: 'Longest first' }
] as const;

export type SortKey = (typeof SORTS)[number]['key'];
export type FacetId = 'places' | 'styles' | 'days' | 'budget' | 'start' | 'comfort';

export type TourQuery = {
	search: string;
	/** Destination ids; a tour must visit every one. */
	places: string[];
	/** Safari style (category) ids; any one. */
	styles: string[];
	days: string[];
	budget: string[];
	/** Start point keys, e.g. "arusha". */
	start: string[];
	comfort: SafariStyle[];
	/** Youngest traveller's age; null when no children. */
	age: number | null;
	sort: SortKey;
};

export const EMPTY_QUERY: TourQuery = { search: '', places: [], styles: [], days: [], budget: [], start: [], comfort: [], age: null, sort: 'recommended' };

const unique = (values: string[], ok: (value: string) => boolean) => [...new Set(values.map((value) => value.trim()).filter(ok))].slice(0, 20);
const dayKeys = new Set<string>(DAY_RANGES.map((range) => range.key));
const budgetKeys = new Set<string>(BUDGETS.map((band) => band.key));
const comfortKeys = new Set<string>(COMFORT.map((item) => item.key));
const sortKeys = new Set<string>(SORTS.map((item) => item.key));

/** The tours URL as a query. Old links (one destination_id, "all") still work. */
export function parseTourQuery(params: URLSearchParams): TourQuery {
	const age = params.get('age') ?? '';
	const sort = params.get('sort') ?? '';
	return {
		search: (params.get('search') ?? '').replace(/\s+/g, ' ').trim().slice(0, 150),
		places: unique(params.getAll('destination_id'), (value) => UUID.test(value)),
		styles: unique(params.getAll('category_id'), (value) => UUID.test(value)),
		days: unique(params.getAll('days'), (value) => dayKeys.has(value)),
		budget: unique(params.getAll('budget'), (value) => budgetKeys.has(value)),
		start: unique(params.getAll('start'), (value) => value.length <= 80 && KEY.test(value)),
		comfort: unique(params.getAll('comfort'), (value) => comfortKeys.has(value)) as SafariStyle[],
		age: /^\d{1,2}$/.test(age) && Number(age) <= 17 ? Number(age) : null,
		sort: (sortKeys.has(sort) ? sort : 'recommended') as SortKey
	};
}

/** The query as URL parameters; defaults drop out. */
export function tourQueryParams(query: TourQuery): URLSearchParams {
	const params = new URLSearchParams();
	if (query.search) params.set('search', query.search);
	for (const id of query.places) params.append('destination_id', id);
	for (const id of query.styles) params.append('category_id', id);
	for (const key of query.days) params.append('days', key);
	for (const key of query.budget) params.append('budget', key);
	for (const key of query.start) params.append('start', key);
	for (const key of query.comfort) params.append('comfort', key);
	if (query.age !== null) params.set('age', String(query.age));
	if (query.sort !== 'recommended') params.set('sort', query.sort);
	return params;
}

export const isFiltered = (query: TourQuery) =>
	Boolean(query.search || query.places.length || query.styles.length || query.days.length || query.budget.length || query.start.length || query.comfort.length || query.age !== null);

/** The same query with one option of a facet switched on or off. */
export function toggleOption(query: TourQuery, facet: FacetId, value: string): TourQuery {
	const current = query[facet] as string[];
	const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
	return { ...query, [facet]: next };
}

/** Everything cleared except the sort order. */
export const clearedQuery = (query: TourQuery): TourQuery => ({ ...EMPTY_QUERY, sort: query.sort });

// ---------------------------------------------------------------------------
// What each tour offers, worked out once per tour.

export const normalizeText = (value: string) =>
	value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

const titleCase = (value: string) => value.replace(/(^|[\s(-])([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase());

/** "Arusha, Tanzania" → "Arusha"; "zanzibar" → "Zanzibar". */
export function placeLabel(value: unknown): string {
	const label = String(value ?? '').replace(/\s+/g, ' ').replace(/,\s*tanzania$/i, '').trim();
	return label && label === label.toLowerCase() ? titleCase(label) : label;
}

const keyOf = (label: string) => normalizeText(label).replace(/ /g, '-').slice(0, 80);

/** The per-person "from" amount the card shows: lowest style price, else the tour's own. */
export function tourPriceValue(tour: Pick<Tour, 'pricing_summary' | 'price_from' | 'currency'>): { amount: number; currency: string } | null {
	const summary = tour.pricing_summary;
	const styled = Number(summary?.from);
	if (summary?.from != null && Number.isFinite(styled) && styled > 0) return { amount: styled, currency: summary.currency || tour.currency || 'USD' };
	const own = Number(tour.price_from);
	return Number.isFinite(own) && own > 0 ? { amount: own, currency: tour.currency || 'USD' } : null;
}

export type TourFacts = {
	tour: Tour;
	/** Position in the API's order (newest first), the "recommended" tie-break. */
	index: number;
	places: { id: string; name: string }[];
	placeIds: Set<string>;
	style: string | null;
	days: number;
	dayKey: string | null;
	price: number | null;
	/** Null for a price in another currency: it has no USD band. */
	budgetKey: string | null;
	start: { key: string; label: string } | null;
	comfort: SafariStyle[];
	minAge: number;
	words: string[];
};

export function tourFacts(tour: Tour, index: number): TourFacts {
	const places: { id: string; name: string }[] = [];
	const links = [...(tour.tour_destinations ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
	for (const link of links) {
		const id = link.destination_id || link.destinations?.id || '';
		const name = String(link.destinations?.name ?? '').trim();
		if (id && name && !places.some((place) => place.id === id)) places.push({ id, name });
	}
	const primaryName = String(tour.destinations?.name ?? '').trim();
	if (tour.destination_id && primaryName && !places.some((place) => place.id === tour.destination_id)) places.unshift({ id: tour.destination_id, name: primaryName });

	const days = Math.max(0, Math.floor(Number(tour.duration_days)) || 0);
	const price = tourPriceValue(tour);
	const band = price && price.currency.toUpperCase() === 'USD' ? BUDGETS.find((item) => price.amount >= item.min && price.amount < item.max) : null;
	const startLabel = placeLabel(tour.start_point?.name || tour.start_location);
	const endLabel = placeLabel(tour.end_point?.name || tour.end_location);
	const summaryStyles = (tour.pricing_summary?.styles ?? []).filter((style): style is SafariStyle => comfortKeys.has(style));
	const ownStyle = normalizeSafariStyle(tour.budget_tier);
	const comfort = summaryStyles.length ? summaryStyles : ownStyle ? [ownStyle] : [];
	const minAge = Math.max(0, Math.floor(Number(tour.minimum_age)) || 0);

	const text = [
		tour.title,
		textContent(tour.short_description),
		...(tour.highlights ?? []),
		tour.experience_type,
		...(tour.persona_tags ?? []),
		tour.tour_categories?.name,
		...places.flatMap((place) => [place.name, shortPlaceName(place.name)]),
		startLabel,
		endLabel,
		...comfort.map((key) => COMFORT.find((item) => item.key === key)?.label),
		tour.difficulty_level,
		tourDuration(tour.duration_days, tour.duration_nights)
	].filter(Boolean).join(' ');

	return {
		tour,
		index,
		places,
		placeIds: new Set(places.map((place) => place.id)),
		style: tour.category_id || null,
		days,
		dayKey: DAY_RANGES.find((range) => days >= range.min && days <= range.max)?.key ?? null,
		price: price?.amount ?? null,
		budgetKey: price ? band?.key ?? null : 'on-request',
		start: startLabel ? { key: keyOf(startLabel), label: startLabel } : null,
		comfort,
		minAge,
		words: [...new Set(normalizeText(text).split(' ').filter(Boolean))]
	};
}

// ---------------------------------------------------------------------------
// Matching.

const STOP_WORDS = new Set(['a', 'an', 'and', 'the', 'of', 'in', 'to', 'with', 'for', 'from', 'on', 'at', 'by', 'or', 'my', 'our', 'me', 'we', 'i', 'tour', 'tours', 'trip', 'trips', 'package', 'packages', 'holiday', 'holidays']);
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** A search word and the spellings it should also match: "lions" → "lion", "5" ↔ "five". */
function variants(token: string): string[] {
	const forms = [token];
	if (token.length > 3 && /(?:es|s)$/.test(token)) forms.push(token.replace(/(?:es|s)$/, ''), token.replace(/s$/, ''));
	const digit = NUMBER_WORDS.indexOf(token);
	if (digit >= 0) forms.push(String(digit));
	else if (/^\d+$/.test(token) && Number(token) < NUMBER_WORDS.length) forms.push(NUMBER_WORDS[Number(token)]);
	return [...new Set(forms.filter(Boolean))];
}

/** Each search word, with its other spellings; every word must match something on the tour. */
export const searchTerms = (search: string) =>
	normalizeText(search).split(' ').filter((token) => token && !STOP_WORDS.has(token)).map(variants);

const matchesTerms = (facts: TourFacts, terms: string[][]) =>
	terms.every((forms) => forms.some((form) => facts.words.some((word) => word.startsWith(form))));

type Matcher = (facts: TourFacts, skip?: FacetId) => boolean;

/** A test for one query; `skip` leaves one facet out, for counting that facet's options. */
export function matcher(query: TourQuery): Matcher {
	const terms = searchTerms(query.search);
	return (facts, skip) =>
		matchesTerms(facts, terms) &&
		(skip === 'places' || query.places.every((id) => facts.placeIds.has(id))) &&
		(skip === 'styles' || !query.styles.length || (facts.style !== null && query.styles.includes(facts.style))) &&
		(skip === 'days' || !query.days.length || (facts.dayKey !== null && query.days.includes(facts.dayKey))) &&
		(skip === 'budget' || !query.budget.length || (facts.budgetKey !== null && query.budget.includes(facts.budgetKey))) &&
		(skip === 'start' || !query.start.length || (facts.start !== null && query.start.includes(facts.start.key))) &&
		(skip === 'comfort' || !query.comfort.length || facts.comfort.some((style) => query.comfort.includes(style))) &&
		(query.age === null || facts.minAge <= query.age);
}

const byRecommended = (a: TourFacts, b: TourFacts) =>
	Number(Boolean(b.tour.is_featured)) - Number(Boolean(a.tour.is_featured)) ||
	Number(Boolean(b.tour.is_popular)) - Number(Boolean(a.tour.is_popular)) ||
	a.index - b.index;

/** Unknown prices and lengths always sort last. */
const lastWhenMissing = (a: number | null, b: number | null, direction: 1 | -1) =>
	a === null || b === null ? Number(a === null) - Number(b === null) : (a - b) * direction;

export function sortFacts(list: TourFacts[], sort: SortKey): TourFacts[] {
	const sorted = [...list];
	if (sort === 'price-low' || sort === 'price-high') sorted.sort((a, b) => lastWhenMissing(a.price, b.price, sort === 'price-low' ? 1 : -1) || byRecommended(a, b));
	else if (sort === 'days-short' || sort === 'days-long') sorted.sort((a, b) => lastWhenMissing(a.days || null, b.days || null, sort === 'days-short' ? 1 : -1) || byRecommended(a, b));
	else sorted.sort(byRecommended);
	return sorted;
}

export function filterTours(facts: TourFacts[], query: TourQuery): TourFacts[] {
	const test = matcher(query);
	return sortFacts(facts.filter((item) => test(item)), query.sort);
}

// ---------------------------------------------------------------------------
// The options shown in the filter panel.

export type FacetOption = { value: string; label: string; count: number; checked: boolean };
export type FacetGroup = { id: FacetId; title: string; hint?: string; options: FacetOption[] };

type Candidate = { value: string; label: string; has: (facts: TourFacts) => boolean };

/**
 * The filter groups for a query. Each option counts the safaris it would show
 * with everything else kept as chosen. Options no tour has are left out
 * (unless chosen through a link), and a group whose one option covers every
 * tour is hidden: it could never narrow the list.
 */
export function facetGroups(facts: TourFacts[], query: TourQuery, context: { categories: Category[]; destinations?: { id: string; name: string }[] }): FacetGroup[] {
	const test = matcher(query);
	const group = (id: FacetId, title: string, candidates: Candidate[], hint?: string): FacetGroup | null => {
		const chosen = query[id] as string[];
		const options = candidates
			.map((candidate) => ({ candidate, coverage: facts.filter(candidate.has).length }))
			.filter(({ candidate, coverage }) => coverage > 0 || chosen.includes(candidate.value))
			.map(({ candidate, coverage }) => ({
				coverage,
				option: {
					value: candidate.value,
					label: candidate.label,
					checked: chosen.includes(candidate.value),
					count: facts.filter((item) => test(item, id) && candidate.has(item) && (id !== 'places' || query.places.every((place) => item.placeIds.has(place)))).length
				}
			}));
		const useful = options.length > 1 || options.some(({ option, coverage }) => option.checked || coverage < facts.length);
		return options.length && useful ? { id, title, hint, options: options.map(({ option }) => option) } : null;
	};

	const placeCandidates = new Map<string, Candidate & { coverage: number; first: number }>();
	facts.forEach((item) =>
		item.places.forEach((place, order) => {
			const known = placeCandidates.get(place.id);
			if (known) known.coverage += 1;
			else placeCandidates.set(place.id, { value: place.id, label: shortPlaceName(place.name), has: (other) => other.placeIds.has(place.id), coverage: 1, first: order });
		})
	);
	for (const id of query.places) {
		if (!placeCandidates.has(id)) {
			const name = context.destinations?.find((place) => place.id === id)?.name;
			placeCandidates.set(id, { value: id, label: name ? shortPlaceName(name) : 'Chosen place', has: (other) => other.placeIds.has(id), coverage: 0, first: 99 });
		}
	}
	const places = [...placeCandidates.values()].sort((a, b) => b.coverage - a.coverage || a.label.localeCompare(b.label));

	const styles: Candidate[] = context.categories.map((category) => ({ value: category.id, label: category.name, has: (item) => item.style === category.id }));
	for (const id of query.styles) if (!styles.some((style) => style.value === id)) styles.push({ value: id, label: 'Chosen style', has: (item) => item.style === id });

	const starts = new Map<string, Candidate & { coverage: number }>();
	for (const item of facts) {
		if (!item.start) continue;
		const { key, label } = item.start;
		const known = starts.get(key);
		if (known) known.coverage += 1;
		else starts.set(key, { value: key, label, has: (other) => other.start?.key === key, coverage: 1 });
	}
	for (const key of query.start) if (!starts.has(key)) starts.set(key, { value: key, label: titleCase(key.replace(/-/g, ' ')), has: (other) => other.start?.key === key, coverage: 0 });

	return [
		group('places', 'Places to visit', places, 'Safaris that include all you pick'),
		group('styles', 'Safari style', styles),
		group('days', 'Length', DAY_RANGES.map((range) => ({ value: range.key, label: range.label, has: (item) => item.dayKey === range.key }))),
		group('budget', 'Price per person', BUDGETS.map((band) => ({ value: band.key, label: band.label, has: (item) => item.budgetKey === band.key }))),
		group('start', 'Starts in', [...starts.values()].sort((a, b) => b.coverage - a.coverage || a.label.localeCompare(b.label))),
		group('comfort', 'Comfort level', COMFORT.map((item) => ({ value: item.key, label: item.label, has: (tour) => tour.comfort.includes(item.key) })))
	].filter((item): item is FacetGroup => item !== null);
}

export type AgeChoice = { value: string; label: string; count: number };

/**
 * "Travelling with children": the youngest traveller's age, each with the
 * safaris that welcome it. Hidden while no tour sets a minimum age.
 */
export function ageChoices(facts: TourFacts[], query: TourQuery): AgeChoice[] {
	if (!facts.some((item) => item.minAge > 0) && query.age === null) return [];
	const test = matcher({ ...query, age: null });
	const open = facts.filter((item) => test(item));
	return [
		{ value: '', label: 'No children', count: open.length },
		...Array.from({ length: 18 }, (_, age) => ({
			value: String(age),
			label: age === 0 ? 'Under 1 year' : `${age} ${age === 1 ? 'year' : 'years'}`,
			count: open.filter((item) => item.minAge <= age).length
		}))
	];
}

export type FilterChip = { facet: FacetId | 'search' | 'age'; value: string; label: string };

/** The chosen filters as removable chips, in panel order. */
export function activeChips(query: TourQuery, groups: FacetGroup[]): FilterChip[] {
	const chips: FilterChip[] = [];
	if (query.search) chips.push({ facet: 'search', value: query.search, label: `“${query.search}”` });
	for (const item of groups) for (const option of item.options) if (option.checked) chips.push({ facet: item.id, value: option.value, label: option.label });
	if (query.age !== null) chips.push({ facet: 'age', value: String(query.age), label: query.age === 0 ? 'Child under 1' : `Youngest ${query.age}` });
	return chips;
}

// ---------------------------------------------------------------------------
// What the sections under the list draw from the safaris on show.

/** The places the shown safaris visit, the most visited first. */
export function routePlaces(results: TourFacts[]): { id: string; name: string; count: number }[] {
	const places = new Map<string, { id: string; name: string; count: number; first: number }>();
	results.forEach((item, order) =>
		item.places.forEach((place) => {
			const known = places.get(place.id);
			if (known) known.count += 1;
			else places.set(place.id, { ...place, count: 1, first: order });
		})
	);
	return [...places.values()].sort((a, b) => b.count - a.count || a.first - b.first).map(({ id, name, count }) => ({ id, name, count }));
}

/** Reviews of the shown safaris first, then featured ones, then the rest in order. */
export function reviewsFirst<T extends { tour_id?: string | null; is_featured?: boolean | null }>(reviews: T[], tourIds: Set<string>): T[] {
	const rank = (review: T) => (review.tour_id && tourIds.has(review.tour_id) ? 0 : review.is_featured ? 1 : 2);
	return reviews.map((review, index) => ({ review, index })).sort((a, b) => rank(a.review) - rank(b.review) || a.index - b.index).map(({ review }) => review);
}
