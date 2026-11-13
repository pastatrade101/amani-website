<script lang="ts">
	import { MapPin, Route, Sparkles, Users } from '@lucide/svelte';
	import { groupSizeLabel, readableLabel, sortedDays, stylesLabel } from '$lib/tour-itinerary';
	import { displayName } from '$lib/safari-page';
	import type { SafariStyle } from '$lib/safari-pricing';
	import type { TourDetail } from '$lib/types/api';

	// "The practical details, made simple": where the trip starts and ends,
	// group size and suitability, and how travellers get around — each only
	// when the tour records it.
	let { tour, styles }: { tour: TourDetail; styles: SafariStyle[] } = $props();

	let items = $derived.by(() => {
		const list: { icon: typeof MapPin; title: string; text: string }[] = [];
		const start = displayName(tour.start_point?.name);
		const end = displayName(tour.end_point?.name);
		const ends = start && end ? (start === end ? `Starts and ends in ${start}.` : `Starts in ${start} and ends in ${end}.`) : start ? `Starts in ${start}.` : end ? `Ends in ${end}.` : '';
		if (ends) list.push({ icon: MapPin, title: 'Where it starts and ends', text: ends });

		const group = groupSizeLabel(tour.group_size_min, tour.group_size_max);
		const age = Number(tour.minimum_age) > 0 ? `minimum age ${tour.minimum_age}` : '';
		const level = readableLabel(tour.difficulty_level);
		const suits = [group, age, level ? `${level.toLowerCase()} pace` : ''].filter(Boolean);
		if (suits.length) list.push({ icon: Users, title: 'Group size and suitability', text: `${suits.join(' · ')}.`.replace(/^./, (letter) => letter.toUpperCase()) });

		const modes = new Set(sortedDays(tour.itinerary_days).filter((day) => day.day_number > 1).map((day) => day.travel_mode).filter(Boolean));
		const ways = [modes.has('DRIVE') ? 'by road' : '', modes.has('FLY') ? 'by air' : '', modes.has('BOAT') ? 'by boat' : ''].filter(Boolean);
		if (ways.length) list.push({ icon: Route, title: 'Getting around', text: `You travel between stops ${ways.length > 1 ? `${ways.slice(0, -1).join(', ')} and ${ways.at(-1)}` : ways[0]}, as set out day by day.` });
		else if (styles.length) list.push({ icon: Sparkles, title: 'Travel styles', text: `Offered as ${stylesLabel(styles).replace(/ · /g, ', ')}. Compare them under Pricing.` });
		return list;
	});
</script>

{#if items.length > 1}
	<section class="sp-section practical" aria-labelledby="practical-title">
		<div class="practical-heading"><h2 id="practical-title" class="sp-h2">The practical details, made simple.</h2></div>
		<div class="practical-grid">
			{#each items as item}
				<div class="practical-item"><item.icon aria-hidden="true" /><div><h3>{item.title}</h3><p>{item.text}</p></div></div>
			{/each}
		</div>
	</section>
{/if}

<style>
	.practical-heading { margin-bottom: 30px; }
	.practical .sp-h2 { margin: 0; font-size: var(--text-h3); }
	.practical-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px; }
	.practical-item { display: flex; align-items: flex-start; gap: 14px; }
	.practical-item :global(svg) { flex-shrink: 0; width: 22px; height: 22px; margin-top: 2px; color: #98723c; }
	h3 { margin: 0 0 8px; font-size: var(--text-base); font-weight: 600; color: var(--sp-ink); }
	p { margin: 0; font-size: var(--text-sm); line-height: 1.8; color: var(--sp-muted); }
	@media (max-width: 767px) { .practical-grid { grid-template-columns: 1fr; gap: 22px; } }
</style>
