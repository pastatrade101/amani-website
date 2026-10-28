<script lang="ts">
	import HomeReferenceSections from '$lib/components/home/home-reference-sections.svelte';
	import HomeCarousel from '$lib/components/home/home-carousel.svelte';
	import HomeReviews from '$lib/components/home/home-reviews.svelte';
	import { refreshSections } from '$lib/homepage-refresh';
	import TravelGallery from '$lib/components/home/travel-gallery.svelte';
	import SafariGuide from '$lib/components/home/safari-guide.svelte';
	import { guideSections } from '$lib/homepage-guides';
	import { ArrowRight } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { planHref } from '$lib/planner/plan-href';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import WhyKey2africa from '$lib/components/home/why-key2africa.svelte';
	import Planning from '$lib/components/home/planning.svelte';
	import Faq from '$lib/components/home/faq.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import Hero from '$lib/components/home/hero.svelte';
	import Experiences from '$lib/components/home/experiences.svelte';
	import Destinations from '$lib/components/home/destinations.svelte';
	import Seasons from '$lib/components/home/seasons.svelte';
	import Enquiry from '$lib/components/home/enquiry.svelte';
	import TourCard from '$lib/components/tours/tour-card.svelte';
	import { siteInfo, websiteSchema } from '$lib/site-info';
	import { textContent, tourPhotos } from '$lib/home-content';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let interest = $state('');
	// The FAQ section renders only with questions placed on the home page.
	let visible = $derived(data.sections.filter((section) => section.is_active !== false && !(section.section_key === 'faq' && !data.faqs?.length)).map((section) => section.section_key));
	let hero = $derived(data.sections.find((section) => section.section_key === 'hero'));
	let pageTitle = $derived(`${hero?.title || 'Tanzania Safaris'} | ${siteInfo.company}`);
	let structuredData = $derived(JSON.stringify(websiteSchema(data.siteOrigin)).replace(/</g, '\\u003c'));
	let photos = $derived(tourPhotos(data.tours));
	const chooseInterest = (name: string) => { interest = name; };
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
	{#each data.sections.filter((section) => section.is_active !== false) as section (section.section_key)}
		{#if section.section_key === 'hero'}
			<Hero {section} canEnquire={visible.includes('enquiry')} showPackages={visible.includes('safari_packages')} form={form?.formKind === 'hero' ? form : null} reviewTotal={data.reviewTotal} />
		{:else if refreshSections.some(item => item.section_key === section.section_key)}
			<HomeReferenceSections {section} heroFormAvailable={visible.includes('hero')&&visible.includes('enquiry')} categories={data.categories} activities={data.activities} />
		{:else if section.section_key === 'reviews_section'}
			<HomeReviews {section} reviews={data.reviews} reviewTotal={data.reviewTotal} />
		{:else if section.section_key === 'gallery_preview'}
			<TravelGallery {section} photos={data.gallery} />
		{:else if section.section_key === 'why_us'}
			<WhyKey2africa {section} canEnquire={visible.includes('enquiry')} />
		{:else if section.section_key === 'how_it_works'}
			<Planning {section} canEnquire={visible.includes('enquiry')} />
		{:else if section.section_key === 'faq'}
			<Faq {section} faqs={data.faqs} canEnquire={visible.includes('enquiry')} />
		{:else if section.section_key === 'experiences'}
			<Experiences items={data.activities} categories={data.categories} {section} />
		{:else if section.section_key === 'destinations'}
			<Destinations items={data.destinations} {section} reference={data.destinationsAreReference} onInterest={chooseInterest} canEnquire={visible.includes('enquiry')} showPackages={visible.includes('safari_packages')} />
		{:else if section.section_key === 'safari_packages'}
			<section id="tanzania-safari-packages" class="home-band home-tour-section">
				<div class="home-container">
					<div data-motion="reveal" class="flex flex-wrap items-end justify-between gap-5"><div class="max-w-2xl"><p class="eyebrow text-muted-foreground">{section.subtitle}</p><h2 class="section-heading mt-3">{section.title}</h2><p class="mt-3 text-sm leading-7 text-muted-foreground">{textContent(section.content)}</p></div><div class="flex flex-wrap items-center gap-3">{#if data.filters.search || data.filters.destination_id || data.filters.category_id}<Button href="/#tanzania-safari-packages" variant="outline">Clear filters</Button>{/if}<Button href="/tours" variant="outline" class="border-navy/20">View all tours <ArrowRight class="size-4" /></Button></div></div>
					{#if data.filters.search}<p class="mt-5 text-sm">Results for “{data.filters.search}”</p>{/if}
					{#if data.tours.length}
						<div class="mt-8"><HomeCarousel items={data.tours} label="safaris">{#snippet card(tour, i)}<TourCard {tour} photo={photos[i]} variant="home" />{/snippet}</HomeCarousel></div>
					{:else}
					<div class="card-grid mt-8">
                            <div data-motion="image" class="col-span-full grid overflow-hidden rounded-2xl border border-border bg-white md:grid-cols-2">
                                <img src="/images/tanzania-hero-3.jpg" alt="Hot air balloons drifting over the Serengeti at sunrise" loading="lazy" class="h-60 w-full object-cover md:h-full md:min-h-80" />
                                <div class="flex flex-col items-start justify-center p-7 md:p-10"><span class="eyebrow text-muted-foreground">MADE AROUND YOU</span><h3 class="mt-4 max-w-md text-2xl font-semibold tracking-tight md:text-3xl">{data.toursUnavailable ? 'Your safari starts with a conversation' : 'No safaris match your search yet'}</h3><p class="mt-4 max-w-md text-sm leading-7 text-muted-foreground">{data.toursUnavailable ? 'We can’t display our published itineraries right now. Share the places and experiences on your wish list, and let’s plan a personal Tanzania journey.' : 'Try a different destination or style, or let us create a trip around your interests.'}</p>{#if visible.includes('enquiry')}<Button variant="safari" href={planHref({ from: 'home_tours' })} data-cta="plan_my_trip" data-cta-location="home_tours" class="mt-6 h-12 px-6">Create my safari <ArrowRight class="size-4" /></Button>{/if}</div>
                            </div>
					</div>
					{/if}
					{#if data.pageCount > 1}<nav aria-label="Safari search pages" class="mt-8 flex items-center justify-center gap-4"><Button href={pageHref(data.page - 1)} disabled={data.page <= 1} variant="outline">Previous</Button><span class="text-xs">Page {data.page} of {data.pageCount}</span><Button href={pageHref(data.page + 1)} disabled={data.page >= data.pageCount} variant="outline">Next</Button></nav>{/if}
				</div>
			</section>
		{:else if section.section_key === 'when_to_go'}
			<Seasons {section} seasons={data.seasons} />
		{:else if guideSections.some(item => item.section_key === section.section_key)}
			<SafariGuide {section} canEnquire={visible.includes('enquiry')} onInterest={chooseInterest} reviews={data.reviews} reviewTotal={data.reviewTotal} />
		{:else if section.section_key === 'enquiry'}
			<Enquiry {section} form={form?.formKind === 'hero' ? null : form} {interest} optionalActivities={data.optionalActivities} />
		{/if}
	{/each}
</main>
<SiteFooter {visible} destinations={data.destinations} onInterest={chooseInterest} />

<style>
 :global(.home-container){width:92%;max-width:1440px;margin-inline:auto}
 :global(.home-band){padding-block:72px}
 :global(.home-cream){background:#f7f5ef;border-block:1px solid #e9e5da}
 :global(.home-heading){font-size:clamp(26px,2.5vw,36px);font-weight:650;line-height:1.2;letter-spacing:-.025em;color:var(--navy);text-wrap:balance}
 :global(.home-eyebrow){font-size:11px;font-weight:600;letter-spacing:.18em;color:var(--muted-foreground)}
 :global(.home-copy){font-size:15px;line-height:1.85;color:var(--muted-foreground)}
 .home-tour-section :global(.section-heading){font-size:clamp(26px,2.5vw,36px)}
 @media(max-width:767px){:global(.home-container){width:90%}:global(.home-band){padding-block:48px}}
</style>
