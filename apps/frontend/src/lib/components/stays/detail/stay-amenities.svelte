<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import { amenityIcon } from '../stay-icons';
	import type { StayAmenity } from '$lib/types/api';

	// Small tiles, two across on a phone; long lists open on request so the
	// page keeps its rhythm.
	const FIRST = 12;
	let { amenities }: { amenities: StayAmenity[] } = $props();
	let expanded = $state(false);
	let shown = $derived(expanded ? amenities : amenities.slice(0, FIRST));
</script>

<section id="amenities" class="scroll-mt-14 bg-[oklch(.965_.014_85)] py-16 md:py-24" aria-labelledby="amenities-title">
	<div class="page-container">
		<div data-motion="reveal" class="max-w-2xl">
			<h2 id="amenities-title" class="lux-heading">Amenities &amp; services</h2>
		</div>
		<ul id="amenity-list" class="tiles">
			{#each shown as amenity (amenity.id)}
				{@const Icon = amenityIcon(amenity.icon_key)}
				<li><span class="icon" aria-hidden="true"><Icon class="size-[18px]" strokeWidth={1.6} /></span><span class="min-w-0 break-words">{amenity.name}</span></li>
			{/each}
		</ul>
		{#if amenities.length > FIRST}
			<button type="button" aria-expanded={expanded} aria-controls="amenity-list" onclick={() => (expanded = !expanded)} class="more">
				{expanded ? 'Show fewer amenities' : `Show all ${amenities.length} amenities`}<ChevronDown class={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
			</button>
		{/if}
	</div>
</section>

<style>
	.tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 28px 0 0; padding: 0; list-style: none; }
	li { display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 56px; padding: 10px 12px; border-radius: 10px; background: white; color: var(--navy); font-size: 14px; font-weight: 500; line-height: 1.3; box-shadow: 0 0 0 1px rgb(43 39 34 / 0.06); }
	.icon { display: grid; place-items: center; width: 32px; height: 32px; flex: none; border-radius: 8px; background: #f6f1e4; color: #a7811a; }
	.more { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; margin-top: 14px; color: var(--navy); font-size: 14px; font-weight: 600; }
	.more:hover { color: color-mix(in oklch, var(--navy) 75%, transparent); }
	@media (min-width: 768px) {
		.tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 40px; }
		li { min-height: 64px; padding: 12px 16px; font-size: 15px; }
		.more { margin-top: 20px; }
	}
	@media (min-width: 1100px) { .tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
</style>
