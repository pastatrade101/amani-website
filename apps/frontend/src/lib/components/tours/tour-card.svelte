<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight, Clock, Heart, Users } from '@lucide/svelte';
	import { routeSentence, tourDurationTitle, tourFromPrice, tourPhotos } from '$lib/home-content';
	import { savedTours } from '$lib/saved-tours.svelte';
	import type { Tour } from '$lib/types/api';

	// The one tour card on the site: home, tours, destinations, stays and the
	// "more journeys" row on a tour all draw this, so a tour looks the same everywhere.
	// `photo` comes from tourPhotos() over the whole grid, so image-less neighbours differ.
	let { tour, photo }: { tour: Tour; photo?: string } = $props();
	let image = $derived(photo || tourPhotos([tour])[0]);
	let duration = $derived(tourDurationTitle(tour.duration_days, tour.duration_nights));
	let route = $derived(routeSentence(tour));
	let price = $derived(tourFromPrice(tour));
	let href = $derived(`/tours/${encodeURIComponent(tour.slug)}`);
	let saved = $derived(savedTours.has(tour.slug));

	onMount(() => savedTours.load());
	const toggleSaved = () => savedTours.toggle({ slug: tour.slug, title: tour.title, image, duration });
</script>

<article data-motion="card" data-motion-hover="card" class="tour-card group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgb(39_36_31/.04)] transition-shadow duration-200 hover:shadow-[0_8px_20px_-14px_rgb(39_36_31/.22)]">
	<div class="relative aspect-[16/10] overflow-hidden bg-navy">
		<img src={image} alt={tour.title} loading="lazy" width="640" height="400" class="size-full object-cover transition-transform duration-[350ms] ease-out group-hover:scale-[1.04] motion-reduce:transition-none" />
		<button type="button" onclick={toggleSaved} aria-pressed={saved} aria-label={saved ? `Remove ${tour.title} from saved safaris` : `Save ${tour.title}`} class="save-button">
			<Heart class={`size-5 transition-colors ${saved ? 'fill-[#e5484d] text-[#e5484d]' : 'text-navy'}`} strokeWidth={1.8} />
		</button>
	</div>
	<div class="flex flex-1 flex-col p-5">
		<!-- Safety nets for unexpected data; the editor's limits keep real titles inside them.
		     Three lines, not two: the tours already live need three at every card width. -->
		<h3 class="tour-title line-clamp-3 wrap-anywhere text-navy"><a {href} class="tour-link">{tour.title}</a></h3>
		{#if route}<p class="mt-2 line-clamp-1 text-[13px] leading-5 wrap-anywhere text-muted-foreground">{route}</p>{/if}
		<dl class="mt-auto pt-4">
			<div class="card-row">
				<dt><Users class="size-[18px]" strokeWidth={1.7} aria-hidden="true" />Price</dt>
				<dd class="font-semibold">{price ? `From ${price} pp` : 'On request'}</dd>
			</div>
			{#if duration}
				<div class="card-row">
					<dt><Clock class="size-[18px]" strokeWidth={1.7} aria-hidden="true" />Duration</dt>
					<dd>{duration}</dd>
				</div>
			{/if}
		</dl>
		<span class="tour-cta" aria-hidden="true">View Safari <ArrowRight class="size-4" /></span>
	</div>
</article>

<style>
	/* One link per card: the title link covers the whole card; only the heart sits above it. */
	/* Room for three title lines on every card, so the rows below line up across a grid. */
	.tour-title { min-height: 4.35em; font-size: 17px; font-weight: 600; line-height: 1.45; letter-spacing: -.015em; }
	.tour-link::after { content: ''; position: absolute; inset: 0; z-index: 1; }
	.tour-link:focus-visible { outline: none; }
	:global(.tour-card:has(.tour-link:focus-visible)) { outline: 3px solid var(--sun); outline-offset: 4px; }
	.save-button { position: absolute; top: 0.85rem; right: 0.85rem; z-index: 2; display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border-radius: var(--radius-control); background: rgb(255 255 255 / .95); box-shadow: 0 8px 20px -12px rgb(39 36 31 / .55); transition: transform 160ms ease-out; }
	.save-button:hover { transform: scale(1.06); }
	.save-button:focus-visible { outline: 3px solid var(--sun); outline-offset: 2px; }
	.card-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px solid var(--border); padding: 0.75rem 0; }
	.card-row dt { display: flex; align-items: center; gap: 0.6rem; font-size: 12px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted-foreground); }
	.card-row dd { min-width: 0; text-align: right; font-size: 13px; color: var(--navy); }
	/* An outline that fills with sun when the card is hovered. */
	.tour-cta { display: flex; align-items: center; justify-content: center; gap: 8px; height: 3rem; margin-top: 0.5rem; border: 1.5px solid var(--navy); border-radius: var(--radius-control); background: #fff; color: var(--navy); font-size: 14px; font-weight: 600; transition: background-color 180ms ease-out, border-color 180ms ease-out; }
	:global(.tour-card:hover) .tour-cta { border-color: var(--sun); background: var(--sun); }
	.tour-cta :global(svg) { transition: translate 180ms ease-out; }
	:global(.tour-card:hover) .tour-cta :global(svg) { translate: 3px 0; }
	@media (prefers-reduced-motion: reduce) { .save-button, .tour-cta, .tour-cta :global(svg) { transition: none; } .save-button:hover { transform: none; } :global(.tour-card:hover) .tour-cta :global(svg) { translate: none; } }
</style>
