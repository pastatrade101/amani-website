<script lang="ts">
	import { ArrowRight, ArrowUp, Compass, MapPin } from '@lucide/svelte';
	import { destinationHref } from '$lib/destination-content';
	import { siteInfo } from '$lib/site-info';
	import { safeUrl } from '$lib/home-content';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Destination } from '$lib/types/api';
	let { visible, destinations, onInterest, onPage }: { visible: string[]; destinations: Destination[]; onInterest: (name: string) => void; onPage?: string[] } = $props();
	let canEnquire = $derived(visible.includes('enquiry'));
	// The CMS logo (Settings → branding); empty keeps the built-in mark.
	let logo = $derived(safeUrl(page.data.branding?.logo_url, ''));
	// Without onPage this is the home page; elsewhere a section missing from the page links home.
	const anchor = (id: string) => (!onPage || onPage.includes(id) ? `#${id}` : `/#${id}`);
</script>
<footer class="site-footer">
	<div class="page-container">
		{#if canEnquire}<div data-motion="reveal" class="footer-invitation"><div><p class="eyebrow">THE NEXT CHAPTER IS YOURS</p><h2>Let Tanzania stay with you.</h2><p>Extraordinary places. Personal journeys. Stories you’ll carry home.</p></div><Button variant="safari" href={anchor('request-quote')} class="h-12 shrink-0 px-7">Plan my safari <ArrowRight class="size-4" /></Button></div>{/if}
		<div class="footer-grid">
			<div data-motion="reveal" class="footer-brand"><a href="/" aria-label={`${siteInfo.brand} home`} class="inline-flex items-center gap-3">{#if logo}<span class="footer-logo"><img src={logo} alt={siteInfo.brand} width="305" height="176" loading="lazy" /></span>{:else}<span class="grid size-11 place-items-center rounded-full border-2 border-sun"><Compass class="size-6" strokeWidth={1.5} /></span><span><strong class="block text-2xl leading-none">Key2africa</strong><span class="mt-1.5 block text-[10px] uppercase tracking-[.2em] text-white/60">Safaris</span></span>{/if}</a><p class="footer-company">{siteInfo.company}</p><p>Thoughtfully planned journeys through Tanzania, from the wild heart of the savannah to the shores of the Indian Ocean.</p><span class="footer-location"><MapPin class="size-4" /> Tanzania, East Africa</span></div>
			<nav data-motion="reveal" aria-label="Explore in footer"><h3>Explore</h3><a href="/tours">Safari tours</a><a href="/stays">Where to stay</a>{#if visible.includes('experiences')}<a href={anchor('experiences')}>Safari experiences</a>{/if}<a href="/destinations">Destinations</a>{#if visible.includes('safari_packages')}<a href={anchor('tanzania-safari-packages')}>Safari packages</a>{/if}{#if canEnquire}<a href={anchor('request-quote')} onclick={() => onInterest('Safari + Zanzibar')}>Safari & Zanzibar</a>{/if}</nav>
			<nav data-motion="reveal" aria-label="Plan your trip in footer"><h3>Plan your trip</h3>{#if visible.includes('cost_ranges')}<a href={anchor('cost-ranges')}>Safari costs</a>{/if}{#if visible.includes('safari_duration')}<a href={anchor('safari-duration')}>How long to stay</a>{/if}{#if visible.includes('safari_day')}<a href={anchor('safari-day')}>A day on safari</a>{/if}{#if visible.includes('when_to_go')}<a href={anchor('when-to-go')}>Best time to visit</a>{/if}{#if visible.includes('how_it_works')}<a href={anchor('how-it-works')}>How it works</a>{/if}{#if visible.includes('faq')}<a href={anchor('safari-questions')}>Your questions answered</a>{/if}{#if canEnquire}<a href={anchor('request-quote')}>Contact our team</a>{/if}</nav>
			<nav data-motion="reveal" aria-label="Safari inspiration in footer"><h3>Find your inspiration</h3>{#if visible.includes('destinations')}{#each destinations.slice(0,4) as destination}<a href={destinationHref(destination)}>{destination.name}</a>{/each}{/if}{#if visible.includes('why_us')}<a href={anchor('why-key2africa')}>The Key2africa approach</a>{/if}</nav>
		</div>
		<div class="footer-bottom"><p>© {new Date().getFullYear()} {siteInfo.company}. All rights reserved.</p><p class="footer-motto">DISCOVER. EXPLORE. BELONG.</p><a href="#top" class="back-to-top">Back to top <ArrowUp class="size-3.5" /></a></div>
	</div>
</footer>
<style>
	.site-footer { position: relative; overflow: hidden; background: var(--navy); color: white; }
	.footer-invitation { display: flex; align-items: center; justify-content: space-between; gap: 35px; padding: 58px 0 48px; border-bottom: 1px solid rgb(255 255 255 / .14); }
	.footer-invitation .eyebrow { color: var(--sun); font-size: 9px; }
	.footer-invitation h2 { margin-top: 14px; font-size: clamp(26px,3vw,37px); font-weight: 500; line-height: 1.3; letter-spacing: -.045em; }
	.footer-invitation p:last-child { margin-top: 13px; color: rgb(255 255 255 / .65); font-size: 12px; line-height: 1.8; }
	.footer-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1.1fr; gap: 60px; padding: 54px 0; }
	/* The logo's dark lettering needs a light ground on the navy footer. */
	.footer-logo { display: inline-flex; border-radius: 14px; background: white; padding: 10px 14px; box-shadow: 0 10px 24px -18px rgb(0 0 0 / .6); }
	.footer-logo img { display: block; width: auto; height: 60px; }
	.footer-brand > p { max-width: 270px; margin-top: 23px; font-size: 12px; line-height: 1.9; color: rgb(255 255 255 / .6); }
	.footer-brand > .footer-company { margin-top: 20px; color: white; font-size: 12px; font-weight: 500; }
	.footer-company + p { margin-top: 10px; }
	.footer-location { display: flex; align-items: center; gap: 8px; margin-top: 20px; font-size: 11px; color: rgb(255 255 255 / .8); }
	nav { display: flex; flex-direction: column; align-items: start; gap: 15px; }
	nav h3 { margin-bottom: 7px; font-size: 12px; font-weight: 600; }
	nav a { font-size: 11px; line-height: 1.65; color: rgb(255 255 255 / .65); transition: color 160ms ease-out; }
	nav a:hover { color: var(--sun); }
	.footer-bottom { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px; border-top: 1px solid rgb(255 255 255 / .14); padding: 24px 0; color: rgb(255 255 255 / .5); font-size: 9px; }
	.footer-motto { letter-spacing: .16em; }
	.back-to-top { display: flex; align-items: center; gap: 8px; color: white; }
	@media (max-width: 1023px) { .footer-grid { gap: 30px; grid-template-columns: 1.25fr 1fr 1fr; } .footer-grid nav:last-child { display: none; } }
	@media (max-width: 639px) { .footer-invitation { flex-direction: column; align-items: start; padding-block: 42px; gap: 24px; } .footer-grid { grid-template-columns: 1fr 1fr; gap: 35px 20px; padding-block: 40px; } .footer-brand { grid-column: 1 / -1; } .footer-brand > p { max-width: 100%; } .footer-bottom { gap: 16px; } .footer-motto { display: none; } }
</style>
