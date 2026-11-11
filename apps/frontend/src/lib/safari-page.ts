import { sortedDays } from './tour-itinerary.js';
import type { ItineraryDay, TourDetail } from './types/api.js';

/**
 * Pure helpers behind the tour page design (/tours/{slug}). Everything here
 * reads CMS data as it is: a section, line or map stop is only produced when
 * the tour actually records it.
 */

const clean = (value?: string | null) => (value ?? '').replace(/\s+/g, ' ').trim();

/** "Tanzania · Private wildlife safari": the country and the tour's experience type (or category). */
export function heroEyebrow(tour: Pick<TourDetail, 'destinations' | 'tour_destinations' | 'experience_type' | 'tour_categories'>): string {
	const linked = [...(tour.tour_destinations ?? [])].sort((a, b) => a.sort_order - b.sort_order);
	const country = clean(tour.destinations?.country) || clean(linked.find((link) => link.destinations?.country)?.destinations?.country);
	const kind = clean(tour.experience_type) || clean(tour.tour_categories?.name);
	return [country, kind].filter(Boolean).join(' · ');
}

/** How many places the tour visits: its linked destinations, else the places its days are spent in. */
export function destinationCount(tour: Pick<TourDetail, 'tour_destinations' | 'itinerary_days'>): number {
	const linked = new Set((tour.tour_destinations ?? []).map((link) => link.destination_id).filter(Boolean));
	if (linked.size) return linked.size;
	return new Set(sortedDays(tour.itinerary_days).map((day) => day.destination?.id).filter(Boolean)).size;
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen'];
/** 5 → "five" (up to fifteen), else the digits. */
export const numberWord = (value: number) => WORDS[value] ?? String(value);

/** Title-cases a name typed all in lower case ("zanzibar"); anything else is kept as written. */
export const displayName = (value?: string | null) => {
	const text = clean(value);
	return text && text === text.toLowerCase() ? text.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()) : text;
};

export type DayGroup = { label: string; place: string };

/**
 * "Days 1–2 · Northern Serengeti": consecutive days spent at one place. Only
 * when every day names its place, so the strip never skips part of the trip.
 */
export function dayGroups(days?: ItineraryDay[] | null): DayGroup[] {
	const list = sortedDays(days);
	if (!list.length || list.some((day) => !clean(day.destination?.name))) return [];
	const groups: { first: number; last: number; place: string }[] = [];
	for (const day of list) {
		const place = clean(day.destination!.name);
		const open = groups.at(-1);
		if (open && open.place === place) open.last = day.day_number;
		else groups.push({ first: day.day_number, last: day.day_number, place });
	}
	return groups.map((group) => ({ label: group.first === group.last ? `Day ${group.first}` : `Days ${group.first}–${group.last}`, place: group.place }));
}

export type TravelMode = 'FLY' | 'DRIVE' | 'BOAT' | null;
export type MapStop = { name: string; lat: number; lng: number };
export type MapLeg = { from: number; to: number; mode: TravelMode };

const coordinate = (value: unknown, limit: number) => {
	const number = typeof value === 'string' && value.trim() ? Number(value) : value;
	return typeof number === 'number' && Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
};

/**
 * The route as the map draws it: the places the days are spent in, in order,
 * with how travellers reach each one (the arriving day's travel mode; null is
 * "not stated"). Null unless every day has a place with coordinates and the
 * trip visits at least two places — a partial route would mislead.
 */
export function routeMap(days?: ItineraryDay[] | null): { stops: MapStop[]; legs: MapLeg[] } | null {
	const list = sortedDays(days);
	if (!list.length) return null;
	const stops: MapStop[] = [];
	const legs: MapLeg[] = [];
	let previous = -1;
	for (const day of list) {
		const lat = coordinate(day.destination?.latitude, 90);
		const lng = coordinate(day.destination?.longitude, 180);
		const name = clean(day.destination?.name);
		if (lat === null || lng === null || !name) return null;
		let index = stops.findIndex((stop) => stop.name === name);
		if (index === -1) index = stops.push({ name, lat, lng }) - 1;
		if (previous !== -1 && index !== previous) legs.push({ from: previous, to: index, mode: day.travel_mode ?? null });
		previous = index;
	}
	return stops.length >= 2 ? { stops, legs } : null;
}

/** Tanzania's outline (lng, lat), from the public-domain world.geo.json (Natural Earth). */
export const TANZANIA: [number, number][] = [[33.903711,-0.95],[34.07262,-1.05982],[37.69869,-3.09699],[37.7669,-3.67712],[39.20222,-4.67677],[38.74054,-5.90895],[38.79977,-6.47566],[39.44,-6.84],[39.47,-7.1],[39.19469,-7.7039],[39.25203,-8.00781],[39.18652,-8.48551],[39.53574,-9.11237],[39.9496,-10.0984],[40.31659,-10.3171],[39.521,-10.89688],[38.427557,-11.285202],[37.82764,-11.26879],[37.47129,-11.56876],[36.775151,-11.594537],[36.514082,-11.720938],[35.312398,-11.439146],[34.559989,-11.52002],[34.28,-10.16],[33.940838,-9.693674],[33.73972,-9.41715],[32.759375,-9.230599],[32.191865,-8.930359],[31.556348,-8.762049],[31.157751,-8.594579],[30.74,-8.34],[30.2,-7.08],[29.62,-6.52],[29.419993,-5.939999],[29.519987,-5.419979],[29.339998,-4.499983],[29.753512,-4.452389],[30.11632,-4.09012],[30.50554,-3.56858],[30.75224,-3.35931],[30.74301,-3.03431],[30.52766,-2.80762],[30.46967,-2.41383],[30.758309,-2.28725],[30.816135,-1.698914],[30.419105,-1.134659],[30.76986,-1.01455],[31.86617,-1.02736],[33.903711,-0.95]];

export type MapGeometry = {
	width: number;
	height: number;
	outline: string;
	countryLabel: { x: number; y: number } | null;
	points: { x: number; y: number; name: string; labelX: number; labelY: number; anchor: 'start' | 'end' }[];
	legs: { d: string; mode: TravelMode }[];
};

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Projects the outline and the stops (Mercator) into a width × height box
 * framed on the route — wide enough to show the surrounding country, close
 * enough that nearby stops stay apart — and places each label beside its
 * stop, nudging labels that would overlap. The outline runs past the frame.
 */
export function mapGeometry(route: { stops: MapStop[]; legs: MapLeg[] }, width = 360, height = 280): MapGeometry {
	const mercator = ([lng, lat]: [number, number]): [number, number] => [(lng * Math.PI) / 180, -Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
	const projectedOutline = TANZANIA.map(mercator);
	const projectedStops = route.stops.map((stop) => mercator([stop.lng, stop.lat]));
	const xs = projectedStops.map((point) => point[0]);
	const ys = projectedStops.map((point) => point[1]);
	let [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
	// At least ~2.4° across, then a margin, then the box's own proportions.
	const minimum = (2.4 * Math.PI) / 180;
	const grow = (low: number, high: number, span: number) => { const extra = Math.max(0, span - (high - low)) / 2; return [low - extra, high + extra]; };
	[minX, maxX] = grow(minX, maxX, minimum);
	[minY, maxY] = grow(minY, maxY, minimum);
	[minX, maxX] = grow(minX, maxX, (maxX - minX) * 1.45);
	[minY, maxY] = grow(minY, maxY, (maxY - minY) * 1.3);
	const pad = { top: 16, right: 16, bottom: 16, left: 16 };
	const ratio = (width - pad.left - pad.right) / (height - pad.top - pad.bottom);
	if ((maxX - minX) / (maxY - minY) < ratio) [minX, maxX] = grow(minX, maxX, (maxY - minY) * ratio);
	else [minY, maxY] = grow(minY, maxY, (maxX - minX) / ratio);
	const scale = (width - pad.left - pad.right) / (maxX - minX);
	const place = ([x, y]: [number, number]): [number, number] => [round(pad.left + (x - minX) * scale), round(pad.top + (y - minY) * scale)];

	const outline = `M${projectedOutline.map(place).map((point) => point.join(',')).join('L')}Z`;
	const centreX = width / 2;
	type Box = { x1: number; x2: number; y1: number; y2: number };
	const overlaps = (a: Box, b: Box) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
	const pins = projectedStops.map(place);
	// Every pin is an obstacle for every label.
	const taken: Box[] = pins.map(([x, y]) => ({ x1: x - 6, x2: x + 6, y1: y - 6, y2: y + 6 }));
	const labels: Box[] = [];
	const points = pins.map(([x, y], index) => {
		const name = route.stops[index].name;
		const textWidth = name.length * 5.3;
		// Labels point away from the middle of the map, so they stay inside it;
		// a crowded spot tries the other side, then a line above or below.
		const preferred: 'start' | 'end' = x > centreX ? 'end' : 'start';
		const sides: ('start' | 'end')[] = [preferred, preferred === 'start' ? 'end' : 'start'];
		const boxFor = (anchor: 'start' | 'end', labelY: number): Box => {
			const labelX = anchor === 'start' ? x + 9 : x - 9;
			return { x1: anchor === 'start' ? labelX : labelX - textWidth, x2: anchor === 'start' ? labelX + textWidth : labelX, y1: labelY - 9, y2: labelY + 3 };
		};
		let choice = { anchor: preferred, labelY: y + 3.5 };
		search: for (const shift of [0, -11, 11, -22, 22, -33, 33]) {
			for (const anchor of sides) {
				const box = boxFor(anchor, y + 3.5 + shift);
				if (box.x1 < 2 || box.x2 > width - 2) continue;
				if (![...taken, ...labels].some((other) => overlaps(box, other))) { choice = { anchor, labelY: y + 3.5 + shift }; break search; }
			}
		}
		labels.push(boxFor(choice.anchor, choice.labelY));
		return { x, y, name, labelX: round(choice.anchor === 'start' ? x + 9 : x - 9), labelY: round(choice.labelY), anchor: choice.anchor };
	});
	taken.push(...labels);
	const legs = route.legs.map((leg) => {
		const a = points[leg.from];
		const b = points[leg.to];
		if (leg.mode !== 'FLY') return { d: `M${a.x},${a.y}L${b.x},${b.y}`, mode: leg.mode };
		// Flights arc gently, so they read differently from a road.
		const [mx, my] = [(a.x + b.x) / 2, (a.y + b.y) / 2];
		const [dx, dy] = [b.x - a.x, b.y - a.y];
		const length = Math.hypot(dx, dy) || 1;
		const bend = Math.min(40, length * 0.22);
		return { d: `M${a.x},${a.y}Q${round(mx - (dy / length) * bend)},${round(my + (dx / length) * bend)} ${b.x},${b.y}`, mode: leg.mode };
	});
	// "TANZANIA" inside the country, as far as the frame allows from the route.
	const shape = projectedOutline.map(place);
	const inside = (x: number, y: number) => {
		let hit = false;
		for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
			const [xi, yi] = shape[i];
			const [xj, yj] = shape[j];
			if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
		}
		return hit;
	};
	let countryLabel: { x: number; y: number } | null = null;
	let best = 0;
	for (let gx = 1; gx < 8; gx++) {
		for (let gy = 1; gy < 6; gy++) {
			const [x, y] = [(width * gx) / 8, (height * gy) / 6];
			// The whole word must sit inside the outline.
			if (![x - 34, x, x + 34].every((px) => inside(px, y - 4))) continue;
			const clearance = Math.min(...points.map((point) => Math.hypot(point.x - x, point.y - y)), ...taken.map((box) => Math.hypot((box.x1 + box.x2) / 2 - x, (box.y1 + box.y2) / 2 - y)));
			if (clearance > best) { best = clearance; countryLabel = { x: round(x), y: round(y) }; }
		}
	}
	return { width, height, outline, countryLabel: best > 40 ? countryLabel : null, points, legs };
}

/** The route as a line of text: "Arusha → Tarangire National Park → …". */
export const routeLine = (route: { stops: MapStop[]; legs: MapLeg[] }) => {
	const order = [route.legs[0]?.from ?? 0, ...route.legs.map((leg) => leg.to)];
	return order.map((index) => route.stops[index].name);
};

export type HighlightIcon = 'plane' | 'binoculars' | 'waves' | 'tent' | 'car' | 'mountain' | 'palm' | 'users' | 'camera' | 'sparkles';

const ICON_WORDS: [RegExp, HighlightIcon][] = [
	[/\b(fly|flight|flights|fly-in|airstrip|aircraft)\b/i, 'plane'],
	[/\b(migration|herds?|wildebeest|river|crossings?)\b/i, 'waves'],
	[/\b(beach|zanzibar|island|coast|ocean)\b/i, 'palm'],
	[/\b(camp|camps|lodge|lodges|night|nights|stay|sleep)\b/i, 'tent'],
	[/\b(game drives?|wildlife|big five)\b/i, 'binoculars'],
	[/\b(crater|kilimanjaro|mountain|highlands|volcan\w*)\b/i, 'mountain'],
	[/\b(vehicle|4x4|4×4|drive|drives|driver)\b/i, 'car'],
	[/\b(culture|cultural|maasai|village|family|families|guide|guides|private)\b/i, 'users'],
	[/\b(photo|photography|sunrise|sunset|views?)\b/i, 'camera'],
	[/\b(wildlife|big five|game|lions?|elephants?|leopards?|cheetahs?|rhinos?|safari)\b/i, 'binoculars']
];

/** An icon that suits a highlight's wording; decoration only, the text is the CMS highlight. */
export const highlightIcon = (text: string): HighlightIcon => ICON_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? 'sparkles';

/** "+255 743 900 014" → "https://wa.me/255743900014"; '' when the number is not usable. */
export function whatsappLink(number?: string | null): string {
	const digits = (number ?? '').replace(/\D/g, '');
	return digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : '';
}
