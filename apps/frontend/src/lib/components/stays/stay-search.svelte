<script lang="ts">
	import { ArrowRight, BedDouble, Hotel, MapPin, SlidersHorizontal } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { SAFARI_STYLE_THEME } from '$lib/safari-pricing';
	import { STAY_STYLES, STAY_TYPES, type StayFilters } from '$lib/stay-content';
	import type { Destination } from '$lib/types/api';

	// The home search panel's look, for stays: destination, style, type and a keyword.
	// A plain GET form, so it works before JavaScript and every result has its own URL.
	let { destinations, filters }: { destinations: Destination[]; filters: StayFilters } = $props();
	let destination = $state('all');
	let style = $state('all');
	let type = $state('all');
	$effect(() => {
		destination = filters.destination_id || 'all';
		style = filters.style || 'all';
		type = filters.lodge_type || 'all';
	});
</script>

<section id="stay-search" aria-label="Search stays" class="page-container pt-12 pb-4 md:pt-16">
	<form data-motion="reveal" method="GET" action="/stays#stay-results" class="stay-search-card">
		<div class="stay-search-intro"><span class="stay-search-icon"><SlidersHorizontal class="size-5" strokeWidth={1.8} /></span><div><p class="stay-search-eyebrow">FIND YOUR PLACE TO STAY</p><h2>Search lodges &amp; camps</h2></div></div>
		<div class="stay-search-group">
			<Label for="stay-destination" class="stay-search-label">Destination</Label>
			<Select.Root type="single" name="destination_id" bind:value={destination}>
				<Select.Trigger id="stay-destination" class="stay-search-field"><span class="flex min-w-0 items-center gap-2"><MapPin class="size-4 shrink-0 text-muted-foreground" /><span class="truncate">{destinations.find((item) => item.id === destination)?.name || 'All destinations'}</span></span></Select.Trigger>
				<Select.Content><Select.Item value="all">All destinations</Select.Item>{#each destinations as item (item.id)}<Select.Item value={item.id}>{item.name}</Select.Item>{/each}</Select.Content>
			</Select.Root>
		</div>
		<div class="stay-search-group">
			<Label for="stay-style" class="stay-search-label">Style</Label>
			<Select.Root type="single" name="style" bind:value={style}>
				<Select.Trigger id="stay-style" class="stay-search-field"><span class="flex min-w-0 items-center gap-2">{#if style !== 'all'}<span class="size-2.5 shrink-0 rounded-full" style={`background:${SAFARI_STYLE_THEME[style as keyof typeof SAFARI_STYLE_THEME]?.primary}`} aria-hidden="true"></span>{:else}<BedDouble class="size-4 shrink-0 text-muted-foreground" />{/if}<span class="truncate">{STAY_STYLES.find((item) => item.id === style)?.label || 'All styles'}</span></span></Select.Trigger>
				<Select.Content><Select.Item value="all">All styles</Select.Item>{#each STAY_STYLES as item (item.id)}<Select.Item value={item.id}><span class="size-2.5 shrink-0 rounded-full" style={`background:${SAFARI_STYLE_THEME[item.id].primary}`} aria-hidden="true"></span>{item.label}</Select.Item>{/each}</Select.Content>
			</Select.Root>
		</div>
		<div class="stay-search-group">
			<Label for="stay-type" class="stay-search-label">Type of stay</Label>
			<Select.Root type="single" name="lodge_type" bind:value={type}>
				<Select.Trigger id="stay-type" class="stay-search-field"><span class="flex min-w-0 items-center gap-2"><Hotel class="size-4 shrink-0 text-muted-foreground" /><span class="truncate">{STAY_TYPES.find((item) => item.value === type)?.label || 'All types'}</span></span></Select.Trigger>
				<Select.Content><Select.Item value="all">All types</Select.Item>{#each STAY_TYPES as item (item.value)}<Select.Item value={item.value}>{item.label}</Select.Item>{/each}</Select.Content>
			</Select.Root>
		</div>
		<div class="stay-search-group"><Label for="stay-keyword" class="stay-search-label">Name or keyword</Label><Input id="stay-keyword" name="search" value={filters.search} maxlength={150} placeholder="e.g. river or pool" class="stay-search-field" /></div>
		<!-- A country chosen from a stay page's links stays in force until cleared. -->
		{#if filters.country}<input type="hidden" name="country" value={filters.country} />{/if}
		<Button variant="safari" type="submit" class="stay-search-submit">Search stays <ArrowRight class="size-4" /></Button>
	</form>
</section>

<style>
	.stay-search-card { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)) auto; align-items: end; gap: 20px 16px; border: 1px solid var(--border); border-radius: 20px; background: white; padding: 24px; box-shadow: 0 12px 32px -20px rgb(15 35 55 / .22); }
	.stay-search-intro { grid-column: 1 / -1; display: flex; align-items: center; gap: 12px; padding-bottom: 2px; }
	.stay-search-icon { display: grid; width: 44px; height: 44px; flex-shrink: 0; place-items: center; border-radius: 50%; background: oklch(.96 .045 95); }
	.stay-search-eyebrow { font-size: 9px; font-weight: 600; line-height: 1.5; letter-spacing: .16em; color: #647080; }
	h2 { margin-top: 3px; font-size: 17px; font-weight: 700; line-height: 1.3; letter-spacing: -.025em; }
	.stay-search-group { display: grid; min-width: 0; gap: 9px; }
	:global(.stay-search-label) { font-size: 12px; font-weight: 600; line-height: 1.3; color: #273545; }
	:global(.stay-search-field) { width: 100%; height: 48px; min-height: 48px; border: 1px solid var(--border); border-radius: 10px; padding: 0 13px; background: white; font-size: 13px; line-height: 1.4; box-shadow: none; }
	:global(.stay-search-field:focus-visible) { outline: 2px solid var(--sun); outline-offset: 2px; }
	:global(.stay-search-submit) { height: 48px; min-height: 48px; align-self: end; border-radius: 10px; padding: 0 22px; font-size: 13px; line-height: 1.4; gap: 10px; }
	@media (min-width: 1200px) { .stay-search-card { grid-template-columns: minmax(200px, 1.1fr) repeat(4, minmax(0, 1fr)) auto; } .stay-search-intro { grid-column: auto; align-self: center; padding: 0 8px 0 0; } h2 { max-width: 170px; } .stay-search-eyebrow { font-size: 8px; } }
	@media (max-width: 1023px) { .stay-search-card { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 14px; padding: 20px; } :global(.stay-search-submit) { grid-column: 1 / -1; width: 100%; padding-inline: 12px; } }
	@media (max-width: 479px) { .stay-search-card { grid-template-columns: minmax(0, 1fr); } .stay-search-intro { margin-bottom: 3px; } :global(.stay-search-field) { font-size: 14px; } }
</style>
