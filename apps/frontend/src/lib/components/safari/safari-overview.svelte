<script lang="ts">
	import { Binoculars, Camera, Car, ChevronDown, Mountain, Plane, Sparkles, Tent, TreePalm, Users, Waves } from '@lucide/svelte';
	import RichText from '$lib/components/tours/rich-text.svelte';
	import SafariRouteMap from './safari-route-map.svelte';
	import { textContent } from '$lib/home-content';
	import { dayGroups, highlightIcon, routeMap, type HighlightIcon } from '$lib/safari-page';
	import type { TourDetail } from '$lib/types/api';

	// "The journey at a glance": the short and full descriptions, who the tour
	// suits, its highlights, the route map and which days are spent where.
	let { tour, country }: { tour: TourDetail; country: string } = $props();
	const ICONS: Record<HighlightIcon, typeof Plane> = { plane: Plane, binoculars: Binoculars, waves: Waves, tent: Tent, car: Car, mountain: Mountain, palm: TreePalm, users: Users, camera: Camera, sparkles: Sparkles };

	let lead = $derived(textContent(tour.short_description));
	let full = $derived(textContent(tour.full_description));
	// Skip the short description when the full one already opens with it.
	let showLead = $derived(Boolean(lead) && !full.startsWith(lead.slice(0, 80)));
	let long = $derived(full.length > 520);
	let expanded = $state(false);
	let audiences = $derived((tour.persona_tags ?? []).map((tag) => tag.replace(/[_-]+/g, ' ').trim().toLowerCase()).filter(Boolean));
	let highlights = $derived((tour.highlights ?? []).map((item) => textContent(item)).filter(Boolean));
	let route = $derived(routeMap(tour.itinerary_days));
	let groups = $derived(dayGroups(tour.itinerary_days));
</script>

<section id="overview" class="sp-section overview" aria-labelledby="overview-title">
	<div class="overview-grid" class:single={!route}>
		<div class="copy">
			<p class="sp-eyebrow">The journey at a glance</p>
			<h2 id="overview-title" class="sp-h2">Why choose this safari?</h2>
			{#if showLead}<p class="intro">{lead}</p>{/if}
			{#if full}
				<div id="overview-full" class="full" class:collapsed={long && !expanded}><RichText value={tour.full_description} class="sp-rich" /></div>
				{#if long}<button type="button" class="more" aria-expanded={expanded} aria-controls="overview-full" onclick={() => (expanded = !expanded)}>{expanded ? 'Read less' : 'Read the full overview'}<ChevronDown class={expanded ? 'rotate-180' : ''} /></button>{/if}
			{/if}
			{#if audiences.length}<p class="ideal-for"><strong>Ideal for:</strong> {audiences.join(', ')}</p>{/if}
			{#if highlights.length}
				<h3 class="sr-only">Highlights</h3>
				<ul class="highlights-list">
					{#each highlights as highlight}
						{@const Icon = ICONS[highlightIcon(highlight)]}
						<li><span class="highlight-icon" aria-hidden="true"><Icon /></span><span class="highlight-text">{highlight}</span></li>
					{/each}
				</ul>
			{/if}
		</div>
		{#if route}<SafariRouteMap {route} days={Math.round(Number(tour.duration_days) || 0)} {country} />{/if}
	</div>
	{#if groups.length > 1}
		<ol class="day-strip" aria-label="Where each day is spent">
			{#each groups as group}<li><small>{group.label}</small><span>{group.place}</span></li>{/each}
		</ol>
	{/if}
</section>

<style>
	.overview-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 64px; align-items: start; }
	.overview-grid.single { grid-template-columns: minmax(0, 860px); }
	.copy { min-width: 0; }
	.overview :global(.sp-h2) { margin-bottom: 22px; }
	.intro { margin: 0 0 20px; font-size: 16px; line-height: 1.85; color: var(--sp-ink); }
	.full { position: relative; margin-bottom: 10px; }
	.full.collapsed { max-height: 14em; overflow: hidden; mask-image: linear-gradient(#000 60%, transparent); -webkit-mask-image: linear-gradient(#000 60%, transparent); }
	.more { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; margin-bottom: 18px; padding: 0; border: 0; background: none; color: var(--sp-ink); font: 600 14px var(--sp-sans); cursor: pointer; }
	.more:hover { color: #7b6500; }
	.more :global(svg) { width: 16px; height: 16px; transition: transform 0.2s ease; }
	.ideal-for { margin: 12px 0 26px; font-size: 15px; line-height: 1.8; color: var(--sp-muted); }
	.ideal-for strong { font-weight: 600; color: var(--sp-ink); }
	.highlights-list { display: grid; gap: 16px; margin: 22px 0 0; padding: 0; list-style: none; }
	.highlights-list li { display: grid; grid-template-columns: 36px 1fr; gap: 14px; align-items: center; }
	.highlight-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: #fff0ad; color: #6b5600; }
	.highlight-icon :global(svg) { width: 18px; height: 18px; }
	.highlight-text { font-size: 15px; font-weight: 500; line-height: 1.55; color: var(--sp-ink); }
	.day-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 20px; margin: 48px 0 0; padding: 28px 0 0; border-top: 1px solid var(--sp-line); list-style: none; }
	.day-strip small { display: block; margin-bottom: 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--sp-kicker); }
	.day-strip span { font-size: 15px; font-weight: 500; color: var(--sp-ink); }
	@media (max-width: 960px) { .overview-grid { grid-template-columns: minmax(0, 1fr); gap: 40px; } }
	@media (max-width: 560px) { .day-strip { grid-template-columns: 1fr 1fr; gap: 16px; } }
	@media (prefers-reduced-motion: reduce) { .more :global(svg) { transition: none; } }
</style>
