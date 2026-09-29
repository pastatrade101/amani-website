<script lang="ts">
  import { t } from '$lib/admin/i18n/ui';
  import { ArrowLeft, ArrowRight } from '@lucide/svelte';
  import Img from './Img.svelte';
  import SafariPackageBlocks from './SafariPackageBlocks.svelte';
  import PackageNavigation from './PackageNavigation.svelte';
  import { orderedPackageBlocks } from '$lib/admin/packagePresentation';
  import type { Block } from '$lib/admin/safariPackageBlocks';
  import type { AdvisorNoteSection } from '$lib/admin/advisorNote';
  import type { SafariPackage, Tour, Lodge, FAQ, ItineraryDay } from '$lib/admin/types';

  export let record: SafariPackage;
  export let related: Tour[] = [];
  export let moduleFaqs: FAQ[] = [];
  export let relatedLodges: Lodge[] = [];
  export let interests: { name: string; slug: string }[] = [];
  export let startPoints: Record<string, unknown>[] = [];
  export let homeSections: Record<string, AdvisorNoteSection | undefined> = {};
  export let preview = false;

  $: blocks = orderedPackageBlocks(((record?.sections ?? []) as Block[]).filter((block) => block && typeof block.type === 'string'));
  /** Drawn above the tab bar. Facts carry no anchor, so nothing in the nav moves with them. */
  $: factsBlocks = blocks.filter((block) => block.type === 'facts');
  $: bodyBlocks = blocks.filter((block) => block.type !== 'facts');
  $: formHref = blocks.some((block) => block.type === 'enquiry') ? '#lead-form' : '/plan-my-trip';
  $: itineraryDays = [...((record?.tours?.itinerary_days ?? []) as ItineraryDay[])].sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0));
  $: heroTitle = record?.hero_title?.trim() || record?.name || '';
</script>

{#if record}
  <!-- One page colour, as on the homepage: the cream ground shows only where a
       card chooses it. -->
  <div class="safari-package-page bg-surface">
    <section class="package-hero relative isolate overflow-hidden bg-deep-green text-white">
      {#if record.hero_image_url}
        <Img
          src={record.hero_image_url}
          alt={heroTitle}
          width={1800}
          sizes="100vw"
          eager
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span class="absolute inset-0 bg-gradient-to-t from-deep-green via-deep-green/70 to-deep-green/35" aria-hidden="true"></span>
      {/if}
      <div class="package-hero-content container-shell relative py-16 md:py-24">
        <a class="package-back" href="/safari-packages"><ArrowLeft size={16} />{$t('ui.safari_packages')}</a>
        <div class="package-hero-copy">
          {#if record.hero_eyebrow}
            <p class="text-xs font-semibold uppercase tracking-[0.15em] text-goldfinch-gold">{record.hero_eyebrow}</p>
          {/if}
          <h1 class="font-serif mt-3 text-3xl leading-[1.06] tracking-tight sm:text-4xl md:text-5xl">{heroTitle}</h1>
          {#if record.hero_subtitle}
            <p class="mt-4 max-w-2xl text-base leading-relaxed text-white/80 md:text-lg">{record.hero_subtitle}</p>
          {/if}
          <div class="package-hero-actions mt-8 flex flex-wrap gap-3">
            <a
              href={formHref}
              class="inline-flex h-11 items-center justify-center rounded bg-goldfinch-gold px-5 text-sm font-semibold text-heading transition hover:brightness-105"
            >{$t('ui.plan_this_trip_2')}<ArrowRight size={17} class="ml-2 md:hidden" />
            </a>
            {#if record.tours?.slug}
              <a
                href={`/tours/${record.tours.slug}`}
                class="inline-flex h-11 items-center justify-center rounded border border-white/30 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
              >{$t('ui.see_the_full_tour')}</a>
            {/if}
          </div>
        </div>
      </div>
    </section>

    <!-- The trip's facts belong to the hero above them, not under a tab bar:
         they are what the page has just finished saying. The tab bar follows,
         and is the thing that sticks as the page scrolls. -->
    <SafariPackageBlocks blocks={factsBlocks} />

    {#if !preview}
      {#key record.slug}<PackageNavigation packageName={record.name} {formHref} />{/key}
    {/if}
    <SafariPackageBlocks
      blocks={bodyBlocks}
      {itineraryDays}
      {moduleFaqs}
      tours={related}
      lodges={relatedLodges}
      {interests}
      {startPoints}
      packageName={record.name ?? ''}
      packageSlug={record.slug ?? ''}
      {homeSections}
      {formHref}
    />
  </div>
{/if}

<style>
  .safari-package-page { overflow-wrap:anywhere; }
  .package-hero { background:rgb(var(--c-forest)); }
  .package-hero-content { max-width:1248px; padding-top:86px; padding-bottom:88px; }
  .package-hero-copy { max-width:790px; }
  .package-hero h1 { max-width:21ch; font-size:clamp(38px,4.2vw,62px); font-weight:500; line-height:1.08; letter-spacing:-.035em; text-wrap:balance; }
  .package-hero h1 + p { max-width:60ch; font-size:17px; line-height:1.75; }
  .package-hero-actions a { height:auto; min-height:48px; border-radius:7px; padding:13px 24px; }
  .package-back { display:inline-flex; align-items:center; gap:8px; margin-bottom:30px; font-size:12px; color:rgb(255 255 255 / .75); }
  .safari-package-page :global([data-package-label]), .safari-package-page :global([data-package-enquiry]) { scroll-margin-top:calc(var(--nav-h,70px) + 76px); }

  @media (max-width: 767px) {
    .package-hero-content { padding-top: 22px; padding-bottom: 32px; }
    .package-back { display: inline-flex; min-height: 44px; align-items: center; gap: 8px; margin-bottom: 46px; font-size: 12px; font-weight: 600; color: rgb(255 255 255 / 0.85); }
    .package-hero h1 { max-width: 19ch; margin-top: 12px; font-size: clamp(32px, 8.6vw, 48px); line-height: 1.08; text-wrap: balance; }
    .package-hero h1 + p { margin-top: 16px; max-width: 42ch; font-size: 15px; line-height: 1.65; }
    .package-hero-actions { display: grid; grid-template-columns: 1fr; margin-top: 24px; gap: 10px; }
    .package-hero-actions a { min-height: 50px; height: auto; padding: 12px 16px; border-radius: 12px; text-align: center; }
    .package-hero-actions a:first-child { color: rgb(var(--c-forest)); }
    .package-hero-actions a:focus-visible, .package-back:focus-visible { outline: 2px solid rgb(var(--c-goldfinch-gold)); outline-offset: 4px; }
    .safari-package-page :global([data-package-label]),
    .safari-package-page :global([data-package-enquiry]) { scroll-margin-top: calc(var(--nav-h, 70px) + 76px); }
  }
</style>
