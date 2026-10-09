<script lang="ts">
	import { ArrowRight, ChevronRight, Images, MapPin } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { planHref } from '$lib/planner/plan-href';
	import StayPhoto from '../stay-photo.svelte';
	import { srcsetFor, variantsOf } from '$lib/admin/img';
	import { safeUrl } from '$lib/home-content';
	import { SAFARI_STYLE_THEME } from '$lib/safari-pricing';
	import { stayLocation, stayPhoto, staysHref, stayStyle, stayStyleLabel, stayTypeLabel, type StayGalleryPhoto } from '$lib/stay-content';
	import type { Destination, StayDetail } from '$lib/types/api';

	// Photo mode: the lead photo full-bleed behind the title. Text mode (no photos
	// of its own): a centred editorial header, with the park's landscape when we
	// have one. The "photos coming soon" placeholder never fills a hero.
	let {
		stay,
		photos,
		place,
		destination = null,
		lead = '',
		canEnquire = false,
		onEnquire,
		onOpenPhotos
	}: {
		stay: StayDetail;
		photos: StayGalleryPhoto[];
		place: { id: string; name: string } | null;
		destination?: Destination | null;
		lead?: string;
		canEnquire?: boolean;
		onEnquire: () => void;
		onOpenPhotos: (index: number, opener: HTMLElement) => void;
	} = $props();
	let cover = $derived(photos[0]);
	// Responsive sources only when the lead photo is one the API made sizes for.
	let variants = $derived(cover?.src === safeUrl(stay.hero_image_url, '') ? variantsOf(stay, 'hero_image_url') : cover?.src === safeUrl(stay.image_url, '') ? variantsOf(stay, 'image_url') : null);
	let avif = $derived(srcsetFor(variants, 'avif'));
	let webp = $derived(srcsetFor(variants, 'webp'));
	let dot = $derived(SAFARI_STYLE_THEME[stayStyle(stay)].primary);
	let type = $derived(stayTypeLabel(stay.lodge_type));
	let location = $derived(stayLocation(stay));
	let standIn = $derived(cover ? null : stayPhoto(stay, destination));
	const pill = 'inline-flex h-7 items-center gap-2 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[.12em] ring-1';
</script>

{#snippet crumbs(light: boolean)}
	<nav aria-label="Breadcrumb" class={`text-xs ${light ? 'text-white/75' : 'text-muted-foreground'}`}>
		<ol class="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
			<li><a href="/" class={`underline-offset-4 hover:underline ${light ? 'hover:text-white' : 'hover:text-navy'}`}>Home</a></li>
			<li aria-hidden="true"><ChevronRight class="size-3" /></li>
			<li><a href="/stays" class={`underline-offset-4 hover:underline ${light ? 'hover:text-white' : 'hover:text-navy'}`}>Stays</a></li>
			{#if place}
				<li aria-hidden="true"><ChevronRight class="size-3" /></li>
				<li><a href={staysHref({}, { destination_id: place.id })} class={`underline-offset-4 hover:underline ${light ? 'hover:text-white' : 'hover:text-navy'}`}>{place.name}</a></li>
			{/if}
			<li aria-hidden="true"><ChevronRight class="size-3" /></li>
			<li aria-current="page" class={`min-w-0 truncate font-medium ${light ? 'text-white' : 'text-navy'}`}>{stay.name}</li>
		</ol>
	</nav>
{/snippet}

{#snippet badges(light: boolean)}
	<ul data-motion="hero" class={`flex flex-wrap items-center gap-2 ${light ? '' : 'justify-center'}`} aria-label="Style and type">
		<li><span class={`${pill} ${light ? 'bg-white/15 text-white ring-white/20 backdrop-blur' : 'bg-white text-navy ring-navy/10'}`}><span class="size-2 rounded-full" style={`background:${dot}`} aria-hidden="true"></span>{stayStyleLabel(stay)}</span></li>
		{#if type}<li><span class={`${pill} ${light ? 'bg-white/15 text-white ring-white/20 backdrop-blur' : 'bg-white text-navy ring-navy/10'}`}>{type}</span></li>{/if}
		{#if stay.is_featured}<li><span class={`${pill} bg-sun text-navy ring-sun`}>Featured</span></li>{/if}
	</ul>
{/snippet}

{#if cover}
	<div class="relative isolate flex h-[72svh] min-h-[460px] flex-col overflow-hidden bg-navy text-white md:h-[84svh] md:max-h-[900px]">
		<picture>
			{#if avif}<source type="image/avif" srcset={avif} sizes="100vw" />{/if}
			{#if webp}<source type="image/webp" srcset={webp} sizes="100vw" />{/if}
			<img src={cover.src} alt={cover.alt} width="1920" height="1080" loading="eager" fetchpriority="high" decoding="async" data-motion="hero-image" data-active="true" class="absolute inset-0 -z-20 size-full object-cover" />
		</picture>
		<div class="absolute inset-0 -z-10 bg-linear-to-t from-black/80 via-black/35 to-black/10" aria-hidden="true"></div>
		<div class="page-container flex flex-1 flex-col pt-5 pb-10 md:pt-7 md:pb-16">
			{@render crumbs(true)}
			<div class="mt-auto flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
				<div class="min-w-0 max-w-4xl">
					{@render badges(true)}
					<div data-motion="line" data-motion-delay="0.1" class="mt-6 h-0.5 w-16 bg-sun"></div>
					<h1 id="stay-title" data-motion="hero-title" class="mt-5 font-display text-[42px] leading-[1.02] font-medium tracking-[-.01em] text-balance sm:text-[58px] lg:text-[76px]">{stay.name}</h1>
					{#if location}<p data-motion="hero" data-motion-delay="0.15" class="mt-5 flex items-start gap-2 text-sm text-white/85 md:text-base"><MapPin class="mt-0.5 size-4 shrink-0 text-sun" aria-hidden="true" />{location}</p>{/if}
				</div>
				{#if photos.length > 1 || canEnquire}
					<div data-motion="hero" data-motion-delay="0.2" class="flex shrink-0 flex-wrap items-center gap-3">
						{#if photos.length > 1}
							<button type="button" onclick={(event) => onOpenPhotos(0, event.currentTarget)} class="inline-flex h-12 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-medium text-white ring-1 ring-white/30 backdrop-blur transition-colors hover:bg-white/20"><Images class="size-4" aria-hidden="true" />View all {photos.length} photos</button>
						{/if}
						{#if canEnquire}<Button variant="safari" href={planHref({ stay: stay.slug, from: 'stay_page' })} data-cta="plan_my_trip" data-cta-location="stay_page" onclick={onEnquire} class="h-12 rounded-full px-6 text-sm">Enquire about this stay <ArrowRight class="size-4" /></Button>{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{:else}
	<div class="bg-[oklch(.985_.006_85)]">
		<div class="page-container pt-5 md:pt-7">
			{@render crumbs(false)}
			<div class="mx-auto max-w-4xl pt-8 text-center md:pt-12">
				{@render badges(false)}
				<h1 id="stay-title" data-motion="hero-title" class="mt-6 font-display text-[42px] leading-[1.02] font-medium tracking-[-.01em] text-balance text-navy sm:text-[58px] lg:text-[76px]">{stay.name}</h1>
				{#if location}<p data-motion="hero" data-motion-delay="0.1" class="mt-5 inline-flex items-start gap-2 text-sm text-muted-foreground md:text-base"><MapPin class="mt-0.5 size-4 shrink-0 text-[#D9A900]" aria-hidden="true" />{location}</p>{/if}
				<div data-motion="line" data-motion-delay="0.1" class="gold-line mx-auto mt-6" style="transform-origin: center"></div>
				{#if lead}<p data-motion="hero" data-motion-delay="0.15" class="mx-auto mt-7 max-w-[40ch] font-display text-[22px] leading-[1.45] text-navy/90 sm:text-[26px]">{lead}</p>{/if}
				{#if canEnquire}<div data-motion="hero" data-motion-delay="0.2" class="mt-8"><Button variant="safari" href={planHref({ stay: stay.slug, from: 'stay_page' })} data-cta="plan_my_trip" data-cta-location="stay_page" onclick={onEnquire} class="h-12 rounded-full px-6 text-sm">Enquire about this stay <ArrowRight class="size-4" /></Button></div>{/if}
			</div>
			{#if standIn?.kind === 'place'}
				<div data-motion="image" class="relative mt-10 aspect-[4/3] overflow-hidden rounded-2xl bg-navy sm:aspect-[16/9] lg:aspect-[21/9]">
					<StayPhoto {stay} {destination} loading="eager" note="photos of the stay coming soon" />
				</div>
			{/if}
		</div>
	</div>
{/if}

