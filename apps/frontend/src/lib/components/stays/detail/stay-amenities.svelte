<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import { amenityIcon } from '../stay-icons';
	import type { StayAmenity } from '$lib/types/api';

	// A quiet hairline list; long lists open on request so the page keeps its rhythm.
	const FIRST = 12;
	let { amenities }: { amenities: StayAmenity[] } = $props();
	let expanded = $state(false);
	let shown = $derived(expanded ? amenities : amenities.slice(0, FIRST));
</script>

<section id="amenities" class="scroll-mt-14 bg-[oklch(.965_.014_85)] py-16 md:py-24" aria-labelledby="amenities-title">
	<div class="page-container">
		<div data-motion="reveal" class="max-w-2xl">
			<p class="eyebrow text-[var(--gold-ink)]">Comforts</p>
			<h2 id="amenities-title" class="lux-heading mt-4">Amenities &amp; services</h2>
		</div>
		<ul id="amenity-list" class="mt-10 grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
			{#each shown as amenity (amenity.id)}
				{@const Icon = amenityIcon(amenity.icon_key)}
				<li class="flex min-w-0 items-center gap-3 border-t border-navy/10 py-4 text-[15px] leading-6 text-navy"><Icon class="size-5 shrink-0 text-[#D9A900]" strokeWidth={1.5} aria-hidden="true" /><span class="min-w-0 break-words">{amenity.name}</span></li>
			{/each}
		</ul>
		{#if amenities.length > FIRST}
			<button type="button" aria-expanded={expanded} aria-controls="amenity-list" onclick={() => (expanded = !expanded)} class="mt-6 inline-flex h-11 items-center gap-2 text-sm font-semibold text-navy hover:text-navy/75">
				{expanded ? 'Show fewer amenities' : `Show all ${amenities.length} amenities`}<ChevronDown class={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
			</button>
		{/if}
	</div>
</section>
