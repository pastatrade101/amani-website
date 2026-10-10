<script lang="ts">
	import { ArrowRight, Check, Clock, Gauge, MapPin, Sparkles, UserRound, Users, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import Enquiry from '$lib/components/home/enquiry.svelte';
	import SafariPriceByGroupSize from '$lib/components/pricing/safari-price-by-group-size.svelte';
	import ItineraryTimeline from '$lib/components/tours/itinerary-timeline.svelte';
	import RichText from '$lib/components/tours/rich-text.svelte';
	import TourActivities from '$lib/components/tours/tour-activities.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Accordion from '$lib/components/ui/accordion';
	import TourCard from '$lib/components/tours/tour-card.svelte';
	import GuestReviews from '$lib/components/home/guest-reviews.svelte';
	import { ChevronDown } from '@lucide/svelte';
	import TourHero from '$lib/components/tours/tour-hero.svelte';
	import { planHref } from '$lib/planner/plan-href';
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
	let selectedOptionalIds = $state<string[]>([]);
	let selectionTourId = $state('');
	$effect(() => { if (selectionTourId !== tour.id) { selectionTourId = tour.id; selectedOptionalIds = []; } });
	let activities = $derived(tour.tour_activities ?? []);
	let highlights = $derived((tour.highlights ?? []).map((item) => textContent(item)).filter(Boolean));

	let lead = $derived(textContent(tour.short_description));
	// Skip the short description when the full one already opens with it.
	let showLead = $derived(Boolean(lead) && !textContent(tour.full_description).startsWith(lead.slice(0, 80)));
	let start = $derived(tour.start_point?.name?.trim() ?? '');
	let end = $derived(tour.end_point?.name?.trim() ?? '');
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

	let activitiesOpen = $state(false);
	let activitiesDialog = $state<HTMLDivElement | null>(null);
	let overviewExpanded = $state(false);
	let optionalCount = $derived(activities.filter(item => item.is_optional).length);
	let bookingOpen = $state<string[]>([]);
	let related = $derived(chrome.navTours.filter(item => item.id !== tour.id).slice(0, 3));
	let sections = $derived([
		{ id: 'overview', label: 'Why This Safari?' },
		{ id: 'prices', label: 'Price & Inclusions' },
		...(days.length ? [{ id: 'itinerary', label: 'Itinerary' }] : []),
		{ id: 'before-you-book', label: 'Before You Book' }
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
 <section id="overview" class="tour-section tour-container py-12 md:py-16">
  <div class="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12">
   <div class="min-w-0">
    <h2 class="tour-heading">Why choose this safari?</h2><div class="mt-4 h-1 w-12 rounded-full bg-sun"></div>
    <div class:overview-collapsed={!overviewExpanded && textContent(tour.full_description).length > 480} class="overview-copy">
     {#if showLead}<p class="mt-5 text-sm leading-7 text-primary/85 md:text-base md:leading-8">{lead}</p>{/if}
     <RichText value={tour.full_description} class="mt-5" />
    </div>
    {#if textContent(tour.full_description).length > 480}<button type="button" class="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold lg:hidden" aria-expanded={overviewExpanded} onclick={() => overviewExpanded = !overviewExpanded}>{overviewExpanded ? 'Read less' : 'Read more'}<ChevronDown class={`size-4 ${overviewExpanded ? 'rotate-180' : ''}`} /></button>{/if}
    {#if route.length > 1}<div class="mt-7 border-t border-border pt-5"><h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your route</h3><ol class="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-xs font-medium" aria-label="Safari route">{#each route as place,i}<li class="flex items-center gap-3">{#if i}<ArrowRight class="size-3 text-muted-foreground" />{/if}{place}</li>{/each}</ol></div>{/if}
   </div>
   <aside class="rounded-2xl border border-border bg-white p-6" aria-labelledby="safari-highlights">
    <h3 id="safari-highlights" class="text-lg font-semibold">Safari highlights</h3><p class="mt-2 text-xs leading-5 text-muted-foreground">The experiences that make this journey special.</p><div class="mt-4 h-1 w-10 rounded-full bg-sun"></div>
    <ul class="mt-2 divide-y divide-border">{#each highlights as highlight}<li class="flex items-start gap-3 py-4 text-sm leading-6"><span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-sun/15"><Check class="size-3.5" /></span>{highlight}</li>{/each}</ul>
    {#if !highlights.length}<dl class="mt-5 grid gap-4">{#each facts as fact}<div class="flex gap-3"><fact.icon class="mt-1 size-4 shrink-0 text-muted-foreground" /><div><dt class="text-xs text-muted-foreground">{fact.label}</dt><dd class="mt-1 text-sm font-medium">{fact.value}</dd></div></div>{/each}</dl>{/if}
   </aside>
  </div>
 </section>
 <section id="prices" class="tour-section border-y border-border bg-secondary/25 py-12 md:py-16">
  <div class="tour-container">
   {#if hasPrices}
    <SafariPriceByGroupSize {seasons} {style} onStyleChange={chooseStyle} {styles} headingClass="text-2xl font-bold leading-tight md:text-[32px]">
     {#snippet empty(shown)}<div class="p-6 text-center"><h3 class="text-lg font-semibold">{styleTitle(shown)} prices on request</h3><p class="mt-2 text-sm text-muted-foreground">Share your dates and group size for a personal quotation.</p><Button variant="safari" href={canEnquire ? '#request-quote' : planHref({tour:tour.slug,from:'tour_page'})} class="mt-5">Request a quote <ArrowRight class="size-4" /></Button></div>{/snippet}
    </SafariPriceByGroupSize>
   {:else}<div class="py-5 text-center"><h2 class="tour-heading">A safari priced around you</h2><p class="mx-auto mt-4 max-w-xl text-sm leading-7 text-muted-foreground">Share your dates, group size and preferred comfort level. Our team will prepare a personal quotation.</p><Button variant="safari" href={canEnquire ? '#request-quote' : planHref({tour:tour.slug,from:'tour_page'})} class="mt-6">Request a quote <ArrowRight class="size-4" /></Button></div>{/if}
   {#if inclusions.length || exclusions.length || activities.length}
    <div id="included" class="mt-10 rounded-2xl border border-border bg-white p-6 md:p-8">
     <h3 class="text-xl font-semibold">What’s included in your safari</h3>
     {#if inclusions.length}<ul class="mt-6 grid gap-x-10 gap-y-4 md:grid-cols-2">{#each inclusions as item}<li class="flex items-start gap-3 text-sm leading-6"><Check class="mt-1 size-4 shrink-0 text-success" />{item.title}</li>{/each}</ul>{/if}
     {#if exclusions.length}<div class="mt-7 border-t border-border pt-6"><h4 class="text-sm font-semibold">Not included</h4><ul class="mt-4 grid gap-x-10 gap-y-3 md:grid-cols-2">{#each exclusions as item}<li class="flex items-start gap-3 text-sm leading-6 text-muted-foreground"><X class="mt-1 size-4 shrink-0" />{item.title}</li>{/each}</ul></div>{/if}
     {#if activities.length}<div class="mt-7 flex flex-wrap items-center justify-between gap-5 border-t border-border pt-6"><div><h4 class="text-sm font-semibold">Make this safari your own</h4><p class="mt-1.5 text-xs leading-5 text-muted-foreground">{optionalCount ? `${optionalCount} optional experiences to explore. Additional costs are shown before you select.` : 'Explore the experiences included on your safari.'}</p></div><Button variant="outline" class="min-h-11 rounded-lg border-primary px-5 text-sm" onclick={() => activitiesOpen = true}>{optionalCount ? 'View Optional Activities' : 'View Safari Activities'}<ArrowRight class="size-4" /></Button></div>{/if}
    </div>
   {/if}
  </div>
 </section>
 {#if days.length}<section id="itinerary" class="tour-section tour-container py-12 md:py-16"><ItineraryTimeline {days} {style} {styles} onStyleChange={chooseStyle} /></section>{/if}
 <section id="before-you-book" class="tour-section border-y border-border bg-secondary/20 py-12 md:py-16">
  <div class="tour-container"><div class="mx-auto max-w-[1000px]">
   <h2 class="tour-heading text-center">Before you book</h2><p class="mt-3 text-center text-sm leading-6 text-muted-foreground">A few practical details to help you plan your journey.</p>
   <div class="mt-6 flex justify-end"><button type="button" class="min-h-10 text-xs font-semibold" onclick={() => bookingOpen = bookingOpen.length === 4 ? [] : ['route','stay','group','custom']} aria-expanded={bookingOpen.length === 4}>{bookingOpen.length === 4 ? 'Collapse all' : 'View all'} <span aria-hidden="true">→</span></button></div>
   <Accordion.Root type="multiple" bind:value={bookingOpen} class="space-y-3">
    <Accordion.Item value="route" class="rounded-xl border border-border bg-white px-5"><Accordion.Trigger class="py-5 text-sm font-semibold hover:no-underline">Your route & travel arrangements</Accordion.Trigger><Accordion.Content><p class="text-sm leading-7 text-muted-foreground">{durationLabel(tour.duration_days,tour.duration_nights)}{start ? ` · Starts in ${start}` : ''}{end ? ` · Ends in ${end}` : ''}.</p>{#if tour.start_point?.transfer_info}<p class="mt-3 text-sm leading-7 text-muted-foreground">{tour.start_point.transfer_info}</p>{/if}{#if tour.end_point?.transfer_info && tour.end_point.transfer_info !== tour.start_point?.transfer_info}<p class="mt-3 text-sm leading-7 text-muted-foreground">{tour.end_point.transfer_info}</p>{/if}<a href="#itinerary" class="mt-3 inline-flex text-sm font-semibold underline decoration-sun underline-offset-4">Explore the day-by-day route</a></Accordion.Content></Accordion.Item>
    <Accordion.Item value="stay" class="rounded-xl border border-border bg-white px-5"><Accordion.Trigger class="py-5 text-sm font-semibold hover:no-underline">Accommodation & meals</Accordion.Trigger><Accordion.Content><p class="text-sm leading-7 text-muted-foreground">{stylesLabel(styles)}. Open each day in the itinerary to see its accommodation and meal plan. Where several safari styles are available, the itinerary follows your selected style.</p><a href="#itinerary" class="mt-3 inline-flex text-sm font-semibold underline decoration-sun underline-offset-4">See your overnight stays</a></Accordion.Content></Accordion.Item>
    <Accordion.Item value="group" class="rounded-xl border border-border bg-white px-5"><Accordion.Trigger class="py-5 text-sm font-semibold hover:no-underline">Group size & suitability</Accordion.Trigger><Accordion.Content><dl class="grid gap-3 sm:grid-cols-3">{#each facts.filter(fact => ['Group size','Minimum age','Difficulty'].includes(fact.label)) as fact}<div><dt class="text-xs text-muted-foreground">{fact.label}</dt><dd class="mt-1 text-sm font-medium">{fact.value}</dd></div>{/each}</dl><p class="mt-4 text-sm leading-7 text-muted-foreground">Let our team know about mobility needs or special requirements when you enquire.</p></Accordion.Content></Accordion.Item>
    <Accordion.Item value="custom" class="rounded-xl border border-border bg-white px-5"><Accordion.Trigger class="py-5 text-sm font-semibold hover:no-underline">Personalise your safari</Accordion.Trigger><Accordion.Content><RichText value={tour.customization_intro || 'Tell our team what you would like to experience. Your enquiry helps us prepare a safari quotation around your plans.'} />{#if tour.customization_options?.length}<ul class="mt-3 space-y-2">{#each tour.customization_options as option}<li class="flex gap-2 text-sm leading-6"><Check class="mt-1 size-4 shrink-0 text-success" />{option}</li>{/each}</ul>{/if}{#if optionalCount}<Button variant="outline" class="mt-4 text-xs" onclick={() => activitiesOpen = true}>Explore optional activities <ArrowRight class="size-4" /></Button>{/if}</Accordion.Content></Accordion.Item>
   </Accordion.Root>
  </div></div>
 </section>
 {#if data.faqs.length}<section class="tour-container py-12 md:py-16"><div class="mx-auto max-w-[1000px]"><h2 class="tour-heading text-center">Frequently asked questions</h2><Accordion.Root type="single" class="mt-8">{#each data.faqs as faq,i}<Accordion.Item value={String(i)}><Accordion.Trigger class="py-5 text-left text-sm font-semibold hover:no-underline">{faq.question}</Accordion.Trigger><Accordion.Content><RichText value={faq.answer} /></Accordion.Content></Accordion.Item>{/each}</Accordion.Root></div></section>{/if}
 {#if data.reviews.length}<section class="border-y border-border bg-secondary/20 py-12 md:py-16"><div class="tour-container"><h2 class="tour-heading text-center">Stories from our travellers</h2><p class="mt-3 text-center text-sm text-muted-foreground">Guest experiences from journeys with Key2africa Safaris.</p><div class="mt-8"><GuestReviews reviews={data.reviews.slice(0,2)} variant="tour" /></div></div></section>{/if}
 {#if related.length}<section class="tour-container py-12 md:py-16"><div class="flex flex-wrap items-end justify-between gap-4"><h2 class="tour-heading">More safaris to inspire you</h2><a href="/tours" class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold">View all safaris <ArrowRight class="size-4" /></a></div><div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{#each related as item}<TourCard tour={item} />{/each}</div></section>{/if}
 {#if enquirySection}<Enquiry section={enquirySection} {form} interest={enquiryInterest} optionalActivities={activities.filter(item => item.is_optional)} bind:selectedIds={selectedOptionalIds} />{/if}
</main>
<SiteFooter visible={chrome.visible} destinations={chrome.destinations} onInterest={chooseInterest} {onPage} />
<Dialog.Root bind:open={activitiesOpen}><Dialog.Content bind:ref={activitiesDialog} onOpenAutoFocus={(event) => { event.preventDefault(); activitiesDialog?.focus(); }} class="flex max-h-[90dvh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-5xl"><Dialog.Header class="shrink-0 border-b border-border px-5 py-6 pr-12 sm:px-8"><Dialog.Title class="text-xl font-bold">Personalise your safari</Dialog.Title><Dialog.Description>Explore the activities available on this tour. Select your favourites to include them in your enquiry.</Dialog.Description></Dialog.Header><div class="min-h-0 overflow-y-auto overscroll-contain px-5 pb-6 sm:px-8"><TourActivities items={activities} {canEnquire} compact bind:selectedIds={selectedOptionalIds} /></div>{#if canEnquire}<div class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-white p-5 sm:px-8"><p class="text-xs text-muted-foreground" aria-live="polite">{selectedOptionalIds.length} {selectedOptionalIds.length === 1 ? 'activity' : 'activities'} selected</p><Button variant="safari" class="h-11 px-5 text-sm" href="#request-quote" onclick={() => { activitiesOpen = false; enquireAboutTour(); }}>Continue to enquiry <ArrowRight class="size-4" /></Button></div>{/if}</Dialog.Content></Dialog.Root>
<style>
 :global(.tour-container) { width: 100%; max-width: 1440px; margin-inline: auto; padding-inline: 20px; }
 .tour-heading { font-size: 24px; font-weight: 700; line-height: 1.25; letter-spacing: -.025em; color: var(--navy); }
 .tour-section { scroll-margin-top: 54px; }
 :global(#request-quote) { scroll-margin-top: 54px; }
 @media(min-width:768px) { :global(.tour-container) { padding-inline: 32px; } .tour-heading { font-size: 32px; } }
 @media(max-width:767px) { .tour-section { scroll-margin-top: 36px; } :global(#request-quote) { scroll-margin-top: 36px; } }
 @media(max-width:1023px) { .overview-collapsed { max-height: 300px; overflow: hidden; mask-image: linear-gradient(black 75%,transparent); } }
</style>
