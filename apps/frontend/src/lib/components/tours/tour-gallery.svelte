<script lang="ts">
	import { Images } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { safeUrl } from '$lib/home-content';
	import type { TourDetail } from '$lib/types/api';

	type Image = NonNullable<TourDetail['tour_images']>[number];
	// Featured photo first and large, then the rest by the CMS order. Five fill
	// two tidy rows; the rest wait behind "Show all photos".
	const FIRST_ROWS = 5;
	let { images, tourTitle }: { images: Image[]; tourTitle: string } = $props();
	let showAll = $state(false);
	let photos = $derived(
		[...images]
			.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order)
			.map((image, index) => ({
				id: image.id,
				src: safeUrl(index === 0 ? image.image_url : image.image_url_thumbnail || image.image_url, ''),
				alt: image.alt_text?.trim() || image.caption?.trim() || `${tourTitle}: photo ${index + 1}`,
				caption: image.caption?.trim() ?? ''
			}))
			.filter((photo) => photo.src && !photo.src.startsWith('#'))
	);
	let shown = $derived(showAll ? photos : photos.slice(0, FIRST_ROWS));
</script>

<div data-motion="reveal" class="flex flex-wrap items-end justify-between gap-4">
	<div class="max-w-2xl">
		<p class="eyebrow text-muted-foreground">Gallery</p>
		<h2 class="section-heading mt-3">Moments from this safari</h2>
	</div>
	<p class="flex items-center gap-2 text-xs text-muted-foreground"><Images class="size-4" aria-hidden="true" />{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</p>
</div>
<ul class="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
	{#each shown as photo, index (photo.id)}
		<li class={index === 0 ? 'col-span-2 row-span-2' : ''}>
			<figure class="group relative h-full overflow-hidden rounded-xl bg-secondary">
				<img src={photo.src} alt={photo.alt} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" class="aspect-square size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none" />
				{#if photo.caption}
					<figcaption class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 to-transparent px-3 pt-8 pb-2.5 text-[11px] leading-snug text-white md:text-xs">{photo.caption}</figcaption>
				{/if}
			</figure>
		</li>
	{/each}
</ul>
{#if photos.length > FIRST_ROWS}
	<div class="mt-6 flex justify-center">
		<Button variant="outline" onclick={() => (showAll = !showAll)} aria-expanded={showAll} class="h-11 rounded-lg px-5">{showAll ? 'Show fewer photos' : `Show all ${photos.length} photos`}</Button>
	</div>
{/if}
