<script lang="ts">
	import { CloudRain, Leaf, Sun, ThumbsUp, ThumbsDown, Star, Camera, Trees, Bird, Mountain, Palmtree, Footprints } from '@lucide/svelte';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { seasons } from '$lib/data/reference';
	import { textContent } from '$lib/home-content';
	import type { HomepageSection } from '$lib/types/api';
	let { section }: { section: HomepageSection } = $props();
	const guide = [
        { label: 'Great Migration', value: 'June – October', icon: Footprints },
        { label: 'Best Photography', value: 'January – March', icon: Camera },
        { label: 'Green Landscapes', value: 'November – March', icon: Trees },
        { label: 'Bird Watching', value: 'November – April', icon: Bird },
        { label: 'Climbing Kilimanjaro', value: 'January – March & June – October', icon: Mountain },
        { label: 'Zanzibar Beaches', value: 'Year Round', icon: Palmtree }
    ];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
	const icons = { Leaf, CloudRain, Sun };
</script>
<section id="when-to-go" class="page-container py-14 md:py-20">
	<div data-motion="reveal" class="mx-auto max-w-2xl text-center"><p class="eyebrow text-muted-foreground">{section.subtitle}</p><div class="gold-line mx-auto mt-4"></div><h2 class="section-heading mt-4">{section.title}</h2><p class="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">{textContent(section.content)}</p></div>
	<ol aria-label="Seasons by month" class="mt-9 grid grid-cols-6 overflow-hidden rounded-xl md:grid-cols-12">
		{#each months as month, i}<li class={`border-r border-white py-3 text-center text-[10px] font-semibold tracking-wider ${i >= 3 && i <= 4 ? 'bg-[#E6F0FA] text-[#1E4F80]' : i >= 5 && i <= 9 ? 'bg-[#FFF6D6] text-[#7A5A00]' : 'bg-[#E8F3EA] text-[#2F6B3C]'}`}>{month}</li>{/each}
	</ol>
	<div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:gap-5">
		{#each seasons as season}
			{@const Icon = icons[season.icon as keyof typeof icons] || Leaf}
			<Card.Root data-motion="card" data-motion-hover="card" class={`gap-0 rounded-2xl border-black/5 p-5 shadow-none lg:p-6 ${season.bg}`}>
				<div class="flex items-center gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-full bg-white"><Icon class={`size-5 ${season.iconCls}`} /></span><div><h3 class="text-sm font-bold tracking-wide text-[#111111] lg:text-base">{season.title}</h3><p class="mt-1 text-xs text-muted-foreground lg:text-sm">{season.dates}</p></div></div>
				<p class="mt-4 text-[13px] leading-7 text-muted-foreground">{season.text}</p>
                <Accordion.Root type="single" class="mt-3"><Accordion.Item value="considerations" class="border-0"><Accordion.Trigger class="py-3 text-xs font-semibold hover:no-underline">Travel considerations</Accordion.Trigger><Accordion.Content>                <p class="mt-5 flex items-center gap-2 text-sm font-semibold text-[#111111]"><span class="grid size-6 place-items-center rounded-full bg-[#4F8A5B] text-white"><ThumbsUp class="size-3.5" /></span>Advantages</p><ul class="mt-2 space-y-1 pl-8">{#each season.pros as pro}<li class="list-disc text-sm text-[#374151] md:text-[13px] lg:text-sm">{pro}</li>{/each}</ul>
                <p class="mt-4 flex items-center gap-2 text-sm font-semibold text-[#111111]"><span class="grid size-6 place-items-center rounded-full bg-[#DC4B4B] text-white"><ThumbsDown class="size-3.5" /></span>Disadvantages</p><ul class="mt-2 space-y-1 pl-8">{#each season.cons as con}<li class="list-disc text-sm text-[#374151] md:text-[13px] lg:text-sm">{con}</li>{/each}</ul>
</Accordion.Content></Accordion.Item></Accordion.Root>
                <div class="mt-auto pt-5"><div class="flex gap-2 rounded-xl bg-white/70 p-3"><span class="grid size-6 shrink-0 place-items-center rounded-full bg-sun text-navy"><Star class="size-3.5" /></span><div><p class="text-xs font-semibold uppercase tracking-wide text-[#111111]">Best for</p><p class="mt-0.5 text-sm text-[#374151] md:text-[13px] lg:text-sm">{season.best}</p></div></div></div>
			</Card.Root>
		{/each}
	</div>
    <Card.Root data-motion="reveal" class="mt-8 gap-0 rounded-2xl border-black/5 bg-white p-5 shadow-sm md:p-7"><div class="text-center"><p class="text-xs font-semibold uppercase tracking-[.2em] text-[#111111]">Quick Guide</p><h3 class="mt-1 text-lg font-bold text-[#111111]">Best Time for Different Experiences</h3></div><ul class="mt-6 grid grid-cols-2 gap-y-6 md:grid-cols-3 lg:grid-cols-6">{#each guide as item}<li class="flex flex-col items-center px-3 text-center lg:border-r lg:border-black/10 lg:last:border-r-0"><item.icon class="size-6 text-[#D9A900]" /><p class="mt-2 text-sm font-semibold text-[#111111]">{item.label}</p><p class="mt-1 text-xs leading-snug text-muted-foreground md:text-sm">{item.value}</p></li>{/each}</ul></Card.Root>
	<p class="mt-5 text-center text-[11px] leading-5 text-muted-foreground">Seasons are a general guide. Rainfall and wildlife movements vary by location and year.</p>
</section>
