<script lang="ts">
	import TravelGallery from '$lib/components/home/travel-gallery.svelte';
	import SafariGuide from '$lib/components/home/safari-guide.svelte';
	import { guideSections } from '$lib/homepage-guides';
	import { ArrowRight } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import WhyKey2africa from '$lib/components/home/why-key2africa.svelte';
	import Planning from '$lib/components/home/planning.svelte';
	import Faq from '$lib/components/home/faq.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import Hero from '$lib/components/home/hero.svelte';
	import SearchPanel from '$lib/components/home/search.svelte';
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
	let visible = $derived(data.sections.filter((section) => section.is_active !== false).map((section) => section.section_key));
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
	<meta name="theme-color" content="#14314d" />
	<link rel="canonical" href={`${data.siteOrigin}/`} />
	{@html `<script type="application/ld+json">${structuredData}</script>`}
</svelte:head>
<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-sun focus:p-4">Skip to content</a>
<div id="top" class="border-b border-border bg-secondary/50"><div class="page-container flex items-center justify-between gap-4 py-2 text-[9px] text-muted-foreground"><p>Home <span class="mx-2">/</span> Destinations <span class="mx-2">/</span> <span class="text-primary">Tanzania Safari</span></p><span class="hidden tracking-wider sm:block">YOUR TANZANIA. YOUR WAY.</span></div></div>
<SiteHeader {visible} activities={data.activities} destinations={data.destinations} onInterest={chooseInterest} tours={data.navTours} categories={data.categories} stays={data.navStays} />
<main id="main">
	{#each data.sections.filter((section) => section.is_active !== false) as section (section.section_key)}
		{#if section.section_key === 'hero'}
			<Hero {section} canEnquire={visible.includes('enquiry')} showPackages={visible.includes('safari_packages')} />
			{#if visible.includes('safari_packages')}<SearchPanel destinations={data.destinationsAreReference ? [] : data.destinations} categories={data.categories} filters={data.filters} />{/if}
		{:else if section.section_key === 'gallery_preview'}
			<TravelGallery {section} photos={data.gallery} />
		{:else if section.section_key === 'why_us'}
			<WhyKey2africa {section} canEnquire={visible.includes('enquiry')} />
		{:else if section.section_key === 'how_it_works'}
			<Planning {section} canEnquire={visible.includes('enquiry')} />
		{:else if section.section_key === 'faq'}
			<Faq {section} faqs={data.faqs} canEnquire={visible.includes('enquiry')} />
		{:else if section.section_key === 'experiences'}
			<Experiences items={data.activities} {section} onInterest={chooseInterest} canEnquire={visible.includes('enquiry')} />
		{:else if section.section_key === 'destinations'}
			<Destinations items={data.destinations} {section} reference={data.destinationsAreReference} onInterest={chooseInterest} canEnquire={visible.includes('enquiry')} showPackages={visible.includes('safari_packages')} />
		{:else if section.section_key === 'safari_packages'}
			<section id="tanzania-safari-packages" class="my-6 bg-secondary/45 py-14 md:py-18">
				<div class="page-container">
					<div data-motion="reveal" class="flex flex-wrap items-end justify-between gap-5"><div class="max-w-2xl"><p class="eyebrow text-muted-foreground">{section.subtitle}</p><h2 class="section-heading mt-3">{section.title}</h2><p class="mt-3 text-sm leading-7 text-muted-foreground">{textContent(section.content)}</p></div><div class="flex flex-wrap items-center gap-3">{#if data.filters.search || data.filters.destination_id || data.filters.category_id}<Button href="/#tanzania-safari-packages" variant="outline">Clear filters</Button>{/if}<Button href="/tours" variant="outline" class="border-navy/20">View all tours <ArrowRight class="size-4" /></Button></div></div>
					{#if data.filters.search}<p class="mt-5 text-sm">Results for “{data.filters.search}”</p>{/if}
					<div class="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{#each data.tours as tour, i (tour.id)}
							<TourCard {tour} photo={photos[i]} />
						{:else}
                            <div data-motion="image" class="col-span-full grid overflow-hidden rounded-2xl border border-border bg-white md:grid-cols-2">
                                <img src="/images/tanzania-hero-3.jpg" alt="Hot air balloons drifting over the Serengeti at sunrise" loading="lazy" class="h-60 w-full object-cover md:h-full md:min-h-80" />
                                <div class="flex flex-col items-start justify-center p-7 md:p-10"><span class="eyebrow text-muted-foreground">MADE AROUND YOU</span><h3 class="mt-4 max-w-md text-2xl font-semibold tracking-tight md:text-3xl">{data.toursUnavailable ? 'Your safari starts with a conversation' : 'No safaris match your search yet'}</h3><p class="mt-4 max-w-md text-sm leading-7 text-muted-foreground">{data.toursUnavailable ? 'We can’t display our published itineraries right now. Share the places and experiences on your wish list, and let’s plan a personal Tanzania journey.' : 'Try a different destination or style, or let us create a trip around your interests.'}</p>{#if visible.includes('enquiry')}<Button variant="safari" href="#request-quote" class="mt-6 h-12 px-6">Create my safari <ArrowRight class="size-4" /></Button>{/if}</div>
                            </div>
						{/each}
					</div>
					{#if data.pageCount > 1}<nav aria-label="Safari search pages" class="mt-8 flex items-center justify-center gap-4"><Button href={pageHref(data.page - 1)} disabled={data.page <= 1} variant="outline">Previous</Button><span class="text-xs">Page {data.page} of {data.pageCount}</span><Button href={pageHref(data.page + 1)} disabled={data.page >= data.pageCount} variant="outline">Next</Button></nav>{/if}
				</div>
			</section>
		{:else if section.section_key === 'when_to_go'}
			<Seasons {section} seasons={data.seasons} />
		{:else if guideSections.some(item => item.section_key === section.section_key)}
			<SafariGuide {section} canEnquire={visible.includes('enquiry')} onInterest={chooseInterest} reviews={data.reviews} />
		{:else if section.section_key === 'enquiry'}
			<Enquiry {section} {form} {interest} />
		{/if}
	{/each}
</main>
<SiteFooter {visible} destinations={data.destinations} onInterest={chooseInterest} />
