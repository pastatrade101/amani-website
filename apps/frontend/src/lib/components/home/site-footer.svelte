<script lang="ts">
	import { ArrowRight, ArrowUp, ChevronDown, Compass, MapPin, MessageCircle, Star } from '@lucide/svelte';
	import { destinationHref } from '$lib/destination-content';
	import { siteInfo } from '$lib/site-info';
	import { GUIDE_PAGE_KEYS, GUIDE_PATH, safeUrl } from '$lib/home-content';
	import { TRIPADVISOR_URL, WHATSAPP_URL } from '$lib/homepage-refresh';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import { planHref } from '$lib/planner/plan-href';
	import { resetConsent } from '$lib/admin/consent';
	import { tagMode } from '$lib/tracking/tags';
	import { onMount } from 'svelte';
	import AppTabBar from './app-tab-bar.svelte';
	import type { Category, Destination } from '$lib/types/api';

	let { visible, destinations, onInterest, onPage }: { visible: string[]; destinations: Destination[]; onInterest: (name: string) => void; onPage?: string[] } = $props();
	let canEnquire = $derived(visible.includes('enquiry'));
	// The CMS logo (Settings → branding); empty keeps the built-in mark.
	let logo = $derived(safeUrl(page.data.branding?.logo_url, ''));
	// Without onPage this is the home page; elsewhere a section missing from the page links home.
	const anchor = (id: string) => (!onPage || onPage.includes(id) ? `#${id}` : `/#${id}`);
	// The planning guides live on their own page.
	const guide = (id: string) => (onPage?.includes(id) ? `#${id}` : `${GUIDE_PATH}#${id}`);
	// "+255 743 900 014", read from the one WhatsApp link the site uses.
	const whatsappDigits = WHATSAPP_URL.replace(/\D/g, '');
	const whatsappNumber = `+${whatsappDigits.slice(0, 3)} ${whatsappDigits.slice(3, 6)} ${whatsappDigits.slice(6, 9)} ${whatsappDigits.slice(9)}`;
	// Pages pass the site chrome either spread into their data or under `chrome`.
	let categories = $derived(((page.data.categories ?? page.data.chrome?.categories ?? []) as Category[]).slice(0, 5));

	type FooterLink = { label: string; href: string; onclick?: () => void };
	let groups = $derived.by(() => {
		const safaris: FooterLink[] = [
			{ label: 'All safari tours', href: '/tours' },
			...categories.map((category) => ({ label: category.name, href: `/tours?category_id=${encodeURIComponent(category.id)}` })),
			...(visible.includes('experiences') ? [{ label: 'Safari experiences', href: anchor('experiences') }] : []),
			{ label: 'Where to stay', href: '/stays' }
		];
		const places: FooterLink[] = [
			...(visible.includes('destinations') ? destinations.slice(0, 6).map((destination) => ({ label: destination.name, href: destinationHref(destination) })) : []),
			{ label: 'All destinations', href: '/destinations' }
		];
		const plan: FooterLink[] = [
			...(GUIDE_PAGE_KEYS.some((key) => visible.includes(key)) ? [{ label: 'Safari guide', href: GUIDE_PATH }] : []),
			...(visible.includes('cost_ranges') ? [{ label: 'Safari costs', href: guide('cost-ranges') }] : []),
			...(visible.includes('safari_duration') ? [{ label: 'How long to stay', href: guide('safari-duration') }] : []),
			...(visible.includes('safari_day') ? [{ label: 'A day on safari', href: guide('safari-day') }] : []),
			...(visible.includes('when_to_go') ? [{ label: 'Best time to visit', href: anchor('when-to-go') }] : []),
			...(visible.includes('faq') ? [{ label: 'Your questions answered', href: guide('safari-questions') }] : []),
			...(visible.includes('why_us') ? [{ label: 'Why Key2africa', href: guide('why-key2africa') }] : []),
			...(canEnquire ? [{ label: 'Contact our team', href: anchor('request-quote'), onclick: () => onInterest('') }] : [])
		];
		return [
			{ id: 'safaris', title: 'Safaris', links: safaris },
			{ id: 'places', title: 'Destinations', links: places },
			{ id: 'plan', title: 'Plan your trip', links: plan }
		].filter((group) => group.links.length);
	});

	// Phones fold the link groups so the footer stays short; wider screens show them all.
	let folded = $state(false);
	let open = $state<Record<string, boolean>>({});
	// "Cookie settings" reopens the banner, so it only appears when Google tags are configured.
	let hasTags = $state(false);
	onMount(() => {
		hasTags = tagMode() !== null;
		const phones = matchMedia('(max-width: 767px)');
		const sync = () => (folded = phones.matches);
		sync();
		phones.addEventListener('change', sync);
		return () => phones.removeEventListener('change', sync);
	});
</script>

<footer class="site-footer">
	<div class="page-container">
		{#if canEnquire}
			<div data-motion="reveal" class="invite">
				<div>
					<h2>Start planning your Tanzania trip</h2>
					<p>Tell us your dates and interests, and our team in Arusha will send a free quote.</p>
				</div>
				<div class="invite-actions">
					<Button variant="safari" href={planHref({ from: 'footer' })} data-cta="plan_my_trip" data-cta-location="footer" class="h-12 px-6">Plan my safari <ArrowRight class="size-4" /></Button>
					<a class="chat" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" data-cta="whatsapp" data-cta-location="footer"><MessageCircle class="size-4" aria-hidden="true" />WhatsApp us</a>
				</div>
			</div>
		{/if}

		<div class="grid">
			<div class="brand" data-motion="reveal">
				<a href="/" aria-label={`${siteInfo.brand} home`} class="brand-mark">
					{#if logo}<span class="logo"><img src={logo} alt={siteInfo.brand} width="305" height="176" loading="lazy" /></span>
					{:else}<span class="grid size-11 place-items-center rounded-full border-2 border-sun"><Compass class="size-6" strokeWidth={1.5} /></span><strong class="text-xl">Key2africa</strong>{/if}
				</a>
				<p class="about">Thoughtfully planned journeys through Tanzania, from the wild heart of the savannah to the shores of the Indian Ocean.</p>
				<ul class="contact">
					<li><MessageCircle class="size-4" aria-hidden="true" /><a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">{whatsappNumber}<span>WhatsApp</span></a></li>
					<li><MapPin class="size-4" aria-hidden="true" /><span>Arusha, Tanzania</span></li>
					<li><Star class="size-4" aria-hidden="true" /><a href={TRIPADVISOR_URL} target="_blank" rel="noopener noreferrer">Our reviews on Tripadvisor</a></li>
				</ul>
			</div>

			{#each groups as group (group.id)}
				{@const shut = folded && !open[group.id]}
				<nav class="group" aria-labelledby={`footer-${group.id}`} data-motion="reveal">
					{#if folded}
						<h3 id={`footer-${group.id}`}><button type="button" aria-expanded={!shut} aria-controls={`footer-${group.id}-links`} onclick={() => (open = { ...open, [group.id]: !open[group.id] })}>{group.title}<ChevronDown class={`size-4 transition-transform ${shut ? '' : 'rotate-180'}`} aria-hidden="true" /></button></h3>
					{:else}
						<h3 id={`footer-${group.id}`}>{group.title}</h3>
					{/if}
					<ul id={`footer-${group.id}-links`} hidden={shut}>
						{#each group.links as link (link.href + link.label)}<li><a href={link.href} onclick={link.onclick}>{link.label}</a></li>{/each}
					</ul>
				</nav>
			{/each}
		</div>

		<div class="bottom">
			<p>© {new Date().getFullYear()} {siteInfo.company}</p>
			<div class="bottom-actions">
				{#if hasTags}<button type="button" onclick={resetConsent}>Cookie settings</button>{/if}
				<a href="#top">Back to top <ArrowUp class="size-3.5" aria-hidden="true" /></a>
			</div>
		</div>
	</div>
</footer>
<AppTabBar {canEnquire} />

<style>
	.site-footer { position: relative; overflow: hidden; padding-bottom: var(--compare-offset, 0px); background: var(--navy); color: #fff; }

	.invite { display: flex; align-items: center; justify-content: space-between; gap: 32px; padding: 56px 0 44px; border-bottom: 1px solid rgb(255 255 255 / 0.12); }
	.invite h2 { margin: 0; color: #fff; font-size: var(--text-h3); line-height: 1.15; }
	.invite p { margin: 10px 0 0; max-width: 52ch; color: rgb(255 255 255 / 0.7); font-size: var(--text-base); line-height: 1.6; }
	.invite-actions { display: flex; flex: none; flex-wrap: wrap; align-items: center; gap: 12px 24px; }
	.chat { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; color: #fff; font-size: var(--text-sm); font-weight: 600; text-decoration: none; transition: color 160ms ease-out; }
	.chat:hover { color: var(--sun); }

	.grid { display: grid; grid-template-columns: minmax(0, 1.35fr) repeat(3, minmax(0, 1fr)); gap: 48px; padding: 52px 0 48px; }
	.brand-mark { display: inline-flex; align-items: center; gap: 12px; color: #fff; text-decoration: none; }
	/* The logo's dark lettering needs a light ground on the dark footer. */
	.logo { display: inline-flex; border-radius: 10px; background: #fff; padding: 8px 12px; }
	.logo img { display: block; width: auto; height: 50px; }
	.about { max-width: 36ch; margin: 20px 0 0; color: rgb(255 255 255 / 0.62); font-size: var(--text-sm); line-height: 1.7; }
	.contact { display: grid; gap: 12px; margin: 22px 0 0; padding: 0; list-style: none; }
	.contact li { display: flex; align-items: flex-start; gap: 10px; color: rgb(255 255 255 / 0.85); font-size: var(--text-sm); line-height: 1.45; }
	.contact li > :global(svg) { flex: none; margin-top: 2px; color: var(--sun); }
	.contact a { color: inherit; text-decoration: none; transition: color 160ms ease-out; }
	.contact a:hover { color: #fff; }
	.contact a span { margin-left: 8px; color: rgb(255 255 255 / 0.5); font-size: var(--text-xs); }

	.group h3 { margin: 0; color: #fff; font-size: var(--text-sm); font-weight: 600; }
	.group ul { display: grid; gap: 11px; margin: 16px 0 0; padding: 0; list-style: none; }
	.group a { color: rgb(255 255 255 / 0.64); font-size: var(--text-sm); line-height: 1.5; text-decoration: none; transition: color 160ms ease-out; }
	.group a:hover { color: #fff; }

	.bottom { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 24px; padding: 22px 0 26px; border-top: 1px solid rgb(255 255 255 / 0.12); color: rgb(255 255 255 / 0.5); font-size: var(--text-xs); }
	.bottom p { margin: 0; }
	.bottom-actions { display: flex; align-items: center; gap: 22px; }
	.bottom-actions button, .bottom-actions a { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; color: rgb(255 255 255 / 0.75); text-decoration: none; transition: color 160ms ease-out; }
	.bottom-actions button:hover, .bottom-actions a:hover { color: #fff; }

	@media (max-width: 1023px) {
		.site-footer { padding-bottom: calc(var(--tab-offset, 0px) + var(--compare-offset, 0px)); }
		.grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 40px 32px; }
		.brand { grid-column: 1 / -1; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0 32px; align-items: start; }
		.brand .about { margin-top: 0; }
		.brand .contact { grid-column: 2; margin-top: 16px; }
		.brand-mark { grid-row: span 2; }
	}
	@media (max-width: 767px) {
		.invite { flex-direction: column; align-items: stretch; gap: 22px; padding: 40px 0 32px; }
		.invite-actions :global([data-slot='button']) { flex: 1; }
		.grid { display: block; padding: 32px 0 20px; }
		.brand { display: block; padding-bottom: 26px; }
		.brand .about { margin-top: 18px; }
		.brand .contact { margin-top: 18px; }
		.group { border-top: 1px solid rgb(255 255 255 / 0.12); }
		.group h3 button { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 54px; color: #fff; font: inherit; font-weight: 600; }
		.group ul { gap: 4px; margin: 0; padding-bottom: 16px; }
		.group a { display: flex; align-items: center; min-height: 40px; font-size: var(--text-base); }
		.group h3:not(:has(button)) { padding-top: 18px; }
		.bottom { flex-direction: column; align-items: flex-start; gap: 4px; }
	}
	@media (prefers-reduced-motion: reduce) { .chat, .contact a, .group a, .bottom-actions a, .bottom-actions button { transition: none; } }
</style>
