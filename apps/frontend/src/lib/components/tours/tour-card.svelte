<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight, Clock, Heart, MapPin } from '@lucide/svelte';
	import { routeSentence, tourDurationTitle, tourFromPrice, tourPhotos } from '$lib/home-content';
	import { savedTours } from '$lib/saved-tours.svelte';
	import type { Tour } from '$lib/types/api';

	// The one tour card on the site: home, tours, destinations, stays and the
	// "more journeys" row on a tour all draw this, so a tour looks the same everywhere.
	// `photo` comes from tourPhotos() over the whole grid, so image-less neighbours differ.
	// A framed photo with the length on it, then the title, the route and the
	// price; the title link covers the card and only the heart sits above it.
	let { tour, photo }: { tour: Tour; photo?: string } = $props();
	let image = $derived(photo || tourPhotos([tour])[0]);
	let duration = $derived(tourDurationTitle(tour.duration_days, tour.duration_nights));
	let length = $derived(duration.replace(' / ', ' · ').toLowerCase());
	let route = $derived(routeSentence(tour));
	let price = $derived(tourFromPrice(tour));
	let href = $derived(`/tours/${encodeURIComponent(tour.slug)}`);
	let saved = $derived(savedTours.has(tour.slug));

	onMount(() => savedTours.load());
	const toggleSaved = () => savedTours.toggle({ slug: tour.slug, title: tour.title, image, duration });
</script>

<article data-motion="card" data-motion-hover="card" class="tour-card">
	<div class="tour-photo">
		<img src={image} alt={tour.title} loading="lazy" width="640" height="440" />
		{#if length}<span class="tour-length"><Clock class="size-3.5" strokeWidth={2} aria-hidden="true" />{length}</span>{/if}
		<button type="button" onclick={toggleSaved} aria-pressed={saved} aria-label={saved ? `Remove ${tour.title} from saved safaris` : `Save ${tour.title}`} class="save-button">
			<Heart class={`size-[18px] transition-colors ${saved ? 'fill-[#e5484d] text-[#e5484d]' : 'text-navy'}`} strokeWidth={1.9} />
		</button>
	</div>
	<div class="tour-body">
		<!-- Safety nets for unexpected data; the editor's limits keep real titles inside them.
		     Three lines, not two: the tours already live need three at every card width. -->
		<h3 class="tour-title"><a {href} class="tour-link">{tour.title}</a></h3>
		{#if route}<p class="tour-route"><MapPin class="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" /><span>{route}</span></p>{/if}
		<div class="tour-foot">
			<p class="tour-price">
				{#if price}<span class="from">From</span><strong>{price}</strong><span class="from">pp</span>{:else}<strong class="ask">Price on request</strong>{/if}
			</p>
			<span class="tour-go" aria-hidden="true"><ArrowRight class="size-[18px]" /></span>
		</div>
	</div>
</article>

<style>
	.tour-card { position: relative; display: flex; flex-direction: column; height: 100%; padding: 8px; border-radius: 14px; background: white; box-shadow: 0 0 0 1px rgb(43 39 34 / 0.08), 0 18px 40px -34px rgb(39 36 31 / 0.5); transition: box-shadow 0.25s ease, scale 0.18s ease; }
	.tour-card:active { scale: 0.99; }
	.tour-photo { position: relative; isolation: isolate; aspect-ratio: 16 / 11; overflow: hidden; border-radius: 9px; background: var(--navy); }
	.tour-photo::after { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08); background: linear-gradient(0deg, rgb(20 18 15 / 0.42), rgb(20 18 15 / 0) 38%); pointer-events: none; }
	.tour-photo img { width: 100%; height: 100%; object-fit: cover; transition: scale 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
	.tour-length { position: absolute; left: 10px; bottom: 10px; z-index: 1; display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 9px; border-radius: 6px; background: rgb(255 255 255 / 0.94); color: var(--navy); font-size: 12px; font-weight: 600; }
	.save-button { position: absolute; top: 10px; right: 10px; z-index: 3; display: grid; place-items: center; width: 2.5rem; height: 2.5rem; border-radius: var(--radius-control); background: rgb(255 255 255 / 0.95); box-shadow: 0 8px 20px -12px rgb(39 36 31 / 0.55); transition: scale 160ms ease-out; }
	.save-button:active { scale: 0.9; }
	.save-button:focus-visible { outline: 3px solid var(--sun); outline-offset: 2px; }
	.tour-body { display: flex; flex: 1; flex-direction: column; padding: 14px 10px 6px; }
	/* Room for three title lines on every card, so the rows below line up across a grid. */
	.tour-title { display: -webkit-box; min-height: 4.35em; margin: 0; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; color: var(--navy); font-size: 17px; font-weight: 600; line-height: 1.45; letter-spacing: -0.015em; overflow-wrap: anywhere; }
	.tour-link { color: inherit; text-decoration: none; }
	.tour-link::after { content: ''; position: absolute; inset: 0; z-index: 2; }
	.tour-link:focus-visible { outline: none; }
	.tour-card:has(.tour-link:focus-visible) { outline: 3px solid var(--sun); outline-offset: 4px; }
	.tour-route { display: flex; align-items: center; gap: 6px; margin: 6px 0 0; overflow: hidden; color: var(--muted-foreground); font-size: 13px; line-height: 1.4; }
	.tour-route :global(svg) { color: #b08a1e; }
	.tour-route span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.tour-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 16px; }
	.tour-price { display: flex; align-items: baseline; gap: 5px; min-width: 0; margin: 0; color: var(--navy); }
	.tour-price strong { font-family: var(--font-display); font-size: 19px; font-weight: 600; letter-spacing: -0.01em; font-variant-numeric: lining-nums; }
	.tour-price strong.ask { font-family: inherit; font-size: 14px; }
	.from { color: var(--muted-foreground); font-size: 12.5px; }
	.tour-go { display: grid; place-items: center; width: 40px; height: 40px; flex: none; border-radius: var(--radius-control); background: #f1ede4; color: var(--navy); transition: background-color 0.2s ease, translate 0.2s ease; }
	@media (hover: hover) {
		.tour-card:hover { box-shadow: 0 0 0 1px rgb(43 39 34 / 0.1), 0 26px 50px -34px rgb(39 36 31 / 0.6); }
		.tour-card:hover .tour-photo img { scale: 1.05; }
		.tour-card:hover .tour-go { background: var(--sun); }
		.tour-card:hover .tour-go :global(svg) { translate: 2px 0; }
		.save-button:hover { scale: 1.06; }
	}
	.tour-go :global(svg) { transition: translate 0.2s ease; }
	/* One card a row: no need to hold space for a third title line. */
	@media (max-width: 639px) { .tour-title { min-height: 0; } }
	@media (prefers-reduced-motion: reduce) {
		.tour-card, .tour-photo img, .save-button, .tour-go, .tour-go :global(svg) { transition: none; }
		.tour-card:active, .tour-card:hover .tour-photo img, .save-button:hover, .save-button:active { scale: none; }
		.tour-card:hover .tour-go :global(svg) { translate: none; }
	}
</style>
