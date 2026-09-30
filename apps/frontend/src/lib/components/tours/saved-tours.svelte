<script lang="ts">
	import { onMount } from 'svelte';
	import { Heart, X } from '@lucide/svelte';
	import { safeUrl } from '$lib/home-content';
	import { savedTours } from '$lib/saved-tours.svelte';

	// The visitor's hearted tours, from their own browser. Nothing renders
	// server-side or until something is saved, so the page never jumps for others.
	let mounted = $state(false);
	onMount(() => { savedTours.load(); mounted = true; });
</script>

{#if mounted && savedTours.items.length}
	<section aria-labelledby="saved-tours-title" class="mt-8 rounded-2xl border border-border bg-white p-4 sm:p-5">
		<h3 id="saved-tours-title" class="flex items-center gap-2 text-sm font-bold text-navy"><Heart class="size-4 fill-[#e5484d] text-[#e5484d]" aria-hidden="true" />Your saved safaris <span class="font-normal text-muted-foreground">({savedTours.items.length})</span></h3>
		<ul class="mt-3.5 flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
			{#each savedTours.items as item (item.slug)}
				<li class="relative flex w-64 shrink-0 snap-start items-center gap-3 rounded-xl border border-border p-2 pr-10">
					<img src={safeUrl(item.image, '/images/safari-hero.jpg')} alt="" loading="lazy" class="size-14 shrink-0 rounded-lg object-cover" />
					<a href={`/tours/${encodeURIComponent(item.slug)}`} class="min-w-0 text-[13px] leading-snug font-semibold text-navy hover:underline">
						<span class="line-clamp-2">{item.title}</span>
						{#if item.duration}<span class="mt-0.5 block text-[11px] font-normal text-muted-foreground">{item.duration}</span>{/if}
					</a>
					<button type="button" onclick={() => savedTours.toggle(item)} aria-label={`Remove ${item.title} from saved safaris`} class="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-navy"><X class="size-4" /></button>
				</li>
			{/each}
		</ul>
	</section>
{/if}
