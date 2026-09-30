import { BedDouble, Binoculars, Caravan, Crown, DoorOpen, Gem, Hotel, House, Leaf, Tent, TreePalm } from '@lucide/svelte';
import type { Lodge } from '$lib/admin/types';
import type { SafariStyle } from '$lib/safari-pricing';

/** Shared by the lodge list and the lodge editor so both read the same words. */
export type LodgeType = Lodge['lodge_type'];
export type LodgeStatus = 'draft' | 'published' | 'hidden' | 'archived';
type Icon = typeof Hotel;

/** The backend enum (lodges.schema.ts), most common safari stays first. */
export const PROPERTY_TYPES: { value: LodgeType; label: string; icon: Icon }[] = [
  { value: 'SAFARI_LODGE', label: 'Safari lodge', icon: Binoculars },
  { value: 'TENTED_CAMP', label: 'Tented camp', icon: Tent },
  { value: 'MOBILE_CAMP', label: 'Mobile camp', icon: Caravan },
  { value: 'HOTEL', label: 'Hotel', icon: Hotel },
  { value: 'BEACH_RESORT', label: 'Beach resort', icon: TreePalm },
  { value: 'BOUTIQUE_HOTEL', label: 'Boutique hotel', icon: Gem },
  { value: 'ECO_LODGE', label: 'Eco lodge', icon: Leaf },
  { value: 'VILLA', label: 'Villa', icon: House },
  { value: 'GUEST_HOUSE', label: 'Guest house', icon: DoorOpen }
];

export const propertyTypeOf = (value: unknown): LodgeType | null =>
  PROPERTY_TYPES.find((type) => type.value === String(value ?? '').toUpperCase())?.value ?? null;

export const propertyTypeLabel = (value: unknown) =>
  PROPERTY_TYPES.find((type) => type.value === propertyTypeOf(value))?.label ?? 'Property';

export const LODGE_STATUSES: { label: string; value: LodgeStatus }[] = [
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Hidden', value: 'hidden' },
  { label: 'Archived', value: 'archived' }
];

/** Same icons as the public Budget / Midrange / Luxury tabs. */
export const STYLE_ICONS: Record<SafariStyle, Icon> = { budget: Tent, midrange: BedDouble, luxury: Crown };
export const STYLE_NAMES: Record<SafariStyle, string> = { budget: 'Budget', midrange: 'Midrange', luxury: 'Luxury' };

export const BEST_FOR_LABELS: Record<string, string> = {
  COUPLES: 'Couples',
  HONEYMOON: 'Honeymooners',
  FAMILIES: 'Families',
  GROUPS: 'Groups',
  SOLO_TRAVELERS: 'Solo travellers',
  SENIORS: 'Seniors',
  LUXURY_TRAVELERS: 'Luxury travellers',
  ADVENTURE_TRAVELERS: 'Adventure travellers',
  PHOTOGRAPHERS: 'Photographers'
};
