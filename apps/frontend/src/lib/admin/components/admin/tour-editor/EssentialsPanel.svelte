<script lang="ts">
  import { Switch } from '$lib/components/ui/switch';
  import * as Accordion from '$lib/components/ui/accordion';
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';

  import { Star, X } from '@lucide/svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminRichText from '$lib/admin/components/admin/AdminRichText.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import AiAssistButton from '$lib/admin/components/admin/AiAssistButton.svelte';
  import { toPlainText } from '$lib/admin/richText';
  import type { PricingSeason } from '$lib/safari-pricing';
  import CardPreview from './CardPreview.svelte';
  import { LIMITS, slugProblem, text, type DestinationOption, type Option, type TourEditorForm } from './model';

  export let form: TourEditorForm;
  export let destinations: DestinationOption[] = [];
  /** Saved price seasons, for the card preview's "from" price. */
  export let seasons: PricingSeason[] = [];
  export let categoryOptions: Option[] = [];
  export let specialistOptions: Option[] = [];
  export let loadingOptions = false;
  export let attemptedSave = false;
  export let slugManuallyEdited = false;
  /** The saved page URL, which is never rejected for being older than today's pattern. */
  export let storedSlug = '';
  export let aiContext: () => Record<string, unknown> = () => ({});

  const statusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' }
  ];

  let destinationSearch = '';

  $: titleError =
    text(form.title).length < 2
      ? 'Give the safari a title of at least 2 characters.'
      : text(form.title).length > LIMITS.title
        ? `Keep it to ${LIMITS.title} characters so it fits on a tour card.`
        : '';
  $: slugError = slugProblem(form.slug, storedSlug);
  $: glance = text(form.short_description);
  $: glanceError =
    glance && glance.length < 5
      ? 'Write at least 5 characters, or leave it empty.'
      : glance.length > LIMITS.shortDescription
        ? `Keep it to ${LIMITS.shortDescription} characters.`
        : form.status === 'published' && !glance
          ? 'Needed before publishing.'
          : '';
  $: needsDestination = form.status === 'published' && !form.destination_ids.length;

  $: destinationMatches = destinations.filter(
    (place) =>
      (place.status !== 'archived' || form.destination_ids.includes(place.id)) &&
      `${place.name} ${place.region}`.toLowerCase().includes(destinationSearch.trim().toLowerCase())
  );
  $: destinationName = (id: string) => destinations.find((place) => place.id === id)?.name ?? (loadingOptions ? '…' : 'Unknown destination');

  const toggleDestination = (id: string) => {
    form.destination_ids = form.destination_ids.includes(id) ? form.destination_ids.filter((item) => item !== id) : [...form.destination_ids, id];
  };
  const makePrimary = (id: string) => {
    form.destination_ids = [id, ...form.destination_ids.filter((item) => item !== id)];
  };
</script>

<div class="grid gap-5 cms-form-panel">
  <section class="cms-form-section grid gap-5">
    <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">The safari</p>
    <div class="grid gap-4 md:grid-cols-2">
      <div class="grid gap-1.5">
        <AdminFormInput label="Safari title" name="title" required bind:value={form.title} placeholder="e.g. 7-day Serengeti & Ngorongoro safari" maxlength={LIMITS.title} />
        {#if attemptedSave && titleError}
          <span class="text-[11px] font-semibold text-clay">{titleError}</span>
        {:else}
          <span class="text-[11px] text-ink/40">Tour cards show up to three lines of it — see the card preview below.</span>
        {/if}
      </div>
      <div class="cms-field">
        <CmsLabel for="tour-slug">Page URL</CmsLabel>
        <CmsInput
          class="h-10 rounded-md border border-ink/15 bg-black/[0.02] px-3.5 text-sm text-ink outline-none transition hover:border-ink/25 focus:border-forest focus:bg-surface focus:ring-2 focus:ring-forest/20"
          id="tour-slug"
          name="slug"
          bind:value={form.slug}
          oninput={() => (slugManuallyEdited = true)}
        />
        {#if attemptedSave && slugError}
          <span class="text-[11px] font-semibold text-clay">{slugError}</span>
        {:else}
          <span class="text-[11px] text-ink/40">/tours/{text(form.slug) || 'your-safari'} · generated from the title until you edit it.</span>
        {/if}
      </div>
    </div>

    <div class="grid gap-1.5">
      <div class="flex justify-end gap-1.5">
        <AiAssistButton task="write_short" label="Write" getContext={aiContext} on:apply={(e) => (form.short_description = e.detail.text ?? form.short_description)} />
        <AiAssistButton task="improve" label="Improve" getContext={aiContext} getText={() => form.short_description} on:apply={(e) => (form.short_description = e.detail.text ?? form.short_description)} />
      </div>
      <AdminTextArea label="At a glance" name="short_description" bind:value={form.short_description} rows={3} maxlength={LIMITS.shortDescription} placeholder="A few sentences that capture the journey, the places and the feeling." />
      {#if attemptedSave && glanceError}
        <span class="text-[11px] font-semibold text-clay">{glanceError}</span>
      {:else}
        <span class="text-[11px] text-ink/40">The opening paragraph of the tour page, and its search description when none is set. Required to publish.</span>
      {/if}
    </div>

    <div class="grid gap-1.5">
      <div class="flex justify-end gap-1.5">
        <AiAssistButton task="write_description" label="Write" getContext={aiContext} on:apply={(e) => (form.full_description = e.detail.text ?? form.full_description)} />
        <AiAssistButton task="improve" label="Improve" getContext={aiContext} getText={() => toPlainText(form.full_description)} on:apply={(e) => (form.full_description = e.detail.text ?? form.full_description)} />
        <AiAssistButton task="shorten" label="Shorten" getContext={aiContext} getText={() => toPlainText(form.full_description)} on:apply={(e) => (form.full_description = e.detail.text ?? form.full_description)} />
      </div>
      <Accordion.Root type="single"><Accordion.Item value="story" class="border-0"><Accordion.Trigger class="text-xs hover:no-underline">Full safari story <span class="ml-auto mr-2 text-[10px] font-normal text-muted-foreground">Optional</span></Accordion.Trigger><Accordion.Content forceMount class="data-[state=closed]:hidden"><AdminRichText label="Full description" name="full_description" bind:value={form.full_description} rows={6} /></Accordion.Content></Accordion.Item></Accordion.Root>
    </div>
  </section>

  <section class="cms-form-section grid gap-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Destinations</p>
        <p class="mt-1 text-xs text-ink/55">Tick every place this safari visits. The primary destination is the one shown first on cards and used by older pages.</p>
      </div>
      <span class="text-xs font-semibold text-ink/55">{form.destination_ids.length} selected</span>
    </div>
    {#if attemptedSave && needsDestination}<p class="text-xs font-semibold text-clay">Choose at least one destination before publishing.</p>{/if}

    {#if form.destination_ids.length}
      <div class="flex flex-wrap gap-2">
        {#each form.destination_ids as id, i (id)}
          <span class={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${i === 0 ? 'border-deep-green bg-deep-green text-white' : 'border-ink/15 bg-surface text-ink/70'}`}>
            {#if i === 0}<Star size={12} class="shrink-0 fill-current" />{/if}<span class="truncate">{destinationName(id)}</span>
            <button type="button" class="ml-0.5 opacity-70 hover:opacity-100" aria-label={`Remove ${destinationName(id)}`} on:click={() => toggleDestination(id)}><X size={12} /></button>
          </span>
        {/each}
      </div>
    {/if}

    {#if loadingOptions && !destinations.length}
      <div class="h-24 animate-pulse rounded-md bg-sand/60"></div>
    {:else if !destinations.length}
      <p class="rounded-md border border-dashed border-ink/20 px-3 py-4 text-sm text-ink/55">No destinations yet. Add them under Destinations, then link them here.</p>
    {:else}
      <CmsInput
        class="h-10 rounded-md border border-ink/15 bg-black/[0.02] px-3 text-sm"
        placeholder="Filter destinations…"
        bind:value={destinationSearch}
        onkeydown={(event) => event.key === 'Enter' && event.preventDefault()}
      />
      <div class="grid max-h-80 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
        {#each destinationMatches as place (place.id)}
          {@const picked = form.destination_ids.includes(place.id)}
          {@const primary = form.destination_ids[0] === place.id}
          <div class={`flex items-center gap-2.5 rounded-md border px-3 py-2 transition ${picked ? 'border-forest/40 bg-forest/5' : 'border-ink/10 bg-surface'}`}>
            <input type="checkbox" class="h-4 w-4 shrink-0 accent-forest" checked={picked} aria-label={`Include ${place.name}`} on:change={() => toggleDestination(place.id)} />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-ink">{place.name}</p>
              <p class="truncate text-[11px] text-ink/45">{place.region || 'No region'}{place.status && place.status !== 'published' ? ` · ${place.status}` : ''}{place.pinned ? '' : ' · not on the map yet'}</p>
            </div>
            {#if picked}
              {#if primary}
                <span class="shrink-0 text-[10px] font-bold uppercase tracking-wide text-forest">Primary</span>
              {:else}
                <button type="button" class="shrink-0 rounded border border-ink/15 px-2 py-0.5 text-[10px] font-semibold text-ink/60 hover:border-forest/40 hover:text-heading" on:click={() => makePrimary(place.id)}>Make primary</button>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <!-- The real public card, fed from the fields above, so a title or route
       that would be cut on the site is seen being cut while it is typed. -->
  <section class="cms-form-section grid gap-4">
    <div>
      <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">How it looks on the website</p>
      <p class="mt-1 text-xs text-ink/55">Title, route, price and length update as you type. The photo is the main image from Photography.</p>
    </div>
    <CardPreview {form} {destinations} {seasons} />
  </section>

  <!-- Publishing sits here, not on its own step: status arms the strictest
       save rules, so it should be in view while the essentials are written. -->
  <section class="cms-form-section grid gap-5">
    <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Publishing</p>
    <div class={`grid gap-4 ${specialistOptions.length > 1 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
      <AdminSelect label="Status" name="status" bind:value={form.status} options={statusOptions} />
      <AdminSelect label="Category" name="category_id" bind:value={form.category_id} options={categoryOptions} />
      {#if specialistOptions.length > 1}
        <AdminSelect label="Trip specialist" name="specialist_id" bind:value={form.specialist_id} options={specialistOptions} />
      {/if}
    </div>
    <div class="grid gap-3 md:grid-cols-3">
      <CmsLabel class="flex items-center gap-3 rounded-md border border-ink/10 bg-surface px-4 py-3 text-sm font-semibold text-ink">
        <Switch bind:checked={form.is_available} aria-label="Available for booking" />
        Available for booking
      </CmsLabel>
      <CmsLabel class="flex items-center gap-3 rounded-md border border-ink/10 bg-surface px-4 py-3 text-sm font-semibold text-ink">
        <Switch bind:checked={form.is_featured} aria-label="Featured tour" />
        Featured tour
      </CmsLabel>
      <CmsLabel class="flex items-center gap-3 rounded-md border border-ink/10 bg-surface px-4 py-3 text-sm font-semibold text-ink">
        <Switch bind:checked={form.is_popular} aria-label="Popular tour" />
        Popular tour
      </CmsLabel>
    </div>
    <p class="-mt-2 text-xs text-ink/45">Publishing needs at least one destination, an “At a glance” description, published start and end points, and at least one itinerary day.</p>
  </section>
</div>
