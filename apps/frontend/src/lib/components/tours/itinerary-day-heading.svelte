<script lang="ts">
	import { Car, Plane, Ship } from '@lucide/svelte';
	import { travelModeLabel } from '$lib/tour-itinerary';
	import type { ItineraryDay } from '$lib/types/api';

	// The words at the top of a day card on the itinerary timeline: the "Day N"
	// pill, title, summary and how travellers get there. Styled at phone size;
	// itinerary-timeline scales them up from sm and moves "Day N" into its
	// circle. The admin day editor previews with this same component, so what
	// an editor sees wrapping is what the page wraps.
	let { day }: { day: Pick<ItineraryDay, 'day_number' | 'title' | 'summary' | 'travel_mode'> } = $props();

	const modeIcons = { DRIVE: Car, FLY: Plane, BOAT: Ship };
	let mode = $derived(travelModeLabel(day));
	let ModeIcon = $derived(day.travel_mode ? modeIcons[day.travel_mode] : null);
</script>

<span class="min-w-0 flex-1">
	<span class="sr-only">Day {day.day_number}: </span>
	<span class="day-pill" aria-hidden="true">Day {day.day_number}</span>
	<span class="day-title">{day.title}</span>
	{#if day.summary}<span class="day-summary">{day.summary}</span>{/if}
	{#if mode && ModeIcon}<span class="block"><span class="mode-chip"><ModeIcon class="size-3" aria-hidden="true" />{mode}</span></span>{/if}
</span>

<style>
	.day-pill { display: inline-flex; margin-bottom: 0.45rem; border-radius: 999px; background: var(--sun); padding: 0.2rem 0.6rem; font-size: 11px; font-weight: 700; line-height: 1.3; color: var(--navy); }
	/* A long unbroken word (a pasted URL, a typo) wraps instead of pushing the card wider. */
	.day-title { display: block; font-size: 15px; font-weight: 700; line-height: 1.35; letter-spacing: -0.02em; color: var(--navy); overflow-wrap: anywhere; }
	.day-summary { display: block; margin-top: 0.3rem; font-size: 13px; font-weight: 400; line-height: 1.6; color: var(--muted-foreground); overflow-wrap: anywhere; }
	.mode-chip { display: inline-flex; align-items: center; gap: 0.3rem; margin-top: 0.55rem; border-radius: 999px; background: var(--secondary); padding: 0.2rem 0.6rem; font-size: 11px; font-weight: 500; color: var(--muted-foreground); }
</style>
