<script lang="ts">
	import StayLightbox from '$lib/components/stays/detail/stay-lightbox.svelte';
	import { safeUrl } from '$lib/home-content';
	import { sortedDays } from '$lib/tour-itinerary';
	import type { TourDetail } from '$lib/types/api';

	// Four photos under the hero: the tour's gallery, then its day photos. The
	// hero photo only fills in when there are fewer than four others. Each
	// opens the full-screen gallery, which also holds the hero photo.
	let { tour, image }: { tour: TourDetail; image: string } = $props();

	let photos = $derived.by(() => {
		const candidates = [
			{ src: image, thumb: '', alt: tour.title, caption: '' },
			...[...(tour.tour_images ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((photo) => ({ src: photo.image_url, thumb: photo.image_url_thumbnail || '', alt: photo.alt_text || photo.caption || tour.title, caption: photo.caption || '' })),
			...sortedDays(tour.itinerary_days).flatMap((day) => (day.image_urls ?? []).map((src) => ({ src, thumb: '', alt: day.destination?.name || day.title, caption: day.destination?.name || day.title })))
		];
		const seen = new Set<string>();
		// Tiles use the CMS thumbnail when there is one; the lightbox keeps the full photo.
		return candidates
			.map((photo) => ({ ...photo, src: safeUrl(photo.src, ''), thumb: safeUrl(photo.thumb, '') }))
			.map((photo) => ({ ...photo, thumb: photo.thumb && !photo.thumb.startsWith('#') ? photo.thumb : photo.src }))
			.filter((photo) => photo.src && !photo.src.startsWith('#') && !seen.has(photo.src) && seen.add(photo.src))
			.map((photo, index) => ({ ...photo, id: String(index), category: '' }));
	});
	// Index 0 is the hero photo already on screen.
	let tiles = $derived((photos.length > 4 ? photos.slice(1, 5) : photos.slice(0, 4)).map((photo) => ({ photo, index: photos.indexOf(photo) })));
	let open = $state(false), index = $state(0), opener = $state<HTMLElement | null>(null);
	function show(at: number, event: MouseEvent) { opener = event.currentTarget as HTMLElement; index = at; open = true; }
</script>

{#if photos.length > 1}
	<section id="safari-gallery" aria-label="Safari photos">
		<ul class="thumbs" style={`--count:${Math.max(2, tiles.length)}`}>
			{#each tiles as tile, i (tile.photo.src)}
				<li>
					<button type="button" class="thumb" aria-label={`Open photo ${tile.index + 1} of ${photos.length}: ${tile.photo.alt}`} onclick={(event) => show(tile.index, event)}>
						<img src={tile.photo.thumb} alt="" loading="lazy" width="480" height="320" />
						{#if i === tiles.length - 1 && photos.length > tiles.length}<span class="more">+{photos.length - tiles.length} photos</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
	</section>
	<StayLightbox {photos} bind:open bind:index title={tour.title} {opener} />
{/if}

<style>
	#safari-gallery { padding: 14px var(--sp-gutter) 0; background: #fff; }
	.thumbs { display: grid; grid-template-columns: repeat(var(--count), minmax(0, 1fr)); gap: 14px; margin: 0; padding: 0; list-style: none; }
	.thumb { position: relative; display: block; width: 100%; aspect-ratio: 1.6; padding: 0; overflow: hidden; border: 0; border-radius: 14px; background: #ebe7dc; cursor: zoom-in; }
	.thumb img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform 0.35s ease; }
	.thumb:hover img { transform: scale(1.03); }
	.more { position: absolute; right: 12px; bottom: 12px; padding: 7px 14px; border-radius: 999px; background: #1b1916c9; color: #fff; font-size: 13px; font-weight: 600; }
	@media (max-width: 767px) { #safari-gallery { padding-top: 10px; } .thumbs { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } .thumb { border-radius: 10px; } }
	@media (prefers-reduced-motion: reduce) { .thumb img { transition: none; } }
</style>
