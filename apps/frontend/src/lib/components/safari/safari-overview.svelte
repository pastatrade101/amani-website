<script lang="ts">
	import { Binoculars, Camera, Car, ChevronDown, Flag, Mountain, Plane, Ship, Sparkles, Tent, TreePalm, Users, Waves } from '@lucide/svelte';
	import RichText from '$lib/components/tours/rich-text.svelte';
	import SafariRouteMap from './safari-route-map.svelte';
	import { textContent } from '$lib/home-content';
	import { dayGroups, distanceKm, highlightIcon, routeMap, stopDays, type HighlightIcon, type RouteVisit, type TravelMode } from '$lib/safari-page';
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
	let route = $derived(routeMap(tour.itinerary_days, tour.start_point, tour.end_point));
	let groups = $derived(dayGroups(tour.itinerary_days));
	let routeView = $state<ReturnType<typeof SafariRouteMap>>();
	let activeStop = $state<number | null>(null);
	const HOPS: Record<Exclude<TravelMode, null>, { icon: typeof Plane; label: string }> = { DRIVE: { icon: Car, label: 'By road' }, FLY: { icon: Plane, label: 'Flight' }, BOAT: { icon: Ship, label: 'Boat' } };
	/** How the trip moves on after visit k (the CMS travel mode) and how far apart the two places are (from their coordinates). */
	function hop(k: number) {
		const leg = route?.legs[k];
		if (!route || !leg) return null;
		const km = Math.round(distanceKm(route.stops[leg.from], route.stops[leg.to]) / 5) * 5;
		return { move: leg.mode ? HOPS[leg.mode] : null, km: km >= 10 ? km : 0 };
	}
	const visitLabel = (visit: RouteVisit) => visit.role === 'start' ? 'Start' : visit.role === 'end' ? 'Finish' : stopDays(visit.days);
</script>

<section id="overview" class="sp-section overview" aria-labelledby="overview-title">
	<div class="overview-grid" class:single={!route}>
		<div class="copy">
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
			{#if route}
				<div class="route-line">
					<ol>
						{#each route.visits as visit, k (k)}
							{@const stop = route.stops[visit.stop]}
							{@const next = k < route.visits.length - 1 ? hop(k) : null}
							<li>
								<button type="button" class:on={activeStop === visit.stop} class:end={Boolean(visit.role)} aria-pressed={activeStop === visit.stop} aria-label={`Show ${stop.name} on the map`} onclick={() => routeView?.focusStop(visit.stop)}>
									<b>{#if visit.role}<Flag aria-hidden="true" />{:else}{stop.n}{/if}</b><span class="place">{stop.name}</span><small>{visitLabel(visit)}</small>
								</button>
								{#if next}<div class="hop" aria-hidden="true">{#if next.move || next.km}<span>{#if next.move}<next.move.icon />{next.move.label}{/if}{#if next.move && next.km} · {/if}{#if next.km}{next.km} km apart{/if}</span>{/if}</div>{/if}
							</li>
						{/each}
					</ol>
				</div>
			{/if}
		</div>
		{#if route}<div class="map-col"><SafariRouteMap bind:this={routeView} bind:active={activeStop} {route} days={Math.round(Number(tour.duration_days) || 0)} {country} /></div>{/if}
	</div>
	{#if !route && groups.length > 1}
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
	/* The route as a list of stops beside the map: tap one and the map flies there. */
	.route-line { margin-top: 40px; padding-top: 32px; border-top: 1px solid var(--sp-line); }
	.route-line ol { margin: 16px 0 0; padding: 0; list-style: none; }
	.route-line button { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; column-gap: 16px; width: 100%; padding: 10px 14px 10px 10px; border: 1px solid transparent; border-radius: var(--radius-control); background: transparent; text-align: left; color: var(--sp-ink); cursor: pointer; transition: background 0.2s, border-color 0.2s; }
	.route-line button:hover { background: #f7f5ef; }
	.route-line button.on { border-color: var(--sp-line); background: #f4f1e8; }
	.route-line button:focus-visible { outline: 2px solid var(--sp-sun, #f6d21b); outline-offset: 2px; }
	.route-line b { display: grid; place-items: center; width: 34px; height: 34px; border: 1.5px solid #2b2722; border-radius: 50%; background: #fff; font-size: 13px; font-weight: 700; transition: background 0.2s, border-color 0.2s; }
	.route-line button:hover b, .route-line button.on b { border-color: var(--sp-sun, #f6d21b); background: var(--sp-sun, #f6d21b); }
	/* Start and finish: a dark disc with a flag, so the day stops stand out as the numbered ones. */
	.route-line button.end b { border-color: #2b2722; background: #2b2722; color: #fff; }
	.route-line button.end:hover b, .route-line button.end.on b { color: #2b2722; }
	.route-line b :global(svg) { width: 15px; height: 15px; }
	.place { font-size: 16px; font-weight: 600; line-height: 1.35; }
	.route-line small { font-size: 13px; font-weight: 600; color: var(--sp-kicker); white-space: nowrap; }
	/* The thread between stops, with how you travel on when it is known. */
	.hop { position: relative; display: flex; align-items: center; min-height: 30px; margin-left: 27px; padding-left: 31px; border-left: 1.5px dashed #c9c1ad; }
	.hop span { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--sp-muted); }
	.hop :global(svg) { width: 14px; height: 14px; }
	.map-col { min-width: 0; }
	@media (min-width: 961px) { .map-col { position: sticky; top: 92px; } }
	.day-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 20px; margin: 48px 0 0; padding: 28px 0 0; border-top: 1px solid var(--sp-line); list-style: none; }
	.day-strip small { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 600; color: var(--sp-kicker); }
	.day-strip span { font-size: 15px; font-weight: 500; color: var(--sp-ink); }
	@media (max-width: 960px) { .overview-grid { grid-template-columns: minmax(0, 1fr); gap: 40px; } }
	@media (max-width: 560px) { .day-strip { grid-template-columns: 1fr 1fr; gap: 16px; } }
	@media (prefers-reduced-motion: reduce) { .more :global(svg) { transition: none; } }
</style>
