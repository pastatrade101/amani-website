<script lang="ts">
 import { ArrowRight, Compass, HeartHandshake, Route, ShieldCheck, Map, Sparkles } from '@lucide/svelte';
 import { Button } from '$lib/components/ui/button';
 import { safeUrl, textContent } from '$lib/home-content';
 import type { HomepageSection } from '$lib/types/api';
 let { section, canEnquire }: { section: HomepageSection; canEnquire: boolean } = $props();
 let failedIcons = $state<string[]>([]);
 const icons = [Route, Compass, HeartHandshake, ShieldCheck, Sparkles, Map];
 const brandText = (text?: string | null) => (text || '').replace(/goldfinch(?: adventures)?/gi, 'Key2africa');
 const defaults = [
  { title: 'Local knowledge. Personal connections.', text: 'Explore Tanzania with a team that knows its parks, people and hidden corners.', icon_url: '/images/icons-home/icon-local-knowledge.png' },
  { title: 'A journey shaped around you', text: 'Your interests, your travel dates, your pace. Every detail thoughtfully brought together.', icon_url: '/images/icons-home/icon-planned.png' },
  { title: 'Real people, every step of the way', text: 'From your first idea to your final transfer, our local team helps you travel with confidence.', icon_url: '/images/icons-home/icon-real-support.png' }
 ];
 let reasons = $derived((Array.isArray(section.extra_data?.features) ? section.extra_data.features : defaults) as typeof defaults);
</script>
<section id="why-key2africa" class="why-section">
 <div class="page-container why-grid">
  <div class="why-copy"><p class="eyebrow">{brandText(section.subtitle)}</p><h2 class="section-heading mt-4">{brandText(section.title)}</h2><p class="section-description mt-5">{brandText(textContent(section.content))}</p>
   {#if canEnquire}<Button variant="safari" href={safeUrl(section.button_url === '#lead-form' ? '#request-quote' : section.button_url)} class="mt-7 h-12 rounded-full px-7">{section.button_text || 'Plan my safari'} <ArrowRight class="size-4" /></Button>{/if}
   {#if section.image_url}<img class="intro-image" src={safeUrl(section.image_url, '')} alt="Discover Tanzania with our local team" loading="lazy" />{/if}
  </div>
  <div class="reason-list">{#each reasons.filter(reason => reason.title?.trim()) as reason, i}{@const Icon = icons[i % icons.length]}<article class="reason" style={`--card-index:${i}`}><div><span class="reason-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</span><h3>{reason.title}</h3><p>{textContent(reason.text)}</p></div><span class="reason-art">{#if reason.icon_url && !failedIcons.includes(reason.icon_url)}<img src={safeUrl(reason.icon_url, '')} alt="" loading="lazy" onerror={() => failedIcons = [...failedIcons, reason.icon_url]} />{:else}<Icon size={60} strokeWidth={1} />{/if}</span></article>{/each}</div>
 </div>
</section>
<style>
 .why-section{padding:90px 0}.why-grid{display:grid;grid-template-columns:.85fr 1.15fr;gap:80px;align-items:start}.why-copy{position:sticky;top:125px}.why-copy .eyebrow{color:#8b742a}.why-copy :global(a){max-width:100%;white-space:normal}.intro-image{width:100%;height:210px;object-fit:cover;border-radius:24px;margin-top:30px}.reason-list{display:grid;grid-auto-rows:1fr;gap:48px;padding-bottom:48px;isolation:isolate}.reason{position:sticky;top:calc(125px + var(--card-index) * 12px);z-index:var(--card-index);min-height:280px;box-shadow:0 -1px 0 #14314d0a,0 12px 32px -24px #14314d55;display:grid;grid-template-columns:1fr 116px;gap:20px;align-items:center;padding:30px 32px;background:#faf3da;border-radius:28px;overflow:hidden}.reason:nth-child(3n+2){background:#eef3f6}.reason:nth-child(3n){background:#f3f0e8}.reason-number{display:block;font-size:68px;line-height:.95;font-weight:700;letter-spacing:-5px;color:#14314d22;margin-bottom:14px}.reason h3{font-size:21px;line-height:1.35;font-weight:600;letter-spacing:-.5px}.reason p{font-size:13px;line-height:1.85;color:#57697a;margin-top:12px}.reason-art{display:grid;place-items:center;width:116px;height:130px}.reason-art img{width:100%;height:100%;object-fit:contain;transition:transform .45s cubic-bezier(.4,0,.2,1)}.reason:hover .reason-art img{transform:rotate(-3deg) scale(1.04)}
 @media(max-width:1023px){.why-grid{gap:35px;grid-template-columns:1fr 1.2fr}.reason{padding:24px;grid-template-columns:1fr 80px}.reason-art{width:80px;height:100px}}
 @media(max-width:767px){.why-section{padding:56px 0}.why-grid{grid-template-columns:1fr;gap:28px}.why-copy{position:static}.reason-list{gap:32px;padding-bottom:32px}.reason{top:calc(92px + var(--card-index) * 8px);min-height:260px}.reason h3{font-size:19px}.reason-number{font-size:52px}.intro-image{display:none}}
 @media(max-height:600px){.reason,.why-copy{position:static}}
 @media(prefers-reduced-motion:reduce){.reason-art img{transition:none}.reason:hover .reason-art img{transform:none}}
</style>
