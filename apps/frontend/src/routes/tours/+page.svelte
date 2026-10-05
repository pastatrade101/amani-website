<script lang="ts">
	import { ArrowRight, ChevronRight, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import SearchPanel from '$lib/components/home/search.svelte';
	import Enquiry from '$lib/components/home/enquiry.svelte';
	import TourCard from '$lib/components/tours/tour-card.svelte';
	import SavedTours from '$lib/components/tours/saved-tours.svelte';
	import { siteInfo } from '$lib/site-info';
	import { tourPhotos } from '$lib/home-content';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let interest = $state('');
	const chooseInterest = (name: string) => { interest = name; };
	let enquiry = $derived(data.sections.find((section) => section.section_key === 'enquiry' && section.is_active !== false));
	let onPage = $derived(['safari-search', 'tour-results', ...(enquiry ? ['request-quote'] : [])]);
	let photos = $derived(tourPhotos(data.tours));
	let filtered = $derived(Boolean(data.filters.search || data.filters.destination_id || data.filters.category_id));
	let chips = $derived([
		...(data.filters.destination_id ? [{ key: 'destination_id', kind: 'Destination', label: data.destinations.find((item) => item.id === data.filters.destination_id)?.name ?? 'Selected' }] : []),
		...(data.filters.category_id ? [{ key: 'category_id', kind: 'Safari style', label: data.categories.find((item) => item.id === data.filters.category_id)?.name ?? 'Selected' }] : []),
		...(data.filters.search ? [{ key: 'search', kind: 'Interests', label: `“${data.filters.search}”` }] : [])
	]);
	let heading = $derived(data.toursUnavailable ? 'Safari tours' : `${data.tourTotal} ${data.tourTotal === 1 ? 'safari' : 'safaris'}`);

	const description = 'Browse our published Tanzania safari itineraries by destination and safari style, then make one your own with our local team.';
	let pageTitle = $derived(`Safari tours & itineraries${data.page > 1 ? ` – page ${data.page}` : ''} | ${siteInfo.company}`);
	// Filtered views point at the full list; plain pagination keeps its own page.
	let canonical = $derived(`${data.siteOrigin}/tours${data.page > 1 && !filtered ? `?page=${data.page}` : ''}`);
	let structuredData = $derived(JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{ '@type': 'BreadcrumbList', itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Home', item: `${data.siteOrigin}/` },
				{ '@type': 'ListItem', position: 2, name: 'Tours', item: `${data.siteOrigin}/tours` }
			] },
			...(data.tours.length ? [{ '@type': 'ItemList', itemListElement: data.tours.map((tour, i) => ({ '@type': 'ListItem', position: i + 1, name: tour.title, url: `${data.siteOrigin}/tours/${encodeURIComponent(tour.slug)}` })) }] : [])
		]
	}).replace(/</g, '\\u003c'));

	/** This page with some filters changed; empty values and page 1 drop out of the URL. */
	function toursHref(changes: Record<string, string>) {
		const params = new URLSearchParams({ ...data.filters, page: String(data.page), ...changes });
		for (const [key, value] of [...params]) if (!value || (key === 'page' && value === '1')) params.delete(key);
		const search = params.toString();
		return `/tours${search ? `?${search}` : ''}#tour-results`;
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={description} />
	<meta name="application-name" content={siteInfo.company} />
	<meta property="og:site_name" content={siteInfo.company} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={`${data.siteOrigin}/images/related-wildebeest.jpg`} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={`${data.siteOrigin}/images/related-wildebeest.jpg`} />
	<meta name="theme-color" content="#14314d" />
	<link rel="canonical" href={canonical} />
	{@html `<script type="application/ld+json">${structuredData}</script>`}
</svelte:head>
<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-sun focus:p-4">Skip to content</a>
<SiteHeader visible={data.visible} activities={data.activities} destinations={data.destinations} onInterest={chooseInterest} tours={data.navTours} categories={data.categories} stays={data.navStays} {onPage} />
<main id="main">
	<section id="top" class="relative isolate overflow-hidden bg-navy text-white" aria-labelledby="tours-title">
		<img src="/images/related-wildebeest.jpg" alt="Wildebeest herds grazing on the savannah at golden hour" width="1600" height="1008" fetchpriority="high" class="absolute inset-0 -z-20 size-full object-cover object-center" />
		<div class="absolute inset-0 -z-10 bg-linear-to-r from-black/75 via-black/45 to-black/10 max-md:bg-black/55" aria-hidden="true"></div>
		<div class="page-container py-12 md:py-20 lg:py-24">
			<nav aria-label="Breadcrumb">
				<ol class="flex items-center gap-1.5 text-[11px] text-white/75">
					<li><a href="/" class="transition-colors hover:text-sun">Home</a></li>
					<li aria-hidden="true"><ChevronRight class="size-3" /></li>
					<li aria-current="page" class="font-medium text-white">Tours</li>
				</ol>
			</nav>
			<p data-motion="hero" class="mt-8 text-xs font-semibold tracking-[.25em] md:mt-10">TANZANIA SAFARI TOURS</p>
			<div data-motion="line" data-motion-delay="0.15" class="mt-3 h-0.5 w-16 bg-sun"></div>
			<h1 id="tours-title" data-motion="hero" data-motion-delay="0.08" class="mt-5 max-w-2xl text-[36px] leading-[1.1] font-semibold tracking-[-.045em] sm:text-5xl md:text-[56px]">Safari tours &amp; itineraries</h1>
			<p data-motion="hero" data-motion-delay="0.16" class="mt-5 max-w-xl text-sm leading-[1.9] text-white/85 md:text-base">Day-by-day journeys through Tanzania’s parks and coast, each ready to shape around your dates, pace and comfort.</p>
		</div>
	</section>
	<SearchPanel destinations={data.destinationsAreReference ? [] : data.destinations} categories={data.categories} filters={data.filters} action="/tours#tour-results" />
	<section id="tour-results" class="bg-secondary/45 py-14 md:py-18" aria-labelledby="tour-results-title">
		<div class="page-container">
			<div data-motion="reveal" class="flex flex-wrap items-end justify-between gap-5">
				<div class="min-w-0 max-w-2xl">
					<p class="eyebrow text-muted-foreground">{filtered ? 'YOUR SEARCH' : 'ALL ITINERARIES'}</p>
					<h2 id="tour-results-title" class="section-heading mt-3">{heading}</h2>
					{#if chips.length}
						<ul class="mt-4 flex flex-wrap gap-2" aria-label="Active filters">
							{#each chips as chip (chip.key)}
								<li><a href={toursHref({ [chip.key]: '', page: '1' })} aria-label={`Remove ${chip.kind.toLowerCase()} filter: ${chip.label}`} class="inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border border-border bg-white px-3.5 text-xs text-navy transition-colors hover:border-navy/30"><span class="text-muted-foreground">{chip.kind}:</span><span class="truncate font-semibold">{chip.label}</span><X class="size-3.5 shrink-0 text-muted-foreground" /></a></li>
							{/each}
						</ul>
					{/if}
				</div>
				{#if filtered}<Button href="/tours#tour-results" variant="outline">Clear filters</Button>{/if}
			</div>
			<SavedTours />
			<div class="card-grid mt-8">
				{#each data.tours as tour, i (tour.id)}
					<TourCard {tour} photo={photos[i]} />
				{:else}
					<div data-motion="image" class="col-span-full grid overflow-hidden rounded-2xl border border-border bg-white md:grid-cols-2">
						<img src="/images/tanzania-hero-3.jpg" alt="Hot air balloons drifting over the Serengeti at sunrise" loading="lazy" class="h-60 w-full object-cover md:h-full md:min-h-80" />
						<div class="flex flex-col items-start justify-center p-7 md:p-10">
							<span class="eyebrow text-muted-foreground">MADE AROUND YOU</span>
							<h3 class="mt-4 max-w-md text-2xl font-semibold tracking-tight md:text-3xl">{data.toursUnavailable ? 'Your safari starts with a conversation' : filtered ? 'No safaris match your search yet' : 'New itineraries are on their way'}</h3>
							<p class="mt-4 max-w-md text-sm leading-7 text-muted-foreground">{data.toursUnavailable ? 'We can’t display our published itineraries right now. Share the places and experiences on your wish list, and let’s plan a personal Tanzania journey.' : filtered ? 'Try a different destination or style, or let us create a trip around your interests.' : 'Tell us the places and experiences on your wish list, and we’ll plan a Tanzania journey around them.'}</p>
							<div class="mt-6 flex flex-wrap gap-3">
								{#if enquiry}<Button variant="safari" href="#request-quote" class="h-12 px-6">Create my safari <ArrowRight class="size-4" /></Button>{/if}
								{#if filtered}<Button variant="outline" href="/tours#tour-results" class="h-12 px-6">See all tours</Button>{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
			{#if data.pageCount > 1}<nav aria-label="Safari tour pages" class="mt-8 flex items-center justify-center gap-4"><Button href={toursHref({ page: String(data.page - 1) })} disabled={data.page <= 1} variant="outline">Previous</Button><span class="text-xs">Page {data.page} of {data.pageCount}</span><Button href={toursHref({ page: String(data.page + 1) })} disabled={data.page >= data.pageCount} variant="outline">Next</Button></nav>{/if}
		</div>
	</section>
	{#if enquiry}<Enquiry section={enquiry} {form} {interest} />{/if}
</main>
<SiteFooter visible={data.visible} destinations={data.destinations} onInterest={chooseInterest} {onPage} />
