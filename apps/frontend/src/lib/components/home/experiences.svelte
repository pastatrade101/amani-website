<script lang="ts">
 import { ArrowRight } from '@lucide/svelte';
 import HomeCarousel from './home-carousel.svelte';
 import { homeExperiences, experiencePhoto } from '$lib/homepage-refresh';
 import { safeUrl,textContent } from '$lib/home-content';
 import type { Activity,Category,HomepageSection } from '$lib/types/api';
 let {items,section,categories=[]}:{items:Activity[];section:HomepageSection;categories?:Category[]}=$props();
 let cards=$derived(homeExperiences(section,categories,items));
</script>
<section id="experiences" class="home-band home-cream"><div class="home-container">
 <div class="max-w-2xl"><span class="block h-0.5 w-10 bg-sun"></span><h2 class="home-heading mt-4">{section.title}</h2><p class="home-copy mt-4">{textContent(section.content)}</p></div>
 {#if cards.length}<HomeCarousel items={cards} label="experiences">{#snippet card(item)}
 <a class="experience-card" href={safeUrl(item.href,'/tours')} aria-label={`Explore ${item.name}`}><img src={safeUrl(experiencePhoto(item),'/images/itinerary-game-drive.jpg')} alt={item.name} loading="lazy" /><div class="experience-heading">{#if item.meta}<p>{textContent(item.meta)}</p>{/if}<h3>{item.name}</h3></div><span class="experience-cta">{item.cta_label}<ArrowRight class="size-4" /></span></a>
 {/snippet}</HomeCarousel>{:else}<p class="mt-8 text-sm text-muted-foreground">New experiences are on their way. Our team can help you plan a personal journey.</p>{/if}
</div></section>
<style>
 .experience-card{position:relative;display:block;min-height:440px;overflow:hidden;border-radius:14px;background:var(--secondary);isolation:isolate}.experience-card>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}.experience-heading{padding:24px 22px 90px;background:linear-gradient(#ffffffed,#ffffff9c 65%,transparent)}.experience-heading p{font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#80602b;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.experience-heading h3{font-size:20px;line-height:1.35;font-weight:650;margin-top:7px;color:var(--navy)}.experience-cta{position:absolute;bottom:24px;left:22px;display:flex;align-items:center;gap:12px;border-radius:10px;background:var(--sun);color:var(--navy);padding:12px 20px;font-size:13px;font-weight:600}.experience-card:focus-visible{outline:3px solid var(--navy);outline-offset:2px}@media(max-width:639px){.experience-card{min-height:410px}}
</style>
