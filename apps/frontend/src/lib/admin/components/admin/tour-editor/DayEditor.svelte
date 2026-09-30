<script lang="ts">
  import { BedDouble, Car, Image as ImageIcon, ListChecks, MapPin, Plane, Ship, Utensils } from '@lucide/svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminRichText from '$lib/admin/components/admin/AdminRichText.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import CountedInput from './CountedInput.svelte';
  import DayPreview from './DayPreview.svelte';
  import DayStays from './DayStays.svelte';
  import ListEditor from './ListEditor.svelte';
  import {
    LIMITS,
    MAX_ACTIVITY_ITEMS,
    MAX_DAY_PHOTOS,
    MEALS,
    TRAVEL_MODES,
    formatMeals,
    parseMeals,
    text,
    type DayDraft,
    type DestinationOption,
    type LodgeOption,
    type Meal,
    type MediaItem,
    type TravelMode
  } from './model';

  /** The inline editor under one day of the itinerary timeline. */
  export let day: DayDraft;
  export let index: number;
  export let destinations: DestinationOption[] = [];
  /** The tour's own destinations, listed first in the place picker. */
  export let tourDestinationIds: string[] = [];
  export let lodges: LodgeOption[] = [];
  export let loadingLodges = false;
  export let onRefreshLodges: () => void = () => {};
  export let mediaItems: MediaItem[] = [];
  export let attemptedSave = false;

  const selectClass =
    'h-10 w-full min-w-0 rounded-md border border-ink/15 bg-surface px-3 text-sm text-ink outline-none transition hover:border-ink/25 focus:border-forest focus:ring-2 focus:ring-forest/20';
  const modeIcons = { DRIVE: Car, FLY: Plane, BOAT: Ship };
  const name = (field: string) => `day_${day.key}_${field}`;

  // A stored value the chips cannot express ("Picnic lunch") stays as typed.
  let customMeals = parseMeals(day.meals) === null;
  $: chosenMeals = customMeals ? [] : (parseMeals(day.meals) ?? []);

  const toggleMeal = (meal: Meal) => {
    const current = parseMeals(day.meals) ?? [];
    day.meals = formatMeals(current.includes(meal) ? current.filter((item) => item !== meal) : [...current, meal]);
    customMeals = false;
  };

  const setMode = (mode: TravelMode) => {
    day.travel_mode = mode;
  };

  $: tourPlaces = tourDestinationIds
    .map((id) => destinations.find((place) => place.id === id))
    .filter((place): place is DestinationOption => Boolean(place));
  $: otherPlaces = destinations.filter(
    (place) => !tourDestinationIds.includes(place.id) && (place.status !== 'archived' || place.id === day.destination_id)
  );
  $: place = destinations.find((item) => item.id === day.destination_id);
  const placeLabel = (item: DestinationOption) => (item.pinned ? item.name : `${item.name} — not on the map yet`);

  $: titleError = attemptedSave && text(day.title).length < 2;
</script>

<div class="grid gap-6 border-t border-ink/10 p-3 sm:p-5">
  <section class="@container grid gap-4">
    <!-- Typed on the left, shown on the right as the tour page will wrap it —
         side by side once the day itself is wide enough, not the window. -->
    <div class="grid gap-4 @2xl:grid-cols-[minmax(0,1fr)_auto] @2xl:items-start">
      <div class="grid content-start gap-4">
        <div class="grid gap-1.5">
          <AdminFormInput label={`Day ${index + 1} title`} name={name('title')} required bind:value={day.title} placeholder="e.g. Arusha to Tarangire National Park" maxlength={LIMITS.dayTitle} />
          {#if titleError}<span class="text-[11px] font-semibold text-clay">Give this day a title of at least 2 characters.</span>{/if}
        </div>
        <div class="grid gap-1.5">
          <AdminFormInput label="One-line summary" name={name('summary')} bind:value={day.summary} placeholder="e.g. Game drive among Tarangire's baobabs and elephant herds" maxlength={LIMITS.daySummary} />
          <span class="text-[11px] text-ink/40">Sits under the title. A line on a laptop; three or four on a phone.</span>
        </div>
      </div>
      <DayPreview {day} {index} {lodges} />
    </div>
    <AdminRichText label="What happens this day" name={name('description')} bind:value={day.description} rows={6} maxChars={LIMITS.dayDescription} placeholder="Describe the day in order: the drive, the game viewing, lunch, the evening." />
  </section>

  <section class="grid gap-4">
    <p class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70"><MapPin size={14} /> Where</p>
    <div class="grid gap-1.5">
      <label class="text-[13px] font-semibold text-ink/65" for={name('destination')}>Main destination</label>
      <select id={name('destination')} class={selectClass} bind:value={day.destination_id}>
        <option value="">Not set</option>
        {#if tourPlaces.length}
          <optgroup label="This safari's destinations">
            {#each tourPlaces as item (item.id)}<option value={item.id}>{placeLabel(item)}</option>{/each}
          </optgroup>
        {/if}
        <optgroup label={tourPlaces.length ? 'Other destinations' : 'All destinations'}>
          {#each otherPlaces as item (item.id)}<option value={item.id}>{placeLabel(item)}</option>{/each}
        </optgroup>
      </select>
      <!-- Says what the choice does to the public page, because the
           consequence is invisible from inside this form. -->
      {#if !day.destination_id}
        <p class="text-[12px] leading-5 text-ink/55">Pick a place and this day appears as a numbered pin on the tour's route map.</p>
      {:else if place && !place.pinned}
        <p class="rounded-md border border-clay/25 bg-clay/5 px-3 py-2 text-[12px] leading-5 text-clay">
          This place has no map position yet, so the day will not appear on the route.
          <a class="font-semibold underline" href="/admin/destinations" target="_blank" rel="noopener">Add its latitude and longitude</a>
          once and every tour that visits it is mapped.
        </p>
      {:else}
        <p class="text-[12px] leading-5 text-ink/55">Pinned on the route map.</p>
      {/if}
    </div>

    {#if index > 0}
      <div class="grid gap-1.5">
        <span class="text-[13px] font-semibold text-ink/65">How travellers get here</span>
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="How travellers get here">
          {#each TRAVEL_MODES as mode (mode.value)}
            <button
              type="button"
              aria-pressed={day.travel_mode === mode.value}
              class={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${day.travel_mode === mode.value ? 'border-deep-green bg-deep-green text-white' : 'border-ink/15 bg-surface text-ink/65 hover:border-forest/40'}`}
              on:click={() => setMode(mode.value)}
            >
              <svelte:component this={modeIcons[mode.value]} size={13} />{mode.label}
            </button>
          {/each}
          <button
            type="button"
            aria-pressed={!day.travel_mode}
            class={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold transition ${!day.travel_mode ? 'border-deep-green bg-deep-green text-white' : 'border-ink/15 bg-surface text-ink/65 hover:border-forest/40'}`}
            on:click={() => setMode('')}
          >Not stated</button>
        </div>
        <p class="text-[12px] leading-5 text-ink/55">Draws the leg into this day's place. Leave it as not stated rather than guess.</p>
      </div>
    {/if}
  </section>

  <section class="grid gap-3">
    <p class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70"><BedDouble size={14} /> Overnight per safari style</p>
    <DayStays bind:day {lodges} {destinations} {loadingLodges} {onRefreshLodges} />
  </section>

  <section class="grid gap-3">
    <p class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70"><Utensils size={14} /> Meals</p>
    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Meals included">
      {#each MEALS as meal (meal)}
        <button
          type="button"
          aria-pressed={chosenMeals.includes(meal)}
          class={`h-9 rounded-full border px-3.5 text-xs font-semibold transition ${chosenMeals.includes(meal) ? 'border-deep-green bg-deep-green text-white' : 'border-ink/15 bg-surface text-ink/65 hover:border-forest/40'}`}
          on:click={() => toggleMeal(meal)}
        >{meal}</button>
      {/each}
      <button
        type="button"
        aria-pressed={customMeals}
        class={`h-9 rounded-full border px-3.5 text-xs font-semibold transition ${customMeals ? 'border-deep-green bg-deep-green text-white' : 'border-dashed border-ink/20 bg-surface text-ink/60 hover:border-forest/40'}`}
        on:click={() => (customMeals = !customMeals)}
      >Custom…</button>
    </div>
    {#if customMeals}
      <CountedInput
        class="h-10 min-w-0 rounded-md border border-ink/15 bg-surface px-3 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/20"
        label="Meals, in your own words"
        placeholder="e.g. Breakfast & picnic lunch"
        maxlength={LIMITS.meals}
        bind:value={day.meals}
      />
    {:else}
      <p class="text-[12px] text-ink/55">{day.meals ? `Shown as “${day.meals}”.` : 'No meals listed for this day.'}</p>
    {/if}
  </section>

  <section class="grid gap-3">
    <p class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70"><ListChecks size={14} /> Activities</p>
    <ListEditor
      bind:items={day.activities}
      label="Activity"
      placeholder="e.g. Afternoon game drive"
      max={MAX_ACTIVITY_ITEMS}
      maxLength={LIMITS.activity}
      limitNote="each one is a chip on the day card; put the rest in the description."
      addLabel="Add activity"
    />
  </section>

  <section class="grid gap-3">
    <div>
      <p class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70"><ImageIcon size={14} /> Photos</p>
      <p class="mt-1 text-xs text-ink/55">The first photo leads the day; the tour page shows up to {MAX_DAY_PHOTOS}.</p>
    </div>
    <div class="grid gap-4 sm:grid-cols-3">
      {#each day.image_urls as _url, photo}
        <MediaPicker label={photo === 0 ? 'Lead photo' : `Photo ${photo + 1}`} media={mediaItems} uploadFolder="itineraries" aspect="aspect-[4/3]" bind:value={day.image_urls[photo]} />
      {/each}
    </div>
  </section>
</div>
