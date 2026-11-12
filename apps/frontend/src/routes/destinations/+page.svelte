<script lang="ts">
	import { PHOTO } from '$lib/media-photos';
  import '$lib/components/destinations/destination.css';
  import { ArrowDown, ArrowUpRight, ArrowRight, Search } from '@lucide/svelte';
  import { glide } from '$lib/motion/glide';
  import PageHero from '$lib/components/page-hero.svelte';
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
  import { planHref } from '$lib/planner/plan-href';
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
  // A region chip keeps the search and country, and starts again from page one.
  const regionHref=(circuit:string)=>{const q=new URLSearchParams();if(data.filters.search)q.set('search',data.filters.search);if(data.filters.country)q.set('country',data.filters.country);if(circuit)q.set('circuit',circuit);return `/destinations${q.size?'?'+q:''}#destination-results`;};
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
  <PageHero titleId="destinations-title" crumbs={[{label:'Home',href:'/'},{label:'Destinations'}]} eyebrow={content?.subtitle||'The places that stay with you'} {title} intro={description}>
    {#snippet media()}<DestinationImage urls={[hero,data.featured?.main_image_url,data.featured?.image_url]} alt={data.featured?.name||'Discover our destinations'} fallback={PHOTO.acaciaHaze} hero/>{/snippet}
    {#snippet actions()}<Button href="#destination-results" variant="safari">Explore destinations <ArrowDown size={16}/></Button>{#if enquiry}<Button href={planHref({from:'destinations'})} data-cta="plan_my_trip" data-cta-location="destinations" variant="outline">Help me choose</Button>{/if}{/snippet}
    {#snippet aside()}{#if data.featured}<a class="destination-featured" href={destinationHref(data.featured)}><p>Featured</p><strong>{data.featured.name}</strong><span>{data.featured.region||data.featured.country}<ArrowUpRight size={19}/></span></a>{/if}{/snippet}
  </PageHero>
  <section id="destination-results" class="destination-section page-container">
    <div class="destination-section-head"><div><h2 class="home-heading">{data.catalogueTotal ? `${data.catalogueTotal} parks, islands and regions` : 'Parks, islands and regions'}</h2><p>Search by name, or narrow the list by country and safari region.</p></div></div>
    <nav class="region-switch" aria-label="Safari region" use:glide={{ center: true }}>{#each circuits as [value,label]}<a href={regionHref(value)} data-sveltekit-noscroll aria-current={(data.filters.circuit||'')===value?'true':undefined}>{label}</a>{/each}</nav>
    <form method="GET" action="/destinations#destination-results" class="destination-search">
      <div><Label for="destination-query">Find a destination</Label><Input id="destination-query" name="search" value={data.filters.search} placeholder="Park, island or region…" class="mt-2 h-12 bg-white"/></div>
      <div><Label for="destination-country">Country</Label><NativeSelect.Root id="destination-country" name="country" value={data.filters.country} class="mt-2 w-full bg-white [&_select]:h-12"><option value="">All countries</option>{#each data.countries as country}<option value={country}>{country}</option>{/each}</NativeSelect.Root></div>
      {#if data.filters.circuit}<input type="hidden" name="circuit" value={data.filters.circuit}/>{/if}
      <Button type="submit" variant="safari" class="h-12"><Search size={17}/>Search</Button>
    </form>
    <div class="results-count"><p>{data.unavailable?'Destinations are temporarily unavailable':`Showing ${data.total} ${data.total===1?'place':'places'}`}</p>{#if data.filters.search||data.filters.country||data.filters.circuit}<a href="/destinations#destination-results" data-sveltekit-noscroll>Clear filters</a>{/if}</div>
    {#if data.items.length}<div class="destination-grid destination-tiles">{#each data.items as destination (destination.id)}<DestinationCard {destination}/>{/each}</div>
    {:else}<div class="destination-empty"><h2>{data.unavailable?'We can’t show our destinations right now':'No places match this search'}</h2><p>{data.unavailable?'Please try again shortly, or ask our team for ideas.':'Clear the filters to see every place we visit.'}</p><Button href="/destinations#destination-results" variant="outline">{data.unavailable?'Try again':'See all destinations'}</Button></div>{/if}
    {#if data.pageCount>1}<nav class="mt-10 flex items-center justify-center gap-4" aria-label="Destination pages"><Button href={href(data.page-1)} disabled={data.page<=1} variant="outline">Previous</Button><span class="text-xs">Page {data.page} of {data.pageCount}</span><Button href={href(data.page+1)} disabled={data.page>=data.pageCount} variant="outline">Next</Button></nav>{/if}
  </section>
  {#if enquiry}<section class="page-container pb-16"><div class="destination-cta"><div><h2>Not sure which places to combine?</h2><p>Tell us what you’d like to see and do. We’ll suggest a route: which parks and islands, how long in each, and where to stay.</p></div><Button href={planHref({from:'destinations'})} data-cta="plan_my_trip" data-cta-location="destinations" variant="safari">Plan my route <ArrowRight size={17}/></Button></div></section><Enquiry section={enquiry} {form} {interest}/>{/if}
</main>
<SiteFooter visible={chrome.visible} destinations={chrome.destinations} onInterest={chooseInterest} {onPage}/>
<style>
.destination-search{display:grid;grid-template-columns:1.6fr 1fr auto;gap:14px;align-items:end;margin-top:18px;padding:18px;background:white;border-radius:12px;box-shadow:0 0 0 1px rgb(43 39 34/.08),0 14px 32px -26px rgb(39 36 31/.4)}.destination-search>div{min-width:0}
.results-count{display:flex;justify-content:space-between;gap:20px;font-size:13px;color:var(--muted-foreground);margin:24px 0 16px}.results-count a{color:var(--navy);font-weight:700;text-decoration:none}
/* Regions: chips under a gliding marker, one tap to filter. */
.region-switch{display:flex;gap:8px;margin-top:26px;overflow-x:auto;scrollbar-width:none}.region-switch::-webkit-scrollbar{display:none}
.region-switch :global(.glide-mark){border-radius:9px;background:var(--navy);box-shadow:0 10px 20px -12px rgb(31 27 22/.8)}
.region-switch a{position:relative;display:inline-flex;flex:none;align-items:center;min-height:44px;padding:0 18px;border-radius:9px;color:#5f584e;font-size:14px;font-weight:600;text-decoration:none;white-space:nowrap;-webkit-tap-highlight-color:transparent;transition:color .45s cubic-bezier(.22,1,.36,1)}
.region-switch a::before{content:'';position:absolute;inset:0;z-index:-2;border-radius:inherit;background:#ebe6da;transition:background-color .2s ease}
.region-switch a:hover{color:var(--navy)}.region-switch a:hover::before{background:#e3ddcf}.region-switch a[aria-current='true']{color:white}.region-switch a:focus-visible{outline:2px solid var(--sun);outline-offset:2px}
@media(max-width:1023px){.destination-search{grid-template-columns:1fr 1fr}.destination-search>div:first-child{grid-column:1/-1}}
@media(max-width:639px){.region-switch{margin-inline:-1rem;padding:2px 1rem}.destination-search{grid-template-columns:minmax(0,1fr) auto;padding:14px}.destination-search>div:first-child{grid-column:auto}.destination-search>div:nth-child(2){grid-column:1/-1;order:2}.destination-search :global(input){font-size:16px}}
@media(prefers-reduced-motion:reduce){.region-switch a{transition:none}}
</style>
