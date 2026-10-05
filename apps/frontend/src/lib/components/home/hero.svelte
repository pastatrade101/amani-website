<script lang="ts">
	import { ArrowRight, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { heroSlides } from '$lib/data/reference';
	import { safeUrl, textContent } from '$lib/home-content';
	import type { HomepageSection } from '$lib/types/api';
	let { section, canEnquire = true, showPackages = true }: { section: HomepageSection; canEnquire?: boolean; showPackages?: boolean } = $props();
	let index = $state(0);
	let slides = $derived(section.image_url ? [{ src: safeUrl(section.image_url, heroSlides[0].src), alt: textContent(section.title) }] : heroSlides);
	function go(direction: number) { index = (index + direction + slides.length) % slides.length; }
</script>
<section class="relative isolate flex min-h-[610px] items-center overflow-hidden bg-navy md:min-h-[620px] lg:min-h-[670px]" aria-label="Tanzania safari highlights" aria-roledescription="carousel">
	<div class="absolute inset-0 -z-20 overflow-hidden" aria-live="off">
		{#each slides as slide, i}<img src={slide.src} alt={slide.alt} aria-hidden={i !== index % slides.length} data-motion="hero-image" data-active={i === index % slides.length} width="1920" height="1088" fetchpriority={i === 0 ? 'high' : 'auto'} class="hero-image absolute inset-0 size-full object-cover object-[70%_center] md:object-center" />{/each}
	</div>
	<div class="absolute inset-0 -z-10 bg-linear-to-r from-black/75 via-black/45 to-black/5 max-md:bg-black/50" aria-hidden="true"></div>
	<div class="page-container py-20">
		<div class="max-w-[570px] text-white min-[1440px]:max-w-[640px]">
			<p data-motion="hero" class="text-xs font-semibold tracking-[0.25em] md:text-sm">{section.subtitle}</p><div data-motion="line" data-motion-delay="0.15" class="hero-rule mt-3 h-0.5 w-16 bg-sun"></div>
			<h1 data-motion="hero-title" aria-label={section.title || undefined} class="mt-5 text-[42px] font-semibold leading-[1.08] tracking-[-.045em] sm:text-5xl md:text-6xl lg:text-[70px] min-[1440px]:text-[76px]">{#each (section.title || '').split(/\s+/).filter(Boolean) as word}<span class="hero-word-mask" aria-hidden="true"><span data-motion-word>{word}</span></span>{' '}{/each}</h1>
			<p data-motion="hero" data-motion-delay="0.12" class="mt-5 max-w-[480px] text-sm leading-[1.9] text-white/85 md:text-base">{textContent(section.content)}</p>
			<div data-motion="hero" data-motion-delay="0.24" class="hero-actions mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
				{#if canEnquire}<Button variant="safari" href={safeUrl(section.button_url)} class="hero-cta h-12 min-h-12 rounded-lg px-6 text-sm font-bold">{section.button_text || 'Plan My Safari'} <ArrowRight class="ml-1" /></Button>{/if}
				{#if showPackages}<Button href="#tanzania-safari-packages" variant="outline" class="hero-cta h-12 min-h-12 rounded-lg border-white bg-transparent px-6 text-sm font-semibold text-white hover:bg-white/10 hover:text-white">View Safari Packages</Button>{/if}
			</div>
			<p data-motion="hero" data-motion-delay="0.32" class="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-medium tracking-wide text-white/70"><span>Private journeys</span><span aria-hidden="true" class="size-1 rounded-full bg-sun"></span><span>Local insight</span><span aria-hidden="true" class="size-1 rounded-full bg-sun"></span><span>Your pace</span></p>
		</div>
	</div>
	{#if slides.length > 1}
		<div class="absolute inset-x-0 bottom-7 flex items-center justify-center gap-2">
			<button type="button" onclick={() => go(-1)} class="hidden size-9 place-items-center rounded-full border border-white/40 bg-black/20 text-white transition-colors hover:bg-black/35 sm:grid" aria-label="Previous slide"><ChevronLeft class="size-5" /></button>
			<div class="flex gap-1">
				{#each slides as slide, i}<button type="button" onclick={() => index = i} aria-label={`Show slide ${i + 1}`} aria-current={i === index ? 'true' : undefined} class="grid h-8 min-w-8 place-items-center"><span class={`block h-1.5 rounded-full ${i === index ? 'w-7 bg-sun' : 'w-1.5 bg-white/60'}`}></span></button>{/each}
			</div>
			<button type="button" onclick={() => go(1)} class="hidden size-9 place-items-center rounded-full border border-white/40 bg-black/20 text-white transition-colors hover:bg-black/35 sm:grid" aria-label="Next slide"><ChevronRight class="size-5" /></button>
		</div>
	{/if}
</section>

<style>
    .hero-image { opacity: 0; }
    .hero-image[data-active="true"] { opacity: 1; }
    .hero-rule { transform-origin: left center; }
    .hero-word-mask { display: inline-block; overflow: hidden; vertical-align: bottom; padding-bottom: .1em; margin-bottom: -.1em; }
    .hero-word-mask > span { display: inline-block; transform-origin: left bottom; }

    :global(.hero-cta) { height: 48px; min-height: 48px; display: inline-flex; align-items: center; justify-content: center; line-height: 1.25; padding-block: 0; }
    @media (min-width: 640px) { .hero-actions { width: max-content; max-width: calc(100vw - 96px); } }
</style>
