<script lang="ts">
 import { enhance } from '$app/forms';
 import { ArrowRight, Check, ChevronLeft, ChevronRight, Star } from '@lucide/svelte';
 import { Button } from '$lib/components/ui/button';
 import { Input } from '$lib/components/ui/input';
 import { Label } from '$lib/components/ui/label';
 import { Textarea } from '$lib/components/ui/textarea';
 import { safeUrl,textContent } from '$lib/home-content';
 import { TRIPADVISOR_URL } from '$lib/homepage-refresh';
 import { validateHeroEnquiry,type HeroEnquiryResult } from '$lib/hero-enquiry';
 import { newTransactionId } from '$lib/tracking/data-layer';
 import { trackEvent } from '$lib/admin/analytics';
 import type { HomepageSection } from '$lib/types/api';
 let {section,canEnquire=true,showPackages=true,form=null,reviewTotal=0}:{section:HomepageSection;canEnquire?:boolean;showPackages?:boolean;form?:HeroEnquiryResult|null;reviewTotal?:number}=$props();
 let index=$state(0),sending=$state(false),sentAgain=$state(false);
 let name=$state(''),email=$state(''),details=$state('');
 let errors=$state<ReturnType<typeof validateHeroEnquiry>>({});
 let idempotencyKey=$state(newTransactionId());
 let extra=$derived(section.extra_data??{});
 let slides=$derived.by(()=>{const saved=Array.isArray(extra.hero_slides)?extra.hero_slides.filter(s=>s&&typeof s==='object'&&s.image_url):[];return saved.length?saved:[{image_url:section.image_url||'/images/tanzania-safari-hero.jpg'}];});
 let current=$derived(slides[index%slides.length] as Record<string,unknown>);
 let title=$derived(textContent(String(current.title||section.title||'Discover Tanzania. Your Way.')));
 let trust=$derived(Array.isArray(extra.trust_points)?extra.trust_points.map(String):['Locally Owned in Tanzania','Tailor-Made Experiences','Private 4×4 Safaris']);
 $effect(()=>{if(form?.values){name=form.values.full_name;email=form.values.email;details=form.values.details;errors=form.errors;} });
 function validate(){errors=validateHeroEnquiry({full_name:name,email,details});return !Object.keys(errors).length;}
</script>
<section class="home-hero" aria-label="Plan your Tanzania safari">
 <img class="hero-photo" src={safeUrl(String(current.image_url),'/images/tanzania-safari-hero.jpg')} alt="Tanzania safari landscape" fetchpriority="high" width="1920" height="1088" style={`object-fit:${['contain','scale-down'].includes(String(current.image_fit||extra.hero_image_fit))?String(current.image_fit||extra.hero_image_fit):'cover'}`} />
 <div class="hero-shade" aria-hidden="true"></div>
 <div class={`home-container hero-grid ${!canEnquire?'without-form':''}`}>
  <div class="hero-copy">
   <p class="hero-eyebrow">{String(current.eyebrow||section.subtitle||'TAILOR-MADE TANZANIA SAFARI HOLIDAYS')}</p>
   <h1>{title}{#if current.title_highlight||extra.title_highlight}<span class="text-sun"> {String(current.title_highlight||extra.title_highlight)}</span>{/if}</h1>
   <p class="hero-description">{textContent(String(current.subtitle||section.content||''))}</p>
   <div class="hero-actions">{#if canEnquire}<Button variant="safari" href={safeUrl(String(current.primary_url||section.button_url||'#plan-form'),'#plan-form')} class="h-12 rounded-full px-7 text-sm">{String(current.primary_label||section.button_text||extra.primary_cta_text||'Start Planning')}<ArrowRight class="size-4" /></Button>{/if}{#if showPackages}<a href={safeUrl(String(current.secondary_url||extra.secondary_cta_url||'/tours'),'/tours')} class="inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-white hover:text-sun">{String(current.secondary_label||extra.secondary_cta_text||'View Our Safaris')}<ArrowRight class="size-4" /></a>{/if}</div>
   <ul class="hero-trust">{#each trust as point}<li><Check class="size-4 shrink-0 text-sun" />{point}</li>{/each}</ul>
   <a href={safeUrl(String(extra.reviews_url||TRIPADVISOR_URL),TRIPADVISOR_URL)} target="_blank" rel="noopener noreferrer" class="rating-bar"><Star class="size-5 fill-[#a67d34] text-[#a67d34]" aria-hidden="true" /><span>{reviewTotal>0?`${reviewTotal} guest reviews`:'Traveller stories'}</span><span aria-hidden="true" class="text-border">|</span><strong>View us on TripAdvisor ↗</strong></a>
   {#if slides.length>1}<div class="mt-6 flex items-center gap-3"><Button variant="outline" size="icon" class="rounded-full bg-white/10 text-white" aria-label="Previous hero photo" onclick={()=>index=(index-1+slides.length)%slides.length}><ChevronLeft class="size-4" /></Button><span class="text-xs text-white/80">{index%slides.length+1} / {slides.length}</span><Button variant="outline" size="icon" class="rounded-full bg-white/10 text-white" aria-label="Next hero photo" onclick={()=>index=(index+1)%slides.length}><ChevronRight class="size-4" /></Button></div>{/if}
  </div>
  {#if canEnquire}<aside id="plan-form" class="hero-form" aria-labelledby="hero-form-title">
   <h2 id="hero-form-title">{String(extra.form_title||'Plan Your Safari')}</h2><p class="form-intro">{String(extra.form_intro||'Tell us about your trip and we’ll help create a personalized safari proposal.')}</p>
   {#if form?.success&&!sentAgain}<div role="status" class="mt-6 rounded-xl border border-sun/40 bg-sun/10 p-5 text-sm leading-7">{form.message}<button class="mt-4 block min-h-11 font-semibold text-sun" type="button" onclick={()=>{sentAgain=true;name='';email='';details='';}}>Send another request</button></div>
   {:else}<form method="POST" action="?/heroEnquire#plan-form" novalidate use:enhance={({cancel})=>{if(!validate()){cancel();return;}sending=true;return async({result,update})=>{try{await update({reset:false,invalidateAll:false});if(result.type==='success'&&result.data?.success){idempotencyKey=newTransactionId();sentAgain=false;name='';email='';details='';trackEvent('form_submitted',{form_name:'homepage_hero',lead_source:'enquiry_form',transaction_id:newTransactionId()});}}finally{sending=false;}};}}>
    {#if form?.message&&!form.success}<p role="alert" class="rounded-lg border border-sun/40 p-3 text-sm text-sun">{form.message}</p>{/if}
    <div><Label for="hero-name">Full name <span aria-hidden="true">*</span></Label><Input id="hero-name" name="full_name" bind:value={name} required minlength={2} maxlength={100} autocomplete="name" aria-invalid={Boolean(errors.full_name)} aria-describedby={errors.full_name?'hero-name-error':undefined} />{#if errors.full_name}<p id="hero-name-error" class="field-error">{errors.full_name}</p>{/if}</div>
    <div><Label for="hero-email">Email address <span aria-hidden="true">*</span></Label><Input id="hero-email" name="email" type="email" bind:value={email} required maxlength={254} autocomplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email?'hero-email-error':undefined} />{#if errors.email}<p id="hero-email-error" class="field-error">{errors.email}</p>{/if}</div>
    <div><Label for="hero-details">Special requests or additional details</Label><Textarea id="hero-details" name="details" bind:value={details} rows={4} maxlength={2000} aria-invalid={Boolean(errors.details)} aria-describedby={errors.details?'hero-details-error':undefined} placeholder="Your dates, group size, favourite places…" />{#if errors.details}<p id="hero-details-error" class="field-error">{errors.details}</p>{/if}</div>
    <input type="hidden" name="idempotency_key" value={idempotencyKey} /><div class="hidden" aria-hidden="true"><label for="hero-website">Website</label><input id="hero-website" name="website" tabindex="-1" autocomplete="off" /></div>
    <Button variant="safari" type="submit" disabled={sending} class="h-12 w-full rounded-full text-sm font-semibold">{sending?'Sending your request…':'Get My Safari Quote'}<ArrowRight class="size-4" /></Button><p class="privacy-note">We only use your details to reply to your safari request.</p>
   </form>{/if}
  </aside>{/if}
 </div>
</section>
<style>
 .home-hero{position:relative;isolation:isolate;background:var(--navy);color:white;overflow:hidden}.hero-photo,.hero-shade{position:absolute;inset:0;width:100%;height:100%;z-index:-2;object-position:60% center}.hero-shade{z-index:-1;background:linear-gradient(90deg,rgb(22 19 15 / .7),rgb(22 19 15 / .4) 60%,rgb(22 19 15 / .18))}.hero-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(350px,440px);align-items:center;gap:70px;min-height:740px;padding-block:64px}.hero-grid.without-form{grid-template-columns:1fr;min-height:620px}.hero-copy{max-width:650px}.hero-eyebrow{font-size:12px;font-weight:600;letter-spacing:.18em;color:var(--sun)}h1{font-size:clamp(34px,3.8vw,54px);line-height:1.12;font-weight:650;letter-spacing:-.035em;margin-top:22px;text-wrap:balance}.hero-description{font-size:16px;line-height:1.8;color:#ffffffdb;margin-top:24px;max-width:620px}.hero-actions{display:flex;align-items:center;flex-wrap:wrap;gap:26px;margin-top:28px}.hero-trust{display:flex;flex-wrap:wrap;gap:14px 24px;margin-top:28px}.hero-trust li{display:flex;align-items:center;gap:8px;font-size:12px}.rating-bar{display:inline-flex;align-items:center;flex-wrap:wrap;gap:10px;background:#fffffff5;color:var(--navy);border-radius:14px;padding:16px 18px;margin-top:26px;font-size:12px}.rating-bar strong{font-weight:600;color:#80602b}.hero-form{background:rgb(29 25 20 / .58);border:1px solid #ffffff26;border-radius:20px;padding:30px;backdrop-filter:blur(12px);box-shadow:0 24px 70px #0003;scroll-margin-top:120px}.hero-form h2{font-size:23px;font-weight:600}.form-intro{font-size:13px;line-height:1.75;color:#ffffffc4;margin-top:8px}.hero-form form{display:grid;gap:18px;margin-top:24px}.hero-form :global(label){font-size:12px;color:#fff;margin-bottom:8px;line-height:1.5}.hero-form :global(input:not([type=hidden])),.hero-form :global(textarea){background:rgb(255 255 255 / .09);border:1px solid rgb(255 255 255 / .24);color:white;border-radius:9px;font-size:14px;box-shadow:none}.hero-form :global(input:not([type=hidden])){height:46px}.hero-form :global(textarea){min-height:100px;line-height:1.7}.hero-form :global(textarea::placeholder){color:#ffffffad}.field-error{font-size:12px;color:var(--sun);margin-top:6px}.privacy-note{font-size:10px;line-height:1.7;color:#ffffffb0}
 @media(max-width:1100px){.hero-grid{gap:35px;grid-template-columns:minmax(0,1fr) 380px}.hero-form{padding:26px}}@media(max-width:900px){.hero-grid{grid-template-columns:1fr;gap:36px;padding-block:48px}.hero-copy{max-width:700px}.hero-form{width:100%;max-width:600px}.hero-shade{background:rgb(22 19 15 / .56)}}@media(max-width:639px){h1{font-size:34px}.hero-description{font-size:14px}.hero-grid{padding-block:40px}.hero-form{padding:24px 20px}.hero-trust{display:grid;gap:12px}.rating-bar{gap:8px;font-size:11px;padding:14px}.hero-actions{gap:18px}}
</style>
