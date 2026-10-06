import {
	Accessibility,
	AirVent,
	Armchair,
	Bath,
	BedDouble,
	Binoculars,
	Camera,
	Car,
	Caravan,
	Check,
	ConciergeBell,
	Crown,
	DoorOpen,
	Dumbbell,
	Fan,
	Flame,
	Flower2,
	Gem,
	GlassWater,
	Heart,
	Hotel,
	House,
	Leaf,
	LockKeyhole,
	Luggage,
	Mountain,
	Plug,
	ShieldCheck,
	Shirt,
	ShowerHead,
	CircleParking,
	Sun,
	Tent,
	TreePalm,
	User,
	Users,
	UsersRound,
	UtensilsCrossed,
	WavesLadder,
	Wifi,
	Wine,
	Zap
} from '@lucide/svelte';
import type { SafariStyle } from '$lib/safari-pricing';

type Icon = typeof Hotel;

/** Same icons as the Budget / Midrange / Luxury tabs on tour pages. */
export const STYLE_ICONS: Record<SafariStyle, Icon> = { budget: Tent, midrange: BedDouble, luxury: Crown };

const TYPE_ICONS: Record<string, Icon> = {
	SAFARI_LODGE: Binoculars,
	TENTED_CAMP: Tent,
	MOBILE_CAMP: Caravan,
	HOTEL: Hotel,
	BEACH_RESORT: TreePalm,
	BOUTIQUE_HOTEL: Gem,
	ECO_LODGE: Leaf,
	VILLA: House,
	GUEST_HOUSE: DoorOpen
};

export const stayTypeIcon = (value: unknown): Icon => TYPE_ICONS[String(value ?? '').toUpperCase()] ?? Hotel;

/** The CMS amenity icon keys (database/migrations/2026-08-1x-accommodation-*.sql). */
const AMENITY_ICONS: Record<string, Icon> = {
	pool: WavesLadder,
	wifi: Wifi,
	restaurant: UtensilsCrossed,
	dining: UtensilsCrossed,
	bar: Wine,
	spa: Flower2,
	laundry: Shirt,
	transfer: Car,
	safari: Binoculars,
	deck: Armchair,
	balcony: Armchair,
	shower: ShowerHead,
	bathroom: ShowerHead,
	bath: Bath,
	ac: AirVent,
	fan: Fan,
	net: ShieldCheck,
	family: Users,
	solar: Sun,
	power: Plug,
	generator: Zap,
	campfire: Flame,
	fireplace: Flame,
	gym: Dumbbell,
	'room-service': ConciergeBell,
	accessibility: Accessibility,
	parking: CircleParking,
	safe: LockKeyhole,
	minibar: GlassWater,
	luggage: Luggage
};

export const amenityIcon = (key: unknown): Icon => AMENITY_ICONS[String(key ?? '').trim().toLowerCase()] ?? Check;

/** The CMS "best for" codes (same list as bestForLabels in stay-content). */
const BEST_FOR_ICONS: Record<string, Icon> = {
	COUPLES: Heart,
	HONEYMOON: Gem,
	FAMILIES: Users,
	GROUPS: UsersRound,
	SOLO_TRAVELERS: User,
	SENIORS: Armchair,
	LUXURY_TRAVELERS: Crown,
	ADVENTURE_TRAVELERS: Mountain,
	PHOTOGRAPHERS: Camera
};

export const bestForIcon = (code: string): Icon => BEST_FOR_ICONS[String(code ?? '').trim().toUpperCase()] ?? Check;
