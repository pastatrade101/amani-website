<script lang="ts">
	import { ArrowDown, ArrowRight, ChevronRight, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import Enquiry from '$lib/components/home/enquiry.svelte';
	import StayCard from '$lib/components/stays/stay-card.svelte';
	import StaySearch from '$lib/components/stays/stay-search.svelte';
	import StayStyles from '$lib/components/stays/stay-styles.svelte';
	import { siteInfo } from '$lib/site-info';
	import { destinationPhoto } from '$lib/home-content';
	import { hasStayFilters, STAY_STYLES, staysHref, stayTypeLabel, type StayFilters } from '$lib/stay-content';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let interest = $state('');
	const chooseInterest = (name: string) => { interest = name; };
	let enquiry = $derived(data.sections.find((section) => section.section_key === 'enquiry' && section.is_active !== false));
	// Reference destinations have no real ids, so they cannot filter stays.
	let places = $derived(data.destinationsAreReference ? [] : data.destinations);
	let onPage = $derived(['top', 'stay-styles', 'stay-search', 'stay-results', ...(places.length ? ['stay-destinations'] : []), ...(enquiry ? ['request-quote'] : [])]);
	let filtered = $derived(hasStayFilters(data.filters));
	let styleName = $derived(STAY_STYLES.find((style) => style.id === data.filters.style)?.label ?? '');
	let chips = $derived<{ key: keyof StayFilters; kind: string; label: string }[]>([
		...(data.filters.destination_id ? [{ key: 'destination_id' as const, kind: 'Destination', label: data.destinations.find((item) => item.id === data.filters.destination_id)?.name ?? 'Selected' }] : []),
		...(data.filters.style ? [{ key: 'style' as const, kind: 'Style', label: styleName }] : []),
		...(data.filters.lodge_type ? [{ key: 'lodge_type' as const, kind: 'Type', label: stayTypeLabel(data.filters.lodge_type) }] : []),
		...(data.filters.country ? [{ key: 'country' as const, kind: 'Country', label: data.filters.country }] : []),
		...(data.filters.search ? [{ key: 'search' as const, kind: 'Keyword', label: `“${data.filters.search}”` }] : [])
	]);
	let heading = $derived(data.staysUnavailable ? 'Lodges & camps' : `${data.stayTotal} ${data.stayTotal === 1 ? 'stay' : 'stays'}`);
	// A page past the last one (an old link) is not the same as "nothing here".
	let pastTheEnd = $derived(!data.stays.length && data.stayTotal > 0);
	const placeFor = (id?: string | null) => (id ? (data.destinations.find((item) => item.id === id) ?? null) : null);
	const pageHref = (page: number) => staysHref(data.filters, { page: String(page) });

	const description = 'Where you’ll stay on safari in Tanzania: lodges and tented camps in Budget, Midrange and Luxury styles, each linked to the safaris that stay there.';
	let pageTitle = $derived(`${styleName ? `${styleName} safari` : 'Safari'} lodges & camps in Tanzania${data.page > 1 ? ` – page ${data.page}` : ''} | ${siteInfo.company}`);
	// Filtered views point at the full list; plain pagination keeps its own page.
	let canonical = $derived(`${data.siteOrigin}/stays${data.page > 1 && !filtered ? `?page=${data.page}` : ''}`);
	let structuredData = $derived(JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{ '@type': 'BreadcrumbList', itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Home', item: `${data.siteOrigin}/` },
				{ '@type': 'ListItem', position: 2, name: 'Stays', item: `${data.siteOrigin}/stays` }
			] },
			...(data.stays.length ? [{ '@type': 'ItemList', itemListElement: data.stays.map((stay, i) => ({ '@type': 'ListItem', position: i + 1, name: stay.name, url: `${data.siteOrigin}/stays/${encodeURIComponent(stay.slug)}` })) }] : [])
		]
	}).replace(/</g, '\\u003c'));
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
	<meta property="og:image" content={`${data.siteOrigin}/images/activity-bush-lunch.jpg`} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={`${data.siteOrigin}/images/activity-bush-lunch.jpg`} />
	<meta name="theme-color" content="#14314d" />
	<link rel="canonical" href={canonical} />
	{@html `<script type="application/ld+json">${structuredData}</script>`}
</svelte:head>
<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-sun focus:p-4">Skip to content</a>
<SiteHeader visible={data.visible} activities={data.activities} destinations={data.destinations} onInterest={chooseInterest} tours={data.navTours} categories={data.categories} stays={data.navStays} {onPage} />
<main id="main">
	<section id="top" class="relative isolate overflow-hidden bg-navy text-white" aria-labelledby="stays-title">
		<img src="/images/activity-bush-lunch.jpg" alt="A table laid for lunch in the shade of an acacia, with elephants grazing beyond" width="1280" height="720" fetchpriority="high" class="absolute inset-0 -z-20 size-full object-cover object-[center_65%]" />
		<div class="absolute inset-0 -z-10 bg-linear-to-t from-black/85 via-black/40 to-black/30 md:bg-linear-to-r md:from-black/80 md:via-black/45 md:to-black/5" aria-hidden="true"></div>
		<div class="page-container flex min-h-[540px] flex-col py-6 md:min-h-[620px] md:py-8 lg:min-h-[680px]">
			<nav aria-label="Breadcrumb">
				<ol class="flex items-center gap-1.5 text-[11px] text-white/75">
					<li><a href="/" class="transition-colors hover:text-sun">Home</a></li>
					<li aria-hidden="true"><ChevronRight class="size-3" /></li>
					<li aria-current="page" class="font-medium text-white">Stays</li>
				</ol>
			</nav>
			<div class="mt-auto max-w-2xl pt-20">
				<p data-motion="hero" class="text-xs font-semibold tracking-[.25em] text-sun">LODGES &amp; CAMPS</p>
				<div data-motion="line" data-motion-delay="0.15" class="mt-3 h-0.5 w-16 bg-sun"></div>
				<h1 id="stays-title" data-motion="hero" data-motion-delay="0.08" class="mt-5 text-[38px] leading-[1.08] font-semibold tracking-[-.045em] text-balance sm:text-5xl md:text-[60px]">Where you’ll stay in Tanzania</h1>
				<p data-motion="hero" data-motion-delay="0.16" class="mt-5 max-w-xl text-sm leading-[1.9] text-white/85 md:text-base">Lodges and tented camps for every style of safari, from simple bush camps to the most exclusive hideaways. Find yours, then see the safaris that stay there.</p>
				<div data-motion="hero" data-motion-delay="0.24" class="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
					<Button variant="safari" href="#stay-styles" class="h-12 rounded-lg px-6 text-sm">Choose your style <ArrowDown class="size-4" /></Button>
					{#if enquiry}<Button href="#request-quote" variant="outline" onclick={() => chooseInterest('Help choosing where to stay')} class="h-12 rounded-lg border-white bg-transparent px-6 text-sm font-semibold text-white hover:bg-white/10 hover:text-white">Ask us where to stay</Button>{/if}
				</div>
			</div>
		</div>
	</section>

	<StayStyles filters={data.filters} />
	<StaySearch destinations={places} filters={data.filters} />

	<section id="stay-results" class="pt-10 pb-14 md:pt-12 md:pb-20" aria-labelledby="stay-results-title">
		<div class="page-container">
			<div data-motion="reveal" class="flex flex-wrap items-end justify-between gap-5">
				<div class="min-w-0 max-w-2xl">
					<p class="eyebrow text-muted-foreground">{filtered ? 'YOUR SEARCH' : 'ALL STAYS'}</p>
					<h2 id="stay-results-title" class="lux-heading mt-3">{heading}</h2>
					{#if chips.length}
						<ul class="mt-4 flex flex-wrap gap-2" aria-label="Active filters">
							{#each chips as chip (chip.key)}
								<li><a href={staysHref(data.filters, { [chip.key]: '', page: '1' })} aria-label={`Remove ${chip.kind.toLowerCase()} filter: ${chip.label}`} class="inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border border-border bg-white px-3.5 text-xs text-navy transition-colors hover:border-navy/30"><span class="text-muted-foreground">{chip.kind}:</span><span class="truncate font-semibold">{chip.label}</span><X class="size-3.5 shrink-0 text-muted-foreground" /></a></li>
							{/each}
						</ul>
					{/if}
				</div>
				{#if filtered}<Button href="/stays#stay-results" variant="outline">Clear filters</Button>{/if}
			</div>
			<!-- Three columns at most, so the tall cards keep their proportions. -->
			<div class="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
				{#each data.stays as stay (stay.id)}
					<StayCard {stay} destination={placeFor(stay.destination_id)} />
				{:else}
					<div data-motion="image" class="col-span-full grid overflow-hidden rounded-2xl border border-border bg-white md:grid-cols-2">
						<img src="/images/itinerary-baobab-sunset.jpg" alt="A baobab silhouetted against a Tanzania sunset" loading="lazy" class="h-60 w-full object-cover md:h-full md:min-h-80" />
						<div class="flex flex-col items-start justify-center p-7 md:p-10">
							<span class="eyebrow text-muted-foreground">MADE AROUND YOU</span>
							<h3 class="mt-4 max-w-md text-2xl font-semibold tracking-tight md:text-3xl">{data.staysUnavailable ? 'We’ll help you choose where to stay' : pastTheEnd ? 'There are no more stays on this page' : filtered ? 'No stays match your search yet' : 'Our lodges and camps are on their way'}</h3>
							<p class="mt-4 max-w-md text-sm leading-7 text-muted-foreground">{data.staysUnavailable ? 'We can’t show our lodges and camps right now. Tell us the comfort and places you have in mind, and we’ll suggest where to stay.' : pastTheEnd ? 'This page is past the end of the list. Start again from the first page.' : filtered ? 'Try another destination, style or type, or tell us what you have in mind and we’ll suggest where to stay.' : 'We’re adding the places our safaris stay. Tell us the comfort you’d like, and we’ll suggest the right lodges and camps for your trip.'}</p>
							<div class="mt-6 flex flex-wrap gap-3">
								{#if enquiry}<Button variant="safari" href="#request-quote" onclick={() => chooseInterest('Help choosing where to stay')} class="h-12 px-6">Ask us where to stay <ArrowRight class="size-4" /></Button>{/if}
								{#if pastTheEnd}<Button variant="outline" href={pageHref(1)} class="h-12 px-6">Go to the first page</Button>{:else if filtered}<Button variant="outline" href="/stays#stay-results" class="h-12 px-6">See all stays</Button>{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
			{#if data.pageCount > 1}<nav aria-label="Stay pages" class="mt-8 flex items-center justify-center gap-4"><Button href={pageHref(data.page - 1)} disabled={data.page <= 1} variant="outline">Previous</Button><span class="text-xs">Page {data.page} of {data.pageCount}</span><Button href={pageHref(data.page + 1)} disabled={data.page >= data.pageCount} variant="outline">Next</Button></nav>{/if}
		</div>
	</section>

	{#if places.length}
		<section id="stay-destinations" class="border-t border-border bg-secondary/45 py-14 md:py-20" aria-labelledby="stay-destinations-title">
			<div class="page-container">
				<div data-motion="reveal" class="max-w-2xl">
					<p class="eyebrow text-muted-foreground">STAY BY DESTINATION</p>
					<div class="gold-line mt-4"></div>
					<h2 id="stay-destinations-title" class="section-heading mt-5">Where would you like to wake up?</h2>
					<p class="section-description mt-4 max-w-xl">Pick a park or island to see its lodges and camps, and the safaris that go there.</p>
				</div>
				<ul class="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(210px,1fr))] lg:gap-6">
					{#each places as place, i (place.id)}
						<li data-motion="card" class="grid grid-cols-[104px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-border bg-white sm:grid-cols-1">
							<img src={destinationPhoto(place, i)} alt="" loading="lazy" width="480" height="360" class="h-full min-h-28 w-full object-cover sm:aspect-[4/3] sm:h-auto" />
							<div class="flex min-w-0 flex-col p-4 sm:p-5">
								<h3 class="text-base font-bold tracking-[-.02em] text-navy sm:text-lg">{place.name}</h3>
								{#if place.region}<p class="mt-1 text-xs text-muted-foreground">{place.region}</p>{/if}
								<div class="mt-auto flex flex-wrap gap-2 pt-4">
									<a href={staysHref({}, { destination_id: place.id })} class="place-link place-link-primary">Stays<span class="sr-only"> in {place.name}</span><ArrowRight class="size-3.5" aria-hidden="true" /></a>
									<a href={`/tours?destination_id=${encodeURIComponent(place.id)}#tour-results`} class="place-link">Safaris<span class="sr-only"> to {place.name}</span><ArrowRight class="size-3.5" aria-hidden="true" /></a>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		</section>
	{/if}

	{#if enquiry}<Enquiry section={enquiry} {form} {interest} />{/if}
</main>
<SiteFooter visible={data.visible} destinations={data.destinations} onInterest={chooseInterest} {onPage} />

<style>
	.place-link { display: inline-flex; min-height: 2.5rem; align-items: center; gap: 0.35rem; border: 1px solid var(--border); border-radius: 0.6rem; padding: 0 0.85rem; color: var(--navy); font-size: 12px; font-weight: 600; transition: background 160ms ease-out, border-color 160ms ease-out; }
	.place-link:hover { border-color: color-mix(in oklch, var(--navy) 30%, transparent); background: var(--secondary); }
	.place-link-primary { border-color: var(--sun); background: var(--sun); }
	.place-link-primary:hover { border-color: var(--sun); background: color-mix(in oklch, var(--sun) 88%, white); }
</style>
