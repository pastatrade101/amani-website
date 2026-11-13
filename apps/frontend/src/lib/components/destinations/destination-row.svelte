<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import LocatorMap from './locator-map.svelte';
	import { bestFor, TRAITS, type Place, type SortKey } from '$lib/destination-explorer';
	import { destinationHref } from '$lib/destination-content';
	import { formatPrice } from '$lib/safari-pricing';
	import { planHref } from '$lib/planner/plan-href';

	// One place in the explorer list: its photo (or where it is, when it has no
	// photo yet), what it is best for, and the way on: the place's page, or the
	// safaris that visit it. Hovering the row lights its pin on the map.
	let { place, others, sort = 'recommended', active = false, level = 3, onhover }: { place: Place; others: { lat: number; lng: number }[]; sort?: SortKey; active?: boolean; level?: 3 | 4; onhover?: (id: string | null) => void } = $props();

	let trait = $derived(sort === 'recommended' ? null : TRAITS.find((item) => item.key === sort) ?? null);
	let value = $derived(trait ? place.scores[trait.key] ?? null : null);
	let best = $derived(bestFor(place));
	let where = $derived([place.area, place.country].filter((part, i, all) => part && all.indexOf(part) === i).join(' · '));
	let safarisLabel = $derived(place.safaris.count ? `${place.safaris.count} ${place.safaris.count === 1 ? 'safari' : 'safaris'}${place.safaris.from ? ` from ${formatPrice(place.safaris.from.amount, place.safaris.from.currency)}` : ''}` : '');
	let failed = $state(false);
	let photo = $derived(failed ? '' : place.photos[0] ?? '');
</script>

<article class="place" class:active data-place={place.id} onpointerenter={() => onhover?.(place.id)} onpointerleave={() => onhover?.(null)} onfocusin={() => onhover?.(place.id)} onfocusout={() => onhover?.(null)}>
	<div class="place-media">
		{#if photo}<img src={photo} alt="" loading="lazy" decoding="async" onerror={() => (failed = true)} />
		{:else}<LocatorMap lat={place.lat} lng={place.lng} {others} name={place.name} country={place.country} />{/if}
	</div>
	<div class="place-body">
		{#if where}<p class="place-where">{where}</p>{/if}
		<svelte:element this={`h${level}`} class="place-title"><a href={destinationHref(place)} class="place-link">{place.name}</a></svelte:element>
		{#if place.summary}<p class="place-summary">{place.summary}</p>{/if}
		<div class="place-foot">
			{#if trait && value !== null}
				<span class="place-score"><span class="bar" aria-hidden="true"><i style:width={`${value * 10}%`}></i></span>{trait.label} {value}/10</span>
			{:else if best}
				<span class="place-best">{best}</span>
			{/if}
			{#if safarisLabel}
				<a class="place-safaris" href={`/tours?destination_id=${encodeURIComponent(place.id)}#tour-results`}>{safarisLabel}<ArrowRight aria-hidden="true" /></a>
			{:else}
				<a class="place-safaris" href={planHref({ destination: place.slug, from: 'destinations' })}>Plan a trip here<ArrowRight aria-hidden="true" /></a>
			{/if}
		</div>
	</div>
</article>

<style>
	.place { position: relative; display: grid; grid-template-columns: 184px minmax(0, 1fr); gap: 20px; padding: 14px; border-radius: var(--radius-surface); background: #fff; box-shadow: 0 0 0 1px rgb(43 39 34 / 0.07), 0 14px 30px -28px rgb(39 36 31 / 0.5); transition: box-shadow 0.2s ease, translate 0.2s ease; }
	.place.active { box-shadow: 0 0 0 2px var(--navy), 0 18px 36px -28px rgb(39 36 31 / 0.55); }
	.place-media { position: relative; overflow: hidden; aspect-ratio: 4 / 3; border-radius: var(--radius-control); background: #f1eee4; }
	.place-media img { display: block; width: 100%; height: 100%; object-fit: cover; transition: scale 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
	.place-body { display: flex; min-width: 0; flex-direction: column; padding-block: 2px; }
	.place-where { margin: 0; overflow: hidden; color: var(--muted-foreground); font-size: var(--text-xs); font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
	.place-title { margin: 4px 0 0; font-size: var(--text-lg); font-weight: 600; line-height: 1.25; letter-spacing: -0.015em; color: var(--navy); }
	/* The whole card opens the place; the safaris link sits above that. */
	.place-link { color: inherit; text-decoration: none; }
	.place-link::after { content: ''; position: absolute; inset: 0; border-radius: inherit; }
	.place-link:focus-visible { outline: none; }
	.place:has(.place-link:focus-visible) { box-shadow: 0 0 0 3px var(--sun); }
	.place-summary { display: -webkit-box; margin: 6px 0 0; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; color: var(--muted-foreground); font-size: var(--text-sm); line-height: 1.55; }
	.place-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; margin-top: auto; padding-top: 12px; }
	.place-best, .place-score { display: inline-flex; align-items: center; gap: 8px; color: var(--navy); font-size: var(--text-xs); font-weight: 600; }
	.bar { position: relative; display: block; width: 56px; height: 4px; overflow: hidden; border-radius: 2px; background: #e8e3d6; }
	.bar i { position: absolute; inset: 0 auto 0 0; background: var(--navy); }
	.place-safaris { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 6px; min-height: 32px; margin-left: auto; color: var(--navy); font-size: var(--text-sm); font-weight: 600; text-decoration: none; }
	.place-safaris :global(svg) { width: 15px; height: 15px; transition: translate 0.2s ease; }
	.place-safaris:hover :global(svg) { translate: 3px 0; }
	.place-safaris:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; border-radius: 4px; }
	@media (hover: hover) {
		.place:hover { translate: 0 -2px; box-shadow: 0 0 0 1px rgb(43 39 34 / 0.1), 0 22px 40px -28px rgb(39 36 31 / 0.55); }
		.place.active:hover { box-shadow: 0 0 0 2px var(--navy), 0 22px 40px -28px rgb(39 36 31 / 0.55); }
		.place:hover .place-media img { scale: 1.04; }
	}
	@media (max-width: 639px) {
		.place { grid-template-columns: 104px minmax(0, 1fr); gap: 14px; padding: 10px; }
		.place-media { aspect-ratio: 1; }
		.place-title { font-size: var(--text-base); }
		.place-summary { -webkit-line-clamp: 2; line-clamp: 2; font-size: var(--text-xs); }
		.place-foot { padding-top: 8px; }
		.place-best, .place-score { display: none; }
		.place-safaris { margin-left: 0; min-height: 28px; font-size: var(--text-xs); }
	}
	@media (prefers-reduced-motion: reduce) { .place, .place-media img, .place-safaris :global(svg) { transition: none; } }
</style>
