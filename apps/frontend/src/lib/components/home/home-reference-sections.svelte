<script lang="ts">
 import { ArrowRight, MapPin, Headset, ReceiptText, ShieldCheck, MessageCircle } from '@lucide/svelte';
 import { Button } from '$lib/components/ui/button';
 import HomeCarousel from './home-carousel.svelte';
 import { safeUrl,textContent } from '$lib/home-content';
 import { homeExperiences, experiencePhoto, refreshSections, WHATSAPP_URL } from '$lib/homepage-refresh';
 import type { HomepageSection, Category, Activity } from '$lib/types/api';
 let {section,categories=[],activities=[],heroFormAvailable=true}:{section:HomepageSection;categories?:Category[];activities?:Activity[];heroFormAvailable?:boolean}=$props();
 let fallback=$derived(refreshSections.find(s=>s.section_key===section.section_key));
 let rows=$derived((Array.isArray(section.extra_data?.rows)?section.extra_data.rows:fallback?.extra_data?.rows??[]) as {title:string;text:string}[]);
 let offers=$derived(homeExperiences(section,categories,activities));
 function ctaHref(value:string|null|undefined){const href=safeUrl(value,'#plan-form');return href==='#plan-form'&&!heroFormAvailable?'/plan-my-trip':href;}
 const icons=[MapPin,Headset,ReceiptText,ShieldCheck];
</script>
{#if section.section_key==='company_intro'}
<section class="home-band" id="about-key2africa"><div class="home-container intro-grid">
 <img class="intro-image" src={safeUrl(section.image_url,'/images/itinerary-game-drive.jpg')} alt="A safari journey in Tanzania" loading="lazy" width="900" height="675" />
 <div><p class="home-eyebrow">{section.subtitle}</p><h2 class="home-heading mt-4">{section.title}</h2><p class="home-copy mt-5">{textContent(section.content)}</p><div class="mt-7 flex flex-wrap items-center gap-5"><Button variant="safari" class="h-12 rounded-full px-7" href={ctaHref(section.button_url)}>{section.button_text||'Help Me Plan'}<ArrowRight class="size-4" /></Button><p class="border-l-4 border-sun pl-3 text-xs leading-6 text-muted-foreground">{String(section.extra_data?.footnote??fallback?.extra_data?.footnote??'')}</p></div></div>
</div></section>
{:else if section.section_key==='planning_cta'}
<section class="home-band"><div class="home-container"><div class="consultant-card">
 <img src={safeUrl(section.image_url,'/images/expert.jpg')} alt="Key2africa safari consultant" loading="lazy" width="245" height="245" />
 <div><h2 class="home-heading">{section.title}</h2><p class="home-copy mt-4">{textContent(section.content)}</p><div class="mt-6 flex flex-wrap gap-3"><Button variant="safari" class="h-12 rounded-full px-6" href={ctaHref(section.button_url)}>{section.button_text||'Request a Free Quote'}<ArrowRight class="size-4" /></Button><Button variant="outline" class="h-12 rounded-full border-green-600 px-6 text-green-800" href={safeUrl(String(section.extra_data?.secondary_cta_url??WHATSAPP_URL),WHATSAPP_URL)} target="_blank" rel="noopener noreferrer"><MessageCircle class="size-5" />{String(section.extra_data?.secondary_cta_text||'WhatsApp Us')}</Button></div></div>
</div></div></section>
{:else if section.section_key==='trust_features'}
<section class="home-band home-cream"><div class="home-container"><div class="text-center"><p class="home-eyebrow">{section.subtitle}</p><h2 class="home-heading mt-3">{section.title}</h2></div><ul class="trust-grid">{#each rows as row,i}{@const Icon=icons[i%icons.length]}<li class="flex items-start gap-4"><Icon class="mt-1 size-8 shrink-0 text-[#98723c]" strokeWidth={1.6} /><div><h3 class="text-base font-semibold">{row.title}</h3><p class="mt-2 text-sm leading-6 text-muted-foreground">{row.text}</p></div></li>{/each}</ul></div></section>
{:else if section.section_key==='safari_offers'}
<section class="home-band home-cream" id="safari-offers"><div class="home-container offers-grid"><div><p class="home-eyebrow">{section.subtitle}</p><h2 class="home-heading mt-4">{section.title}</h2><p class="home-copy mt-4">{textContent(section.content)}</p><Button variant="safari" class="mt-7 h-12 rounded-full px-6" href={ctaHref(section.button_url)}>{section.button_text||'Create My Safari'}<ArrowRight class="size-4" /></Button></div><div class="min-w-0">{#if offers.length}<HomeCarousel items={offers} label="safari experiences" columns={3}>{#snippet card(item)}<a href={safeUrl(item.href,'/tours')} class="offer-card"><img src={safeUrl(experiencePhoto(item),'/images/itinerary-game-drive.jpg')} alt={item.name} loading="lazy" /><div><h3>{item.name}</h3><p>{textContent(item.description)}</p></div></a>{/snippet}</HomeCarousel>{:else}<p class="rounded-xl border border-border p-6 text-sm">Tell us what you have in mind and we’ll help shape your safari.</p>{/if}</div></div></section>
{/if}
<style>
 .intro-grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:60px;align-items:center}.intro-image{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:20px}.consultant-card{display:grid;grid-template-columns:220px 1fr;align-items:center;gap:50px;max-width:1190px;margin:auto;padding:48px;border-radius:26px;background:white;border:1px solid var(--border);box-shadow:0 16px 45px -28px #36312b55}.consultant-card>img{width:220px;height:220px;border-radius:50%;object-fit:cover}.trust-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:32px;margin-top:48px}.offers-grid{display:grid;grid-template-columns:minmax(0,.32fr) minmax(0,.68fr);gap:44px;align-items:center}.offer-card{display:block;position:relative;min-height:400px;border-radius:18px;overflow:hidden;background:var(--navy);color:white}.offer-card>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.offer-card>div{position:absolute;inset:auto 0 0;padding:70px 20px 24px;background:linear-gradient(transparent,#14120fe8)}.offer-card h3{font-size:17px;font-weight:600;line-height:1.35}.offer-card p{display:-webkit-box;-webkit-line-clamp:3;line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:12px;line-height:1.65;margin-top:8px;color:#ffffffe0}
 @media(max-width:1023px){.intro-grid{gap:32px}.trust-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.offers-grid{grid-template-columns:1fr}.consultant-card{padding:32px;gap:32px;grid-template-columns:160px 1fr}.consultant-card>img{width:160px;height:160px}}
 @media(max-width:639px){.intro-grid{grid-template-columns:1fr}.consultant-card{display:flex;flex-direction:column;text-align:center;padding:28px 22px}.consultant-card :global(.flex){justify-content:center}.trust-grid{grid-template-columns:1fr;gap:28px}.offer-card{min-height:380px}}
</style>
