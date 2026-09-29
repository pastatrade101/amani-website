<script lang="ts">
  import { t } from '$lib/admin/i18n/ui';
  /**
   * What a tour costs — one renderer, wherever a price is shown.
   *
   * A tour can be priced two ways in the CMS, and the pages have to agree on
   * which one wins: a seasonal matrix (season × party size) if the tour has
   * active pricing seasons, otherwise the published rate rows. Only if it has
   * neither does the "from" price stand alone.
   *
   * This was inline in the tour page, and the safari-package routes panel
   * printed one "From $X per person" line beside a few bullets — the same tour,
   * quoted two different ways depending on which page a traveller landed on.
   *
   * Tables only. The heading, the intro and whatever CTA follows belong to the
   * page, because a tour page and a landing page introduce the same rates with
   * different words.
   */
  import { currency, formatUsd } from '$lib/admin/currency';
  import type { Tour, TourPricingSeason } from '$lib/admin/types';

  export let tour: Tour | null = null;
  /** The line under the tables. Off where the page says it itself. */
  export let showFootnote = true;
  /** Rate cards also fit narrow desktop sidebars without hiding any values. */
  export let compact = false;

  /** Dictionary keys, not words: what a rate type is called is the reader's language. */
  const PRICE_TYPE_KEYS: Record<string, string> = {
    per_person: 'ui.price_per_person',
    per_group: 'ui.price_per_group',
    per_child: 'ui.price_per_child',
    single_supplement: 'ui.single_supplement',
    upgrade: 'ui.upgrade',
    discount: 'ui.discount'
  };
  $: priceType = (type: string) => (PRICE_TYPE_KEYS[type] ? $t(PRICE_TYPE_KEYS[type]) : '');

  const normaliseLabel = (value: string | null | undefined): string =>
    String(value ?? '')
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());

  /**
   * Published rates are quoted in the currency they were published in — the
   * site-wide currency switcher converts the indicative "from" price, but a
   * contracted rate is not ours to restate in another currency.
   */
  const formatPublishedRate = (amount: number, currencyCode: string): string => {
    const code = String(currencyCode || 'USD').trim().toUpperCase();
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
        maximumFractionDigits: Number.isInteger(amount) ? 0 : 2
      }).format(amount);
    } catch {
      return `${code} ${Number(amount).toLocaleString()}`;
    }
  };

  const groupKey = (price: { minimum_travelers: number; maximum_travelers?: number | null }) =>
    `${price.minimum_travelers}:${price.maximum_travelers ?? ''}`;

  // Reactive so the column and cell labels follow the dictionary.
  $: groupLabel = (price: { minimum_travelers: number; maximum_travelers?: number | null }) =>
    price.minimum_travelers === 1 && price.maximum_travelers === 1
      ? $t('ui.solo')
      : price.maximum_travelers === null || price.maximum_travelers === undefined
        ? $t('ui.n_plus_people').replace('{n}', String(price.minimum_travelers))
        : $t('ui.n_people').replace('{n}', String(price.minimum_travelers));

  $: groupRate = (season: TourPricingSeason, key: string) => {
    const price = season.group_prices.find((item) => groupKey(item) === key);
    if (!price || price.price_status === 'NOT_AVAILABLE') return { label: $t('ui.not_available'), amount: '' };
    if (price.price_status === 'ON_REQUEST' || price.price == null) return { label: $t('ui.on_request'), amount: '' };
    return { label: $t('label.from'), amount: formatPublishedRate(Number(price.price), season.currency) };
  };

  /**
   * The indicative "from" price follows the site-wide currency switcher, the
   * way it does in the hero and the sticky bar. Published rates above do not:
   * a contracted rate is quoted in the currency it was contracted in.
   */
  $: fromAmount = tour?.price_from ? formatUsd(tour.price_from, $currency) : '';
  $: fromLabel = fromAmount ? $t('ui.from_amount_per_person').replace('{amount}', fromAmount) : $t('ui.on_request');

  $: publishedOptions = [...(tour?.tour_price_options ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  $: rows = publishedOptions.length
    ? publishedOptions.map((option) => ({
        label: option.title || option.label || priceType(option.price_type) || $t('ui.rate'),
        value: formatPublishedRate(option.price, option.currency || tour?.currency || 'USD'),
        note: [priceType(option.price_type) || normaliseLabel(option.price_type), option.description]
          .filter(Boolean)
          .join(' - ')
      }))
    : [
        {
          label: $t('ui.starting_price'),
          value: fromLabel,
          note: tour?.price_from ? $t('ui.final_pricing_depends_on_dates') : $t('ui.your_specialist_will_quote_this')
        }
      ];

  $: seasons = [...(tour?.tour_pricing_seasons ?? [])]
    .filter((season) => season.status === 'ACTIVE')
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((season) => ({
      ...season,
      group_prices: [...(season.group_prices ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    }));

  /** One column per party size across every season, smallest party first. */
  $: groupColumns = [
    ...new Map(seasons.flatMap((season) => season.group_prices).map((price) => [groupKey(price), price])).values()
  ].sort((a, b) => a.minimum_travelers - b.minimum_travelers);
</script>

{#if seasons.length}
  {#if compact}
    <div class="compact-seasons">
      {#each seasons as season, index}
        <details class="compact-season" open={index === 0}>
          <summary>{season.season_name}</summary>
          <dl>
            {#each groupColumns as group}
              {@const rate = groupRate(season, groupKey(group))}
              <div><dt>{groupLabel(group)}</dt><dd>{rate.label}{#if rate.amount} <strong>{rate.amount}</strong>{/if}</dd></div>
            {/each}
          </dl>
        </details>
      {/each}
    </div>
  {:else}
  <div class="mt-6 overflow-x-auto rounded-[10px] border border-ink/10 bg-surface shadow-sm">
    <table class="w-full min-w-[820px] border-collapse text-[14px]">
      <thead>
        <tr class="bg-[#34382d] text-left text-white">
          <th class="sticky left-0 z-10 min-w-40 bg-[#34382d] px-5 py-5 text-[15px] font-bold">{$t('ui.season')}</th>
          {#each groupColumns as group}
            <th class="min-w-28 whitespace-nowrap px-4 py-5 text-left text-[15px] font-bold">{groupLabel(group)}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each seasons as season, index}
          <tr class={index % 2 === 0 ? 'bg-surface' : 'bg-canvas'}>
            <th class={`sticky left-0 z-10 border-t border-ink/8 px-5 py-6 text-left ${index % 2 === 0 ? 'bg-surface' : 'bg-canvas'}`}>
              <span class="block max-w-32 text-[16px] font-extrabold leading-6 text-heading">{season.season_name}</span>
            </th>
            {#each groupColumns as group}
              {@const rate = groupRate(season, groupKey(group))}
              <td class="border-t border-ink/8 px-4 py-6 text-left text-[15px] leading-6 text-ink/65">
                <span class="block">{rate.label}</span>
                {#if rate.amount}<span class="block font-semibold text-ink/70">{rate.amount}</span>{/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {/if}
  {#if showFootnote}
    <p class="mt-4 text-[13px] leading-6 text-ink/55">
      {$t('ui.prices_are_basis_in_currency')
        .replace('{basis}', $t(seasons[0].pricing_basis === 'PER_GROUP' ? 'ui.basis_per_group' : 'ui.basis_per_person'))
        .replace('{currency}', seasons[0].currency)}
      {#if !compact}<span class="md:hidden">{$t('ui.swipe_horizontally_to_compare_party')}</span>{/if}
    </p>
  {/if}
{:else}
  <!-- One card per rate on a phone: a three-column table at 375px is a
       horizontal scroll for three words. -->
  <div class={`tour-rates-mobile mt-5 grid gap-2.5 ${compact ? '' : 'md:hidden'}`}>
    {#each rows as row}
      <article class="rounded-[8px] border border-ink/10 bg-surface p-4">
        <div class="flex min-w-0 items-start justify-between gap-4">
          <h3 class="min-w-0 text-[13px] font-semibold leading-snug text-heading">{row.label}</h3>
          <p class="max-w-[58%] break-words text-right text-[14px] font-extrabold leading-snug text-forest">{row.value}</p>
        </div>
        {#if row.note}
          <p class="mt-2 border-t border-ink/8 pt-2 text-[11.5px] leading-5 text-ink/60">{row.note}</p>
        {/if}
      </article>
    {/each}
  </div>

  {#if !compact}
  <div class="tour-rates-table mt-6 hidden overflow-hidden rounded-t-[10px] border border-ink/10 md:block">
    <table class="w-full border-collapse text-[14px]">
      <thead>
        <tr class="bg-deep-green text-left text-white">
          <th class="px-4 py-3 font-semibold">{$t('ui.item')}</th>
          <th class="px-4 py-3 font-semibold">{$t('ui.detail')}</th>
          <th class="hidden px-4 py-3 font-semibold md:table-cell">{$t('ui.note')}</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row, index}
          <tr class={index % 2 === 0 ? 'bg-surface' : 'bg-canvas'}>
            <td class="border-t border-ink/5 px-4 py-3 align-top font-semibold text-heading">{row.label}</td>
            <td class="border-t border-ink/5 px-4 py-3 align-top text-ink/75">{row.value}</td>
            <td class="hidden border-t border-ink/5 px-4 py-3 align-top text-ink/60 md:table-cell">{row.note}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {/if}
{/if}

<style>
  .compact-seasons { display:grid; gap:10px; margin-top:20px; }
  .compact-season { overflow:hidden; border:1px solid rgb(var(--c-ink)/.1); border-radius:8px; background:rgb(var(--c-surface)); }
  .compact-season summary { padding:13px 15px; cursor:pointer; background:rgb(var(--c-deep-green)); color:rgb(var(--c-surface)); font-size:12px; font-weight:600; line-height:1.5; }
  .compact-season dl { padding:4px 15px; }
  .compact-season dl > div { display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; padding:10px 0; font-size:12px; line-height:1.5; }
  .compact-season dl > div + div { border-top:1px solid rgb(var(--c-ink)/.08); }
  .compact-season dt { font-weight:600; color:rgb(var(--c-heading)); }
  .compact-season dd { display:flex; flex-wrap:wrap; gap:4px; color:rgb(var(--c-ink)/.65); }
  .compact-season dd strong { color:rgb(var(--c-forest)); font-size:14px; }
  .compact-season summary:focus-visible { outline:2px solid rgb(var(--c-goldfinch-gold)); outline-offset:-3px; }
</style>
