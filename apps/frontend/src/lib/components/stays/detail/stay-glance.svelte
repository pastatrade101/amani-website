<script lang="ts">
	import { SAFARI_STYLE_THEME } from '$lib/safari-pricing';
	import { childrenPolicy, nightsLabel, stayStyle, stayStyleLabel, stayTypeLabel } from '$lib/stay-content';
	import type { StayDetail } from '$lib/types/api';

	// The at-a-glance strip under the header. Each fact only when the CMS has it;
	// style is always known, so the strip is never empty.
	let { stay }: { stay: StayDetail } = $props();
	let dot = $derived(SAFARI_STYLE_THEME[stayStyle(stay)].primary);
	let facts = $derived(
		[
			{ label: 'Style', value: stayStyleLabel(stay), dot: true },
			{ label: 'Setting', value: stayTypeLabel(stay.lodge_type), dot: false },
			{ label: 'Location', value: stay.park_area?.trim() || stay.region?.trim() || stay.country?.trim() || '', dot: false },
			{ label: 'Nearest airport', value: [stay.nearest_airport?.trim(), stay.distance_airstrip?.trim()].filter(Boolean).join(' · '), dot: false },
			{ label: 'Transfer', value: stay.transfer_time?.trim() ?? '', dot: false },
			{ label: 'Children', value: childrenPolicy(stay), dot: false },
			// Most stays are set to one night, so only a longer recommendation is worth a place here.
			{ label: 'Recommended stay', value: Number(stay.recommended_nights) >= 2 ? nightsLabel(stay.recommended_nights) : '', dot: false }
		].filter((fact) => fact.value)
	);
	// Even rows on wide screens (4 + 3, 3 + 3, 3 + 2) so no value is squeezed onto two lines.
	let columns = $derived(facts.length >= 7 ? 'lg:grid-cols-4' : facts.length >= 5 ? 'lg:grid-cols-3' : facts.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3');
</script>

<dl class={`grid grid-cols-2 gap-x-6 gap-y-7 border-y border-navy/10 py-8 sm:grid-cols-3 lg:gap-x-10 ${columns}`}>
	{#each facts as fact (fact.label)}
		<div class="min-w-0 border-l border-navy/10 pl-4 lg:pl-6">
			<dt class="text-[11px] font-medium uppercase tracking-[.16em] text-muted-foreground">{fact.label}</dt>
			<dd class="mt-2 flex items-center gap-2 font-display text-[22px] leading-tight text-navy">
				{#if fact.dot}<span class="size-2 shrink-0 rounded-full" style={`background:${dot}`} aria-hidden="true"></span>{/if}<span class="min-w-0">{fact.value}</span>
			</dd>
		</div>
	{/each}
</dl>
