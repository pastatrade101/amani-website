<script lang="ts">
	import '$lib/components/destinations/destination.css';
	import { ArrowDown, ArrowRight } from '@lucide/svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import PageHero from '$lib/components/page-hero.svelte';
	import { Button } from '$lib/components/ui/button';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import Enquiry from '$lib/components/home/enquiry.svelte';
	import CardSlider from '$lib/components/card-slider.svelte';
	import TourCard from '$lib/components/tours/tour-card.svelte';
	import StayCard from '$lib/components/stays/stay-card.svelte';
	import DestinationImage from '$lib/components/destinations/destination-image.svelte';
	import DestinationExplorer from '$lib/components/destinations/destination-explorer.svelte';
	import { destinationHref } from '$lib/destination-content';
	import { queryString, type ExplorerQuery, type RegionKey } from '$lib/destination-explorer';
	import { safeUrl, tourPhotos } from '$lib/home-content';
	import { siteInfo } from '$lib/site-info';
	import { planHref } from '$lib/planner/plan-href';
	import type { PageProps } from './$types';

	// A country's own page: its places on the map, the safaris that visit them,
	// where to stay, and the country record's facts when the CMS has them.
	let { data, form }: PageProps = $props();
	let chrome = $derived(data.chrome);
	let country = $derived(data.country);
	let picked = $state('');
	let interest = $derived(picked || `A safari in ${country.name}`);
	const chooseInterest = (name: string) => { picked = name; };
	let enquiry = $derived(chrome.sections.find((s) => s.section_key === 'enquiry' && s.is_active !== false));
	let hasFacts = $derived(Boolean(country.capital || country.currency || country.bestMonths.length || country.visa || country.health));
	let onPage = $derived(['top', ...(hasFacts ? ['before-you-go'] : []), 'destination-results', ...(enquiry ? ['request-quote'] : [])]);
	let tourPhotoList = $derived(tourPhotos(data.tours));
	const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

	// The explorer's filters live in the address, so a region or a search can be shared.
	let base = $derived(`/destinations/${country.slug}`);
	let query = $derived(data.query);
	let urlTimer: ReturnType<typeof setTimeout> | undefined;
	function setQuery(next: ExplorerQuery) {
		query = next;
		clearTimeout(urlTimer);
		urlTimer = setTimeout(() => {
			const href = `${base}${queryString(next)}`;
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

	let canonical = $derived(`${data.siteOrigin}${base}`);
	let pageTitle = $derived(country.metaTitle || `${country.name}: parks, places & safaris | ${siteInfo.company}`);
	let description = $derived(country.metaDescription || country.intro);
	let ogImage = $derived(safeUrl(country.ogImage || country.hero, ''));
	let filtered = $derived(Boolean(data.query.search || data.query.region || data.query.country || data.query.sort !== 'recommended'));
	let structured = $derived(JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{ '@type': 'BreadcrumbList', itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Home', item: `${data.siteOrigin}/` },
				{ '@type': 'ListItem', position: 2, name: 'Destinations', item: `${data.siteOrigin}/destinations` },
				{ '@type': 'ListItem', position: 3, name: country.name, item: canonical }
			] },
			{ '@type': 'CollectionPage', name: country.name, url: canonical, about: { '@type': 'Country', name: country.name }, mainEntity: { '@type': 'ItemList', itemListElement: data.places.map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: d.name, url: data.siteOrigin + destinationHref(d) })) } }
		]
	}).replace(/</g, '\\u003c'));
</script>

<svelte:head>
	<title>{pageTitle}</title>
	{#if description}<meta name="description" content={description} />{/if}
	<link rel="canonical" href={canonical} />
	{#if filtered}<meta name="robots" content="noindex,follow" />{/if}
	<meta property="og:site_name" content={siteInfo.company} />
	<meta property="og:title" content={pageTitle} />
	{#if description}<meta property="og:description" content={description} />{/if}
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonical} />
	{#if ogImage}<meta property="og:image" content={new URL(ogImage, data.siteOrigin).href} />{/if}
	<meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
	{@html `<script type="application/ld+json">${structured}</script>`}
</svelte:head>

<a href="#main" class="sr-only focus:not-sr-only">Skip to content</a>
<SiteHeader visible={chrome.visible} activities={chrome.activities} destinations={chrome.destinations} tours={chrome.navTours} stays={chrome.navStays} categories={chrome.categories} onInterest={chooseInterest} {onPage} />
<main id="main">
	<PageHero titleId="country-title" asideWide crumbs={[{ label: 'Home', href: '/' }, { label: 'Destinations', href: '/destinations' }, { label: country.name }]} title={country.name} intro={country.intro}>
		{#snippet media()}<DestinationImage urls={[country.hero]} alt={country.heroAlt || country.name} hero />{/snippet}
		{#snippet actions()}
			{#if data.places.length}<Button href="#destination-results" variant="safari">{`Explore ${count(data.places.length, 'place', 'places')}`} <ArrowDown size={16} /></Button>{/if}
			{#if enquiry}<Button href={planHref({ from: 'country_page' })} data-cta="plan_my_trip" data-cta-location="country_page" variant="outline">Plan a trip to {country.name}</Button>{/if}
		{/snippet}
		{#snippet aside()}
			{#if data.regions.length > 1}
				<nav class="region-finder" aria-labelledby="region-finder-title">
					<div class="region-finder-head">
						<h2 id="region-finder-title">Explore by region</h2>
						<p>{count(data.places.length, 'place', 'places')} in {country.name}</p>
					</div>
					<ul>
						{#each data.regions as region (region.key)}
							<li>
								<a href={`${base}${queryString({ search: '', country: '', sort: 'recommended', region: region.key })}#destination-results`} data-sveltekit-noscroll onclick={(e) => goRegion(e, region.key)}>
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

	{#if hasFacts}
		<section id="before-you-go" class="facts page-container" aria-labelledby="facts-title">
			<h2 id="facts-title" class="home-heading">Before you go</h2>
			<div class="facts-grid">
				{#if country.capital || country.currency}
					<dl class="facts-list">
						{#if country.capital}<div><dt>Capital</dt><dd>{country.capital}</dd></div>{/if}
						{#if country.currency}<div><dt>Currency</dt><dd>{country.currency}</dd></div>{/if}
					</dl>
				{/if}
				{#if country.bestMonths.length}
					<div class="months-block">
						<h3>Best months to go</h3>
						<ol class="months" aria-label={`Best months: ${MONTHS.filter((m) => country.bestMonths.includes(m)).join(', ')}`}>
							{#each MONTHS as month (month)}<li class:best={country.bestMonths.includes(month)} aria-hidden="true"><abbr title={month}>{month.slice(0, 3)}</abbr></li>{/each}
						</ol>
					</div>
				{/if}
				{#if country.visa}<div class="fact-note"><h3>Visas</h3><p>{country.visa}</p></div>{/if}
				{#if country.health}<div class="fact-note"><h3>Health</h3><p>{country.health}</p></div>{/if}
			</div>
		</section>
	{/if}

	<section id="destination-results" class="destination-section page-container">
		<div class="destination-section-head">
			<div>
				<h2 class="home-heading">{data.places.length ? `${count(data.places.length, 'place', 'places')} in ${country.name}` : `Places in ${country.name}`}</h2>
				<p>{data.regions.length > 1 ? 'Pick a region, search by name, or sort by what matters most to you.' : 'Search by name, or sort by what matters most to you.'} Every place is on the map.</p>
			</div>
		</div>
		{#if data.places.length}
			<DestinationExplorer places={data.places} regions={data.regions} sorts={data.sorts} {query} onquery={setQuery} {base} />
		{:else}
			<div class="destination-empty">
				<h2>{data.unavailable ? 'We can’t show these places right now' : `Our places in ${country.name} are on their way`}</h2>
				<p>{data.unavailable ? 'Please try again shortly, or ask our team for ideas.' : 'Ask our team where to go in the meantime.'}</p>
				<Button href={data.unavailable ? base : planHref({ from: 'country_page' })} variant="outline">{data.unavailable ? 'Try again' : 'Ask our team'}</Button>
			</div>
		{/if}
	</section>

	{#if data.tours.length}
		<section class="country-rail page-container" aria-labelledby="country-safaris-title" style="--slider-bleed: 1rem">
			<div class="rail-head">
				<div>
					<h2 id="country-safaris-title" class="home-heading">Safaris in {country.name}</h2>
					<p>{data.tourTotal === 1 ? `One of our safaris visits ${country.name}.` : `${data.tourTotal} of our safaris visit ${country.name}.`}</p>
				</div>
				<a href="/tours" class="rail-all">All safaris<ArrowRight aria-hidden="true" /></a>
			</div>
			<CardSlider items={data.tours} label={`Safaris in ${country.name}`} key={(tour) => tour.id} class="country-tours">
				{#snippet card(tour, i)}<TourCard {tour} photo={tourPhotoList[i]} />{/snippet}
			</CardSlider>
		</section>
	{/if}

	{#if data.stays.length}
		<section class="country-rail page-container" aria-labelledby="country-stays-title">
			<div class="rail-head">
				<div>
					<h2 id="country-stays-title" class="home-heading">Where you’ll stay</h2>
					<p>{data.stayTotal === 1 ? `One lodge or camp in ${country.name}.` : `${data.stayTotal} lodges, camps and hotels in ${country.name}${data.stayTotal > data.stays.length ? `, ${data.stays.length} shown here` : ''}.`}</p>
				</div>
				<a href={`/stays?country=${encodeURIComponent(country.name)}#stay-results`} class="rail-all">{data.stayTotal > data.stays.length ? `All ${data.stayTotal} stays` : 'All stays'}<ArrowRight aria-hidden="true" /></a>
			</div>
			<ul class="stay-grid">
				{#each data.stays as stay (stay.id)}<li><StayCard {stay} destination={data.stayPlaces[stay.id] ?? null} /></li>{/each}
			</ul>
		</section>
	{/if}

	{#if data.others.length}
		<section class="country-rail page-container" aria-labelledby="other-countries-title">
			<div class="rail-head"><div><h2 id="other-countries-title" class="home-heading">More of East Africa</h2></div></div>
			<ul class="other-countries">
				{#each data.others as other (other.slug)}
					<li><a href={other.href}><strong>{other.name}</strong><span>{count(other.count, 'place', 'places')}</span><ArrowRight aria-hidden="true" /></a></li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if enquiry}
		<section class="page-container pb-16">
			<div class="destination-cta">
				<div><h2>Thinking about {country.name}?</h2><p>Tell us what you’d like to see and do. We’ll suggest a route: which places, how long in each, and where to stay.</p></div>
				<Button href={planHref({ from: 'country_page' })} data-cta="plan_my_trip" data-cta-location="country_page" variant="safari">Plan my route <ArrowRight size={17} /></Button>
			</div>
		</section>
		<Enquiry section={enquiry} {form} {interest} />
	{/if}
</main>
<SiteFooter visible={chrome.visible} destinations={chrome.destinations} onInterest={chooseInterest} {onPage} />

<style>
	/* Before you go: the country record's facts, only those it has. */
	.facts { padding-block: 64px 8px; }
	.facts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 24px; }
	.facts-list, .months-block, .fact-note { margin: 0; padding: 22px; border: 1px solid var(--border); border-radius: var(--radius-surface); background: #fff; }
	.facts-list { display: grid; align-content: start; gap: 0; }
	.facts-list div { display: flex; justify-content: space-between; gap: 16px; padding: 12px 0; border-top: 1px solid var(--border); }
	.facts-list div:first-child { padding-top: 0; border-top: 0; }
	.facts-list dt { color: var(--muted-foreground); font-size: var(--text-sm); }
	.facts-list dd { margin: 0; color: var(--navy); font-size: var(--text-sm); font-weight: 600; text-align: right; }
	.months-block h3, .fact-note h3 { margin: 0 0 12px; color: var(--navy); font-size: var(--text-base); font-weight: 600; }
	.months { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; margin: 0; padding: 0; list-style: none; }
	.months li { display: grid; place-items: center; height: 34px; border-radius: 6px; background: #f1ede4; color: var(--muted-foreground); font-size: var(--text-xs); font-weight: 600; }
	.months li.best { background: var(--sun); color: #2b2722; }
	.months abbr { text-decoration: none; }
	.fact-note p { margin: 0; color: var(--muted-foreground); font-size: var(--text-sm); line-height: 1.7; white-space: pre-line; }

	/* Safaris, stays and the other countries: a heading row, then the cards. */
	.country-rail { padding-block: 16px 64px; }
	.rail-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
	.rail-head p { margin: 12px 0 0; color: var(--muted-foreground); font-size: var(--text-base); line-height: 1.65; }
	.rail-all { display: inline-flex; flex: none; align-items: center; gap: 6px; color: var(--navy); font-size: var(--text-sm); font-weight: 700; text-decoration: none; }
	.rail-all :global(svg) { width: 16px; height: 16px; transition: translate 0.2s ease; }
	.rail-all:hover :global(svg) { translate: 3px 0; }
	@media (min-width: 768px) { .country-rail :global(.country-tours) { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; } }
	.stay-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; margin: 0; padding: 0; list-style: none; }
	.other-countries { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
	.other-countries a { display: grid; grid-template-columns: minmax(0, 1fr) auto 16px; align-items: center; gap: 12px; min-height: 64px; padding: 14px 18px; border: 1px solid var(--border); border-radius: var(--radius-surface); background: #fff; color: var(--navy); text-decoration: none; transition: border-color 0.2s ease, box-shadow 0.2s ease; }
	.other-countries strong { font-size: var(--text-base); font-weight: 600; }
	.other-countries span { color: var(--muted-foreground); font-size: var(--text-sm); font-variant-numeric: tabular-nums; }
	.other-countries a :global(svg) { width: 16px; height: 16px; color: var(--muted-foreground); transition: translate 0.2s ease; }
	.other-countries a:hover { border-color: #cfc6b2; box-shadow: 0 12px 28px -22px rgb(39 36 31 / 0.5); }
	.other-countries a:hover :global(svg) { translate: 3px 0; color: var(--navy); }
	.other-countries a:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }
	@media (max-width: 1023px) { .stay-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
	@media (max-width: 639px) {
		.facts { padding-block: 48px 0; }
		.country-rail { padding-block: 8px 48px; }
		.rail-head { flex-direction: column; align-items: flex-start; gap: 12px; margin-bottom: 18px; }
		.stay-grid { grid-template-columns: minmax(0, 1fr); gap: 12px; }
	}
	@media (prefers-reduced-motion: reduce) { .rail-all :global(svg), .other-countries a, .other-countries a :global(svg) { transition: none; } }
</style>
