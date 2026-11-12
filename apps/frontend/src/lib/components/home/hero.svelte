<script lang="ts">
 import { onMount } from 'svelte';
 import { PHOTO } from '$lib/media-photos';
 import { enhance } from '$app/forms';
 import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Star } from '@lucide/svelte';
 import { Button } from '$lib/components/ui/button';
 import { safeUrl,textContent } from '$lib/home-content';
 import { TRIPADVISOR_URL } from '$lib/homepage-refresh';
 import { HERO_STYLES,validateHeroEnquiry,validateTripBasics,type HeroEnquiryErrors,type HeroEnquiryResult } from '$lib/hero-enquiry';
 import { newTransactionId } from '$lib/tracking/data-layer';
 import { trackEvent } from '$lib/admin/analytics';
 import type { HomepageSection } from '$lib/types/api';
 let {section,canEnquire=true,showPackages=true,form=null,reviewTotal=0,reviewAverage=null}:{section:HomepageSection;canEnquire?:boolean;showPackages?:boolean;form?:HeroEnquiryResult|null;reviewTotal?:number;reviewAverage?:number|null}=$props();
 let index=$state(0),sending=$state(false),sentAgain=$state(false);
 // Two steps once the page is interactive; without JavaScript every field shows in one form.
 let ready=$state(false),step=$state<1|2>(1);
 onMount(()=>{ready=true;});
 let travelDate=$state(''),adults=$state('2'),children=$state('0'),style=$state('');
 let name=$state(''),email=$state(''),details=$state('');
 let errors=$state<HeroEnquiryErrors>({});
 let idempotencyKey=$state(newTransactionId());
 const today=new Date().toISOString().slice(0,10);
 let extra=$derived(section.extra_data??{});
 let slides=$derived.by(()=>{const saved=Array.isArray(extra.hero_slides)?extra.hero_slides.filter(s=>s&&typeof s==='object'&&s.image_url):[];return saved.length?saved:[{image_url:section.image_url||PHOTO.balloonPlains}];});
 let current=$derived(slides[index%slides.length] as Record<string,unknown>);
 let title=$derived(textContent(String(current.title||section.title||'Discover Tanzania. Your Way.')));
 let trust=$derived(Array.isArray(extra.trust_points)?extra.trust_points.map(String):['Locally owned in Tanzania','Planned around you','Private 4×4 safaris']);
 // The rating comes from the approved reviews themselves.
 let stars=$derived(reviewAverage?Math.round(reviewAverage):0);
 let ratingLabel=$derived(reviewAverage==null?'':reviewAverage>=4.95?'5-Star':`${reviewAverage.toFixed(1)} / 5`);
 $effect(()=>{if(form?.values){const v=form.values;name=v.full_name;email=v.email;details=v.details;travelDate=v.travel_date??'';adults=v.adults||'2';children=v.children||'0';style=v.accommodation_style??'';errors=form.errors;step=Object.keys(validateTripBasics(v,true,today)).length?1:2;}});
 const values=()=>({full_name:name,email,details,travel_date:travelDate,adults,children,accommodation_style:style});
 function next(){errors=validateTripBasics(values(),true,today);if(Object.keys(errors).length)return;step=2;queueMicrotask(()=>document.getElementById('hero-name')?.focus());}
 function validate(){errors={...validateTripBasics(values(),true,today),...validateHeroEnquiry(values(),today)};if(Object.keys(validateTripBasics(values(),true,today)).length)step=1;return !Object.keys(errors).length;}
 function reset(){sentAgain=true;name='';email='';details='';travelDate='';adults='2';children='0';style='';step=1;}
</script>
<section class="home-hero" aria-label="Plan your Tanzania safari">
 <img class="hero-photo" src={safeUrl(String(current.image_url),PHOTO.balloonPlains)} alt="Tanzania safari landscape" fetchpriority="high" width="1920" height="1088" style={`object-fit:${['contain','scale-down'].includes(String(current.image_fit||extra.hero_image_fit))?String(current.image_fit||extra.hero_image_fit):'cover'}`} />
 <div class="hero-shade" aria-hidden="true"></div>
 <div class={`home-container hero-grid ${!canEnquire?'without-form':''}`}>
  <div class="hero-copy">
   <p class="hero-eyebrow" data-motion="hero">{String(current.eyebrow||section.subtitle||'TAILOR-MADE TANZANIA SAFARI HOLIDAYS')}</p>
   <h1 data-motion="hero" data-motion-delay="0.08">{title}{#if current.title_highlight||extra.title_highlight}<span class="text-sun"> {String(current.title_highlight||extra.title_highlight)}</span>{/if}</h1>
   {#if textContent(String(current.subtitle||section.content||''))}<p class="hero-description" data-motion="hero" data-motion-delay="0.16">{textContent(String(current.subtitle||section.content||''))}</p>{/if}
   <div class="hero-actions" data-motion="hero" data-motion-delay="0.24">{#if canEnquire}<Button variant="safari" href={safeUrl(String(current.primary_url||section.button_url||'#plan-form'),'#plan-form')} class="hero-primary">{String(current.primary_label||section.button_text||extra.primary_cta_text||'Start Planning')}<ArrowRight class="size-4" /></Button>{/if}{#if showPackages}<a href={safeUrl(String(current.secondary_url||extra.secondary_cta_url||'/tours'),'/tours')} class="hero-secondary">{String(current.secondary_label||extra.secondary_cta_text||'View Safari Options')}<ArrowRight class="size-4" /></a>{/if}</div>
   {#if trust.length}<ul class="hero-trust" data-motion="hero" data-motion-delay="0.3">{#each trust as point}<li><Check class="size-[18px] shrink-0 text-sun" strokeWidth={2.4} />{point}</li>{/each}</ul>{/if}
   <a href={safeUrl(String(extra.reviews_url||TRIPADVISOR_URL),TRIPADVISOR_URL)} target="_blank" rel="noopener noreferrer" class="rating-card" data-motion="hero" data-motion-delay="0.36">
    {#if ratingLabel}<span class="rating-top"><span class="rating-stars" aria-label={`Rated ${reviewAverage} out of 5`}>{#each {length:5} as _,s (s)}<Star class={s<stars?'on':''} aria-hidden="true" />{/each}</span><strong>{ratingLabel}</strong>{#if reviewTotal>0}<span class="rating-sep" aria-hidden="true"></span><span class="rating-count">{reviewTotal} guest reviews</span>{/if}</span>{/if}
    <span class="rating-link">View us on <b>Tripadvisor</b><ArrowUpRight class="size-[18px]" aria-hidden="true" /></span>
   </a>
   {#if slides.length>1}<div class="mt-6 flex items-center gap-3"><Button variant="outline" size="icon" class="bg-white/10 text-white" aria-label="Previous hero photo" onclick={()=>index=(index-1+slides.length)%slides.length}><ChevronLeft class="size-4" /></Button><span class="text-xs text-white/80">{index%slides.length+1} / {slides.length}</span><Button variant="outline" size="icon" class="bg-white/10 text-white" aria-label="Next hero photo" onclick={()=>index=(index+1)%slides.length}><ChevronRight class="size-4" /></Button></div>{/if}
  </div>
  <!-- Links to the quote form ("/#request-quote") from the menus and other pages land on this form. -->
  {#if canEnquire}<aside id="plan-form" class="hero-form" aria-labelledby="hero-form-title" data-motion="hero" data-motion-delay="0.2"><span id="request-quote" class="quote-anchor" aria-hidden="true"></span>
   <p class="form-eyebrow">{String(extra.form_eyebrow||'Get a safari quote')}</p>
   <h2 id="hero-form-title">{String(extra.form_title||'Plan Your Safari')}</h2>
   {#if form?.success&&!sentAgain}<div role="status" class="form-done"><Check class="size-5 text-sun" />{form.message}<button type="button" onclick={reset}>Send another request</button></div>
   {:else}
   {#if ready}<div class="form-steps" aria-live="polite"><span class="bars" aria-hidden="true"><i class="on"></i><i class:on={step===2}></i></span>Step {step} of 2 · {step===1?'Trip basics':'Your details'}</div>{/if}
   <form method="POST" action="?/heroEnquire#plan-form" novalidate use:enhance={({cancel})=>{if(!validate()){cancel();return;}sending=true;return async({result,update})=>{try{await update({reset:false,invalidateAll:false});if(result.type==='success'&&result.data?.success){idempotencyKey=newTransactionId();sentAgain=false;name='';email='';details='';trackEvent('form_submitted',{form_name:'homepage_hero',lead_source:'enquiry_form',transaction_id:newTransactionId()});}}finally{sending=false;}};}}>
    {#if form?.message&&!form.success}<p role="alert" class="form-alert">{form.message}</p>{/if}
    <div class="step" hidden={ready&&step!==1}>
     <div class="field"><label for="hero-date">Preferred start date <span aria-hidden="true">*</span></label><input id="hero-date" name="travel_date" type="date" min={today} bind:value={travelDate} aria-invalid={Boolean(errors.travel_date)} aria-describedby={errors.travel_date?'hero-date-error':undefined} />{#if errors.travel_date}<p id="hero-date-error" class="field-error">{errors.travel_date}</p>{/if}</div>
     <div class="pair">
      <div class="field"><label for="hero-adults">Adults <span aria-hidden="true">*</span></label><input id="hero-adults" name="adults" type="number" inputmode="numeric" min="1" max="30" bind:value={adults} aria-invalid={Boolean(errors.adults)} aria-describedby={errors.adults?'hero-adults-error':undefined} />{#if errors.adults}<p id="hero-adults-error" class="field-error">{errors.adults}</p>{/if}</div>
      <div class="field"><label for="hero-children">Children <span class="optional">(optional)</span></label><input id="hero-children" name="children" type="number" inputmode="numeric" min="0" max="30" bind:value={children} aria-invalid={Boolean(errors.children)} aria-describedby={errors.children?'hero-children-error':undefined} />{#if errors.children}<p id="hero-children-error" class="field-error">{errors.children}</p>{/if}</div>
     </div>
     <fieldset class="field" aria-describedby={errors.accommodation_style?'hero-style-error':undefined}>
      <legend>Accommodation style <span aria-hidden="true">*</span></legend>
      <div class="styles">{#each HERO_STYLES as item (item.id)}<label class="style" class:on={style===item.id}><input type="radio" name="accommodation_style" value={item.id} bind:group={style} />{item.label}</label>{/each}</div>
      {#if errors.accommodation_style}<p id="hero-style-error" class="field-error">{errors.accommodation_style}</p>{/if}
     </fieldset>
     {#if ready}<div class="form-foot"><p>{String(extra.form_note||'No obligation to book.')}</p><button type="button" class="hero-next" onclick={next}>Next step <ArrowRight class="size-4" /></button></div>{/if}
    </div>
    <div class="step" hidden={ready&&step!==2}>
     <div class="field"><label for="hero-name">Full name <span aria-hidden="true">*</span></label><input id="hero-name" name="full_name" bind:value={name} required minlength={2} maxlength={100} autocomplete="name" aria-invalid={Boolean(errors.full_name)} aria-describedby={errors.full_name?'hero-name-error':undefined} />{#if errors.full_name}<p id="hero-name-error" class="field-error">{errors.full_name}</p>{/if}</div>
     <div class="field"><label for="hero-email">Email address <span aria-hidden="true">*</span></label><input id="hero-email" name="email" type="email" bind:value={email} required maxlength={254} autocomplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email?'hero-email-error':undefined} />{#if errors.email}<p id="hero-email-error" class="field-error">{errors.email}</p>{/if}</div>
     <div class="field"><label for="hero-details">Special requests <span class="optional">(optional)</span></label><textarea id="hero-details" name="details" bind:value={details} rows={3} maxlength={2000} aria-invalid={Boolean(errors.details)} aria-describedby={errors.details?'hero-details-error':undefined} placeholder="Places on your wish list, celebrations, diets…"></textarea>{#if errors.details}<p id="hero-details-error" class="field-error">{errors.details}</p>{/if}</div>
     <input type="hidden" name="idempotency_key" value={idempotencyKey} /><div class="hidden" aria-hidden="true"><label for="hero-website">Website</label><input id="hero-website" name="website" tabindex="-1" autocomplete="off" /></div>
     <div class="form-foot">{#if ready}<button type="button" class="hero-back" onclick={()=>{step=1;}}><ArrowLeft class="size-4" />Back</button>{/if}<button type="submit" class="hero-next" disabled={sending}>{sending?'Sending…':'Get my safari quote'}<ArrowRight class="size-4" /></button></div>
     <p class="privacy-note">We only use your details to reply to your safari request.</p>
    </div>
   </form>{/if}
  </aside>{/if}
 </div>
</section>
<style>
 .home-hero{position:relative;isolation:isolate;background:var(--navy);color:white;overflow:hidden}
 .hero-photo,.hero-shade{position:absolute;inset:0;width:100%;height:100%;z-index:-2;object-position:60% center}
 /* Eased veil: deep behind the words on the left, thinning to the photo on the right, a soft floor below. */
 .hero-shade{z-index:-1;background:linear-gradient(90deg,rgb(20 18 15 / .82) 0%,rgb(20 18 15 / .72) 22%,rgb(20 18 15 / .56) 38%,rgb(20 18 15 / .4) 52%,rgb(20 18 15 / .28) 66%,rgb(20 18 15 / .22) 82%,rgb(20 18 15 / .2) 100%),linear-gradient(0deg,rgb(20 18 15 / .45) 0%,rgb(20 18 15 / 0) 35%),linear-gradient(180deg,rgb(20 18 15 / .35) 0%,rgb(20 18 15 / 0) 22%)}
 .hero-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,460px);align-items:center;gap:72px;min-height:clamp(700px,90svh,860px);padding-block:72px}
 .hero-grid.without-form{grid-template-columns:1fr;min-height:620px}
 .hero-copy{max-width:660px}
 .hero-eyebrow{display:flex;align-items:center;gap:14px;font-size:12.5px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--sun);text-shadow:0 1px 8px rgb(20 18 15/.5)}
 .hero-eyebrow::before{content:'';flex:none;width:32px;height:1px;background:currentColor}
 h1{font-size:clamp(42px,5vw,74px);line-height:1.02;margin-top:20px;text-wrap:balance}
 .hero-description{font-size:clamp(16px,1.3vw,18.5px);line-height:1.7;color:rgb(255 255 255 / .88);margin-top:22px;max-width:52ch}
 .hero-actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px 32px;margin-top:34px}
 .hero-actions :global(.hero-primary){height:54px;padding-inline:30px;font-size:15px;font-weight:700}
 .hero-secondary{display:inline-flex;min-height:54px;align-items:center;gap:8px;font-size:15px;font-weight:600;color:#fff;transition:color .18s ease}
 .hero-secondary:hover{color:var(--sun)}
 .hero-secondary :global(svg){transition:translate .18s ease}.hero-secondary:hover :global(svg){translate:3px 0}
 .hero-trust{display:flex;flex-wrap:wrap;gap:12px 26px;margin-top:36px}
 .hero-trust li{display:flex;align-items:center;gap:9px;font-size:15px;font-weight:500;color:#fff}
 /* The rating card: white, on the photo, the stars from the reviews themselves. */
 .rating-card{display:inline-flex;flex-direction:column;gap:10px;min-width:min(100%,440px);margin-top:28px;padding:18px 22px;border-radius:var(--radius-surface);background:rgb(255 255 255 / .97);color:var(--navy);box-shadow:0 20px 40px -24px rgb(20 18 15 / .6);transition:transform .2s ease,box-shadow .2s ease}
 .rating-card:hover{transform:translateY(-2px);box-shadow:0 24px 44px -24px rgb(20 18 15 / .7)}
 .rating-top{display:flex;align-items:center;flex-wrap:wrap;gap:10px 14px}
 .rating-stars{display:flex;gap:3px}.rating-stars :global(svg){width:19px;height:19px;color:#cfd8d2;fill:#cfd8d2}.rating-stars :global(svg.on){color:#00aa6c;fill:#00aa6c}
 .rating-top strong{font-size:16px;font-weight:700}
 .rating-sep{width:1px;height:18px;background:var(--border)}
 .rating-count{font-size:14px;color:var(--muted-foreground)}
 .rating-link{display:flex;align-items:center;gap:6px;font-size:16px;font-weight:600}
 .rating-link b{font-weight:700;letter-spacing:-.01em}
 .rating-card:hover .rating-link{color:#00804f}
 /* The quote card: dark glass on the photo, white fields, the site's squarer corners. */
 .hero-form{background:linear-gradient(160deg,rgb(30 34 36 / .74),rgb(36 30 24 / .68));border:1px solid rgb(255 255 255 / .16);border-radius:var(--radius-surface);padding:34px 32px;backdrop-filter:blur(14px) saturate(1.1);-webkit-backdrop-filter:blur(14px) saturate(1.1);box-shadow:0 30px 70px -30px rgb(0 0 0 / .6);scroll-margin-top:120px}
 .form-eyebrow{font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--sun)}
 .hero-form h2{margin-top:10px;font-size:clamp(26px,2.2vw,32px);font-weight:600;line-height:1.1;letter-spacing:-.03em}
 .form-steps{display:flex;align-items:center;gap:12px;margin-top:18px;font-size:13.5px;font-weight:500;color:rgb(255 255 255 / .82)}
 .bars{display:flex;gap:6px}.bars i{display:block;width:22px;height:4px;border-radius:2px;background:rgb(255 255 255 / .28);transition:width .3s ease,background-color .3s ease}.bars i.on{width:40px;background:var(--sun)}
 .hero-form form{margin-top:22px}
 .step{display:grid;gap:18px}.step[hidden]{display:none}
 .field{display:grid;gap:8px;min-width:0;margin:0;padding:0;border:0}
 .field label,.field legend{padding:0;font-size:11.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgb(255 255 255 / .9)}
 .field legend{margin-bottom:8px}
 .optional{font-weight:500;letter-spacing:.06em;text-transform:none;color:rgb(255 255 255 / .6)}
 .field input,.field textarea{width:100%;min-height:50px;padding:12px 16px;border:1px solid transparent;border-radius:var(--radius-control);background:rgb(255 255 255 / .95);color:var(--navy);font:500 15px var(--font-sans);color-scheme:light;transition:border-color .18s ease,box-shadow .18s ease}
 .field textarea{min-height:88px;line-height:1.6;resize:vertical}
 .field input::placeholder,.field textarea::placeholder{color:#8a8274}
 .field input:focus,.field textarea:focus{outline:none;border-color:var(--sun);box-shadow:0 0 0 3px rgb(255 204 0 / .35)}
 .field [aria-invalid=true]{border-color:#ffb4a8}
 .pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}
 .styles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
 .field .style{position:relative;display:grid;place-items:center;min-height:48px;padding:8px;border:1px solid rgb(255 255 255 / .32);border-radius:var(--radius-control);background:rgb(255 255 255 / .06);font-size:15px;font-weight:600;letter-spacing:0;text-transform:none;color:#fff;cursor:pointer;transition:background-color .18s ease,border-color .18s ease,color .18s ease}
 .style:hover{border-color:rgb(255 255 255 / .6);background:rgb(255 255 255 / .12)}
 .style input{position:absolute;opacity:0;pointer-events:none}
 .field .style.on{border-color:var(--sun);background:var(--sun);color:var(--navy)}
 .style:has(input:focus-visible){outline:2px solid var(--sun);outline-offset:2px}
 .form-foot{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:6px}
 .form-foot p{font-size:13.5px;line-height:1.5;color:rgb(255 255 255 / .72)}
 .hero-next{display:inline-flex;flex:none;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:0 24px;border:0;border-radius:var(--radius-control);background:var(--sun);color:var(--navy);font:700 15px var(--font-sans);cursor:pointer;transition:background-color .18s ease}
 .hero-next:hover{background:color-mix(in oklab,var(--sun) 90%,black)}
 .hero-next:disabled{opacity:.7;cursor:progress}
 .hero-next :global(svg){transition:translate .18s ease}.hero-next:hover :global(svg){translate:3px 0}
 .hero-back{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 4px;border:0;background:none;color:rgb(255 255 255 / .85);font:600 14px var(--font-sans);cursor:pointer}
 .hero-back:hover{color:#fff}
 .field-error{font-size:12.5px;color:#ffd0c8}
 .form-alert{margin-bottom:16px;padding:12px 14px;border:1px solid rgb(255 204 0 / .45);border-radius:var(--radius-control);font-size:13.5px;color:var(--sun)}
 .form-done{display:grid;gap:12px;margin-top:22px;padding:20px;border:1px solid rgb(255 204 0 / .4);border-radius:var(--radius-control);background:rgb(255 204 0 / .08);font-size:15px;line-height:1.7}
 .form-done button{justify-self:start;min-height:44px;border:0;background:none;color:var(--sun);font:600 14px var(--font-sans);cursor:pointer}
 .privacy-note{font-size:12.5px;line-height:1.6;color:rgb(255 255 255 / .62)}
 @media(prefers-reduced-motion:reduce){.rating-card,.bars i,.hero-next :global(svg),.hero-secondary :global(svg){transition:none}.rating-card:hover{transform:none}}
 @media(max-width:1100px){.hero-grid{gap:40px;grid-template-columns:minmax(0,1fr) 390px}.hero-form{padding:28px 24px}}
 @media(max-width:900px){.hero-grid{grid-template-columns:1fr;gap:40px;padding-block:52px;min-height:0}.hero-copy{max-width:700px}.hero-form{width:100%;max-width:620px}.hero-shade{background:linear-gradient(0deg,rgb(20 18 15 / .7),rgb(20 18 15 / .55) 50%,rgb(20 18 15 / .45))}}
 @media(max-width:639px){h1{font-size:clamp(36px,10.5vw,44px)}.hero-description{font-size:15.5px;margin-top:16px}.hero-actions{flex-direction:column;align-items:stretch;gap:4px;margin-top:28px}.hero-actions :global([data-slot=button]){width:100%}.hero-secondary{justify-content:center}.hero-grid{padding-block:40px}.hero-trust{gap:10px 18px;margin-top:28px}.hero-trust li{font-size:14px}.rating-card{display:flex;min-width:0;padding:16px 18px}.hero-form{padding:24px 18px}.pair{gap:10px}.form-foot{flex-wrap:wrap}.form-foot .hero-next{flex:1}}
 .hero-form{position:relative}.quote-anchor{position:absolute;top:0;left:0;width:0;height:0}
</style>
