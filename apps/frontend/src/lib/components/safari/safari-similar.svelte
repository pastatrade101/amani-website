<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import CardSlider from '$lib/components/card-slider.svelte';
	import TourCard from '$lib/components/tours/tour-card.svelte';
	import { tourPhotos } from '$lib/home-content';
	import type { Tour } from '$lib/types/api';

	// Three other published tours, drawn with the site's one tour card.
	// A swipeable row on phones.
	let { tours }: { tours: Tour[] } = $props();
	let photos = $derived(tourPhotos(tours));
</script>

<section class="sp-section similar" aria-labelledby="similar-title" style="--slider-bleed: 5vw">
	<div class="sp-head">
		<h2 id="similar-title" class="sp-h2">More journeys into the wild.</h2>
		<p class="sp-sub">Discover another way to experience Tanzania.</p>
	</div>
	<CardSlider items={tours} label="Similar safaris" key={(tour) => tour.id} class="tour-grid">
		{#snippet card(tour, i)}<TourCard {tour} photo={photos[i]} />{/snippet}
	</CardSlider>
	<div class="more-row"><a class="more-link" href="/tours">View more tours <ArrowRight aria-hidden="true" /></a></div>
</section>

<style>
	/* Three across from tablets up; on phones the slider shows one card at a time. */
	@media (min-width: 768px) { .similar :global(.tour-grid) { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; } }
	@media (min-width: 768px) and (max-width: 960px) { .similar :global(.tour-grid) { gap: 16px; } }
	.more-row { margin-top: 36px; text-align: center; }
	.more-link { display: inline-flex; align-items: center; gap: 12px; min-height: 48px; padding: 12px 28px; border-radius: var(--radius-control); background: var(--sp-sun); color: #2b2722; font-size: var(--text-sm); font-weight: 700; text-decoration: none; }
	.more-link:hover { background: color-mix(in oklab, var(--sp-sun) 90%, black); }
	.more-link :global(svg) { width: 16px; height: 16px; }
</style>
