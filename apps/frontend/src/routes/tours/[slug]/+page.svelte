<script lang="ts">
	import '$lib/components/safari/safari.css';
	import { ArrowRight } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import Enquiry from '$lib/components/home/enquiry.svelte';
	import ActivityShowcase from '$lib/components/tours/activity-showcase.svelte';
	import SafariHero from '$lib/components/safari/safari-hero.svelte';
	import SafariGallery from '$lib/components/safari/safari-gallery.svelte';
	import SafariSectionNav from '$lib/components/safari/safari-section-nav.svelte';
	import SafariOverview from '$lib/components/safari/safari-overview.svelte';
	import SafariPractical from '$lib/components/safari/safari-practical.svelte';
	import SafariItinerary from '$lib/components/safari/safari-itinerary.svelte';
	import SafariPricing from '$lib/components/safari/safari-pricing.svelte';
	import SafariInclusions from '$lib/components/safari/safari-inclusions.svelte';
	import SafariReviewsFaq from '$lib/components/safari/safari-reviews-faq.svelte';
	import SafariSimilar from '$lib/components/safari/safari-similar.svelte';
	import SafariGuide from '$lib/components/safari/safari-guide.svelte';
	import { planHref } from '$lib/planner/plan-href';
	import { destinationPhoto, safeUrl } from '$lib/home-content';
	import { WHATSAPP_URL } from '$lib/homepage-refresh';
	import { SAFARI_STYLES, type SafariStyle } from '$lib/safari-pricing';
	import { siteInfo } from '$lib/site-info';
	import { initialStyle, lowestPrice, offeredStyles, sortedDays, tourRoute } from '$lib/tour-itinerary';
	import { numberWord, whatsappLink } from '$lib/safari-page';
	import { tourSeo } from '$lib/tour-seo';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let tour = $derived(data.tour);
	let chrome = $derived(data.chrome);

	// One safari style for the page: the pricing selection, the enquiry and the guide follow it.
	let styles = $derived(offeredStyles(tour));
	let picked = $state<SafariStyle | null>(null);
	let style = $derived(picked && styles.includes(picked) ? picked : initialStyle(styles));
	const styleName = (id: SafariStyle) => SAFARI_STYLES.find((item) => item.id === id)?.title.replace(/\s+Safari$/, '') ?? id;

	let interest = $state('');
	const chooseInterest = (name: string) => { interest = name; };
	// The enquiry names this tour, and the chosen style when there is a choice.
	const enquireAboutTour = () => chooseInterest(styles.length > 1 ? `${tour.title} (${styleName(style)})` : tour.title);
	let enquiryInterest = $derived(interest || (form?.values?.interest ? '' : tour.title));
	let enquirySection = $derived(chrome.sections.find((section) => section.section_key === 'enquiry' && section.is_active !== false));
	let quoteHref = $derived(enquirySection ? '#request-quote' : planHref({ tour: tour.slug, from: 'tour_page' }));

	let days = $derived(sortedDays(tour.itinerary_days));
	let route = $derived(tourRoute(tour));
	let from = $derived(lowestPrice(tour) ?? (Number(tour.price_from) > 0 ? { amount: Number(tour.price_from), currency: tour.currency || 'USD' } : null));
	let country = $derived(tour.destinations?.country || tour.tour_destinations?.find((link) => link.destinations?.country)?.destinations?.country || '');
	let activities = $derived(tour.tour_activities ?? []);
	let optionalCount = $derived(activities.filter((item) => item.is_optional).length);
	let hasInclusions = $derived(Boolean(tour.tour_inclusions?.length || tour.tour_exclusions?.length || activities.length));
	let expert = $derived(tour.specialist?.status === 'published' ? tour.specialist : null);
	let whatsapp = $derived(whatsappLink(expert?.whatsapp_number) || WHATSAPP_URL);
	let related = $derived(chrome.navTours.filter((item) => item.id !== tour.id).slice(0, 3));

	let selectedOptionalIds = $state<string[]>([]);
	let selectionTourId = $state('');
	$effect(() => { if (selectionTourId !== tour.id) { selectionTourId = tour.id; selectedOptionalIds = []; picked = null; } });
	let activitiesOpen = $state(false);
	let activitiesDialog = $state<HTMLDivElement | null>(null);

	let heroImage = $derived(safeUrl(tour.banner_image_url || tour.main_image_url, destinationPhoto({ id: tour.id, name: route.join(' '), slug: tour.slug })));
	let seo = $derived(tourSeo(tour, data.siteOrigin, destinationPhoto({ id: tour.id, name: route.join(' '), slug: tour.slug })));

	let sections = $derived([
		{ id: 'overview', label: 'Overview', icon: 'overview' as const },
		...(days.length ? [{ id: 'itinerary', label: 'Day by day', icon: 'days' as const }] : []),
		{ id: 'prices', label: 'Pricing', icon: 'pricing' as const },
		...(hasInclusions ? [{ id: 'included', label: 'Inclusions & Exclusions', icon: 'inclusions' as const }] : [])
	]);
	// Anchors that exist here; the header and footer send every other anchor to the home page.
	let onPage = $derived(['top', ...sections.map((section) => section.id), 'before-you-book', ...(enquirySection ? ['request-quote'] : [])]);
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
	<meta name="theme-color" content="#36312b" />
	<link rel="canonical" href={seo.canonical} />
	{@html `<script type="application/ld+json">${seo.jsonLd}</script>`}
</svelte:head>

<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-sun focus:p-4">Skip to content</a>
<div id="top"></div>
<SiteHeader visible={chrome.visible} activities={chrome.activities} destinations={chrome.destinations} onInterest={chooseInterest} tours={chrome.navTours} categories={chrome.categories} stays={chrome.navStays} {onPage} />
<main id="main" class="safari-page">
	<div class="sp-wrap">
		<SafariHero {tour} image={heroImage} {from} />
		<SafariGallery {tour} image={heroImage} />
		<SafariSectionNav items={sections} {quoteHref} {whatsapp} onEnquire={enquireAboutTour} />
		<SafariOverview {tour} {country} />
		<SafariPractical {tour} {styles} />
		{#if days.length}<SafariItinerary {tour} {days} {styles} {route} />{/if}
		<SafariPricing seasons={tour.tour_pricing_seasons ?? []} selected={style} onSelect={(next) => (picked = next)} {quoteHref} onEnquire={enquireAboutTour} {from} />
		{#if hasInclusions}<SafariInclusions {tour} activityCount={activities.length} {optionalCount} onActivities={() => (activitiesOpen = true)} />{/if}
		<SafariReviewsFaq {tour} reviews={data.reviews.slice(0, 3)} faqs={data.faqs} title={`Plan your ${numberWord(Math.round(Number(tour.duration_days) || days.length))}-day safari`} {quoteHref} {whatsapp} onEnquire={enquireAboutTour} />
		{#if related.length}<SafariSimilar tours={related} />{/if}
		<SafariGuide {tour} {days} {styles} {style} {quoteHref} onEnquire={enquireAboutTour} />
	</div>
	{#if enquirySection}<Enquiry section={enquirySection} {form} interest={enquiryInterest} optionalActivities={activities.filter((item) => item.is_optional)} bind:selectedIds={selectedOptionalIds} />{/if}
</main>
<SiteFooter visible={chrome.visible} destinations={chrome.destinations} onInterest={chooseInterest} {onPage} />
<Dialog.Root bind:open={activitiesOpen}>
	<Dialog.Content bind:ref={activitiesDialog} onOpenAutoFocus={(event) => { event.preventDefault(); activitiesDialog?.focus(); }} class="flex max-h-[90dvh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl">
		<Dialog.Header class="shrink-0 px-5 pt-6 pr-12 sm:px-8"><Dialog.Title class="text-xl font-bold">{optionalCount ? 'Additional Activities (Optional)' : 'Activities on your safari'}</Dialog.Title><Dialog.Description>{optionalCount ? 'Add these unforgettable experiences to your safari. Prices are per person unless stated otherwise.' : 'The experiences included in your safari.'}</Dialog.Description></Dialog.Header>
		<div class="min-h-0 overflow-y-auto overscroll-contain px-5 pt-5 pb-6 sm:px-8"><ActivityShowcase items={activities} canEnquire={Boolean(enquirySection)} bind:selectedIds={selectedOptionalIds} /></div>
		{#if enquirySection}<div class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-white p-5 sm:px-8">{#if optionalCount}<p class="text-xs text-muted-foreground" aria-live="polite">{selectedOptionalIds.length} {selectedOptionalIds.length === 1 ? 'activity' : 'activities'} selected</p>{:else}<span></span>{/if}<Button variant="safari" class="h-11 px-5 text-sm" href="#request-quote" onclick={() => { activitiesOpen = false; enquireAboutTour(); }}>Continue to enquiry <ArrowRight class="size-4" /></Button></div>{/if}
	</Dialog.Content>
</Dialog.Root>

<style>
	/* Room for the pinned section bar above whatever a link jumps to. The site
	   header slides away once the bar pins, so the page-wide header offset
	   (layout.css) would only push every jump 100px too low. */
	:global(html:has(main.safari-page)) { scroll-padding-top: 0; }
	.safari-page :global(section[id]) { scroll-margin-top: 66px; }
	.safari-page :global(#safari-booking) { scroll-margin-top: 90px; }
	:global(#request-quote) { scroll-margin-top: 20px; }
	@media (max-width: 767px) { .safari-page :global(section[id]) { scroll-margin-top: 56px; } }
</style>
