<script lang="ts">
  import '$lib/components/destinations/destination.css';
  import { ArrowDown, ArrowUpRight, ArrowRight, ChevronRight, Search } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as NativeSelect from '$lib/components/ui/native-select';
  import SiteHeader from '$lib/components/home/site-header.svelte';
  import SiteFooter from '$lib/components/home/site-footer.svelte';
  import Enquiry from '$lib/components/home/enquiry.svelte';
  import DestinationImage from '$lib/components/destinations/destination-image.svelte';
  import DestinationCard from '$lib/components/destinations/destination-card.svelte';
  import { destinationHref, destinationImage } from '$lib/destination-content';
  import { safeUrl, textContent } from '$lib/home-content';
  import { siteInfo } from '$lib/site-info';
  import type { PageProps } from './$types';
  let {data,form}:PageProps=$props();
  let interest=$state('Help me choose a destination');
  const chooseInterest=(name:string)=>{interest=name;};
  let chrome=$derived(data.chrome);
  let enquiry=$derived(chrome.sections.find(s=>s.section_key==='enquiry'&&s.is_active!==false));
  let content=$derived(chrome.sections.find(s=>s.section_key==='destinations'));
  let title=$derived(content?.title||'Find your place in Tanzania.');
  let description=$derived(textContent(content?.content)||'Wild places, island escapes and journeys that stay with you. Explore our destinations and find the places that belong in your story.');
  let hero=$derived(safeUrl(content?.image_url,'')||(data.featured?destinationImage(data.featured,true):''));
  let onPage=$derived(['top','destination-results',...(enquiry?['request-quote']:[])]);
  const circuits=[['','Every region'],['northern','Northern circuit'],['southern','Southern circuit'],['western','Western circuit'],['coast','Zanzibar & coast'],['other','More places']];
  const href=(page:number)=>{const q=new URLSearchParams();for(const[k,v]of Object.entries(data.filters))if(v)q.set(k,v);if(page>1)q.set('page',String(page));return `/destinations${q.size?'?'+q:''}#destination-results`;};
  let canonical=$derived(`${data.siteOrigin}/destinations`);
  let structured=$derived(JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:title,url:canonical,mainEntity:{'@type':'ItemList',itemListElement:data.items.map((d,i)=>({'@type':'ListItem',position:(data.page-1)*12+i+1,name:d.name,url:data.siteOrigin+destinationHref(d)}))}}).replace(/</g,'\\u003c'));
</script>
<svelte:head>
  <title>Destinations | {siteInfo.company}</title><meta name="description" content={description}/><link rel="canonical" href={canonical}/>
  {#if data.filters.search||data.filters.country||data.filters.circuit||data.page>1}<meta name="robots" content="noindex,follow"/>{/if}
  <meta property="og:title" content={`Destinations | ${siteInfo.brand}`}/><meta property="og:description" content={description}/><meta property="og:type" content="website"/><meta property="og:url" content={canonical}/>{#if hero}<meta property="og:image" content={new URL(hero,data.siteOrigin).href}/>{/if}<meta name="twitter:card" content="summary_large_image"/>
  {@html `<script type="application/ld+json">${structured}</script>`}
</svelte:head>
<a href="#main" class="sr-only focus:not-sr-only">Skip to content</a>
<SiteHeader visible={chrome.visible} activities={chrome.activities} destinations={chrome.destinations} tours={chrome.navTours} stays={chrome.navStays} categories={chrome.categories} onInterest={chooseInterest} {onPage}/>
<main id="main">
  <section id="top" class="destination-hero">
    <DestinationImage urls={[hero,data.featured?.main_image_url,data.featured?.image_url]} alt={data.featured?.name||'Discover our destinations'} fallback="/images/tanzania-hero-2.jpg" hero/>
    <div class="page-container destination-hero-inner">
      <nav aria-label="Breadcrumb" class="destination-breadcrumb"><a href="/">Home</a><ChevronRight size={12}/><span aria-current="page">Destinations</span></nav>
      <div class="destination-hero-main"><div class="destination-hero-copy"><p class="eyebrow">{content?.subtitle||'THE PLACES THAT STAY WITH YOU'}</p><h1>{title}</h1><p class="destination-hero-description">{description}</p><div class="destination-hero-actions"><Button href="#destination-results" variant="safari">Explore destinations <ArrowDown size={16}/></Button>{#if enquiry}<Button href="#request-quote" variant="outline" class="border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white">Help me choose <ArrowUpRight size={16}/></Button>{/if}</div></div>
      {#if data.featured}<a class="destination-featured" href={destinationHref(data.featured)}><p>Your next discovery</p><strong>{data.featured.name}</strong><span>{data.featured.region||data.featured.country}<ArrowUpRight size={19}/></span></a>{/if}</div>
    </div>
  </section>
  <div class="destination-index-bar"><div class="page-container"><span><strong>{data.catalogueTotal} destinations</strong> · Your journey starts with a place</span><span>Safari landscapes. Island time. Local stories.</span></div></div>
  <section id="destination-results" class="destination-section page-container">
    <div class="destination-section-head"><div><p class="eyebrow">CHOOSE YOUR NEXT CHAPTER</p><h2 class="section-heading">Somewhere extraordinary.</h2><p>Search for a place you already love, or discover somewhere you haven’t imagined yet.</p></div></div>
    <form method="GET" action="/destinations#destination-results" class="destination-search">
      <div><Label for="destination-query">Find a destination</Label><Input id="destination-query" name="search" value={data.filters.search} placeholder="Park, island or region…" class="mt-2 h-12 bg-white"/></div>
      <div><Label for="destination-country">Country</Label><NativeSelect.Root id="destination-country" name="country" value={data.filters.country} class="mt-2 w-full bg-white [&_select]:h-12"><option value="">All countries</option>{#each data.countries as country}<option value={country}>{country}</option>{/each}</NativeSelect.Root></div>
      <div><Label for="destination-circuit">Safari region</Label><NativeSelect.Root id="destination-circuit" name="circuit" value={data.filters.circuit} class="mt-2 w-full bg-white [&_select]:h-12">{#each circuits as [value,label]}<option {value}>{label}</option>{/each}</NativeSelect.Root></div>
      <Button type="submit" variant="safari" class="h-12"><Search size={17}/>Find my place</Button>
    </form>
    <div class="results-count"><p>{data.unavailable?'Destinations are temporarily unavailable':`${data.total} ${data.total===1?'destination':'destinations'} to explore`}</p>{#if data.filters.search||data.filters.country||data.filters.circuit}<a href="/destinations#destination-results">Clear filters</a>{/if}</div>
    {#if data.items.length}<div class="destination-grid">{#each data.items as destination (destination.id)}<DestinationCard {destination}/>{/each}</div>
    {:else}<div class="destination-empty"><h2>{data.unavailable?'Your next journey is still out there.':'Let’s try a different direction.'}</h2><p>{data.unavailable?'We couldn’t load our destination collection. Please try again shortly, or ask our team for ideas.':'No destinations match this view. Clear the filters to explore all our published places.'}</p><Button href="/destinations#destination-results" variant="outline">{data.unavailable?'Try again':'See all destinations'}</Button></div>{/if}
    {#if data.pageCount>1}<nav class="mt-10 flex items-center justify-center gap-4" aria-label="Destination pages"><Button href={href(data.page-1)} disabled={data.page<=1} variant="outline">Previous</Button><span class="text-xs">Page {data.page} of {data.pageCount}</span><Button href={href(data.page+1)} disabled={data.page>=data.pageCount} variant="outline">Next</Button></nav>{/if}
  </section>
  {#if enquiry}<section class="page-container pb-16"><div class="destination-cta"><div><p class="eyebrow">BETTER TOGETHER</p><h2>A journey is more than one destination.</h2><p>Tell us what you love. We’ll help connect the places, experiences and stays into a route that feels right for you.</p></div><Button href="#request-quote" variant="safari">Build my journey <ArrowRight size={17}/></Button></div></section><Enquiry section={enquiry} {form} {interest}/>{/if}
</main>
<SiteFooter visible={chrome.visible} destinations={chrome.destinations} onInterest={chooseInterest} {onPage}/>
<style>
.destination-search{display:grid;grid-template-columns:1.5fr 1fr 1fr auto;gap:18px;align-items:end;padding:24px;background:#f5f6f3;border:1px solid #e4e7e5;border-radius:16px}.destination-search>div{min-width:0}.results-count{display:flex;justify-content:space-between;gap:20px;font-size:12px;color:#647586;margin:26px 0}.results-count a{color:#14314d;text-decoration:underline;text-underline-offset:4px}@media(max-width:1023px){.destination-search{grid-template-columns:1fr 1fr}}@media(max-width:639px){.destination-search{grid-template-columns:minmax(0,1fr);padding:20px}}
</style>
