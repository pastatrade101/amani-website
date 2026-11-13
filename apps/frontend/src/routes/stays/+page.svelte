<script lang="ts">
	import { PHOTO } from '$lib/media-photos';
	import '$lib/components/destinations/destination.css';
	import { ArrowDown, ArrowRight } from '@lucide/svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import PageHero from '$lib/components/page-hero.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import Enquiry from '$lib/components/home/enquiry.svelte';
	import StayExplorer from '$lib/components/stays/stay-explorer.svelte';
	import { siteInfo } from '$lib/site-info';
	import { planHref } from '$lib/planner/plan-href';
	import { STAY_STYLES } from '$lib/stay-content';
	import { stayQueryString, toStayItem, type StayQuery } from '$lib/stay-explorer';
	import { SAFARI_STYLE_THEME, type SafariStyle } from '$lib/safari-pricing';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let interest = $state('');
	const chooseInterest = (name: string) => { interest = name; };
	let enquiry = $derived(data.sections.find((section) => section.section_key === 'enquiry' && section.is_active !== false));
	let onPage = $derived(['top', 'stay-results', ...(enquiry ? ['request-quote'] : [])]);
	let comfort = $derived(STAY_STYLES.map((style) => ({ ...style, count: data.stays.filter((stay) => toStayItem(stay).style === style.id).length })));

	// The explorer's filters live in the address, so a comfort or a place can be shared.
	let query = $derived(data.query);
	let urlTimer: ReturnType<typeof setTimeout> | undefined;
	function setQuery(next: StayQuery) {
		query = next;
		clearTimeout(urlTimer);
		urlTimer = setTimeout(() => {
			const href = `/stays${stayQueryString(next)}`;
			if (`${location.pathname}${location.search}` !== href) replaceState(href, page.state);
		}, 250);
	}
	const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	function goComfort(event: MouseEvent, style: SafariStyle) {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
		event.preventDefault();
		setQuery({ search: '', place: '', type: '', country: '', style });
		document.getElementById('stay-results')?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
	}

	const description = 'Where you’ll stay on safari in Tanzania: lodges, tented camps and hotels in Budget, Midrange and Luxury comfort, each on the map and linked to the safaris that stay there.';
	let styleName = $derived(STAY_STYLES.find((style) => style.id === data.query.style)?.label ?? '');
	let pageTitle = $derived(`${styleName ? `${styleName} safari` : 'Safari'} lodges & camps in Tanzania | ${siteInfo.company}`);
	let canonical = $derived(`${data.siteOrigin}/stays`);
	let filtered = $derived(Boolean(data.query.search || data.query.place || data.query.type || data.query.country));
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
	{#if filtered}<meta name="robots" content="noindex,follow" />{/if}
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
	<PageHero titleId="stays-title" asideWide image={PHOTO.tentPlains} imageAlt="A safari tent looking out over the Serengeti plains" crumbs={[{ label: 'Home', href: '/' }, { label: 'Stays' }]} eyebrow="Lodges & camps" title="Where you’ll stay in Tanzania" intro="Lodges and tented camps for every style of safari, from simple bush camps to the most exclusive hideaways. Find yours, then see the safaris that stay there.">
		{#snippet actions()}
			<Button variant="safari" href="#stay-results">Browse stays <ArrowDown class="size-4" /></Button>
			{#if enquiry}<Button href={planHref({ from: 'stays' })} data-cta="plan_my_trip" data-cta-location="stays" variant="outline">Ask us where to stay</Button>{/if}
		{/snippet}
		{#snippet aside()}
			{#if data.stays.length}
				<nav class="comfort-finder" aria-labelledby="comfort-finder-title">
					<div class="comfort-head">
						<h2 id="comfort-finder-title">Choose your comfort</h2>
						<p>{data.stays.length} stays in {data.places.length} {data.places.length === 1 ? 'place' : 'places'}</p>
					</div>
					<ul>
						{#each comfort as style (style.id)}
							{#if style.count}
								<li>
									<a href={`/stays?style=${style.id}#stay-results`} data-sveltekit-noscroll onclick={(e) => goComfort(e, style.id)}>
										<i style:background={SAFARI_STYLE_THEME[style.id].primary} aria-hidden="true"></i>
										<span class="comfort-name"><strong>{style.label}</strong>{#if style.hint}<small>{style.hint}</small>{/if}</span>
										<span class="comfort-count">{style.count}</span>
										<ArrowRight aria-hidden="true" />
									</a>
								</li>
							{/if}
						{/each}
					</ul>
				</nav>
			{/if}
		{/snippet}
	</PageHero>

	<section id="stay-results" class="destination-section page-container" aria-labelledby="stay-results-title">
		<div class="destination-section-head">
			<div>
				<h2 id="stay-results-title" class="home-heading">{data.stays.length ? `${data.stays.length} lodges, camps and hotels` : 'Lodges, camps and hotels'}</h2>
				<p>Choose a comfort, a place or a kind of stay. Every stay is on the map at its park or town.</p>
			</div>
		</div>
		{#if data.stays.length}
			<StayExplorer stays={data.stays} places={data.places} placeDetails={data.placeDetails} {query} onquery={setQuery} />
		{:else}
			<div class="destination-empty">
				<h2>{data.staysUnavailable ? 'We can’t show our lodges and camps right now' : 'Our lodges and camps are on their way'}</h2>
				<p>{data.staysUnavailable ? 'Please try again shortly, or tell us the comfort and places you have in mind and we’ll suggest where to stay.' : 'We’re adding the places our safaris stay. Tell us the comfort you’d like, and we’ll suggest the right lodges and camps.'}</p>
				<Button href={data.staysUnavailable ? '/stays' : planHref({ from: 'stays' })} variant="outline">{data.staysUnavailable ? 'Try again' : 'Ask us where to stay'}</Button>
			</div>
		{/if}
	</section>

	{#if enquiry}
		<section class="page-container pb-16">
			<div class="destination-cta">
				<div><h2>Not sure where to stay?</h2><p>Tell us how you like to travel. We’ll match lodges and camps to your route, your comfort and your budget, night by night.</p></div>
				<Button href={planHref({ from: 'stays' })} data-cta="plan_my_trip" data-cta-location="stays" variant="safari">Ask us where to stay <ArrowRight size={17} /></Button>
			</div>
		</section>
		<Enquiry section={enquiry} {form} {interest} />
	{/if}
</main>
<SiteFooter visible={data.visible} destinations={data.destinations} onInterest={chooseInterest} {onPage} />

<style>
	/* Hero: the three comfort levels as a way in, in the same glass as the other finders. */
	.comfort-finder { display: grid; gap: 14px; padding: 22px; border: 1px solid rgb(255 255 255 / 0.16); border-radius: var(--radius-surface); background: linear-gradient(160deg, rgb(30 34 36 / 0.72), rgb(36 30 24 / 0.66)); -webkit-backdrop-filter: blur(14px) saturate(1.1); backdrop-filter: blur(14px) saturate(1.1); box-shadow: 0 30px 70px -30px rgb(0 0 0 / 0.6); color: #fff; }
	.comfort-head h2 { margin: 0; font-size: var(--text-xl); font-weight: 600; line-height: 1.2; letter-spacing: -0.02em; }
	.comfort-head p { margin: 4px 0 0; font-size: var(--text-sm); color: rgb(255 255 255 / 0.7); }
	.comfort-finder ul { display: grid; margin: 0; padding: 0; list-style: none; }
	.comfort-finder li + li { border-top: 1px solid rgb(255 255 255 / 0.12); }
	.comfort-finder a { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto 16px; align-items: center; gap: 12px; min-height: 60px; padding: 8px 4px; color: #fff; text-decoration: none; }
	.comfort-finder a i { width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 0 3px rgb(255 255 255 / 0.12); }
	.comfort-name { display: grid; min-width: 0; }
	.comfort-name strong { font-size: var(--text-base); font-weight: 600; }
	.comfort-name small { overflow: hidden; color: rgb(255 255 255 / 0.66); font-size: var(--text-xs); text-overflow: ellipsis; white-space: nowrap; }
	.comfort-count { min-width: 28px; color: var(--sun); font-size: var(--text-sm); font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; }
	.comfort-finder a :global(svg) { width: 16px; height: 16px; color: rgb(255 255 255 / 0.7); transition: translate 0.2s ease, color 0.2s ease; }
	.comfort-finder a:hover :global(svg) { translate: 3px 0; color: #fff; }
	.comfort-finder a:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; border-radius: 6px; }
	@media (prefers-reduced-motion: reduce) { .comfort-finder a :global(svg) { transition: none; } }
</style>
