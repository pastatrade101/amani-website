<script lang="ts">
	import { ArrowRight, ChevronRight, MapPin, Moon, Route } from '@lucide/svelte';
	import StayPhoto from './stay-photo.svelte';
	import { SAFARI_STYLE_THEME } from '$lib/safari-pricing';
	import { variantsOf, srcsetFor } from '$lib/admin/img';
	import { textContent } from '$lib/home-content';
	import { nightsLabel, stayStyle, stayStyleLabel, stayTypeLabel } from '$lib/stay-content';
	import type { Destination, Stay } from '$lib/types/api';

	// A stay, framed like the tour cards (photo, name, a few facts in ruled
	// rows, one clear way on) but lighter: no save or compare, and the way on is
	// a quiet button, so the safaris keep the site's yellow. Rows without data
	// are left out. The title link covers the card.
	//
	// `compact` (lists): on phones the card becomes an app list row, a square
	// photo beside the name, so a long list scans quickly.
	let { stay, destination = null, headingLevel = 3, compact = false }: { stay: Stay; destination?: Destination | null; headingLevel?: 2 | 3; compact?: boolean } = $props();
	let href = $derived(`/stays/${encodeURIComponent(stay.slug)}`);
	let theme = $derived(SAFARI_STYLE_THEME[stayStyle(stay)]);
	let styleLabel = $derived(stayStyleLabel(stay));
	let kind = $derived([stayTypeLabel(stay.lodge_type), stay.park_area?.trim() || stay.region?.trim()].filter(Boolean).join(' · '));
	let excerpt = $derived(textContent(stay.short_description));
	let place = $derived(destination?.name?.trim() || stay.destinations?.name?.trim() || '');
	// The type line under the name often names the park already: say it once.
	let showPlace = $derived(Boolean(place) && !kind.includes(place));
	let nights = $derived(nightsLabel(stay.recommended_nights));
	let tours = $derived(Math.max(0, Math.floor(Number(stay.tour_count) || 0)));
	let toursLabel = $derived(tours ? `On ${tours} ${tours === 1 ? 'safari' : 'safaris'}` : '');
	// Same order as ownStayPhoto(), so the widths offered are of the photo shown.
	let photoField = $derived(stay.image_url_thumbnail ? 'image_url' : stay.hero_image_url_thumbnail ? 'hero_image_url' : stay.image_url ? 'image_url' : stay.cover_image_url ? 'cover_image_url' : 'hero_image_url');
	let srcset = $derived(srcsetFor(variantsOf(stay, photoField), 'webp'));
</script>

<article data-motion="card" data-motion-hover="card" class="stay-card" class:compact style={`--style-color:${theme.primary}`}>
	<div class="stay-photo">
		<div class="stay-media">
			<StayPhoto {stay} {destination} {srcset} sizes={compact ? '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 120px' : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'} />
		</div>
		<span class="stay-style"><span class="dot" aria-hidden="true"></span><span class="sr-only">{'Style: '}</span>{styleLabel}</span>
		{#if stay.is_featured}<span class="stay-featured">Featured</span>{/if}
	</div>
	<div class="stay-copy">
		<svelte:element this={`h${headingLevel}`} class="stay-name"><a {href} class="stay-link">{stay.name}</a></svelte:element>
		{#if kind}<p class="stay-kind">{kind}</p>{/if}
		<!-- Phones, compact: the style rides under the name instead of on the photo. -->
		<p class="stay-meta" aria-hidden="true"><span class="dot"></span>{styleLabel}{#if toursLabel}<span class="sep">·</span>{toursLabel}{/if}</p>
		{#if excerpt}<p class="stay-excerpt">{excerpt}</p>{/if}
		<div class="stay-foot">
		{#if showPlace || nights || toursLabel}
			<dl class="stay-facts">
				{#if showPlace}<div><dt><MapPin aria-hidden="true" />Location</dt><dd>{place}</dd></div>{/if}
				{#if nights}<div><dt><Moon aria-hidden="true" />Suggested stay</dt><dd>{nights}</dd></div>{/if}
				{#if toursLabel}<div><dt><Route aria-hidden="true" />Our safaris</dt><dd>{toursLabel}</dd></div>{/if}
			</dl>
		{/if}
		<span class="stay-cta" aria-hidden="true">View the stay<ArrowRight /></span>
		</div>
	</div>
	<span class="stay-chevron" aria-hidden="true"><ChevronRight class="size-5" /></span>
</article>

<style>
	.stay-card { position: relative; display: flex; flex-direction: column; height: 100%; overflow: hidden; border-radius: var(--radius-surface); background: white; box-shadow: 0 0 0 1px rgb(43 39 34 / 0.08), 0 1px 2px rgb(39 36 31 / 0.04); transition: box-shadow 0.2s ease; }
	.stay-photo { position: relative; isolation: isolate; aspect-ratio: 16 / 10; overflow: hidden; background: var(--navy); }
	.stay-media { position: absolute; inset: 0; transition: scale 450ms cubic-bezier(0.22, 1, 0.36, 1); }
	.stay-style, .stay-featured { position: absolute; top: 12px; z-index: 1; display: inline-flex; align-items: center; gap: 7px; height: 30px; padding: 0 10px; border-radius: var(--radius-control); font-size: var(--text-xs); font-weight: 650; box-shadow: 0 8px 20px -12px rgb(39 36 31 / 0.55); }
	.stay-style { left: 12px; background: rgb(255 255 255 / 0.95); color: var(--navy); }
	.stay-featured { right: 12px; background: var(--sun); color: var(--navy); }
	.dot { width: 8px; height: 8px; flex: none; border-radius: 50%; background: var(--style-color); }
	.stay-copy { display: flex; flex: 1; flex-direction: column; padding: 18px 20px 20px; }
	.stay-kind { margin: 5px 0 0; overflow: hidden; color: var(--muted-foreground); font-size: var(--text-xs); font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
	.stay-name { display: -webkit-box; margin: 0; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; font-size: var(--text-lg); font-weight: 600; line-height: 1.35; letter-spacing: -0.015em; color: var(--navy); text-wrap: balance; }
	.stay-meta { display: none; }
	.stay-excerpt { display: -webkit-box; margin: 8px 0 0; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; color: var(--muted-foreground); font-size: var(--text-sm); line-height: 1.6; }
	/* Facts in ruled rows, as on the tour cards, in sentence case. */
	.stay-foot { margin-top: auto; padding-top: 16px; }
	.stay-facts { margin: 0 0 6px; }
	.stay-facts div { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid var(--border); }
	.stay-facts dt { display: flex; flex: none; align-items: center; gap: 9px; color: var(--muted-foreground); font-size: var(--text-xs); font-weight: 500; }
	.stay-facts dt :global(svg) { width: 16px; height: 16px; stroke-width: 1.7; }
	.stay-facts dd { min-width: 0; margin: 0; overflow: hidden; color: var(--navy); font-size: var(--text-sm); font-weight: 600; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
	/* The way on: a full-width button like the tour cards', in sand, turning sun on hover. */
	.stay-cta { display: flex; align-items: center; justify-content: center; gap: 8px; height: 44px; border-radius: var(--radius-control); background: #f1ede4; color: var(--navy); font-size: var(--text-sm); font-weight: 700; transition: background-color 180ms ease-out; }
	.stay-cta :global(svg) { width: 16px; height: 16px; transition: translate 180ms ease-out; }
	.stay-chevron { display: none; }
	/* One link per card: the title link covers the whole card. */
	.stay-link { color: inherit; text-decoration: none; }
	.stay-link::after { content: ''; position: absolute; inset: 0; z-index: 2; }
	.stay-link:focus-visible { outline: none; }
	.stay-card:has(.stay-link:focus-visible) { outline: 3px solid var(--sun); outline-offset: 4px; }
	@media (hover: hover) and (pointer: fine) {
		.stay-card:hover { box-shadow: 0 0 0 1px rgb(43 39 34 / 0.1), 0 8px 20px -14px rgb(39 36 31 / 0.22); }
		.stay-card:hover .stay-media { scale: 1.03; }
		.stay-card:hover .stay-cta { background: var(--sun); }
		.stay-card:hover .stay-cta :global(svg) { translate: 3px 0; }
	}

	/* Phones, compact: one row per stay. */
	@media (max-width: 639px) {
		.compact { flex-direction: row; align-items: center; gap: 14px; height: auto; padding: 10px 40px 10px 10px; transition: scale 160ms cubic-bezier(0.23, 1, 0.32, 1); }
		.compact:active { scale: 0.985; }
		.compact .stay-photo { flex: none; width: 104px; aspect-ratio: 1; border-radius: var(--radius-control); }
		.compact .stay-style, .compact .stay-featured { display: none; }
		/* A park landscape stands in for missing rooms: the pin still says so. */
		.compact :global(.place-label) { left: 6px; bottom: 6px; max-width: none; padding: 4px; }
		.compact :global(.place-label > span) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
		.compact :global(.placeholder-text) { display: none; }
		.compact :global(.placeholder-mark) { width: 40px; height: 40px; }
		.compact .stay-copy { min-width: 0; padding: 0; }
		.compact .stay-kind { margin-top: 4px; }
		.compact .stay-name { font-size: var(--text-base); line-height: 1.25; }
		.compact .stay-meta { display: flex; align-items: center; gap: 6px; margin: 7px 0 0; color: var(--muted-foreground); font-size: var(--text-xs); font-weight: 500; white-space: nowrap; }
		.compact .stay-meta .sep { color: #c9c2b4; }
		.compact .stay-excerpt, .compact .stay-foot { display: none; }
		.compact .stay-chevron { position: absolute; right: 12px; top: 50%; display: grid; color: #b3ab9c; translate: 0 -50%; }
	}
	@media (prefers-reduced-motion: reduce) {
		.stay-media, .stay-cta, .stay-cta :global(svg), .compact { transition: none; }
		.stay-card:hover .stay-media, .compact:active { scale: none; }
		.stay-card:hover .stay-cta :global(svg) { translate: none; }
	}
</style>
