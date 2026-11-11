<script lang="ts">
	import { ArrowRight, ArrowUpRight, CalendarDays } from '@lucide/svelte';
	import CardSlider from '$lib/components/card-slider.svelte';
	import { tourFromPrice, tourPhotos } from '$lib/home-content';
	import type { Tour } from '$lib/types/api';

	// Three other published tours, as photo cards: length, category, title,
	// duration and the "from" price. A swipeable row on phones.
	let { tours }: { tours: Tour[] } = $props();
	let photos = $derived(tourPhotos(tours));
	const days = (tour: Tour) => Math.round(Number(tour.duration_days) || 0);
</script>

<section class="sp-section similar" aria-labelledby="similar-title" style="--slider-bleed: 5vw">
	<div class="sp-head">
		<p class="sp-eyebrow">Keep exploring</p>
		<h2 id="similar-title" class="sp-h2">More journeys into the wild.</h2>
		<p class="sp-sub">Discover another way to experience Tanzania.</p>
	</div>
	<CardSlider items={tours} label="Similar safaris" key={(tour) => tour.id} class="tour-grid">
		{#snippet card(tour, i)}
			{@const price = tourFromPrice(tour)}
			<article class="tour-card">
				<div class="tour-image">
					<img src={photos[i]} alt="" loading="lazy" width="480" height="270" />
					{#if days(tour)}<span class="duration"><CalendarDays aria-hidden="true" />{days(tour)} {days(tour) === 1 ? 'day' : 'days'}</span>{/if}
				</div>
				<div class="tour-body">
					{#if tour.tour_categories?.name}<p class="tour-category">{tour.tour_categories.name}</p>{/if}
					<h3>{tour.title}</h3>
					<div class="tour-meta">
						<div><small>Duration</small><strong>{days(tour) ? `${days(tour)} ${days(tour) === 1 ? 'day' : 'days'}` : '—'}</strong></div>
						<div class="tour-price"><small>Starting from</small><strong>{price ?? 'On request'}</strong>{#if price}<span>per person</span>{/if}</div>
					</div>
					<a class="tour-link" href={`/tours/${encodeURIComponent(tour.slug)}`}>View tour<span class="sr-only">: {tour.title}</span> <ArrowUpRight aria-hidden="true" /></a>
				</div>
			</article>
		{/snippet}
	</CardSlider>
	<div class="more-row"><a class="more-link" href="/tours">View more tours <ArrowRight aria-hidden="true" /></a></div>
</section>

<style>
	.similar :global(.tour-grid) { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
	.tour-card { position: relative; display: flex; flex-direction: column; height: 100%; min-width: 0; overflow: hidden; border: 1px solid var(--sp-line); border-radius: 20px; background: #fff; }
	.tour-image { position: relative; aspect-ratio: 16 / 10; overflow: hidden; background: #e2ddd0; }
	.tour-image img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform 0.35s ease; }
	.tour-card:hover img { transform: scale(1.04); }
	.duration { position: absolute; bottom: 14px; left: 14px; display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 999px; background: var(--sp-sun); color: #2b2722; font-size: 12px; font-weight: 600; }
	.duration :global(svg) { width: 14px; height: 14px; }
	.tour-body { display: flex; flex: 1; flex-direction: column; padding: 20px 22px 22px; }
	.tour-category { margin: 0 0 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--sp-kicker); }
	h3 { margin: 0 0 16px; font-size: 19px; font-weight: 650; line-height: 1.35; letter-spacing: -0.01em; color: var(--sp-ink); }
	.tour-meta { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: auto 0 18px; padding-top: 16px; border-top: 1px solid var(--sp-line-soft); }
	.tour-meta small { display: block; margin-bottom: 5px; font-size: 12px; color: var(--sp-muted); }
	.tour-meta strong { font-size: 17px; font-weight: 650; color: var(--sp-ink); }
	.tour-price { text-align: right; }
	.tour-price span { display: block; margin-top: 4px; font-size: 12px; color: var(--sp-muted); }
	.tour-link { display: flex; align-items: center; justify-content: space-between; min-height: 44px; padding-top: 16px; border-top: 1px solid var(--sp-line-soft); color: var(--sp-ink); font-size: 14px; font-weight: 600; text-decoration: none; }
	/* The whole card opens the tour. */
	.tour-link::after { content: ''; position: absolute; inset: 0; }
	.tour-link :global(svg) { width: 17px; height: 17px; }
	.tour-card:hover .tour-link { color: #7b6500; }
	.more-row { margin-top: 36px; text-align: center; }
	.more-link { display: inline-flex; align-items: center; gap: 12px; min-height: 48px; padding: 12px 28px; border-radius: 999px; background: var(--sp-sun); color: #2b2722; font-size: 14px; font-weight: 700; text-decoration: none; }
	.more-link:hover { background: color-mix(in oklab, var(--sp-sun) 90%, black); }
	.more-link :global(svg) { width: 16px; height: 16px; }
	@media (prefers-reduced-motion: reduce) { .tour-image img { transition: none; } }
</style>
