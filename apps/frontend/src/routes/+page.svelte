<script lang="ts">
	import { PHOTO } from '$lib/media-photos';
	import HomeCarousel from '$lib/components/home/home-carousel.svelte';
	import HomeReviews from '$lib/components/home/home-reviews.svelte';
	import HomeIntro from '$lib/components/home/home-intro.svelte';
	import HomeConsultant from '$lib/components/home/home-consultant.svelte';
	import HomeTrust from '$lib/components/home/home-trust.svelte';
	import HomeOffers from '$lib/components/home/home-offers.svelte';
	import { ArrowRight } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { planHref } from '$lib/planner/plan-href';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import Faq from '$lib/components/home/faq.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import Hero from '$lib/components/home/hero.svelte';
	import Experiences from '$lib/components/home/experiences.svelte';
	import TourCard from '$lib/components/tours/tour-card.svelte';
	import { siteInfo, websiteSchema } from '$lib/site-info';
	import { homeSections, linkedSections, textContent, tourPhotos } from '$lib/home-content';
	import type { TourDetail } from '$lib/types/api';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	// What the menus may link to; the FAQ section renders only with questions placed on the home page.
	let visible = $derived(linkedSections(data.sections, !data.faqs?.length));
	// The page itself, in the order set by HOME_LAYOUT.
	let blocks = $derived(homeSections(data.sections));
	let canEnquire = $derived(visible.includes('enquiry'));
	// The published team behind the tours, when a tour names one with a photo.
	// The tours list carries the same specialist as a tour page.
	let team = $derived(([...data.tours, ...data.navTours] as TourDetail[]).map((tour) => tour.specialist).find((person) => person?.name && person.photo_url && person.status === 'published') ?? null);
	let hero = $derived(data.sections.find((section) => section.section_key === 'hero'));
	let pageTitle = $derived(`${hero?.title || 'Tanzania Safaris'} | ${siteInfo.company}`);
	let structuredData = $derived(JSON.stringify(websiteSchema(data.siteOrigin)).replace(/</g, '\\u003c'));
	let photos = $derived(tourPhotos(data.tours));
	// The menus' interest links open the hero form; it has no interest field to fill.
	const chooseInterest = (_name: string) => {};
	function pageHref(page: number) {
		const params = new URLSearchParams({ ...data.filters, page: String(page) });
		for (const [key, value] of [...params]) if (!value) params.delete(key);
		return `/?${params}#tanzania-safari-packages`;
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={siteInfo.description} />
	<meta name="application-name" content={siteInfo.company} />
	<meta property="og:site_name" content={siteInfo.company} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={siteInfo.description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={`${data.siteOrigin}/`} />
	<meta property="og:image" content={`${data.siteOrigin}/images/tanzania-safari-hero.jpg`} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={siteInfo.description} />
	<meta name="twitter:image" content={`${data.siteOrigin}/images/tanzania-safari-hero.jpg`} />
	<meta name="theme-color" content="#36312b" />
	<link rel="canonical" href={`${data.siteOrigin}/`} />
	{@html `<script type="application/ld+json">${structuredData}</script>`}
</svelte:head>
<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-sun focus:p-4">Skip to content</a>
<div id="top"></div>
<SiteHeader {visible} activities={data.activities} destinations={data.destinations} onInterest={chooseInterest} tours={data.navTours} categories={data.categories} stays={data.navStays} />
<main id="main" class="home-page">
	{#each blocks as section (section.section_key)}
		{#if section.section_key === 'hero'}
			<Hero {section} {canEnquire} showPackages={visible.includes('safari_packages')} form={form?.formKind === 'hero' ? form : null} reviewTotal={data.reviewTotal} reviewAverage={data.reviewAverage} />
		{:else if section.section_key === 'company_intro'}
			<HomeIntro {section} {team} {canEnquire} />
		{:else if section.section_key === 'safari_packages'}
			<section id="tanzania-safari-packages" class="home-band home-cream">
				<div class="home-container">
					{#snippet toursHead()}<h2 class="home-heading">{section.title}</h2>{#if textContent(section.content)}<p class="home-copy mt-3">{textContent(section.content)}</p>{/if}{#if data.filters.search}<p class="mt-3 text-sm font-medium">Results for “{data.filters.search}”</p>{/if}{/snippet}
					{#snippet toursActions()}{#if data.filters.search || data.filters.destination_id || data.filters.category_id}<Button href="/#tanzania-safari-packages" variant="outline" class="bg-white">Clear filters</Button>{/if}<a href="/tours" class="home-see-all">View all safaris <ArrowRight /></a>{/snippet}
					{#if data.tours.length}
						<div data-motion="reveal"><HomeCarousel items={data.tours} label="safaris" columns={3} head={toursHead} actions={toursActions}>{#snippet card(tour, i)}<TourCard {tour} photo={photos[i]} />{/snippet}</HomeCarousel></div>
					{:else}
						<div data-motion="reveal" class="flex flex-wrap items-end justify-between gap-5"><div class="max-w-2xl">{@render toursHead()}</div><div class="flex flex-wrap items-center gap-3">{@render toursActions()}</div></div>
						<div data-motion="image" class="mt-8 grid overflow-hidden rounded-[var(--radius-surface)] border border-border bg-white md:grid-cols-2">
							<img src={PHOTO.balloonsDawn} alt="Hot air balloons drifting over the Serengeti at sunrise" loading="lazy" class="h-60 w-full object-cover md:h-full md:min-h-80" />
							<div class="flex flex-col items-start justify-center p-7 md:p-10"><h3 class="max-w-md text-2xl font-semibold tracking-tight md:text-3xl">{data.toursUnavailable ? 'Your safari starts with a conversation' : 'No safaris match your search yet'}</h3><p class="mt-4 max-w-md text-sm leading-7 text-muted-foreground">{data.toursUnavailable ? 'We can’t display our published itineraries right now. Share the places and experiences on your wish list, and let’s plan a personal Tanzania journey.' : 'Try a different destination or style, or let us create a trip around your interests.'}</p>{#if canEnquire}<Button variant="safari" href={planHref({ from: 'home_tours' })} data-cta="plan_my_trip" data-cta-location="home_tours" class="mt-6 h-12 px-6">Create my safari <ArrowRight class="size-4" /></Button>{/if}</div>
						</div>
					{/if}
					{#if data.pageCount > 1 && (data.filters.search || data.filters.destination_id || data.filters.category_id)}<nav aria-label="Safari search pages" class="mt-8 flex items-center justify-center gap-4"><Button href={pageHref(data.page - 1)} disabled={data.page <= 1} variant="outline">Previous</Button><span class="text-xs">Page {data.page} of {data.pageCount}</span><Button href={pageHref(data.page + 1)} disabled={data.page >= data.pageCount} variant="outline">Next</Button></nav>{/if}
				</div>
			</section>
		{:else if section.section_key === 'experiences'}
			<Experiences items={data.activities} categories={data.categories} {section} />
		{:else if section.section_key === 'planning_cta'}
			<HomeConsultant {section} {team} {canEnquire} />
		{:else if section.section_key === 'safari_offers'}
			<HomeOffers {section} categories={data.categories} destinations={data.destinations} {canEnquire} />
		{:else if section.section_key === 'trust_features'}
			<HomeTrust {section} hasReviews={data.reviews.length > 0} />
		{:else if section.section_key === 'reviews_section'}
			<HomeReviews {section} reviews={data.reviews} reviewTotal={data.reviewTotal} reviewAverage={data.reviewAverage} />
		{:else if section.section_key === 'faq'}
			<Faq {section} faqs={data.faqs} {canEnquire} />
		{/if}
	{/each}
</main>
<SiteFooter {visible} destinations={data.destinations} onInterest={chooseInterest} />
