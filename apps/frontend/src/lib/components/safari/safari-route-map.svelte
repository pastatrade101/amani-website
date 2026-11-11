<script lang="ts">
	import { mapGeometry, routeLine, type MapLeg, type MapStop } from '$lib/safari-page';

	// The tour's route on a map of Tanzania: each place a day is spent in,
	// pinned at the destination's coordinates in the CMS, joined in travel
	// order. Flights are dashed gold arcs, drives solid lines; a leg whose
	// travel mode is not recorded is a plain dotted line, never a guess.
	let { route, days, country }: { route: { stops: MapStop[]; legs: MapLeg[] }; days: number; country: string } = $props();

	let map = $derived(mapGeometry(route, 360, 280));
	let order = $derived(routeLine(route));
	let modes = $derived(new Set(route.legs.map((leg) => leg.mode)));
</script>

<figure class="route-map" aria-labelledby="route-map-title">
	<div class="map-top"><span id="route-map-title">Your safari route</span>{#if days > 0 || country}<span>{[days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}` : '', country].filter(Boolean).join(' · ')}</span>{/if}</div>
	<svg class="map-canvas" viewBox={`0 0 ${map.width} ${map.height}`} role="img" aria-label={`Route map: ${order.join(', then ')}`}>
		<path d={map.outline} fill="#dfe2cf" stroke="#c4cab5" stroke-width="1" />
		{#if map.countryLabel}<text x={map.countryLabel.x} y={map.countryLabel.y} class="country">TANZANIA</text>{/if}
		{#each map.legs as leg, i (i)}
			<path d={leg.d} fill="none" class={`leg ${leg.mode ? leg.mode.toLowerCase() : 'unstated'}`} />
		{/each}
		{#each map.points as point (point.name)}
			<circle cx={point.x} cy={point.y} r="5" fill="#ffcc00" stroke="#414f39" stroke-width="1.5" />
			<text x={point.labelX} y={point.labelY} text-anchor={point.anchor} class="stop">{point.name}</text>
		{/each}
	</svg>
	{#if modes.size}
		<div class="map-legend">
			{#if modes.has('FLY')}<span><i class="dash"></i>Flight</span>{/if}
			{#if modes.has('DRIVE')}<span><i class="solid"></i>Game drive / road</span>{/if}
			{#if modes.has('BOAT')}<span><i class="boat"></i>Boat</span>{/if}
			{#if modes.has(null)}<span><i class="dotted"></i>Route</span>{/if}
		</div>
	{/if}
	<figcaption>
		<p class="route-summary">{order.join(' → ')}</p>
		<small class="map-source">Map outline: world.geo.json (Natural Earth) · Positions approximate</small>
	</figcaption>
</figure>

<style>
	.route-map { margin: 0; padding: 22px 20px 20px; overflow: hidden; border: 1px solid var(--sp-line); border-radius: 20px; background: #f4f1e8; }
	.map-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 14px; font-weight: 600; }
	.map-top span:last-child { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--sp-kicker); }
	.map-canvas { display: block; width: 100%; height: auto; aspect-ratio: 360 / 280; max-height: 440px; }
	.country { fill: #8a8270; font-size: 11px; font-weight: 600; letter-spacing: 2px; text-anchor: middle; font-family: var(--sp-sans); }
	.stop { fill: #2b2722; font-size: 10px; font-weight: 500; font-family: var(--sp-sans); paint-order: stroke; stroke: #f4f1e8d9; stroke-width: 3px; stroke-linejoin: round; }
	.leg { stroke-linecap: round; }
	.leg.fly { stroke: #9b8000; stroke-width: 1.8; stroke-dasharray: 4 4; }
	.leg.drive { stroke: #4a443a; stroke-width: 2.5; }
	.leg.boat { stroke: #3d6f86; stroke-width: 2; stroke-dasharray: 8 4; }
	.leg.unstated { stroke: #9a927f; stroke-width: 1.6; stroke-dasharray: 1 4; }
	.map-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 18px; font-size: 12px; color: var(--sp-muted); }
	.map-legend span { display: flex; align-items: center; gap: 7px; }
	.map-legend i { width: 22px; border-top: 2px solid #4a443a; }
	.map-legend .dash { border-top: 2px dashed #9b8000; }
	.map-legend .boat { border-top: 2px dashed #3d6f86; }
	.map-legend .dotted { border-top: 2px dotted #9a927f; }
	.route-summary { margin: 16px 0 0; font-size: 14px; line-height: 1.8; color: var(--sp-ink); }
	.map-source { display: block; margin-top: 10px; font-size: 11px; color: var(--sp-muted); }
</style>
