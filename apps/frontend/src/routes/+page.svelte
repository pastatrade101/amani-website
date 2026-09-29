<script lang="ts">
	import { ArrowRight, ArrowUpRight, Clock, MapPin } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import WhyAmani from '$lib/components/home/why-amani.svelte';
	import Planning from '$lib/components/home/planning.svelte';
	import Faq from '$lib/components/home/faq.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import Hero from '$lib/components/home/hero.svelte';
	import SearchPanel from '$lib/components/home/search.svelte';
	import Experiences from '$lib/components/home/experiences.svelte';
	import Destinations from '$lib/components/home/destinations.svelte';
	import Seasons from '$lib/components/home/seasons.svelte';
	import Enquiry from '$lib/components/home/enquiry.svelte';
	import { safeUrl, textContent } from '$lib/home-content';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let interest = $state('');
	let visible = $derived(data.sections.filter((section) => section.is_active !== false).map((section) => section.section_key));
	let hero = $derived(data.sections.find((section) => section.section_key === 'hero'));
	const chooseInterest = (name: string) => { interest = name; };
	function price(amount: string | number | null | undefined, currency: string) {
		if (amount == null || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return 'Price on request';
		try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(amount)); }
		catch { return `${amount} ${currency}`; }
	}
	function pageHref(page: number) {
		const params = new URLSearchParams({ ...data.filters, page: String(page) });
		for (const [key, value] of [...params]) if (!value) params.delete(key);
		return `/?${params}#tanzania-safari-packages`;
	}
</script>

<svelte:head>
	<title>{hero?.title || 'Tanzania Safaris'} | Amani Safaris</title>
	<meta name="description" content={textContent(hero?.content) || 'Discover Tanzania with Amani Safaris. Explore safari experiences, destinations and tailor-made itineraries.'} />
	<meta name="theme-color" content="#20354b" />
</svelte:head>
<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-sun focus:p-4">Skip to content</a>
<div id="top" class="border-b border-border bg-secondary/50"><div class="page-container flex items-center justify-between gap-4 py-2 text-[9px] text-muted-foreground"><p>Home <span class="mx-2">/</span> Destinations <span class="mx-2">/</span> <span class="text-primary">Tanzania Safari</span></p><span class="hidden tracking-wider sm:block">YOUR TANZANIA. YOUR WAY.</span></div></div>
<SiteHeader {visible} activities={data.activities} destinations={data.destinations} onInterest={chooseInterest} />
<main id="main">
	{#each data.sections.filter((section) => section.is_active !== false) as section (section.section_key)}
		{#if section.section_key === 'hero'}
			<Hero {section} canEnquire={visible.includes('enquiry')} showPackages={visible.includes('safari_packages')} />
			{#if visible.includes('safari_packages')}<SearchPanel destinations={data.destinationsAreReference ? [] : data.destinations} categories={data.categories} filters={data.filters} />{/if}
		{:else if section.section_key === 'why_us'}
			<WhyAmani {section} canEnquire={visible.includes('enquiry')} />
		{:else if section.section_key === 'how_it_works'}
			<Planning {section} canEnquire={visible.includes('enquiry')} />
		{:else if section.section_key === 'faq'}
			<Faq {section} canEnquire={visible.includes('enquiry')} />
		{:else if section.section_key === 'experiences'}
			<Experiences items={data.activities} {section} onInterest={chooseInterest} canEnquire={visible.includes('enquiry')} />
		{:else if section.section_key === 'destinations'}
			<Destinations items={data.destinations} {section} reference={data.destinationsAreReference} onInterest={chooseInterest} canEnquire={visible.includes('enquiry')} showPackages={visible.includes('safari_packages')} />
		{:else if section.section_key === 'safari_packages'}
			<section id="tanzania-safari-packages" class="my-6 bg-secondary/45 py-14 md:py-18">
				<div class="page-container">
					<div class="flex flex-wrap items-end justify-between gap-5"><div class="max-w-2xl"><p class="eyebrow text-muted-foreground">{section.subtitle}</p><h2 class="section-heading mt-3">{section.title}</h2><p class="mt-3 text-sm leading-7 text-muted-foreground">{textContent(section.content)}</p></div>{#if data.filters.search || data.filters.destination_id || data.filters.category_id}<Button href="/#tanzania-safari-packages" variant="outline">Clear filters</Button>{/if}</div>
					{#if data.filters.search}<p class="mt-5 text-sm">Results for “{data.filters.search}”</p>{/if}
					<div class="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{#each data.tours as tour}
							<Card.Root class="gap-0 overflow-hidden rounded-2xl py-0 shadow-none">
								<div class="relative"><img src={safeUrl(tour.main_image_url_thumbnail || tour.main_image_url, '/images/safari-hero.jpg')} alt={tour.title} loading="lazy" class="h-56 w-full object-cover" />{#if tour.budget_tier}<Badge class="absolute top-4 left-4 bg-white text-primary">{tour.budget_tier}</Badge>{/if}</div>
								<Card.Content class="flex flex-1 flex-col p-5"><div class="flex flex-wrap gap-4 text-[10px] text-muted-foreground"><span class="flex items-center gap-1"><Clock class="size-3" /> {tour.duration_days} days</span>{#if tour.destinations}<span class="flex items-center gap-1"><MapPin class="size-3" /> {tour.destinations.name}</span>{/if}</div><h3 class="mt-3 text-lg font-bold">{tour.title}</h3><p class="mt-3 line-clamp-3 text-xs leading-6 text-muted-foreground">{textContent(tour.short_description)}</p><div class="mt-auto flex items-end justify-between gap-4 pt-6"><p class="text-lg font-semibold">{#if Number(tour.price_from) > 0}<span class="block text-[10px] font-normal text-muted-foreground">From</span>{/if}{price(tour.price_from, tour.currency)}</p>{#if visible.includes('enquiry')}<Button href="#request-quote" onclick={() => chooseInterest(tour.title)} variant="safari" class="h-10 px-4 text-xs">Enquire <ArrowUpRight /></Button>{/if}</div></Card.Content>
							</Card.Root>
						{:else}
                            <div class="col-span-full grid overflow-hidden rounded-2xl border border-border bg-white md:grid-cols-2">
                                <img src="/images/tanzania-hero-3.jpg" alt="Hot air balloons drifting over the Serengeti at sunrise" loading="lazy" class="h-60 w-full object-cover md:h-full md:min-h-80" />
                                <div class="flex flex-col items-start justify-center p-7 md:p-10"><span class="eyebrow text-muted-foreground">MADE AROUND YOU</span><h3 class="mt-4 max-w-md text-2xl font-semibold tracking-tight md:text-3xl">{data.toursUnavailable ? 'Your safari starts with a conversation' : 'No safaris match your search yet'}</h3><p class="mt-4 max-w-md text-sm leading-7 text-muted-foreground">{data.toursUnavailable ? 'We can’t display our published itineraries right now. Share the places and experiences on your wish list, and let’s plan a personal Tanzania journey.' : 'Try a different destination or style, or let us create a trip around your interests.'}</p>{#if visible.includes('enquiry')}<Button variant="safari" href="#request-quote" class="mt-6 h-12 px-6">Create my safari <ArrowRight class="size-4" /></Button>{/if}</div>
                            </div>
						{/each}
					</div>
					{#if data.pageCount > 1}<nav aria-label="Safari search pages" class="mt-8 flex items-center justify-center gap-4"><Button href={pageHref(data.page - 1)} disabled={data.page <= 1} variant="outline">Previous</Button><span class="text-xs">Page {data.page} of {data.pageCount}</span><Button href={pageHref(data.page + 1)} disabled={data.page >= data.pageCount} variant="outline">Next</Button></nav>{/if}
				</div>
			</section>
		{:else if section.section_key === 'when_to_go'}
			<Seasons {section} />
		{:else if section.section_key === 'enquiry'}
			<Enquiry {section} {form} {interest} />
		{/if}
	{/each}
</main>
<SiteFooter {visible} destinations={data.destinations} onInterest={chooseInterest} />
