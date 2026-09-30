<script lang="ts">
	import { ArrowRight, Route, Sparkles } from '@lucide/svelte';
	import StayPhoto from './stay-photo.svelte';
	import { stayTypeIcon } from './stay-icons';
	import { SAFARI_STYLE_THEME } from '$lib/safari-pricing';
	import { stayLocation, stayStyle, stayStyleLabel, stayTypeLabel } from '$lib/stay-content';
	import type { Destination, Stay } from '$lib/types/api';

	// Same design language as the tour card: photo, bold title, a muted place
	// line, divider rows, and the yellow button. The title link covers the card.
	let { stay, destination = null, headingLevel = 3 }: { stay: Stay; destination?: Destination | null; headingLevel?: 2 | 3 } = $props();
	let href = $derived(`/stays/${encodeURIComponent(stay.slug)}`);
	let location = $derived(stayLocation(stay));
	let style = $derived(stayStyle(stay));
	let theme = $derived(SAFARI_STYLE_THEME[style]);
	let type = $derived(stayTypeLabel(stay.lodge_type));
	let TypeIcon = $derived(stayTypeIcon(stay.lodge_type));
	let tours = $derived(Math.max(0, Math.floor(Number(stay.tour_count) || 0)));
</script>

<article data-motion="card" data-motion-hover="card" class="stay-card group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_18px_40px_-34px_rgb(15_35_55/.45)]">
	<div class="relative aspect-[16/10] overflow-hidden bg-navy">
		<div class="absolute inset-0 transition-transform duration-[350ms] ease-out group-hover:scale-[1.04] motion-reduce:transition-none">
			<StayPhoto {stay} {destination} />
		</div>
		{#if stay.is_featured}<span class="featured-badge">Featured</span>{/if}
	</div>
	<div class="flex flex-1 flex-col p-5 sm:p-6">
		<svelte:element this={`h${headingLevel}`} class="text-lg leading-snug font-bold tracking-[-.02em] text-navy sm:text-xl"><a {href} class="stay-link">{stay.name}</a></svelte:element>
		{#if location}<p class="mt-2 text-sm leading-6 text-muted-foreground">{location}</p>{/if}
		<dl class="mt-auto pt-5">
			<div class="card-row">
				<dt><Sparkles class="size-[18px]" strokeWidth={1.7} aria-hidden="true" />Style</dt>
				<dd class="font-bold"><span class="style-dot" style={`background:${theme.primary}`} aria-hidden="true"></span>{stayStyleLabel(stay)}</dd>
			</div>
			{#if type}
				<div class="card-row">
					<dt><TypeIcon class="size-[18px]" strokeWidth={1.7} aria-hidden="true" />Type</dt>
					<dd>{type}</dd>
				</div>
			{/if}
			{#if tours > 0}
				<div class="card-row">
					<dt><Route class="size-[18px]" strokeWidth={1.7} aria-hidden="true" />Safaris</dt>
					<dd>On {tours} {tours === 1 ? 'safari' : 'safaris'}</dd>
				</div>
			{/if}
		</dl>
		<span class="stay-cta" aria-hidden="true">View Stay <ArrowRight class="size-4" /></span>
	</div>
</article>

<style>
	/* One link per card: the title link covers the whole card. */
	.stay-link::after { content: ''; position: absolute; inset: 0; z-index: 2; }
	.stay-link:focus-visible { outline: none; }
	:global(.stay-card:has(.stay-link:focus-visible)) { outline: 3px solid var(--sun); outline-offset: 4px; }
	.featured-badge { position: absolute; top: 0.85rem; left: 0.85rem; z-index: 1; border-radius: 999px; background: var(--sun); padding: 0.3rem 0.75rem; color: var(--navy); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
	.card-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-top: 1px solid var(--border); padding: 0.9rem 0; }
	.card-row dt { display: flex; flex-shrink: 0; align-items: center; gap: 0.6rem; font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted-foreground); }
	.card-row dd { display: flex; min-width: 0; align-items: center; justify-content: flex-end; gap: 0.5rem; text-align: right; font-size: 15px; color: var(--navy); }
	.style-dot { width: 0.6rem; height: 0.6rem; flex-shrink: 0; border-radius: 999px; box-shadow: 0 0 0 3px rgb(15 35 55 / 0.06); }
	.stay-cta { display: flex; align-items: center; justify-content: center; gap: 8px; height: 3rem; margin-top: 0.5rem; border-radius: 0.75rem; background: var(--sun); color: var(--navy); font-size: 15px; font-weight: 700; }
	.stay-cta :global(svg) { transition: translate 180ms ease-out; }
	:global(.stay-card:hover) .stay-cta :global(svg) { translate: 3px 0; }
	@media (min-width: 640px) { .card-row dd { font-size: 16px; } .stay-cta { height: 3.25rem; font-size: 16px; } }
	@media (prefers-reduced-motion: reduce) { .stay-cta :global(svg) { transition: none; } :global(.stay-card:hover) .stay-cta :global(svg) { translate: none; } }
</style>
