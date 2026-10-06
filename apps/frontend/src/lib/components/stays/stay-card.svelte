<script lang="ts">
	import { ArrowRight, Route } from '@lucide/svelte';
	import StayPhoto from './stay-photo.svelte';
	import { SAFARI_STYLE_THEME } from '$lib/safari-pricing';
	import { variantsOf, srcsetFor } from '$lib/admin/img';
	import { textContent } from '$lib/home-content';
	import { bestForLabels, stayStyle, stayStyleLabel, stayTypeLabel } from '$lib/stay-content';
	import type { Destination, Stay } from '$lib/types/api';

	// An editorial card: a tall photo with the style on it, then a serif title,
	// a short excerpt and who it suits. Rows without data are left out. The
	// title link covers the card.
	let { stay, destination = null, headingLevel = 3 }: { stay: Stay; destination?: Destination | null; headingLevel?: 2 | 3 } = $props();
	let href = $derived(`/stays/${encodeURIComponent(stay.slug)}`);
	let theme = $derived(SAFARI_STYLE_THEME[stayStyle(stay)]);
	let kicker = $derived([stayTypeLabel(stay.lodge_type), stay.park_area?.trim() || stay.region?.trim()].filter(Boolean).join(' · '));
	let excerpt = $derived(textContent(stay.short_description));
	let suits = $derived(bestForLabels(stay.best_for));
	let tours = $derived(Math.max(0, Math.floor(Number(stay.tour_count) || 0)));
	// Same order as ownStayPhoto(), so the widths offered are of the photo shown.
	let photoField = $derived(stay.image_url_thumbnail ? 'image_url' : stay.hero_image_url_thumbnail ? 'hero_image_url' : stay.image_url ? 'image_url' : stay.cover_image_url ? 'cover_image_url' : 'hero_image_url');
	let srcset = $derived(srcsetFor(variantsOf(stay, photoField), 'webp'));
</script>

<!-- A framed card (the site-wide hover shadow needs an edge to sit on): photo flush to the top, padded copy below. -->
<article data-motion="card" data-motion-hover="card" class="stay-card relative flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgb(15_35_55/.45)] ring-1 ring-navy/10">
	<div class="relative isolate aspect-[5/4] overflow-hidden bg-navy">
		<div class="stay-media absolute inset-0">
			<StayPhoto {stay} {destination} {srcset} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
		</div>
		<span class="absolute top-3 left-3 z-[1] inline-flex h-7 items-center gap-2 rounded-full bg-white/90 px-3 text-[11px] font-semibold tracking-[.12em] text-navy uppercase backdrop-blur"><span class="style-dot" style={`background:${theme.primary}`} aria-hidden="true"></span><span class="sr-only">{'Style: '}</span>{stayStyleLabel(stay)}</span>
		{#if stay.is_featured}<span class="absolute top-3 right-3 z-[1] inline-flex h-7 items-center rounded-full bg-sun px-3 text-[11px] font-semibold tracking-[.12em] text-navy uppercase">Featured</span>{/if}
	</div>
	<div class="flex flex-1 flex-col px-5 pt-5 pb-5 sm:px-6 sm:pt-6">
		{#if kicker}<p class="text-[11px] font-medium tracking-[.16em] text-muted-foreground uppercase">{kicker}</p>{/if}
		<svelte:element this={`h${headingLevel}`} class="mt-2 font-display text-[26px] leading-[1.1] font-medium text-balance text-navy sm:text-[28px]"><a {href} class="stay-link">{stay.name}</a></svelte:element>
		{#if excerpt}<p class="mt-3 line-clamp-3 text-sm leading-7 text-navy/70">{excerpt}</p>{/if}
		{#if suits.length}<p class="mt-3 text-xs leading-5 text-muted-foreground"><span class="sr-only">{'Perfect for: '}</span>{suits.slice(0, 3).join(' · ')}{#if suits.length > 3}{` +${suits.length - 3}`}<span class="sr-only">{' more'}</span>{/if}</p>{/if}
		<div class="mt-auto pt-5">
			<div class="flex min-h-11 items-center justify-between gap-4">
				{#if tours > 0}<span class="inline-flex items-center gap-2 text-[13px] text-muted-foreground"><Route class="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />On {tours} {tours === 1 ? 'safari' : 'safaris'}</span>{/if}
				<span class="stay-cta ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-navy" aria-hidden="true">Discover the stay<ArrowRight class="size-4" /></span>
			</div>
		</div>
	</div>
</article>

<style>
	/* One link per card: the title link covers the whole card. */
	.stay-link::after { content: ''; position: absolute; inset: 0; z-index: 2; }
	.stay-link:focus-visible { outline: none; }
	:global(.stay-card:has(.stay-link:focus-visible)) { outline: 3px solid var(--sun); outline-offset: 4px; }
	.style-dot { width: 0.5rem; height: 0.5rem; flex-shrink: 0; border-radius: 999px; }
	.stay-media { transition: scale 450ms ease-out; }
	:global(.stay-card:hover) .stay-media { scale: 1.04; }
	.stay-cta :global(svg) { transition: translate 180ms ease-out; }
	:global(.stay-card:hover) .stay-cta :global(svg) { translate: 3px 0; }
	@media (prefers-reduced-motion: reduce) {
		.stay-media, .stay-cta :global(svg) { transition: none; }
		:global(.stay-card:hover) .stay-media { scale: none; }
		:global(.stay-card:hover) .stay-cta :global(svg) { translate: none; }
	}
</style>
