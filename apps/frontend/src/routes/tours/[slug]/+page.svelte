<script lang="ts">
	import { ArrowRight, CalendarRange, Check, Clock, Gauge, Info, MapPin, Sparkles, UserRound, Users, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import Enquiry from '$lib/components/home/enquiry.svelte';
	import SafariPriceByGroupSize from '$lib/components/pricing/safari-price-by-group-size.svelte';
	import ItineraryTimeline from '$lib/components/tours/itinerary-timeline.svelte';
	import RichText from '$lib/components/tours/rich-text.svelte';
	import TourActivities from '$lib/components/tours/tour-activities.svelte';
	import TourGallery from '$lib/components/tours/tour-gallery.svelte';
	import TourHero from '$lib/components/tours/tour-hero.svelte';
	import TourSectionNav from '$lib/components/tours/tour-section-nav.svelte';
	import { destinationPhoto, safeUrl, textContent } from '$lib/home-content';
	import { SAFARI_STYLES, stylesWithPrices, type SafariStyle } from '$lib/safari-pricing';
	import { siteInfo } from '$lib/site-info';
	import { durationLabel, groupSizeLabel, initialStyle, lowestPrice, offeredStyles, readableLabel, sortedDays, stylesLabel, tourRoute } from '$lib/tour-itinerary';
	import { tourSeo } from '$lib/tour-seo';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let tour = $derived(data.tour);
	let chrome = $derived(data.chrome);

	// One safari style for the whole page: the itinerary's Overnight and the price table follow it.
	let styles = $derived(offeredStyles(tour));
	let picked = $state<SafariStyle | null>(null);
	let style = $derived(picked && styles.includes(picked) ? picked : initialStyle(styles));
	const chooseStyle = (next: SafariStyle) => { picked = next; };

	let interest = $state('');
	const chooseInterest = (name: string) => { interest = name; };
	const enquireAboutTour = () => chooseInterest(tour.title);
	// The enquiry is about this tour unless the visitor picked something else (or already typed their own).
	let enquiryInterest = $derived(interest || (form?.values?.interest ? '' : tour.title));

	let enquirySection = $derived(chrome.sections.find((section) => section.section_key === 'enquiry' && section.is_active !== false));
	let canEnquire = $derived(Boolean(enquirySection));

	let days = $derived(sortedDays(tour.itinerary_days));
	let route = $derived(tourRoute(tour));
	let seasons = $derived(tour.tour_pricing_seasons ?? []);
	let hasPrices = $derived(stylesWithPrices(seasons).length > 0);
	let from = $derived(lowestPrice(tour));
	let inclusions = $derived([...(tour.tour_inclusions ?? [])].sort((a, b) => a.sort_order - b.sort_order));
	let exclusions = $derived([...(tour.tour_exclusions ?? [])].sort((a, b) => a.sort_order - b.sort_order));
	let activities = $derived(tour.tour_activities ?? []);
	let images = $derived(tour.tour_images ?? []);
	let highlights = $derived((tour.highlights ?? []).map((item) => textContent(item)).filter(Boolean));

	let lead = $derived(textContent(tour.short_description));
	// Skip the short description when the full one already opens with it.
	let showLead = $derived(Boolean(lead) && !textContent(tour.full_description).startsWith(lead.slice(0, 80)));
	let start = $derived(tour.start_location?.trim() ?? '');
	let end = $derived(tour.end_location?.trim() ?? '');
	let facts = $derived(
		[
			{ icon: Clock, label: 'Duration', value: durationLabel(tour.duration_days, tour.duration_nights) },
			{ icon: MapPin, label: 'Starts / ends', value: start && end ? (start === end ? `${start} (return)` : `${start} → ${end}`) : start ? `Starts in ${start}` : end ? `Ends in ${end}` : '' },
			{ icon: Users, label: 'Group size', value: groupSizeLabel(tour.group_size_min, tour.group_size_max) },
			{ icon: UserRound, label: 'Minimum age', value: Number(tour.minimum_age) > 0 ? `${tour.minimum_age}+ years` : '' },
			{ icon: Gauge, label: 'Difficulty', value: readableLabel(tour.difficulty_level) },
			{ icon: Sparkles, label: 'Comfort styles', value: stylesLabel(styles) }
		].filter((fact) => fact.value)
	);

	let heroImage = $derived(safeUrl(tour.banner_image_url || tour.main_image_url, destinationPhoto({ id: tour.id, name: route.join(' '), slug: tour.slug })));
	let seo = $derived(tourSeo(tour, data.siteOrigin, destinationPhoto({ id: tour.id, name: route.join(' '), slug: tour.slug })));

	let sections = $derived([
		{ id: 'overview', label: 'Overview' },
		...(days.length ? [{ id: 'itinerary', label: 'Itinerary' }] : []),
		{ id: 'prices', label: 'Prices' },
		...(inclusions.length || exclusions.length ? [{ id: 'included', label: 'Included' }] : []),
		...(activities.length ? [{ id: 'activities', label: 'Activities' }] : []),
		...(images.length ? [{ id: 'gallery', label: 'Gallery' }] : [])
	]);
	// Anchors that exist here; the header and footer send every other anchor to the home page.
	let onPage = $derived(['top', ...sections.map((section) => section.id), ...(canEnquire ? ['request-quote'] : [])]);
	const styleTitle = (id: SafariStyle) => SAFARI_STYLES.find((item) => item.id === id)?.title ?? 'This safari style';
</script>

<svelte:head>
	<title>{seo.title}</title>
	<meta name="description" content={seo.description} />
	<meta name="application-name" content={siteInfo.company} />
	<meta property="og:site_name" content={siteInfo.company} />
	<meta property="og:title" content={seo.title} />
	<meta property="og:description" content={seo.description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={seo.canonical} />
	<meta property="og:image" content={seo.image} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={seo.title} />
	<meta name="twitter:description" content={seo.description} />
	<meta name="twitter:image" content={seo.image} />
	<meta name="theme-color" content="#14314d" />
	<link rel="canonical" href={seo.canonical} />
	{@html `<script type="application/ld+json">${seo.jsonLd}</script>`}
</svelte:head>

<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-sun focus:p-4">Skip to content</a>
<div id="top"></div>
<SiteHeader visible={chrome.visible} activities={chrome.activities} destinations={chrome.destinations} onInterest={chooseInterest} tours={chrome.navTours} categories={chrome.categories} stays={chrome.navStays} {onPage} />
<main id="main">
	<TourHero {tour} image={heroImage} {route} {from} {canEnquire} {hasPrices} onEnquire={enquireAboutTour} />
	<TourSectionNav items={sections} {canEnquire} onEnquire={enquireAboutTour} />

	<section id="overview" class="tour-section page-container py-14 md:py-20">
		<div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
			<div class="min-w-0">
				<div data-motion="reveal">
					<p class="eyebrow text-muted-foreground">Overview</p>
					<div class="gold-line mt-4"></div>
					<h2 class="section-heading mt-5">About this safari</h2>
				</div>
				{#if showLead}<p class="mt-5 text-base leading-8 text-primary/85 md:text-lg md:leading-9">{lead}</p>{/if}
				<RichText value={tour.full_description} class="mt-5" />
				{#if highlights.length}
					<h3 class="mt-10 text-lg font-bold text-primary">Highlights</h3>
					<ul class="mt-4 grid gap-3 sm:grid-cols-2">
						{#each highlights as highlight}
							<li class="flex gap-3 text-sm leading-6 text-primary/85"><span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-sun/30 text-primary"><Check class="size-3" aria-hidden="true" /></span>{highlight}</li>
						{/each}
					</ul>
				{/if}
				{#if route.length > 1}
					<h3 class="mt-10 text-lg font-bold text-primary">Your route</h3>
					<ol class="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2.5 text-sm text-primary" aria-label="Route">
						{#each route as place, index}
							<li class="flex items-center gap-2">
								{#if index > 0}<ArrowRight class="size-3.5 text-muted-foreground" aria-hidden="true" />{/if}
								<span class="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 font-medium"><MapPin class="size-3.5 text-[#D9A900]" aria-hidden="true" />{place}</span>
							</li>
						{/each}
					</ol>
				{/if}
			</div>
			<aside aria-labelledby="key-facts" class="h-fit rounded-2xl border border-border bg-secondary/40 p-6 md:p-7 lg:sticky lg:top-[calc(var(--site-header-height)+5rem)]">
				<h3 id="key-facts" class="text-lg font-bold text-primary">Key facts</h3>
				<dl class="mt-5 grid gap-4">
					{#each facts as fact (fact.label)}
						<div class="flex gap-3">
							<span class="grid size-9 shrink-0 place-items-center rounded-full bg-white text-primary"><fact.icon class="size-4" aria-hidden="true" /></span>
							<div class="min-w-0"><dt class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{fact.label}</dt><dd class="mt-0.5 text-sm font-semibold text-primary">{fact.value}</dd></div>
						</div>
					{/each}
				</dl>
				{#if canEnquire}<Button variant="safari" href="#request-quote" onclick={enquireAboutTour} class="mt-6 h-11 w-full rounded-lg text-sm">Enquire about this safari <ArrowRight class="size-4" /></Button>{/if}
			</aside>
		</div>
	</section>

	{#if days.length}
		<section id="itinerary" class="tour-section border-t border-border py-14 md:py-20">
			<div class="page-container">
				<ItineraryTimeline {days} {style} {styles} onStyleChange={chooseStyle} />
			</div>
		</section>
	{/if}

	<section id="prices" class="tour-section bg-secondary/45 py-14 md:py-20">
		<div class="page-container">
			{#if hasPrices}
				<div data-motion="reveal">
					<SafariPriceByGroupSize {seasons} {style} onStyleChange={chooseStyle} {styles} headingClass="text-[26px] leading-tight sm:text-3xl md:text-4xl">
						{#snippet empty(shown)}
							<div class="px-2 py-6 text-center">
								<p class="text-base font-semibold text-primary">{styleTitle(shown)} prices on request</p>
								<p class="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">We price this style for your dates and group. Ask us for a quote.</p>
								{#if canEnquire}<Button variant="safari" href="#request-quote" onclick={() => chooseInterest(`${tour.title} (${styleTitle(shown)})`)} class="mt-5 h-11 rounded-lg px-5 text-sm">Request a quote <ArrowRight class="size-4" /></Button>{/if}
							</div>
						{/snippet}
					</SafariPriceByGroupSize>
				</div>
			{:else}
				<div data-motion="reveal" class="mx-auto max-w-3xl rounded-2xl border border-border bg-white p-7 text-center md:p-10">
					<span class="mx-auto grid size-12 place-items-center rounded-full bg-sun/25 text-primary"><CalendarRange class="size-5" aria-hidden="true" /></span>
					<h2 class="section-heading mt-5">Prices on request</h2>
					<p class="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">This safari is priced for your travel dates, group size and preferred comfort level. Share your plans and we’ll prepare a quote for you.</p>
					{#if canEnquire}<Button variant="safari" href="#request-quote" onclick={enquireAboutTour} class="mt-6 h-12 rounded-lg px-6 text-sm">Request a quote <ArrowRight class="size-4" /></Button>{/if}
					<p class="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground"><Info class="size-3.5" aria-hidden="true" />An enquiry comes with no obligation to book.</p>
				</div>
			{/if}
		</div>
	</section>

	{#if inclusions.length || exclusions.length}
		<section id="included" class="tour-section page-container py-14 md:py-20">
			<div data-motion="reveal" class="max-w-2xl">
				<p class="eyebrow text-muted-foreground">Good to know</p>
				<h2 class="section-heading mt-3">What’s included</h2>
			</div>
			<div class="mt-8 grid gap-5 md:grid-cols-2">
				{#if inclusions.length}
					<div data-motion="card" class="rounded-2xl border border-border bg-white p-6 md:p-8">
						<h3 class="text-lg font-bold text-primary">Included</h3>
						<ul class="mt-5 grid gap-3.5">
							{#each inclusions as item}
								<li class="flex gap-3 text-sm leading-6 text-primary/85"><span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success/15 text-success"><Check class="size-3" aria-hidden="true" /></span>{item.title}</li>
							{/each}
						</ul>
					</div>
				{/if}
				{#if exclusions.length}
					<div data-motion="card" class="rounded-2xl border border-border bg-white p-6 md:p-8">
						<h3 class="text-lg font-bold text-primary">Not included</h3>
						<ul class="mt-5 grid gap-3.5">
							{#each exclusions as item}
								<li class="flex gap-3 text-sm leading-6 text-primary/85"><span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive"><X class="size-3" aria-hidden="true" /></span>{item.title}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</section>
	{/if}

	{#if activities.length}
		<section id="activities" class="tour-section bg-[oklch(.975_.009_85)] py-14 md:py-20">
			<div class="page-container">
				<TourActivities items={activities} tourTitle={tour.title} {canEnquire} onInterest={chooseInterest} />
			</div>
		</section>
	{/if}

	{#if images.length}
		<section id="gallery" class="tour-section page-container py-14 md:py-20">
			<TourGallery {images} tourTitle={tour.title} />
		</section>
	{/if}

	{#if enquirySection}
		<Enquiry section={enquirySection} {form} interest={enquiryInterest} />
	{/if}
</main>
<SiteFooter visible={chrome.visible} destinations={chrome.destinations} onInterest={chooseInterest} {onPage} />

<style>
	/* The section bar sticks under the header, so in-page links stop a little lower. */
	.tour-section { scroll-margin-top: 3.5rem; }
</style>
