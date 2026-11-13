<script lang="ts">
	import { ArrowRight, ChevronRight, Route } from '@lucide/svelte';
	import StayPhoto from './stay-photo.svelte';
	import { SAFARI_STYLE_THEME } from '$lib/safari-pricing';
	import { variantsOf, srcsetFor } from '$lib/admin/img';
	import { textContent } from '$lib/home-content';
	import { bestForLabels, stayStyle, stayStyleLabel, stayTypeLabel } from '$lib/stay-content';
	import type { Destination, Stay } from '$lib/types/api';

	// A stay, framed: the photo with its style on it, then what kind of place it
	// is and where, the name, a short excerpt and who it suits. Rows without
	// data are left out. The title link covers the card.
	//
	// `compact` (the stays list): on phones the card becomes an app list row, a
	// square photo beside the name, so a long list scans quickly and a missing
	// photo is a small tile rather than a big empty frame.
	let { stay, destination = null, headingLevel = 3, compact = false }: { stay: Stay; destination?: Destination | null; headingLevel?: 2 | 3; compact?: boolean } = $props();
	let href = $derived(`/stays/${encodeURIComponent(stay.slug)}`);
	let theme = $derived(SAFARI_STYLE_THEME[stayStyle(stay)]);
	let kind = $derived([stayTypeLabel(stay.lodge_type), stay.park_area?.trim() || stay.region?.trim()].filter(Boolean).join(' · '));
	let excerpt = $derived(textContent(stay.short_description));
	let suits = $derived(bestForLabels(stay.best_for));
	let tours = $derived(Math.max(0, Math.floor(Number(stay.tour_count) || 0)));
	// Same order as ownStayPhoto(), so the widths offered are of the photo shown.
	let photoField = $derived(stay.image_url_thumbnail ? 'image_url' : stay.hero_image_url_thumbnail ? 'hero_image_url' : stay.image_url ? 'image_url' : stay.cover_image_url ? 'cover_image_url' : 'hero_image_url');
	let srcset = $derived(srcsetFor(variantsOf(stay, photoField), 'webp'));
</script>

<article data-motion="card" data-motion-hover="card" class="stay-card" class:compact style={`--style-color:${theme.primary}`}>
	<div class="stay-photo">
		<div class="stay-media">
			<StayPhoto {stay} {destination} {srcset} sizes={compact ? '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 120px' : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'} />
		</div>
		<span class="stay-style"><span class="dot" aria-hidden="true"></span><span class="sr-only">{'Style: '}</span>{stayStyleLabel(stay)}</span>
		{#if stay.is_featured}<span class="stay-featured">Featured</span>{/if}
	</div>
	<div class="stay-copy">
		{#if kind}<p class="stay-kind">{kind}</p>{/if}
		<svelte:element this={`h${headingLevel}`} class="stay-name"><a {href} class="stay-link">{stay.name}</a></svelte:element>
		<!-- Phones, compact: the style rides under the name instead of on the photo. -->
		<p class="stay-meta" aria-hidden="true"><span class="dot"></span>{stayStyleLabel(stay)}{#if tours > 0}<span class="sep">·</span>On {tours} {tours === 1 ? 'safari' : 'safaris'}{/if}</p>
		{#if excerpt}<p class="stay-excerpt">{excerpt}</p>{/if}
		{#if suits.length}<p class="stay-suits"><span class="sr-only">{'Perfect for: '}</span>{suits.slice(0, 3).join(' · ')}{#if suits.length > 3}{` +${suits.length - 3}`}<span class="sr-only">{' more'}</span>{/if}</p>{/if}
		<div class="stay-foot">
			{#if tours > 0}<span class="stay-tours"><Route class="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />On {tours} {tours === 1 ? 'safari' : 'safaris'}</span>{/if}
			<span class="stay-cta" aria-hidden="true">Discover the stay<ArrowRight class="size-4" /></span>
		</div>
	</div>
	<span class="stay-chevron" aria-hidden="true"><ChevronRight class="size-5" /></span>
</article>

<style>
	.stay-card { position: relative; display: flex; flex-direction: column; height: 100%; overflow: hidden; border-radius: 14px; background: white; box-shadow: 0 0 0 1px rgb(43 39 34 / 0.08), 0 18px 40px -34px rgb(39 36 31 / 0.45); }
	.stay-photo { position: relative; isolation: isolate; aspect-ratio: 5 / 4; overflow: hidden; background: var(--navy); }
	.stay-media { position: absolute; inset: 0; transition: scale 450ms cubic-bezier(0.22, 1, 0.36, 1); }
	.stay-style, .stay-featured { position: absolute; top: 12px; z-index: 1; display: inline-flex; align-items: center; gap: 7px; height: 28px; padding: 0 10px; border-radius: 6px; font-size: var(--text-xs); font-weight: 600; }
	.stay-style { left: 12px; background: rgb(255 255 255 / 0.94); color: var(--navy); }
	.stay-featured { right: 12px; background: var(--sun); color: var(--navy); }
	.dot { width: 8px; height: 8px; flex: none; border-radius: 50%; background: var(--style-color); }
	.stay-copy { display: flex; flex: 1; flex-direction: column; padding: 20px 22px 20px; }
	.stay-kind { margin: 0 0 6px; overflow: hidden; color: var(--muted-foreground); font-size: var(--text-xs); font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
	.stay-name { margin: 0; font-family: var(--font-display); font-size: var(--text-xl); font-weight: 600; line-height: 1.2; letter-spacing: -0.02em; color: var(--navy); text-wrap: balance; }
	.stay-meta { display: none; }
	.stay-excerpt { display: -webkit-box; margin: 10px 0 0; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; color: rgb(43 39 34 / 0.72); font-size: var(--text-sm); line-height: 1.65; }
	.stay-suits { margin: 10px 0 0; color: var(--muted-foreground); font-size: var(--text-xs); line-height: 1.5; }
	.stay-foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 44px; margin-top: auto; padding-top: 16px; }
	.stay-tours { display: inline-flex; align-items: center; gap: 8px; color: var(--muted-foreground); font-size: var(--text-sm); }
	.stay-cta { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; color: var(--navy); font-size: var(--text-sm); font-weight: 600; }
	.stay-chevron { display: none; }
	/* One link per card: the title link covers the whole card. */
	.stay-link { color: inherit; text-decoration: none; }
	.stay-link::after { content: ''; position: absolute; inset: 0; z-index: 2; }
	.stay-link:focus-visible { outline: none; }
	.stay-card:has(.stay-link:focus-visible) { outline: 3px solid var(--sun); outline-offset: 4px; }
	.stay-cta :global(svg) { transition: translate 180ms ease-out; }
	@media (hover: hover) {
		.stay-card:hover .stay-media { scale: 1.04; }
		.stay-card:hover .stay-cta :global(svg) { translate: 3px 0; }
	}

	/* Phones, compact: one row per stay. */
	@media (max-width: 639px) {
		.compact { flex-direction: row; align-items: center; gap: 14px; height: auto; padding: 10px 40px 10px 10px; border-radius: 12px; transition: scale 0.18s ease; }
		.compact:active { scale: 0.985; }
		.compact .stay-photo { flex: none; width: 104px; aspect-ratio: 1; border-radius: 9px; }
		.compact .stay-style, .compact .stay-featured { display: none; }
		/* A park landscape stands in for missing rooms: the pin still says so. */
		.compact :global(.place-label) { left: 6px; bottom: 6px; max-width: none; padding: 4px; }
		.compact :global(.place-label > span) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
		.compact :global(.placeholder-text) { display: none; }
		.compact :global(.placeholder-mark) { width: 40px; height: 40px; }
		.compact .stay-copy { min-width: 0; padding: 0; }
		.compact .stay-kind { margin-bottom: 4px; font-size: var(--text-xs); }
		.compact .stay-name { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; font-size: var(--text-base); line-height: 1.25; }
		.compact .stay-meta { display: flex; align-items: center; gap: 6px; margin: 7px 0 0; color: var(--muted-foreground); font-size: var(--text-xs); font-weight: 500; white-space: nowrap; }
		.compact .stay-meta .sep { color: #c9c2b4; }
		.compact .stay-excerpt, .compact .stay-suits, .compact .stay-foot { display: none; }
		.compact .stay-chevron { position: absolute; right: 12px; top: 50%; display: grid; color: #b3ab9c; translate: 0 -50%; }
	}
	@media (prefers-reduced-motion: reduce) {
		.stay-media, .stay-cta :global(svg), .compact { transition: none; }
		.stay-card:hover .stay-media, .compact:active { scale: none; }
		.stay-card:hover .stay-cta :global(svg) { translate: none; }
	}
</style>
