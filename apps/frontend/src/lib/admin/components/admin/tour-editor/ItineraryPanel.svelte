<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';

  import {
    ArrowDown,
    ArrowUp,
    BedDouble,
    Car,
    ChevronDown,
    CircleAlert,
    Copy,
    Crown,
    MapPin,
    Plane,
    Plus,
    Route,
    Ship,
    Sparkles,
    Tent,
    Trash2,
    TriangleAlert
  } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import { plainToHtml } from '$lib/admin/richText';
  import { SAFARI_STYLE_THEME } from '$lib/safari-pricing';
  import DayEditor from './DayEditor.svelte';
  import {
    LIMITS,
    MAX_ACTIVITY_ITEMS,
    MAX_DAYS,
    STYLE_KEYS,
    STYLE_LABEL,
    blankDay,
    copyDay,
    formatMeals,
    isEmptyDay,
    moveItem,
    parseActivities,
    parseMeals,
    text,
    type DayDraft,
    type DestinationOption,
    type LodgeOption,
    type MediaItem,
    type TourEditorForm
  } from './model';

  /**
   * The heart of the editor: the day-by-day plan as a timeline that reads the
   * way the tour page does. Each day opens in place — no modal — and its
   * number is always its position, so reordering can never leave a gap.
   */
  export let form: TourEditorForm;
  export let destinations: DestinationOption[] = [];
  export let lodges: LodgeOption[] = [];
  export let loadingLodges = false;
  export let onRefreshLodges: () => void = () => {};
  export let mediaItems: MediaItem[] = [];
  export let attemptedSave = false;
  /** Keys of days that would block a save. */
  export let problemDays: string[] = [];
  /** The day open for editing; the page sets it to jump to a problem. */
  export let expandedKey = '';
  export let notify: (message: string, type?: 'success' | 'error') => void = () => {};

  const styleIcons = { budget: Tent, midrange: BedDouble, luxury: Crown };
  const modeIcons = { DRIVE: Car, FLY: Plane, BOAT: Ship };
  const modeLabels = { DRIVE: 'By road', FLY: 'By air', BOAT: 'By boat' };

  let removeIndex: number | null = null;
  let drafting = false;

  $: tripDays = (() => {
    const n = Number(text(form.duration_days));
    return Number.isInteger(n) && n >= 1 ? n : 0;
  })();
  $: missing = tripDays ? Math.max(0, Math.min(MAX_DAYS, tripDays) - form.days.length) : 0;
  $: full = form.days.length >= MAX_DAYS;
  $: lodgeById = new Map(lodges.map((lodge) => [lodge.id, lodge]));
  $: placeName = (id: string) => destinations.find((place) => place.id === id)?.name ?? '';

  const stayName = (day: DayDraft, style: (typeof STYLE_KEYS)[number]) => {
    const stay = day.stays[style];
    if (stay.lodge_id) return lodgeById.get(stay.lodge_id)?.name ?? (loadingLodges ? '…' : 'Linked lodge');
    return text(stay.accommodation);
  };

  const toggle = (key: string) => {
    expandedKey = expandedKey === key ? '' : key;
  };

  const addDay = () => {
    if (full) return;
    const day = blankDay();
    form.days = [...form.days, day];
    expandedKey = day.key;
  };

  const createMissing = () => {
    if (!missing) return;
    const added = Array.from({ length: missing }, blankDay);
    form.days = [...form.days, ...added];
    expandedKey = added[0].key;
    notify(`Added ${added.length} day${added.length === 1 ? '' : 's'} — give each one a title before saving.`);
  };

  const insertAfter = (index: number) => {
    if (full) return;
    const day = blankDay();
    form.days = [...form.days.slice(0, index + 1), day, ...form.days.slice(index + 1)];
    expandedKey = day.key;
  };

  const duplicate = (index: number) => {
    if (full) return;
    const day = copyDay(form.days[index]);
    form.days = [...form.days.slice(0, index + 1), day, ...form.days.slice(index + 1)];
    expandedKey = day.key;
  };

  const move = (index: number, delta: -1 | 1) => {
    form.days = moveItem(form.days, index, delta);
  };

  const confirmRemove = () => {
    if (removeIndex === null) return;
    const removed = form.days[removeIndex];
    form.days = form.days.filter((_, index) => index !== removeIndex);
    if (removed && expandedKey === removed.key) expandedKey = '';
    removeIndex = null;
  };

  // AI co-pilot: drafts the plan from the tour so far, but only ever writes
  // into days that are still empty. Written days are never touched.
  const draftWithAi = async () => {
    if (drafting) return;
    if (!confirm('Draft the empty days with AI? Days that already have content are kept exactly as they are. Review every drafted day before publishing.')) return;
    drafting = true;
    try {
      const destinationNames = form.destination_ids.map(placeName).filter(Boolean).join(', ');
      const res = await api.aiTravelAdvisor.assist({
        task: 'draft_itinerary',
        context: {
          title: text(form.title) || undefined,
          destination: destinationNames || undefined,
          duration_days: tripDays || form.days.length || undefined
        }
      });
      const generated = (res.data.itinerary ?? []) as Array<Record<string, unknown>>;
      if (!generated.length) {
        notify('The AI did not return any days. Please try again.', 'error');
        return;
      }
      const days = [...form.days];
      let filled = 0;
      for (const item of generated) {
        const number = Math.trunc(Number(item.day_number));
        if (!number || number < 1 || number > MAX_DAYS) continue;
        while (days.length < number) days.push(blankDay());
        const day = days[number - 1];
        if (!isEmptyDay(day)) continue;
        // Drafts start inside the limits; anything still too long shows in red on its counter.
        day.title = text(item.title).slice(0, LIMITS.dayTitle);
        day.description = plainToHtml(item.description);
        const meals = parseMeals(item.meals);
        day.meals = meals ? formatMeals(meals) : text(item.meals).slice(0, LIMITS.meals);
        day.activities = parseActivities(item.activities).slice(0, MAX_ACTIVITY_ITEMS);
        filled += 1;
      }
      form.days = days;
      notify(filled ? `Drafted ${filled} day${filled === 1 ? '' : 's'} — review each one, then save.` : 'Every day already has content, so nothing was changed.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'AI draft failed.', 'error');
    } finally {
      drafting = false;
    }
  };
</script>

<div class="grid gap-5 cms-form-panel">
  <section class="cms-form-section grid gap-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Day by day</p>
        <p class="mt-1 text-xs text-ink/55">
          {form.days.length} {form.days.length === 1 ? 'day' : 'days'} planned{tripDays ? ` · the trip is ${tripDays} ${tripDays === 1 ? 'day' : 'days'} long` : ''}.
          Open a day to edit it; the day number follows its position.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <CmsButton variant="ghost" type="button" class="inline-flex h-9 items-center gap-1.5 rounded-md border border-forest/30 bg-forest/5 px-3 text-xs font-bold text-forest transition hover:bg-forest hover:text-white disabled:opacity-50" disabled={drafting} onclick={draftWithAi} title="Draft the empty days with AI">
          <Sparkles size={14} />{drafting ? 'Drafting…' : 'Draft with AI'}
        </CmsButton>
        <CmsButton variant="ghost" type="button" class="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink/10 bg-surface px-3 text-xs font-bold text-ink disabled:opacity-40" disabled={full} onclick={addDay}>
          <Plus size={14} />Add day
        </CmsButton>
      </div>
    </div>

    {#if tripDays && form.days.length && form.days.length !== tripDays}
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <TriangleAlert size={14} class="shrink-0" />
        <span class="min-w-0 flex-1">The trip is set to {tripDays} {tripDays === 1 ? 'day' : 'days'}, but the itinerary has {form.days.length}.</span>
        {#if missing}
          <button type="button" class="font-bold underline-offset-2 hover:underline" on:click={createMissing}>Create {missing} {missing === 1 ? 'day' : 'days'}</button>
        {/if}
        <button type="button" class="font-bold underline-offset-2 hover:underline" on:click={() => (form.duration_days = String(form.days.length))}>Make the trip {form.days.length} {form.days.length === 1 ? 'day' : 'days'}</button>
      </div>
    {/if}
  </section>

  {#if !form.days.length}
    <section class="cms-builder-intro">
      <span class="cms-builder-icon"><Route size={30} strokeWidth={1.3} /></span>
      <h3>No days yet</h3>
      <p>Plan the trip one day at a time: where travellers go, what they do, and where they sleep in each safari style.</p>
      <div class="flex flex-wrap justify-center gap-2">
        {#if missing > 1}
          <CmsButton variant="default" type="button" class="h-10 gap-2 px-5" onclick={createMissing}><Plus size={15} />Create {missing} days</CmsButton>
          <CmsButton variant="outline" type="button" class="h-10 gap-2 px-5" onclick={addDay}>Add day 1</CmsButton>
        {:else}
          <CmsButton variant="default" type="button" class="h-10 gap-2 px-5" onclick={addDay}><Plus size={15} />Add day 1</CmsButton>
        {/if}
      </div>
      <small>Or use “Draft with AI” above to start from a draft.</small>
    </section>
  {:else}
    <ol class="grid gap-3" aria-label="Itinerary days">
      {#each form.days as day, index (day.key)}
        {@const open = expandedKey === day.key}
        {@const blocked = attemptedSave && problemDays.includes(day.key)}
        <li class="grid scroll-mt-4 grid-cols-[40px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[48px_minmax(0,1fr)] sm:gap-3" data-day-key={day.key}>
          <!-- The rail: a round day marker joined to the next one, as on the tour page. -->
          <div class="relative flex justify-center">
            {#if index < form.days.length - 1}<span class="absolute bottom-[-12px] top-12 w-px bg-ink/15" aria-hidden="true"></span>{/if}
            <span class={`relative flex size-10 items-center justify-center rounded-full text-center leading-none shadow-sm sm:size-12 ${open ? 'bg-deep-green text-white' : 'bg-surface text-heading ring-1 ring-ink/15'}`}>
              <span class="grid">
                <span class={`text-[8px] font-bold uppercase tracking-[0.14em] sm:text-[9px] ${open ? 'text-white/70' : 'text-ink/45'}`}>Day</span>
                <strong class="text-sm sm:text-base">{index + 1}</strong>
              </span>
            </span>
          </div>

          <article class={`min-w-0 overflow-hidden rounded-xl border bg-surface shadow-sm ${blocked ? 'border-clay/50' : open ? 'border-forest/35' : 'border-ink/10'}`}>
            <button type="button" class="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-3 text-left sm:p-4" aria-expanded={open} on:click={() => toggle(day.key)}>
              <span class="grid min-w-0 gap-1">
                <span class="flex min-w-0 items-center gap-1.5">
                  {#if blocked}<CircleAlert size={14} class="shrink-0 text-clay" />{/if}
                  <span class={`truncate text-sm font-semibold ${text(day.title) ? 'text-heading' : 'italic text-ink/40'}`}>{text(day.title) || 'Untitled day'}</span>
                </span>
                {#if text(day.summary)}<span class="line-clamp-2 text-xs leading-5 text-ink/60">{day.summary}</span>{/if}
                <span class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink/55">
                  {#if day.destination_id}
                    <span class="inline-flex min-w-0 items-center gap-1"><MapPin size={11} class="shrink-0" /><span class="truncate">{placeName(day.destination_id) || 'Destination'}</span></span>
                  {/if}
                  {#if index > 0 && day.travel_mode}
                    <span class="inline-flex items-center gap-1"><svelte:component this={modeIcons[day.travel_mode]} size={11} />{modeLabels[day.travel_mode]}</span>
                  {/if}
                </span>
                <span class="flex min-w-0 flex-wrap gap-1.5 pt-0.5">
                  {#each STYLE_KEYS as style (style)}
                    {@const stay = stayName(day, style)}
                    {#if stay}
                      <span class="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium text-ink/75" style={`background:${SAFARI_STYLE_THEME[style].light};box-shadow:inset 0 0 0 1px ${SAFARI_STYLE_THEME[style].primary}44`} title={`${STYLE_LABEL[style]} overnight`}>
                        <span style={`color:${SAFARI_STYLE_THEME[style].primary}`}><svelte:component this={styleIcons[style]} size={11} /></span>
                        <span class="truncate">{stay}</span>
                      </span>
                    {/if}
                  {/each}
                </span>
              </span>
              <ChevronDown size={17} class={`mt-0.5 shrink-0 text-ink/45 transition ${open ? 'rotate-180' : ''}`} />
            </button>

            {#if open}
              <DayEditor
                bind:day={form.days[index]}
                {index}
                {destinations}
                tourDestinationIds={form.destination_ids}
                {lodges}
                {loadingLodges}
                {onRefreshLodges}
                {mediaItems}
                {attemptedSave}
              />
            {/if}

            <div class="flex flex-wrap items-center gap-1 border-t border-ink/10 bg-sand/20 px-2 py-1.5">
              <button type="button" class="flex size-8 items-center justify-center rounded-md text-ink/60 hover:bg-surface hover:text-heading disabled:opacity-30" aria-label={`Move day ${index + 1} up`} disabled={index === 0} on:click={() => move(index, -1)}><ArrowUp size={14} /></button>
              <button type="button" class="flex size-8 items-center justify-center rounded-md text-ink/60 hover:bg-surface hover:text-heading disabled:opacity-30" aria-label={`Move day ${index + 1} down`} disabled={index === form.days.length - 1} on:click={() => move(index, 1)}><ArrowDown size={14} /></button>
              <button type="button" class="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-ink/65 hover:bg-surface hover:text-heading disabled:opacity-30" aria-label={`Duplicate day ${index + 1}`} disabled={full} on:click={() => duplicate(index)}><Copy size={13} /><span class="hidden sm:inline">Duplicate</span></button>
              <button type="button" class="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-ink/65 hover:bg-surface hover:text-heading disabled:opacity-30" aria-label={`Insert a day after day ${index + 1}`} disabled={full} on:click={() => insertAfter(index)}><Plus size={13} /><span class="hidden sm:inline">Insert day after</span></button>
              <button type="button" class="ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-red-700 hover:bg-red-50" aria-label={`Remove day ${index + 1}`} on:click={() => (removeIndex = index)}><Trash2 size={13} /><span class="hidden sm:inline">Remove</span></button>
            </div>
          </article>
        </li>
      {/each}
    </ol>

    <div class="flex flex-wrap gap-2 pl-[50px] sm:pl-[60px]">
      <CmsButton variant="outline" type="button" class="h-9 gap-1.5 text-xs" disabled={full} onclick={addDay}><Plus size={14} />Add day {form.days.length + 1}</CmsButton>
    </div>
  {/if}
</div>

<ConfirmModal
  open={removeIndex !== null}
  title="Remove this day"
  message={`Remove day ${removeIndex === null ? '' : removeIndex + 1}${removeIndex !== null && text(form.days[removeIndex]?.title) ? ` “${text(form.days[removeIndex]?.title)}”` : ''}? The days after it move up. Nothing is deleted until you save the tour.`}
  on:cancel={() => (removeIndex = null)}
  on:confirm={confirmRemove}
/>
