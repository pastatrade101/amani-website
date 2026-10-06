<script lang="ts">
	import { ArrowRight, BedDouble, MapPin, Route } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import Enquiry from '$lib/components/home/enquiry.svelte';
	import RichText from '$lib/components/tours/rich-text.svelte';
	import TourCard from '$lib/components/tours/tour-card.svelte';
	import TourSectionNav from '$lib/components/tours/tour-section-nav.svelte';
	import StayCard from '$lib/components/stays/stay-card.svelte';
	import StayAmenities from '$lib/components/stays/detail/stay-amenities.svelte';
	import StayGlance from '$lib/components/stays/detail/stay-glance.svelte';
	import StayHero from '$lib/components/stays/detail/stay-hero.svelte';
	import StayHighlights from '$lib/components/stays/detail/stay-highlights.svelte';
	import StayLightbox from '$lib/components/stays/detail/stay-lightbox.svelte';
	import StayPhotoMosaic from '$lib/components/stays/detail/stay-photo-mosaic.svelte';
	import StayPlanCard from '$lib/components/stays/detail/stay-plan-card.svelte';
	import StayWhy from '$lib/components/stays/detail/stay-why.svelte';
	import { bestForIcon, STYLE_ICONS } from '$lib/components/stays/stay-icons';
	import { toEastAfricaCountry } from '$lib/countries';
	import { shortPlaceName, textContent, tourPhotos } from '$lib/home-content';
	import { siteInfo } from '$lib/site-info';
	import { bestForLabels, overnightNote, stayGallery, staysHref, stayStyle, stayTypeLabel, styleLabel, tourCategories, whyPhotoIndex, type StayGalleryPhoto } from '$lib/stay-content';
	import { staySeo } from '$lib/stay-seo';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let stay = $derived(data.stay);
	let chrome = $derived(data.chrome);

	let interest = $state('');
	const chooseInterest = (name: string) => { interest = name; };
	const enquireAboutStay = () => chooseInterest(`Stay at ${stay.name}`);
	// The enquiry is about this stay unless the visitor picked something else (or already typed their own).
	let enquiryInterest = $derived(interest || (form?.values?.interest ? '' : `Stay at ${stay.name}`));
	let enquirySection = $derived(chrome.sections.find((section) => section.section_key === 'enquiry' && section.is_active !== false));
	let canEnquire = $derived(Boolean(enquirySection));

	// The API's destination; older payloads only have the list join. An explicit
	// null means the destination is not published, so nothing links to it.
	let place = $derived(stay.destination !== undefined ? stay.destination : stay.destination_id && stay.destinations?.name ? { id: stay.destination_id, name: stay.destinations.name, slug: stay.destinations.slug } : null);
	// The full destination (with its own photo) from the menus, for the honest photo fallback.
	let placeDetails = $derived(place ? (chrome.destinations.find((item) => item.id === place.id) ?? null) : null);
	let placeShort = $derived(place ? shortPlaceName(place.name) : '');
	let style = $derived(stayStyle(stay));
	let StyleIcon = $derived(STYLE_ICONS[style]);
	let type = $derived(stayTypeLabel(stay.lodge_type));
	let photos = $derived(stayGallery(stay));
	let country = $derived(toEastAfricaCountry(stay.country) ?? '');

	let lead = $derived(textContent(stay.short_description));
	// Skip the short description when the full one already contains it (often under its own heading).
	let showLead = $derived(Boolean(lead) && !textContent(stay.description).includes(lead.slice(0, 80)));
	let hasStory = $derived(Boolean(textContent(stay.description)));
	// A drop cap only suits a real opening paragraph, not a one-line or bold mini-heading.
	let dropCap = $derived.by(() => {
		const first = /^\s*<p[^>]*>([\s\S]*?)<\/p>/i.exec(stay.description ?? '')?.[1] ?? '';
		return !/^\s*<(strong|b)\b/i.test(first) && textContent(first).length > 160;
	});
	let why = $derived(textContent(stay.why_we_recommend) ? (stay.why_we_recommend ?? '') : '');
	let whyIndex = $derived(whyPhotoIndex(photos));
	let perfectFor = $derived(
		(stay.best_for ?? [])
			.map((code) => ({ code, label: bestForLabels([code])[0] ?? '' }))
			.filter((item, index, all) => item.label && all.findIndex((other) => other.label === item.label) === index)
	);
	let highlights = $derived([...(stay.highlights ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((item) => textContent(item.title)).filter(Boolean));
	let amenities = $derived([...(stay.amenities ?? [])].filter((item) => item.name?.trim()).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
	let tours = $derived(stay.featured_in_tours ?? []);
	let tourImages = $derived(tourPhotos(tours));
	let categories = $derived(tourCategories(tours));
	let nearby = $derived((stay.nearby_stays ?? []).filter((other) => other.id !== stay.id).slice(0, 3));
	// The stay's destination first, then the others it is linked to, once each.
	let areas = $derived(
		[...(place ? [place] : []), ...(stay.related_destinations ?? [])]
			.filter((area, index, all) => area.id && area.name && all.findIndex((other) => other.id === area.id) === index)
			.slice(0, 4)
	);

	// One photo viewer for the page; it opens on whichever list was clicked (all, or a filtered set).
	let viewerOpen = $state(false);
	let viewerIndex = $state(0);
	let viewerPhotos = $state.raw<StayGalleryPhoto[]>([]);
	let viewerOpener = $state.raw<HTMLElement | null>(null);
	function openPhotos(list: StayGalleryPhoto[], index: number, opener: HTMLElement) {
		viewerPhotos = list;
		viewerIndex = index;
		viewerOpener = opener;
		viewerOpen = true;
	}

	let seo = $derived(staySeo(stay, data.siteOrigin));
	let sections = $derived([
		{ id: 'overview', label: 'Overview' },
		...(highlights.length >= 3 ? [{ id: 'highlights', label: 'Highlights' }] : []),
		...(photos.length >= 3 ? [{ id: 'photos', label: 'Photos' }] : []),
		...(amenities.length ? [{ id: 'amenities', label: 'Amenities' }] : []),
		...(tours.length ? [{ id: 'safaris', label: 'Safaris' }] : []),
		...(nearby.length ? [{ id: 'nearby', label: 'Nearby stays' }] : []),
		{ id: 'explore', label: 'Explore' }
	]);
	// Anchors that exist here; the header and footer send every other anchor to the home page.
	let onPage = $derived(['top', ...sections.map((section) => section.id), ...(canEnquire ? ['request-quote'] : [])]);
</script>

<svelte:head>
	<title>{seo.title}</title>
	<meta name="description" content={seo.description} />
	{#if seo.noindex}<meta name="robots" content="noindex" />{/if}
	<meta name="application-name" content={siteInfo.company} />
	<meta property="og:site_name" content={siteInfo.company} />
	<meta property="og:title" content={seo.title} />
	<meta property="og:description" content={seo.description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={seo.canonical} />
	{#if seo.image}<meta property="og:image" content={seo.image} /><meta name="twitter:image" content={seo.image} />{/if}
	<meta name="twitter:card" content={seo.image ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={seo.title} />
	<meta name="twitter:description" content={seo.description} />
	<meta name="theme-color" content="#14314d" />
	<link rel="canonical" href={seo.canonical} />
	{@html `<script type="application/ld+json">${seo.jsonLd}</script>`}
</svelte:head>

<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-sun focus:p-4">Skip to content</a>
<SiteHeader visible={chrome.visible} activities={chrome.activities} destinations={chrome.destinations} onInterest={chooseInterest} tours={chrome.navTours} categories={chrome.categories} stays={data.navStays} {onPage} />
<main id="main">
	<section id="top" aria-labelledby="stay-title">
		<StayHero {stay} {photos} {place} destination={placeDetails} lead={!photos.length && showLead ? lead : ''} {canEnquire} onEnquire={enquireAboutStay} onOpenPhotos={(index, opener) => openPhotos(photos, index, opener)} />
		<div class={`bg-[oklch(.985_.006_85)] pb-10 md:pb-14 ${photos.length ? 'pt-8 md:pt-10' : 'pt-12 md:pt-16'}`}>
			<div class="page-container"><StayGlance {stay} /></div>
		</div>
	</section>
	<TourSectionNav items={sections} {canEnquire} onEnquire={enquireAboutStay} />

	<section id="overview" class="scroll-mt-14 bg-white py-16 md:py-24" aria-labelledby="overview-title">
		<div class="page-container grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-20">
			<div class="min-w-0">
				<div data-motion="reveal">
					<p class="eyebrow text-[var(--gold-ink)]">The stay</p>
					<h2 id="overview-title" class="lux-heading mt-4">About {stay.name}</h2>
				</div>
				{#if photos.length && showLead}<p class="mt-7 max-w-[40ch] font-display text-[22px] leading-[1.45] text-navy/90 sm:text-[26px]">{lead}</p>{/if}
				{#if perfectFor.length}
					<p id="perfect-for" class="mt-8 text-[11px] font-medium uppercase tracking-[.16em] text-muted-foreground">Perfect for</p>
					<ul aria-labelledby="perfect-for" class="mt-3 flex flex-wrap gap-2">
						{#each perfectFor as item (item.label)}
							{@const Icon = bestForIcon(item.code)}
							<li class="inline-flex h-10 items-center gap-2 rounded-full border border-navy/15 bg-[oklch(.985_.006_85)] px-4 text-sm text-navy"><Icon class="size-4 text-[#D9A900]" aria-hidden="true" />{item.label}</li>
						{/each}
					</ul>
				{/if}
				<div class={`story mt-9 ${dropCap ? 'drop-cap' : ''}`}><RichText value={stay.description} /></div>
				{#if !lead && !hasStory && !why}
					<p class="mt-5 max-w-xl text-sm leading-7 text-muted-foreground">We’re still writing this stay’s full story.{canEnquire ? ' Ask us anything about staying here and our team will answer from first-hand knowledge.' : ''}</p>
				{/if}
				{#if highlights.length && highlights.length < 3}
					<h3 class="mt-10 text-[11px] font-medium uppercase tracking-[.16em] text-muted-foreground">Highlights</h3>
					<ul class="mt-4 grid gap-3">
						{#each highlights as highlight, i (i)}
							<li class="flex items-start gap-3 text-[15px] leading-7 text-navy"><span class="mt-[11px] size-1.5 shrink-0 rotate-45 bg-sun" aria-hidden="true"></span>{highlight}</li>
						{/each}
					</ul>
				{/if}
			</div>
			<StayPlanCard {stay} {canEnquire} onEnquire={enquireAboutStay} />
		</div>
	</section>

	{#if why}
		<StayWhy {why} photo={whyIndex >= 0 ? photos[whyIndex] : null} team={siteInfo.brand} onOpen={(opener) => openPhotos(photos, whyIndex, opener)} />
	{/if}

	{#if highlights.length >= 3}<StayHighlights {highlights} />{/if}

	{#if photos.length >= 3}<StayPhotoMosaic {photos} onOpen={openPhotos} />{/if}

	{#if amenities.length}<StayAmenities {amenities} />{/if}

	{#if tours.length}
		<section id="safaris" class="scroll-mt-14 border-t border-navy/10 bg-[oklch(.985_.006_85)] py-16 md:py-24" aria-labelledby="safaris-title">
			<div class="page-container">
				<div data-motion="reveal" class="flex flex-wrap items-end justify-between gap-5">
					<div class="max-w-2xl">
						<p class="eyebrow text-[var(--gold-ink)]">On our safaris</p>
						<h2 id="safaris-title" class="lux-heading mt-4">Safaris that stay here</h2>
						<p class="section-description mt-4">{tours.length === 1 ? 'One of our safaris includes' : `${tours.length} of our safaris include`} {stay.name}. Under each you’ll see the style and day it stays here.</p>
					</div>
					{#if place}<Button href={`/tours?destination_id=${encodeURIComponent(place.id)}#tour-results`} variant="outline" class="h-11 rounded-full px-5">All safaris to {placeShort} <ArrowRight class="size-4" /></Button>{/if}
				</div>
				<ul class="card-grid mt-10">
					{#each tours as tour, i (tour.id)}
						{@const note = overnightNote(tour)}
						<li class="flex flex-col gap-3">
							<div class="flex-1"><TourCard {tour} photo={tourImages[i]} /></div>
							{#if note}<p class="overnight-note"><BedDouble class="size-4 shrink-0" aria-hidden="true" /><span>Overnight here: <strong>{note}</strong></span></p>{/if}
						</li>
					{/each}
				</ul>
			</div>
		</section>
	{/if}

	{#if nearby.length}
		<section id="nearby" class="scroll-mt-14 border-t border-navy/10 bg-white py-16 md:py-24" aria-labelledby="nearby-title">
			<div class="page-container">
				<div data-motion="reveal" class="flex flex-wrap items-end justify-between gap-5">
					<div class="max-w-2xl">
						<p class="eyebrow text-[var(--gold-ink)]">Nearby</p>
						<h2 id="nearby-title" class="lux-heading mt-4">More stays in {place?.name ?? 'the area'}</h2>
					</div>
					{#if place}<Button href={staysHref({}, { destination_id: place.id })} variant="outline" class="h-11 rounded-full px-5">See all stays in {placeShort} <ArrowRight class="size-4" /></Button>{/if}
				</div>
				<div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
					{#each nearby as other (other.id)}
						<StayCard stay={other} destination={placeDetails} />
					{/each}
				</div>
			</div>
		</section>
	{/if}

	<section id="explore" class="scroll-mt-14 border-t border-navy/10 bg-white py-16 md:py-24" aria-labelledby="explore-title">
		<div class="page-container">
			<div data-motion="reveal" class="max-w-2xl">
				<p class="eyebrow text-[var(--gold-ink)]">Keep exploring</p>
				<h2 id="explore-title" class="lux-heading mt-4">{placeShort ? `Around ${placeShort}` : 'More to explore'}</h2>
			</div>
			<div class="mt-10 grid gap-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-14">
				{#if areas.length}
					<div data-motion="card">
						<h3 class="explore-title"><MapPin class="size-4" aria-hidden="true" />{areas.length === 1 ? 'Destination' : 'Destinations'}</h3>
						<ul class="explore-links">
							{#each areas as area (area.id)}
								<li><a href={staysHref({}, { destination_id: area.id })}>Stays in {area.name}<ArrowRight class="size-3.5" aria-hidden="true" /></a></li>
								<li><a href={`/tours?destination_id=${encodeURIComponent(area.id)}#tour-results`}>Safaris to {area.name}<ArrowRight class="size-3.5" aria-hidden="true" /></a></li>
							{/each}
						</ul>
					</div>
				{/if}
				{#if categories.length}
					<div data-motion="card">
						<h3 class="explore-title"><Route class="size-4" aria-hidden="true" />Safari types that stay here</h3>
						<ul class="explore-links">
							{#each categories as category (category.id)}
								<li><a href={`/tours?category_id=${encodeURIComponent(category.id)}#tour-results`}>{category.name}<ArrowRight class="size-3.5" aria-hidden="true" /></a></li>
							{/each}
						</ul>
					</div>
				{/if}
				<div data-motion="card">
					<h3 class="explore-title"><StyleIcon class="size-4" aria-hidden="true" />Stays like this</h3>
					<ul class="explore-links">
						<li><a href={staysHref({}, { style })}>{styleLabel(style)} stays<ArrowRight class="size-3.5" aria-hidden="true" /></a></li>
						{#if type && stay.lodge_type}<li><a href={staysHref({}, { lodge_type: stay.lodge_type })}>{type}s<ArrowRight class="size-3.5" aria-hidden="true" /></a></li>{/if}
						{#if country}<li><a href={staysHref({}, { country })}>All stays in {country}<ArrowRight class="size-3.5" aria-hidden="true" /></a></li>{/if}
						<li><a href="/stays">All lodges &amp; camps<ArrowRight class="size-3.5" aria-hidden="true" /></a></li>
					</ul>
				</div>
			</div>
		</div>
	</section>

	{#if enquirySection}
		<Enquiry section={enquirySection} {form} interest={enquiryInterest} />
	{/if}
</main>
<SiteFooter visible={chrome.visible} destinations={chrome.destinations} onInterest={chooseInterest} {onPage} />

{#if photos.length > 1}
	<StayLightbox photos={viewerPhotos} bind:open={viewerOpen} bind:index={viewerIndex} opener={viewerOpener} title={stay.name} />
{/if}

<style>
	/* The story in long-form type, opening on a drop cap when the first paragraph is a real one. */
	div.story :global(.rich-text) { max-width: 64ch; font-size: 15px; line-height: 1.9; color: color-mix(in oklch, var(--navy) 80%, transparent); }
	div.drop-cap :global(.rich-text > p:first-child::first-letter) { float: left; padding: 0.08em 0.12em 0 0; font-family: var(--font-display); font-size: 4.4em; line-height: 0.8; color: var(--navy); }
	div.story :global(.rich-text h2), div.story :global(.rich-text h3) { margin: 1.6em 0 0.5em; font-family: var(--font-display); font-size: 26px; font-weight: 500; line-height: 1.2; color: var(--navy); }
	div.story :global(.rich-text > :first-child) { margin-top: 0; }
	div.story :global(.rich-text h2 strong), div.story :global(.rich-text h3 strong) { font-weight: 500; }
	.overnight-note { display: flex; align-items: flex-start; gap: 0.55rem; border-radius: 0.75rem; background: white; padding: 0.7rem 0.9rem; color: var(--muted-foreground); font-size: 13px; line-height: 1.5; box-shadow: inset 0 0 0 1px var(--border); }
	.overnight-note :global(svg) { margin-top: 0.1rem; color: #D9A900; }
	.overnight-note strong { color: var(--navy); font-weight: 600; }
	.explore-title { display: flex; align-items: center; gap: 0.5rem; padding-bottom: 0.75rem; font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted-foreground); }
	.explore-title :global(svg) { color: #D9A900; }
	.explore-links { display: grid; border-bottom: 1px solid color-mix(in oklch, var(--navy) 10%, transparent); }
	.explore-links a { display: flex; min-height: 3.25rem; align-items: center; justify-content: space-between; gap: 0.75rem; border-top: 1px solid color-mix(in oklch, var(--navy) 10%, transparent); padding: 0.6rem 0; color: var(--navy); font-size: 15px; line-height: 1.45; }
	.explore-links a :global(svg) { flex-shrink: 0; color: var(--muted-foreground); transition: translate 160ms ease-out; }
	.explore-links a:hover :global(svg) { translate: 3px 0; color: var(--navy); }
	@media (min-width: 768px) { div.story :global(.rich-text) { font-size: 16px; } }
	@media (prefers-reduced-motion: reduce) { .explore-links a :global(svg) { transition: none; } .explore-links a:hover :global(svg) { translate: none; } }
</style>
