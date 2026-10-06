<script lang="ts">
	import { Images } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { PHOTO_GROUPS, photoGroups, type StayGalleryPhoto } from '$lib/stay-content';

	// An editorial mosaic of 3, 5 or 10 tiles (the big tiles alternate sides),
	// filterable by the CMS photo categories once there are enough photos.
	let { photos, onOpen }: { photos: StayGalleryPhoto[]; onOpen: (list: StayGalleryPhoto[], index: number, opener: HTMLElement) => void } = $props();
	let group = $state('all');
	let groups = $derived(photos.length >= 6 ? photoGroups(photos) : []);
	let filtered = $derived.by(() => {
		const categories = PHOTO_GROUPS.find((item) => item.id === group)?.categories;
		return categories ? photos.filter((photo) => categories.includes(photo.category)) : photos;
	});
	let n = $derived(filtered.length);
	let shown = $derived(n >= 10 ? 10 : n >= 5 ? 5 : n >= 3 ? 3 : n);
	let columns = $derived(shown >= 5 ? 'md:grid-cols-4' : shown === 3 ? 'md:grid-cols-3' : shown === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1');

	// Phones: a wide lead, squares in pairs, and a wide last tile when one is left over.
	function tileClass(i: number): string {
		if (shown <= 2) return i === 0 ? (shown === 1 ? 'col-span-2 aspect-[4/3] md:aspect-video' : 'col-span-2 aspect-[4/3] md:col-span-1') : 'col-span-2 aspect-[2/1] md:col-span-1 md:aspect-[4/3]';
		if (i === 0) return 'col-span-2 aspect-[4/3] md:row-span-2 md:aspect-auto';
		if (i === 5) return 'aspect-square md:col-span-2 md:col-start-3 md:row-span-2 md:aspect-auto';
		return i === shown - 1 && (shown - 1) % 2 === 1 ? 'col-span-2 aspect-[2/1] md:col-span-1 md:aspect-auto' : 'aspect-square md:aspect-auto';
	}
	const pill = 'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors';
</script>

<section id="photos" class="scroll-mt-14 border-t border-navy/10 bg-white py-16 md:py-24" aria-labelledby="photos-title">
	<div class="page-container">
		<div data-motion="reveal" class="flex flex-wrap items-end justify-between gap-4">
			<div class="max-w-2xl">
				<p class="eyebrow text-[var(--gold-ink)]">Gallery</p>
				<h2 id="photos-title" class="lux-heading mt-4">A closer look</h2>
			</div>
			<p class="flex items-center gap-2 text-sm text-muted-foreground"><Images class="size-4" aria-hidden="true" />{photos.length} photos</p>
		</div>

		{#if groups.length >= 2}
			<div class="filters -mx-4 mt-8 overflow-x-auto px-4 md:mx-0 md:px-0">
				<div role="group" aria-label="Photo categories" class="flex w-max gap-2 py-1">
					<button type="button" aria-pressed={group === 'all'} onclick={() => (group = 'all')} class={`${pill} ${group === 'all' ? 'bg-navy text-white' : 'text-navy ring-1 ring-border hover:bg-[oklch(.985_.006_85)]'}`}>All <span class="opacity-60">{photos.length}</span></button>
					{#each groups as item (item.id)}
						<button type="button" aria-pressed={group === item.id} onclick={() => (group = item.id)} class={`${pill} ${group === item.id ? 'bg-navy text-white' : 'text-navy ring-1 ring-border hover:bg-[oklch(.985_.006_85)]'}`}>{item.label} <span class="opacity-60">{item.count}</span></button>
					{/each}
				</div>
			</div>
		{/if}

		<ul class={`mt-8 grid grid-cols-2 gap-2 md:grid-flow-dense md:gap-3 ${columns} ${shown >= 3 ? 'md:auto-rows-[200px] lg:auto-rows-[250px]' : ''}`}>
			{#each filtered.slice(0, shown) as photo, i (photo.id)}
				{@const more = i === shown - 1 ? n - shown : 0}
				<li class={`min-w-0 ${tileClass(i)}`}>
					<button type="button" onclick={(event) => onOpen(filtered, i, event.currentTarget)} aria-label={`Open photo ${i + 1} of ${n}: ${photo.alt}${more ? ` (${more} more)` : ''}`} class="group relative block size-full overflow-hidden rounded-xl bg-[oklch(.965_.014_85)]">
						<img src={photo.src} alt="" loading="lazy" decoding="async" class="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transform-none" />
						{#if more}<span class="absolute inset-0 grid place-items-center bg-navy/60 font-display text-[28px] text-white" aria-hidden="true">+{more} more</span>{/if}
					</button>
				</li>
			{/each}
		</ul>

		{#if n > shown}
			<div class="mt-8 flex justify-center">
				<Button variant="outline" onclick={(event: MouseEvent) => onOpen(filtered, 0, event.currentTarget as HTMLElement)} class="h-12 rounded-full px-6 text-sm"><Images class="size-4" />View all {n} photos</Button>
			</div>
		{/if}
	</div>
</section>

<style>
	.filters { scrollbar-width: none; }
	.filters::-webkit-scrollbar { display: none; }
</style>
