<script lang="ts">
  import * as Accordion from '$lib/components/ui/accordion';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { LayoutTemplate } from '@lucide/svelte';
  let currentSection = 'hero';
  let confirmTemplate = false;
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Textarea as CmsTextarea } from '$lib/components/ui/textarea';

  /**
   * The safari-style page, as a form.
   *
   * This content was previously edited as raw JSON in a code box. It produced a
   * correct document and asked a travel operator to be a programmer to get
   * there: one missing comma and the page would not publish, with an error
   * naming a key rather than a thing on the page.
   *
   * Same document, written in plain fields. Every group below is one band on
   * the public page, in the order a visitor scrolls past it, and each is
   * described by what it does rather than what it is called in the data.
   *
   * Every field of the document is reachable from these fields, so there is no
   * raw-JSON escape hatch: it existed only to repair what the form could not
   * express, and there is nothing left in that category.
   */
  import { afterUpdate, createEventDispatcher, onMount } from 'svelte';
  import { AlertTriangle, Check, ChevronDown, Copy, GripVertical, Plus, Sparkles, X } from '@lucide/svelte';
  import AdminLinkPicker from './AdminLinkPicker.svelte';
  import AdminRichText from './AdminRichText.svelte';
  import MediaPicker from './MediaPicker.svelte';
  import { loadInternalLinks, type LinkGroup } from '$lib/admin/internalLinks';
  import {
    defaultStyleLandingContent,
    parseStyleLandingJson,
    styleLandingContentErrors,
    type StyleLandingContent
  } from '$lib/admin/safariStyleLanding';

  /** The document, as the JSON string the parent form already stores. */
  export let json = '';
  /**
   * Everything the operator has already typed about this style. A generated
   * template is built from it, so it reads as a page about THIS safari rather
   * than a generic one to be rewritten.
   */
  export let seed: Record<string, unknown> = {};

  const dispatch = createEventDispatcher<{ change: string; toast: { message: string; tone: 'success' | 'error' } }>();

  let content: StyleLandingContent = defaultStyleLandingContent(seed);
  let lastPushed = '';

  /**
   * Parse whatever the parent holds into an editable object.
   *
   * Only re-reads when the string changed from outside — otherwise every
   * keystroke would round-trip through JSON and reset the caret.
   */
  $: if (json !== lastPushed) {
    const parsed = parseStyleLandingJson(json);
    if (parsed.data) content = parsed.data;
    else if (!json.trim()) content = defaultStyleLandingContent(seed);
    lastPushed = json;
  }

  /**
   * Serialise on ANY change to the document, not only on inputs that remember
   * to call push().
   *
   * The rich-text fields propagate through bind:value rather than events, so an
   * explicit handler on them does nothing — their edits would reach `content`
   * and never reach the JSON that actually gets saved. Watching the object
   * itself covers every field the same way.
   */
  // Deliberately afterUpdate rather than a reactive statement: `json` feeds
  // `content` above, so serialising reactively would close the loop and Svelte
  // refuses to compile it. Running after the update breaks the cycle, and the
  // equality check stops the write from causing another pass.
  afterUpdate(() => {
    const next = JSON.stringify(content, null, 2);
    if (next !== lastPushed) {
      lastPushed = next;
      json = next;
      dispatch('change', next);
    }
  });

  /** Kept so list edits mutate-then-notify in one step. */
  const push = () => {
    content = content;
  };

  $: errors = styleLandingContentErrors(content);
  $: ready = errors.length === 0;

  const generate = () => {
    content = defaultStyleLandingContent(seed);
    push();
    dispatch('toast', { message: 'Filled in with a complete starting page. Edit the wording before publishing.', tone: 'success' });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(content, null, 2));
      dispatch('toast', { message: 'Page content copied.', tone: 'success' });
    } catch {
      dispatch('toast', { message: 'Could not copy to the clipboard.', tone: 'error' });
    }
  };

  // ── List helpers ────────────────────────────────────────────────────────
  //
  // Several of these lists are exactly-four by contract — the layout has four
  // slots and renders four. A fifth does not appear on the page and blocks
  // publishing with an error naming an array index, which is precisely the
  // experience this editor exists to remove. So the buttons enforce it instead
  // of letting someone find out at save time.
  const EXACT_FOUR = 4;

  // Two lists are a range rather than an exact count, and were the ones left
  // without a guard: the overview paragraphs (1–4) and the links under a
  // planning-guide block (1–8). Adding a fifth paragraph saved nothing and
  // returned "Array must contain at most 4 element(s)" — an array-shaped
  // complaint about a box the editor had just been invited to fill.
  const MAX_PARAGRAPHS = 4;
  const MAX_GUIDE_LINKS = 8;

  const addTo = (list: unknown[], item: unknown, max?: number) => {
    if (max !== undefined && list.length >= max) return;
    list.push(item);
    content = content;
    push();
  };
  const removeAt = (list: unknown[], index: number, min = 0) => {
    if (list.length <= min) return;
    list.splice(index, 1);
    content = content;
    push();
  };

  /** "3 of 4" — so the requirement is visible before it is violated. */
  const countLabel = (have: number, need: number) =>
    have === need ? `${need} of ${need}` : `${have} of ${need} — ${have < need ? 'add ' + (need - have) : 'remove ' + (have - need)}`;

  /**
   * Which sections are still missing something.
   *
   * Derived from the same validator that blocks publishing, so the badge on a
   * section and the reason publishing is refused can never disagree.
   */
  const SECTION_KEYS: Record<string, string[]> = {
    hero: ['hero'],
    trust: ['trustChips'],
    overview: ['overview'],
    planner: ['planner'],
    tours: ['tourCollection'],
    guide: ['planningGuide'],
    advisor: ['advisor'],
    steps: ['howItsPlanned'],
    reviews: ['reviews'],
    faq: ['faq'],
    cta: ['finalCta']
  };
  $: incomplete = (key: string) =>
    errors.some((e) => (SECTION_KEYS[key] ?? []).some((prefix) => e.toLowerCase().includes(prefix.toLowerCase())));

  /**
   * How many SECTIONS need work, not how many validation lines failed.
   *
   * One empty hero produces six errors and is still one thing to go and fix;
   * saying "6 sections need filling in" when there are only eleven sections in
   * total reads as far worse than it is.
   */
  $: sectionsIncomplete = Object.keys(SECTION_KEYS).filter((key) => incomplete(key)).length;

  let open: Record<string, boolean> = { hero: true };
  const toggle = (key: string) => (open = { ...open, [key]: !open[key] });

  const field = 'h-10 w-full min-w-0 rounded-md border border-ink/15 bg-surface px-3 text-sm text-heading outline-none transition focus:border-goldfinch-gold focus:ring-2 focus:ring-goldfinch-gold/20';
  const area = 'w-full rounded-md border border-ink/15 bg-surface px-3 py-2.5 text-sm leading-6 text-heading outline-none transition focus:border-goldfinch-gold focus:ring-2 focus:ring-goldfinch-gold/20';
  const label = 'text-[13px] font-semibold text-ink/65';
  const hint = 'text-[11px] leading-5 text-ink/45';

  /**
   * The site's real pages, so card links are chosen rather than typed. Loaded
   * once per editor; a failure leaves the pickers in free-text mode, which is
   * exactly how they behaved before.
   */
  let linkGroups: LinkGroup[] = [];
  let linksLoading = true;

  onMount(async () => {
    try {
      linkGroups = await loadInternalLinks();
    } catch {
      linkGroups = [];
    } finally {
      linksLoading = false;
    }
  });
</script>

<section class="cms-landing-builder">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <Sparkles size={17} class="text-forest" />
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">YOUR EXPERIENCE PAGE</p>
      </div>
      <p class="mt-2 max-w-3xl text-sm leading-6 text-ink/60">
        Build your page one section at a time. Open a section to edit its words, images and links.
      </p>
    </div>
    <div class="flex shrink-0 flex-wrap gap-2">
      <CmsButton variant="ghost"
        class="inline-flex h-10 items-center gap-2 rounded-md border border-forest/25 bg-surface px-3 text-xs font-bold text-forest transition hover:bg-sand/60"
        type="button"
        onclick={() => confirmTemplate = true}><Sparkles size={14} /> Use a template</CmsButton
      >
      <CmsButton variant="ghost"
        class="inline-flex h-10 items-center gap-2 rounded-md border border-ink/10 bg-surface px-3 text-xs font-bold text-ink transition hover:bg-sand/60"
        type="button"
        onclick={copy}><Copy size={14} /> Copy</CmsButton
      >
    </div>
  </div>

  <!-- Status, in terms of what is missing rather than which key failed. -->
  <div
    class={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs ${ready ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
  >
    {#if ready}
      <Check size={15} class="mt-0.5 shrink-0" />
      <span>Every section is filled in. This style is ready to publish.</span>
    {:else}
      <AlertTriangle size={15} class="mt-0.5 shrink-0" />
      <span>
        <strong>{sectionsIncomplete} {sectionsIncomplete === 1 ? 'section still needs' : 'sections still need'} filling in</strong>
        before this can be published. They are marked below.
      </span>
    {/if}
  </div>

  <Accordion.Root type="single" bind:value={currentSection} class="cms-builder-sections">
    <!-- ── Hero ─────────────────────────────────────────────────────────── -->
    <Accordion.Item value="hero" class="cms-builder-item">
<Accordion.Trigger class="cms-builder-trigger">
        <span class="cms-builder-section-icon"><LayoutTemplate size={17}/></span>
        <span class="min-w-0 flex-1">
          <span class="block text-[13px] font-medium text-heading">Hero story</span>
          <span class="block text-[11px] font-normal text-ink/50 mt-1">The full-screen image, headline and two buttons at the top.</span>
        </span>
        {#if incomplete('hero')}<span class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Needs attention</span>{/if}
      </Accordion.Trigger>
      <Accordion.Content forceMount class="cms-builder-fields data-[state=closed]:hidden">
        <div class="grid gap-3 border-t border-ink/10 p-4">
          <CmsLabel class="grid gap-1.5">
            <span class={label}>Small line above the headline</span>
            <CmsInput class={field} bind:value={content.hero.eyebrow} oninput={push} placeholder="e.g. Fly-in safaris from Zanzibar" />
          </CmsLabel>
          <CmsLabel class="grid gap-1.5">
            <span class={label}>Headline</span>
            <CmsInput class={field} bind:value={content.hero.headline} oninput={push} placeholder="The biggest words on the page" />
          </CmsLabel>
          <CmsLabel class="grid gap-1.5">
            <span class={label}>Sentence underneath</span>
            <CmsTextarea class={area} rows={2} bind:value={content.hero.subheadline} oninput={push}></CmsTextarea>
          </CmsLabel>
          <div class="grid gap-3 sm:grid-cols-2">
            <CmsLabel class="grid gap-1.5">
              <span class={label}>Main button</span>
              <CmsInput class={field} bind:value={content.hero.primaryCtaLabel} oninput={push} placeholder="Plan my safari" />
            </CmsLabel>
            <CmsLabel class="grid gap-1.5">
              <span class={label}>Second button</span>
              <CmsInput class={field} bind:value={content.hero.secondaryCtaLabel} oninput={push} placeholder="See the trips" />
            </CmsLabel>
          </div>
          <CmsLabel class="grid gap-1.5">
            <span class={label}>Reassurance line</span>
            <CmsInput class={field} bind:value={content.hero.trustLine} oninput={push} placeholder="e.g. No deposit to talk to us" />
            <span class={hint}>Small print under the buttons.</span>
          </CmsLabel>
        </div>
      </Accordion.Content>
    </Accordion.Item>

    <!-- ── Trust chips ──────────────────────────────────────────────────── -->
    <Accordion.Item value="trust" class="cms-builder-item">
<Accordion.Trigger class="cms-builder-trigger">
        <span class="cms-builder-section-icon"><LayoutTemplate size={17}/></span>
        <span class="min-w-0 flex-1">
          <span class="block text-[13px] font-medium text-heading">Trust highlights</span>
          <span class="block text-[11px] font-normal text-ink/50 mt-1">Four short badges under the hero. Four words each, not sentences.</span>
        </span>
        {#if incomplete('trust')}<span class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Needs attention</span>{/if}
      </Accordion.Trigger>
      <Accordion.Content forceMount class="cms-builder-fields data-[state=closed]:hidden">
        <div class="grid gap-2 border-t border-ink/10 p-4">
          {#each content.trustChips as _, i}
            <div class="flex items-center gap-2">
              <GripVertical size={14} class="shrink-0 text-ink/20" />
              <CmsInput class={field} bind:value={content.trustChips[i]} oninput={push} placeholder="e.g. Licensed local operator" />
              <CmsButton variant="ghost" class="shrink-0 rounded-md p-2 text-ink/35 transition hover:text-red-600 disabled:opacity-30" type="button" aria-label="Remove" disabled={content.trustChips.length <= EXACT_FOUR} onclick={() => removeAt(content.trustChips, i, EXACT_FOUR)}>
                <X size={15} />
              </CmsButton>
            </div>
          {/each}
          <div class="mt-1 flex items-center gap-3">
            <CmsButton variant="ghost" class="inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-ink/15 px-3 text-xs font-semibold text-heading transition hover:bg-sand/50 disabled:opacity-40" type="button" disabled={content.trustChips.length >= EXACT_FOUR} onclick={() => addTo(content.trustChips, '', EXACT_FOUR)}>
              <Plus size={13} /> Add another
            </CmsButton>
            <span class="text-[11px] font-semibold {content.trustChips.length === EXACT_FOUR ? 'text-emerald-600' : 'text-amber-700'}">{countLabel(content.trustChips.length, EXACT_FOUR)}</span>
          </div>
        </div>
      </Accordion.Content>
    </Accordion.Item>

    <!-- ── Overview ─────────────────────────────────────────────────────── -->
    <Accordion.Item value="overview" class="cms-builder-item">
<Accordion.Trigger class="cms-builder-trigger">
        <span class="cms-builder-section-icon"><LayoutTemplate size={17}/></span>
        <span class="min-w-0 flex-1">
          <span class="block text-[13px] font-medium text-heading">Experience overview</span>
          <span class="block text-[11px] font-normal text-ink/50 mt-1">The explaining paragraphs, next to a photo.</span>
        </span>
        {#if incomplete('overview')}<span class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Needs attention</span>{/if}
      </Accordion.Trigger>
      <Accordion.Content forceMount class="cms-builder-fields data-[state=closed]:hidden">
        <div class="grid gap-3 border-t border-ink/10 p-4">
          <div class="grid gap-3 sm:grid-cols-2">
            <CmsLabel class="grid gap-1.5">
              <span class={label}>Small label</span>
              <CmsInput class={field} bind:value={content.overview.label} oninput={push} />
            </CmsLabel>
            <CmsLabel class="grid gap-1.5">
              <span class={label}>Heading</span>
              <CmsInput class={field} bind:value={content.overview.headline} oninput={push} />
            </CmsLabel>
          </div>
          <div class="grid gap-2">
            <span class={label}>
              Paragraphs
              <span class={`font-normal ${content.overview.paragraphs.length > MAX_PARAGRAPHS ? 'text-red-600' : 'text-ink/40'}`}>
                {content.overview.paragraphs.length} of {MAX_PARAGRAPHS} max
              </span>
            </span>
            {#each content.overview.paragraphs as _, i}
              <div class="flex items-start gap-2">
                <div class="min-w-0 flex-1">
                  <!-- Rich text, because the public page renders these through
                       <RichText>. A plain box here would show the operator raw
                       tags for formatting the page is already applying. -->
                  <AdminRichText
                    label=""
                    name={`overview_paragraph_${i}`}
                    rows={4}
                    headings="none"
                    bind:value={content.overview.paragraphs[i]}
                  />
                </div>
                <CmsButton variant="ghost" class="mt-1 shrink-0 rounded-md p-2 text-ink/35 transition hover:text-red-600 disabled:opacity-30" type="button" aria-label="Remove" disabled={content.overview.paragraphs.length <= 1} onclick={() => removeAt(content.overview.paragraphs, i, 1)}>
                  <X size={15} />
                </CmsButton>
              </div>
            {/each}
            <CmsButton variant="ghost" class="inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-ink/15 px-3 text-xs font-semibold text-heading transition hover:bg-sand/50 disabled:opacity-40" type="button" disabled={content.overview.paragraphs.length >= MAX_PARAGRAPHS} onclick={() => addTo(content.overview.paragraphs, '', MAX_PARAGRAPHS)}>
              <Plus size={13} /> Add a paragraph
            </CmsButton>
          </div>
          <div class="grid gap-1.5">
            <span class={label}>Photo <span class="font-normal text-clay">required</span></span>
            <MediaPicker
              label="Overview photo"
              uploadFolder="categories/landing"
              aspect="aspect-[4/3]"
              bind:value={content.overview.imageUrl}
              on:change={push}
            />
            {#if !content.overview.imageUrl}
              <span class={hint}>This band is a photo beside the paragraphs — without one the section renders half empty.</span>
            {/if}
          </div>
        </div>
      </Accordion.Content>
    </Accordion.Item>

    <!-- ── Planner + tours + reviews + faq: short, grouped together ──────── -->
    <Accordion.Item value="bands" class="cms-builder-item">
<Accordion.Trigger class="cms-builder-trigger">
        <span class="cms-builder-section-icon"><LayoutTemplate size={17}/></span>
        <span class="min-w-0 flex-1">
          <span class="block text-[13px] font-medium text-heading">Section headings</span>
          <span class="block text-[11px] font-normal text-ink/50 mt-1">The short titles above the planner, the trip list, the reviews and the questions.</span>
        </span>
        {#if incomplete('planner') || incomplete('tours') || incomplete('reviews') || incomplete('faq')}
          <span class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Needs attention</span>
        {/if}
      </Accordion.Trigger>
      <Accordion.Content forceMount class="cms-builder-fields data-[state=closed]:hidden">
        <div class="grid gap-5 border-t border-ink/10 p-4">
          <div class="grid gap-3">
            <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45">Above the 3-step planner</p>
            <div class="grid gap-3 sm:grid-cols-2">
              <CmsInput class={field} bind:value={content.planner.label} oninput={push} placeholder="Small label" />
              <CmsInput class={field} bind:value={content.planner.headline} oninput={push} placeholder="Heading" />
            </div>
            <CmsTextarea class={area} rows={2} bind:value={content.planner.intro} oninput={push} placeholder="Sentence underneath"></CmsTextarea>
          </div>

          <div class="grid gap-3">
            <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45">Above the list of trips</p>
            <div class="grid gap-3 sm:grid-cols-2">
              <CmsInput class={field} bind:value={content.tourCollection.label} oninput={push} placeholder="Small label" />
              <CmsInput class={field} bind:value={content.tourCollection.headline} oninput={push} placeholder="Heading" />
            </div>
            <CmsTextarea class={area} rows={2} bind:value={content.tourCollection.subheadline} oninput={push} placeholder="Sentence underneath"></CmsTextarea>
            <div class="grid gap-3 sm:grid-cols-2">
              <CmsLabel class="grid gap-1.5">
                <span class={label}>Word for the trips</span>
                <CmsInput class={field} bind:value={content.tourCollection.resultsNoun} oninput={push} placeholder="e.g. safaris" />
                <span class={hint}>Used as “12 safaris”.</span>
              </CmsLabel>
              <CmsLabel class="grid gap-1.5">
                <span class={label}>“Show more” button</span>
                <CmsInput class={field} bind:value={content.tourCollection.loadMoreLabel} oninput={push} placeholder="Show more safaris" />
              </CmsLabel>
            </div>
          </div>

          <div class="grid gap-3">
            <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45">Above the reviews</p>
            <div class="grid gap-3 sm:grid-cols-2">
              <CmsInput class={field} bind:value={content.reviews.label} oninput={push} placeholder="Small label" />
              <CmsInput class={field} bind:value={content.reviews.title} oninput={push} placeholder="Heading" />
            </div>
            <CmsTextarea class={area} rows={2} bind:value={content.reviews.intro} oninput={push} placeholder="Sentence underneath"></CmsTextarea>
          </div>

          <div class="grid gap-3">
            <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45">Above the questions</p>
            <div class="grid gap-3 sm:grid-cols-2">
              <CmsInput class={field} bind:value={content.faq.title} oninput={push} placeholder="Heading" />
              <CmsLabel class="grid gap-1.5">
                <CmsInput class={field} bind:value={content.faq.answeredBy} oninput={push} placeholder="Answered by…" />
                <span class={hint}>e.g. “Answered by our Tanzania team”.</span>
              </CmsLabel>
            </div>
          </div>
        </div>
      </Accordion.Content>
    </Accordion.Item>

    <!-- ── Planning guide ───────────────────────────────────────────────── -->
    <Accordion.Item value="guide" class="cms-builder-item">
<Accordion.Trigger class="cms-builder-trigger">
        <span class="cms-builder-section-icon"><LayoutTemplate size={17}/></span>
        <span class="min-w-0 flex-1">
          <span class="block text-[13px] font-medium text-heading">Planning guide</span>
          <span class="block text-[11px] font-normal text-ink/50 mt-1">Cards answering what people ask before booking — costs, route, best time.</span>
        </span>
        {#if incomplete('guide')}<span class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Needs attention</span>{/if}
      </Accordion.Trigger>
      <Accordion.Content forceMount class="cms-builder-fields data-[state=closed]:hidden">
        <div class="grid gap-3 border-t border-ink/10 p-4">
          <div class="grid gap-3 sm:grid-cols-2">
            <CmsInput class={field} bind:value={content.planningGuide.label} oninput={push} placeholder="Small label" />
            <CmsInput class={field} bind:value={content.planningGuide.title} oninput={push} placeholder="Heading" />
          </div>
          <CmsTextarea class={area} rows={2} bind:value={content.planningGuide.intro} oninput={push} placeholder="Sentence underneath"></CmsTextarea>

          {#each content.planningGuide.blocks as block, i}
            <div class="grid gap-2 rounded-md border border-ink/10 bg-sand/20 p-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/45">Card {i + 1}</span>
                <CmsButton variant="ghost" class="rounded-md p-1.5 text-ink/35 transition hover:text-red-600 disabled:opacity-30" type="button" aria-label="Remove card" disabled={content.planningGuide.blocks.length <= EXACT_FOUR} onclick={() => removeAt(content.planningGuide.blocks, i, EXACT_FOUR)}>
                  <X size={14} />
                </CmsButton>
              </div>
              <CmsInput class={field} bind:value={block.title} oninput={push} placeholder="Card heading, e.g. Travel costs" />
              <AdminRichText
                label=""
                name={`guide_block_${i}`}
                rows={4}
                headings="none"
                placeholder="What someone needs to know. Bullet lists work well here."
                bind:value={block.body}
              />

              {#each block.links as link, li}
                <div class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <CmsInput class={field} bind:value={link.label} oninput={push} placeholder="Link wording" />
                  <!-- Chosen from the site's real published pages rather than
                       typed, so a card cannot link somewhere that never existed.
                       The pencil still allows an anchor or a hand-written path. -->
                  <AdminLinkPicker groups={linkGroups} loading={linksLoading} bind:value={link.href} on:change={push} />
                  <CmsButton variant="ghost" class="rounded-md p-2 text-ink/35 transition hover:text-red-600 disabled:opacity-30" type="button" aria-label="Remove link" disabled={block.links.length <= 1} onclick={() => removeAt(block.links, li, 1)}>
                    <X size={15} />
                  </CmsButton>
                </div>
              {/each}
              <div class="flex items-center gap-3">
                <CmsButton variant="ghost" class="inline-flex h-8 w-fit items-center gap-1.5 rounded-md border border-ink/15 px-2.5 text-[11px] font-semibold text-heading transition hover:bg-surface disabled:opacity-40" type="button" disabled={block.links.length >= MAX_GUIDE_LINKS} onclick={() => addTo(block.links, { label: '', href: '' }, MAX_GUIDE_LINKS)}>
                  <Plus size={12} /> Add a link
                </CmsButton>
                <span class={hint}>Each card needs at least one link. Use a path on this site like <code>/expert-advice</code>, or an anchor like <code>#lead-form</code>.</span>
              </div>
            </div>
          {/each}
          <div class="flex items-center gap-3">
            <CmsButton variant="ghost" class="inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-ink/15 px-3 text-xs font-semibold text-heading transition hover:bg-sand/50 disabled:opacity-40" type="button" disabled={content.planningGuide.blocks.length >= EXACT_FOUR} onclick={() => addTo(content.planningGuide.blocks, { title: '', body: '', links: [{ label: '', href: '/' }] }, EXACT_FOUR)}>
              <Plus size={13} /> Add a card
            </CmsButton>
            <span class="text-[11px] font-semibold {content.planningGuide.blocks.length === EXACT_FOUR ? 'text-emerald-600' : 'text-amber-700'}">{countLabel(content.planningGuide.blocks.length, EXACT_FOUR)}</span>
          </div>
        </div>
      </Accordion.Content>
    </Accordion.Item>

    <!-- ── Advisor ──────────────────────────────────────────────────────── -->
    <Accordion.Item value="advisor" class="cms-builder-item">
<Accordion.Trigger class="cms-builder-trigger">
        <span class="cms-builder-section-icon"><LayoutTemplate size={17}/></span>
        <span class="min-w-0 flex-1">
          <span class="block text-[13px] font-medium text-heading">Expert advice</span>
          <span class="block text-[11px] font-normal text-ink/50 mt-1">This style's own version of the reusable Advisor's Note. The site-wide card supplies the portrait and advisor details.</span>
        </span>
        {#if incomplete('advisor')}<span class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Needs attention</span>{/if}
      </Accordion.Trigger>
      <Accordion.Content forceMount class="cms-builder-fields data-[state=closed]:hidden">
        <div class="grid gap-3 border-t border-ink/10 p-4">
          <CmsInput class={field} bind:value={content.advisor.headline} oninput={push} placeholder="Advisor's note heading" />
          <CmsTextarea class={area} rows={2} bind:value={content.advisor.intro} oninput={push} placeholder="The category-specific note visitors will read"></CmsTextarea>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="grid gap-2">
              <span class={label}>The big decisions</span>
              {#each content.advisor.big as _, i}
                <div class="flex items-center gap-2">
                  <CmsInput class={field} bind:value={content.advisor.big[i]} oninput={push} placeholder="e.g. Which parks, in which order" />
                  <CmsButton variant="ghost" class="shrink-0 rounded-md p-2 text-ink/35 transition hover:text-red-600 disabled:opacity-30" type="button" aria-label="Remove" disabled={content.advisor.big.length <= EXACT_FOUR} onclick={() => removeAt(content.advisor.big, i, EXACT_FOUR)}><X size={15} /></CmsButton>
                </div>
              {/each}
              <div class="flex items-center gap-2">
                <CmsButton variant="ghost" class="inline-flex h-8 w-fit items-center gap-1.5 rounded-md border border-ink/15 px-2.5 text-[11px] font-semibold text-heading transition hover:bg-sand/50 disabled:opacity-40" type="button" disabled={content.advisor.big.length >= EXACT_FOUR} onclick={() => addTo(content.advisor.big, '', EXACT_FOUR)}>
                  <Plus size={12} /> Add
                </CmsButton>
                <span class="text-[11px] font-semibold {content.advisor.big.length === EXACT_FOUR ? 'text-emerald-600' : 'text-amber-700'}">{countLabel(content.advisor.big.length, EXACT_FOUR)}</span>
              </div>
            </div>
            <div class="grid gap-2">
              <span class={label}>The quiet details</span>
              {#each content.advisor.quiet as _, i}
                <div class="flex items-center gap-2">
                  <CmsInput class={field} bind:value={content.advisor.quiet[i]} oninput={push} placeholder="e.g. Luggage limits on light aircraft" />
                  <CmsButton variant="ghost" class="shrink-0 rounded-md p-2 text-ink/35 transition hover:text-red-600 disabled:opacity-30" type="button" aria-label="Remove" disabled={content.advisor.quiet.length <= EXACT_FOUR} onclick={() => removeAt(content.advisor.quiet, i, EXACT_FOUR)}><X size={15} /></CmsButton>
                </div>
              {/each}
              <div class="flex items-center gap-2">
                <CmsButton variant="ghost" class="inline-flex h-8 w-fit items-center gap-1.5 rounded-md border border-ink/15 px-2.5 text-[11px] font-semibold text-heading transition hover:bg-sand/50 disabled:opacity-40" type="button" disabled={content.advisor.quiet.length >= EXACT_FOUR} onclick={() => addTo(content.advisor.quiet, '', EXACT_FOUR)}>
                  <Plus size={12} /> Add
                </CmsButton>
                <span class="text-[11px] font-semibold {content.advisor.quiet.length === EXACT_FOUR ? 'text-emerald-600' : 'text-amber-700'}">{countLabel(content.advisor.quiet.length, EXACT_FOUR)}</span>
              </div>
            </div>
          </div>
        </div>
      </Accordion.Content>
    </Accordion.Item>

    <!-- ── Steps ────────────────────────────────────────────────────────── -->
    <Accordion.Item value="steps" class="cms-builder-item">
<Accordion.Trigger class="cms-builder-trigger">
        <span class="cms-builder-section-icon"><LayoutTemplate size={17}/></span>
        <span class="min-w-0 flex-1">
          <span class="block text-[13px] font-medium text-heading">How it works</span>
          <span class="block text-[11px] font-normal text-ink/50 mt-1">The numbered steps, from first message to going away.</span>
        </span>
        {#if incomplete('steps')}<span class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Needs attention</span>{/if}
      </Accordion.Trigger>
      <Accordion.Content forceMount class="cms-builder-fields data-[state=closed]:hidden">
        <div class="grid gap-3 border-t border-ink/10 p-4">
          <div class="grid gap-3 sm:grid-cols-2">
            <CmsInput class={field} bind:value={content.howItsPlanned.label} oninput={push} placeholder="Small label" />
            <CmsInput class={field} bind:value={content.howItsPlanned.title} oninput={push} placeholder="Heading" />
          </div>
          <CmsTextarea class={area} rows={2} bind:value={content.howItsPlanned.intro} oninput={push} placeholder="Sentence underneath"></CmsTextarea>
          {#each content.howItsPlanned.steps as step, i}
            <div class="grid gap-2 rounded-md border border-ink/10 bg-sand/20 p-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/45">Step {i + 1}</span>
                <CmsButton variant="ghost" class="rounded-md p-1.5 text-ink/35 transition hover:text-red-600 disabled:opacity-30" type="button" aria-label="Remove step" disabled={content.howItsPlanned.steps.length <= EXACT_FOUR} onclick={() => removeAt(content.howItsPlanned.steps, i, EXACT_FOUR)}><X size={14} /></CmsButton>
              </div>
              <CmsInput class={field} bind:value={step.title} oninput={push} placeholder="What happens" />
              <CmsTextarea class={area} rows={2} bind:value={step.text} oninput={push} placeholder="A sentence explaining it"></CmsTextarea>
            </div>
          {/each}
          <div class="flex items-center gap-3">
            <CmsButton variant="ghost" class="inline-flex h-9 w-fit items-center gap-1.5 rounded-md border border-ink/15 px-3 text-xs font-semibold text-heading transition hover:bg-sand/50 disabled:opacity-40" type="button" disabled={content.howItsPlanned.steps.length >= EXACT_FOUR} onclick={() => addTo(content.howItsPlanned.steps, { title: '', text: '' }, EXACT_FOUR)}>
              <Plus size={13} /> Add a step
            </CmsButton>
            <span class="text-[11px] font-semibold {content.howItsPlanned.steps.length === EXACT_FOUR ? 'text-emerald-600' : 'text-amber-700'}">{countLabel(content.howItsPlanned.steps.length, EXACT_FOUR)}</span>
          </div>
        </div>
      </Accordion.Content>
    </Accordion.Item>

    <!-- ── Final CTA ────────────────────────────────────────────────────── -->
    <Accordion.Item value="cta" class="cms-builder-item">
<Accordion.Trigger class="cms-builder-trigger">
        <span class="cms-builder-section-icon"><LayoutTemplate size={17}/></span>
        <span class="min-w-0 flex-1">
          <span class="block text-[13px] font-medium text-heading">Final call to action</span>
          <span class="block text-[11px] font-normal text-ink/50 mt-1">The closing band at the bottom of the page.</span>
        </span>
        {#if incomplete('cta')}<span class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Needs attention</span>{/if}
      </Accordion.Trigger>
      <Accordion.Content forceMount class="cms-builder-fields data-[state=closed]:hidden">
        <div class="grid gap-3 border-t border-ink/10 p-4">
          <div class="grid gap-3 sm:grid-cols-2">
            <CmsInput class={field} bind:value={content.finalCta.label} oninput={push} placeholder="Small label" />
            <CmsInput class={field} bind:value={content.finalCta.headline} oninput={push} placeholder="Heading" />
          </div>
          <CmsTextarea class={area} rows={2} bind:value={content.finalCta.subheadline} oninput={push} placeholder="Sentence underneath"></CmsTextarea>
          <div class="grid gap-3 sm:grid-cols-2">
            <CmsLabel class="grid gap-1.5">
              <span class={label}>Button</span>
              <CmsInput class={field} bind:value={content.finalCta.buttonLabel} oninput={push} />
            </CmsLabel>
            <CmsLabel class="grid gap-1.5">
              <span class={label}>WhatsApp button</span>
              <CmsInput class={field} bind:value={content.finalCta.whatsappLabel} oninput={push} />
            </CmsLabel>
          </div>
          <div class="grid gap-2">
            <span class={label}>Short reassurances beside the buttons</span>
            {#each content.finalCta.proofs as _, i}
              <div class="flex items-center gap-2">
                <CmsInput class={field} bind:value={content.finalCta.proofs[i]} oninput={push} placeholder="e.g. Replies within a day" />
                <CmsButton variant="ghost" class="shrink-0 rounded-md p-2 text-ink/35 transition hover:text-red-600 disabled:opacity-30" type="button" aria-label="Remove" disabled={content.finalCta.proofs.length <= EXACT_FOUR} onclick={() => removeAt(content.finalCta.proofs, i, EXACT_FOUR)}><X size={15} /></CmsButton>
              </div>
            {/each}
            <div class="flex items-center gap-3">
              <CmsButton variant="ghost" class="inline-flex h-8 w-fit items-center gap-1.5 rounded-md border border-ink/15 px-2.5 text-[11px] font-semibold text-heading transition hover:bg-sand/50 disabled:opacity-40" type="button" disabled={content.finalCta.proofs.length >= EXACT_FOUR} onclick={() => addTo(content.finalCta.proofs, '', EXACT_FOUR)}>
                <Plus size={12} /> Add
              </CmsButton>
              <span class="text-[11px] font-semibold {content.finalCta.proofs.length === EXACT_FOUR ? 'text-emerald-600' : 'text-amber-700'}">{countLabel(content.finalCta.proofs.length, EXACT_FOUR)}</span>
            </div>
          </div>
        </div>
      </Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>

</section>

<AlertDialog.Root bind:open={confirmTemplate}><AlertDialog.Content><AlertDialog.Header><AlertDialog.Title>Replace this page with a template?</AlertDialog.Title><AlertDialog.Description>This replaces the text and sections currently in this editor. Your category name, travel details and photography stay unchanged.</AlertDialog.Description></AlertDialog.Header><AlertDialog.Footer><AlertDialog.Cancel>Keep editing</AlertDialog.Cancel><AlertDialog.Action onclick={generate}>Use template</AlertDialog.Action></AlertDialog.Footer></AlertDialog.Content></AlertDialog.Root>
