<script lang="ts">
	import { PHOTO } from '$lib/media-photos';
	import { onDestroy } from 'svelte';
	import { Menu, ArrowRight, ArrowUpRight, Search, Compass, Map, MapPin, Binoculars, BedDouble, BookOpen } from '@lucide/svelte';
	import { destinationHref } from '$lib/destination-content';
	import { siteInfo } from '$lib/site-info';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import CurrencyPicker from './currency-picker.svelte';
	import { STYLE_ICONS } from '$lib/components/stays/stay-icons';
	import { GUIDE_PAGE_KEYS, GUIDE_PATH, safeUrl, circuitFor, destinationPhoto, tourDuration, tourFromPrice, tourPhotos } from '$lib/home-content';
	import { countryGroups, homeFirst, isHomeCountry } from '$lib/countries';
	import { SAFARI_STYLE_THEME } from '$lib/safari-pricing';
	import { ownStayPhoto, STAY_STYLES, stayLocation, stayTypeLabel } from '$lib/stay-content';
	import { PLANNER_PATH, planHref } from '$lib/planner/plan-href';
	import type { Activity, Category, Destination, Stay, Tour } from '$lib/types/api';
	import { page } from '$app/state';
	import { TOUR_SEARCH_ID } from '$lib/tour-search';

	let open = $state(false);
	// CMS branding from the root layout; empty keeps the built-in mark.
	let logo = $derived(safeUrl(page.data.branding?.logo_url, ''));
	let emblem = $derived(safeUrl(page.data.branding?.favicon_url, ''));
	let menu = $state('');
	let { visible, activities, destinations, onInterest, tours = [], categories = [], stays = [], onPage }: { visible: string[]; activities: Activity[]; destinations: Destination[]; onInterest: (name: string) => void; tours?: Tour[]; categories?: Category[]; stays?: Stay[]; onPage?: string[] } = $props();
	// Without onPage this is the home page; elsewhere a section missing from the page links home.
	const anchor = (id: string) => (!onPage || onPage.includes(id) ? `#${id}` : `/#${id}`);
	const navItems = [{ id: 'tours', label: 'Tours', icon: Binoculars }, { id: 'stays', label: 'Stays', icon: BedDouble }, { id: 'experiences', label: 'Experiences', icon: Compass }, { id: 'destinations', label: 'Destinations', icon: Map }];
	const experienceGroups = [
		{ title: 'Wildlife & safari', description: 'Big cats, open plains and extraordinary encounters.', image: PHOTO.vehiclesAcacia },
		{ title: 'A little adventure', description: 'Balloon flights and journeys beyond the everyday.', image: PHOTO.balloonsDawn },
		{ title: 'Beach & island escapes', description: 'Slow days beside the turquoise Indian Ocean.', image: PHOTO.zanzibarSunset },
		{ title: 'Culture & connection', description: 'Local stories, traditions and warm welcomes.', image: PHOTO.hadzabe }
	];
	const destinationGroups = [
		{ title: 'Northern circuit', circuit: 'northern', image: PHOTO.wildebeest, description: 'The classic Tanzania safari' },
		{ title: 'Southern circuit', circuit: 'southern', image: PHOTO.lionPride, description: 'Wild, remote and unhurried' },
		{ title: 'Western circuit', circuit: 'western', image: PHOTO.hillsPlains, description: 'Forests, lakes and wild horizons' },
		{ title: 'Zanzibar & coast', circuit: 'coast', image: PHOTO.zanzibarSunset, description: 'Your Indian Ocean escape' }
	];
	// /tours and /stays always exist, so their menus show even before anything is published.
	let navigation = $derived(navItems.filter((item) => item.id === 'tours' || item.id === 'stays' || item.id === 'destinations' || visible.includes(item.id)));
	// The safari guide page shows while any of its sections is switched on.
	let hasGuide = $derived(GUIDE_PAGE_KEYS.some((key) => visible.includes(key)));
	let enquiryHref = $derived(anchor(visible.includes('enquiry') ? 'request-quote' : visible.includes('experiences') ? 'experiences' : 'destinations'));
	// "Plan my safari" opens the trip planner from every page but the planner itself.
	let onPlanner = $derived(page.url.pathname === PLANNER_PATH);
	// Featured tours first, otherwise the API's newest-first order.
	let menuTours = $derived([...tours].sort((a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured))).slice(0, 5));
	let menuPhotos = $derived(tourPhotos(menuTours));
	// Only circuits with a published place get a column.
	let circuits = $derived(destinationGroups.map((group) => ({ group, places: destinations.filter((destination) => circuitFor(destination) === group.circuit).slice(0, 5) })).filter((item) => item.places.length));
	// Places in other countries: one column of country pages, beside Tanzania's circuits.
	let countries = $derived(countryGroups(destinations));
	let abroad = $derived(countries.filter((country) => !isHomeCountry(country.name)));
	let mobilePlaces = $derived(homeFirst(destinations).slice(0, abroad.length ? 6 : 8));
	const placeCount = (count: number) => `${count} ${count === 1 ? 'place' : 'places'}`;
	let toursHeading = $derived(menuTours.some((tour) => tour.is_featured) ? 'Featured safaris' : 'Latest safaris');
	function tourMeta(tour: Tour) {
		const price = tourFromPrice(tour);
		return [tourDuration(tour.duration_days), price ? `From ${price}` : 'On request'].filter(Boolean).join(' · ');
	}
	// Featured stays come first; only a stay's own photo is used, never a stand-in.
	let menuStays = $derived([...stays].sort((a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured))).slice(0, 4));
	// Only call them featured when they are; before that the page passes its first stays.
	let staysHeading = $derived(menuStays.some((stay) => stay.is_featured) ? 'Featured stays' : 'Places to stay');
	const stayMeta = (stay: Stay) => [stayTypeLabel(stay.lodge_type), stay.destinations?.name?.trim() || stayLocation(stay)].filter(Boolean).join(' · ');
	const styleVars = (id: keyof typeof SAFARI_STYLE_THEME) => `--style-ink:${SAFARI_STYLE_THEME[id].priceColor};--style-light:${SAFARI_STYLE_THEME[id].light}`;
	// The menu for the page you are on, so the nav can mark it (a safari page sits under Tours).
	function isCurrent(id: string) {
		const path = page.url.pathname;
		if (id === 'tours') return path === '/tours' || path.startsWith('/tours/') || path === '/compare';
		if (id === 'stays' || id === 'destinations') return path === `/${id}` || path.startsWith(`/${id}/`);
		if (id === 'guide') return path === GUIDE_PATH;
		return false;
	}
	// Labels are real links; the adjacent chevron retains the accessible disclosure.
	function mainLink(id: string) {
		if (id === 'tours' || id === 'stays' || id === 'destinations') return `/${id}`;
		if (id === 'experiences') return '/#experiences';
		return enquiryHref;
	}
	let closeTimer: ReturnType<typeof setTimeout> | undefined;
	function keepMenuOpen() { clearTimeout(closeTimer); }
	function hoverMenu(event: PointerEvent, id: string) {
		if (event.pointerType !== 'mouse') return;
		keepMenuOpen();
		menu = id;
	}
	function leaveNavigation(event: PointerEvent) {
		if (event.pointerType !== 'mouse') return;
		keepMenuOpen();
		// Allow the pointer to cross the small gap between the labels and panel.
		closeTimer = setTimeout(() => { menu = ''; }, 220);
	}
	onDestroy(keepMenuOpen);
	function closeMenu() { keepMenuOpen(); open = false; menu = ''; }
	function choose(name: string) { onInterest(name); closeMenu(); }
	// Search lives on the tours page: the button goes there and puts the cursor in the box
	// (or, already on that page, scrolls to the box and focuses it).
	const searchHref = `/tours#${TOUR_SEARCH_ID}`;
	function openSearch(event: MouseEvent) {
		const input = document.getElementById(TOUR_SEARCH_ID);
		if (!(input instanceof HTMLInputElement) || event.metaKey || event.ctrlKey || event.shiftKey) return;
		event.preventDefault();
		closeMenu();
		input.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
		input.focus({ preventScroll: true });
	}
</script>

<header class="site-header">
	<div class="header-shell">
		<a href="/" class="flex shrink-0 items-center gap-3 text-primary" aria-label={`${siteInfo.brand} home`}>
			{#if logo}
				<img src={logo} alt={siteInfo.brand} class="site-logo" width="305" height="176" />
			{:else}
				<span class="grid size-10 place-items-center rounded-full border-2 border-sun"><Compass class="size-5" strokeWidth={1.5} /></span>
				<span class="leading-none"><span class="block text-lg font-bold">Key2africa</span><span class="mt-1 block text-xs font-semibold uppercase tracking-wider text-primary/65">Safaris</span></span>
			{/if}
		</a>
		<NavigationMenu.Root value={menu} onValueChange={(value) => menu = value} viewport={false} onpointerenter={keepMenuOpen} onpointerleave={leaveNavigation} class="desktop-navigation" aria-label="Main navigation">
			<NavigationMenu.List class="gap-1">
				{#each navigation as item}
					<NavigationMenu.Item value={item.id} openOnHover={false} class="mega-menu-item" onpointerenter={(event) => hoverMenu(event, item.id)}>
                        <div class="main-menu-control" class:menu-open={menu === item.id}>
                            <NavigationMenu.Link href={mainLink(item.id)} onclick={closeMenu} active={isCurrent(item.id)} class="main-menu-link">{item.label}</NavigationMenu.Link>
                            <NavigationMenu.Trigger class="main-menu-trigger" aria-label={`${item.label} menu`} />
                        </div>
						<NavigationMenu.Content class="mega-panel">
							<div class="mega-inner">
								{#if item.id === 'tours'}
									<div class="mega-grid">
										{#if categories.length}
											<div class="mega-col">
												<p class="mega-title">Safari styles</p>
												<ul class="mega-list">
													{#each categories.slice(0, 7) as category (category.id)}
														<li><NavigationMenu.Link href={`/tours?category_id=${encodeURIComponent(category.id)}`} onclick={closeMenu} class="mega-link">{category.name}<ArrowRight /></NavigationMenu.Link></li>
													{/each}
												</ul>
											</div>
										{/if}
										<div class="mega-col">
											<p class="mega-title">{toursHeading}</p>
											{#if menuTours.length}
												<ul class="mega-index">
													{#each menuTours as tour, i (tour.id)}
														{@const price = tourFromPrice(tour)}
														<li><NavigationMenu.Link href={`/tours/${encodeURIComponent(tour.slug)}`} onclick={closeMenu} class="mega-trip"><img src={menuPhotos[i]} alt="" loading="lazy" /><span class="mega-trip-name"><strong>{tour.title}</strong>{#if tourDuration(tour.duration_days)}<small>{tourDuration(tour.duration_days)}</small>{/if}</span><span class="mega-trip-price">{#if price}<small>From</small>{price}{:else}<small>Price</small>On request{/if}</span></NavigationMenu.Link></li>
													{/each}
												</ul>
											{:else}
												<p class="mega-empty">New itineraries are on their way. Browse our tours, or tell us the trip you have in mind.</p>
											{/if}
										</div>
										<NavigationMenu.Link href="/tours" onclick={closeMenu} class="mega-feature">
											<img src={PHOTO.balloonPlains} alt="" loading="lazy" />
											<span class="mega-feature-copy"><strong>Ready-made journeys, shaped around you</strong><span>Browse all tours <ArrowRight /></span></span>
										</NavigationMenu.Link>
									</div>
								{:else if item.id === 'stays'}
									<div class="mega-grid">
										<div class="mega-col">
											<p class="mega-title">By comfort</p>
											<ul class="mega-list">
												{#each STAY_STYLES as style (style.id)}
													{@const StyleIcon = STYLE_ICONS[style.id]}
													<li><NavigationMenu.Link href={`/stays?style=${style.id}`} onclick={closeMenu} class="mega-link mega-style" style={styleVars(style.id)}><span class="mega-style-mark"><StyleIcon strokeWidth={1.7} /></span><span><strong>{style.label}</strong><small>{style.hint}</small></span><ArrowRight /></NavigationMenu.Link></li>
												{/each}
											</ul>
										</div>
										<div class="mega-col">
											<p class="mega-title">{staysHeading}</p>
											{#if menuStays.length}
												<ul class="mega-rows">
													{#each menuStays as stay (stay.id)}
														{@const photo = ownStayPhoto(stay)}
														<li><NavigationMenu.Link href={`/stays/${encodeURIComponent(stay.slug)}`} onclick={closeMenu} class="mega-row">{#if photo}<img src={photo} alt="" loading="lazy" />{:else}<span class="mega-row-mark"><BedDouble strokeWidth={1.5} /></span>{/if}<span><strong>{stay.name}</strong>{#if stayMeta(stay)}<small>{stayMeta(stay)}</small>{/if}</span></NavigationMenu.Link></li>
													{/each}
												</ul>
											{:else}
												<p class="mega-empty">Our lodges and camps are on their way. Tell us where you would like to stay.</p>
											{/if}
										</div>
										<NavigationMenu.Link href="/stays" onclick={closeMenu} class="mega-feature">
											<img src={PHOTO.guidePicnic} alt="" loading="lazy" />
											<span class="mega-feature-copy"><strong>Wake up somewhere wild</strong><span>Browse all stays <ArrowRight /></span></span>
										</NavigationMenu.Link>
									</div>
								{:else if item.id === 'experiences'}
									<div class="mega-grid">
										{#if activities.length}
											<div class="mega-col">
												<p class="mega-title">Activities</p>
												<ul class="mega-list">
													{#each activities.slice(0, 7) as activity (activity.id ?? activity.name)}
														<li><NavigationMenu.Link href={enquiryHref} onclick={() => choose(activity.name)} class="mega-link">{activity.name}<ArrowRight /></NavigationMenu.Link></li>
													{/each}
												</ul>
											</div>
										{/if}
										<div class="mega-col">
											<p class="mega-title">What moves you?</p>
											<ul class="mega-rows">
												{#each experienceGroups as group (group.title)}
													<li><NavigationMenu.Link href={enquiryHref} onclick={() => choose(group.title)} class="mega-row"><img src={group.image} alt="" loading="lazy" /><span><strong>{group.title}</strong><small>{group.description}</small></span></NavigationMenu.Link></li>
												{/each}
											</ul>
										</div>
										<NavigationMenu.Link href={enquiryHref} onclick={() => choose('A Tanzania safari')} class="mega-feature">
											<img src={PHOTO.acaciaHaze} alt="" loading="lazy" />
											<span class="mega-feature-copy"><strong>Extraordinary days, planned around you</strong><span>Create your safari <ArrowRight /></span></span>
										</NavigationMenu.Link>
									</div>
								{:else if item.id === 'destinations'}
									<div class="mega-grid mega-grid-places" style:--cols={circuits.length + (abroad.length ? 1 : 0)}>
										{#each circuits as { group, places } (group.circuit)}
											<div class="mega-col">
												<NavigationMenu.Link href={`/destinations?circuit=${group.circuit}#destination-results`} onclick={closeMenu} class="mega-circuit"><strong>{group.title}</strong><small>{group.description}</small></NavigationMenu.Link>
												<ul class="mega-list">
													{#each places as destination (destination.id)}
														<li><NavigationMenu.Link href={destinationHref(destination)} onclick={closeMenu} class="mega-link">{destination.name}<ArrowRight /></NavigationMenu.Link></li>
													{/each}
												</ul>
											</div>
										{/each}
										{#if abroad.length}
											<div class="mega-col">
												<NavigationMenu.Link href="/destinations#countries" onclick={closeMenu} class="mega-circuit"><strong>Across East Africa</strong><small>Country by country</small></NavigationMenu.Link>
												<ul class="mega-list">
													{#each countries as country (country.slug)}
														<li><NavigationMenu.Link href={country.href} onclick={closeMenu} class="mega-link mega-country">{country.name}<small>{placeCount(country.count)}</small><ArrowRight /></NavigationMenu.Link></li>
													{/each}
												</ul>
											</div>
										{/if}
										<NavigationMenu.Link href="/destinations" onclick={closeMenu} class="mega-feature">
											<img src={PHOTO.wildebeest} alt="" loading="lazy" />
											<span class="mega-feature-copy"><strong>{abroad.length ? 'Find your corner of East Africa' : 'Find your corner of Tanzania'}</strong><span>Explore all destinations <ArrowRight /></span></span>
										</NavigationMenu.Link>
									</div>
								{/if}
							</div>
						</NavigationMenu.Content>
					</NavigationMenu.Item>
				{/each}
				{#if hasGuide}<NavigationMenu.Item value="guide" class="mega-menu-item"><div class="main-menu-control"><NavigationMenu.Link href={GUIDE_PATH} onclick={closeMenu} active={isCurrent('guide')} class="main-menu-link plain-menu-link">Safari guide</NavigationMenu.Link></div></NavigationMenu.Item>{/if}
			</NavigationMenu.List>
		</NavigationMenu.Root>
		<div class="header-actions"><CurrencyPicker /><Button href={searchHref} onclick={openSearch} variant="ghost" size="icon" aria-label="Search safaris"><Search class="size-5" /></Button>{#if !onPlanner}<Button variant="safari" href={planHref({ from: 'header' })} data-cta="plan_my_trip" data-cta-location="header" class="h-11 px-5 text-sm">Plan my safari <ArrowRight class="size-4" /></Button>{/if}</div>
		<div class="mobile-actions">
		<a href={searchHref} onclick={openSearch} class="mobile-search" aria-label="Search safaris"><Search class="size-[22px]" strokeWidth={1.9} /></a>
		<Sheet.Root bind:open>
			<Sheet.Trigger class="mobile-navigation" aria-label="Open navigation"><Menu class="size-6" strokeWidth={1.9} /></Sheet.Trigger>
            <Sheet.Content side="right" class="mobile-menu-panel">
                <Sheet.Header class="mobile-menu-header">
                    <div class="mobile-brand"><span>{#if emblem}<img src={emblem} alt="" class="size-7 object-contain" />{:else}<Compass class="size-5" strokeWidth={1.5} />{/if}</span><div><Sheet.Title class="text-base font-semibold">{siteInfo.brand}</Sheet.Title><Sheet.Description class="mt-1 text-xs">Your Tanzania. Your way.</Sheet.Description></div></div>
                </Sheet.Header>
                <div class="mobile-menu-scroll">
                    <p class="mobile-menu-eyebrow">LET THE EXPLORING BEGIN</p>
                    <Accordion.Root type="single" class="mobile-menu-accordion">
                        {#each navigation as item}
                            <Accordion.Item value={item.id} class="mobile-menu-section">
                                <Accordion.Trigger class="mobile-section-trigger"><span class="mobile-section-label"><item.icon class="size-[18px]" strokeWidth={1.6} />{item.label}</span></Accordion.Trigger>
                                <Accordion.Content class="mobile-section-content">
                                    <div class="mobile-menu-links">
                                        {#if item.id === 'tours'}
                                            {#each menuTours as tour, i (tour.id)}<a data-motion="reveal" class="mobile-menu-link" href={`/tours/${encodeURIComponent(tour.slug)}`} onclick={closeMenu}><img src={menuPhotos[i]} alt="" /><span>{tour.title}<small class="mobile-tour-meta">{tourMeta(tour)}</small></span><ArrowUpRight class="size-3.5" /></a>{/each}
                                            <a class="mobile-menu-link mobile-view-all" href="/tours" onclick={closeMenu}>View all tours <ArrowRight class="size-4" /></a>
                                        {:else if item.id === 'stays'}
                                            {#each STAY_STYLES as style (style.id)}{@const StyleIcon = STYLE_ICONS[style.id]}<a class="mobile-menu-link" href={`/stays?style=${style.id}`} onclick={closeMenu} style={styleVars(style.id)}><span class="mobile-stay-mark mobile-style-mark"><StyleIcon class="size-[18px]" strokeWidth={1.6} /></span><span>{style.label} stays<small class="mobile-tour-meta">{style.hint}</small></span><ArrowUpRight class="size-3.5" /></a>{/each}
                                            {#each menuStays as stay (stay.id)}{@const photo = ownStayPhoto(stay)}<a data-motion="reveal" class="mobile-menu-link" href={`/stays/${encodeURIComponent(stay.slug)}`} onclick={closeMenu}>{#if photo}<img src={photo} alt="" />{:else}<span class="mobile-stay-mark"><BedDouble class="size-[18px]" strokeWidth={1.5} /></span>{/if}<span>{stay.name}{#if stayMeta(stay)}<small class="mobile-tour-meta">{stayMeta(stay)}</small>{/if}</span><ArrowUpRight class="size-3.5" /></a>{/each}
                                            <a class="mobile-menu-link mobile-view-all" href="/stays" onclick={closeMenu}>View all stays <ArrowRight class="size-4" /></a>
                                        {:else if item.id === 'experiences'}
                                            {#each activities as activity}<a data-motion="reveal" class="mobile-menu-link" href={enquiryHref} onclick={() => choose(activity.name)}><img src={safeUrl(activity.image_url_thumbnail || activity.image_url || activity.hero_image_url, PHOTO.vehiclesAcacia)} alt="" /><span>{activity.name}</span><ArrowUpRight class="size-3.5" /></a>{/each}
                                            <a class="mobile-menu-link mobile-view-all" href={anchor('experiences')} onclick={closeMenu}>View all experiences <ArrowRight class="size-4" /></a>
                                        {:else if item.id === 'destinations'}
                                            {#if abroad.length}{#each countries as country (country.slug)}<a class="mobile-menu-link" href={country.href} onclick={closeMenu}><span class="mobile-stay-mark"><MapPin class="size-[18px]" strokeWidth={1.5} /></span><span>{country.name}<small class="mobile-tour-meta">{placeCount(country.count)}</small></span><ArrowUpRight class="size-3.5" /></a>{/each}{/if}
                                            {#each mobilePlaces as destination, i}<a data-motion="reveal" class="mobile-menu-link" href={destinationHref(destination)} onclick={closeMenu}><img src={destinationPhoto(destination, i)} alt="" /><span>{destination.name}</span><ArrowUpRight class="size-3.5" /></a>{/each}
                                            <a class="mobile-menu-link mobile-view-all" href="/destinations" onclick={closeMenu}>Explore all destinations <ArrowRight class="size-4" /></a>
                                        {/if}
                                    </div>
                                </Accordion.Content>
                            </Accordion.Item>
                        {/each}
                    </Accordion.Root>
                    {#if hasGuide}<a class="mobile-guide-link" href={GUIDE_PATH} onclick={closeMenu}><span class="mobile-section-label"><BookOpen class="size-[18px]" strokeWidth={1.6} />Safari guide</span><ArrowRight class="size-4" /></a>{/if}
                </div>
                <div class="mobile-menu-currency"><CurrencyPicker variant="sheet" /></div>
                {#if !onPlanner}<div class="mobile-menu-footer"><p>A journey, designed around you.</p><Button variant="safari" href={planHref({ from: 'header' })} data-cta="plan_my_trip" data-cta-location="header" onclick={closeMenu} class="h-12 w-full">Plan my safari <ArrowRight class="size-4" /></Button></div>{/if}
            </Sheet.Content>
		</Sheet.Root>
		</div>
	</div>
</header>

<style>
	/* Frosted glass: the page shows softly through the header as it scrolls beneath. */
	.site-header { view-transition-name: site-header; position: sticky; top: 0; z-index: 50; border-bottom: 1px solid rgb(39 36 31 / .08); background: color-mix(in oklab, var(--background) 72%, transparent); -webkit-backdrop-filter: blur(18px) saturate(1.6); backdrop-filter: blur(18px) saturate(1.6); box-shadow: inset 0 -1px 0 rgb(255 255 255 / .4), 0 8px 24px -20px rgb(39 36 31 / .3); transition: transform .25s ease, background-color .2s ease; }
	/* With a menu open the header joins the solid panel below it. */
	.site-header:has(:global(.mega-panel[data-state='open'])) { background: var(--background); }
	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { .site-header { background: var(--background); } }
	/* Photo heroes run up behind the glass, so it reads as glass from the first view. */
	:global(.site-header + main > :first-child:is(.home-hero, .page-hero)) { margin-top: calc(-1 * var(--site-header-height) - 1px); padding-top: calc(var(--site-header-height) + 1px); }
	/* A page's own sticky bar can take the header's place while it is stuck
	   (tour pages); keyboard focus inside the header still brings it back. */
	:global(html[data-header-hidden]) .site-header:not(:focus-within) { transform: translateY(-100%); box-shadow: none; }
	@media (prefers-reduced-motion: reduce) { .site-header { transition: none; } }
	.header-shell { display: flex; align-items: center; justify-content: space-between; gap: 20px; width: min(84%, var(--page-max)); height: var(--site-header-height); margin-inline: auto; }
	@media (max-width: 767px) { .header-shell { width: 100%; padding-inline: 24px; } }
	:global(.desktop-navigation) { position: static; display: flex; flex: none; }
	:global(.mega-menu-item) { position: static; }
	.main-menu-control { display: flex; align-items: center; }
	/* A sun-yellow rule sitting on the header's bottom edge, under the label: solid
	   on the page you are on and while its menu is open, lighter on hover. The link is
	   44px tall and centred, so half the leftover header height reaches the edge;
	   one more pixel covers the header's border. */
	:global(.main-menu-link) { position: relative; }
	:global(.main-menu-link)::after { content: ''; position: absolute; z-index: 2; left: 12px; right: 3px; bottom: calc((44px - var(--site-header-height)) / 2 - 1px); height: 3px; background: var(--sun); opacity: .5; transform: scaleX(0); transform-origin: center; transition: transform .28s cubic-bezier(.2, .7, .2, 1), opacity .2s ease; }
	:global(.main-menu-link.plain-menu-link)::after { right: 12px; }
	.main-menu-control:hover :global(.main-menu-link)::after { transform: scaleX(1); }
	.main-menu-control.menu-open :global(.main-menu-link)::after, :global(.main-menu-link[data-active])::after { opacity: 1; transform: scaleX(1); }
	:global(.main-menu-link[data-active]) { font-weight: 600; }
	:global(.main-menu-link) { height: 44px; padding: 0 3px 0 12px; border-radius: var(--radius-control) 0 0 var(--radius-control); color: var(--navy); font-size: var(--text-base); font-weight: 500; text-decoration: none; background: transparent; }
	:global(.main-menu-link:hover), :global(.main-menu-link:focus), :global(.main-menu-link[data-active]) { background: transparent; }
	:global(.main-menu-link:focus-visible), :global(.main-menu-trigger:focus-visible) { outline: 2px solid var(--sun); outline-offset: 2px; }
	:global(.main-menu-link.plain-menu-link) { padding-right: 12px; border-radius: var(--radius-control); }
	:global(.main-menu-trigger) { height: 44px; width: 30px; padding: 0; border: 0; border-radius: 0 var(--radius-control) var(--radius-control) 0; background: transparent; color: var(--navy); }
	:global(.main-menu-trigger > svg) { margin-left: 0; top: 0; }
	:global(.main-menu-trigger:hover), :global(.main-menu-trigger[data-state="open"]), :global(.main-menu-trigger[data-open]), :global(.main-menu-trigger[data-popup-open]) { background: transparent; }
	/* The menu panel runs the full width under the header; its content keeps the page's own margins. */
	:global(.mega-panel) { position: absolute; top: 100%; left: 0; right: 0; width: auto; margin: 0; max-height: calc(100dvh - var(--site-header-height) - 24px); overflow-y: auto; overscroll-behavior: contain; border: 0; border-top: 1px solid var(--border); border-radius: 0; padding: 0; background: var(--background); box-shadow: 0 28px 40px -28px rgb(39 36 31 / .28), 0 1px 0 var(--border); transform: none; animation: menu-enter 200ms cubic-bezier(.2, .7, .2, 1); }
	@keyframes menu-enter { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
	.mega-inner { width: min(84%, var(--page-max)); margin-inline: auto; padding-block: 32px 36px; }
	.mega-grid { display: grid; grid-template-columns: 236px minmax(0, 1fr) 280px; gap: 56px; align-items: stretch; }
	.mega-grid:not(:has(> .mega-col + .mega-col)) { grid-template-columns: minmax(0, 1fr) 272px; }
	.mega-grid-places, .mega-grid-places:not(:has(> .mega-col + .mega-col)) { grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)) 248px; gap: 36px; }
	.mega-col { min-width: 0; }
	.mega-title { margin: 0 0 8px; padding-bottom: 12px; border-bottom: 1px solid var(--border); font-size: var(--text-sm); font-weight: 600; line-height: 1.3; color: var(--muted-foreground); }
	.mega-list, .mega-rows { margin: 0; padding: 0; list-style: none; }
	:global(.mega-link) { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-radius: 0; background: transparent; color: var(--navy); font-size: var(--text-sm); font-weight: 500; line-height: 1.4; }
	:global(.mega-link:hover), :global(.mega-link:focus) { background: transparent; color: var(--navy); }
	:global(.mega-link > svg) { flex: none; width: 15px; height: 15px; color: var(--muted-foreground); opacity: 0; translate: -4px 0; transition: opacity .16s ease, translate .2s cubic-bezier(.2, .7, .2, 1); }
	:global(.mega-link:hover > svg), :global(.mega-link:focus-visible > svg) { opacity: 1; translate: 0 0; }
	/* Plain text links: the arrow trails the words without taking their room. */
	:global(.mega-link:not(.mega-style)) { position: relative; width: fit-content; max-width: 100%; }
	:global(.mega-link:not(.mega-style) > svg) { position: absolute; top: 50%; left: calc(100% + 6px); margin-top: -7.5px; }
	:global(.mega-country) { gap: 8px; }
	:global(.mega-country small) { font-size: var(--text-xs); font-weight: 500; color: var(--muted-foreground); font-variant-numeric: tabular-nums; }
	:global(.mega-link:focus-visible), :global(.mega-row:focus-visible), :global(.mega-feature:focus-visible), :global(.mega-circuit:focus-visible) { outline: 2px solid var(--sun); outline-offset: 2px; }
	:global(.mega-style) { justify-content: flex-start; padding-block: 10px; }
	:global(.mega-style > span:nth-child(2)) { flex: 1; min-width: 0; }
	:global(.mega-style strong) { display: block; font-weight: 600; }
	:global(.mega-style small) { display: block; margin-top: 2px; font-size: var(--text-xs); font-weight: 400; line-height: 1.45; color: var(--muted-foreground); }
	.mega-style-mark { display: grid; place-items: center; flex: none; width: 32px; height: 32px; border-radius: 6px; background: var(--style-light); color: var(--style-ink); }
	.mega-style-mark :global(svg) { width: 17px; height: 17px; }
	.mega-rows { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 28px; }
	:global(.mega-row) { display: grid; grid-template-columns: 76px minmax(0, 1fr); align-items: center; gap: 14px; padding: 10px 0; border-radius: 0; background: transparent; color: var(--navy); }
	:global(.mega-row:hover), :global(.mega-row:focus) { background: transparent; color: var(--navy); }
	:global(.mega-row > img), .mega-row-mark { width: 76px; height: 57px; border-radius: 6px; object-fit: cover; background: var(--secondary); transition: filter .2s ease; }
	:global(.mega-row:hover > img) { filter: brightness(1.06) saturate(1.08); }
	.mega-row-mark { display: grid; place-items: center; background: var(--navy); color: var(--sun); }
	.mega-row-mark :global(svg) { width: 20px; height: 20px; }
	:global(.mega-row strong) { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; font-size: var(--text-sm); font-weight: 600; line-height: 1.4; transition: color .16s ease; }
	:global(.mega-row:hover strong) { color: color-mix(in oklab, var(--navy) 72%, var(--sun)); }
	:global(.mega-row small) { display: -webkit-box; margin-top: 4px; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; font-size: var(--text-xs); line-height: 1.45; color: var(--muted-foreground); }
	/* Tours: an index, one safari a row, the price lined up on the right. */
	.mega-index { margin: 0; padding: 0; list-style: none; }
	.mega-index li + li { border-top: 1px solid var(--border); }
	:global(.mega-trip) { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; align-items: center; gap: 16px; padding: 10px 0; border-radius: 0; background: transparent; color: var(--navy); }
	:global(.mega-trip:hover), :global(.mega-trip:focus) { background: transparent; color: var(--navy); }
	:global(.mega-trip:focus-visible) { outline: 2px solid var(--sun); outline-offset: 2px; }
	:global(.mega-trip > img) { width: 64px; height: 48px; border-radius: 6px; object-fit: cover; background: var(--secondary); transition: filter .2s ease; }
	:global(.mega-trip:hover > img) { filter: brightness(1.06) saturate(1.08); }
	.mega-trip-name { display: grid; gap: 3px; min-width: 0; }
	.mega-trip-name strong { overflow: hidden; font-size: var(--text-sm); font-weight: 600; line-height: 1.35; white-space: nowrap; text-overflow: ellipsis; transition: color .16s ease; }
	:global(.mega-trip:hover) .mega-trip-name strong { color: color-mix(in oklab, var(--navy) 72%, var(--sun)); }
	.mega-trip-name small, .mega-trip-price small { font-size: var(--text-xs); line-height: 1.3; color: var(--muted-foreground); }
	.mega-trip-price { display: grid; justify-items: end; gap: 3px; font-size: var(--text-sm); font-weight: 600; line-height: 1.35; font-variant-numeric: tabular-nums; white-space: nowrap; }
	:global(.mega-circuit) { display: block; margin-bottom: 8px; padding: 0 0 12px; border-bottom: 1px solid var(--border); border-radius: 0; background: transparent; color: var(--navy); }
	:global(.mega-circuit:hover), :global(.mega-circuit:focus) { background: transparent; color: var(--navy); }
	:global(.mega-circuit strong) { display: block; font-size: var(--text-sm); font-weight: 600; line-height: 1.3; }
	:global(.mega-circuit small) { display: block; margin-top: 3px; font-size: var(--text-xs); line-height: 1.45; color: var(--muted-foreground); }
	:global(.mega-feature) { position: relative; isolation: isolate; display: flex; align-items: flex-end; min-height: 236px; overflow: hidden; padding: 20px; border-radius: var(--radius-control); background: #2b2722; color: #fff; }
	:global(.mega-feature:hover), :global(.mega-feature:focus) { background: #2b2722; color: #fff; }
	:global(.mega-feature > img) { position: absolute; inset: 0; z-index: -2; width: 100%; height: 100%; object-fit: cover; transition: scale .6s cubic-bezier(.2, .7, .2, 1); }
	:global(.mega-feature)::after { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(180deg, rgb(18 17 15 / 0) 30%, rgb(18 17 15 / .82) 100%); }
	:global(.mega-feature:hover > img) { scale: 1.04; }
	.mega-feature-copy { display: grid; gap: 12px; }
	.mega-feature-copy strong { font-size: var(--text-lg); font-weight: 600; line-height: 1.3; letter-spacing: -.02em; text-wrap: balance; }
	.mega-feature-copy > span { display: inline-flex; align-items: center; gap: 8px; font-size: var(--text-sm); font-weight: 600; color: rgb(255 255 255 / .9); }
	.mega-feature-copy > span :global(svg) { width: 15px; height: 15px; transition: translate .2s cubic-bezier(.2, .7, .2, 1); }
	:global(.mega-feature:hover) .mega-feature-copy > span :global(svg) { translate: 3px 0; }
	.mega-empty { max-width: 420px; margin: 8px 0 0; font-size: var(--text-sm); line-height: 1.7; color: var(--muted-foreground); }
	@media (max-width: 1279px) { .mega-grid { gap: 32px; grid-template-columns: minmax(170px, 200px) minmax(0, 1fr) 220px; } .mega-grid-places, .mega-grid-places:not(:has(> .mega-col + .mega-col)) { grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)) 200px; gap: 28px; } :global(.mega-row) { grid-template-columns: 64px minmax(0, 1fr); gap: 12px; } :global(.mega-row > img), .mega-row-mark { width: 64px; height: 48px; } }
	.header-actions { display: flex; align-items: center; gap: 6px; }
	.mobile-menu-currency { flex-shrink: 0; padding: 0 22px; }
	.mobile-menu-currency:has(:global(.sheet-picker)) { padding-top: 16px; border-top: 1px solid var(--border); }
    :global(.mobile-menu-panel) { display: flex; width: min(92vw,400px); flex-direction: column; gap: 0; padding: 0; overflow: hidden; background: white; }
    :global(.mobile-menu-header) { flex-shrink: 0; padding: 25px 22px; border-bottom: 1px solid var(--border); text-align: left; }
    .mobile-brand { display: flex; align-items: center; gap: 12px; }
    .site-logo { display: block; width: auto; height: 64px; }
    @media (max-width: 1099px) { .site-logo { height: 54px; } }
    .mobile-brand > span { display: grid; place-items: center; width: 42px; height: 42px; border: 1.5px solid var(--sun); border-radius: 50%; }
    .mobile-menu-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 24px 16px; }
    .mobile-menu-eyebrow { margin: 0 9px 16px; font-size: var(--text-xs); font-weight: 500; letter-spacing: .14em; color: var(--muted-foreground); }
    :global(.mobile-menu-accordion) { display: grid; gap: 8px; }
    :global(.mobile-menu-section) { overflow: hidden; border: 0; border-radius: var(--radius-surface); background: var(--secondary); }
    :global(.mobile-section-trigger) { min-height: 54px; padding: 16px; border: 0; font-size: var(--text-base); font-weight: 500; text-decoration: none; }
    :global(.mobile-section-trigger:hover) { text-decoration: none; }
    .mobile-section-label { display: flex; align-items: center; gap: 11px; }
    .mobile-guide-link { display: flex; align-items: center; justify-content: space-between; min-height: 54px; margin-top: 8px; padding: 16px; border-radius: var(--radius-control); background: var(--secondary); color: var(--navy); font-size: var(--text-base); font-weight: 500; text-decoration: none; }
    .mobile-guide-link:hover, .mobile-guide-link:focus-visible { background: color-mix(in oklch, var(--secondary) 80%, var(--navy) 8%); }
    :global(.mobile-section-content) { padding: 0 7px 8px; }
    .mobile-menu-links { display: grid; gap: 3px; }
    .mobile-menu-link { display: flex; min-height: 46px; align-items: center; gap: 10px; padding: 8px; border-radius: var(--radius-control); color: var(--navy); text-decoration: none; font-size: var(--text-sm); line-height: 1.5; transition: background 160ms ease-out; }
    .mobile-menu-link:hover, .mobile-menu-link:focus-visible { background: white; text-decoration: none; }
    .mobile-menu-link img { width: 40px; height: 40px; flex-shrink: 0; object-fit: cover; border-radius: 7px; }
    .mobile-menu-link :global(svg) { flex-shrink: 0; margin-left: auto; color: var(--muted-foreground); }
    .mobile-view-all { margin-top: 5px; padding: 12px 10px 8px; min-height: 42px; font-size: var(--text-sm); font-weight: 600; }
    .mobile-tour-meta { display: block; margin-top: 4px; font-size: var(--text-xs); color: var(--muted-foreground); }
    .mobile-menu-link .mobile-stay-mark { display: grid; place-items: center; width: 40px; height: 40px; flex-shrink: 0; margin-left: 0; border-radius: 7px; background: var(--navy); color: var(--sun); }
    .mobile-menu-link .mobile-style-mark { border-radius: 50%; background: var(--style-light); color: var(--style-ink); }
    .mobile-stay-mark :global(svg) { margin-left: 0; color: inherit; }
    .mobile-menu-footer { flex-shrink: 0; padding: 18px 22px max(22px,env(safe-area-inset-bottom)); border-top: 1px solid var(--border); }
    .mobile-menu-footer > p { margin-bottom: 12px; color: var(--muted-foreground); font-size: var(--text-xs); text-align: center; }

	.mobile-actions { display: none; align-items: center; gap: 4px; margin-right: -10px; }
	.mobile-search, :global(.mobile-navigation) { display: grid; place-items: center; width: 44px; height: 44px; border-radius: var(--radius-control); color: var(--navy); transition: background-color 0.16s ease; }
	.mobile-search:hover, .mobile-search:active, :global(.mobile-navigation:hover), :global(.mobile-navigation:active) { background: var(--secondary); }
	.mobile-search:focus-visible, :global(.mobile-navigation:focus-visible) { outline: 2px solid var(--navy); outline-offset: 0; }
	@media (max-width: 1099px) { :global(.desktop-navigation), .header-actions { display: none; } .mobile-actions { display: flex; } }
	/* Phones: a compact app bar, logo left, search and menu right. */
	@media (max-width: 767px) { .header-shell { padding-inline: 5vw; } .site-logo { height: 44px; } }
	@media (prefers-reduced-motion: reduce) { :global(.mega-panel) { animation: none; } :global(.mega-feature > img), :global(.mega-link > svg), .mega-feature-copy > span :global(svg) { transition: none; } }
</style>
