<script lang="ts">
  import { CircleDollarSign, Eye, Pencil, TriangleAlert } from '@lucide/svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import SafariStyleSelector from '$lib/components/pricing/safari-style-selector.svelte';
  import SafariPriceByGroupSize from '$lib/components/pricing/safari-price-by-group-size.svelte';
  import { DEFAULT_STYLE, formatPrice, styleOf, type PricingSeason, type SafariStyle } from '$lib/safari-pricing';
  import { STYLE_KEYS, STYLE_LABEL, lowestFixedPrice, stylePriceNote, text, type TourEditorForm } from './model';

  /**
   * Prices by group size live on the Pricing Options page, which saves the
   * whole price table in one go. Here the table is shown as travellers see it,
   * with a way straight into it, next to the single "from" price cards use.
   */
  export let form: TourEditorForm;
  /** Empty until the tour has been saved once. */
  export let tourId = '';
  /** The tour's saved price seasons. */
  export let seasons: PricingSeason[] = [];
  export let dirty = false;
  export let attemptedSave = false;

  let activeStyle: SafariStyle = DEFAULT_STYLE;
  let styleChosen = false;

  $: stylesWithSeasons = STYLE_KEYS.filter((style) => seasons.some((season) => styleOf(season) === style));
  // Open on Midrange when it has prices, else the first style that does.
  $: if (!styleChosen) activeStyle = stylesWithSeasons.includes(DEFAULT_STYLE) ? DEFAULT_STYLE : (stylesWithSeasons[0] ?? DEFAULT_STYLE);
  $: lowest = lowestFixedPrice(seasons);
  $: price = text(form.price_from);
  $: priceError = price && (!Number.isFinite(Number(price)) || Number(price) < 0) ? 'Enter the price as a number, e.g. 1850, or leave it blank.' : '';
  $: currencyError = !/^[A-Za-z]{3}$/.test(text(form.currency)) ? 'Currency is a 3-letter code, e.g. USD.' : '';
  $: matchesLowest = Boolean(lowest && Number(price) === lowest.amount && text(form.currency).toUpperCase() === lowest.currency.toUpperCase());

  const chooseStyle = (style: SafariStyle) => {
    styleChosen = true;
    activeStyle = style;
  };

  const useLowest = () => {
    if (!lowest) return;
    form.price_from = String(lowest.amount);
    form.currency = lowest.currency;
  };
</script>

<div class="grid gap-5 cms-form-panel">
  <section class="cms-form-section grid gap-4">
    <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Price by group size</p>
    {#if !tourId}
      <div class="cms-builder-intro">
        <span class="cms-builder-icon"><CircleDollarSign size={30} strokeWidth={1.3} /></span>
        <h3>Prices come after the first save</h3>
        <p>Each safari style — Budget, Midrange and Luxury — gets its own per-person price for every group size. Save this tour once, then set them up from here.</p>
      </div>
    {:else}
      <p class="text-xs leading-5 text-ink/55">
        Per-person prices for 1 to 6 travellers in each safari style, exactly as the tour page shows them. Prices are edited on the Pricing Options page.
      </p>
      <SafariStyleSelector value={activeStyle} onChange={chooseStyle} note={(style) => stylePriceNote(seasons, style)} />
      <div class="rounded-xl border border-ink/10 bg-sand/20 p-3 sm:p-5">
        <p class="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70"><Eye size={14} />Preview · {STYLE_LABEL[activeStyle]}</p>
        <SafariPriceByGroupSize {seasons} style={activeStyle} showSelector={false} />
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <a
          class="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          href={`/admin/pricing-options?tour=${tourId}`}
        ><Pencil size={15} />Edit prices</a>
        {#if dirty}
          <span class="inline-flex items-center gap-1.5 text-xs text-amber-800"><TriangleAlert size={13} />This tour has unsaved changes — save first, or you will be asked before leaving.</span>
        {/if}
      </div>
    {/if}
  </section>

  <section class="cms-form-section grid gap-4">
    <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Starting price</p>
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="grid gap-1.5">
        <AdminFormInput label="Starting price per person" name="price_from" type="number" min={0} step="any" bind:value={form.price_from} placeholder="e.g. 1850" />
        {#if priceError}<span class="text-[11px] font-semibold text-clay">{priceError}</span>{/if}
      </div>
      <div class="grid gap-1.5">
        <AdminFormInput label="Currency" name="currency" bind:value={form.currency} placeholder="USD" />
        {#if attemptedSave && currencyError}<span class="text-[11px] font-semibold text-clay">{currencyError}</span>{/if}
      </div>
    </div>
    {#if lowest && !matchesLowest}
      <button type="button" class="w-fit rounded-md border border-forest/25 bg-forest/5 px-3 py-2 text-xs font-bold text-forest transition hover:bg-forest hover:text-white" on:click={useLowest}>
        Use lowest price from the table ({formatPrice(lowest.amount, lowest.currency)})
      </button>
    {/if}
    <p class="text-xs text-ink/45">The “from” price used on tour cards, per person.</p>
  </section>
</div>
