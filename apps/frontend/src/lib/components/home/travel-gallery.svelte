<script lang="ts">
 import { ArrowLeft, ArrowRight, Pause, Play, Expand } from '@lucide/svelte';
 import { Button } from '$lib/components/ui/button';
 import * as Dialog from '$lib/components/ui/dialog';
 import { safeUrl, textContent } from '$lib/home-content';
 import type { HomepageSection } from '$lib/types/api';
 import type { GalleryPhoto } from '$lib/homepage-gallery';
 let { section, photos }: { section: HomepageSection; photos: GalleryPhoto[] } = $props();
 let paused = $state(false);
 let offset = $state(0);
 let selected = $state<GalleryPhoto | null>(null);
 let open = $state(false);
 let count = $derived(Math.min(4, photos.length));
 let columns = $derived(Array.from({length:count}, (_,i) => Array.from({length: Math.min(3,Math.ceil(photos.length/count))}, (_,j) => photos[(offset+i+j*count)%photos.length])));
 function move(direction:number){ paused=true; offset=(offset+direction+photos.length)%photos.length; }
</script>
{#if photos.length}
<section id="travel-gallery" class="travel-gallery" class:paused aria-label="Tanzania photo gallery">
 <div class="page-container gallery-heading"><div><p class="eyebrow">{section.subtitle}</p><h2 class="section-heading">{section.title}</h2><p class="gallery-description">{textContent(section.content)}</p></div><div class="gallery-controls">
  <Button variant="outline" size="icon" aria-label="Previous gallery photos" onclick={() => move(-1)} disabled={photos.length <= 1}><ArrowLeft class="size-4" /></Button>
  <Button variant="outline" size="icon" aria-label={paused ? 'Play gallery motion' : 'Pause gallery motion'} aria-pressed={paused} onclick={() => paused = !paused}>{#if paused}<Play class="size-4" />{:else}<Pause class="size-4" />{/if}</Button>
  <Button variant="outline" size="icon" aria-label="Next gallery photos" onclick={() => move(1)} disabled={photos.length <= 1}><ArrowRight class="size-4" /></Button>
 </div></div>
 <div class="gallery-window" style={`--columns:${count}`}>
  {#each columns as column, i}<div class="gallery-column" class:reverse={i%2===1}>{#each column as photo,j}<button type="button" class="gallery-frame" onclick={() => {selected=photo;open=true;paused=true;}} aria-label={`Open photo: ${photo.title || photo.alt_text || 'Tanzania journey'}`}><img src={safeUrl(photo.image_url,'')} alt={photo.alt_text || photo.title || 'Tanzania journey'} loading="lazy" /><span class="photo-caption"><span>{photo.title || photo.caption || 'Tanzania, through our lens'}</span><Expand size={17}/></span></button>{/each}</div>{/each}
 </div>
 {#if section.button_text && section.button_url}<div class="gallery-footer"><Button variant="safari" href={safeUrl(section.button_url)} class="rounded-full px-7">{section.button_text}<ArrowRight class="size-4"/></Button></div>{/if}
</section>
<Dialog.Root bind:open><Dialog.Content class="max-h-[92dvh] overflow-auto rounded-3xl sm:max-w-4xl"><Dialog.Header><Dialog.Title>{selected?.title || 'A glimpse of Tanzania'}</Dialog.Title><Dialog.Description>{selected?.caption || selected?.alt_text || 'From our Tanzania gallery'}</Dialog.Description></Dialog.Header>{#if selected}<img class="max-h-[65dvh] w-full rounded-xl object-contain" src={safeUrl(selected.image_url,'')} alt={selected.alt_text || selected.title || 'Tanzania journey'}/>{/if}</Dialog.Content></Dialog.Root>
{/if}
<style>
 .travel-gallery{background:#102b43;padding:64px 0 38px;color:white;overflow:hidden}.gallery-heading{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:35px}.gallery-heading>div:first-child{max-width:720px}.gallery-heading .eyebrow{color:#f6d21b}.gallery-heading h2{color:white;margin:12px 0}.gallery-description{font-size:14px;line-height:1.8;color:#c1cfda}.gallery-controls{display:flex;gap:8px;flex-shrink:0}.gallery-controls :global(button){border-radius:50%;background:transparent;color:white;border-color:#ffffff40}.gallery-controls :global(button:hover){background:#f6d21b;color:#14314d}.gallery-window{display:grid;grid-template-columns:repeat(var(--columns),minmax(0,1fr));gap:20px;height:610px;overflow:hidden;padding:0 20px;mask-image:linear-gradient(transparent,#000 5%,#000 95%,transparent)}.gallery-column{display:grid;align-content:start;gap:20px;animation:gallery-drift 14s cubic-bezier(.45,0,.55,1) infinite alternate;will-change:transform}.gallery-column.reverse{animation-direction:alternate-reverse}.gallery-frame{position:relative;display:block;width:100%;height:310px;border-radius:20px;overflow:hidden;border:0;padding:0;background:#203e55;text-align:left;color:white;cursor:pointer}.gallery-frame img{width:100%;height:100%;object-fit:cover;transition:transform .5s cubic-bezier(.4,0,.2,1)}.photo-caption{position:absolute;inset:auto 0 0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:42px 20px 18px;background:linear-gradient(transparent,#071a2ddd);font-size:12px;font-weight:500}.photo-caption>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gallery-frame:hover img{transform:scale(1.04)}.gallery-frame:focus-visible{outline:3px solid #f6d21b;outline-offset:-4px}.gallery-footer{text-align:center;padding-top:25px}.paused .gallery-column,.travel-gallery:hover .gallery-column,.travel-gallery:focus-within .gallery-column{animation-play-state:paused}@keyframes gallery-drift{from{transform:translateY(0)}to{transform:translateY(-80px)}}
 @media(max-width:767px){.travel-gallery{padding-top:44px}.gallery-heading{align-items:start;flex-direction:column}.gallery-window{height:470px;gap:12px;padding:0 12px;grid-template-columns:repeat(2,minmax(0,1fr))}.gallery-column{gap:12px}.gallery-column:nth-child(n+3){display:none}.gallery-frame{height:255px;border-radius:16px}.photo-caption{padding:30px 12px 14px;font-size:11px}}
 @media(prefers-reduced-motion:reduce){.gallery-column{animation:none;will-change:auto}.gallery-frame img{transition:none}.gallery-frame:hover img{transform:none}}
</style>
