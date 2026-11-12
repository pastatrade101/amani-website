<script lang="ts">
	import type { TourPhoto } from '$lib/safari-page';

	// Five photos under the hero that drive it. The lit one is on screen; its
	// bar fills while it shows, then the next takes over. Tapping a photo shows
	// it. Hovering or focusing the strip pauses; with reduced motion the bar
	// never runs, so nothing changes on its own.
	let { photos, slide = $bindable(0) }: { photos: TourPhoto[]; slide?: number } = $props();
	let paused = $state(false);
	const next = () => { slide = (slide + 1) % photos.length; };
	const hold = () => { paused = true; };
	const release = () => { paused = false; };
</script>

{#if photos.length > 1}
	<section id="safari-gallery" aria-label="Safari photos">
		<ul class="thumbs" style={`--count:${photos.length}`}>
			{#each photos as photo, i (photo.src)}
				<li>
					<button type="button" class="thumb" class:on={i === slide} aria-pressed={i === slide} aria-label={`Show photo ${i + 1} of ${photos.length}: ${photo.alt}`} onclick={() => (slide = i)} onmouseenter={hold} onmouseleave={release} onfocus={hold} onblur={release}>
						<img src={photo.thumb} alt="" loading="lazy" width="320" height="214" />
						{#if i === slide}<span class="bar" class:paused onanimationend={next} aria-hidden="true"></span>{/if}
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	#safari-gallery { padding: 14px var(--sp-gutter) 0; background: #fff; }
	.thumbs { display: grid; grid-template-columns: repeat(var(--count), minmax(0, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
	.thumb { position: relative; display: block; width: 100%; aspect-ratio: 1.55; padding: 0; overflow: hidden; border: 0; border-radius: var(--radius-control); background: #ebe7dc; cursor: pointer; }
	.thumb img { display: block; width: 100%; height: 100%; object-fit: cover; opacity: 0.6; filter: saturate(0.8); transition: opacity 0.35s ease, filter 0.35s ease, transform 0.5s ease; }
	.thumb:hover img { opacity: 0.9; transform: scale(1.04); }
	.thumb.on img { opacity: 1; filter: none; }
	.thumb.on::before { content: ''; position: absolute; inset: 0; z-index: 1; border: 2px solid var(--sp-sun, #f6d21b); border-radius: inherit; pointer-events: none; }
	.thumb:focus-visible { outline: 2px solid #2b2722; outline-offset: 3px; }
	/* The bar is the timer: when it fills, the next photo takes over. */
	.thumb.on::after { content: ''; position: absolute; inset: auto 0 0; height: 3px; background: rgb(20 18 15 / 0.35); }
	.bar { position: absolute; left: 0; bottom: 0; z-index: 2; height: 3px; width: 100%; background: var(--sp-sun, #f6d21b); transform-origin: left; animation: fill 6.5s linear forwards; }
	.bar.paused { animation-play-state: paused; }
	@keyframes fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
	@media (max-width: 767px) { #safari-gallery { padding-top: 8px; } .thumbs { gap: 6px; } .thumb { aspect-ratio: 1; } }
	@media (prefers-reduced-motion: reduce) { .thumb img { transition: none; } .bar { animation: none; transform: scaleX(1); } }
</style>
