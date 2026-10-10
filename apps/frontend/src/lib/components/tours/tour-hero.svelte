<script lang="ts">
 import { onMount } from 'svelte';
 import { ArrowRight, ChevronLeft, ChevronRight, ChevronDown, Clock, MapPin, Car, Users, Heart, Share2, Link, Mail, Check, Images, Compass } from '@lucide/svelte';
 import { Button } from '$lib/components/ui/button';
 import * as Popover from '$lib/components/ui/popover';
 import StayLightbox from '$lib/components/stays/detail/stay-lightbox.svelte';
 import { planHref } from '$lib/planner/plan-href';
 import { safeUrl } from '$lib/home-content';
 import { savedTours } from '$lib/saved-tours.svelte';
 import { formatPrice } from '$lib/safari-pricing';
 import { durationLabel, groupSizeLabel } from '$lib/tour-itinerary';
 import type { TourDetail } from '$lib/types/api';
 let { tour, image, from, canEnquire, hasPrices, onEnquire }: {tour:TourDetail;image:string;route:string[];from:{amount:number;currency:string}|null;canEnquire:boolean;hasPrices:boolean;onEnquire:()=>void}=$props();
 let duration=$derived(durationLabel(tour.duration_days,tour.duration_nights));
 let group=$derived(groupSizeLabel(tour.group_size_min,tour.group_size_max));
 let index=$state(0), lightbox=$state(false), lightboxIndex=$state(0), shareOpen=$state(false), copied=$state(false), pageUrl=$state('');
 let opener=$state<HTMLElement|null>(null);
 let strip=$state<HTMLDivElement>();
 let photos=$derived.by(()=>{
  const candidates=[{src:image,alt:tour.title,caption:''},...[...(tour.tour_images??[])].sort((a,b)=>a.sort_order-b.sort_order).map(p=>({src:p.image_url,alt:p.alt_text||p.caption||tour.title,caption:p.caption||''})),...[...(tour.itinerary_days??[])].sort((a,b)=>a.day_number-b.day_number).flatMap(d=>(d.image_urls??[]).map(src=>({src,alt:d.destination?.name||d.title,caption:d.destination?.name||d.title})))];
  const seen=new Set<string>();return candidates.filter(p=>{p.src=safeUrl(p.src,'');if(!p.src||p.src.startsWith('#')||seen.has(p.src))return false;seen.add(p.src);return true;}).map((p,i)=>({...p,id:String(i),category:''}));
 });
 let current=$derived(Math.min(index,Math.max(photos.length-1,0)));
 let saved=$derived(savedTours.has(tour.slug));
 let expert=$derived(tour.specialist?.status==='published'?tour.specialist:null);
 let enquiryHref=$derived(canEnquire?'#request-quote':planHref({tour:tour.slug,from:'tour_page'}));
 let facts=$derived([{icon:MapPin,label:'Tour starts',value:tour.start_point?.name},{icon:MapPin,label:'Tour ends',value:tour.end_point?.name},{icon:Clock,label:'Duration',value:duration},{icon:Car,label:'Safari type',value:tour.experience_type||tour.tour_categories?.name},{icon:Users,label:'Group size',value:group}].filter(f=>f.value));
 let destinationPhotos=$derived.by(()=>{const seen=new Set<string>();return [...(tour.itinerary_days??[])].sort((a,b)=>a.day_number-b.day_number).filter(d=>{const name=d.destination?.name;if(!name||seen.has(name)||!d.image_urls?.[0])return false;seen.add(name);return true;}).slice(0,3).map(d=>({name:d.destination!.name,src:safeUrl(d.image_urls![0],image),slug:d.destination?.slug}));});
 onMount(()=>{savedTours.load();pageUrl=window.location.href.split('#')[0];});
 function go(i:number){index=Math.max(0,Math.min(photos.length-1,i));if(strip){const item=strip.children[index] as HTMLElement;strip.scrollTo({left:item.offsetLeft-strip.offsetLeft,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}
 function syncScroll(){if(!strip)return;const w=strip.children[0]?.getBoundingClientRect().width??1;index=Math.min(photos.length-1,Math.round(strip.scrollLeft/(w+12)));}
 function openPhoto(i:number,event:MouseEvent){opener=event.currentTarget as HTMLElement;lightboxIndex=i;lightbox=true;}
 async function copy(){try{await navigator.clipboard.writeText(pageUrl);copied=true;}catch{copied=false;}}
</script>

<header class="border-b border-border/60 bg-white">
 <div class="tour-container py-6 sm:py-7">
  <nav aria-label="Breadcrumb"><ol class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><li><a href="/">Home</a></li><li><ChevronRight class="size-3" /></li><li><a href="/tours">Tanzania Safaris</a></li><li><ChevronRight class="size-3" /></li><li aria-current="page" class="text-primary">{tour.title}</li></ol></nav>
  <div class="mt-4 flex flex-wrap items-center justify-between gap-5">
   <div class="min-w-0 max-w-3xl"><h1 class="text-[28px] font-bold leading-tight tracking-tight text-primary sm:text-[32px]">{tour.title}</h1>{#if tour.tour_categories?.name}<p class="mt-2 text-sm text-muted-foreground">{tour.tour_categories.name}</p>{/if}</div>
   <div class="flex items-center gap-4">
    <Button variant="ghost" size="sm" aria-pressed={saved} aria-label={saved?'Remove safari from saved':'Save this safari'} onclick={()=>savedTours.toggle({slug:tour.slug,title:tour.title,image,duration})} class="gap-2 px-0 hover:bg-transparent"><Heart class={`size-4 ${saved?'fill-sun text-primary':''}`} />{saved?'Saved':'Save'}</Button><span class="h-5 w-px bg-border"></span>
    <Popover.Root bind:open={shareOpen}><Popover.Trigger aria-label="Share this safari" class="flex min-h-10 items-center gap-2 text-sm font-medium"><Share2 class="size-4" />Share</Popover.Trigger><Popover.Content align="end" class="w-64 p-2"><p class="px-3 py-2 text-xs font-semibold text-muted-foreground">Share this safari</p><a class="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-secondary" href={`https://wa.me/?text=${encodeURIComponent(tour.title+' '+pageUrl)}`} target="_blank" rel="noreferrer">WhatsApp<ArrowRight class="ml-auto size-4" /></a><a class="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-secondary" href={`mailto:?subject=${encodeURIComponent(tour.title)}&body=${encodeURIComponent(pageUrl)}`}><Mail class="size-4" />Email</a><button type="button" class="flex w-full items-center gap-3 rounded-lg p-3 text-sm hover:bg-secondary" onclick={copy}>{#if copied}<Check class="size-4" />Link copied{:else}<Link class="size-4" />Copy link{/if}</button></Popover.Content></Popover.Root>
   </div>
  </div>
 </div>
</header>
<section class="tour-container py-6 sm:py-8" aria-label="Safari overview">
 <div class="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_410px] lg:gap-8">
  <div class="min-w-0">
   <div class="relative hidden overflow-hidden rounded-2xl bg-secondary md:block">
    {#if photos[current]}<button type="button" class="block w-full" aria-label="Open safari photo gallery" onclick={e=>openPhoto(current,e)}><img src={photos[current].src} alt={photos[current].alt} width="1400" height="875" fetchpriority="high" class="aspect-[16/10] w-full object-cover" /></button>{/if}
    {#if photos.length>1}<Button variant="outline" size="icon" aria-label="Previous image" disabled={current===0} onclick={()=>go(current-1)} class="absolute top-1/2 left-4 size-10 -translate-y-1/2 rounded-full border-0 bg-white/90"><ChevronLeft class="size-5" /></Button><Button variant="outline" size="icon" aria-label="Next image" disabled={current===photos.length-1} onclick={()=>go(current+1)} class="absolute top-1/2 right-4 size-10 -translate-y-1/2 rounded-full border-0 bg-white/90"><ChevronRight class="size-5" /></Button>{/if}
    <button type="button" onclick={e=>openPhoto(current,e)} class="absolute right-4 bottom-4 flex min-h-10 items-center gap-2 rounded-lg bg-white/95 px-3 text-xs font-semibold"><Images class="size-4" />All {photos.length} photos</button>
   </div>
   <div bind:this={strip} onscroll={syncScroll} class="relative flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain [scrollbar-width:none] md:hidden" aria-label="Safari photo carousel">
    {#each photos as photo,i}<button type="button" aria-label={`Open photo ${i+1}: ${photo.alt}`} onclick={e=>openPhoto(i,e)} class="w-[92%] shrink-0 snap-start overflow-hidden rounded-2xl bg-secondary"><img src={photo.src} alt={photo.alt} loading={i===0?'eager':'lazy'} class="aspect-[16/11] w-full object-cover" /></button>{/each}
   </div>
   <p class="mt-3 text-center text-xs tabular-nums text-muted-foreground md:hidden" aria-live="polite">{current+1} / {photos.length} photos · Swipe to explore</p>
   {#if destinationPhotos.length}<div class="mt-5 hidden grid-cols-3 gap-4 md:grid">{#each destinationPhotos as photo}<a href={photo.slug?`/destinations/${photo.slug}`:'#itinerary'} class="group relative overflow-hidden rounded-xl bg-secondary"><img src={photo.src} alt={photo.name} loading="lazy" class="aspect-[4/3] w-full object-cover" /><span class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent px-4 pt-10 pb-4 text-xs font-semibold text-white">{photo.name}</span></a>{/each}</div>{/if}
  </div>
  <aside class="flex flex-col rounded-3xl border border-border bg-white p-6 shadow-[0_8px_40px_-20px_#14314d40] sm:p-7" aria-label="Plan this safari">
   <div><p class="text-sm text-muted-foreground">From</p><div class="mt-1 flex flex-wrap items-end gap-2"><p class="text-[32px] font-bold leading-tight text-primary">{from?formatPrice(from.amount,from.currency):'On request'}</p>{#if from}<span class="pb-1 text-sm text-muted-foreground">per person</span>{/if}</div>{#if hasPrices}<a href="#prices" class="mt-3 inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-xs font-semibold">View prices by group size<ChevronDown class="size-3.5" /></a>{/if}</div>
   <dl class="my-5">{#each facts as fact}<div class="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0"><dt class="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><fact.icon class="size-4" />{fact.label}</dt><dd class="text-right text-xs font-semibold leading-5 text-primary">{fact.value}</dd></div>{/each}</dl>
   <Button variant="safari" href={enquiryHref} onclick={onEnquire} class="h-12 w-full rounded-xl text-sm">Check availability<ArrowRight class="size-4" /></Button>
   <ul class="my-5 grid gap-4 text-xs"><li class="flex gap-3"><Check class="mt-0.5 size-4 shrink-0 text-success" /><div><strong class="font-semibold text-primary">A safari shaped around you</strong><p class="mt-1 leading-5 text-muted-foreground">Choose your dates, group and preferred experiences.</p></div></li><li class="flex gap-3"><Check class="mt-0.5 size-4 shrink-0 text-success" /><div><strong class="font-semibold text-primary">A personal quotation</strong><p class="mt-1 leading-5 text-muted-foreground">Confirm accommodation, availability and the final price with our team.</p></div></li></ul>
   <div class="mt-auto flex items-center gap-3 border-t border-border pt-5">{#if expert?.photo_url}<img src={safeUrl(expert.photo_url,'')} alt={expert.name} class="size-11 rounded-full object-cover" />{:else}<span class="grid size-11 shrink-0 place-items-center rounded-full bg-sun/20"><Compass class="size-5" /></span>{/if}<div><p class="text-sm font-semibold">{expert?.name||'Need help planning?'}</p><p class="mt-1 text-xs text-muted-foreground">{expert?.role||'Talk to the Key2africa safari team'}</p></div></div>
   <Button variant="outline" href={enquiryHref} onclick={onEnquire} class="mt-5 h-12 w-full rounded-lg border-primary text-sm"><Mail class="size-4" />Request a free quote</Button>
  </aside>
 </div>
</section>
<StayLightbox {photos} bind:open={lightbox} bind:index={lightboxIndex} title={tour.title} {opener} />
