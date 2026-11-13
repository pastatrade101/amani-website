<script lang="ts">
	import { Images } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { glide } from '$lib/motion/glide';
	import { rail } from '$lib/motion/rail';
	import { PHOTO_GROUPS, photoGroups, type StayGalleryPhoto } from '$lib/stay-content';

	// Phones: every photo on a swipeable rail, the centred one full size, with a
	// count under it. Larger screens: an editorial mosaic of 3, 5 or 10 tiles
	// (the big tiles alternate sides). Both filter by the CMS photo categories
	// once there are enough photos.
	let { photos, onOpen }: { photos: StayGalleryPhoto[]; onOpen: (list: StayGalleryPhoto[], index: number, opener: HTMLElement) => void } = $props();
	let group = $state('all');
	let at = $state(0);
	let list = $state<HTMLUListElement>();
	let groups = $derived(photos.length >= 6 ? photoGroups(photos) : []);
	let filtered = $derived.by(() => {
		const categories = PHOTO_GROUPS.find((item) => item.id === group)?.categories;
		return categories ? photos.filter((photo) => categories.includes(photo.category)) : photos;
	});
	let n = $derived(filtered.length);
	let shown = $derived(n >= 10 ? 10 : n >= 5 ? 5 : n >= 3 ? 3 : n);
	let columns = $derived(shown >= 5 ? 4 : shown);

	function pick(id: string) {
		group = id;
		at = 0;
		list?.scrollTo({ left: 0 });
	}
</script>

<section id="photos" class="scroll-mt-14 border-t border-navy/10 bg-white py-16 md:py-24" aria-labelledby="photos-title">
	<div class="page-container">
		<div data-motion="reveal" class="flex flex-wrap items-end justify-between gap-4">
			<h2 id="photos-title" class="lux-heading">A closer look</h2>
			<p class="flex items-center gap-2 text-sm text-muted-foreground"><Images class="size-4" aria-hidden="true" />{photos.length} photos</p>
		</div>

		{#if groups.length >= 2}
			<div role="group" aria-label="Photo categories" class="chips" use:glide={{ center: true }}>
				<button type="button" aria-pressed={group === 'all'} onclick={() => pick('all')}>All <span class="n">{photos.length}</span></button>
				{#each groups as item (item.id)}
					<button type="button" aria-pressed={group === item.id} onclick={() => pick(item.id)}>{item.label} <span class="n">{item.count}</span></button>
				{/each}
			</div>
		{/if}

		<ul bind:this={list} class="mosaic" class:rows={shown >= 3} style={`--cols:${columns}`} data-shown={shown} use:rail={{ onIndex: (i) => (at = i) }}>
			{#each filtered as photo, i (photo.id)}
				{@const more = i === shown - 1 ? n - shown : 0}
				<li class:extra={i >= shown}>
					<button type="button" onclick={(event) => onOpen(filtered, i, event.currentTarget)} aria-label={`Open photo ${i + 1} of ${n}: ${photo.alt}`}>
						<img src={photo.src} alt="" loading="lazy" decoding="async" />
						{#if more}<span class="more" aria-hidden="true">+{more} more</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
		{#if n > 1}<p class="count" aria-hidden="true"><span>{Math.min(at + 1, n)}</span> / {n}</p>{/if}

		{#if n > shown}
			<div class="all">
				<Button variant="outline" onclick={(event: MouseEvent) => onOpen(filtered, 0, event.currentTarget as HTMLElement)} class="h-12 px-6 text-sm"><Images class="size-4" />View all {n} photos</Button>
			</div>
		{/if}
	</div>
</section>

<style>
	/* Category chips: one navy marker glides to the chosen one. */
	.chips { display: flex; gap: 8px; margin: 26px -1rem 0; padding: 2px 1rem; overflow-x: auto; scrollbar-width: none; }
	.chips::-webkit-scrollbar { display: none; }
	.chips :global(.glide-mark) { border-radius: 9px; background: var(--navy); }
	.chips button { position: relative; display: inline-flex; flex: none; align-items: center; gap: 6px; min-height: 42px; padding: 0 16px; border-radius: 9px; color: #5f584e; font-size: var(--text-sm); font-weight: 600; white-space: nowrap; -webkit-tap-highlight-color: transparent; transition: color 0.45s cubic-bezier(0.22, 1, 0.36, 1); }
	.chips button::before { content: ''; position: absolute; inset: 0; z-index: -2; border-radius: inherit; background: #f1ede4; }
	.chips button:hover { color: var(--navy); }
	.chips button[aria-pressed='true'] { color: white; }
	.chips button:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }
	.n { opacity: 0.6; font-weight: 500; }

	/* Phones: a centred, full-bleed rail. */
	.mosaic { --card: min(84vw, 440px); display: flex; gap: 10px; margin: 22px calc(50% - 50vw) 0; padding: 4px calc((100vw - var(--card)) / 2) 6px; list-style: none; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory; scrollbar-width: none; }
	.mosaic::-webkit-scrollbar { display: none; }
	.mosaic li { flex: none; width: var(--card); aspect-ratio: 5 / 4; scroll-snap-align: center; scroll-snap-stop: always; scale: calc(1 - var(--rail-abs, 0) * 0.05); opacity: calc(1 - var(--rail-abs, 0) * 0.3); }
	.mosaic button { position: relative; display: block; width: 100%; height: 100%; overflow: hidden; border-radius: 12px; background: oklch(0.965 0.014 85); }
	.mosaic img { width: 100%; height: 100%; object-fit: cover; transition: scale 0.5s cubic-bezier(0.22, 1, 0.36, 1); }
	.mosaic button:focus-visible { outline: 3px solid var(--sun); outline-offset: 3px; }
	.more { display: none; }
	.count { margin: 14px 0 0; color: var(--muted-foreground); font-size: var(--text-sm); font-variant-numeric: tabular-nums; text-align: center; }
	.count span { color: var(--navy); font-weight: 600; }
	.all { display: none; }

	@media (min-width: 768px) {
		.chips { margin: 30px 0 0; padding: 2px 0; }
		.mosaic { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); grid-auto-flow: dense; gap: 12px; margin: 30px 0 0; padding: 0; overflow: visible; scroll-snap-type: none; }
		.mosaic li { width: auto; scale: none; opacity: 1; }
		.mosaic li.extra { display: none; }
		.mosaic[data-shown='1'] li { aspect-ratio: 16 / 9; }
		.mosaic[data-shown='2'] li { aspect-ratio: 4 / 3; }
		.mosaic.rows { grid-auto-rows: 200px; }
		.mosaic.rows li { aspect-ratio: auto; }
		.mosaic.rows li:first-child { grid-column: span 2; grid-row: span 2; }
		.mosaic.rows li:nth-child(6) { grid-column: 3 / span 2; grid-row: span 2; }
		.mosaic button { border-radius: 10px; }
		.more { position: absolute; inset: 0; display: grid; place-items: center; background: rgb(34 30 25 / 0.6); color: white; font-family: var(--font-display); font-size: var(--text-2xl); }
		.count { display: none; }
		.all { display: flex; justify-content: center; margin-top: 32px; }
	}
	@media (min-width: 1024px) { .mosaic.rows { grid-auto-rows: 250px; } }
	@media (hover: hover) { .mosaic button:hover img { scale: 1.03; } }
	@media (prefers-reduced-motion: reduce) { .mosaic img, .chips button { transition: none; } .mosaic button:hover img { scale: none; } }
</style>
