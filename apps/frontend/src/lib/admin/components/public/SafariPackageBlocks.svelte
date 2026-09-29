<script lang="ts">
  import { t } from '$lib/admin/i18n/ui';
  /**
   * Draws the blocks an editor composed on a safari-package page.
   *
   * Two rules run through all of it. A block whose data is empty renders
   * nothing at all — no placeholder, no "not recorded", no em dash holding a
   * space open. And an unrecognised type is skipped rather than throwing, so a
   * page saved by a newer editor stays readable on an older renderer.
   *
   * The section chrome is Key2africa's own: alternating surface/canvas bands,
   * the supplied 1180px shell, a clay label, serif heading, ink body.
   */
  import { ArrowRight, Banknote, Car, Check, ChevronDown, Clock3, MapPin, Minus, Plane, Route, Tent, Users } from '@lucide/svelte';
  import FAQAccordion from './FAQAccordion.svelte';
  import HomeAdvisorNote from './home/HomeAdvisorNote.svelte';
  import Img from './Img.svelte';
  import ItineraryDays from './ItineraryDays.svelte';
  import RichText from './RichText.svelte';
  import SafariRouteOptions from './SafariRouteOptions.svelte';
  import StylePlannerBand from './StylePlannerBand.svelte';
  import TourCard from './TourCard.svelte';
  import { setContext } from 'svelte';
  import { writable } from 'svelte/store';
  import { arr, lines, rows, str, routeDisplayName, routeTourSlugs, type Block } from '$lib/admin/safariPackageBlocks';
  import { advisorNoteEnabled, advisorNoteFromBlock, type AdvisorNoteSection } from '$lib/admin/advisorNote';
  import type { FAQ, ItineraryDay, Lodge, Tour } from '$lib/admin/types';

  export let blocks: Block[] = [];
  /** The linked tour's real days — what the `itinerary` block renders. */
  export let itineraryDays: ItineraryDay[] = [];
  /** Resolved tours for `tours` blocks. Cards link to the canonical /tours/[slug]. */
  export let tours: Tour[] = [];
  /** Properties chosen for route-category tabs, resolved by the page loader. */
  export let lodges: Lodge[] = [];
  /** FAQs attached to this package, used only when a `faq` block has none of its own. */
  export let moduleFaqs: FAQ[] = [];
  /** Published categories, offered as "main interest" in the planner band. */
  export let interests: { name: string; slug: string }[] = [];
  /** Real gateways, offered as "starting point". Empty hides that field. */
  export let startPoints: Array<Record<string, unknown>> = [];
  /** This package, so a lead from the planner records where it came from. */
  export let packageName = '';
  export let packageSlug = '';
  export let formHref = '#lead-form';
  /**
   * Homepage sections by key — the site-wide Advisor's Note lives in there, and
   * an `advisor` block is written over it rather than instead of it.
   */
  export let homeSections: Record<string, AdvisorNoteSection | undefined> = {};

  /**
   * One page colour, as on the homepage: white throughout.
   *
   * The cream band used to alternate in and out behind whole sections, so the
   * page changed colour under you three times on the way down. Cream is still
   * the card colour — the overview note, the expectations panel, the advisor's
   * note — where it separates a card from the page rather than dividing the
   * page against itself.
   */
  const surface = (_index: number) => 'bg-surface';

  /** The design's own shell: 1180px, not the site-wide container. */
  const SHELL = 'package-shell mx-auto w-full max-w-[1200px] px-4 md:px-8';
  const SECTION = 'package-section scroll-mt-24 py-12 md:py-20';
  /**
   * The names on the sticky section tabs. Reactive, because they are the
   * reader's language — PackageNavigation reads them off the sections.
   */
  $: NAV_LABELS = {
    prose: $t('ui.overview'),
    highlights: $t('label.highlights'),
    routes: $t('ui.routes'),
    itinerary: $t('ui.itinerary'),
    tiers: $t('ui.prices'),
    priceguide: $t('ui.prices'),
    inclusions: $t('ui.included'),
    gallery: $t('nav.gallery'),
    faq: $t('ui.faqs')
  } as Record<string, string>;
  const HEADING = 'package-section-title font-serif mt-3 max-w-[820px] text-[28px] font-semibold leading-[1.18] tracking-tight text-heading md:text-[38px]';
  const INTRO = 'mt-4 max-w-3xl text-[15.5px] leading-relaxed text-ink/70';
  const GOLD =
    'inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-goldfinch-gold px-6 text-[14px] font-bold text-heading transition hover:brightness-105';

  /**
   * The package's route options for the quote form, named exactly as the route
   * tabs name them — the same function, the same fallback — so the form never
   * offers a choice the page above did not show.
   */
  $: routeOptions = (() => {
    const block = blocks.find((item) => item?.type === 'routes');
    if (!block) return [];
    return rows<Record<string, unknown>>(block.routes)
      .map((route) => {
        const tour = routeTourSlugs(route)
          .map((slug) => tours.find((candidate) => candidate.slug === slug))
          .find((candidate): candidate is Tour => Boolean(candidate));
        return tour
          ? {
              label: routeDisplayName(route.tab, tour.title),
              tourTitle: tour.title,
              tourSlug: tour.slug,
              // Lets the form fill "Number of days" once a route is chosen.
              tourDays: tour.duration_days ?? null
            }
          : null;
      })
      .filter((option): option is { label: string; tourTitle: string; tourSlug: string; tourDays: number | null } =>
        Boolean(option?.label)
      );
  })();

  /**
   * The route tab a traveller last opened, written by SafariRouteOptions and
   * read by the quote form. Context rather than a module store: a store at
   * module level is shared by every request the server renders at once.
   */
  const activeRouteLabel = writable('');
  setContext('package-active-route', activeRouteLabel);

  /** Which enquiry block owns the #lead-form anchor. -1 when there is none. */
  $: firstEnquiry = blocks.findIndex((block) => block?.type === 'enquiry');

  const byOrder = (slugs: string[]) =>
    slugs.map((slug) => tours.find((tour) => tour.slug === slug)).filter((tour): tour is Tour => Boolean(tour));

  /** The controlled icon values saved by the package editor. */
  const FACT_ICON: Record<string, typeof Plane> = {
    plane: Plane,
    pin: MapPin,
    clock: Clock3,
    route: Route,
    price: Banknote,
    people: Users,
    vehicle: Car,
    tent: Tent
  };


  /** Supports both the new icon-picker rows and legacy `icon | label` values. */
  const priceFactors = (value: unknown): { icon: string; text: string }[] =>
    arr<unknown>(value)
      .map((factor) => {
        if (factor && typeof factor === 'object') {
          const row = factor as Record<string, unknown>;
          return { icon: str(row.icon), text: str(row.text) };
        }
        const [maybeIcon, ...rest] = str(factor).split('|');
        const icon = rest.length && FACT_ICON[maybeIcon.trim().toLowerCase()] ? maybeIcon.trim() : '';
        return { icon, text: (icon ? rest.join('|') : maybeIcon).trim() };
      })
      .filter((factor) => factor.text);
</script>

{#each blocks as block, index (index)}
  {@const eyebrow = str(block.eyebrow)}
  {@const title = str(block.title)}
  {@const intro = str(block.intro)}

  {#if block.type === 'facts'}
    {@const items = rows<{ label?: string; value?: string; icon?: string }>(block.items).filter((item) => str(item.value).trim())}
    {#if items.length}
      <section class="package-facts bg-forest">
        <div class={`${SHELL} package-facts-grid`}>
          {#each items as item, i (i)}
            {@const Icon = FACT_ICON[str(item.icon).trim().toLowerCase()]}
            <div class="package-fact flex min-w-0 items-start gap-2.5">
              {#if Icon}<Icon size={18} strokeWidth={1.6} class="mt-0.5 shrink-0 text-goldfinch-gold" />{/if}
              <div class="min-w-0">
                <p class="text-[10px] font-bold uppercase tracking-[0.13em] text-canvas/60">{str(item.label)}</p>
                <p class="mt-0.5 text-[13.5px] leading-snug text-surface">{str(item.value)}</p>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}

  {:else if block.type === 'prose'}
    {@const asideTitle = str(block.aside_title).trim()}
    {@const asideBody = str(block.aside_body).trim()}
    {@const hasAside = Boolean(asideTitle && asideBody)}
    {#if str(block.body)}
      <section id={`package-section-${index}`} data-package-label={NAV_LABELS[block.type]} class={`${surface(index)} ${SECTION}`}>
        <!-- The copy runs full width until there is a side card to sit beside. -->
        <div class={`${SHELL} ${hasAside ? '' : 'max-w-[820px]'}`}>
          {#if eyebrow}
            <div class="inline-flex items-center gap-2">
              <span class="h-px w-6 bg-clay" aria-hidden="true"></span>
              <span class="text-[11px] font-bold uppercase tracking-[0.15em] text-clay">{eyebrow}</span>
            </div>
          {/if}
          {#if title}<h2 class={HEADING}>{title}</h2>{/if}
          <div class={hasAside ? 'package-overview-grid mt-8 grid gap-8 lg:grid-cols-12' : ''}>
            <RichText
              value={str(block.body)}
              className={`package-overview-copy space-y-4 text-[15px] leading-8 text-ink/72 md:text-base ${hasAside ? 'lg:col-span-7' : 'mt-5'}`}
            />
            {#if hasAside}
              <aside class="package-overview-note lg:col-span-5">
                <div class="package-card-content rounded-[12px] border border-clay/20 bg-canvas p-6">
                  <div class="inline-flex items-center gap-2">
                    <span class="h-px w-6 bg-clay" aria-hidden="true"></span>
                    <span class="text-[11px] font-bold uppercase tracking-[0.15em] text-clay">{asideTitle}</span>
                  </div>
                  <p class="font-serif mt-3 text-[19px] leading-[1.35] text-heading">{asideBody}</p>
                </div>
              </aside>
            {/if}
          </div>
        </div>
      </section>
    {/if}

  {:else if block.type === 'highlights'}
    {@const items = lines(block.items)}
    {#if items.length || str(block.image_url)}
      <section id={`package-section-${index}`} data-package-label={NAV_LABELS[block.type]} class={`${surface(index)} ${SECTION}`}>
        <div class={`${SHELL} grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12`}>
          {#if str(block.image_url)}
            <Img
              src={str(block.image_url)}
              alt={title || $t('ui.trip_highlight')}
              width={900}
              sizes="(max-width: 1023px) 100vw, 46vw"
              className="aspect-[4/3] w-full rounded-2xl object-cover"
            />
          {/if}
          <div class="min-w-0">
            {#if eyebrow}
            <div class="inline-flex items-center gap-2">
              <span class="h-px w-6 bg-clay" aria-hidden="true"></span>
              <span class="text-[11px] font-bold uppercase tracking-[0.15em] text-clay">{eyebrow}</span>
            </div>
          {/if}
            {#if title}<h2 class={HEADING}>{title}</h2>{/if}
            {#if intro}<p class={INTRO}>{intro}</p>{/if}
            {#if items.length}
              <ul class="mt-6 grid gap-3">
                {#each items as item, i (i)}
                  <li class="flex items-start gap-2.5 text-[15px] leading-relaxed text-ink/75">
                    <span class="mt-1.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-goldfinch-gold bg-surface">
                      <Check size={10} strokeWidth={3} class="text-clay" />
                    </span>
                    <span>{item}</span>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      </section>
    {/if}

  {:else if block.type === 'tiers'}
    {@const tiers = rows<{ label?: string; price?: string; body?: string }>(block.tiers)}
    {#if tiers.length}
      <section id={`package-section-${index}`} data-package-label={NAV_LABELS[block.type]} class={`${surface(index)} ${SECTION}`}>
        <div class={SHELL}>
          {#if eyebrow}
            <div class="inline-flex items-center gap-2">
              <span class="h-px w-6 bg-clay" aria-hidden="true"></span>
              <span class="text-[11px] font-bold uppercase tracking-[0.15em] text-clay">{eyebrow}</span>
            </div>
          {/if}
          {#if title}<h2 class={HEADING}>{title}</h2>{/if}
          {#if intro}<p class={INTRO}>{intro}</p>{/if}
          <div class="mt-8 grid gap-4 md:grid-cols-3">
            {#each tiers as tier, i (i)}
              <article class="package-card-content rounded-[16px] border border-ink/12 bg-surface p-6">
                <p class="font-serif text-xl font-semibold text-heading">{str(tier.label)}</p>
                {#if str(tier.price)}
                  <p class="mt-3 font-serif text-2xl font-bold text-clay">{str(tier.price)}</p>
                {/if}
                {#if str(tier.body)}
                  <p class="mt-3 text-sm leading-relaxed text-ink/70">{str(tier.body)}</p>
                {/if}
              </article>
            {/each}
          </div>
          {#if str(block.note)}<p class="mt-4 text-sm leading-6 text-ink/55">{str(block.note)}</p>{/if}
        </div>
      </section>
    {/if}

  {:else if block.type === 'itinerary'}
    <!-- The linked tour's real days, through the same renderer the tour page
         uses. Nothing is retyped here, so the two can never disagree. -->
    {#if itineraryDays.length}
      <section id={`package-section-${index}`} data-package-label={NAV_LABELS[block.type]} class={`${surface(index)} ${SECTION}`}>
        <div class={SHELL}>
          {#if eyebrow}
            <div class="inline-flex items-center gap-2">
              <span class="h-px w-6 bg-clay" aria-hidden="true"></span>
              <span class="text-[11px] font-bold uppercase tracking-[0.15em] text-clay">{eyebrow}</span>
            </div>
          {/if}
          {#if title}<h2 class={HEADING}>{title}</h2>{/if}
          {#if intro}<p class={INTRO}>{intro}</p>{/if}
          <div class="package-itinerary mt-8">
            <ItineraryDays days={itineraryDays} autoloadMedia />
          </div>
        </div>
      </section>
    {/if}

  {:else if block.type === 'compare'}
    {@const columns = lines(block.columns)}
    {@const tableRows = rows<{ label?: string; values?: unknown }>(block.rows)}
    {#if columns.length && tableRows.length}
      <section id={`package-section-${index}`} data-package-label={NAV_LABELS[block.type]} class={`${surface(index)} ${SECTION}`}>
        <div class={SHELL}>
          {#if eyebrow}
            <div class="inline-flex items-center gap-2">
              <span class="h-px w-6 bg-clay" aria-hidden="true"></span>
              <span class="text-[11px] font-bold uppercase tracking-[0.15em] text-clay">{eyebrow}</span>
            </div>
          {/if}
          {#if title}<h2 class={HEADING}>{title}</h2>{/if}
          {#if intro}<p class={INTRO}>{intro}</p>{/if}
          <!-- Labelled cards on phones; the full comparison table on larger screens. -->
          <div class="mt-6 grid gap-3 md:hidden">
            {#each tableRows as row, rowIndex (rowIndex)}
              <article class="rounded-2xl border border-ink/10 bg-surface p-4">
                <h3 class="font-serif text-lg font-semibold text-heading">{str(row.label)}</h3>
                <dl class="mt-3 grid gap-3">
                  {#each lines(row.values) as cell, ci (ci)}
                    <div class="grid grid-cols-2 gap-3 border-t border-ink/10 pt-3 text-sm">
                      <dt class="font-semibold text-ink/60">{columns[ci + 1] || $t('ui.option_n').replace('{n}', String(ci + 1))}</dt>
                      <dd class="text-ink/80">{cell}</dd>
                    </div>
                  {/each}
                </dl>
              </article>
            {/each}
          </div>
          <div class="mt-8 hidden overflow-x-auto rounded-[12px] border border-ink/12 md:block">
            <table class="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr class="bg-canvas">
                  {#each columns as column, i (i)}
                    <th class="border-b border-ink/10 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink/60">{column}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each tableRows as row, rowIndex (rowIndex)}
                  <tr class={rowIndex % 2 ? 'bg-canvas/60' : 'bg-surface'}>
                    <th scope="row" class="border-b border-ink/8 px-4 py-3 font-semibold text-heading">{str(row.label)}</th>
                    {#each lines(row.values) as cell, ci (ci)}
                      <td class="border-b border-ink/8 px-4 py-3 text-ink/70">{cell}</td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    {/if}

  {:else if block.type === 'inclusions'}
    {@const included = lines(block.included)}
    {@const excluded = lines(block.excluded)}
    {#if included.length || excluded.length}
      <section id={`package-section-${index}`} data-package-label={NAV_LABELS[block.type]} class={`${surface(index)} ${SECTION}`}>
        <div class={SHELL}>
          {#if title}<h2 class={`${HEADING} mt-0 max-w-3xl`}>{title}</h2>{/if}
          <div class="mt-8 grid gap-5 md:grid-cols-2">
            {#if included.length}
              <article class="package-card-content rounded-[16px] border border-forest/20 bg-forest/[0.06] p-6 md:p-7">
                <h3 class="font-serif text-2xl font-semibold text-heading">{$t('ui.included')}</h3>
                <ul class="mt-5 grid gap-3">
                  {#each included as item, i (i)}
                    <li class="flex gap-3 text-sm leading-6 text-ink/75">
                      <Check size={16} strokeWidth={2.5} class="mt-0.5 shrink-0 text-forest" />
                      <span>{item}</span>
                    </li>
                  {/each}
                </ul>
              </article>
            {/if}
            {#if excluded.length}
              <article class="package-card-content rounded-[16px] border border-clay/20 bg-clay/[0.05] p-6 md:p-7">
                <h3 class="font-serif text-2xl font-semibold text-heading">{$t('ui.not_included')}</h3>
                <ul class="mt-5 grid gap-3">
                  {#each excluded as item, i (i)}
                    <li class="flex gap-3 text-sm leading-6 text-ink/75">
                      <Minus size={16} strokeWidth={2.5} class="mt-0.5 shrink-0 text-clay" />
                      <span>{item}</span>
                    </li>
                  {/each}
                </ul>
              </article>
            {/if}
          </div>
        </div>
      </section>
    {/if}

  {:else if block.type === 'gallery'}
    {@const images = rows<{ image_url?: string; caption?: string }>(block.images).filter((image) => str(image.image_url).trim())}
    {#if images.length}
      <section id={`package-section-${index}`} data-package-label={NAV_LABELS[block.type]} class={`${surface(index)} ${SECTION}`}>
        <div class={SHELL}>
          {#if eyebrow}
            <div class="inline-flex items-center gap-2">
              <span class="h-px w-6 bg-clay" aria-hidden="true"></span>
              <span class="text-[11px] font-bold uppercase tracking-[0.15em] text-clay">{eyebrow}</span>
            </div>
          {/if}
          {#if title}<h2 class={HEADING}>{title}</h2>{/if}
          <div class="package-gallery mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {#each images as image, i (i)}
              <figure class="min-w-0">
                <Img
                  src={str(image.image_url)}
                  alt={str(image.caption)}
                  width={720}
                  sizes="(max-width: 639px) 100vw, (max-width: 1023px) 48vw, 32vw"
                  className="aspect-[4/3] w-full rounded-[12px] object-cover"
                />
                {#if str(image.caption)}
                  <figcaption class="mt-2 text-[13px] leading-6 text-ink/60">{str(image.caption)}</figcaption>
                {/if}
              </figure>
            {/each}
          </div>
        </div>
      </section>
    {/if}

  {:else if block.type === 'tours'}
    {@const picked = byOrder(lines(block.tour_slugs))}
    {#if picked.length}
      <section id={`package-section-${index}`} data-package-label={NAV_LABELS[block.type]} class={`${surface(index)} ${SECTION}`}>
        <div class={SHELL}>
          {#if eyebrow}
            <div class="inline-flex items-center gap-2">
              <span class="h-px w-6 bg-clay" aria-hidden="true"></span>
              <span class="text-[11px] font-bold uppercase tracking-[0.15em] text-clay">{eyebrow}</span>
            </div>
          {/if}
          {#if title}<h2 class={HEADING}>{title}</h2>{/if}
          {#if intro}<p class={INTRO}>{intro}</p>{/if}
          <div class="package-tour-cards mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {#each picked as tour (tour.id)}
              <TourCard {tour} />
            {/each}
          </div>
        </div>
      </section>
    {/if}

  {:else if block.type === 'faq'}
    {@const authored = rows<{ question?: string; answer?: string }>(block.items).filter((item) => str(item.question).trim() && str(item.answer).trim())}
    <!-- Questions typed into the block win; an empty block falls back to the
         ones attached to this package in the FAQ module. -->
    {@const entries = authored.length
      ? authored.map((item, n) => ({ id: `pkg-faq-${index}-${n}`, question: str(item.question), answer: str(item.answer) }))
      : moduleFaqs.map((faq) => ({ id: faq.id, question: faq.question, answer: faq.answer }))}
    {#if entries.length}
      <section id={`package-section-${index}`} data-package-label={NAV_LABELS[block.type]} class={`${surface(index)} ${SECTION}`}>
        <div class={`${SHELL} max-w-[900px]`}>
          {#if eyebrow}
            <div class="inline-flex items-center gap-2">
              <span class="h-px w-6 bg-clay" aria-hidden="true"></span>
              <span class="text-[11px] font-bold uppercase tracking-[0.15em] text-clay">{eyebrow}</span>
            </div>
          {/if}
          {#if title}<h2 class={eyebrow ? HEADING : `${HEADING} mt-0`}>{title}</h2>{/if}
          {#if intro}<p class={INTRO}>{intro}</p>{/if}
          <div class="package-mobile-faq mt-6 grid gap-3 md:hidden">
            {#each entries as entry (entry.id)}
              <details class="rounded-2xl border border-ink/10 bg-surface px-4">
                <summary class="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] font-semibold leading-snug text-heading">
                  <span>{entry.question}</span><ChevronDown size={18} class="shrink-0 text-clay" />
                </summary>
                <RichText value={entry.answer} className="pb-5 text-[15px] leading-7 text-ink/75" />
              </details>
            {/each}
          </div>
          <div class="mt-8 hidden md:block">
            <FAQAccordion faqs={entries} />
          </div>
        </div>
      </section>
    {/if}

  {:else if block.type === 'enquiry' && index === firstEnquiry}
    <!-- The same planner band a safari-style page closes with, questions laid
         out across the band rather than a button that opens a dialog. Reused
         rather than re-cut so a lead from here is shaped like every other one. -->
    <!-- Older packages may contain repeated enquiry blocks. Keep one form
         and one anchor without deleting any saved CMS content. -->
    <div id="lead-form" data-package-enquiry class="scroll-mt-24">
      <StylePlannerBand
        eyebrow={eyebrow || $t('ui.plan_this_safari')}
        title={title || $t('ui.plan_this_trip_with_a')}
        description={intro}
        {startPoints}
        {interests}
        {packageName}
        {packageSlug}
        {routeOptions}
        suggestedRoute={$activeRouteLabel}
      />
    </div>

  {:else if block.type === 'advisor'}
    <!-- The same section the homepage, tours listing, About and safari-style
         pages draw — this page just hands it different words. The site-wide
         switch still governs it, so "off" means off here too. -->
    {#if advisorNoteEnabled(homeSections)}
      <div class="package-advisor">
        <HomeAdvisorNote {...advisorNoteFromBlock(block, homeSections)} />
      </div>
    {/if}

  {:else if block.type === 'routes'}
    {@const routeRows = rows<Record<string, unknown>>(block.routes).filter((route) => routeTourSlugs(route).some((slug) => tours.some((tour) => tour.slug === slug)))}
    {#if routeRows.length}
      <section id={index === blocks.findIndex((item) => item.type === 'routes') ? 'route-options' : `route-options-${index}`} data-package-label={$t('ui.routes')} class={`scroll-mt-20 ${surface(index)} ${SECTION}`}>
        <div class={SHELL}>
          {#if eyebrow}
            <div class="inline-flex items-center gap-2">
              <span class="h-px w-6 bg-clay" aria-hidden="true"></span>
              <span class="text-[11px] font-bold uppercase tracking-[0.15em] text-clay">{eyebrow}</span>
            </div>
          {/if}
          {#if title}<h2 class={HEADING}>{title}</h2>{/if}
          {#if intro}<p class={INTRO}>{intro}</p>{/if}
          <SafariRouteOptions idPrefix={`package-routes-${index}`} routes={routeRows} {tours} {lodges} {formHref} ctaLabel={str(block.cta_label) || $t('ui.send_request_for_this_route')} />
        </div>
      </section>
    {/if}

  {:else if block.type === 'expectations'}
    {@const can = lines(block.can)}
    {@const cannot = lines(block.cannot)}
    {#if can.length || cannot.length}
      <section id={`package-section-${index}`} data-package-label={NAV_LABELS[block.type]} class={`${surface(index)} ${SECTION}`}>
        <div class={SHELL}>
          <div class="package-expectations rounded-[16px] bg-canvas p-6 md:p-9">
            {#if eyebrow}
            <div class="inline-flex items-center gap-2">
              <span class="h-px w-6 bg-clay" aria-hidden="true"></span>
              <span class="text-[11px] font-bold uppercase tracking-[0.15em] text-clay">{eyebrow}</span>
            </div>
          {/if}
            {#if title}<h2 class={HEADING}>{title}</h2>{/if}
            {#if intro}<p class={INTRO}>{intro}</p>{/if}
            <div class="mt-7 grid gap-4 md:grid-cols-2">
              {#if can.length}
                <div class="package-card-content rounded-[12px] border border-ink/10 bg-surface p-5">
                  <h3 class="text-[11px] font-bold uppercase tracking-[0.14em] text-heading">{str(block.can_title) || $t('ui.what_it_can_give_you')}</h3>
                  <ul class="mt-4 grid gap-2.5">
                    {#each can as item, i (i)}
                      <li class="flex gap-2.5 text-[14.5px] leading-relaxed text-ink/70">
                        <span class="mt-[3px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-goldfinch-gold text-heading">
                          <Check size={11} strokeWidth={3} />
                        </span>
                        <span>{item}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
              {#if cannot.length}
                <div class="package-card-content rounded-[12px] border border-ink/10 bg-surface p-5">
                  <h3 class="text-[11px] font-bold uppercase tracking-[0.14em] text-heading">{str(block.cannot_title) || $t('ui.what_it_cannot_give_you')}</h3>
                  <ul class="mt-4 grid gap-2.5">
                    {#each cannot as item, i (i)}
                      <li class="flex gap-2.5 text-[14.5px] leading-relaxed text-ink/70">
                        <span class="mt-[3px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-ink/30 text-ink/50">
                          <Minus size={11} strokeWidth={3} />
                        </span>
                        <span>{item}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
            {#if str(block.note)}<p class="mt-6 max-w-3xl text-[14.5px] leading-relaxed text-ink/70">{str(block.note)}</p>{/if}
          </div>
        </div>
      </section>
    {/if}

  {:else if block.type === 'priceguide'}
    {@const priceRows = rows<{ route?: string; price?: string; best_for?: string; tendency?: string; why?: string }>(block.rows)}
    {@const factors = priceFactors(block.factors)}
    {#if priceRows.length || factors.length}
      <section id={`package-section-${index}`} data-package-label={NAV_LABELS[block.type]} class={`${surface(index)} ${SECTION}`}>
        <div class={SHELL}>
          {#if eyebrow}
            <div class="inline-flex items-center gap-2">
              <span class="h-px w-6 bg-clay" aria-hidden="true"></span>
              <span class="text-[11px] font-bold uppercase tracking-[0.15em] text-clay">{eyebrow}</span>
            </div>
          {/if}
          {#if title}<h2 class={HEADING}>{title}</h2>{/if}
          {#if intro}<p class={INTRO}>{intro}</p>{/if}

          {#if priceRows.length}
            <div class="package-price-list mt-8 overflow-hidden rounded-[12px] border border-ink/10 bg-surface">
              <div class="hidden grid-cols-12 gap-4 bg-deep-green px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/80 md:grid">
                <span class="col-span-3">{$t('ui.option')}</span>
                <span class="col-span-3">{$t('ui.usually_best_for')}</span>
                <span class="col-span-2">{$t('ui.price_tendency')}</span>
                <span class="col-span-4">{$t('ui.why_it_costs_that_way')}</span>
              </div>
              {#each priceRows as row, i (i)}
                <div class="package-price-row grid gap-2 border-b border-ink/10 px-5 py-5 last:border-b-0 md:grid-cols-12 md:items-start md:gap-4 md:py-4">
                  <div class="md:col-span-3">
                    <span class="font-serif block text-[16px] font-semibold text-heading">{str(row.route)}</span>
                    {#if str(row.price)}<span class="mt-1 block text-[13px] font-semibold text-clay">{str(row.price)}</span>{/if}
                  </div>
                  <span class="text-sm text-ink/70 md:col-span-3">{#if str(row.best_for)}<span class="mb-1 block text-[10px] font-bold uppercase tracking-wide text-clay md:hidden">{$t('ui.best_for')}</span>{str(row.best_for)}{/if}</span>
                  <span class="text-sm font-semibold text-heading md:col-span-2">{str(row.tendency)}</span>
                  <span class="text-sm leading-relaxed text-ink/70 md:col-span-4">{str(row.why)}</span>
                </div>
              {/each}
            </div>
          {/if}
          {#if str(block.small_print)}<p class="mt-4 text-[13.5px] italic leading-relaxed text-ink/55">{str(block.small_print)}</p>{/if}

          {#if factors.length}
            <div class="package-price-factors mt-8 rounded-[12px] border border-ink/10 bg-surface p-6">
              <h3 class="font-serif text-lg font-semibold text-heading">{str(block.factors_title) || $t('ui.why_your_quote_may_change')}</h3>
              <div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {#each factors as factor, i (i)}
                  {@const Icon = FACT_ICON[factor.icon.trim().toLowerCase()]}
                  <div class="flex items-start gap-3">
                    <span class="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-canvas text-clay">
                      {#if Icon}<Icon size={18} />{:else}<Banknote size={18} />{/if}
                    </span>
                    <span class="pt-1.5 text-[14.5px] font-medium text-heading">{factor.text}</span>
                  </div>
                {/each}
              </div>
              {#if str(block.factors_note)}<p class="mt-5 text-sm leading-relaxed text-ink/70">{str(block.factors_note)}</p>{/if}
            </div>
          {/if}

          {#if str(block.note)}
            <div class="package-card-content mt-6 rounded-[12px] border-l-[3px] border-goldfinch-gold bg-surface p-5">
              {#if str(block.note_label)}<span class="text-[11px] font-bold uppercase tracking-[0.14em] text-clay">{str(block.note_label)}</span>{/if}
              <p class="mt-2 text-[15px] leading-relaxed text-heading">{str(block.note)}</p>
            </div>
          {/if}

          {#if str(block.cta_label)}
            <a class={`mt-6 w-full sm:w-auto ${GOLD}`} href={formHref}>
              {str(block.cta_label)}
              <ArrowRight size={16} />
            </a>
          {/if}
        </div>
      </section>
    {/if}

  {/if}
{/each}

<style>
  .package-section { overflow-wrap:anywhere; }
  .package-section :global(*) { min-width:0; }
  .package-section-title { text-wrap:balance; }
  .package-facts-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr)); gap:24px; padding-block:28px; }
  .package-fact { overflow-wrap:anywhere; }
  .package-overview-copy { max-width:70ch; }
  .package-overview-note > div { position:sticky; top:calc(var(--nav-h,70px) + 92px); background:rgb(var(--c-surface)/.65); border:0; border-left:3px solid rgb(var(--c-goldfinch-gold)); padding:26px; border-radius:0 10px 10px 0; }
  .package-overview-note p { font-size:19px; line-height:1.6; }
  /* Pasted content keeps its words and semantics; the template owns its type scale. */
  .package-section :global(.rich) { overflow-wrap:anywhere; line-height:1.8; }
  .package-section :global(.rich h2), .package-section :global(.rich h3), .package-section :global(.rich h4) { font-size:1.15em; line-height:1.4; margin-top:1.6em; }
  .package-section :global(.rich p:empty) { display:none; }
  .package-section :global(.rich br + br) { display:none; }
  .package-section :global(.rich ul), .package-section :global(.rich ol) { padding-left:1.25em; }
  .package-section :global(.rich > :first-child) { margin-top:0; }
  .package-section :global(.rich > :last-child) { margin-bottom:0; }
  .package-section :global(img) { max-width:100%; }

  .package-mobile-faq summary::-webkit-details-marker { display: none; }
  .package-mobile-faq details[open] :global(summary svg) { transform: rotate(180deg); }
  .package-mobile-faq summary:focus-visible { outline: 2px solid rgb(var(--c-clay)); outline-offset: 4px; border-radius: 8px; }
  @media (max-width: 767px) {
    .package-facts-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px 16px; }
    .package-overview-note > div { position:static; }
    /* Keep one 16px page gutter and at most one padded card on phones. */
    .package-card-content { padding: 16px; }
    .package-expectations { padding: 0; border-radius: 0; background: transparent; }
    .package-price-list { margin-top: 24px; border: 0; border-radius: 0; background: transparent; }
    .package-price-row { padding: 20px 0; }
    .package-price-row:nth-child(2) { border-top: 1px solid rgb(var(--c-ink) / 0.1); }
    .package-price-factors { margin-top: 24px; padding: 24px 0 0; border: 0; border-top: 1px solid rgb(var(--c-ink) / 0.1); border-radius: 0; background: transparent; }
    .package-itinerary :global(.tour-day-details) { padding: 0; border: 0; border-radius: 0; background: transparent; }
    .package-itinerary :global(.tour-day-accommodation-card) { border: 0; border-radius: 0; background: transparent; }
    .package-itinerary :global(.tour-day-accommodation-card > .p-4) { padding: 12px 0 0; }
    .package-advisor :global(.container-shell) { width: calc(100% - 32px); }
    .package-advisor :global(.home-advisor-note .container-shell > div > div) { padding: 24px 16px; }
    .package-tour-cards :global(article > .p-5) { padding: 16px; }

    .package-section :global(h2) { font-size: 27px; line-height: 1.18; text-wrap: balance; }
    .package-section :global(a.bg-goldfinch-gold) { min-height: 48px; height: auto; padding-block: 12px; text-align: center; color: rgb(var(--c-forest)); }
    .package-fact { border-left: 1px solid rgb(255 255 255 / 0.14); padding-left: 12px; }
    .package-fact:last-child:nth-child(odd) { grid-column: 1 / -1; }
    .package-gallery, .package-tour-cards {
      display: grid;
      grid-auto-flow: column;
      grid-template-columns: none;
      grid-auto-columns: 86%;
      gap: 12px;
      overflow-x: auto;
      margin-inline: -16px;
      padding: 0 16px 12px;
      scroll-snap-type: x mandatory;
      scroll-padding-inline: 16px;
      scrollbar-width: thin;
      scrollbar-color: rgb(var(--c-clay) / 0.4) transparent;
    }
    .package-gallery > figure, .package-tour-cards > :global(*) { scroll-snap-align: start; }
    .package-gallery > figure:only-child, .package-tour-cards > :global(*:only-child) { grid-column: span 1; }
    .package-gallery:has(> figure:only-child), .package-tour-cards:has(> :global(*:only-child)) { grid-auto-columns: 100%; }
  }
</style>
