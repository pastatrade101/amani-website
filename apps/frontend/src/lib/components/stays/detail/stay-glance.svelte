<script lang="ts">
	import { BedDouble, Clock, Hotel, MapPin, Moon, Plane, Users } from '@lucide/svelte';
	import { SAFARI_STYLE_THEME } from '$lib/safari-pricing';
	import { childrenPolicy, nightsLabel, stayStyle, stayStyleLabel, stayTypeLabel } from '$lib/stay-content';
	import type { StayDetail } from '$lib/types/api';

	// The facts at a glance, as one panel of tiles. Each fact only when the CMS
	// has it; style is always known, so the panel is never empty.
	let { stay }: { stay: StayDetail } = $props();
	let dot = $derived(SAFARI_STYLE_THEME[stayStyle(stay)].primary);
	let facts = $derived(
		[
			{ label: 'Style', value: stayStyleLabel(stay), icon: BedDouble, dot: true },
			{ label: 'Setting', value: stayTypeLabel(stay.lodge_type), icon: Hotel, dot: false },
			{ label: 'Location', value: stay.park_area?.trim() || stay.region?.trim() || stay.country?.trim() || '', icon: MapPin, dot: false },
			{ label: 'Nearest airport', value: [stay.nearest_airport?.trim(), stay.distance_airstrip?.trim()].filter(Boolean).join(' · '), icon: Plane, dot: false },
			{ label: 'Transfer', value: stay.transfer_time?.trim() ?? '', icon: Clock, dot: false },
			{ label: 'Children', value: childrenPolicy(stay), icon: Users, dot: false },
			// Most stays are set to one night, so only a longer recommendation is worth a place here.
			{ label: 'Recommended stay', value: Number(stay.recommended_nights) >= 2 ? nightsLabel(stay.recommended_nights) : '', icon: Moon, dot: false }
		].filter((fact) => fact.value)
	);
	// Wide screens: even rows (4 + 3, 3 + 3, 3 + 2) so no value is squeezed.
	let wide = $derived(facts.length === 4 || facts.length >= 7 ? 4 : 3);
</script>

<div class="panel"><dl class="glance" style={`--wide:${wide}`}>
	{#each facts as fact (fact.label)}
		{@const Icon = fact.icon}
		<div class="fact">
			<dt><Icon class="size-4" strokeWidth={1.7} aria-hidden="true" />{fact.label}</dt>
			<dd>{#if fact.dot}<span class="dot" style={`background:${dot}`} aria-hidden="true"></span>{/if}<span class="min-w-0">{fact.value}</span></dd>
		</div>
	{/each}
</dl></div>

<style>
	/* One white panel; each tile draws a hairline on its right and foot, and the
	   grid overhangs the panel by 1px so the outer edges stay clean. */
	.panel { overflow: hidden; border-radius: 12px; background: white; box-shadow: 0 0 0 1px rgb(43 39 34 / 0.09), 0 20px 40px -36px rgb(39 36 31 / 0.5); }
	.glance { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0 -1px -1px 0; }
	.fact { min-width: 0; padding: 16px 16px 17px; box-shadow: inset -1px 0 0 rgb(43 39 34 / 0.09), inset 0 -1px 0 rgb(43 39 34 / 0.09); }
	dt { display: flex; align-items: center; gap: 7px; color: var(--muted-foreground); font-size: var(--text-xs); font-weight: 500; }
	dt :global(svg) { flex: none; color: #b08a1e; }
	dd { display: flex; align-items: center; gap: 8px; margin: 8px 0 0; color: var(--navy); font-family: var(--font-display); font-size: var(--text-base); font-weight: 600; line-height: 1.25; letter-spacing: -0.01em; }
	.dot { width: 8px; height: 8px; flex: none; border-radius: 50%; }
	/* An odd tile out on phones spans the row rather than leaving a hole. */
	.fact:last-child:nth-child(odd) { grid-column: 1 / -1; }
	@media (min-width: 640px) {
		.glance { grid-template-columns: repeat(3, minmax(0, 1fr)); }
		.fact:last-child:nth-child(odd) { grid-column: auto; }
		.fact { padding: 20px 22px 22px; }
		dd { font-size: var(--text-lg); }
	}
	@media (min-width: 1024px) { .glance { grid-template-columns: repeat(var(--wide), minmax(0, 1fr)); } }
</style>
