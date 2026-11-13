<script lang="ts">
	import { PHOTO } from '$lib/media-photos';
	import { ArrowDown, ArrowRight, SlidersHorizontal, X } from '@lucide/svelte';
	import PageHero from '$lib/components/page-hero.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import Enquiry from '$lib/components/home/enquiry.svelte';
	import StayCard from '$lib/components/stays/stay-card.svelte';
	import StaySearch from '$lib/components/stays/stay-search.svelte';
	import { glide } from '$lib/motion/glide';
	import { siteInfo } from '$lib/site-info';
	import { planHref } from '$lib/planner/plan-href';
	import { destinationPhoto } from '$lib/home-content';
	import { hasStayFilters, STAY_STYLES, staysHref, stayTypeLabel, type StayFilters } from '$lib/stay-content';
	import { SAFARI_STYLE_THEME } from '$lib/safari-pricing';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	// Phones keep the search behind one button; larger screens always show it.
	let showFilters = $state(false);
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
	let heading = $derived(data.staysUnavailable ? 'Lodges and camps' : `${data.stayTotal} ${data.stayTotal === 1 ? 'place to stay' : 'places to stay'}`);
	let styleHint = $derived(STAY_STYLES.find((style) => style.id === data.filters.style)?.hint ?? 'Every safari can be planned in Budget, Midrange or Luxury comfort.');
	// Filters other than the style, which has its own switcher.
	let searchCount = $derived(chips.filter((chip) => chip.key !== 'style').length);
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
	<meta name="theme-color" content="#36312b" />
	<link rel="canonical" href={canonical} />
	{@html `<script type="application/ld+json">${structuredData}</script>`}
</svelte:head>
<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-sun focus:p-4">Skip to content</a>
<SiteHeader visible={data.visible} activities={data.activities} destinations={data.destinations} onInterest={chooseInterest} tours={data.navTours} categories={data.categories} stays={data.navStays} {onPage} />
<main id="main">
	<PageHero titleId="stays-title" image={PHOTO.tentPlains} imageAlt="A safari tent looking out over the Serengeti plains" crumbs={[{ label: 'Home', href: '/' }, { label: 'Stays' }]} eyebrow="Lodges & camps" title="Where you’ll stay in Tanzania" intro="Lodges and tented camps for every style of safari, from simple bush camps to the most exclusive hideaways. Find yours, then see the safaris that stay there.">
		{#snippet actions()}
			<Button variant="safari" href="#stay-results">Browse stays <ArrowDown class="size-4" /></Button>
			{#if enquiry}<Button href={planHref({ from: 'stays' })} data-cta="plan_my_trip" data-cta-location="stays" variant="outline">Ask us where to stay</Button>{/if}
		{/snippet}
	</PageHero>

	<section id="stay-results" class="stays-results" aria-labelledby="stay-results-title">
		<div class="page-container">
			<div class="results-head" data-motion="reveal">
				<div class="min-w-0">
					<h2 id="stay-results-title" class="home-heading">{heading}</h2>
					<p class="results-copy">{styleHint}</p>
				</div>
				<button type="button" class="filter-toggle" aria-expanded={showFilters} aria-controls="stay-search" onclick={() => (showFilters = !showFilters)}>
					<SlidersHorizontal class="size-[18px]" strokeWidth={1.9} aria-hidden="true" />Search and filter{#if searchCount}<span class="filter-count">{searchCount}</span>{/if}
				</button>
			</div>

			<!-- The three styles, one tap apart; a marker glides to the one showing. -->
			<nav id="stay-styles" class="style-switch" aria-label="Stay style" use:glide={{ center: true }}>
				<a href={staysHref(data.filters, { style: '', page: '1' })} data-sveltekit-noscroll aria-current={!data.filters.style ? 'true' : undefined}>All styles</a>
				{#each STAY_STYLES as style (style.id)}
					<a href={staysHref(data.filters, { style: style.id, page: '1' })} data-sveltekit-noscroll aria-current={data.filters.style === style.id ? 'true' : undefined}><span class="dot" style={`background:${SAFARI_STYLE_THEME[style.id].primary}`} aria-hidden="true"></span>{style.label}</a>
				{/each}
			</nav>

			<div id="stay-search" class="filters" class:open={showFilters}><StaySearch destinations={places} filters={data.filters} /></div>

			{#if searchCount}
				<div class="active-filters">
					<ul aria-label="Active filters">
						{#each chips.filter((chip) => chip.key !== 'style') as chip (chip.key)}
							<li><a href={staysHref(data.filters, { [chip.key]: '', page: '1' })} data-sveltekit-noscroll aria-label={`Remove ${chip.kind.toLowerCase()} filter: ${chip.label}`}><span class="kind">{chip.kind}:</span><span class="truncate font-semibold">{chip.label}</span><X class="size-3.5 shrink-0" aria-hidden="true" /></a></li>
						{/each}
					</ul>
					<a class="clear" href={staysHref({ style: data.filters.style }, { page: '1' })} data-sveltekit-noscroll>Clear search</a>
				</div>
			{/if}
			<!-- Three columns at most, so the tall cards keep their proportions. -->
			<div class="stay-grid">
				{#each data.stays as stay (stay.id)}
					<StayCard {stay} destination={placeFor(stay.destination_id)} compact />
				{:else}
					<div data-motion="image" class="col-span-full grid overflow-hidden rounded-2xl border border-border bg-white md:grid-cols-2">
						<img src={PHOTO.acaciaAlone} alt="A baobab silhouetted against a Tanzania sunset" loading="lazy" class="h-60 w-full object-cover md:h-full md:min-h-80" />
						<div class="flex flex-col items-start justify-center p-7 md:p-10">
							<h3 class="mt-4 max-w-md text-2xl font-semibold tracking-tight md:text-3xl">{data.staysUnavailable ? 'We’ll help you choose where to stay' : pastTheEnd ? 'There are no more stays on this page' : filtered ? 'No stays match your search yet' : 'Our lodges and camps are on their way'}</h3>
							<p class="mt-4 max-w-md text-sm leading-7 text-muted-foreground">{data.staysUnavailable ? 'We can’t show our lodges and camps right now. Tell us the comfort and places you have in mind, and we’ll suggest where to stay.' : pastTheEnd ? 'This page is past the end of the list. Start again from the first page.' : filtered ? 'Try another destination, style or type, or tell us what you have in mind and we’ll suggest where to stay.' : 'We’re adding the places our safaris stay. Tell us the comfort you’d like, and we’ll suggest the right lodges and camps for your trip.'}</p>
							<div class="mt-6 flex flex-wrap gap-3">
								{#if enquiry}<Button variant="safari" href={planHref({ from: 'stays' })} data-cta="plan_my_trip" data-cta-location="stays" class="h-12 px-6">Ask us where to stay <ArrowRight class="size-4" /></Button>{/if}
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
					<h2 id="stay-destinations-title" class="home-heading">Stays by destination</h2>
					<p class="home-copy mt-3 max-w-xl">Pick a park or island to see its lodges and camps, and the safaris that go there.</p>
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
	.stays-results { padding-block: 64px 80px; background: #f7f5ef; }
	.results-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
	.results-copy { margin: 10px 0 0; max-width: 40rem; color: var(--muted-foreground); font-size: var(--text-base); line-height: 1.6; }
	.filter-toggle { display: none; }
	/* The style switcher: chips under a gliding marker (use:glide). */
	.style-switch { display: flex; gap: 8px; margin-top: 28px; overflow-x: auto; scrollbar-width: none; }
	.style-switch::-webkit-scrollbar { display: none; }
	.style-switch :global(.glide-mark) { border-radius: 9px; background: var(--navy); box-shadow: 0 10px 20px -12px rgb(31 27 22 / 0.8); }
	.style-switch a { position: relative; display: inline-flex; flex: none; align-items: center; gap: 8px; min-height: 44px; padding: 0 18px; border-radius: 9px; color: #5f584e; font-size: var(--text-sm); font-weight: 600; text-decoration: none; white-space: nowrap; -webkit-tap-highlight-color: transparent; transition: color 0.45s cubic-bezier(0.22, 1, 0.36, 1); }
	.style-switch a::before { content: ''; position: absolute; inset: 0; z-index: -2; border-radius: inherit; background: #ebe6da; transition: background-color 0.2s ease; }
	.style-switch a:hover { color: var(--navy); }
	.style-switch a:hover::before { background: #e3ddcf; }
	.style-switch a[aria-current='true'] { color: white; }
	.style-switch a:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }
	.style-switch .dot { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 0 2px rgb(255 255 255 / 0.6); }
	.filters { margin-top: 20px; }
	.active-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; margin-top: 18px; }
	.active-filters ul { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
	.active-filters ul a { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; min-height: 36px; padding: 0 12px; border-radius: 8px; background: white; box-shadow: 0 0 0 1px rgb(43 39 34 / 0.1); color: var(--navy); font-size: var(--text-xs); text-decoration: none; }
	.active-filters ul a:hover { box-shadow: 0 0 0 1px rgb(43 39 34 / 0.3); }
	.active-filters .kind { color: var(--muted-foreground); }
	.active-filters .clear { color: var(--navy); font-size: var(--text-sm); font-weight: 700; text-decoration: none; }
	.stay-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; margin-top: 36px; }
	@media (max-width: 1023px) { .stay-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; } }
	/* Phones: the search opens from a button, the styles scroll edge to edge and
	   the stays become a list of rows. */
	@media (max-width: 639px) {
		.stays-results { padding-block: 44px 56px; }
		.results-head { flex-direction: column; align-items: stretch; gap: 16px; }
		.filter-toggle { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; border: 0; border-radius: 10px; background: white; box-shadow: 0 0 0 1px rgb(43 39 34 / 0.12); color: var(--navy); font-size: var(--text-sm); font-weight: 600; cursor: pointer; }
		.filter-toggle[aria-expanded='true'] { box-shadow: 0 0 0 1.5px var(--navy); }
		.filter-count { display: grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 6px; background: var(--sun); font-size: var(--text-xs); font-weight: 700; }
		.style-switch { margin: 20px -1rem 0; padding: 2px 1rem; }
		.filters:not(.open) { display: none; }
		.filters.open { animation: filters-in 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
		.stay-grid { grid-template-columns: minmax(0, 1fr); gap: 10px; margin-top: 22px; }
	}
	@keyframes filters-in { from { opacity: 0; translate: 0 -6px; } }
	@media (prefers-reduced-motion: reduce) { .filters.open { animation: none; } .style-switch a { transition: none; } }
	.place-link { display: inline-flex; min-height: 2.5rem; align-items: center; gap: 0.35rem; border: 1px solid var(--border); border-radius: var(--radius-surface); padding: 0 0.85rem; color: var(--navy); font-size: var(--text-xs); font-weight: 600; transition: background 160ms ease-out, border-color 160ms ease-out; }
	.place-link:hover { border-color: color-mix(in oklch, var(--navy) 30%, transparent); background: var(--secondary); }
	.place-link-primary { border-color: var(--sun); background: var(--sun); }
	.place-link-primary:hover { border-color: var(--sun); background: color-mix(in oklch, var(--sun) 88%, white); }
</style>
