<script lang="ts">
	import { Camera, Trees, Bird, Mountain, Palmtree, Footprints } from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import SeasonCard from './season-card.svelte';
	import { monthStrip, seasonTone, UNASSIGNED_MONTH, type Season } from '$lib/seasons';
	import { textContent } from '$lib/home-content';
	import type { HomepageSection } from '$lib/types/api';
	// `seasons` comes from the CMS (Seasons); the month strip and the cards are both painted from it.
	let { section, seasons }: { section: HomepageSection; seasons: Season[] } = $props();
	const guide = [
        { label: 'Great Migration', value: 'June – October', icon: Footprints },
        { label: 'Best Photography', value: 'January – March', icon: Camera },
        { label: 'Green Landscapes', value: 'November – March', icon: Trees },
        { label: 'Bird Watching', value: 'November – April', icon: Bird },
        { label: 'Climbing Kilimanjaro', value: 'January – March & June – October', icon: Mountain },
        { label: 'Zanzibar Beaches', value: 'Year Round', icon: Palmtree }
    ];
	let strip = $derived(monthStrip(seasons));
</script>
<section id="when-to-go" class="page-container py-14 md:py-20">
	<div data-motion="reveal" class="mx-auto max-w-2xl text-center"><p class="eyebrow text-muted-foreground">{section.subtitle}</p><div class="gold-line mx-auto mt-4"></div><h2 class="section-heading mt-4">{section.title}</h2><p class="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">{textContent(section.content)}</p></div>
	{#if seasons.length}
		<ol aria-label="Seasons by month" class="mt-9 grid grid-cols-6 overflow-hidden rounded-xl md:grid-cols-12">
			{#each strip as month}<li title={month.season?.name} class={`border-r border-white py-3 text-center text-[10px] font-semibold tracking-wider ${month.season ? seasonTone(month.season.tone).strip : UNASSIGNED_MONTH}`}>{month.label}</li>{/each}
		</ol>
		<div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:gap-5">
			{#each seasons as season (season.id ?? season.name)}<SeasonCard {season} />{/each}
		</div>
	{/if}
    <Card.Root data-motion="reveal" class="mt-8 gap-0 rounded-2xl border-black/5 bg-white p-5 shadow-sm md:p-7"><div class="text-center"><p class="text-xs font-semibold uppercase tracking-[.2em] text-[#111111]">Quick Guide</p><h3 class="mt-1 text-lg font-bold text-[#111111]">Best Time for Different Experiences</h3></div><ul class="mt-6 grid grid-cols-2 gap-y-6 md:grid-cols-3 lg:grid-cols-6">{#each guide as item}<li class="flex flex-col items-center px-3 text-center lg:border-r lg:border-black/10 lg:last:border-r-0"><item.icon class="size-6 text-[#D9A900]" /><p class="mt-2 text-sm font-semibold text-[#111111]">{item.label}</p><p class="mt-1 text-xs leading-snug text-muted-foreground md:text-sm">{item.value}</p></li>{/each}</ul></Card.Root>
	<p class="mt-5 text-center text-[11px] leading-5 text-muted-foreground">Seasons are a general guide. Rainfall and wildlife movements vary by location and year.</p>
</section>
