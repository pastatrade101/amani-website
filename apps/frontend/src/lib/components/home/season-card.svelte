<script lang="ts">
	import { ThumbsUp, ThumbsDown, Star } from '@lucide/svelte';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { monthRange, seasonIcon, seasonTone, type Season } from '$lib/seasons';

	// Shared by the homepage and the CMS preview, so the editor sees exactly what the site paints.
	let { season }: { season: Season } = $props();
	let Icon = $derived(seasonIcon(season.icon));
	let tone = $derived(seasonTone(season.tone));
	let pros = $derived(season.advantages.filter((item) => item.trim()));
	let cons = $derived(season.disadvantages.filter((item) => item.trim()));
</script>

<Card.Root data-motion="card" data-motion-hover="card" class={`gap-0 rounded-2xl border-black/5 p-5 shadow-none lg:p-6 ${tone.card}`}>
	<div class="flex items-center gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-full bg-white"><Icon class={`size-5 ${tone.icon}`} /></span><div><h3 class="text-sm font-bold uppercase tracking-wide text-[#111111] lg:text-base">{season.name}</h3><p class="mt-1 text-xs text-muted-foreground lg:text-sm">{monthRange(season)}</p></div></div>
	{#if season.description}<p class="mt-4 text-[13px] leading-7 text-muted-foreground">{season.description}</p>{/if}
	{#if pros.length || cons.length}
		<Accordion.Root type="single" class="mt-3"><Accordion.Item value="considerations" class="border-0"><Accordion.Trigger class="py-3 text-xs font-semibold hover:no-underline">Travel considerations</Accordion.Trigger><Accordion.Content>
			{#if pros.length}<p class="mt-5 flex items-center gap-2 text-sm font-semibold text-[#111111]"><span class="grid size-6 place-items-center rounded-full bg-[#4F8A5B] text-white"><ThumbsUp class="size-3.5" /></span>Advantages</p><ul class="mt-2 space-y-1 pl-8">{#each pros as pro}<li class="list-disc text-sm text-[#374151] md:text-[13px] lg:text-sm">{pro}</li>{/each}</ul>{/if}
			{#if cons.length}<p class="mt-4 flex items-center gap-2 text-sm font-semibold text-[#111111]"><span class="grid size-6 place-items-center rounded-full bg-[#DC4B4B] text-white"><ThumbsDown class="size-3.5" /></span>Disadvantages</p><ul class="mt-2 space-y-1 pl-8">{#each cons as con}<li class="list-disc text-sm text-[#374151] md:text-[13px] lg:text-sm">{con}</li>{/each}</ul>{/if}
		</Accordion.Content></Accordion.Item></Accordion.Root>
	{/if}
	{#if season.best_for}
		<div class="mt-auto pt-5"><div class="flex gap-2 rounded-xl bg-white/70 p-3"><span class="grid size-6 shrink-0 place-items-center rounded-full bg-sun text-navy"><Star class="size-3.5" /></span><div><p class="text-xs font-semibold uppercase tracking-wide text-[#111111]">Best for</p><p class="mt-0.5 text-sm text-[#374151] md:text-[13px] lg:text-sm">{season.best_for}</p></div></div></div>
	{/if}
</Card.Root>
