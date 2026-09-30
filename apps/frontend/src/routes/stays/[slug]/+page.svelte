<script lang="ts">
	import { ArrowRight, Baby, BedDouble, Check, ChevronRight, Clock, ExternalLink, Globe, HeartHandshake, Images, MapPin, Moon, PlaneLanding, Quote, Route } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import Enquiry from '$lib/components/home/enquiry.svelte';
	import RichText from '$lib/components/tours/rich-text.svelte';
	import TourCard from '$lib/components/tours/tour-card.svelte';
	import TourSectionNav from '$lib/components/tours/tour-section-nav.svelte';
	import StayCard from '$lib/components/stays/stay-card.svelte';
	import StayGalleryHero from '$lib/components/stays/stay-gallery-hero.svelte';
	import { amenityIcon, STYLE_ICONS, stayTypeIcon } from '$lib/components/stays/stay-icons';
	import { toEastAfricaCountry } from '$lib/countries';
	import { shortPlaceName, textContent, tourPhotos } from '$lib/home-content';
	import { SAFARI_STYLE_THEME } from '$lib/safari-pricing';
	import { siteInfo } from '$lib/site-info';
	import { bestForLabels, childrenPolicy, mapUrl, nightlyRate, nightsLabel, overnightNote, placeLine, stayCoordinates, stayGallery, stayLocation, staysHref, stayStyle, stayStyleLabel, stayTypeLabel, styleLabel, tourCategories } from '$lib/stay-content';
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
	let theme = $derived(SAFARI_STYLE_THEME[style]);
	let StyleIcon = $derived(STYLE_ICONS[style]);
	let type = $derived(stayTypeLabel(stay.lodge_type));
	let TypeIcon = $derived(stayTypeIcon(stay.lodge_type));
	let location = $derived(stayLocation(stay));
	let rate = $derived(nightlyRate(stay));
	let photos = $derived(stayGallery(stay));
	let country = $derived(toEastAfricaCountry(stay.country) ?? '');

	let lead = $derived(textContent(stay.short_description));
	// Skip the short description when the full one already opens with it.
	let showLead = $derived(Boolean(lead) && !textContent(stay.description).startsWith(lead.slice(0, 80)));
	let hasStory = $derived(Boolean(textContent(stay.description)));
	let why = $derived(textContent(stay.why_we_recommend) ? stay.why_we_recommend : '');
	let highlights = $derived([...(stay.highlights ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((item) => textContent(item.title)).filter(Boolean));
	let amenities = $derived([...(stay.amenities ?? [])].filter((item) => item.name?.trim()).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
	let tours = $derived(stay.featured_in_tours ?? []);
	let tourImages = $derived(tourPhotos(tours));
	let categories = $derived(tourCategories(tours));
	let nearby = $derived((stay.nearby_stays ?? []).filter((other) => other.id !== stay.id).slice(0, 3));
	let coordinates = $derived(stayCoordinates(stay));
	// The stay's destination first, then the others it is linked to, once each.
	let areas = $derived(
		[...(place ? [place] : []), ...(stay.related_destinations ?? [])]
			.filter((area, index, all) => area.id && area.name && all.findIndex((other) => other.id === area.id) === index)
			.slice(0, 4)
	);

	let facts = $derived(
		[
			{ icon: StyleIcon, label: 'Style', value: stayStyleLabel(stay), href: staysHref({}, { style }) },
			{ icon: MapPin, label: 'Location', value: placeLine([stay.park_area, place?.name, stay.region]), href: '' },
			{ icon: Globe, label: 'Country', value: stay.country?.trim() ?? '', href: country ? staysHref({}, { country }) : '' },
			{ icon: PlaneLanding, label: 'Nearest airport or airstrip', value: [stay.nearest_airport?.trim(), stay.distance_airstrip?.trim()].filter(Boolean).join(' · '), href: '' },
			{ icon: Clock, label: 'Transfer time', value: stay.transfer_time?.trim() ?? '', href: '' },
			{ icon: Moon, label: 'Recommended stay', value: nightsLabel(stay.recommended_nights), href: '' },
			{ icon: Baby, label: 'Children', value: childrenPolicy(stay), href: '' },
			{ icon: HeartHandshake, label: 'Best for', value: bestForLabels(stay.best_for).join(', '), href: '' }
		].filter((fact) => fact.value)
	);

	let seo = $derived(staySeo(stay, data.siteOrigin));
	let sections = $derived([
		{ id: 'overview', label: 'Overview' },
		...(amenities.length ? [{ id: 'amenities', label: 'Amenities' }] : []),
		...(photos.length > 5 ? [{ id: 'photos', label: 'Photos' }] : []),
		...(tours.length ? [{ id: 'safaris', label: 'Safaris' }] : []),
		{ id: 'explore', label: 'Explore' },
		...(nearby.length ? [{ id: 'nearby', label: 'Nearby stays' }] : [])
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
	<section id="top" class="bg-[oklch(.985_.006_85)] pt-5 pb-10 md:pt-7 md:pb-14" aria-labelledby="stay-title">
		<div class="page-container">
			<nav aria-label="Breadcrumb" class="text-xs text-muted-foreground">
				<ol class="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
					<li><a href="/" class="underline-offset-4 hover:text-navy hover:underline">Home</a></li>
					<li aria-hidden="true"><ChevronRight class="size-3" /></li>
					<li><a href="/stays" class="underline-offset-4 hover:text-navy hover:underline">Stays</a></li>
					{#if place}
						<li aria-hidden="true"><ChevronRight class="size-3" /></li>
						<li><a href={staysHref({}, { destination_id: place.id })} class="underline-offset-4 hover:text-navy hover:underline">{place.name}</a></li>
					{/if}
					<li aria-hidden="true"><ChevronRight class="size-3" /></li>
					<li aria-current="page" class="min-w-0 truncate font-medium text-navy">{stay.name}</li>
				</ol>
			</nav>
			<div class="mt-6 grid gap-6 md:mt-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-10">
				<div class="min-w-0 max-w-3xl">
					<ul data-motion="hero" class="flex flex-wrap items-center gap-2" aria-label="Style and type">
						<li><span class="style-badge" style={`--style-color:${theme.primary};--style-ink:${theme.priceColor};--style-text:${theme.activeText ?? 'var(--navy)'};--style-light:${theme.light}`}><StyleIcon class="size-3.5" aria-hidden="true" />{stayStyleLabel(stay)}</span></li>
						{#if type}<li><span class="type-badge"><TypeIcon class="size-3.5" aria-hidden="true" />{type}</span></li>{/if}
						{#if stay.is_featured}<li><span class="type-badge featured">Featured</span></li>{/if}
					</ul>
					<h1 id="stay-title" data-motion="hero" data-motion-delay="0.05" class="mt-4 text-[34px] leading-[1.08] font-semibold tracking-[-.045em] text-balance text-navy sm:text-5xl lg:text-[58px]">{stay.name}</h1>
					{#if location}<p data-motion="hero" data-motion-delay="0.1" class="mt-4 flex items-start gap-2 text-sm text-muted-foreground md:text-base"><MapPin class="mt-0.5 size-4 shrink-0 text-[#D9A900]" aria-hidden="true" />{location}</p>{/if}
				</div>
				{#if rate || canEnquire}
					<div data-motion="hero" data-motion-delay="0.15" class="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
						{#if rate}<p class="text-base font-bold text-navy md:text-lg">{rate}</p>{/if}
						{#if canEnquire}<Button variant="safari" href="#request-quote" onclick={enquireAboutStay} class="h-12 rounded-lg px-6 text-sm">Enquire about this stay <ArrowRight class="size-4" /></Button>{/if}
					</div>
				{/if}
			</div>
			<div class="mt-7 md:mt-9">
				<StayGalleryHero {stay} {photos} destination={placeDetails} allPhotosHref="#photos" />
			</div>
		</div>
	</section>
	<TourSectionNav items={sections} {canEnquire} onEnquire={enquireAboutStay} />

	<section id="overview" class="stay-section page-container py-14 md:py-20">
		<div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
			<div class="min-w-0">
				<div data-motion="reveal">
					<p class="eyebrow text-muted-foreground">Overview</p>
					<div class="gold-line mt-4"></div>
					<h2 class="section-heading mt-5">About {stay.name}</h2>
				</div>
				{#if showLead}<p class="mt-5 text-base leading-8 text-primary/85 md:text-lg md:leading-9">{lead}</p>{/if}
				<RichText value={stay.description} class="mt-5" />
				{#if !lead && !hasStory && !why}
					<p class="mt-5 max-w-xl text-sm leading-7 text-muted-foreground">We’re still writing this stay’s full story.{canEnquire ? ' Ask us anything about staying here and our team will answer from first-hand knowledge.' : ''}</p>
				{/if}
				{#if why}
					<figure data-motion="reveal" class="why">
						<figcaption class="eyebrow text-muted-foreground">Why we recommend it</figcaption>
						<Quote class="why-mark" aria-hidden="true" />
						<blockquote class="mt-4"><RichText value={why} /></blockquote>
					</figure>
				{/if}
				{#if highlights.length}
					<h3 class="mt-10 text-lg font-bold text-primary">Highlights</h3>
					<ul class="mt-4 grid gap-3 sm:grid-cols-2">
						{#each highlights as highlight}
							<li class="flex gap-3 text-sm leading-6 text-primary/85"><span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-sun/30 text-primary"><Check class="size-3" aria-hidden="true" /></span>{highlight}</li>
						{/each}
					</ul>
				{/if}
			</div>
			<aside aria-labelledby="key-facts" class="h-fit rounded-2xl border border-border bg-secondary/40 p-6 md:p-7 lg:sticky lg:top-[calc(var(--site-header-height)+5rem)]">
				<h3 id="key-facts" class="text-lg font-bold text-primary">Key facts</h3>
				<dl class="mt-5 grid gap-4">
					{#each facts as fact (fact.label)}
						<div class="flex gap-3">
							<span class="grid size-9 shrink-0 place-items-center rounded-full bg-white text-primary"><fact.icon class="size-4" aria-hidden="true" /></span>
							<div class="min-w-0">
								<dt class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{fact.label}</dt>
								<dd class="mt-0.5 text-sm font-semibold text-primary">{#if fact.href}<a href={fact.href} class="underline decoration-border decoration-2 underline-offset-4 hover:decoration-sun">{fact.value}</a>{:else}{fact.value}{/if}</dd>
							</div>
						</div>
					{/each}
				</dl>
				{#if coordinates}
					<a href={mapUrl(coordinates)} target="_blank" rel="noopener noreferrer" class="map-link"><MapPin class="size-4" aria-hidden="true" />View on the map<ExternalLink class="ml-auto size-3.5" aria-hidden="true" /><span class="sr-only"> (opens Google Maps in a new tab)</span></a>
				{/if}
				{#if rate}<p class="mt-5 border-t border-border pt-5 text-sm font-bold text-navy">{rate}</p>{/if}
				{#if canEnquire}<Button variant="safari" href="#request-quote" onclick={enquireAboutStay} class="mt-5 h-11 w-full rounded-lg text-sm">Enquire about this stay <ArrowRight class="size-4" /></Button>{/if}
			</aside>
		</div>
	</section>

	{#if amenities.length}
		<section id="amenities" class="stay-section border-t border-border py-14 md:py-20">
			<div class="page-container">
				<div data-motion="reveal" class="max-w-2xl">
					<p class="eyebrow text-muted-foreground">Amenities</p>
					<h2 class="section-heading mt-3">What you’ll find here</h2>
				</div>
				<ul class="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
					{#each amenities as amenity (amenity.id)}
						{@const Icon = amenityIcon(amenity.icon_key)}
						<li class="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-white p-3 text-[13px] leading-5 font-medium text-navy sm:p-3.5 sm:text-sm"><span class="grid size-9 shrink-0 place-items-center rounded-full bg-secondary"><Icon class="size-4" aria-hidden="true" /></span><span class="min-w-0 break-words">{amenity.name}</span></li>
					{/each}
				</ul>
			</div>
		</section>
	{/if}

	{#if photos.length > 5}
		<section id="photos" class="stay-section border-t border-border py-14 md:py-20">
			<div class="page-container">
				<div data-motion="reveal" class="flex flex-wrap items-end justify-between gap-4">
					<div class="max-w-2xl">
						<p class="eyebrow text-muted-foreground">Gallery</p>
						<h2 class="section-heading mt-3">A closer look</h2>
					</div>
					<p class="flex items-center gap-2 text-xs text-muted-foreground"><Images class="size-4" aria-hidden="true" />{photos.length} photos</p>
				</div>
				<ul class="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
					{#each photos as photo (photo.id)}
						<li>
							<figure class="group relative h-full overflow-hidden rounded-xl bg-secondary">
								<img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" class="aspect-[4/3] size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none" />
								{#if photo.caption}<figcaption class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 to-transparent px-3 pt-8 pb-2.5 text-[11px] leading-snug text-white md:text-xs">{photo.caption}</figcaption>{/if}
							</figure>
						</li>
					{/each}
				</ul>
			</div>
		</section>
	{/if}

	{#if tours.length}
		<section id="safaris" class="stay-section bg-secondary/45 py-14 md:py-20">
			<div class="page-container">
				<div data-motion="reveal" class="flex flex-wrap items-end justify-between gap-5">
					<div class="max-w-2xl">
						<p class="eyebrow text-muted-foreground">On our safaris</p>
						<div class="gold-line mt-4"></div>
						<h2 class="section-heading mt-5">Safaris that stay here</h2>
						<p class="section-description mt-4">{tours.length === 1 ? 'One of our safaris includes' : `${tours.length} of our safaris include`} {stay.name}. Under each you’ll see the style and day it stays here.</p>
					</div>
					{#if place}<Button href={`/tours?destination_id=${encodeURIComponent(place.id)}#tour-results`} variant="outline" class="h-11">All safaris to {placeShort} <ArrowRight class="size-4" /></Button>{/if}
				</div>
				<ul class="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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

	<section id="explore" class="stay-section py-14 md:py-20">
		<div class="page-container">
			<div data-motion="reveal" class="max-w-2xl">
				<p class="eyebrow text-muted-foreground">Keep exploring</p>
				<div class="gold-line mt-4"></div>
				<h2 class="section-heading mt-5">{placeShort ? `Around ${placeShort}` : 'More to explore'}</h2>
			</div>
			<div class="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
				{#if areas.length}
					<div data-motion="card" class="explore-card">
						<h3><MapPin class="size-4" aria-hidden="true" />{areas.length === 1 ? 'Destination' : 'Destinations'}</h3>
						<ul class="explore-links">
							{#each areas as area (area.id)}
								<li><a href={staysHref({}, { destination_id: area.id })}>Stays in {area.name}<ArrowRight class="size-3.5" aria-hidden="true" /></a></li>
								<li><a href={`/tours?destination_id=${encodeURIComponent(area.id)}#tour-results`}>Safaris to {area.name}<ArrowRight class="size-3.5" aria-hidden="true" /></a></li>
							{/each}
						</ul>
					</div>
				{/if}
				{#if categories.length}
					<div data-motion="card" class="explore-card">
						<h3><Route class="size-4" aria-hidden="true" />Safari types that stay here</h3>
						<ul class="explore-links">
							{#each categories as category (category.id)}
								<li><a href={`/tours?category_id=${encodeURIComponent(category.id)}#tour-results`}>{category.name}<ArrowRight class="size-3.5" aria-hidden="true" /></a></li>
							{/each}
						</ul>
					</div>
				{/if}
				<div data-motion="card" class="explore-card">
					<h3><StyleIcon class="size-4" aria-hidden="true" />Stays like this</h3>
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

	{#if nearby.length}
		<section id="nearby" class="stay-section border-t border-border bg-[oklch(.975_.009_85)] py-14 md:py-20">
			<div class="page-container">
				<div data-motion="reveal" class="flex flex-wrap items-end justify-between gap-5">
					<div class="max-w-2xl">
						<p class="eyebrow text-muted-foreground">Nearby</p>
						<h2 class="section-heading mt-3">More stays in {place?.name ?? 'the area'}</h2>
					</div>
					{#if place}<Button href={staysHref({}, { destination_id: place.id })} variant="outline" class="h-11">See all stays in {placeShort} <ArrowRight class="size-4" /></Button>{/if}
				</div>
				<div class="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{#each nearby as other (other.id)}
						<StayCard stay={other} destination={placeDetails} />
					{/each}
				</div>
			</div>
		</section>
	{/if}

	{#if enquirySection}
		<Enquiry section={enquirySection} {form} interest={enquiryInterest} />
	{/if}
</main>
<SiteFooter visible={chrome.visible} destinations={chrome.destinations} onInterest={chooseInterest} {onPage} />

<style>
	/* The section bar sticks under the header, so in-page links stop a little lower. */
	.stay-section { scroll-margin-top: 3.5rem; }
	.style-badge, .type-badge { display: inline-flex; align-items: center; gap: 0.4rem; border-radius: 999px; padding: 0.35rem 0.8rem; font-size: 12px; font-weight: 600; line-height: 1.3; }
	.style-badge { border: 1px solid var(--style-color); background: var(--style-light); color: var(--style-text); }
	.style-badge :global(svg) { color: var(--style-ink); }
	.type-badge { border: 1px solid var(--border); background: white; color: var(--navy); }
	.type-badge :global(svg) { color: var(--muted-foreground); }
	.type-badge.featured { border-color: var(--sun); background: var(--sun); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; }
	/* "Why we recommend it": the team's own words, set apart as a pull-quote. */
	.why { position: relative; margin-top: 2.5rem; overflow: hidden; border-left: 4px solid var(--sun); border-radius: 0 1.25rem 1.25rem 0; background: oklch(.975 .02 95); padding: 1.75rem 1.5rem 1.6rem; }
	.why :global(.why-mark) { position: absolute; top: 1rem; right: 1.25rem; width: 3.5rem; height: 3.5rem; color: color-mix(in oklch, var(--sun) 55%, transparent); }
	.why :global(.rich-text) { position: relative; font-size: 16px; font-weight: 500; line-height: 1.85; letter-spacing: -0.01em; color: var(--navy); }
	.map-link { display: flex; align-items: center; gap: 0.6rem; margin-top: 1.25rem; min-height: 2.75rem; border: 1px solid var(--border); border-radius: 0.6rem; background: white; padding: 0 0.9rem; color: var(--navy); font-size: 13px; font-weight: 600; transition: border-color 160ms ease-out; }
	.map-link:hover { border-color: color-mix(in oklch, var(--navy) 30%, transparent); }
	.overnight-note { display: flex; align-items: flex-start; gap: 0.55rem; border-radius: 0.75rem; background: white; padding: 0.7rem 0.9rem; color: var(--muted-foreground); font-size: 13px; line-height: 1.5; box-shadow: inset 0 0 0 1px var(--border); }
	.overnight-note :global(svg) { margin-top: 0.1rem; color: #D9A900; }
	.overnight-note strong { color: var(--navy); font-weight: 600; }
	.explore-card { border: 1px solid var(--border); border-radius: 1.25rem; background: white; padding: 1.5rem; }
	.explore-card h3 { display: flex; align-items: center; gap: 0.5rem; font-size: 15px; font-weight: 700; color: var(--navy); }
	.explore-card h3 :global(svg) { color: #D9A900; }
	.explore-links { display: grid; margin-top: 0.75rem; }
	.explore-links a { display: flex; min-height: 2.75rem; align-items: center; justify-content: space-between; gap: 0.75rem; border-top: 1px solid var(--border); padding: 0.55rem 0; color: var(--navy); font-size: 14px; line-height: 1.45; }
	.explore-links li:first-child a { border-top: 0; }
	.explore-links a :global(svg) { flex-shrink: 0; color: var(--muted-foreground); transition: translate 160ms ease-out; }
	.explore-links a:hover { color: color-mix(in oklch, var(--navy) 80%, black); }
	.explore-links a:hover :global(svg) { translate: 3px 0; color: var(--navy); }
	@media (min-width: 768px) { .why { padding: 2.25rem 2.5rem 2rem; } .why :global(.rich-text) { font-size: 18px; } }
	@media (prefers-reduced-motion: reduce) { .explore-links a :global(svg) { transition: none; } .explore-links a:hover :global(svg) { translate: none; } }
</style>
