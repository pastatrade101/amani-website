<script lang="ts">
  import { t } from '$lib/admin/i18n/ui';
  /**
   * The route options panel, laid out exactly as the supplied design: route
   * tabs, a wide photo, then one card holding the intro, highlights, a
   * comfort-tabbed price panel, where you sleep, the day-by-day itinerary and
   * a horizontal closing CTA.
   *
   * The days are drawn by ItineraryDays — the same component the tour pages
   * use. This panel had its own accordion: a title, a paragraph, and nothing
   * else. No main stop, no meals, no activities, and a property reduced to one
   * thumbnail tucked inside day one. Two renderers for one thing, and the
   * thinner one was the version a landing page showed first.
   *
   * The content is not typed twice. A route names real published tours, one
   * per comfort level, and the photo, wording, price, highlights, days and
   * lodges all come from those records — so this page and the tour pages
   * cannot drift, and a route whose tour is unpublished drops out rather than
   * rendering a broken tab.
   */
  import { getContext } from 'svelte';
  import type { Writable } from 'svelte/store';
  import { ArrowRight, Check, Tent } from '@lucide/svelte';
  import Img from './Img.svelte';
  import ItineraryDays from './ItineraryDays.svelte';
  import RichText from './RichText.svelte';
  import StayCard from './StayCard.svelte';
  import TourRates from './TourRates.svelte';
  import { enumLabel } from '$lib/admin/accommodationEnums';
  import { loadLodgeMedia, stayKey, type MediaImage, type Stay } from '$lib/admin/lodgeMedia';
  import { parseRouteTour, routeDisplayName, lines, str } from '$lib/admin/safariPackageBlocks';
  import type { ItineraryDay, Lodge, Tour } from '$lib/admin/types';

  type RouteRow = { tab?: string; tours?: unknown; comforts?: unknown; best_for?: string; note?: string; stay_note?: string; stay_disclaimer?: string };
  type ResolvedComfort = { label: string; slug: string; tour: Tour; lodges: Lodge[]; description: string };
  type ResolvedRoute = { tab: string; bestFor: string; note: string; stayNote: string; stayDisclaimer: string; comfort: ResolvedComfort[] };

  export let routes: RouteRow[] = [];
  export let tours: Tour[] = [];
  export let lodges: Lodge[] = [];
  /** Empty uses the translated default. */
  export let ctaLabel = '';
  export let formHref = '#lead-form';
  export let idPrefix = 'package-routes';

  const tourBySlug = (slug: string, available: Tour[]) => available.find((tour) => tour.slug === slug);

  /**
   * Comfort tabs read in the traveller's language. The enum is what the CMS
   * stores; anything outside these four keeps the old title-cased form.
   */
  const LEVEL_KEYS: Record<string, string> = {
    BUDGET: 'tier.budget',
    MID_RANGE: 'tier.mid_range',
    LUXURY: 'tier.luxury',
    PREMIUM_LUXURY: 'tier.premium_luxury'
  };
  const levelLabel = (level: string, translate: (key: string) => string) =>
    LEVEL_KEYS[level.toUpperCase()] ? translate(LEVEL_KEYS[level.toUpperCase()]) : enumLabel(level);

  const selectedLodges = (ids: unknown, available: Lodge[]) =>
    (Array.isArray(ids) ? ids.map(String) : []).map((id) => available.find((lodge) => lodge.id === id)).filter((lodge): lodge is Lodge => Boolean(lodge));

  let resolved: ResolvedRoute[] = [];
  $: resolved = routes
    .map((route) => {
      const selected = Array.isArray(route.comforts) ? (route.comforts as Record<string, unknown>[]) : [];
      const comfortSource = selected.length
        ? selected.map((entry) => ({
            label: str(entry.accommodation_level) ? levelLabel(str(entry.accommodation_level), $t) : str(entry.label) || $t('ui.safari_stay'),
            slug: str(entry.tour_slug),
            description: str(entry.description),
            lodges: selectedLodges(entry.accommodation_ids, lodges)
          }))
        : lines(route.tours).map((line) => ({ ...parseRouteTour(line), lodges: [] as Lodge[], description: '' }));
      const comfort = comfortSource
        .map((entry) => ({ ...entry, tour: tourBySlug(entry.slug, tours) }))
        .filter((entry): entry is ResolvedComfort => Boolean(entry.tour))
        .map((entry) => ({ ...entry, label: entry.label || entry.tour.title }));
      return {
        tab: routeDisplayName(route.tab, comfort[0]?.tour.title),
        bestFor: str(route.best_for).replace(/^best for\s*:\s*/i, ''),
        note: str(route.note),
        stayNote: str(route.stay_note),
        stayDisclaimer: str(route.stay_disclaimer),
        comfort
      };
    })
    .filter((route) => route.comfort.length);

  let activeRoute = 0;

  /**
   * The page's quote form offers the same routes. When a traveller opens a
   * tab, or follows one of this panel's "request" buttons, the form is told —
   * so it is already on that option when they reach it. Only an actual choice
   * is passed on: the first tab being open by default is not the traveller
   * picking it.
   */
  const pickedRoute = getContext<Writable<string> | undefined>('package-active-route');
  const pickRoute = (index: number) => {
    activeRoute = index;
    pickedRoute?.set(resolved[index]?.tab ?? '');
  };
  /** A single comfort choice keeps the price, accommodation and itinerary in sync. */
  let priceLevel: number[] = [];

  $: if (resolved.length && priceLevel.length !== resolved.length) {
    priceLevel = resolved.map(() => 0);

  }
  $: if (activeRoute >= resolved.length) activeRoute = 0;

  $: route = resolved[activeRoute];
  $: headTour = route?.comfort[0]?.tour;
  $: priced = route?.comfort[priceLevel[activeRoute] ?? 0] ?? route?.comfort[0];
  $: stayed = priced;
  $: priceDescription = priced?.description || (priced?.tour.short_description !== headTour?.short_description ? priced?.tour.short_description : '');

  const daysOf = (tour: Tour | undefined) =>
    [...((tour?.itinerary_days ?? []) as ItineraryDay[])].sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0));

  $: days = daysOf(priced?.tour);
  $: highlights = (headTour?.highlights ?? []).map(String).filter((item) => item.trim());

  /** What the rates table does not say. An absent fact is left out, not filled in. */
  $: priceFacts = [
    priced?.tour.duration_days
      ? `${priced.tour.duration_days} ${$t(priced.tour.duration_days === 1 ? 'label.day' : 'label.days')}${
          priced.tour.duration_nights
            ? `, ${priced.tour.duration_nights} ${$t(priced.tour.duration_nights === 1 ? 'label.night' : 'label.nights')}`
            : ''
        }`
      : '',
    priced?.tour.start_location ? $t('ui.starts_in_place').replace('{place}', priced.tour.start_location) : '',
    priced?.tour.group_size ?? '',
    priced?.tour.difficulty_level ?? ''
  ].filter(Boolean) as string[];

  /**
   * The property an editor selected for this comfort tab.
   *
   * Keep every selected property, including older pages with multiple stays.
   * The editor and renderer use the same list; opening a page cannot lose one.
   *
   * There is no longer a fallback list assembled from the tour's itinerary:
   * the day cards below show the property each day stays at, so repeating them
   * up here said the same thing twice.
   */
  $: selectedStays = (stayed?.lodges ?? []) as unknown as Stay[];

  /**
   * Photographs for the selected property, so its card carries the same
   * four-up gallery the itinerary days do rather than one thumbnail. The day
   * cards fetch their own — this is only the editor's pick, which is not on
   * any itinerary.
   */
  let stayMedia: Record<string, MediaImage[]> = {};
  const requestedStays = new Set<string>();

  const hydrateStayMedia = async (list: Stay[]) => {
    const next = await loadLodgeMedia(list, stayMedia, requestedStays);
    if (next !== stayMedia) stayMedia = next;
  };

  $: void hydrateStayMedia(selectedStays);

  const GOLD =
    'route-cta inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-goldfinch-gold px-6 text-[14px] font-bold text-heading transition hover:brightness-105';
  const SUB = 'font-serif text-[20px] font-semibold text-heading md:text-[24px]';
  const BODY = 'text-[14.5px] leading-relaxed text-ink/70';
</script>

{#if resolved.length}
  <!-- Route tabs -->
  <div
    class="route-tabs"
    role="tablist"
    aria-label={$t('ui.route_options')}
  >
    {#each resolved as item, i (i)}
      <button
        class={`shrink-0 rounded-[10px] border px-5 py-[13px] text-[14.5px] font-semibold tracking-[0.015em] transition md:px-7 md:py-[15px] md:text-[15.5px] ${
          i === activeRoute
            ? 'border-deep-green bg-deep-green text-surface'
            : 'border-ink/10 bg-canvas text-heading hover:border-ink/25 hover:bg-surface'
        }`}
        type="button"
        role="tab"
        id={`${idPrefix}-tab-${i}`}
        aria-controls={`${idPrefix}-panel`}
        tabindex={i === activeRoute ? 0 : -1}
        on:keydown={(event) => {
          const next = event.key === 'ArrowRight' ? (i + 1) % resolved.length : event.key === 'ArrowLeft' ? (i - 1 + resolved.length) % resolved.length : event.key === 'Home' ? 0 : event.key === 'End' ? resolved.length - 1 : -1;
          if (next < 0) return;
          event.preventDefault(); pickRoute(next);
          document.getElementById(`${idPrefix}-tab-${next}`)?.focus();
        }}
        aria-selected={i === activeRoute}
        on:click={() => pickRoute(i)}
      >
        <!-- One line, the editor's own words. The counter and the tour title
             underneath it said the same thing twice at two sizes. -->
        <span class="route-tab-copy"><strong>{item.tab || item.comfort[0]?.tour.title}</strong></span>
        <ArrowRight size={17} />
      </button>
    {/each}
  </div>

  {#if route && headTour}
    <!-- Wide photo + panel = one card -->
    <div id={`${idPrefix}-panel`} role="tabpanel" aria-labelledby={`${idPrefix}-tab-${activeRoute}`} tabindex="0" class="route-card mt-6 overflow-hidden rounded-[12px]">
      <div class="route-visual">
      {#if headTour.main_image_url}
        <Img
          src={headTour.main_image_url}
          alt={route.tab || headTour.title}
          width={1180}
          sizes="(max-width: 1179px) 100vw, 1180px"
          className="route-photo block h-[240px] w-full rounded-t-[12px] object-cover sm:h-[320px] md:h-[360px] lg:h-[430px]"
        />
      {/if}
      </div>

      <div class="route-panel rounded-b-[12px] bg-canvas p-6 sm:p-9 md:p-11 lg:p-14">
        <div class="route-introduction">
        <p class="route-kicker">{route.tab && route.tab !== headTour.title ? route.tab : $t('ui.route_options')}</p>
        <h3 class="font-serif text-[22px] font-semibold leading-snug text-heading md:text-[28px]">
          {headTour.title}
        </h3>


        {#if headTour.short_description}
          <p class="mt-4 max-w-[880px] text-[15px] leading-relaxed text-ink/70">{headTour.short_description}</p>
        {/if}
        {#if route.note}
          <p class="mt-3 max-w-[880px] text-[15px] leading-relaxed text-ink/70">{route.note}</p>
        {/if}
        {#if route.bestFor}
          <p class="mt-5 text-[14.5px] font-semibold text-heading">{$t('ui.best_for')}: {route.bestFor}</p>
        {/if}
        <a class={`mt-6 ${GOLD}`} href={formHref} on:click={() => pickRoute(activeRoute)}>
          {ctaLabel || $t('ui.send_request_for_this_route')}
          <ArrowRight size={16} />
        </a>

        </div>
        <div class="route-details-grid">
        <div class="route-main">
        <!-- Tour highlights -->
        {#if highlights.length}
          <div class="mt-9 border-t border-ink/[0.18] pt-8">
            <h3 class={SUB}>{$t('ui.tour_highlights')}</h3>
            <ul class="mt-4 grid gap-x-8 gap-y-2.5 md:grid-cols-2">
              {#each highlights as item, i (i)}
                <li class="flex gap-2.5 text-[14.5px] leading-snug text-heading">
                  <Check size={16} class="mt-[3px] shrink-0 text-clay" />
                  <RichText value={item} />
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        <!-- Where you sleep: the property an editor chose for this comfort
             level, shown with its own photographs. No list assembled from the
             itinerary any more — the day cards below carry those lodges, and
             printing them twice said the same thing in two voices. -->
        {#if route.stayNote || route.stayDisclaimer || selectedStays.length}
          <div class="route-accommodation mt-9 border-t border-ink/[0.18] pt-8">
            <h3 class={`${SUB} flex items-center gap-2`}>
              <Tent size={18} class="text-clay" />{$t('ui.accommodation_options')}
            </h3>
            {#if route.comfort.length > 1}
              <div class="comfort-tabs mt-4" role="group" aria-label={$t('ui.accommodation_comfort_level')}>
                {#each route.comfort as level, li (li)}
                  <button
                    class={`h-11 shrink-0 rounded-[10px] border px-5 text-[14px] font-semibold tracking-[0.02em] transition ${
                      li === (priceLevel[activeRoute] ?? 0)
                        ? 'border-deep-green bg-deep-green text-surface'
                        : 'border-ink/[0.16] bg-canvas text-heading hover:border-ink/25 hover:bg-surface'
                    }`}
                    type="button"
                    aria-pressed={li === (priceLevel[activeRoute] ?? 0)}
                    on:click={() => (priceLevel[activeRoute] = li)}
                  >
                    {level.label}
                  </button>
                {/each}
              </div>
            {/if}
            {#if route.stayNote}
              <p class={`mt-4 max-w-[820px] ${BODY}`}>{route.stayNote}</p>
            {/if}
            {#if selectedStays.length}
              <div class="mt-5 grid gap-5">
                {#each selectedStays as stay (stayKey(stay))}
                  <StayCard {stay} extra={stayMedia[stayKey(stay)] ?? []} featured />
                {/each}
              </div>
            {/if}
            <p class="accommodation-note">{route.stayDisclaimer || $t('ui.final_accommodation_depends_on_route')}</p>
          </div>
        {/if}

        <!-- Day by day, through the renderer the tour pages use. The days,
             their facts and the property each one stays at are the linked
             tour's own records, so this panel and that tour cannot disagree. -->
        {#if days.length}
          <div class="mt-9 border-t border-ink/[0.18] pt-8">
            <h3 class={SUB}>{$t('ui.day_by_day_itinerary')}</h3>
            <div class="route-itinerary mt-4">
              <ItineraryDays {days} autoloadMedia />
            </div>
          </div>
        {/if}

        </div>
        <!-- Prices for this route -->
        <aside class="route-pricing">
          <h3 class={SUB}>{$t('ui.prices_for_this_route')}</h3>
          <p class="mt-3 max-w-[820px] text-[15px] leading-relaxed text-ink/70">{$t('ui.pricing_depends_on_accommodation_style')}</p>
          {#if route.comfort.length > 1}
            <div class="comfort-tabs mt-4" role="group" aria-label={$t('ui.price_comfort_level')}>
              {#each route.comfort as level, i (i)}
                <button
                  class={`h-11 shrink-0 rounded-[10px] border px-5 text-[14px] font-semibold tracking-[0.02em] transition ${
                    i === (priceLevel[activeRoute] ?? 0)
                      ? 'border-deep-green bg-deep-green text-surface'
                      : 'border-ink/[0.16] bg-surface text-heading hover:border-ink/35'
                  }`}
                  type="button"
                  aria-pressed={i === (priceLevel[activeRoute] ?? 0)}
                  on:click={() => (priceLevel[activeRoute] = i)}
                >
                  {level.label}
                </button>
              {/each}
            </div>
          {/if}

          <div class="route-price mt-4 rounded-[12px] border border-ink/[0.16] bg-surface p-6 md:p-10">
            <h4 class="font-serif text-[19px] font-semibold text-heading">{priced?.label}</h4>
            {#if priceDescription}
              <p class="mt-2 max-w-[760px] text-[14.5px] leading-relaxed text-ink/70">{priceDescription}</p>
            {/if}

            <!-- The tour's own published rates, through the renderer the tour
                 page uses: the seasonal table when the tour is priced by
                 season, the rate rows otherwise. -->
            <TourRates tour={priced?.tour ?? null} compact />

            <div class="mt-5 grid gap-2 sm:grid-cols-2">
              {#each priceFacts as fact}
                <div class="flex gap-2 text-[14px] leading-snug text-heading">
                  <Check size={15} class="mt-[3px] shrink-0 text-clay" />
                  <span>{fact}</span>
                </div>
              {/each}
            </div>
            <p class="mt-5 text-[13px] italic leading-relaxed text-ink/55">{$t('ui.final_price_is_confirmed_after')}</p>
            <a class={`mt-5 ${GOLD}`} href={formHref} on:click={() => pickRoute(activeRoute)}>{$t('ui.check_this_price_for_my')}<ArrowRight size={16} />
            </a>
          </div>
        </aside>

        </div>

        <!-- Route CTA — horizontal -->
        <div class="mt-9 flex flex-col gap-4 border-t border-ink/[0.18] pt-8 md:flex-row md:items-center md:justify-between">
          <div class="max-w-[720px]">
            <h3 class="font-serif text-[19px] font-semibold text-heading md:text-[22px]">{$t('ui.want_this_route_checked_for')}</h3>
            <p class={`mt-2 ${BODY}`}>{$t('ui.share_your_preferred_start_date')}</p>
          </div>
          <a class={`shrink-0 ${GOLD}`} href={formHref} on:click={() => pickRoute(activeRoute)}>{$t('ui.send_request')}<ArrowRight size={16} />
          </a>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .accommodation-note { margin-top:20px; padding:14px 16px; border-left:2px solid rgb(var(--c-goldfinch-gold)/.65); background:rgb(var(--c-canvas)); font-size:12px; line-height:1.8; color:rgb(var(--c-ink)/.6); overflow-wrap:anywhere; }
  .route-tabs { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr)); gap:12px; margin-top:32px; }
  .route-tabs button { display:flex; align-items:center; gap:12px; min-width:0; padding:18px; text-align:left; border-radius:9px; }
  .route-tabs button :global(svg) { flex-shrink:0; }
  .route-tab-copy { flex:1; min-width:0; }
  .route-tab-copy strong { display:block; font-size:14px; line-height:1.45; }
  .route-card { overflow:clip; border:1px solid rgb(var(--c-ink)/.12); background:rgb(var(--c-surface)); border-radius:16px; }
  .route-visual { position:relative; background:rgb(var(--c-deep-green)); }
  .route-visual :global(.route-photo) { height:360px; width:100%; object-fit:cover; border-radius:0; }
  .route-panel { padding:36px; background:rgb(var(--c-surface)); }
  .route-introduction { max-width:800px; }
  .route-kicker { margin-bottom:12px; font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:rgb(var(--c-clay)); }
  .route-details-grid { display:grid; grid-template-columns:minmax(0,1fr); gap:32px; align-items:start; }
  .route-main { min-width:0; }
  .route-pricing { min-width:0; padding:24px; margin-top:36px; border-radius:12px; border:1px solid rgb(var(--c-ink)/.1); background:rgb(var(--c-canvas)); }
  .route-pricing > h3 { font-size:23px; }
  .route-pricing > p { font-size:13px; line-height:1.7; }
  .route-price { padding:0; border:0; border-radius:0; background:transparent; }
  .route-price > h4 { font-family:inherit; font-size:13px; }
  .route-price :global(table) { min-width:540px; }
  .route-price :global(.tour-rates-mobile article) { padding:16px; border:0; }
  .route-price :global(.tour-rates-mobile article > div) { flex-direction:column; gap:6px; }
  .route-price :global(.tour-rates-mobile article > div p) { max-width:100%; text-align:left; font-size:22px; line-height:1.3; }
  .route-price :global(th), .route-price :global(td) { padding:12px; font-size:12px; }
  .route-price > a { width:100%; }
  .comfort-tabs { display:flex; flex-wrap:wrap; gap:8px; }
  .comfort-tabs button { height:auto; min-height:42px; max-width:100%; white-space:normal; text-align:left; padding:10px 14px; font-size:12px; }
  .route-cta { height:auto; min-height:46px; padding:12px 18px; font-size:13px; overflow-wrap:anywhere; }
  .route-cta :global(svg) { flex-shrink:0; }
  .route-itinerary :global(.tour-day-details) { border:1px solid rgb(var(--c-ink)/.1); box-shadow:none; }
  @media (min-width:1024px) { .route-details-grid { grid-template-columns:minmax(0,1fr) minmax(300px, .68fr); } .route-pricing { position:sticky; top:calc(var(--nav-h,70px) + 80px); } }

  .route-tabs button:focus-visible, .comfort-tabs button:focus-visible, .route-cta:focus-visible {
    outline: 2px solid rgb(var(--c-clay)); outline-offset: -3px;
  }
  @media (max-width: 767px) {
    .route-tabs { display:flex; overflow-x:auto; margin-inline:-16px; padding:4px 16px 12px; }
    .route-tabs button { flex:0 0 85%; }
    .route-visual { border-radius:12px; overflow:hidden; }
    .route-pricing { margin-top:0; padding:20px; }
    .route-tabs, .comfort-tabs { scroll-snap-type: x proximity; scrollbar-width: thin; scrollbar-color: rgb(var(--c-clay) / 0.4) transparent; }
    .route-tabs button, .comfort-tabs button { min-height: 48px; scroll-snap-align: start; }
    .route-tabs button { max-width: 85vw; white-space: normal; text-align: left; font-size: 13px; }
    .route-card { margin-top: 18px; overflow: visible; border: 0; border-radius: 0; }
    .route-card :global(.route-photo) { height: auto; aspect-ratio: 4 / 3; border-radius: 16px; }
    .route-panel { padding: 20px 0 0; border-radius: 0; background: transparent; }
    .route-cta { width: 100%; min-height: 48px; height: auto; gap: 8px; padding: 12px; font-size: 13px; text-align: center; color: rgb(var(--c-forest)); }
    .route-cta :global(svg) { flex-shrink: 0; }
    .route-price { padding: 16px 0 0; border: 0; border-top: 1px solid rgb(var(--c-ink) / 0.12); border-radius: 0; background: transparent; }
    .comfort-tabs button { padding-inline: 14px; font-size: 13px; }
  }
</style>
