<script lang="ts">
	import { MapPin } from '@lucide/svelte';
	import { locator } from '$lib/destination-explorer';

	// Stands in for a place's photo until it has one: where it is in Tanzania,
	// with the other places as faint dots. Never another place's photo.
	let { lat, lng, others = [], name }: { lat: number | null; lng: number | null; others?: { lat: number; lng: number }[]; name: string } = $props();
	let map = $derived(lat !== null && lng !== null ? locator({ lat, lng }, others) : null);
</script>

<div class="locator" role="img" aria-label={`Where ${name} is`}>
	{#if map}
		<svg viewBox="0 0 160 120" aria-hidden="true">
			<path d={map.outline} class="land" />
			{#each map.dots as [x, y], i (i)}<circle cx={x} cy={y} r="1.6" class="dot" />{/each}
			<circle cx={map.x} cy={map.y} r="9" class="halo" />
			<circle cx={map.x} cy={map.y} r="4" class="pin" />
		</svg>
	{:else}
		<MapPin class="locator-icon" aria-hidden="true" strokeWidth={1.4} />
	{/if}
</div>

<style>
	.locator { display: grid; place-items: center; width: 100%; height: 100%; background: #f1eee4; color: #8a8270; }
	svg { display: block; width: 100%; height: 100%; }
	.land { fill: #e0e2cf; stroke: #c6cab4; stroke-width: 0.8; stroke-linejoin: round; }
	.dot { fill: #9c9584; }
	.halo { fill: oklch(0.864 0.173 97 / 0.35); }
	.pin { fill: var(--sun); stroke: var(--navy); stroke-width: 1.6; }
	.locator :global(.locator-icon) { width: 28px; height: 28px; }
</style>
