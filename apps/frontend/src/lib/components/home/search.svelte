<script lang="ts">
	import { Search, ArrowRight, MapPin, Tent } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import type { Destination, Category } from '$lib/types/api';
	let { destinations, categories, filters }: { destinations: Destination[]; categories: Category[]; filters: { destination_id: string; category_id: string; search: string } } = $props();
	let destination = $state('all');
	let category = $state('all');
	$effect(() => { destination = filters.destination_id || 'all'; category = filters.category_id || 'all'; });
</script>
<section id="safari-search" aria-label="Search Tanzania safaris" class="page-container pb-14 pt-5 md:pb-16 md:pt-8 lg:pt-9">
	<form method="GET" action="/#tanzania-safari-packages" class="safari-search-card">
		<div class="search-intro"><span class="search-icon"><Search class="size-5" strokeWidth={1.8} /></span><div><p class="search-eyebrow">FIND YOUR PERFECT SAFARI</p><h2>Search Tanzania Safaris</h2></div></div>
		<div class="search-group"><Label for="search-destination" class="search-label">Destination</Label><Select.Root type="single" name="destination_id" bind:value={destination}><Select.Trigger id="search-destination" class="search-field"><span class="flex min-w-0 items-center gap-2"><MapPin class="size-4 shrink-0 text-muted-foreground" /><span class="truncate">{destinations.find((item) => item.id === destination)?.name || 'All destinations'}</span></span></Select.Trigger><Select.Content><Select.Item value="all">All destinations</Select.Item>{#each destinations as item}<Select.Item value={item.id}>{item.name}</Select.Item>{/each}</Select.Content></Select.Root></div>
		<div class="search-group"><Label for="search-category" class="search-label">Safari style</Label><Select.Root type="single" name="category_id" bind:value={category}><Select.Trigger id="search-category" class="search-field"><span class="flex min-w-0 items-center gap-2"><Tent class="size-4 shrink-0 text-muted-foreground" /><span class="truncate">{categories.find((item) => item.id === category)?.name || 'All safari styles'}</span></span></Select.Trigger><Select.Content><Select.Item value="all">All safari styles</Select.Item>{#each categories as item}<Select.Item value={item.id}>{item.name}</Select.Item>{/each}</Select.Content></Select.Root></div>
		<div class="search-group keyword-group"><Label for="search-keyword" class="search-label">Your interests</Label><Input id="search-keyword" name="search" value={filters.search} maxlength={150} placeholder="e.g. wildlife or beach" class="search-field" /></div>
		<Button variant="safari" type="submit" class="search-submit">Search Safaris <ArrowRight class="size-4" /></Button>
	</form>
</section>
<style>
	.safari-search-card { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)) auto; align-items: end; gap: 20px; border: 1px solid var(--border); border-radius: 20px; background: white; padding: 24px; box-shadow: 0 12px 32px -20px rgb(15 35 55 / .22); }
	.search-intro { grid-column: 1 / -1; display: flex; align-items: center; gap: 12px; padding-bottom: 2px; }
	.search-icon { display: grid; width: 44px; height: 44px; flex-shrink: 0; place-items: center; border-radius: 50%; background: oklch(.96 .045 95); }
	.search-eyebrow { font-size: 9px; font-weight: 600; line-height: 1.5; letter-spacing: .16em; color: #647080; }
	h2 { margin-top: 3px; font-size: 17px; font-weight: 700; line-height: 1.3; letter-spacing: -.025em; }
	.search-group { display: grid; min-width: 0; gap: 9px; }
	:global(.search-label) { font-size: 12px; font-weight: 600; line-height: 1.3; color: #273545; }
	:global(.search-field) { width: 100%; height: 48px; min-height: 48px; border: 1px solid var(--border); border-radius: 10px; padding: 0 13px; background: white; font-size: 13px; line-height: 1.4; box-shadow: none; }
	:global(.search-field:focus-visible) { outline: 2px solid var(--sun); outline-offset: 2px; }
	:global(.search-submit) { height: 48px; min-height: 48px; align-self: end; border-radius: 10px; padding: 0 22px; font-size: 13px; line-height: 1.4; gap: 10px; }
	@media (min-width: 1200px) { .safari-search-card { grid-template-columns: minmax(230px,1.2fr) minmax(0,1fr) minmax(0,.95fr) minmax(0,1.05fr) auto; gap: 18px; } .search-intro { grid-column: auto; align-self: center; padding: 0 12px 0 0; } h2 { max-width: 185px; font-size: 17px; } .search-eyebrow { font-size: 8px; } }
	@media (max-width: 1023px) { .safari-search-card { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 18px 14px; padding: 20px; } :global(.search-submit) { width: 100%; padding-inline: 12px; } }
	@media (max-width: 479px) { .safari-search-card { grid-template-columns: minmax(0,1fr); } .search-intro { margin-bottom: 3px; } :global(.search-field) { font-size: 14px; } }
</style>
