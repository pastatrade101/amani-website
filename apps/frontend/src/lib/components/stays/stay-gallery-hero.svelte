<script lang="ts">
	import { Images } from '@lucide/svelte';
	import StayPhoto from './stay-photo.svelte';
	import type { Destination, Stay } from '$lib/types/api';

	type Photo = { id: string; src: string; alt: string; caption: string };
	// The lead photo and up to four more in a grid on wider screens; on phones
	// every photo sits in one swipeable row. Without photos of its own the stay
	// gets the honest stand-in from StayPhoto.
	const GRID = 5;
	let { stay, photos, destination = null, allPhotosHref = '' }: { stay: Stay; photos: Photo[]; destination?: Destination | null; allPhotosHref?: string } = $props();
	let count = $derived(photos.length);
	let layout = $derived(count >= GRID ? 'five' : count === 4 ? 'four' : count === 3 ? 'three' : count === 2 ? 'two' : 'one');
</script>

{#if count}
	<div class="relative">
		<ul class={`stay-gallery ${layout}`} aria-label={`Photos of ${stay.name}`}>
			{#each photos as photo, index (photo.id)}
				<li class:beyond-grid={index >= GRID} class:lead={index === 0}>
					<figure class="group relative h-full overflow-hidden rounded-xl bg-secondary">
						<img src={photo.src} alt={photo.alt} loading={index === 0 ? 'eager' : 'lazy'} fetchpriority={index === 0 ? 'high' : undefined} decoding="async" class="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none" />
						{#if photo.caption}<figcaption class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-3 pt-8 pb-2.5 text-[11px] leading-snug text-white md:text-xs">{photo.caption}</figcaption>{/if}
					</figure>
				</li>
			{/each}
		</ul>
		<p class="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground md:hidden"><Images class="size-3.5" aria-hidden="true" />{count} {count === 1 ? 'photo' : 'photos'}{count > 1 ? ' · swipe to see more' : ''}</p>
		{#if count > GRID && allPhotosHref}
			<a href={allPhotosHref} class="all-photos hidden md:inline-flex"><Images class="size-4" aria-hidden="true" />Show all {count} photos</a>
		{/if}
	</div>
{:else}
	<div class="relative aspect-[4/3] overflow-hidden rounded-2xl bg-navy sm:aspect-[16/9] md:aspect-auto md:h-[440px] lg:h-[500px]">
		<StayPhoto {stay} {destination} loading="eager" priority note="photos of the stay coming soon" />
	</div>
{/if}

<style>
	/* Phones: a swipe row that shows a sliver of the next photo. */
	.stay-gallery { display: flex; gap: 0.625rem; margin-inline: -1rem; padding-inline: 1rem; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline: 1rem; scrollbar-width: none; overscroll-behavior-x: contain; }
	.stay-gallery::-webkit-scrollbar { display: none; }
	.stay-gallery > li { flex: 0 0 86%; aspect-ratio: 4 / 3; scroll-snap-align: start; }
	.stay-gallery.one > li { flex-basis: 100%; }
	.all-photos { position: absolute; right: 1rem; bottom: 1rem; align-items: center; gap: 0.5rem; border-radius: 0.6rem; background: white; padding: 0.6rem 0.9rem; color: var(--navy); font-size: 13px; font-weight: 600; box-shadow: 0 10px 24px -12px rgb(15 35 55 / .5); }
	.all-photos:hover { background: var(--secondary); }

	/* Wider screens: the lead photo large, the rest beside it. */
	@media (min-width: 768px) {
		.stay-gallery { display: grid; height: 440px; gap: 0.625rem; margin-inline: 0; padding-inline: 0; overflow: visible; }
		.stay-gallery > li { aspect-ratio: auto; min-height: 0; }
		.stay-gallery > li.beyond-grid { display: none; }
		.stay-gallery.one { grid-template-columns: 1fr; }
		.stay-gallery.two { grid-template-columns: 2fr 1fr; }
		.stay-gallery.three { grid-template-columns: 2fr 1fr; grid-template-rows: 1fr 1fr; }
		.stay-gallery.three > .lead { grid-row: span 2; }
		.stay-gallery.four { grid-template-columns: 2fr 1fr 1fr; grid-template-rows: 1fr 1fr; }
		.stay-gallery.four > .lead { grid-row: span 2; }
		.stay-gallery.four > li:last-child { grid-column: span 2; }
		.stay-gallery.five { grid-template-columns: 2fr 1fr 1fr; grid-template-rows: 1fr 1fr; }
		.stay-gallery.five > .lead { grid-row: span 2; }
		.stay-gallery > li:first-child figure { border-radius: 1rem 0.75rem 0.75rem 1rem; }
	}
	@media (min-width: 1024px) { .stay-gallery { height: 500px; } }
</style>
