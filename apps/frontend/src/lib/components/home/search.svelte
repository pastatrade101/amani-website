<script lang="ts">
	import DestinationIcon from './destination-icon.svelte';
	import { textContent } from '$lib/home-content';
	import { ArrowRight, MapPin, Tent } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import type { Destination, Category } from '$lib/types/api';
	// `action` is where results live: the home packages section, or /tours.
	let { destinations, categories, filters, action = '/#tanzania-safari-packages' }: { destinations: Destination[]; categories: Category[]; filters: { destination_id: string; category_id: string; search: string }; action?: string } = $props();
	let destination = $state('all');
	let category = $state('all');
	$effect(() => { destination = filters.destination_id || 'all'; category = filters.category_id || 'all'; });
</script>
<section id="safari-search" aria-label="Search Tanzania safaris" class="page-container pb-14 pt-5 md:pb-16 md:pt-8 lg:pt-9">
	<form data-motion="reveal" method="GET" {action} class="safari-search-card">
		<div class="search-group"><Label for="search-destination" class="search-label">Destination</Label><Select.Root type="single" name="destination_id" bind:value={destination}><Select.Trigger id="search-destination" class="search-field"><span class="flex min-w-0 items-center gap-2"><MapPin class="size-4 shrink-0 text-muted-foreground" /><span class="truncate">{destinations.find((item) => item.id === destination)?.name || 'All destinations'}</span></span></Select.Trigger><Select.Content class="w-[min(380px,calc(100vw-32px))] rounded-2xl p-2"><p class="px-3 py-3 text-xs font-medium text-muted-foreground">Discover Tanzania</p><Select.Item value="all" label="All destinations" class="rounded-xl p-3"><DestinationIcon name="all" /><span class="grid gap-1"><span class="font-semibold">All destinations</span><span class="text-xs text-muted-foreground">Explore every corner of Tanzania</span></span></Select.Item>{#each destinations as item}<Select.Item value={item.id} label={item.name} class="rounded-xl p-3"><DestinationIcon name={`${item.name} ${item.region || ''}`} /><span class="grid min-w-0 gap-1"><span class="max-w-60 truncate font-semibold">{item.name}</span><span class="max-w-60 truncate text-xs text-muted-foreground">{textContent(item.short_description) || item.region || 'Explore this destination'}</span></span></Select.Item>{/each}</Select.Content></Select.Root></div>
		<div class="search-group"><Label for="search-category" class="search-label">Safari style</Label><Select.Root type="single" name="category_id" bind:value={category}><Select.Trigger id="search-category" class="search-field"><span class="flex min-w-0 items-center gap-2"><Tent class="size-4 shrink-0 text-muted-foreground" /><span class="truncate">{categories.find((item) => item.id === category)?.name || 'All safari styles'}</span></span></Select.Trigger><Select.Content><Select.Item value="all">All safari styles</Select.Item>{#each categories as item}<Select.Item value={item.id}>{item.name}</Select.Item>{/each}</Select.Content></Select.Root></div>
		<div class="search-group keyword-group"><Label for="search-keyword" class="search-label">Your interests</Label><Input id="search-keyword" name="search" value={filters.search} maxlength={150} placeholder="e.g. wildlife or beach" class="search-field" /></div>
		<Button variant="safari" type="submit" class="search-submit">Search Safaris <ArrowRight class="size-4" /></Button>
	</form>
</section>
<style>
	.safari-search-card { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)) auto; align-items: end; gap: 20px; border: 1px solid var(--border); border-radius: 20px; background: white; padding: 24px; box-shadow: 0 12px 32px -20px rgb(15 35 55 / .22); }
	.search-group { display: grid; min-width: 0; gap: 9px; }
	:global(.search-label) { font-size: 12px; font-weight: 600; line-height: 1.3; color: #273545; }
	:global(.search-field) { width: 100%; height: 48px; min-height: 48px; border: 1px solid var(--border); border-radius: 10px; padding: 0 13px; background: white; font-size: 13px; line-height: 1.4; box-shadow: none; }
	:global(.search-field:focus-visible) { outline: 2px solid var(--sun); outline-offset: 2px; }
	:global(.search-submit) { height: 48px; min-height: 48px; align-self: end; border-radius: 10px; padding: 0 22px; font-size: 13px; line-height: 1.4; gap: 10px; }
	@media (max-width: 1023px) { .safari-search-card { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 18px 14px; padding: 20px; } :global(.search-submit) { width: 100%; padding-inline: 12px; } }
	@media (max-width: 479px) { .safari-search-card { grid-template-columns: minmax(0,1fr); } :global(.search-field) { font-size: 14px; } }
</style>
