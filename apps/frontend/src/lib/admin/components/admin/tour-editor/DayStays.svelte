<script lang="ts">
  import { Switch } from '$lib/components/ui/switch';
  import { Label as CmsLabel } from '$lib/components/ui/label';

  import { BedDouble, Copy, Crown, ExternalLink, RefreshCw, Tent, TriangleAlert } from '@lucide/svelte';
  import { LODGE_LEVELS, lodgeLevelLabel, lodgeLevelsForStyle, styleForLodgeLevel, type LodgeLevel } from '$lib/lodge-levels';
  import { SAFARI_STYLE_THEME, type SafariStyle } from '$lib/safari-pricing';
  import CountedInput from './CountedInput.svelte';
  import { LIMITS, STYLE_KEYS, STYLE_LABEL, text, type DayDraft, type DestinationOption, type LodgeOption } from './model';

  /**
   * Where travellers sleep that night, once per safari style. The pickers
   * start narrowed to lodges of the right comfort level in the day's own
   * destination, which is nearly always the answer; "Show all lodges" is the
   * way out when it is not, and a free-text name covers a property that is
   * not in the CMS yet.
   */
  export let day: DayDraft;
  export let lodges: LodgeOption[] = [];
  export let destinations: DestinationOption[] = [];
  export let loadingLodges = false;
  export let onRefreshLodges: () => void = () => {};

  const OTHER = '__other';
  const icons = { budget: Tent, midrange: BedDouble, luxury: Crown };
  const selectClass =
    'h-10 w-full min-w-0 rounded-md border border-ink/15 bg-surface px-3 text-sm text-ink outline-none transition hover:border-ink/25 focus:border-forest focus:ring-2 focus:ring-forest/20';

  let showAll = false;

  $: lodgeById = new Map(lodges.map((lodge) => [lodge.id, lodge]));
  $: placeName = destinations.find((place) => place.id === day.destination_id)?.name ?? '';
  $: activeLodges = lodges.filter((lodge) => lodge.status !== 'archived').length;

  const fitsStyle = (lodge: LodgeOption, style: SafariStyle) => lodgeLevelsForStyle(style).includes(lodge.level as LodgeLevel);

  /** Lodges offered for one style; the chosen one is always kept in the list. */
  $: optionsFor = (style: SafariStyle) => {
    const active = lodges.filter((lodge) => lodge.status !== 'archived');
    const matches = showAll
      ? active
      : active.filter((lodge) => fitsStyle(lodge, style) && (!day.destination_id || lodge.destination_id === day.destination_id));
    const chosen = day.stays[style].lodge_id;
    const current = chosen ? lodgeById.get(chosen) : undefined;
    const list = current && !matches.some((lodge) => lodge.id === chosen) ? [current, ...matches] : matches;
    return { list, matched: matches.length };
  };

  const optionLabel = (lodge: LodgeOption) => {
    const parts = [lodge.destination_name, showAll ? lodgeLevelLabel(lodge.level) : '', lodge.status === 'archived' ? 'archived' : lodge.status === 'draft' ? 'draft' : '']
      .filter(Boolean);
    return parts.length ? `${lodge.name} · ${parts.join(' · ')}` : lodge.name;
  };

  const pick = (style: SafariStyle, value: string) => {
    const stay = day.stays[style];
    if (value === OTHER) {
      day.stays[style] = { lodge_id: '', accommodation: stay.lodge_id ? '' : stay.accommodation, custom: true };
    } else if (!value) {
      day.stays[style] = { lodge_id: '', accommodation: '', custom: false };
    } else {
      day.stays[style] = { lodge_id: value, accommodation: '', custom: false };
      // Choosing a stay suggests the place — only when the day has none yet,
      // so an editor's own choice is never replaced.
      const lodge = lodgeById.get(value);
      if (!day.destination_id && lodge?.destination_id) day.destination_id = lodge.destination_id;
    }
  };

  const useForAll = (style: SafariStyle) => {
    const source = day.stays[style];
    for (const other of STYLE_KEYS) if (other !== style) day.stays[other] = { ...source };
  };

  const filled = (style: SafariStyle) => Boolean(day.stays[style].lodge_id || text(day.stays[style].accommodation));
  const levelHint = (style: SafariStyle) =>
    LODGE_LEVELS.filter((level) => level.style === style).map((level) => level.hint).join(' · ');
</script>

<div class="grid gap-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <CmsLabel class="flex items-center gap-2 text-xs font-semibold text-ink/65">
      <Switch bind:checked={showAll} aria-label="Show all lodges" />
      Show all lodges
    </CmsLabel>
    <div class="flex items-center gap-1.5">
      <a class="inline-flex h-8 items-center gap-1 rounded-md border border-ink/10 bg-surface px-2.5 text-[11px] font-semibold text-ink/70 hover:text-heading" href="/admin/lodges" target="_blank" rel="noopener">
        Lodges <ExternalLink size={12} />
      </a>
      <button type="button" class="inline-flex h-8 items-center gap-1 rounded-md border border-ink/10 bg-surface px-2.5 text-[11px] font-semibold text-ink/70 hover:text-heading disabled:opacity-50" disabled={loadingLodges} on:click={onRefreshLodges} title="Reload the lodge list after adding one">
        <RefreshCw size={12} class={loadingLodges ? 'animate-spin' : ''} /> Refresh
      </button>
    </div>
  </div>

  {#each STYLE_KEYS as style (style)}
    {@const stay = day.stays[style]}
    {@const theme = SAFARI_STYLE_THEME[style]}
    {@const lodge = stay.lodge_id ? lodgeById.get(stay.lodge_id) : undefined}
    {@const options = optionsFor(style)}
    <div class="grid min-w-0 gap-2 rounded-lg border p-3" style={`border-color:${theme.primary}55;background:${theme.light}`}>
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <span class="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface" style={`color:${theme.primary}`}><svelte:component this={icons[style]} size={15} /></span>
        <span class="text-sm font-semibold text-heading">{STYLE_LABEL[style]}</span>
        {#if lodge && styleForLodgeLevel(lodge.level) !== style}
          <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200" title="The lodge's comfort level does not match this safari style">
            <TriangleAlert size={11} /> Listed as {lodgeLevelLabel(lodge.level)}
          </span>
        {/if}
        {#if filled(style)}
          <button type="button" class="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-ink/60 hover:text-heading" on:click={() => useForAll(style)}>
            <Copy size={11} /> Use for all styles
          </button>
        {/if}
      </div>

      <select
        class={selectClass}
        aria-label={`${STYLE_LABEL[style]} overnight`}
        value={stay.custom ? OTHER : stay.lodge_id}
        on:change={(event) => pick(style, event.currentTarget.value)}
      >
        <option value="">No overnight set</option>
        {#each options.list as option (option.id)}
          <option value={option.id}>{optionLabel(option)}</option>
        {/each}
        <option value={OTHER}>Other — a property not in the CMS…</option>
      </select>

      {#if stay.custom}
        <!-- The tour page shows it as "{name} or similar" on the Overnight line. -->
        <CountedInput
          class="h-10 min-w-0 rounded-md border border-ink/15 bg-surface px-3 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/20"
          label={`${STYLE_LABEL[style]} property name`}
          placeholder="Property name as travellers should see it"
          maxlength={LIMITS.stayName}
          bind:value={day.stays[style].accommodation}
        />
      {:else if !activeLodges && !loadingLodges}
        <p class="text-[11.5px] leading-5 text-ink/55">No lodges in the CMS yet. Add them under Lodges, or choose “Other” to type the property name.</p>
      {:else if !showAll && !options.matched && !loadingLodges}
        <p class="text-[11.5px] leading-5 text-ink/55">
          No {STYLE_LABEL[style].toLowerCase()} lodges{placeName ? ` in ${placeName}` : ''} in the CMS yet ({levelHint(style).toLowerCase()}).
          <button type="button" class="font-semibold text-forest underline-offset-2 hover:underline" on:click={() => (showAll = true)}>Show all lodges</button>
          or add the property under Lodges.
        </p>
      {/if}
    </div>
  {/each}
</div>
