<script lang="ts">
	import { PHOTO } from '$lib/media-photos';
	import { tick } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { ArrowRight, Search, SlidersHorizontal, X } from '@lucide/svelte';
	import PageHero from '$lib/components/page-hero.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import Enquiry from '$lib/components/home/enquiry.svelte';
	import TourCard from '$lib/components/tours/tour-card.svelte';
	import TourFilterPanel from '$lib/components/tours/tour-filter-panel.svelte';
	import FaqList from '$lib/components/faq/faq-list.svelte';
	import SavedTours from '$lib/components/tours/saved-tours.svelte';
	import TourCompare from '$lib/components/tours/tour-compare.svelte';
	import TourTailor from '$lib/components/tours/tour-tailor.svelte';
	import TourPlaces from '$lib/components/tours/tour-places.svelte';
	import HomeReviews from '$lib/components/home/home-reviews.svelte';
	import { siteInfo } from '$lib/site-info';
	import { planHref } from '$lib/planner/plan-href';
	import { tourPhotos } from '$lib/home-content';
	import { destinationFallbackPhoto } from '$lib/destination-content';
	import { activeChips, ageChoices, clearedQuery, facetGroups, filterTours, isFiltered, reviewsFirst, routePlaces, SORTS, tourFacts, tourQueryParams, toggleOption, type FilterChip, type SortKey, type TourQuery } from '$lib/tour-filter';
	import type { Destination, HomepageSection } from '$lib/types/api';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let interest = $state('');
	const chooseInterest = (name: string) => { interest = name; };
	let enquiry = $derived(data.sections.find((section) => section.section_key === 'enquiry' && section.is_active !== false));
	let onPage = $derived(['tour-results', ...(enquiry ? ['request-quote'] : [])]);

	// The query lives here and in the URL. It resets when a link brings a new
	// one (a menu's safari style, a destination page); picking options only
	// rewrites the URL, so nothing is fetched again.
	const STEP = 12;
	let query = $derived(data.query);
	let searchText = $derived(data.query.search);
	let facts = $derived(data.tours.map(tourFacts));
	let results = $derived(filterTours(facts, query));
	let groups = $derived(facetGroups(facts, query, { categories: data.categories, destinations: data.destinations }));
	let ages = $derived(ageChoices(facts, query));
	let chips = $derived(activeChips(query, groups));
	let filtered = $derived(isFiltered(query));
	let panelCount = $derived(chips.filter((chip) => chip.facet !== 'search').length);
	let limit = $derived.by(() => { void query; return STEP; });
	let shown = $derived(results.slice(0, limit));
	// Photos are chosen over the whole catalogue, so a tour keeps its photo whatever the filter.
	let photoById = $derived(new Map(tourPhotos(data.tours).map((photo, i) => [data.tours[i].id, photo])));
	let sheetOpen = $state(false);
	let resultsTop = $state<HTMLElement>();
	const plural = (count: number) => `${count} ${count === 1 ? 'safari' : 'safaris'}`;
	let heading = $derived(data.toursUnavailable ? 'Safari tours' : filtered ? `${results.length} of ${plural(facts.length)}` : plural(facts.length));
	let faqStyleName = $derived(data.categories.find((item) => item.id === data.faqStyleId)?.name ?? '');
	let showFaqs = $derived(data.faqs.length > 0 && query.styles.length === 1 && query.styles[0] === data.faqStyleId);

	// Under the list, everything follows the safaris on show.
	// Places with a photo lead; one without drops out once three others have one.
	// Thumbnails for the filter rows: a place's own photo, and a style's first safari.
	let filterPhotos = $derived.by(() => {
		const photos: Record<string, string> = {};
		for (const place of data.destinations) {
			const photo = place.main_image_url_thumbnail || place.image_url_thumbnail || place.main_image_url || place.image_url || place.banner_image_url || destinationFallbackPhoto(place);
			if (photo) photos[place.id] = photo;
		}
		for (const tour of data.tours) if (tour.category_id && !photos[tour.category_id] && photoById.get(tour.id)) photos[tour.category_id] = photoById.get(tour.id)!;
		return photos;
	});
	const hasPhoto = (place: Destination) => Boolean(place.main_image_url_thumbnail || place.image_url_thumbnail || place.main_image_url || place.image_url || place.banner_image_url || destinationFallbackPhoto(place));
	let placeCards = $derived.by(() => {
		const all = routePlaces(results)
			.map((place) => ({ destination: data.destinations.find((item) => item.id === place.id), count: place.count }))
			.filter((item): item is { destination: Destination; count: number } => Boolean(item.destination));
		const pictured = all.filter((item) => hasPhoto(item.destination));
		return (pictured.length >= 3 ? pictured : [...pictured, ...all.filter((item) => !hasPhoto(item.destination))]).slice(0, 8);
	});
	let picked = $derived(chips.map((chip) => chip.label));
	// The planner opens on the chosen place and style, or on the one safari left.
	let planLink = $derived(planHref({
		tour: results.length === 1 ? results[0].tour.slug : null,
		destination: data.destinations.find((item) => item.id === query.places[0])?.slug,
		category: data.categories.find((item) => item.id === query.styles[0])?.slug,
		from: 'tours_results'
	}));
	let reviewSection = $derived(data.sections.find((section) => section.section_key === 'reviews_section' && section.is_active !== false) ?? ({ section_key: 'reviews_section', title: 'Reviews from real people' } as HomepageSection));
	let orderedReviews = $derived(reviewsFirst(data.reviews, new Set(results.map((item) => item.tour.id))).slice(0, 24));
	let faqList = $derived(showFaqs ? data.faqs : data.generalFaqs);
	const showSafaris = (id: string) => update({ ...query, places: query.places.includes(id) ? query.places : [...query.places, id] });

	async function update(next: TourQuery) {
		query = next;
		await tick();
		// Keep the start of the list in view when it shrinks under the reader.
		if (!sheetOpen && resultsTop && resultsTop.getBoundingClientRect().top < 0) {
			resultsTop.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
		}
	}

	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	const cleanSearch = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, 150);
	function typeSearch(value: string) {
		searchText = value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => { if (cleanSearch(value) !== query.search) update({ ...query, search: cleanSearch(value) }); }, 220);
	}
	function submitSearch(event: SubmitEvent) {
		event.preventDefault();
		clearTimeout(searchTimer);
		update({ ...query, search: cleanSearch(searchText) });
	}
	function removeChip(chip: FilterChip) {
		if (chip.facet === 'search') { searchText = ''; update({ ...query, search: '' }); }
		else if (chip.facet === 'age') update({ ...query, age: null });
		else update(toggleOption(query, chip.facet, chip.value));
	}
	function clearAll() {
		clearTimeout(searchTimer);
		searchText = '';
		update(clearedQuery(query));
	}

	// The URL follows the query, so a filtered list can be shared or reloaded.
	$effect(() => {
		const search = tourQueryParams(query).toString();
		const href = `/tours${search ? `?${search}` : ''}`;
		// The address bar, not page.url: shallow replaceState doesn't move page.url,
		// so clearing back to plain /tours would otherwise look like no change.
		if (typeof location === 'undefined' || href === `${location.pathname}${location.search}`) return;
		try { replaceState(`${href}${location.hash}`, page.state); } catch { /* router not ready on the first frame */ }
	});

	const description = 'Browse our published Tanzania safari itineraries by place, length, price and safari style, then make one your own with our local team.';
	let pageTitle = $derived(`Safari tours & itineraries | ${siteInfo.company}`);
	let canonical = $derived(`${data.siteOrigin}/tours`);
	let structuredData = $derived(JSON.stringify({
		'@context': 'https://schema.org',
		'@graph': [
			{ '@type': 'BreadcrumbList', itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Home', item: `${data.siteOrigin}/` },
				{ '@type': 'ListItem', position: 2, name: 'Tours', item: `${data.siteOrigin}/tours` }
			] },
			...(results.length ? [{ '@type': 'ItemList', itemListElement: results.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.tour.title, url: `${data.siteOrigin}/tours/${encodeURIComponent(item.tour.slug)}` })) }] : [])
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
	<meta property="og:image" content={`${data.siteOrigin}/images/related-wildebeest.jpg`} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={`${data.siteOrigin}/images/related-wildebeest.jpg`} />
	<meta name="theme-color" content="#36312b" />
	<link rel="canonical" href={canonical} />
	{@html `<script type="application/ld+json">${structuredData}</script>`}
</svelte:head>
<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-sun focus:p-4">Skip to content</a>
<SiteHeader visible={data.visible} activities={data.activities} destinations={data.destinations} onInterest={chooseInterest} tours={data.navTours} categories={data.categories} stays={data.navStays} {onPage} />
<main id="main">
	<PageHero compact titleId="tours-title" image={PHOTO.wildebeest} imageAlt="Wildebeest herds grazing on the Serengeti plains" crumbs={[{ label: 'Home', href: '/' }, { label: 'Tours' }]} title="Safari tours & itineraries" intro="Day-by-day journeys through Tanzania’s parks and coast, each ready to shape around your dates, pace and comfort.">
		{#snippet actions()}
			{#if enquiry}<Button variant="safari" href={planHref({ from: 'tours_hero' })} data-cta="plan_my_trip" data-cta-location="tours_hero">Plan my safari <ArrowRight class="size-4" /></Button>{/if}
		{/snippet}
	</PageHero>

	<section id="tour-results" class="results" aria-labelledby="tour-results-title">
		<div class="page-container layout">
			<aside class="rail" aria-label="Filter safaris">
				<div class="rail-head">
					<p class="rail-title">Filter safaris</p>
					{#if filtered}<button type="button" class="text-button" onclick={clearAll}>Clear all</button>{/if}
				</div>
				<TourFilterPanel idPrefix="rail" {groups} {ages} {query} photos={filterPhotos} onchange={update} />
			</aside>

			<div class="list" bind:this={resultsTop}>
				<div class="toolbar">
					<form class="search" role="search" method="GET" action="/tours" onsubmit={submitSearch}>
						<Search class="search-icon" aria-hidden="true" />
						<label for="tour-search" class="sr-only">Search safaris</label>
						<input id="tour-search" name="search" type="search" value={searchText} oninput={(event) => typeSearch(event.currentTarget.value)} maxlength={150} autocomplete="off" enterkeyhint="search" placeholder="Search a park, animal or experience" />
						{#if searchText}<button type="button" class="clear" aria-label="Clear search" onclick={() => removeChip({ facet: 'search', value: '', label: '' })}><X class="size-4" /></button>{/if}
					</form>
					<button type="button" class="filters-button" aria-haspopup="dialog" onclick={() => (sheetOpen = true)}>
						<SlidersHorizontal class="size-4" aria-hidden="true" />Filters{#if panelCount}<span class="badge" aria-label={`${panelCount} chosen`}>{panelCount}</span>{/if}
					</button>
					<div class="sort">
						<label for="tour-sort" class="sr-only">Sort safaris</label>
						<select id="tour-sort" value={query.sort} onchange={(event) => update({ ...query, sort: event.currentTarget.value as SortKey })}>
							{#each SORTS as item (item.key)}<option value={item.key}>{item.label}</option>{/each}
						</select>
					</div>
				</div>

				<div class="summary">
					<h2 id="tour-results-title" class="count">{heading}</h2>
					{#if chips.length}
						<ul class="chips" aria-label="Chosen filters">
							{#each chips as chip (`${chip.facet}:${chip.value}`)}
								<li><button type="button" onclick={() => removeChip(chip)} aria-label={`Remove filter: ${chip.label}`}>{chip.label}<X class="size-3.5" aria-hidden="true" /></button></li>
							{/each}
							<li><button type="button" class="text-button" onclick={clearAll}>Clear all</button></li>
						</ul>
					{/if}
				</div>
				<p class="sr-only" aria-live="polite">{data.toursUnavailable ? '' : `${plural(results.length)} shown`}</p>

				<SavedTours />
				<div class="grid">
					{#each shown as item (item.tour.id)}
						<TourCard tour={item.tour} photo={photoById.get(item.tour.id)} />
					{:else}
						<div class="empty">
							<img src={PHOTO.balloonsDawn} alt="Hot air balloons drifting over the Serengeti at sunrise" loading="lazy" />
							<div class="empty-copy">
								<h3>{data.toursUnavailable ? 'Your safari starts with a conversation' : filtered ? 'No safari matches all of that yet' : 'New itineraries are on their way'}</h3>
								<p>{data.toursUnavailable ? 'We can’t display our published itineraries right now. Share the places and experiences on your wish list, and let’s plan a personal Tanzania journey.' : filtered ? 'Remove a filter above, or tell us what you have in mind and we’ll build the trip around it.' : 'Tell us the places and experiences on your wish list, and we’ll plan a Tanzania journey around them.'}</p>
								<div class="empty-actions">
									{#if enquiry && (data.toursUnavailable || !filtered)}<Button variant="safari" href={planHref({ from: 'tours' })} data-cta="plan_my_trip" data-cta-location="tours" class="h-12 px-6">Create my safari <ArrowRight class="size-4" /></Button>{/if}
									{#if filtered}<Button variant="outline" onclick={clearAll} class="h-12 px-6">Clear filters</Button>{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
				{#if results.length > limit}
					<div class="more">
						<Button variant="outline" onclick={() => (limit += STEP)} class="h-12 px-6">Show {Math.min(STEP, results.length - limit)} more</Button>
						<p>{limit} of {results.length} shown</p>
					</div>
				{/if}
				{#if results.length >= 2}<TourCompare {results} />{/if}
				{#if enquiry && facts.length}<TourTailor {picked} count={results.length} {planLink} />{/if}
			</div>
		</div>
	</section>

	<Sheet.Root bind:open={sheetOpen}>
		<Sheet.Content side="bottom" class="max-h-[88svh] gap-0 rounded-t-[14px] p-0">
			<Sheet.Header class="border-b border-border px-5 pt-5 pb-4">
				<Sheet.Title class="text-lg font-semibold text-navy">Filter safaris</Sheet.Title>
			</Sheet.Header>
			<div class="overflow-y-auto overscroll-contain px-5 pt-2 pb-4">
				<TourFilterPanel idPrefix="sheet" {groups} {ages} {query} photos={filterPhotos} onchange={update} />
			</div>
			<div class="flex gap-3 border-t border-border px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
				<Button variant="outline" onclick={clearAll} disabled={!filtered} class="h-12 flex-1">Clear all</Button>
				<Button variant="safari" onclick={() => (sheetOpen = false)} class="h-12 flex-[2]">Show {plural(results.length)}</Button>
			</div>
		</Sheet.Content>
	</Sheet.Root>

	{#if placeCards.length >= 2}<TourPlaces places={placeCards} {filtered} total={results.length} onShow={showSafaris} />{/if}
	<HomeReviews section={reviewSection} reviews={orderedReviews} reviewTotal={data.reviewTotal} reviewAverage={data.reviewAverage} />
	{#if faqList.length}
		<section id="style-faqs" class="page-container py-14 md:py-18">
			<FaqList faqs={faqList} title={showFaqs && faqStyleName ? `Questions about ${faqStyleName}` : 'Questions travellers ask'} intro="Quick answers to help you choose the right safari." />
		</section>
	{/if}
	{#if enquiry}<Enquiry section={enquiry} {form} {interest} />{/if}
</main>
<SiteFooter visible={data.visible} destinations={data.destinations} onInterest={chooseInterest} {onPage} />

<style>
	.results { background: color-mix(in oklch, var(--secondary) 45%, white); padding-block: 28px 56px; }
	.layout { display: grid; gap: 20px; }
	.rail { display: none; }
	.list { min-width: 0; scroll-margin-top: 88px; }

	.toolbar { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
	.search { position: relative; grid-column: 1 / -1; }
	.search :global(.search-icon) { position: absolute; top: 50%; left: 14px; width: 18px; height: 18px; translate: 0 -50%; color: var(--muted-foreground); pointer-events: none; }
	.search input { width: 100%; height: 48px; padding: 0 44px; border: 1px solid var(--border); border-radius: var(--radius-control); background: #fff; color: var(--navy); font-size: var(--text-base); }
	.search input::placeholder { color: color-mix(in oklch, var(--muted-foreground) 80%, white); }
	.search input::-webkit-search-cancel-button { display: none; }
	.search input:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }
	.clear { position: absolute; top: 50%; right: 6px; display: grid; place-items: center; width: 36px; height: 36px; translate: 0 -50%; border-radius: var(--radius-control); color: var(--muted-foreground); }
	.clear:hover { background: var(--secondary); color: var(--navy); }
	.filters-button, .sort select { height: 46px; border: 1px solid var(--border); border-radius: var(--radius-control); background: #fff; color: var(--navy); font-size: var(--text-sm); font-weight: 600; }
	.filters-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
	.filters-button:focus-visible, .sort select:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }
	.badge { display: grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 5px; background: var(--navy); color: #fff; font-size: var(--text-xs); font-variant-numeric: tabular-nums; }
	.sort select { width: 100%; padding: 0 36px 0 14px; appearance: none; cursor: pointer; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237a7268' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") right 12px center / 16px no-repeat; }

	.summary { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; margin-top: 22px; }
	.count { margin: 0; color: var(--navy); font-size: var(--text-2xl); line-height: 1.2; }
	.chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0; padding: 0; list-style: none; }
	.chips button:not(.text-button) { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; min-height: 36px; padding: 0 10px 0 12px; border: 1px solid var(--border); border-radius: var(--radius-control); background: #fff; color: var(--navy); font-size: var(--text-sm); font-weight: 500; transition: border-color 150ms ease-out; }
	.chips button:not(.text-button):hover { border-color: color-mix(in oklch, var(--navy) 35%, transparent); }
	.chips button :global(svg) { color: var(--muted-foreground); }
	.text-button { min-height: 36px; color: var(--navy); font-size: var(--text-sm); font-weight: 600; }
	.text-button:hover { color: color-mix(in oklch, var(--navy) 70%, transparent); }

	.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 272px), 1fr)); gap: 20px; margin-top: 20px; }
	.empty { grid-column: 1 / -1; display: grid; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-surface); background: #fff; }
	.empty img { width: 100%; height: 200px; object-fit: cover; }
	.empty-copy { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: 24px; }
	.empty h3 { margin: 0; max-width: 28ch; color: var(--navy); font-size: var(--text-2xl); font-weight: 600; line-height: 1.2; letter-spacing: -0.02em; }
	.empty p { margin: 12px 0 0; max-width: 46ch; color: var(--muted-foreground); font-size: var(--text-base); line-height: 1.7; }
	.empty-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 22px; }
	.more { display: grid; justify-items: center; gap: 10px; margin-top: 32px; }
	.more p { margin: 0; color: var(--muted-foreground); font-size: var(--text-sm); }

	@media (min-width: 640px) {
		.toolbar { grid-template-columns: minmax(0, 1fr) auto auto; }
		.search { grid-column: auto; }
		.filters-button { padding: 0 16px; }
		.sort select { width: auto; }
		.empty { grid-template-columns: 1fr 1fr; }
		.empty img { height: 100%; min-height: 280px; }
		.empty-copy { padding: 36px; }
	}
	@media (min-width: 1024px) {
		.results { padding-block: 40px 72px; }
		.layout { grid-template-columns: 264px minmax(0, 1fr); gap: 36px; align-items: start; }
		.rail { position: sticky; top: 104px; display: block; max-height: calc(100svh - 124px); overflow-y: auto; overscroll-behavior: contain; padding: 4px 20px 4px; border: 1px solid oklch(0.9 0.01 80); border-radius: var(--radius-surface); background: #fff; scrollbar-width: thin; scrollbar-color: oklch(0.86 0.02 80) transparent; }
		.rail-head { position: sticky; top: -4px; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 56px; margin: -4px -20px 12px; padding: 4px 20px 0; border-bottom: 1px solid oklch(0.91 0.01 80); background: #fff; }
		.rail-title { margin: 0; color: var(--navy); font-size: var(--text-lg); font-weight: 600; }
		.filters-button { display: none; }
		.toolbar { grid-template-columns: minmax(0, 1fr) auto; }
	}
	@media (prefers-reduced-motion: reduce) { .chips button { transition: none; } }
</style>
