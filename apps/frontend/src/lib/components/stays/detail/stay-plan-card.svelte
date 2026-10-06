<script lang="ts">
	import { ArrowRight, Compass, ExternalLink, MapPin } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { mapUrl, nightlyRate, stayCoordinates, stayStyleLabel, stayTypeLabel } from '$lib/stay-content';
	import type { StayDetail } from '$lib/types/api';

	// "Plan your stay": what to do next. The facts live in the strip above, so
	// they are not repeated here.
	let { stay, canEnquire = false, onEnquire }: { stay: StayDetail; canEnquire?: boolean; onEnquire: () => void } = $props();
	let kind = $derived([stayStyleLabel(stay), stayTypeLabel(stay.lodge_type)].filter(Boolean).join(' · '));
	let rate = $derived(nightlyRate(stay));
	let coordinates = $derived(stayCoordinates(stay));
	let destination = $derived(stay.destination?.slug && stay.destination.name ? stay.destination : null);
	let tours = $derived(stay.featured_in_tours?.length ?? 0);
</script>

<aside aria-labelledby="plan-title" class="h-fit rounded-2xl bg-white p-7 shadow-[0_30px_60px_-40px_rgb(15_35_55/.45)] ring-1 ring-navy/10 lg:sticky lg:top-[calc(var(--site-header-height)+5rem)]">
	<h3 id="plan-title" class="eyebrow text-[var(--gold-ink)]">Plan your stay</h3>
	<p class="mt-3 font-display text-[28px] leading-tight font-medium text-navy">{stay.name}</p>
	<p class="mt-1 text-sm text-muted-foreground">{kind}</p>
	{#if rate}<p class="mt-5 text-sm font-semibold text-navy">{rate}</p>{/if}
	{#if destination || coordinates}
		<ul class="plan-links mt-6">
			{#if destination}<li><a href={`/destinations/${encodeURIComponent(destination.slug)}`}><Compass class="size-4" aria-hidden="true" />Explore {destination.name}<ArrowRight class="ml-auto size-3.5" aria-hidden="true" /></a></li>{/if}
			{#if coordinates}<li><a href={mapUrl(coordinates)} target="_blank" rel="noopener noreferrer" class="map-link"><MapPin class="size-4" aria-hidden="true" />View on the map<ExternalLink class="ml-auto size-3.5" aria-hidden="true" /><span class="sr-only"> (opens Google Maps in a new tab)</span></a></li>{/if}
		</ul>
	{/if}
	{#if canEnquire}<Button variant="safari" href="#request-quote" onclick={onEnquire} class="mt-6 h-12 w-full rounded-full text-sm">Enquire about this stay <ArrowRight class="size-4" /></Button>{/if}
	{#if tours}<a href="#safaris" class="mt-4 block text-center text-sm text-muted-foreground underline decoration-border decoration-2 underline-offset-4 hover:text-navy hover:decoration-sun">Included on {tours} {tours === 1 ? 'safari' : 'safaris'}</a>{/if}
</aside>

<style>
	.plan-links { border-top: 1px solid color-mix(in oklch, var(--navy) 10%, transparent); }
	.plan-links a { display: flex; min-height: 3rem; align-items: center; gap: 0.6rem; border-bottom: 1px solid color-mix(in oklch, var(--navy) 10%, transparent); color: var(--navy); font-size: 14px; font-weight: 500; }
	.plan-links a :global(svg:first-child) { color: #D9A900; }
	.plan-links a :global(svg:last-of-type) { color: var(--muted-foreground); transition: translate 160ms ease-out; }
	.plan-links a:hover :global(svg:last-of-type) { translate: 3px 0; color: var(--navy); }
	@media (prefers-reduced-motion: reduce) { .plan-links a:hover :global(svg:last-of-type) { translate: none; } }
</style>
