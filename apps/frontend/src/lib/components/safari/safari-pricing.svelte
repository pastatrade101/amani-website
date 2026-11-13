<script lang="ts">
	import { convertedPrice } from '$lib/currency';
	import { ArrowRight, ArrowUpRight, BedDouble, CalendarDays, Check, Sparkles, Tent, TrendingDown } from '@lucide/svelte';
	import { SAFARI_STYLES, formatPrice, seasonForStyle, styleOf, stylesWithPrices, type PricingSeason, type SafariStyle } from '$lib/safari-pricing';

	// "Safari packages & pricing": one row per safari style with prices, each
	// row its per-person price by group size. Choosing a style updates the
	// summary and the enquiry. Tours with several seasons get a season switch.
	// `from` is the tour's own from-price, shown when it has no seasonal price table.
	let { seasons, selected, onSelect, quoteHref, onEnquire, from = null }: { seasons: PricingSeason[]; selected: SafariStyle; onSelect: (style: SafariStyle) => void; quoteHref: string; onEnquire: () => void; from?: { amount: number; currency: string } | null } = $props();

	const ICONS = { budget: Tent, midrange: BedDouble, luxury: Sparkles } as const;
	const styleInfo = (id: SafariStyle) => SAFARI_STYLES.find((style) => style.id === id)!;
	const styleName = (id: SafariStyle) => styleInfo(id).title.replace(/\s+Safari$/, '');
	const people = (min: number, max?: number | null) => (max == null ? `${min}+ persons` : max === min ? `${min} ${min === 1 ? 'person' : 'persons'}` : `${min}–${max} persons`);
	const shortDate = (value?: string | null) => {
		if (!value) return '';
		const date = new Date(`${value}T00:00:00Z`);
		return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
	};

	let styles = $derived(stylesWithPrices(seasons));
	let usable = $derived(seasons.filter((season) => season.status === 'ACTIVE' && season.pricing_basis === 'PER_PERSON' && styles.includes(styleOf(season))).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
	let seasonNames = $derived([...new Set(usable.map((season) => season.season_name))]);
	let pickedSeason = $state('');
	// Today's season (or the Standard Season) until the visitor picks another.
	let seasonName = $derived(seasonNames.includes(pickedSeason) ? pickedSeason : (seasonForStyle(seasons, styles.includes(selected) ? selected : styles[0])?.season_name ?? seasonNames[0] ?? ''));
	let seasonDates = $derived.by(() => {
		const season = usable.find((item) => item.season_name === seasonName);
		const [start, end] = [shortDate(season?.start_date), shortDate(season?.end_date)];
		return start && end ? `${start} – ${end}` : '';
	});

	function rowFor(style: SafariStyle) {
		const season = seasonNames.length > 1 ? usable.find((item) => styleOf(item) === style && item.season_name === seasonName) : seasonForStyle(seasons, style);
		if (!season) return null;
		const tiers = [...season.group_prices]
			.filter((price) => price.price_status !== 'NOT_AVAILABLE')
			.sort((a, b) => a.minimum_travelers - b.minimum_travelers)
			.map((price) => ({ key: `${price.minimum_travelers}-${price.maximum_travelers ?? 'plus'}`, label: people(price.minimum_travelers, price.maximum_travelers), price: price.price_status === 'FIXED_PRICE' && price.price != null ? Number(price.price) : null }));
		if (!tiers.length) return null;
		// The lowest per-person price, the tier that gets it and how much less it
		// is than the dearest tier — all read from the CMS prices, nothing assumed.
		const priced = tiers.filter((tier) => tier.price != null && tier.price > 0);
		const low = priced.length ? Math.min(...priced.map((tier) => tier.price!)) : null;
		const high = priced.length ? Math.max(...priced.map((tier) => tier.price!)) : null;
		const best = priced.length > 1 && low !== high ? [...priced].reverse().find((tier) => tier.price === low)!.key : null;
		const bestTier = tiers.find((tier) => tier.key === best);
		const saving = low != null && high ? Math.round(((high - low) / high) * 100) : 0;
		return { style, currency: season.currency || 'USD', tiers, low, best, saving: saving >= 5 && bestTier ? { pct: saving, group: bestTier.label.replace(/\s*persons?$/, '') } : null };
	}
	// Dots that count the travellers in a tier: six at most, a "+" past that.
	const headcount = (key: string) => {
		const [min, max] = key.split('-');
		const n = max === 'plus' ? Number(min) : Number(max);
		return { dots: Math.min(Number.isFinite(n) ? n : 1, 6), more: max === 'plus' || n > 6 };
	};
	let rows = $derived(styles.map(rowFor).filter((row): row is NonNullable<ReturnType<typeof rowFor>> => row !== null));
	let active = $derived(rows.find((row) => row.style === selected) ?? rows[0]);
	let lowest = $derived(active?.low ?? null);
	let currency = $derived(rows[0]?.currency ?? usable[0]?.currency ?? 'USD');
	// Dollar prices show in the visitor's chosen currency, so the badge follows it.
	let shownCurrency = $derived(convertedPrice(1, currency)?.code ?? currency);
	let symbol = $derived.by(() => {
		try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: shownCurrency }).formatToParts(0).find((part) => part.type === 'currency')?.value ?? ''; } catch { return ''; }
	});
	let choosing = $derived(rows.length > 1);
</script>

<section id="prices" class="sp-section pricing" aria-labelledby="pricing-title">
	<div class="sp-head pricing-top">
		<div>
			<h2 id="pricing-title" class="sp-h2">Safari packages &amp; pricing</h2>
			<p class="sp-sub">{rows.length > 1 ? `One journey. ${rows.length === 2 ? 'Two' : 'Three'} ways to experience it.` : rows.length ? 'Per-person prices by the size of your group.' : 'Share your dates, group size and preferred comfort level for a personal quotation.'}</p>
		</div>
		{#if rows.length}<span class="currency">{symbol && symbol !== shownCurrency ? `${symbol} ` : ''}{shownCurrency}</span>{/if}
	</div>

	{#if rows.length}
		{#if seasonNames.length > 1}
			<div class="seasons">
				<div class="season-switch" role="group" aria-label="Travel season">
					{#each seasonNames as name}<button type="button" aria-pressed={name === seasonName} onclick={() => (pickedSeason = name)}>{name}</button>{/each}
				</div>
				{#if seasonDates}<span class="season-dates"><CalendarDays aria-hidden="true" />{seasonDates}</span>{/if}
			</div>
		{/if}
		<div class="pricing-grid">
			{#each rows as row (row.style)}
				{@const Icon = ICONS[row.style]}
				{@const on = choosing && row.style === active?.style}
				<article class="package" class:is-selected={on} aria-labelledby={`style-${row.style}`}>
					<header class="package-top">
						<div class="package-id">
							<span class="package-icon" aria-hidden="true"><Icon /></span>
							<div>
								<h3 id={`style-${row.style}`}>{styleName(row.style)}</h3>
								<p>{styleInfo(row.style).subtitle}{seasonNames.length > 1 ? ` · ${seasonName}` : ''}</p>
							</div>
						</div>
						<div class="package-from">
							{#if row.low != null}
								<p class="from-line"><span>From</span> <strong>{formatPrice(row.low, row.currency)}</strong> <span>per person</span></p>
							{:else}
								<p class="from-line"><strong>On request</strong></p>
							{/if}
							{#if row.saving}<p class="saving"><TrendingDown aria-hidden="true" />Up to {row.saving.pct}% less per person in a group of {row.saving.group}</p>{/if}
						</div>
						{#if choosing}
							<button type="button" class="select-package" aria-pressed={on} onclick={() => onSelect(row.style)}>{#if on}<Check aria-hidden="true" />Selected{:else}Choose {styleName(row.style)}{/if}</button>
						{/if}
					</header>
					<ul class="ladder" style={`--cols:${row.tiers.length}`} aria-label={`${styleName(row.style)} prices per person by group size`}>
						{#each row.tiers as tier (tier.key)}
							{@const count = headcount(tier.key)}
							<li class="tier" class:best={tier.key === row.best}>
								<span class="who">
									<span class="dots" aria-hidden="true">{#each { length: count.dots } as _, d (d)}<i></i>{/each}{#if count.more}<b>+</b>{/if}</span>
									{tier.label}
								</span>
								<strong class="amount">{tier.price != null ? formatPrice(tier.price, row.currency) : 'On request'}</strong>
								{#if tier.price != null}<span class="pp">per person</span>{/if}
								{#if tier.key === row.best}<span class="best-tag">Best rate</span>{/if}
							</li>
						{/each}
					</ul>
				</article>
			{/each}
		</div>
		{#if active}
			<div class="selection" aria-live="polite">
				{#if choosing}
					<p><Check aria-hidden="true" /><span><strong>{styleName(active.style)}</strong>{lowest != null ? ` from ${formatPrice(lowest, active.currency)} per person` : ', price on request'}{seasonNames.length > 1 ? ` · ${seasonName}` : ''}</span></p>
				{:else}
					<p><CalendarDays aria-hidden="true" class="ask" /><span><strong>Want a price for your exact dates?</strong> Tell us when you travel and who’s coming.</span></p>
				{/if}
				<a class="sp-btn sp-btn-sun" href={quoteHref} onclick={onEnquire}>Enquire about this safari <ArrowUpRight aria-hidden="true" /></a>
			</div>
		{/if}
		<p class="pricing-note">Prices are quoted per person in {currency} and may vary with your travel dates, accommodation preferences and availability. Contact us for a quotation tailored to your group.</p>
	{:else}
		{#if from}<p class="from-price">From <strong>{formatPrice(from.amount, from.currency)}</strong> per person</p>{/if}
		<a class="sp-btn sp-btn-sun" href={quoteHref} onclick={onEnquire}>Request a quote <ArrowRight aria-hidden="true" /></a>
	{/if}
</section>

<style>
	.pricing-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
	.currency { padding: 10px 16px; border: 1px solid var(--sp-line); border-radius: var(--radius-control); font-size: var(--text-sm); font-weight: 600; white-space: nowrap; }
	/* Season switch: one track, the chosen season lifts out of it. */
	.seasons { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 20px; margin: -6px 0 26px; }
	.season-switch { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--sp-line); border-radius: 10px; background: var(--sp-cream); }
	.season-switch button { min-height: 40px; padding: 8px 20px; border: 0; border-radius: 7px; background: transparent; color: var(--sp-muted); font: 600 14px var(--sp-sans); cursor: pointer; transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease; }
	.season-switch button:hover { color: var(--sp-ink); }
	.season-switch button[aria-pressed='true'] { background: #fff; color: var(--sp-ink); box-shadow: 0 1px 2px rgb(43 39 34 / 0.08), 0 4px 12px -4px rgb(43 39 34 / 0.12); }
	.season-dates { display: inline-flex; align-items: center; gap: 8px; font-size: var(--text-sm); color: var(--sp-muted); }
	.season-dates :global(svg) { width: 16px; height: 16px; color: #98723c; }
	.from-price { margin: -8px 0 22px; font-size: var(--text-base); color: var(--sp-muted); }
	.from-price strong { font-size: var(--text-2xl); font-weight: 650; color: var(--sp-ink); font-variant-numeric: tabular-nums; }

	.pricing-grid { display: grid; gap: 20px; }
	.package { overflow: hidden; border: 1px solid var(--sp-line); border-radius: var(--radius-surface); background: #fff; box-shadow: 0 1px 2px rgb(43 39 34 / 0.03), 0 18px 40px -28px rgb(43 39 34 / 0.18); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
	.package.is-selected { border-color: #d9bd3a; box-shadow: 0 0 0 1px #d9bd3a, 0 18px 40px -26px rgb(120 96 0 / 0.35); }

	/* The style and its starting price share one line; the group sizes sit beneath. */
	.package-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px 32px; padding: 24px 28px; border-bottom: 1px solid var(--sp-line-soft); }
	.package-id { display: flex; align-items: center; gap: 16px; min-width: 0; }
	.package-icon { display: grid; flex: none; place-items: center; width: 52px; height: 52px; border-radius: 14px; background: #faf3d6; color: #8a6a2f; }
	.package.is-selected .package-icon { background: var(--sp-sun); color: #2b2722; }
	.package-icon :global(svg) { width: 24px; height: 24px; }
	h3 { margin: 0; font-size: var(--text-xl); font-weight: 650; line-height: 1.2; letter-spacing: -0.02em; color: var(--sp-ink); }
	.package-id p { margin: 4px 0 0; font-size: var(--text-sm); line-height: 1.5; color: var(--sp-muted); }
	.package-from { margin-left: auto; text-align: right; }
	.from-line { margin: 0; font-size: var(--text-sm); color: var(--sp-muted); }
	.from-line strong { margin-inline: 2px; font-size: var(--text-2xl); font-weight: 650; letter-spacing: -0.02em; color: var(--sp-ink); font-variant-numeric: tabular-nums; }
	.saving { display: inline-flex; align-items: center; gap: 6px; margin: 6px 0 0; padding: 4px 10px; border-radius: 6px; background: #edf6ef; font-size: var(--text-xs); font-weight: 600; color: #146c3e; }
	.saving :global(svg) { width: 14px; height: 14px; }

	/* Group sizes: one tile each, the price falls as the dots grow. */
	.ladder { display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); gap: 10px; margin: 0; padding: 22px 28px 28px; list-style: none; }
	.tier { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; padding: 16px 16px 15px; border: 1px solid transparent; border-radius: 12px; background: #faf8f3; transition: background-color 0.2s ease, border-color 0.2s ease; }
	.tier:hover { border-color: var(--sp-line); background: #fff; }
	.tier.best { border-color: #ead27a; background: #fffaeb; }
	.who { display: flex; flex-direction: column; gap: 8px; margin-bottom: 6px; font-size: var(--text-sm); font-weight: 500; color: var(--sp-muted); }
	.dots { display: flex; align-items: center; gap: 3px; height: 8px; }
	.dots i { width: 7px; height: 7px; border-radius: 50%; background: #c9b58a; }
	.tier.best .dots i { background: #c79a00; }
	.dots b { margin-left: 1px; font-size: var(--text-xs); font-weight: 700; line-height: 1; color: #a8946a; }
	.amount { font-size: var(--text-xl); font-weight: 650; line-height: 1.15; letter-spacing: -0.02em; color: var(--sp-ink); font-variant-numeric: tabular-nums; }
	.pp { font-size: var(--text-xs); color: var(--sp-muted); }
	.best-tag { position: absolute; top: 12px; right: 12px; padding: 3px 8px; border-radius: 5px; background: var(--sp-sun); font-size: var(--text-sm); font-weight: 700; color: #2b2722; }

	.select-package { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 46px; padding: 11px 20px; border: 1px solid var(--sp-line); border-radius: var(--radius-control); background: #fff; color: var(--sp-ink); font: 700 14px var(--sp-sans); cursor: pointer; transition: background-color 0.2s ease, border-color 0.2s ease; }
	.select-package:hover { border-color: #cfc6b2; }
	.select-package :global(svg) { width: 16px; height: 16px; }
	.select-package[aria-pressed='true'] { border-color: var(--sp-sun); background: var(--sp-sun); color: #2b2722; }

	.selection { display: flex; align-items: center; justify-content: space-between; gap: 16px 24px; margin-top: 20px; padding: 14px 14px 14px 22px; border: 1px solid var(--sp-line); border-radius: var(--radius-surface); background: var(--sp-cream); font-size: var(--text-base); color: var(--sp-ink); }
	.selection p { display: flex; align-items: center; gap: 12px; margin: 0; }
	.selection p :global(svg) { flex: none; width: 30px; height: 30px; padding: 6px; border-radius: 8px; background: #fff; color: #146c3e; }
	.selection p :global(svg.ask) { color: #8a6a2f; }
	.selection strong { font-weight: 650; }
	.selection .sp-btn { flex: none; }
	.pricing-note { max-width: 860px; margin: 22px 0 0; font-size: var(--text-sm); line-height: 1.8; color: var(--sp-muted); }
	@media (max-width: 1080px) {
		.ladder { grid-template-columns: repeat(min(var(--cols, 4), 3), minmax(0, 1fr)); }
	}
	@media (max-width: 767px) {
		.pricing-top { align-items: flex-start; }
		.selection { flex-direction: column; align-items: stretch; padding: 16px; }
		.selection .sp-btn { width: 100%; }
	}
	@media (max-width: 600px) {
		.package-top { padding: 20px 18px; }
		.package-icon { width: 44px; height: 44px; border-radius: 12px; }
		.package-icon :global(svg) { width: 20px; height: 20px; }
		h3 { font-size: var(--text-lg); }
		.package-from { flex-basis: 100%; margin-left: 0; text-align: left; }
		.select-package { flex-basis: 100%; }
		.ladder { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 16px 18px 20px; }
		.tier { padding: 14px 14px 13px; }
		.amount { font-size: var(--text-xl); }
		/* Narrow tiles: the tag drops to the bottom corner, clear of the dots. */
		.best-tag { top: auto; right: 10px; bottom: 12px; }
	}
</style>
