<script lang="ts">
  import * as Accordion from '$lib/components/ui/accordion';
  import { Button as CmsButton } from '$lib/components/ui/button';

  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import AiAssistButton from '$lib/admin/components/admin/AiAssistButton.svelte';
  import { LODGE_LEVELS } from '$lib/lodge-levels';
  import TripEndpointsEditor from './TripEndpointsEditor.svelte';
  import type { TripPoint } from '$lib/admin/types';
  import ListEditor from './ListEditor.svelte';
  import { DIFFICULTY_LEVELS, LIMITS, MAX_HIGHLIGHTS, STYLE_KEYS, STYLE_LABEL, suggestedNights, text, type Option, type TourEditorForm } from './model';

  export let form: TourEditorForm;
  export let tripPoints: TripPoint[] = [];
  export let travelStyleOptions: Option[] = [];
  export let loadingOptions = false;
  export let attemptedSave = false;
  export let aiContext: () => Record<string, unknown> = () => ({});

  $: daysValue = Number(text(form.duration_days));
  $: daysError = !Number.isInteger(daysValue) || daysValue < 1 ? 'Days must be a whole number, at least 1.' : '';
  $: nights = suggestedNights(form.duration_days);
  $: nightsBlank = !text(form.duration_nights);

  // Older tours stored free text; a value outside the list stays selectable so
  // saving without touching it never changes it.
  $: difficultyOptions = [
    { label: 'Not set', value: '' },
    ...DIFFICULTY_LEVELS.map((level) => ({ label: level, value: level })),
    ...(text(form.difficulty_level) && !(DIFFICULTY_LEVELS as readonly string[]).includes(text(form.difficulty_level))
      ? [{ label: `${form.difficulty_level} (older wording)`, value: form.difficulty_level }]
      : [])
  ];
  $: comfortOptions = [
    { label: 'Not set', value: '' },
    ...STYLE_KEYS.map((style) => ({ label: STYLE_LABEL[style], value: style })),
    ...(text(form.budget_tier) && !(STYLE_KEYS as string[]).includes(text(form.budget_tier))
      ? [{ label: `${form.budget_tier} (older wording)`, value: form.budget_tier }]
      : [])
  ];
  $: comfortHint = LODGE_LEVELS.filter((level) => level.style === form.budget_tier).map((level) => level.hint).join(' · ');

  const toggleTravelStyle = (key: string) => {
    form.persona_tags = form.persona_tags.includes(key) ? form.persona_tags.filter((value) => value !== key) : [...form.persona_tags, key];
  };
  $: unmatchedStyles = form.persona_tags.filter((key) => !travelStyleOptions.some((style) => style.value === key));

  const applyHighlights = (items: string[] | undefined) => {
    const list = (items ?? []).map(String).map((item) => item.trim()).filter(Boolean).slice(0, MAX_HIGHLIGHTS);
    if (list.length) form.highlights = list;
  };
</script>

<div class="grid gap-5 cms-form-panel">
  <section class="cms-form-section grid gap-5">
    <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Length & route</p>
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="grid gap-1.5">
        <AdminFormInput label="Days" required name="duration_days" type="number" min={1} bind:value={form.duration_days} />
        {#if attemptedSave && daysError}<span class="text-[11px] font-semibold text-clay">{daysError}</span>{/if}
      </div>
      <div class="grid gap-1.5">
        <AdminFormInput label="Nights" name="duration_nights" type="number" min={0} bind:value={form.duration_nights} placeholder={String(nights)} />
        {#if nightsBlank}
          <span class="text-[11px] text-ink/40">Left blank, it is saved as {nights} {nights === 1 ? 'night' : 'nights'} (days − 1).</span>
        {:else if !daysError && Number(text(form.duration_nights)) !== nights}
          <button type="button" class="w-fit text-[11px] font-semibold text-forest underline-offset-2 hover:underline" on:click={() => (form.duration_nights = String(nights))}>Use {nights} {nights === 1 ? 'night' : 'nights'} (days − 1)</button>
        {/if}
      </div>

    </div>
    <TripEndpointsEditor bind:form points={tripPoints} loading={loadingOptions} {attemptedSave} />
  </section>

  <section class="cms-form-section grid gap-5">
    <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Who it suits</p>
    <div class="grid gap-4 sm:grid-cols-3">
      <AdminFormInput label="Minimum group size" name="group_size_min" type="number" min={0} bind:value={form.group_size_min} />
      <AdminFormInput label="Maximum group size" name="group_size_max" type="number" min={0} bind:value={form.group_size_max} />
      <AdminFormInput label="Minimum age" name="minimum_age" type="number" min={0} bind:value={form.minimum_age} />
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <AdminSelect label="Difficulty" name="difficulty_level" bind:value={form.difficulty_level} options={difficultyOptions} />
      <div class="grid gap-1.5">
        <AdminSelect label="Comfort level" name="budget_tier" bind:value={form.budget_tier} options={comfortOptions} />
        <span class="text-[11px] text-ink/40">{comfortHint || 'The safari style this tour is built around. Prices for every style are set under Pricing.'}</span>
      </div>
    </div>
  </section>

  <section class="cms-form-section grid gap-3">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Highlights</p>
        <p class="mt-1 text-xs text-ink/55">One short point per line, in the order travellers should read them — up to {MAX_HIGHLIGHTS}, each a line or two on the tour page.</p>
      </div>
      <AiAssistButton task="suggest_highlights" label="Suggest highlights" getContext={aiContext} on:apply={(e) => applyHighlights(e.detail.items)} />
    </div>
    <ListEditor
      bind:items={form.highlights}
      label="Highlight"
      placeholder="e.g. Private game drives in the Serengeti"
      max={MAX_HIGHLIGHTS}
      maxLength={LIMITS.highlight}
      limitNote="a short list is what travellers actually read."
    />
  </section>

  <section class="cms-form-section grid gap-4">
    <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Matching</p>
    <AdminFormInput label="Experience type" name="experience_type" bind:value={form.experience_type} placeholder="safari, beach, trekking" maxlength={LIMITS.experienceType} />
    <div class="grid gap-2">
      <div>
        <span class="text-[13px] font-semibold text-ink/65">Travel styles</span>
        <p class="mt-0.5 text-xs text-ink/45">Attach this tour to one or more persona-enabled Travel Styles.</p>
      </div>
      {#if loadingOptions && !travelStyleOptions.length}
        <div class="h-11 animate-pulse rounded-md bg-sand/70"></div>
      {:else if travelStyleOptions.length}
        <div class="flex flex-wrap gap-2" role="group" aria-label="Travel styles">
          {#each travelStyleOptions as style (style.value)}
            <CmsButton variant="ghost"
              type="button"
              aria-pressed={form.persona_tags.includes(style.value)}
              class={`inline-flex min-h-10 items-center rounded-md border px-3.5 py-2 text-sm font-semibold transition ${form.persona_tags.includes(style.value) ? 'border-forest bg-forest text-white shadow-sm' : 'border-ink/15 bg-black/[0.02] text-ink hover:border-forest/40 hover:bg-sand/60'}`}
              onclick={() => toggleTravelStyle(style.value)}
            >
              {style.label}
            </CmsButton>
          {/each}
        </div>
      {:else}
        <p class="rounded-md border border-dashed border-ink/15 bg-sand/35 px-3.5 py-3 text-sm text-ink/55">
          No persona-enabled Travel Styles are available. Add a Persona key on the Travel Styles page first.
        </p>
      {/if}
      {#if unmatchedStyles.length}
        <p class="text-xs leading-5 text-amber-700">Existing unmatched keys are kept: {unmatchedStyles.join(', ')}</p>
      {/if}
    </div>
  </section>

  <Accordion.Root type="single" class="cms-form-section"><Accordion.Item value="customization" class="border-0"><Accordion.Trigger class="text-sm hover:no-underline">Trip customisation <span class="ml-auto mr-2 text-[10px] font-normal text-muted-foreground">Optional</span></Accordion.Trigger><Accordion.Content forceMount class="data-[state=closed]:hidden">
    <div class="grid gap-4 pt-3">
      <p class="text-xs text-ink/55">Ways travellers can adjust this particular tour.</p>
      <AdminTextArea label="Introduction" name="customization_intro" bind:value={form.customization_intro} rows={3} placeholder="Explain how this specific tour can be adjusted." />
      <ListEditor bind:items={form.customization_options} label="Option" placeholder="e.g. Add a Zanzibar beach extension" max={20} maxLength={LIMITS.customizationOption} addLabel="Add option" />
    </div>
  </Accordion.Content></Accordion.Item></Accordion.Root>
</div>
