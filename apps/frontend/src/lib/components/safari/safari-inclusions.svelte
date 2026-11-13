<script lang="ts">
	import { ArrowRight, Check, CircleCheck, CircleMinus, Minus } from '@lucide/svelte';
	import type { TourDetail } from '$lib/types/api';

	// What the tour includes and excludes, from the shared CMS library, and a
	// way into its activities when it has any.
	let { tour, activityCount, optionalCount, onActivities }: { tour: TourDetail; activityCount: number; optionalCount: number; onActivities: () => void } = $props();
	let inclusions = $derived([...(tour.tour_inclusions ?? [])].sort((a, b) => a.sort_order - b.sort_order));
	let exclusions = $derived([...(tour.tour_exclusions ?? [])].sort((a, b) => a.sort_order - b.sort_order));
</script>

<section id="included" class="sp-section inclusions" aria-labelledby="inclusions-title">
	<div class="sp-head heading">
		<h2 id="inclusions-title" class="sp-h2">What’s included in your journey</h2>
	</div>
	<div class="inclusion-grid" class:single={!inclusions.length || !exclusions.length}>
		{#if inclusions.length}
			<div class="included">
				<h3><CircleCheck aria-hidden="true" />Included</h3>
				<ul>{#each inclusions as item (item.option_id ?? item.title)}<li><Check aria-hidden="true" />{item.title}</li>{/each}</ul>
			</div>
		{/if}
		{#if exclusions.length}
			<div class="excluded">
				<h3><CircleMinus aria-hidden="true" />Excluded</h3>
				<ul>{#each exclusions as item (item.option_id ?? item.title)}<li><Minus aria-hidden="true" />{item.title}</li>{/each}</ul>
			</div>
		{/if}
	</div>
	{#if activityCount}
		<div class="activities">
			<div><h3>Make this safari your own</h3><p>{optionalCount ? `${optionalCount} optional ${optionalCount === 1 ? 'experience' : 'experiences'} to add. Any additional cost is shown before you choose.` : 'See the experiences included on your safari.'}</p></div>
			<button type="button" class="sp-btn outline" onclick={onActivities}>{optionalCount ? 'View optional activities' : 'View safari activities'} <ArrowRight aria-hidden="true" /></button>
		</div>
	{/if}
</section>

<style>
	.inclusion-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; }
	.inclusion-grid.single { grid-template-columns: minmax(0, 1fr); }
	h3 { display: flex; align-items: center; gap: 10px; margin: 0 0 22px; font-size: var(--text-xl); font-weight: 650; color: var(--sp-ink); }
	h3 :global(svg) { width: 22px; height: 22px; }
	ul { display: grid; gap: 14px; margin: 0; padding: 0; list-style: none; }
	li { display: grid; grid-template-columns: 20px 1fr; gap: 12px; font-size: var(--text-base); line-height: 1.7; color: var(--sp-muted); }
	li :global(svg) { width: 18px; height: 18px; margin-top: 3px; }
	.included :global(svg) { color: var(--sp-green); }
	.excluded :global(svg) { color: #9a927f; }
	.excluded { padding-left: 56px; border-left: 1px solid var(--sp-line-soft); }
	.inclusion-grid.single .excluded { padding-left: 0; border-left: 0; }
	.activities { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px; margin-top: 40px; padding: 22px 26px; border-radius: var(--radius-surface); background: var(--sp-cream); }
	.activities h3 { margin: 0 0 4px; font-size: var(--text-lg); }
	.activities p { margin: 0; font-size: var(--text-sm); line-height: 1.7; color: var(--sp-muted); }
	.outline { border: 1px solid #cfc8b6; background: #fff; color: var(--sp-ink); }
	.outline:hover { border-color: #b99700; }
	@media (max-width: 767px) {
		.inclusion-grid { grid-template-columns: 1fr; gap: 32px; }
		.excluded { padding: 28px 0 0; border-left: 0; border-top: 1px solid var(--sp-line-soft); }
		.inclusion-grid.single .excluded { padding-top: 0; border-top: 0; }
		.activities { padding: 20px; }
	}
</style>
