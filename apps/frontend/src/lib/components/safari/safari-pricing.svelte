<script lang="ts">
	import { ArrowRight, ArrowUpRight, BedDouble, Check, Sparkles, Tent } from '@lucide/svelte';
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
		return tiers.length ? { style, currency: season.currency || 'USD', tiers } : null;
	}
	let rows = $derived(styles.map(rowFor).filter((row): row is NonNullable<ReturnType<typeof rowFor>> => row !== null));
	let active = $derived(rows.find((row) => row.style === selected) ?? rows[0]);
	let lowest = $derived.by(() => {
		const prices = (active?.tiers ?? []).map((tier) => tier.price).filter((price): price is number => price != null && price > 0);
		return prices.length ? Math.min(...prices) : null;
	});
	let currency = $derived(rows[0]?.currency ?? usable[0]?.currency ?? 'USD');
	let symbol = $derived.by(() => {
		try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).formatToParts(0).find((part) => part.type === 'currency')?.value ?? ''; } catch { return ''; }
	});
	let choosing = $derived(rows.length > 1);
</script>

<section id="prices" class="sp-section pricing" aria-labelledby="pricing-title">
	<div class="sp-head pricing-top">
		<div>
			<p class="sp-eyebrow">Choose your travel style</p>
			<h2 id="pricing-title" class="sp-h2">Safari packages &amp; pricing</h2>
			<p class="sp-sub">{rows.length > 1 ? `One journey. ${rows.length === 2 ? 'Two' : 'Three'} ways to experience it.` : rows.length ? 'Per-person prices by the size of your group.' : 'Share your dates, group size and preferred comfort level for a personal quotation.'}</p>
		</div>
		{#if rows.length}<span class="currency">{symbol && symbol !== currency ? `${symbol} ` : ''}{currency}</span>{/if}
	</div>

	{#if rows.length}
		{#if seasonNames.length > 1}
			<div class="seasons" role="group" aria-label="Travel season">
				{#each seasonNames as name}<button type="button" aria-pressed={name === seasonName} onclick={() => (pickedSeason = name)}>{name}</button>{/each}
				{#if seasonDates}<span class="season-dates">{seasonDates}</span>{/if}
			</div>
		{/if}
		<div class="pricing-grid">
			{#each rows as row (row.style)}
				{@const Icon = ICONS[row.style]}
				{@const on = choosing && row.style === active?.style}
				<div class="package" class:is-selected={on} class:solo={!choosing}>
					<div class="package-head"><Icon aria-hidden="true" /><h3>{styleName(row.style)}</h3><p>{styleInfo(row.style).subtitle}</p></div>
					<div class="horizontal-table">
						<table style={`--cols:${row.tiers.length}`}>
							<caption class="sr-only">{styleName(row.style)} prices per person by group size{seasonNames.length > 1 ? `, ${seasonName}` : ''}</caption>
							<thead><tr>{#each row.tiers as tier (tier.key)}<th scope="col">{tier.label}</th>{/each}</tr></thead>
							<tbody><tr>{#each row.tiers as tier (tier.key)}<td>{tier.price != null ? formatPrice(tier.price, row.currency) : 'On request'}</td>{/each}</tr></tbody>
						</table>
					</div>
					{#if choosing}
						<button type="button" class="select-package" aria-pressed={on} onclick={() => onSelect(row.style)}>{#if on}{styleName(row.style)} selected <Check aria-hidden="true" />{:else}Choose {styleName(row.style)} <ArrowRight aria-hidden="true" />{/if}</button>
					{/if}
				</div>
			{/each}
		</div>
		{#if active}
			<div class="selection" aria-live="polite">
				<span><strong>{styleName(active.style)}</strong> · {lowest != null ? `from ${formatPrice(lowest, active.currency)} per person` : 'price on request'}{seasonNames.length > 1 ? ` · ${seasonName}` : ''}</span>
				<a href={quoteHref} onclick={onEnquire}>Enquire about this safari <ArrowUpRight aria-hidden="true" /></a>
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
	.currency { padding: 10px 16px; border: 1px solid var(--sp-line); border-radius: 999px; font-size: 13px; font-weight: 600; white-space: nowrap; }
	.seasons { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: -8px 0 26px; }
	.seasons button { min-height: 44px; padding: 10px 20px; border: 1px solid var(--sp-line); border-radius: 999px; background: #fff; color: var(--sp-ink); font: 600 14px var(--sp-sans); cursor: pointer; }
	.seasons button[aria-pressed='true'] { border-color: #b99700; background: #fff2b8; }
	.season-dates { font-size: 14px; color: var(--sp-muted); }
	.from-price { margin: -8px 0 22px; font-size: 15px; color: var(--sp-muted); }
	.from-price strong { font-size: 26px; font-weight: 650; color: var(--sp-ink); font-variant-numeric: tabular-nums; }
	.pricing-grid { display: grid; gap: 20px; }
	.package { display: grid; grid-template-columns: 240px minmax(0, 1fr) 210px; align-items: center; overflow: hidden; border: 1px solid var(--sp-line); border-radius: 20px; background: #fff; }
	.package.solo { grid-template-columns: 240px minmax(0, 1fr); }
	.package.is-selected { border-color: #b99700; box-shadow: 0 0 0 1px #b99700; }
	.package-head { display: flex; flex-direction: column; justify-content: center; align-self: stretch; padding: 28px 26px; background: var(--sp-cream); }
	.package.is-selected .package-head { background: #fff2b8; }
	.package-head :global(svg) { width: 24px; height: 24px; margin-bottom: 14px; color: #98723c; }
	h3 { margin: 0 0 6px; font-size: 20px; font-weight: 650; color: var(--sp-ink); }
	.package-head p { margin: 0; font-size: 14px; line-height: 1.6; color: var(--sp-muted); }
	.horizontal-table { min-width: 0; padding: 26px 24px; overflow-x: auto; }
	/* Each group size keeps room for a four-digit price; more sizes scroll sideways. */
	table { width: 100%; min-width: calc(var(--cols, 4) * 92px); border-collapse: collapse; table-layout: fixed; }
	th { padding: 6px 6px 12px; font-size: 13px; font-weight: 500; text-align: center; color: var(--sp-muted); }
	td { padding: 0 6px 6px; font-size: 21px; font-weight: 650; text-align: center; letter-spacing: -0.01em; color: var(--sp-ink); font-variant-numeric: tabular-nums; }
	th + th, td + td { border-left: 1px solid var(--sp-line-soft); }
	.select-package { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 48px; margin: 24px 24px 24px 0; padding: 12px 18px; border: 1px solid var(--sp-line); border-radius: 999px; background: #fff; color: var(--sp-ink); font: 700 14px var(--sp-sans); cursor: pointer; }
	.select-package :global(svg) { width: 15px; height: 15px; }
	.select-package[aria-pressed='true'] { border-color: var(--sp-sun); background: var(--sp-sun); color: #2b2722; }
	.selection { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 24px; padding: 18px 24px; border-radius: 14px; background: var(--sp-cream); font-size: 15px; color: var(--sp-ink); }
	.selection strong { font-weight: 650; }
	.selection a { display: inline-flex; align-items: center; gap: 6px; padding: 4px 0; color: var(--sp-ink); font-weight: 600; text-decoration: none; white-space: nowrap; }
	.selection a:hover { color: #7b6500; }
	.selection a :global(svg) { width: 15px; height: 15px; }
	.pricing-note { max-width: 860px; margin: 22px 0 0; font-size: 13px; line-height: 1.8; color: var(--sp-muted); }
	@media (max-width: 1080px) {
		.package, .package.solo { grid-template-columns: 200px minmax(0, 1fr); }
		.select-package { grid-column: 1 / -1; justify-self: end; min-width: 200px; margin: 0 24px 22px; }
		.package-head { padding: 24px 20px; }
	}
	@media (max-width: 767px) { .pricing-top { align-items: flex-start; } .selection { flex-wrap: wrap; padding: 16px 18px; } }
	@media (max-width: 600px) {
		.package, .package.solo { grid-template-columns: minmax(0, 1fr); }
		.package-head { padding: 20px; }
		.package-head :global(svg) { display: none; }
		h3 { font-size: 18px; }
		.horizontal-table { padding: 20px 16px; }
		table { min-width: calc(var(--cols, 4) * 84px); }
		td { font-size: 18px; }
		.select-package { justify-self: stretch; margin: 0 16px 18px; }
	}
</style>
