<script lang="ts">
	import { PHOTO } from '$lib/media-photos';
	import '$lib/components/destinations/destination.css';
	import { ArrowDown, ArrowRight } from '@lucide/svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import PageHero from '$lib/components/page-hero.svelte';
	import { Button } from '$lib/components/ui/button';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import Enquiry from '$lib/components/home/enquiry.svelte';
	import DestinationImage from '$lib/components/destinations/destination-image.svelte';
	import DestinationExplorer from '$lib/components/destinations/destination-explorer.svelte';
	import { destinationHref } from '$lib/destination-content';
	import { queryString, type ExplorerQuery, type RegionKey } from '$lib/destination-explorer';
	import { safeUrl, textContent, tourDuration } from '$lib/home-content';
	import { formatPrice } from '$lib/safari-pricing';
	import { siteInfo } from '$lib/site-info';
	import { planHref } from '$lib/planner/plan-href';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let interest = $state('Help me choose a destination');
	const chooseInterest = (name: string) => { interest = name; };
	let chrome = $derived(data.chrome);
	let enquiry = $derived(chrome.sections.find((s) => s.section_key === 'enquiry' && s.is_active !== false));
	let content = $derived(chrome.sections.find((s) => s.section_key === 'destinations'));
	let title = $derived(content?.title || 'Find your place in Tanzania.');
	let description = $derived(textContent(content?.content) || 'Wild places, island escapes and journeys that stay with you. Explore our destinations and find the places that belong in your story.');
	let hero = $derived(safeUrl(content?.image_url, '') || safeUrl(data.featured?.banner_image_url || data.featured?.main_image_url || data.featured?.image_url, ''));
	let onPage = $derived(['top', 'destination-results', ...(enquiry ? ['request-quote'] : [])]);
	let countries = $derived(data.countries.map((country) => country.name));

	// The explorer's filters live in the address, so a region or a search can be shared.
	let query = $derived(data.query);
	let urlTimer: ReturnType<typeof setTimeout> | undefined;
	function setQuery(next: ExplorerQuery) {
		query = next;
		clearTimeout(urlTimer);
		urlTimer = setTimeout(() => {
			const href = `/destinations${queryString(next)}`;
			if (`${location.pathname}${location.search}` !== href) replaceState(href, page.state);
		}, 250);
	}
	const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	function goRegion(event: MouseEvent, region: RegionKey) {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
		event.preventDefault();
		setQuery({ ...query, region, search: '', country: '' });
		document.getElementById('destination-results')?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
	}

	let canonical = $derived(`${data.siteOrigin}/destinations`);
	let filtered = $derived(Boolean(data.query.search || data.query.region || data.query.country || data.query.sort !== 'recommended'));
	let structured = $derived(JSON.stringify({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: canonical, mainEntity: { '@type': 'ItemList', itemListElement: data.places.map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: d.name, url: data.siteOrigin + destinationHref(d) })) } }).replace(/</g, '\\u003c'));
</script>

<svelte:head>
	<title>Destinations | {siteInfo.company}</title><meta name="description" content={description} /><link rel="canonical" href={canonical} />
	{#if filtered}<meta name="robots" content="noindex,follow" />{/if}
	<meta property="og:title" content={`Destinations | ${siteInfo.brand}`} /><meta property="og:description" content={description} /><meta property="og:type" content="website" /><meta property="og:url" content={canonical} />{#if hero}<meta property="og:image" content={new URL(hero, data.siteOrigin).href} />{/if}<meta name="twitter:card" content="summary_large_image" />
	{@html `<script type="application/ld+json">${structured}</script>`}
</svelte:head>

<a href="#main" class="sr-only focus:not-sr-only">Skip to content</a>
<SiteHeader visible={chrome.visible} activities={chrome.activities} destinations={chrome.destinations} tours={chrome.navTours} stays={chrome.navStays} categories={chrome.categories} onInterest={chooseInterest} {onPage} />
<main id="main">
	<PageHero titleId="destinations-title" asideWide crumbs={[{ label: 'Home', href: '/' }, { label: 'Destinations' }]} eyebrow={content?.subtitle || 'The places that stay with you'} {title} intro={description}>
		{#snippet media()}<DestinationImage urls={[hero, data.featured?.main_image_url, data.featured?.image_url]} alt={data.featured?.name || 'Discover our destinations'} fallback={PHOTO.acaciaHaze} hero />{/snippet}
		{#snippet actions()}<Button href="#destination-results" variant="safari">Explore destinations <ArrowDown size={16} /></Button>{#if enquiry}<Button href={planHref({ from: 'destinations' })} data-cta="plan_my_trip" data-cta-location="destinations" variant="outline">Help me choose</Button>{/if}{/snippet}
		{#snippet aside()}
			{#if data.countries.length > 1}
				<!-- Places in several countries: each country is a way in, to its own page. -->
				<nav id="countries" class="region-finder" aria-labelledby="region-finder-title">
					<div class="region-finder-head">
						<h2 id="region-finder-title">Explore by country</h2>
						<p>{data.places.length} places in {data.countries.length} countries</p>
					</div>
					<ul>
						{#each data.countries as country (country.slug)}
							<li>
								<a href={country.href}>
									<span class="region-name"><strong>{country.name}</strong>{#if country.description}<small>{country.description}</small>{/if}</span>
									<span class="region-count">{country.count}</span>
									<ArrowRight aria-hidden="true" />
								</a>
							</li>
						{/each}
					</ul>
				</nav>
			{:else if data.regions.length > 1}
				<nav class="region-finder" aria-labelledby="region-finder-title">
					<div class="region-finder-head">
						<h2 id="region-finder-title">Explore by region</h2>
						<p>{data.places.length} places{countries.length ? ` in ${countries.join(' and ')}` : ''}</p>
					</div>
					<ul>
						{#each data.regions as region (region.key)}
							<li>
								<a href={`/destinations${queryString({ search: '', country: '', sort: 'recommended', region: region.key })}#destination-results`} data-sveltekit-noscroll onclick={(e) => goRegion(e, region.key)}>
									<span class="region-name"><strong>{region.title}</strong>{#if region.description}<small>{region.description}</small>{/if}</span>
									<span class="region-count">{region.count}</span>
									<ArrowRight aria-hidden="true" />
								</a>
							</li>
						{/each}
					</ul>
				</nav>
			{/if}
		{/snippet}
	</PageHero>

	<section id="destination-results" class="destination-section page-container">
		<div class="destination-section-head">
			<div>
				<h2 class="home-heading">{data.places.length ? `${data.places.length} parks, islands and regions` : 'Parks, islands and regions'}</h2>
				<p>Pick a region, search by name, or sort by what matters most to you. Every place is on the map.</p>
			</div>
		</div>
		{#if data.places.length}
			<DestinationExplorer places={data.places} regions={data.regions} sorts={data.sorts} {query} onquery={setQuery} />
		{:else}
			<div class="destination-empty">
				<h2>{data.unavailable ? 'We can’t show our destinations right now' : 'Our destinations are on their way'}</h2>
				<p>{data.unavailable ? 'Please try again shortly, or ask our team for ideas.' : 'Ask our team where to go in the meantime.'}</p>
				<Button href={data.unavailable ? '/destinations' : planHref({ from: 'destinations' })} variant="outline">{data.unavailable ? 'Try again' : 'Ask our team'}</Button>
			</div>
		{/if}
	</section>

	{#if data.routes.length}
		<section class="routes page-container" aria-labelledby="routes-title">
			<div class="routes-head">
				<div>
					<h2 id="routes-title" class="home-heading">Places that go well together</h2>
					<p>Safaris that link several of these places in one trip, day by day.</p>
				</div>
				<a href="/tours" class="routes-all">All safaris<ArrowRight aria-hidden="true" /></a>
			</div>
			<div class="route-grid">
				{#each data.routes as route (route.id)}
					<article class="route">
						<div class="route-photo"><img src={route.photo} alt="" loading="lazy" decoding="async" /></div>
						<div class="route-body">
							<p class="route-meta">{[tourDuration(route.days), `${route.stops.length} places`].filter(Boolean).join(' · ')}</p>
							<h3><a href={`/tours/${encodeURIComponent(route.slug)}`}>{route.title}</a></h3>
							<ol class="route-stops" aria-label="Route">
								{#each route.stops as stop, i (i)}<li>{stop.name}</li>{/each}
							</ol>
							<p class="route-price">{#if route.from}<small>From</small> {formatPrice(route.from.amount, route.from.currency)}{:else}Price on request{/if}<ArrowRight aria-hidden="true" /></p>
						</div>
					</article>
				{/each}
			</div>
		</section>
	{/if}

	{#if enquiry}
		<section class="page-container pb-16">
			<div class="destination-cta">
				<div><h2>Not sure which places to combine?</h2><p>Tell us what you’d like to see and do. We’ll suggest a route: which parks and islands, how long in each, and where to stay.</p></div>
				<Button href={planHref({ from: 'destinations' })} data-cta="plan_my_trip" data-cta-location="destinations" variant="safari">Plan my route <ArrowRight size={17} /></Button>
			</div>
		</section>
		<Enquiry section={enquiry} {form} {interest} />
	{/if}
</main>
<SiteFooter visible={chrome.visible} destinations={chrome.destinations} onInterest={chooseInterest} {onPage} />

<style>
	/* Real safaris as routes through the places. */
	.routes { padding-block: 24px 72px; }
	.routes-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
	.routes-head p { margin: 12px 0 0; color: var(--muted-foreground); font-size: var(--text-base); line-height: 1.65; }
	.routes-all { display: inline-flex; flex: none; align-items: center; gap: 6px; color: var(--navy); font-size: var(--text-sm); font-weight: 700; text-decoration: none; }
	.routes-all :global(svg), .route-price :global(svg) { width: 16px; height: 16px; transition: translate 0.2s ease; }
	.routes-all:hover :global(svg) { translate: 3px 0; }
	.route-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
	.route { position: relative; display: flex; flex-direction: column; overflow: hidden; border-radius: var(--radius-surface); background: #fff; box-shadow: 0 0 0 1px rgb(43 39 34 / 0.07), 0 18px 40px -32px rgb(39 36 31 / 0.55); transition: translate 0.2s ease, box-shadow 0.2s ease; }
	.route-photo { aspect-ratio: 16 / 10; overflow: hidden; background: #ebe6da; }
	.route-photo img { display: block; width: 100%; height: 100%; object-fit: cover; transition: scale 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
	.route-body { display: flex; flex: 1; flex-direction: column; padding: 18px 20px 20px; }
	.route-meta { margin: 0; color: var(--muted-foreground); font-size: var(--text-xs); font-weight: 600; }
	.route h3 { margin: 6px 0 0; font-size: var(--text-lg); font-weight: 600; line-height: 1.3; letter-spacing: -0.015em; color: var(--navy); text-wrap: balance; }
	.route h3 a { color: inherit; text-decoration: none; }
	.route h3 a::after { content: ''; position: absolute; inset: 0; }
	.route:has(h3 a:focus-visible) { box-shadow: 0 0 0 3px var(--sun); }
	.route h3 a:focus-visible { outline: none; }
	/* The stops as a line of travel: a dot per place, joined. */
	.route-stops { display: grid; gap: 0; margin: 16px 0 18px; padding: 0; list-style: none; }
	.route-stops li { position: relative; padding: 0 0 10px 22px; color: var(--navy); font-size: var(--text-sm); line-height: 1.35; }
	.route-stops li:last-child { padding-bottom: 0; }
	.route-stops li::before { content: ''; position: absolute; top: 5px; left: 3px; width: 9px; height: 9px; border: 2px solid var(--navy); border-radius: 50%; background: #fff; }
	.route-stops li:first-child::before, .route-stops li:last-child::before { background: var(--sun); }
	.route-stops li:not(:last-child)::after { content: ''; position: absolute; top: 16px; bottom: -3px; left: 7px; width: 1px; background: #cfc8b8; }
	.route-price { display: flex; align-items: center; gap: 6px; margin: auto 0 0; padding-top: 14px; border-top: 1px solid var(--border); color: var(--navy); font-size: var(--text-base); font-weight: 700; font-variant-numeric: tabular-nums; }
	.route-price small { color: var(--muted-foreground); font-size: var(--text-xs); font-weight: 600; }
	.route-price :global(svg) { margin-left: auto; }
	@media (hover: hover) {
		.route:hover { translate: 0 -3px; box-shadow: 0 0 0 1px rgb(43 39 34 / 0.1), 0 26px 48px -30px rgb(39 36 31 / 0.6); }
		.route:hover .route-photo img { scale: 1.04; }
		.route:hover .route-price :global(svg) { translate: 3px 0; }
	}
	@media (max-width: 1023px) { .route-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
	@media (max-width: 639px) {
		.routes { padding-block: 8px 56px; }
		.routes-head { flex-direction: column; align-items: flex-start; gap: 12px; margin-bottom: 20px; }
		.route-grid { display: flex; gap: 12px; margin-inline: -1rem; padding: 2px 1rem 12px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
		.route-grid::-webkit-scrollbar { display: none; }
		.route { flex: 0 0 82%; scroll-snap-align: center; }
	}
	@media (prefers-reduced-motion: reduce) { .route, .route-photo img { transition: none; } }
</style>
