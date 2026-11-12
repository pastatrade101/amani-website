<script lang="ts">
	import { ArrowDown } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import PageHero from '$lib/components/page-hero.svelte';
	import { PHOTO } from '$lib/media-photos';
	import { planHref } from '$lib/planner/plan-href';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import TourSectionNav from '$lib/components/tours/tour-section-nav.svelte';
	import WhyKey2africa from '$lib/components/home/why-key2africa.svelte';
	import SafariGuide from '$lib/components/home/safari-guide.svelte';
	import Faq from '$lib/components/home/faq.svelte';
	import Enquiry from '$lib/components/home/enquiry.svelte';
	import { GUIDE_PAGE_KEYS, GUIDE_PATH } from '$lib/home-content';
	import { siteInfo } from '$lib/site-info';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let chrome = $derived(data.chrome);
	let interest = $state('');
	const chooseInterest = (name: string) => { interest = name; };

	// Each guide section, where the homepage CMS has it switched on, in the CMS order.
	const LINKS: Record<string, { id: string; label: string }> = {
		why_tanzania: { id: 'why-tanzania', label: 'Why Tanzania' },
		why_us: { id: 'why-key2africa', label: 'Our approach' },
		cost_ranges: { id: 'cost-ranges', label: 'Costs' },
		safari_duration: { id: 'safari-duration', label: 'Trip length' },
		safari_inclusions: { id: 'safari-inclusions', label: 'What’s included' },
		safari_day: { id: 'safari-day', label: 'A day on safari' },
		faq: { id: 'safari-questions', label: 'Questions' }
	};
	let sections = $derived(chrome.sections.filter((section) => GUIDE_PAGE_KEYS.includes(section.section_key) && section.is_active !== false && (section.section_key !== 'faq' || data.faqs.length > 0)));
	let enquirySection = $derived(chrome.sections.find((section) => section.section_key === 'enquiry' && section.is_active !== false));
	let canEnquire = $derived(Boolean(enquirySection));
	let navItems = $derived(sections.map((section) => LINKS[section.section_key]));
	let onPage = $derived(['top', ...navItems.map((item) => item.id), ...(enquirySection ? ['request-quote'] : [])]);

	const title = `Tanzania safari guide | ${siteInfo.company}`;
	const description = 'What a Tanzania safari costs, how long to go for, what is included and how a day on safari unfolds, from a locally owned safari company in Arusha.';
	let canonical = $derived(`${data.siteOrigin}${GUIDE_PATH}`);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="article" />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={`${data.siteOrigin}/images/tanzania-safari-hero.jpg`} />
	<meta name="twitter:card" content="summary_large_image" />
	<link rel="canonical" href={canonical} />
</svelte:head>

<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-sun focus:p-4">Skip to content</a>
<SiteHeader visible={chrome.visible} activities={chrome.activities} destinations={chrome.destinations} onInterest={chooseInterest} tours={chrome.navTours} categories={chrome.categories} stays={chrome.navStays} {onPage} />
<main id="main">
	<PageHero titleId="guide-title" image={PHOTO.popUpRoofView} imageAlt="The Tarangire plains seen through the pop-up roof of a safari vehicle" crumbs={[{ label: 'Home', href: '/' }, { label: 'Safari guide' }]} eyebrow="Plan with confidence" title="Your Tanzania safari guide" intro="Costs, trip lengths, what is included and how a day on safari unfolds. Read it at your own pace, then tell us what you have in mind.">
		{#snippet actions()}
			<Button variant="safari" href={navItems[0] ? `#${navItems[0].id}` : '#main'}>Start reading <ArrowDown class="size-4" /></Button>
			{#if canEnquire}<Button href={planHref({ from: 'safari_guide' })} data-cta="plan_my_trip" data-cta-location="safari_guide" variant="outline">Plan my safari</Button>{/if}
		{/snippet}
	</PageHero>
	{#if navItems.length > 1}<TourSectionNav items={navItems} {canEnquire} />{/if}
	{#each sections as section (section.section_key)}
		{#if section.section_key === 'why_us'}
			<WhyKey2africa {section} {canEnquire} />
		{:else if section.section_key === 'faq'}
			<Faq {section} faqs={data.faqs} {canEnquire} />
		{:else}
			<SafariGuide {section} {canEnquire} onInterest={chooseInterest} />
		{/if}
	{/each}
	{#if enquirySection}<Enquiry section={enquirySection} {form} {interest} optionalActivities={data.optionalActivities} />{/if}
</main>
<SiteFooter visible={chrome.visible} destinations={chrome.destinations} onInterest={chooseInterest} {onPage} />

