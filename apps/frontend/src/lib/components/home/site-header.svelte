<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Menu, ArrowRight, ArrowUpRight, Search, Compass, Map, CalendarDays, Route, MessageCircle, Palmtree, Binoculars, BedDouble } from '@lucide/svelte';
	import { destinationHref } from '$lib/destination-content';
	import { siteInfo } from '$lib/site-info';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import { STYLE_ICONS } from '$lib/components/stays/stay-icons';
	import { safeUrl, circuitFor, destinationPhoto, tourDuration, tourFromPrice, tourPhotos } from '$lib/home-content';
	import { SAFARI_STYLE_THEME } from '$lib/safari-pricing';
	import { ownStayPhoto, STAY_STYLES, stayLocation, stayTypeLabel } from '$lib/stay-content';
	import type { Activity, Category, Destination, Stay, Tour } from '$lib/types/api';
	import { page } from '$app/state';

	let open = $state(false);
	// CMS branding from the root layout; empty keeps the built-in mark.
	let logo = $derived(safeUrl(page.data.branding?.logo_url, ''));
	let emblem = $derived(safeUrl(page.data.branding?.favicon_url, ''));
	let menu = $state('');
	let { visible, activities, destinations, onInterest, tours = [], categories = [], stays = [], onPage }: { visible: string[]; activities: Activity[]; destinations: Destination[]; onInterest: (name: string) => void; tours?: Tour[]; categories?: Category[]; stays?: Stay[]; onPage?: string[] } = $props();
	// Without onPage this is the home page; elsewhere a section missing from the page links home.
	const anchor = (id: string) => (!onPage || onPage.includes(id) ? `#${id}` : `/#${id}`);
	const navItems = [{ id: 'tours', label: 'Tours', icon: Binoculars }, { id: 'stays', label: 'Stays', icon: BedDouble }, { id: 'experiences', label: 'Experiences', icon: Compass }, { id: 'destinations', label: 'Destinations', icon: Map }, { id: 'zanzibar', label: 'Zanzibar', icon: Palmtree }, { id: 'plan', label: 'Plan your trip', icon: Route }];
	const experienceGroups = [
		{ title: 'Wildlife & safari', description: 'Big cats, open plains and extraordinary encounters.', image: '/images/safari-hero.jpg' },
		{ title: 'A little adventure', description: 'Balloon flights and journeys beyond the everyday.', image: '/images/activity-balloon.jpg' },
		{ title: 'Beach & island escapes', description: 'Slow days beside the turquoise Indian Ocean.', image: '/images/zanzibar-menu.jpg' },
		{ title: 'Culture & connection', description: 'Local stories, traditions and warm welcomes.', image: '/images/activity-maasai.jpg' }
	];
	const destinationGroups = [
		{ title: 'Northern circuit', circuit: 'northern', image: '/images/serengeti.jpg', description: 'The classic Tanzania safari' },
		{ title: 'Southern circuit', circuit: 'southern', image: '/images/itinerary-lions.jpg', description: 'Wild, remote and unhurried' },
		{ title: 'Western circuit', circuit: 'western', image: '/images/itinerary-crater.jpg', description: 'Forests, lakes and wild horizons' },
		{ title: 'Zanzibar & coast', circuit: 'coast', image: '/images/zanzibar-menu.jpg', description: 'Your Indian Ocean escape' }
	];
	const islandIdeas = [
		{ title: 'Zanzibar beach holidays', description: 'Find your stretch of paradise.' },
		{ title: 'Safari + Zanzibar', description: 'Wildlife adventures, then ocean air.' },
		{ title: 'Stone Town', description: 'Wander the island’s historic heart.' },
		{ title: 'Spice tours', description: 'Discover the flavours of Zanzibar.' },
		{ title: 'Island experiences', description: 'Sail, snorkel and explore.' },
		{ title: 'Honeymoon in Zanzibar', description: 'A little time, just for two.' }
	];
	let links = $derived([
		...(visible.includes('cost_ranges') ? [{label:'Safari costs',description:'Understand your options and budget.',href:anchor('cost-ranges'),icon:Compass}] : []),
		...(visible.includes('safari_duration') ? [{label:'How long to stay',description:'Find a route that fits your time.',href:anchor('safari-duration'),icon:Route}] : []),
		...(visible.includes('safari_inclusions') ? [{label:'What’s included',description:'Know the details before you travel.',href:anchor('safari-inclusions'),icon:Binoculars}] : []),
		...(visible.includes('safari_day') ? [{label:'A day on safari',description:'From first light to the evening camp.',href:anchor('safari-day'),icon:CalendarDays}] : []),
		...(visible.includes('safari_packages') ? [{ label: 'Explore safari packages', description: 'Find an itinerary to make your own.', href: anchor('tanzania-safari-packages'), icon: Route }] : []),
		...(visible.includes('when_to_go') ? [{ label: 'When to visit', description: 'Find the season that suits your journey.', href: anchor('when-to-go'), icon: CalendarDays }] : []),
		...(visible.includes('destinations') ? [{ label: 'Where to go', description: 'Get to know Tanzania’s wild places.', href: '/destinations', icon: Map }] : []),
		...(visible.includes('enquiry') ? [{ label: 'Talk to our local team', description: 'Let’s start with your safari ideas.', href: anchor('request-quote'), icon: MessageCircle }] : [])
	]);
	// /tours and /stays always exist, so their menus show even before anything is published.
	let navigation = $derived(navItems.filter((item) => item.id === 'tours' || item.id === 'stays' || item.id === 'destinations' ? true : item.id === 'plan' ? links.length > 0 : item.id === 'zanzibar' ? visible.includes('enquiry') : visible.includes(item.id)));
	let enquiryHref = $derived(anchor(visible.includes('enquiry') ? 'request-quote' : visible.includes('experiences') ? 'experiences' : 'destinations'));
	// On the home page the search panel exists only while safari packages are shown.
	let searchHref = $derived((onPage ? onPage.includes('safari-search') : visible.includes('safari_packages')) ? '#safari-search' : '/tours#safari-search');
	// Featured tours first, otherwise the API's newest-first order.
	let menuTours = $derived([...tours].sort((a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured))).slice(0, 4));
	let menuPhotos = $derived(tourPhotos(menuTours));
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
	function footerLink(id: string) {
		if (id === 'tours') return { href: '/tours', label: 'View all tours' };
		if (id === 'stays') return { href: '/stays', label: 'View all stays' };
		if (id === 'experiences') return { href: anchor('experiences'), label: 'View all experiences' };
		if (id === 'destinations') return { href: '/destinations', label: 'Explore all destinations' };
		return { href: enquiryHref, label: 'Start planning' };
	}
	// Labels are real links; the adjacent chevron retains the accessible disclosure.
	function mainLink(id: string) {
		if (id === 'tours' || id === 'stays' || id === 'destinations') return `/${id}`;
		if (id === 'experiences') return '/#experiences';
		if (id === 'zanzibar') {
			const island = destinations.find(place => place.name.trim().toLowerCase() === 'zanzibar');
			return island ? destinationHref(island) : '/destinations?circuit=coast';
		}
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
</script>

<header class="site-header">
	<div class="header-shell">
		<a href="/" class="flex shrink-0 items-center gap-3 text-primary" aria-label={`${siteInfo.brand} home`}>
			{#if logo}
				<img src={logo} alt={siteInfo.brand} class="site-logo" width="305" height="176" />
			{:else}
				<span class="grid size-10 place-items-center rounded-full border-2 border-sun"><Compass class="size-5" strokeWidth={1.5} /></span>
				<span class="leading-none"><span class="block text-[17px] font-bold">Key2africa</span><span class="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-primary/65">Safaris</span></span>
			{/if}
		</a>
		<NavigationMenu.Root value={menu} onValueChange={(value) => menu = value} viewport={false} onpointerenter={keepMenuOpen} onpointerleave={leaveNavigation} class="desktop-navigation" aria-label="Main navigation">
			<NavigationMenu.List class="gap-1">
				{#each navigation as item}
					<NavigationMenu.Item value={item.id} class="mega-menu-item" onpointerenter={(event) => hoverMenu(event, item.id)}>
                        <div class="main-menu-control" class:menu-open={menu === item.id}>
                            <NavigationMenu.Link href={mainLink(item.id)} onclick={closeMenu} active={page.url.pathname === mainLink(item.id)} class="main-menu-link">{item.label}</NavigationMenu.Link>
                            <NavigationMenu.Trigger class="main-menu-trigger" aria-label={`${item.label} menu`} />
                        </div>
						<NavigationMenu.Content class="mega-panel">
							{#if item.id === 'tours'}
								<div class="experience-menu">
									<NavigationMenu.Link href="/tours" onclick={closeMenu} class="menu-feature">
										<img src="/images/tanzania-safari-hero.jpg" alt="Elephants on the savannah beside a safari vehicle" />
										<div class="feature-copy"><span class="menu-eyebrow">SAFARI TOURS</span><h2>Ready-made journeys.<br />Shaped around you.</h2><span class="feature-cta">Browse all tours <ArrowUpRight class="size-4" /></span></div>
									</NavigationMenu.Link>
									<div class="experience-options">
										<div class="menu-heading"><p class="menu-eyebrow">TANZANIA SAFARI ITINERARIES</p><h2>Find a safari that feels like you</h2></div>
										{#if menuTours.length}
											<div class="experience-links">
												{#each menuTours as tour, i (tour.id)}
													<NavigationMenu.Link data-motion-hover="card" href={`/tours/${encodeURIComponent(tour.slug)}`} onclick={closeMenu} class="experience-link tour-menu-link">
														<img src={menuPhotos[i]} alt="" /><span><strong>{tour.title}</strong><small>{tourMeta(tour)}</small></span><ArrowUpRight class="menu-arrow size-4" />
													</NavigationMenu.Link>
												{/each}
											</div>
										{:else}
											<p class="menu-empty">New itineraries are on their way. Browse our tours, or tell us the trip you have in mind.</p>
										{/if}
										{#if categories.length}<div class="popular-experiences"><span>Safari styles:</span>{#each categories.slice(0, 6) as category (category.id)}<NavigationMenu.Link href={`/tours?category_id=${encodeURIComponent(category.id)}`} onclick={closeMenu} class="popular-link">{category.name}</NavigationMenu.Link>{/each}</div>{/if}
									</div>
								</div>
							{:else if item.id === 'stays'}
								<div class="experience-menu">
									<NavigationMenu.Link href="/stays" onclick={closeMenu} class="menu-feature">
										<img src="/images/activity-bush-lunch.jpg" alt="A table laid for lunch in the shade of an acacia, with elephants grazing beyond" />
										<div class="feature-copy"><span class="menu-eyebrow">WHERE YOU’LL STAY</span><h2>Wake up somewhere wild.</h2><span class="feature-cta">Browse all stays <ArrowUpRight class="size-4" /></span></div>
									</NavigationMenu.Link>
									<div class="experience-options">
										<div class="menu-heading"><p class="menu-eyebrow">LODGES &amp; CAMPS BY STYLE</p><h2>Choose the comfort that feels like you</h2></div>
										<div class="stay-style-links">
											{#each STAY_STYLES as style (style.id)}
												{@const StyleIcon = STYLE_ICONS[style.id]}
												<NavigationMenu.Link data-motion-hover="card" href={`/stays?style=${style.id}`} onclick={closeMenu} class="stay-style-link" style={styleVars(style.id)}>
													<span class="stay-style-icon"><StyleIcon class="size-5" strokeWidth={1.6} /></span><span><strong>{style.label}</strong><small>{style.hint}</small></span><ArrowUpRight class="menu-arrow size-4" />
												</NavigationMenu.Link>
											{/each}
										</div>
										{#if menuStays.length}
											<p class="stay-menu-subheading">{staysHeading}</p>
											<div class="experience-links">
												{#each menuStays as stay (stay.id)}
													{@const photo = ownStayPhoto(stay)}
													<NavigationMenu.Link href={`/stays/${encodeURIComponent(stay.slug)}`} onclick={closeMenu} class="experience-link stay-menu-link">
														{#if photo}<img src={photo} alt="" />{:else}<span class="stay-menu-mark"><BedDouble class="size-5" strokeWidth={1.5} /></span>{/if}<span><strong>{stay.name}</strong>{#if stayMeta(stay)}<small>{stayMeta(stay)}</small>{/if}</span><ArrowUpRight class="menu-arrow size-4" />
													</NavigationMenu.Link>
												{/each}
											</div>
										{/if}
									</div>
								</div>
							{:else if item.id === 'experiences'}
								<div class="experience-menu">
									<NavigationMenu.Link href={enquiryHref} onclick={() => choose('A Tanzania safari')} class="menu-feature">
										<img src="/images/tanzania-hero-2.jpg" alt="Lions resting on a rocky Serengeti kopje" />
										<div class="feature-copy"><span class="menu-eyebrow">YOUR KIND OF ADVENTURE</span><h2>Extraordinary days.<br />Unforgettable stories.</h2><span class="feature-cta">Create your safari <ArrowUpRight class="size-4" /></span></div>
									</NavigationMenu.Link>
									<div class="experience-options">
										<div class="menu-heading"><p class="menu-eyebrow">EXPERIENCE TANZANIA</p><h2>What moves you?</h2></div>
										<div class="experience-links">
											{#each experienceGroups as group}
												<NavigationMenu.Link data-motion-hover="card" href={enquiryHref} onclick={() => choose(group.title)} class="experience-link">
													<img src={group.image} alt="" /><span><strong>{group.title}</strong><small>{group.description}</small></span><ArrowUpRight class="menu-arrow size-4" />
												</NavigationMenu.Link>
											{/each}
										</div>
										{#if activities.length}<div class="popular-experiences"><span>Explore:</span>{#each activities.slice(0, 3) as activity}<NavigationMenu.Link href={enquiryHref} onclick={() => choose(activity.name)} class="popular-link">{activity.name}</NavigationMenu.Link>{/each}</div>{/if}
									</div>
								</div>
							{:else if item.id === 'destinations'}
								<div class="destination-menu">
									<div class="menu-heading"><p class="menu-eyebrow">ONE COUNTRY. ENDLESS POSSIBILITIES.</p><h2>Find your corner of Tanzania</h2></div>
									<div class="destination-columns">
										{#each destinationGroups as group}
											<section class="destination-column">
												<NavigationMenu.Link href={`/destinations?circuit=${group.circuit}#destination-results`} onclick={closeMenu} class="destination-cover"><img src={group.image} alt="" /><span><strong>{group.title}</strong><small>{group.description}</small></span><ArrowUpRight class="size-4" /></NavigationMenu.Link>
												<div class="destination-links">{#each destinations.filter((destination) => circuitFor(destination) === group.circuit).slice(0, 4) as destination}<NavigationMenu.Link href={destinationHref(destination)} onclick={closeMenu} class="destination-link">{destination.name}<ArrowRight class="size-3.5" /></NavigationMenu.Link>{/each}</div>
											</section>
										{/each}
									</div>
								</div>
							{:else if item.id === 'zanzibar'}
								<div class="island-menu">
									<NavigationMenu.Link href={enquiryHref} onclick={() => choose('Zanzibar beach holiday')} class="menu-feature"><img src="/images/zanzibar-menu.jpg" alt="A dhow sailing beside Zanzibar’s white sand beach" /><div class="feature-copy"><span class="menu-eyebrow">AFTER THE ADVENTURE</span><h2>A slower rhythm.<br />An ocean of possibility.</h2><span class="feature-cta">Discover Zanzibar <ArrowUpRight class="size-4" /></span></div></NavigationMenu.Link>
									<div class="island-options"><div class="menu-heading"><p class="menu-eyebrow">BAREFOOT DAYS AWAIT</p><h2>Make time for the coast</h2></div><div class="island-links">{#each islandIdeas as idea}<NavigationMenu.Link href={enquiryHref} onclick={() => choose(idea.title)} class="idea-link"><span><strong>{idea.title}</strong><small>{idea.description}</small></span><ArrowUpRight class="size-4" /></NavigationMenu.Link>{/each}</div></div>
								</div>
							{:else}
								<div class="planning-menu"><div><div class="menu-heading"><p class="menu-eyebrow">A GREAT JOURNEY STARTS HERE</p><h2>A little inspiration. A plan that’s yours.</h2></div><div class="planning-links">{#each links as link}<NavigationMenu.Link href={link.href} onclick={closeMenu} class="planning-link"><span class="planning-icon"><link.icon class="size-5" strokeWidth={1.6} /></span><span><strong>{link.label}</strong><small>{link.description}</small></span><ArrowUpRight class="size-4" /></NavigationMenu.Link>{/each}</div></div><aside class="planning-aside"><Compass class="size-8" strokeWidth={1.4} /><h2>Your ideas.<br />Our local knowledge.</h2><p>We’ll help you bring the pieces together, from the first game drive to your final sunset.</p>{#if visible.includes('enquiry')}<Button href={anchor('request-quote')} onclick={closeMenu} variant="safari" class="mt-5 h-11 w-full">Let’s plan your safari <ArrowRight class="size-4" /></Button>{/if}</aside></div>
							{/if}
							<div class="menu-footer"><span><Compass class="size-4" /> Tanzania, with a local perspective.</span><NavigationMenu.Link href={footerLink(item.id).href} onclick={closeMenu} class="menu-footer-link">{footerLink(item.id).label}<ArrowRight class="size-4" /></NavigationMenu.Link></div>
						</NavigationMenu.Content>
					</NavigationMenu.Item>
				{/each}
			</NavigationMenu.List>
		</NavigationMenu.Root>
		<div class="header-actions"><Button href={searchHref} variant="ghost" size="icon" aria-label="Search safaris" class="rounded-full"><Search class="size-5" /></Button>{#if visible.includes('enquiry')}<Button variant="safari" href={anchor('request-quote')} class="h-11 px-5 text-[13px]">Plan my safari <ArrowRight class="size-4" /></Button>{/if}</div>
		<Sheet.Root bind:open>
			<Sheet.Trigger class="mobile-navigation rounded-md p-2" aria-label="Open navigation"><Menu class="size-6" /></Sheet.Trigger>
            <Sheet.Content side="right" class="mobile-menu-panel">
                <Sheet.Header class="mobile-menu-header">
                    <div class="mobile-brand"><span>{#if emblem}<img src={emblem} alt="" class="size-7 object-contain" />{:else}<Compass class="size-5" strokeWidth={1.5} />{/if}</span><div><Sheet.Title class="text-base font-semibold">{siteInfo.brand}</Sheet.Title><Sheet.Description class="mt-1 text-[11px]">Your Tanzania. Your way.</Sheet.Description></div></div>
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
                                            {#each activities as activity}<a data-motion="reveal" class="mobile-menu-link" href={enquiryHref} onclick={() => choose(activity.name)}><img src={safeUrl(activity.image_url_thumbnail || activity.image_url || activity.hero_image_url, '/images/safari-hero.jpg')} alt="" /><span>{activity.name}</span><ArrowUpRight class="size-3.5" /></a>{/each}
                                            <a class="mobile-menu-link mobile-view-all" href={anchor('experiences')} onclick={closeMenu}>View all experiences <ArrowRight class="size-4" /></a>
                                        {:else if item.id === 'destinations'}
                                            {#each destinations.slice(0, 8) as destination, i}<a data-motion="reveal" class="mobile-menu-link" href={destinationHref(destination)} onclick={closeMenu}><img src={destinationPhoto(destination, i)} alt="" /><span>{destination.name}</span><ArrowUpRight class="size-3.5" /></a>{/each}
                                            <a class="mobile-menu-link mobile-view-all" href="/destinations" onclick={closeMenu}>Explore all destinations <ArrowRight class="size-4" /></a>
                                        {:else if item.id === 'zanzibar'}
                                            {#each islandIdeas as idea}<a class="mobile-menu-link mobile-idea-link" href={enquiryHref} onclick={() => choose(idea.title)}><span>{idea.title}<small>{idea.description}</small></span><ArrowUpRight class="size-3.5" /></a>{/each}
                                        {:else}
                                            {#each links as link}<a class="mobile-menu-link mobile-idea-link" href={link.href} onclick={closeMenu}><span>{link.label}<small>{link.description}</small></span><ArrowUpRight class="size-3.5" /></a>{/each}
                                        {/if}
                                    </div>
                                </Accordion.Content>
                            </Accordion.Item>
                        {/each}
                    </Accordion.Root>
                </div>
                {#if visible.includes('enquiry')}<div class="mobile-menu-footer"><p>A journey, designed around you.</p><Button variant="safari" href={anchor('request-quote')} onclick={closeMenu} class="h-12 w-full">Plan my safari <ArrowRight class="size-4" /></Button></div>{/if}
            </Sheet.Content>
		</Sheet.Root>
	</div>
</header>

<style>
	.site-header { position: sticky; top: 0; z-index: 50; box-shadow: 0 8px 24px -20px rgb(15 35 55 / .3); border-bottom: 1px solid var(--border); background: var(--background); }
	.header-shell { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 20px; max-width: 1280px; height: var(--site-header-height); margin-inline: auto; padding-inline: 32px; }
	:global(.desktop-navigation) { position: static; display: flex; flex: none; }
	:global(.mega-menu-item) { position: static; }
	.main-menu-control { display: flex; align-items: center; border-radius: 9px; }
	.main-menu-control:hover, .main-menu-control.menu-open { background: var(--secondary); }
	:global(.main-menu-link) { height: 44px; padding: 0 3px 0 12px; border-radius: 9px 0 0 9px; color: var(--navy); font-size: 13px; font-weight: 500; text-decoration: none; background: transparent; }
	:global(.main-menu-link:hover), :global(.main-menu-link:focus), :global(.main-menu-link[data-active]) { background: transparent; }
	:global(.main-menu-link:focus-visible), :global(.main-menu-trigger:focus-visible) { outline: 2px solid var(--sun); outline-offset: 2px; }
	:global(.main-menu-trigger) { height: 44px; width: 30px; padding: 0; border: 0; border-radius: 0 9px 9px 0; background: transparent; color: var(--navy); }
	:global(.main-menu-trigger > svg) { margin-left: 0; top: 0; }
	:global(.main-menu-trigger:hover), :global(.main-menu-trigger[data-state="open"]), :global(.main-menu-trigger[data-open]), :global(.main-menu-trigger[data-popup-open]) { background: transparent; }
	:global(.mega-panel) { position: absolute; top: 100%; left: 32px; right: 32px; width: auto; margin: 0; max-height: calc(100dvh - 150px); overflow-y: auto; border: 1px solid var(--border); border-radius: 0 0 20px 20px; padding: 0; background: var(--background); box-shadow: 0 24px 50px -20px oklch(.3 .07 252 / .28); transform: none; animation: menu-enter 180ms ease-out; }
	@keyframes menu-enter { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
	.menu-eyebrow { display: block; font-size: 9px; font-weight: 600; line-height: 1.5; letter-spacing: .14em; }
	.menu-heading { margin-bottom: 18px; }
	.menu-heading .menu-eyebrow { color: var(--muted-foreground); }
	.menu-heading h2 { margin-top: 5px; font-size: 20px; font-weight: 600; letter-spacing: -.04em; line-height: 1.4; }
	.experience-menu, .island-menu { display: grid; grid-template-columns: 270px minmax(0, 1fr); gap: 28px; padding: 26px; }
	:global(.menu-feature) { position: relative; display: block; min-height: 285px; overflow: hidden; border-radius: 12px; padding: 0; color: white; isolation: isolate; }
	:global(.menu-feature)::after { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(180deg, rgb(5 20 28 / .03) 10%, rgb(5 20 28 / .85) 100%); }
	:global(.menu-feature > img) { position: absolute; inset: 0; z-index: -2; width: 100%; height: 100%; object-fit: cover; transition: transform 240ms ease-out; }
	:global(.menu-feature:hover > img) { transform: scale(1.035); }
	.feature-copy { position: absolute; inset-inline: 22px; bottom: 24px; }
	.feature-copy .menu-eyebrow { color: var(--sun); font-size: 8px; }
	.feature-copy h2 { margin-top: 9px; font-size: 21px; font-weight: 600; line-height: 1.35; letter-spacing: -.035em; }
	.feature-cta { display: flex; align-items: center; justify-content: space-between; margin-top: 18px; padding-top: 13px; border-top: 1px solid rgb(255 255 255 / .3); font-size: 11px; font-weight: 600; }
	.experience-options, .island-options { min-width: 0; padding-top: 3px; }
	.experience-links { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
	:global(.experience-link) { display: flex; align-items: center; gap: 13px; min-width: 0; padding: 10px; border: 1px solid transparent; border-radius: 12px; }
	:global(.experience-link:hover) { border-color: var(--border); background: var(--secondary); }
	:global(.experience-link > img) { width: 68px; height: 76px; flex-shrink: 0; border-radius: 9px; object-fit: cover; }
	:global(.experience-link strong), :global(.idea-link strong), :global(.planning-link strong) { display: block; font-size: 12px; font-weight: 600; line-height: 1.45; }
	:global(.experience-link small), :global(.idea-link small), :global(.planning-link small) { display: block; margin-top: 5px; color: var(--muted-foreground); font-size: 10px; line-height: 1.6; }
	:global(.menu-arrow) { margin-left: auto; flex-shrink: 0; color: var(--muted-foreground); }
	.popular-experiences { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 15px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 10px; }
	.popular-experiences > span { margin-right: 3px; color: var(--muted-foreground); }
	:global(.popular-link) { padding: 5px 9px; border-radius: 20px; background: var(--secondary); font-size: 10px; }
	:global(.tour-menu-link strong) { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
	.menu-empty { max-width: 420px; font-size: 12px; line-height: 1.8; color: var(--muted-foreground); }
	/* Stays: the three styles in their own colours, then a few featured properties. */
	.stay-style-links { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; }
	:global(.stay-style-link) { gap: 12px; min-width: 0; padding: 12px; border: 1px solid var(--border); border-radius: 12px; }
	:global(.stay-style-link:hover) { background: var(--style-light); }
	:global(.stay-style-link strong) { display: block; font-size: 12px; font-weight: 600; line-height: 1.45; }
	:global(.stay-style-link small) { display: block; margin-top: 3px; color: var(--muted-foreground); font-size: 10px; line-height: 1.5; }
	.stay-style-icon { display: grid; place-items: center; flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; background: var(--style-light); color: var(--style-ink); }
	.stay-menu-subheading { margin: 18px 0 8px; font-size: 9px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--muted-foreground); }
	.stay-menu-mark { display: grid; place-items: center; flex-shrink: 0; width: 68px; height: 76px; border-radius: 9px; background: var(--navy); color: var(--sun); }
	:global(.stay-menu-link) { padding-block: 6px; }
	:global(.stay-menu-link > img) { height: 60px; }
	:global(.stay-menu-link) .stay-menu-mark { height: 60px; }
	.destination-menu { padding: 25px 26px 20px; }
	.destination-columns { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 22px; }
	.destination-column { min-width: 0; }
	:global(.destination-cover) { display: block; padding: 0; border-radius: 10px; background: transparent; }
	:global(.destination-cover > img) { display: block; width: 100%; height: 110px; object-fit: cover; border-radius: 10px; }
	:global(.destination-cover > span) { display: block; margin-top: 12px; }
	:global(.destination-cover strong) { display: block; font-size: 13px; font-weight: 600; }
	:global(.destination-cover small) { display: block; margin-top: 4px; font-size: 10px; color: var(--muted-foreground); }
	:global(.destination-cover > svg) { display: none; }
	.destination-links { display: grid; gap: 1px; margin-top: 13px; }
	:global(.destination-link) { display: flex; justify-content: space-between; gap: 6px; padding: 7px 6px; margin-left: -6px; font-size: 11px; border-radius: 6px; line-height: 1.5; }
	:global(.destination-link > svg) { flex-shrink: 0; opacity: 0; transition: opacity 150ms ease-out; }
	:global(.destination-link:hover > svg), :global(.destination-link:focus-visible > svg) { opacity: 1; }
	.island-links { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px 16px; }
	:global(.idea-link) { justify-content: space-between; padding: 13px 10px; border-radius: 10px; }
	:global(.idea-link > svg) { flex-shrink: 0; }
	.planning-menu { display: grid; grid-template-columns: minmax(0,1fr) 280px; gap: 32px; padding: 28px; }
	.planning-links { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
	:global(.planning-link) { gap: 13px; padding: 16px 10px; border-radius: 10px; }
	:global(.planning-link > svg) { flex-shrink: 0; margin-left: auto; }
	.planning-icon { display: grid; place-items: center; flex-shrink: 0; width: 42px; height: 42px; border-radius: 12px; background: var(--secondary); }
	.planning-aside { border-radius: 12px; background: oklch(.97 .025 95); padding: 23px; }
	.planning-aside h2 { margin-top: 16px; font-size: 19px; font-weight: 600; line-height: 1.4; letter-spacing: -.04em; }
	.planning-aside p { margin-top: 10px; font-size: 11px; line-height: 1.7; color: var(--muted-foreground); }
	.menu-footer { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 13px 26px; border-top: 1px solid var(--border); background: oklch(.985 .003 250); }
	.menu-footer > span { display: flex; align-items: center; gap: 8px; font-size: 10px; color: var(--muted-foreground); }
	:global(.menu-footer-link) { display: flex; align-items: center; gap: 10px; padding: 5px 0; font-size: 11px; font-weight: 600; background: transparent; }
	.header-actions { display: flex; align-items: center; gap: 9px; }
	:global(.mobile-navigation) { display: none; }
    :global(.mobile-menu-panel) { display: flex; width: min(92vw,400px); flex-direction: column; gap: 0; padding: 0; overflow: hidden; background: white; }
    :global(.mobile-menu-header) { flex-shrink: 0; padding: 25px 22px; border-bottom: 1px solid var(--border); text-align: left; }
    .mobile-brand { display: flex; align-items: center; gap: 12px; }
    .site-logo { display: block; width: auto; height: 64px; }
    @media (max-width: 1099px) { .site-logo { height: 54px; } }
    .mobile-brand > span { display: grid; place-items: center; width: 42px; height: 42px; border: 1.5px solid var(--sun); border-radius: 50%; }
    .mobile-menu-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 24px 16px; }
    .mobile-menu-eyebrow { margin: 0 9px 16px; font-size: 9px; font-weight: 500; letter-spacing: .14em; color: var(--muted-foreground); }
    :global(.mobile-menu-accordion) { display: grid; gap: 8px; }
    :global(.mobile-menu-section) { overflow: hidden; border: 0; border-radius: 12px; background: var(--secondary); }
    :global(.mobile-section-trigger) { min-height: 54px; padding: 16px; border: 0; font-size: 13px; font-weight: 500; text-decoration: none; }
    :global(.mobile-section-trigger:hover) { text-decoration: none; }
    .mobile-section-label { display: flex; align-items: center; gap: 11px; }
    :global(.mobile-section-content) { padding: 0 7px 8px; }
    .mobile-menu-links { display: grid; gap: 3px; }
    .mobile-menu-link { display: flex; min-height: 46px; align-items: center; gap: 10px; padding: 8px; border-radius: 9px; color: var(--navy); text-decoration: none; font-size: 12px; line-height: 1.5; transition: background 160ms ease-out; }
    .mobile-menu-link:hover, .mobile-menu-link:focus-visible { background: white; text-decoration: none; }
    .mobile-menu-link img { width: 40px; height: 40px; flex-shrink: 0; object-fit: cover; border-radius: 7px; }
    .mobile-menu-link :global(svg) { flex-shrink: 0; margin-left: auto; color: var(--muted-foreground); }
    .mobile-view-all { margin-top: 5px; padding: 12px 10px 8px; min-height: 42px; font-size: 11px; font-weight: 600; }
    .mobile-idea-link { padding: 11px; }
    .mobile-idea-link small, .mobile-tour-meta { display: block; margin-top: 4px; font-size: 10px; color: var(--muted-foreground); }
    .mobile-menu-link .mobile-stay-mark { display: grid; place-items: center; width: 40px; height: 40px; flex-shrink: 0; margin-left: 0; border-radius: 7px; background: var(--navy); color: var(--sun); }
    .mobile-menu-link .mobile-style-mark { border-radius: 50%; background: var(--style-light); color: var(--style-ink); }
    .mobile-stay-mark :global(svg) { margin-left: 0; color: inherit; }
    .mobile-menu-footer { flex-shrink: 0; padding: 18px 22px max(22px,env(safe-area-inset-bottom)); border-top: 1px solid var(--border); }
    .mobile-menu-footer > p { margin-bottom: 12px; color: var(--muted-foreground); font-size: 10px; text-align: center; }

	@media (max-width: 1099px) { :global(.desktop-navigation), .header-actions { display: none; } :global(.mobile-navigation) { display: inline-flex; } .header-shell { padding-inline: 24px; } }
	@media (prefers-reduced-motion: reduce) { :global(.mega-panel) { animation: none; } }
</style>
