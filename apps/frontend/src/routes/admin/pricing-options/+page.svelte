<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsSelect from '$lib/components/ui/native-select';

  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Copy, Eye, Plus, Save, Trash2 } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import SafariStyleSelector from '$lib/components/pricing/safari-style-selector.svelte';
  import SafariPriceByGroupSize from '$lib/components/pricing/safari-price-by-group-size.svelte';
  import {
    DEFAULT_STYLE,
    SAFARI_STYLES,
    groupLabel,
    standardGroupPrices,
    styleOf,
    type GroupPrice,
    type PricingSeason,
    type SafariStyle
  } from '$lib/safari-pricing';

  /**
   * Pricing Options: per tour, a per-person price for each group size, for
   * each safari style (Budget / Midrange / Luxury). A style can hold several
   * seasons (Standard, Peak, custom dates); the site shows the one whose dates
   * cover today, otherwise the Standard Season.
   */
  type TourOption = { id: string; title: string; currency?: string };

  const field = 'h-11 w-full rounded-md border border-ink/15 bg-black/[0.02] px-3 text-sm text-ink outline-none transition hover:border-ink/25 focus:border-forest focus:bg-surface focus:ring-2 focus:ring-forest/20 disabled:cursor-not-allowed disabled:opacity-50';
  const labelCls = 'grid min-w-0 gap-1.5 text-[12px] font-semibold text-ink/65';
  const styleTitle = (style: SafariStyle) => SAFARI_STYLES.find((item) => item.id === style)?.title ?? style;

  let tours: TourOption[] = [];
  let selectedTourId = '';
  let seasons: PricingSeason[] = [];
  let activeStyle: SafariStyle = DEFAULT_STYLE;
  let loading = true;
  let loadingPrices = false;
  let saving = false;
  let error = '';
  let notice = '';
  let noticeTone: 'error' | 'success' = 'success';

  $: selectedTour = tours.find((tour) => tour.id === selectedTourId);
  $: tourOptions = [{ label: 'Select a tour', value: '' }, ...tours.map((tour) => ({ label: tour.title, value: tour.id }))];
  // Seasons of the open tab, keeping their index in the full list for edits.
  $: styleSeasons = seasons.map((season, index) => ({ season, index })).filter(({ season }) => styleOf(season) === activeStyle);
  $: otherStylesWithSeasons = SAFARI_STYLES.map((style) => style.id).filter((id) => id !== activeStyle && seasons.some((season) => styleOf(season) === id));

  /** Tab caption: how many of the style's rows have a fixed price. */
  const styleNote = (style: SafariStyle) => {
    const rows = seasons.filter((season) => styleOf(season) === style).flatMap((season) => season.group_prices);
    if (!rows.length) return 'Not set up';
    return `${rows.filter((row) => row.price_status === 'FIXED_PRICE' && row.price != null).length} of ${rows.length} prices set`;
  };

  const say = (message: string, tone: 'error' | 'success' = 'error') => {
    notice = message;
    noticeTone = tone;
  };

  const loadTours = async () => {
    loading = true;
    error = '';
    try {
      const result = await api.tours.list({ limit: 100, status: 'all', view: 'summary' });
      tours = result.data.items.map((tour) => ({ id: tour.id, title: tour.title, currency: tour.currency || 'USD' }));
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unable to load tours.';
    } finally {
      loading = false;
    }
  };

  const loadSeasons = async () => {
    seasons = [];
    notice = '';
    if (!selectedTourId) return;
    loadingPrices = true;
    try {
      const result = await api.pricingOptions.seasons(selectedTourId);
      seasons = (result.data as unknown as PricingSeason[]).map((season) => ({
        ...season,
        safari_style: styleOf(season),
        group_prices: [...(season.group_prices || [])].sort((a, b) => a.minimum_travelers - b.minimum_travelers)
      }));
      // Open the first style that already has prices, else Midrange.
      activeStyle = seasons.some((season) => styleOf(season) === activeStyle) ? activeStyle : (seasons[0] ? styleOf(seasons[0]) : DEFAULT_STYLE);
    } catch (e) {
      say(e instanceof Error ? e.message : 'Unable to load pricing.');
    } finally {
      loadingPrices = false;
    }
  };

  const newSeason = (type: PricingSeason['season_type']): PricingSeason => ({
    safari_style: activeStyle,
    season_type: type,
    season_name: type === 'STANDARD_SEASON' ? 'Standard Season' : type === 'PEAK_SEASON' ? 'Peak Season' : 'Custom Season',
    start_date: null,
    end_date: null,
    currency: selectedTour?.currency || 'USD',
    pricing_basis: 'PER_PERSON',
    status: 'ACTIVE',
    sort_order: seasons.length * 10,
    group_prices: standardGroupPrices()
  });

  const addSeason = (type: PricingSeason['season_type']) => {
    seasons = [...seasons, newSeason(type)];
  };

  /** Seed this style from another one's seasons — prices included, as a starting point to adjust. */
  const copyFrom = (source: SafariStyle) => {
    const copies = seasons
      .filter((season) => styleOf(season) === source)
      .map((season, i) => ({
        ...season,
        id: undefined,
        safari_style: activeStyle,
        sort_order: (seasons.length + i) * 10,
        group_prices: season.group_prices.map((price) => ({ ...price, id: undefined }))
      }));
    seasons = [...seasons, ...copies];
    say(`Copied ${styleTitle(source)} as a starting point — adjust the prices, then save.`, 'success');
  };

  const duplicate = (index: number) => {
    const source = seasons[index];
    const copy: PricingSeason = { ...source, id: undefined, season_name: `${source.season_name} Copy`, season_type: 'CUSTOM', group_prices: source.group_prices.map((price) => ({ ...price, id: undefined })) };
    seasons = [...seasons.slice(0, index + 1), copy, ...seasons.slice(index + 1)];
  };

  const removeSeason = (index: number) => {
    seasons = seasons.filter((_, i) => i !== index);
  };

  const addGroup = (index: number) => {
    const prices = seasons[index].group_prices;
    const last = prices.at(-1);
    const min = (last?.maximum_travelers ?? last?.minimum_travelers ?? 6) + 1;
    seasons[index].group_prices = [...prices, { minimum_travelers: min, maximum_travelers: null, room_count: Math.ceil(min / 2), price: null, price_status: 'ON_REQUEST', sort_order: prices.length * 10 }];
    seasons = [...seasons];
  };

  const removeGroup = (index: number, priceIndex: number) => {
    seasons[index].group_prices = seasons[index].group_prices.filter((_, i) => i !== priceIndex);
    seasons = [...seasons];
  };

  const statusChanged = (price: GroupPrice) => {
    if (price.price_status !== 'FIXED_PRICE') price.price = null;
    seasons = [...seasons];
  };

  /** First problem that would stop a save, with the tab it lives on. */
  const problem = (): { style: SafariStyle; message: string } | null => {
    for (const season of seasons) {
      const style = styleOf(season);
      if (season.season_name.trim().length < 2) return { style, message: `${styleTitle(style)}: every season needs a name.` };
      if (!season.group_prices.length) return { style, message: `${styleTitle(style)} · ${season.season_name}: add at least one group size.` };
      if (season.start_date && season.end_date && season.end_date < season.start_date) return { style, message: `${styleTitle(style)} · ${season.season_name}: the end date is before the start date.` };
      for (const price of season.group_prices) {
        if (price.maximum_travelers != null && price.maximum_travelers < price.minimum_travelers) return { style, message: `${styleTitle(style)} · ${season.season_name}: ${groupLabel(price)} has a maximum below its minimum.` };
        if (price.price_status === 'FIXED_PRICE' && (price.price == null || Number.isNaN(Number(price.price)))) return { style, message: `${styleTitle(style)} · ${season.season_name}: enter a price for ${groupLabel(price)}, or set it to On request.` };
      }
    }
    return null;
  };

  const save = async () => {
    if (!selectedTourId || saving) return;
    const issue = problem();
    if (issue) {
      activeStyle = issue.style;
      say(issue.message);
      return;
    }
    saving = true;
    try {
      // The API replaces the tour's whole price list, so every style is sent together.
      await api.pricingOptions.saveSeasons(selectedTourId, { tour_id: selectedTourId, seasons: seasons.map((season, i) => ({ ...season, safari_style: styleOf(season), sort_order: i * 10 })) });
      say('Pricing saved.', 'success');
      await loadSeasons();
      notice = 'Pricing saved.';
      noticeTone = 'success';
    } catch (e) {
      say(e instanceof Error ? e.message : 'Unable to save pricing.');
    } finally {
      saving = false;
    }
  };

  onMount(loadTours);
</script>

<div class="mx-auto grid w-full max-w-[1500px] gap-5 pb-24">
  <AdminPageHeader
    eyebrow="Tour Management"
    title="Pricing Options"
    description="Per-person prices by group size for each safari style — Budget, Midrange and Luxury — with optional seasonal rates."
  />

  {#if loading}
    <LoadingState message="Loading tours..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if !tours.length}
    <AdminEmptyState
      title="Add a tour first"
      message="Prices belong to a tour. Create a tour, then come back to set its Budget, Midrange and Luxury prices."
      actionLabel="Go to Tours"
      on:action={() => goto('/admin/tours')}
    />
  {:else}
    <section class="grid gap-3 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm sm:p-5 md:grid-cols-[minmax(0,420px)_1fr] md:items-end">
      <AdminSelect label="Tour" name="tour_id" bind:value={selectedTourId} options={tourOptions} on:change={loadSeasons} />
      <p class="text-xs leading-5 text-ink/55">Pick a tour, choose a safari style, then enter the price per person for each group size. Leave a size “On request” if you quote it case by case.</p>
    </section>

    {#if notice}
      <p class={`rounded-lg border px-4 py-3 text-sm font-semibold ${noticeTone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-forest/20 bg-forest/5 text-heading'}`} role={noticeTone === 'error' ? 'alert' : 'status'}>{notice}</p>
    {/if}

    {#if loadingPrices}
      <LoadingState message="Loading pricing..." />
    {:else if selectedTourId}
      <SafariStyleSelector value={activeStyle} onChange={(style) => (activeStyle = style)} note={styleNote} />

      {#if !styleSeasons.length}
        <section class="grid justify-items-center gap-3 rounded-xl border border-dashed border-ink/15 bg-surface p-6 text-center sm:p-8">
          <h2 class="text-lg font-semibold text-heading">No {styleTitle(activeStyle)} prices yet</h2>
          <p class="max-w-md text-sm text-ink/55">Start with the standard table — one price per person for 1 to 6 travellers — or copy another style and adjust it.</p>
          <div class="flex flex-wrap justify-center gap-2">
            <CmsButton variant="default" type="button" class="gap-2" onclick={() => addSeason('STANDARD_SEASON')}><Plus size={15} />Start the 1–6 traveller table</CmsButton>
            {#each otherStylesWithSeasons as source (source)}
              <CmsButton variant="outline" type="button" class="gap-2" onclick={() => copyFrom(source)}><Copy size={15} />Copy {styleTitle(source)}</CmsButton>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Iterate the real list so every bind marks `seasons` changed (preview, tab counts). -->
      {#each seasons as season, index}
        {#if styleOf(season) === activeStyle}
        <section class="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm">
          <header class="grid gap-3 border-b border-ink/10 bg-sand/35 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <CmsLabel class={labelCls}><span>Season name</span><CmsInput class={field} bind:value={season.season_name} /></CmsLabel>
            <CmsLabel class={labelCls}><span>Type</span>
              <CmsSelect.Root class="h-11" bind:value={season.season_type}>
                <CmsSelect.Option value="STANDARD_SEASON">Standard Season</CmsSelect.Option>
                <CmsSelect.Option value="PEAK_SEASON">Peak Season</CmsSelect.Option>
                <CmsSelect.Option value="CUSTOM">Custom</CmsSelect.Option>
              </CmsSelect.Root>
            </CmsLabel>
            <CmsLabel class={labelCls}><span>Starts <em class="font-normal not-italic text-ink/40">(optional)</em></span><CmsInput class={field} type="date" bind:value={season.start_date} /></CmsLabel>
            <CmsLabel class={labelCls}><span>Ends <em class="font-normal not-italic text-ink/40">(optional)</em></span><CmsInput class={field} type="date" bind:value={season.end_date} /></CmsLabel>
            <CmsLabel class={labelCls}><span>Currency</span><CmsInput class={field} maxlength={3} bind:value={season.currency} /></CmsLabel>
            <CmsLabel class={labelCls}><span>Pricing basis</span>
              <CmsSelect.Root class="h-11" bind:value={season.pricing_basis}>
                <CmsSelect.Option value="PER_PERSON">Per person</CmsSelect.Option>
                <CmsSelect.Option value="PER_GROUP">Per group</CmsSelect.Option>
              </CmsSelect.Root>
            </CmsLabel>
            <CmsLabel class={labelCls}><span>Status</span>
              <CmsSelect.Root class="h-11" bind:value={season.status}>
                <CmsSelect.Option value="ACTIVE">Active</CmsSelect.Option>
                <CmsSelect.Option value="INACTIVE">Inactive</CmsSelect.Option>
              </CmsSelect.Root>
            </CmsLabel>
            <div class="flex items-end justify-end gap-2">
              <CmsButton variant="ghost" type="button" class="h-11 gap-1.5 border border-ink/10 bg-surface px-3 text-xs font-semibold" onclick={() => duplicate(index)}><Copy size={14} />Duplicate</CmsButton>
              <CmsButton variant="ghost" type="button" class="h-11 border border-red-200 bg-surface px-3 text-red-700 hover:bg-red-50" aria-label={`Delete ${season.season_name}`} onclick={() => removeSeason(index)}><Trash2 size={15} /></CmsButton>
            </div>
          </header>

          <div class="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {#each season.group_prices as price, priceIndex}
              <div class="grid gap-3 rounded-xl border border-ink/10 bg-surface p-3">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm font-bold text-heading">{groupLabel(price)}</span>
                  <CmsButton variant="ghost" type="button" class="h-8 w-8 p-0 text-ink/45 hover:text-red-700" aria-label={`Remove ${groupLabel(price)}`} onclick={() => removeGroup(index, priceIndex)}><Trash2 size={14} /></CmsButton>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <CmsLabel class={labelCls}><span>Status</span>
                    <CmsSelect.Root class="h-11" bind:value={price.price_status} onchange={() => statusChanged(price)}>
                      <CmsSelect.Option value="FIXED_PRICE">Fixed price</CmsSelect.Option>
                      <CmsSelect.Option value="ON_REQUEST">On request</CmsSelect.Option>
                      <CmsSelect.Option value="NOT_AVAILABLE">Not available</CmsSelect.Option>
                    </CmsSelect.Root>
                  </CmsLabel>
                  <CmsLabel class={labelCls}><span>Price per {season.pricing_basis === 'PER_GROUP' ? 'group' : 'person'} ({season.currency || 'USD'})</span>
                    <CmsInput class={field} type="number" min="0" step="any" inputmode="decimal" placeholder={price.price_status === 'FIXED_PRICE' ? 'e.g. 1850' : '—'} disabled={price.price_status !== 'FIXED_PRICE'} bind:value={price.price} />
                  </CmsLabel>
                </div>
                <details class="text-xs text-ink/55">
                  <summary class="cursor-pointer select-none font-semibold">Group size &amp; rooms</summary>
                  <div class="mt-2 grid grid-cols-3 gap-2">
                    <CmsLabel class={labelCls}><span>From</span><CmsInput class={field} type="number" min="1" bind:value={price.minimum_travelers} /></CmsLabel>
                    <CmsLabel class={labelCls}><span>To</span><CmsInput class={field} type="number" min={price.minimum_travelers} placeholder="No max" bind:value={price.maximum_travelers} /></CmsLabel>
                    <CmsLabel class={labelCls}><span>Rooms</span><CmsInput class={field} type="number" min="0" bind:value={price.room_count} /></CmsLabel>
                  </div>
                </details>
              </div>
            {/each}
          </div>
          <div class="border-t border-ink/10 p-3">
            <CmsButton variant="ghost" type="button" class="gap-1.5 text-xs font-bold text-forest" onclick={() => addGroup(index)}><Plus size={14} />Add a group size</CmsButton>
          </div>
        </section>
        {/if}
      {/each}

      {#if styleSeasons.length}
        <div class="flex flex-wrap gap-2">
          <CmsButton variant="outline" type="button" class="gap-2" onclick={() => addSeason('PEAK_SEASON')}><Plus size={15} />Peak season</CmsButton>
          <CmsButton variant="outline" type="button" class="gap-2" onclick={() => addSeason('CUSTOM')}><Plus size={15} />Custom season</CmsButton>
        </div>

        <!-- Exactly what travellers see for this style (unsaved edits included). -->
        <section class="rounded-xl border border-ink/10 bg-sand/20 p-3 sm:p-5">
          <p class="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70"><Eye size={14} />Preview · {styleTitle(activeStyle)}</p>
          <SafariPriceByGroupSize {seasons} style={activeStyle} showSelector={false} />
        </section>
      {/if}

      <div class="sticky bottom-3 z-10 flex justify-end">
        <CmsButton variant="default" type="button" class="h-11 gap-2 px-6 shadow-lg" disabled={saving} onclick={save}><Save size={16} />{saving ? 'Saving…' : 'Save pricing'}</CmsButton>
      </div>
    {/if}
  {/if}
</div>
