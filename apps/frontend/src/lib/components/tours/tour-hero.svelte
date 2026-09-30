<script lang="ts">
	import { ArrowRight, ChevronRight, Clock, MapPin, Route, Tag, Users } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatPrice } from '$lib/safari-pricing';
	import { durationLabel, groupSizeLabel } from '$lib/tour-itinerary';
	import type { TourDetail } from '$lib/types/api';

	let {
		tour,
		image,
		route,
		from,
		canEnquire,
		hasPrices,
		onEnquire
	}: {
		tour: TourDetail;
		image: string;
		route: string[];
		from: { amount: number; currency: string } | null;
		canEnquire: boolean;
		hasPrices: boolean;
		onEnquire: () => void;
	} = $props();

	let duration = $derived(durationLabel(tour.duration_days, tour.duration_nights));
	let group = $derived(groupSizeLabel(tour.group_size_min, tour.group_size_max));
	// Long routes keep their first stops and the finish, so the hero stays two lines at most.
	let routeText = $derived(route.length > 4 ? `${route.slice(0, 3).join(' → ')} → … → ${route.at(-1)}` : route.join(' → '));
	let start = $derived(tour.start_location?.trim() ?? '');
	let end = $derived(tour.end_location?.trim() ?? '');
	let startEnd = $derived(start && end ? (start === end ? `Starts & ends in ${start}` : `${start} → ${end}`) : start ? `Starts in ${start}` : end ? `Ends in ${end}` : '');
</script>

<section class="relative isolate overflow-hidden bg-navy text-white">
	<img src={image} alt={tour.title} width="1920" height="1080" fetchpriority="high" class="absolute inset-0 -z-20 size-full object-cover" />
	<div class="absolute inset-0 -z-10 bg-linear-to-t from-black/85 via-black/50 to-black/20 md:bg-linear-to-r md:from-black/80 md:via-black/45 md:to-black/5" aria-hidden="true"></div>
	<div class="page-container flex min-h-[540px] flex-col py-6 md:min-h-[580px] md:py-8 lg:min-h-[620px]">
		<nav aria-label="Breadcrumb" class="text-xs text-white/75">
			<ol class="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
				<li><a href="/" class="underline-offset-4 hover:text-white hover:underline">Home</a></li>
				<li aria-hidden="true"><ChevronRight class="size-3" /></li>
				<li><a href="/tours" class="underline-offset-4 hover:text-white hover:underline">Tours</a></li>
				<li aria-hidden="true"><ChevronRight class="size-3" /></li>
				<li aria-current="page" class="min-w-0 truncate text-white">{tour.title}</li>
			</ol>
		</nav>
		<div class="mt-auto max-w-3xl pt-20">
			{#if tour.tour_categories?.name}
				<p data-motion="hero" class="eyebrow text-sun">{tour.tour_categories.name}</p>
				<div data-motion="line" data-motion-delay="0.1" class="gold-line mt-3"></div>
			{/if}
			<h1 data-motion="hero" data-motion-delay="0.05" class="hero-title text-[34px] font-semibold leading-[1.1] tracking-[-0.04em] text-balance sm:text-5xl lg:text-[60px]">{tour.title}</h1>
			<ul data-motion="hero" data-motion-delay="0.15" class="mt-6 flex flex-wrap gap-2 text-xs font-medium text-white/90 md:text-[13px]" aria-label="Trip facts">
				{#if duration}<li class="hero-fact"><Clock class="size-3.5" aria-hidden="true" />{duration}</li>{/if}
				{#if routeText}<li class="hero-fact"><Route class="size-3.5" aria-hidden="true" /><span class="sr-only">Route: </span>{routeText}</li>{/if}
				{#if group}<li class="hero-fact"><Users class="size-3.5" aria-hidden="true" />{group}</li>{/if}
				{#if startEnd}<li class="hero-fact"><MapPin class="size-3.5" aria-hidden="true" />{startEnd}</li>{/if}
				{#if from}<li class="hero-fact"><Tag class="size-3.5" aria-hidden="true" />From {formatPrice(from.amount, from.currency)} per person</li>{/if}
			</ul>
			{#if canEnquire || hasPrices}
				<div data-motion="hero" data-motion-delay="0.24" class="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
					{#if canEnquire}<Button variant="safari" href="#request-quote" onclick={onEnquire} class="h-12 rounded-lg px-6 text-sm font-bold">Enquire about this safari <ArrowRight class="ml-1" /></Button>{/if}
					{#if hasPrices}<Button href="#prices" variant="outline" class="h-12 rounded-lg border-white bg-transparent px-6 text-sm font-semibold text-white hover:bg-white/10 hover:text-white">See prices</Button>{/if}
				</div>
			{/if}
		</div>
	</div>
</section>

<style>
	.hero-fact { display: inline-flex; max-width: 100%; align-items: center; gap: 0.4rem; border: 1px solid rgb(255 255 255 / 0.22); border-radius: 999px; background: rgb(255 255 255 / 0.1); padding: 0.4rem 0.8rem; line-height: 1.35; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
	.hero-fact :global(svg) { flex-shrink: 0; color: var(--sun); }
	/* Safety net for unexpected data: four lines on phones, three from sm — as much as a
	   title within the editor's limit takes. A max-height rather than line-clamp keeps the
	   block (and text-balance) as it was. Poppins' descenders hang below the 1.1 line box,
	   so the clip gets 0.12em of padding and matching negative margins keep the spacing
	   (mt-4 above, nothing below) unchanged. */
	.hero-title { max-height: calc(4 * 1.1em + 0.24em); overflow: hidden; overflow-wrap: anywhere; padding-block: 0.12em; margin: calc(1rem - 0.12em) 0 -0.12em; }
	@media (min-width: 640px) { .hero-title { max-height: calc(3 * 1.1em + 0.24em); } }
</style>
