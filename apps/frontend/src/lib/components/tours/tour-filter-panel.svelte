<script lang="ts">
	import { Check, ChevronDown, MapPin } from '@lucide/svelte';
	import { BUDGETS, toggleOption, type AgeChoice, type FacetGroup, type FacetOption, type TourQuery } from '$lib/tour-filter';

	// Each filter group drawn in the control its data reads best in: photo rows
	// for places and styles, a live price histogram, segmented length and
	// comfort. Every number is the safaris that option would leave. Drawn twice
	// (rail and phone sheet); `idPrefix` keeps the ids apart.
	let { groups, ages, query, onchange, idPrefix, photos = {} }: { groups: FacetGroup[]; ages: AgeChoice[]; query: TourQuery; onchange: (next: TourQuery) => void; idPrefix: string; photos?: Record<string, string> } = $props();

	const FIRST = 6;
	const PICTURED = new Set(['places', 'styles']);
	const SEGMENTS = new Set(['days', 'comfort']);
	const HINTS: Record<string, string> = { days: 'Days on safari' };
	const SHORT_PRICE: Record<string, string> = { 'under-1000': 'Under $1k', '1000-2000': '$1k–2k', '2000-3000': '$2k–3k', '3000-5000': '$3k–5k', '5000-plus': '$5k+' };
	const TIER: Record<string, number> = { budget: 1, midrange: 2, luxury: 3 };
	let opened = $state<Record<string, boolean>>({});

	const plural = (count: number) => `${count} ${count === 1 ? 'safari' : 'safaris'}`;
	const toggle = (group: FacetGroup, option: FacetOption) => onchange(toggleOption(query, group.id, option.value));
	const off = (option: FacetOption) => !option.count && !option.checked;

	// Every price band from the cheapest safari to the dearest, so a gap reads as a gap.
	function priceBars(group: FacetGroup): FacetOption[] {
		const bands = BUDGETS.filter((band) => band.key !== 'on-request');
		const found = bands.map((band) => group.options.find((option) => option.value === band.key));
		const first = found.findIndex(Boolean);
		let last = -1;
		found.forEach((option, i) => option && (last = i));
		if (first < 0) return [];
		return bands.slice(first, last + 1).map((band, i) => found[first + i] ?? { value: band.key, label: band.label, count: 0, checked: false });
	}
</script>

{#snippet row(group: FacetGroup, option: FacetOption, pictured: boolean)}
	<button type="button" class="row" aria-pressed={option.checked} disabled={off(option)} aria-label={`${option.label}, ${plural(option.count)}`} onclick={() => toggle(group, option)}>
		{#if pictured}
			<span class="thumb" aria-hidden="true">
				{#if photos[option.value]}<img src={photos[option.value]} alt="" width="40" height="40" loading="lazy" decoding="async" />{:else}<MapPin class="size-4" />{/if}
				<span class="tick"><Check class="size-4" strokeWidth={2.5} /></span>
			</span>
		{:else}
			<span class="box" aria-hidden="true"><Check class="size-3.5" strokeWidth={3} /></span>
		{/if}
		<span class="row-label" aria-hidden="true">{option.label}</span>
		<span class="n" aria-hidden="true">{option.count}</span>
	</button>
{/snippet}

<div class="facets">
	{#each groups as group (group.id)}
		{@const chosen = group.options.filter((option) => option.checked).length}
		{@const listed = !SEGMENTS.has(group.id) && group.id !== 'budget'}
		{@const long = listed && group.options.length > FIRST + 1}
		{@const shown = long && !opened[group.id] ? group.options.filter((option, i) => i < FIRST || option.checked) : group.options}
		{@const hint = group.hint ?? HINTS[group.id]}
		<div class="facet" role="group" aria-labelledby={`${idPrefix}-${group.id}-title`}>
			<div class="facet-head">
				<h3 id={`${idPrefix}-${group.id}-title`}>{group.title}</h3>
				{#if chosen}<button type="button" class="reset" onclick={() => onchange({ ...query, [group.id]: [] })} aria-label={`Clear ${group.title}`}>Clear</button>{/if}
			</div>
			{#if hint}<p class="hint">{hint}</p>{/if}

			{#if group.id === 'budget'}
				{@const bars = priceBars(group)}
				{@const top = Math.max(1, ...bars.map((bar) => bar.count))}
				{@const asked = group.options.find((option) => option.value === 'on-request')}
				{#if bars.length}
					<div class="bars" style={`--cols: ${bars.length}`}>
						{#each bars as bar (bar.value)}
							<button type="button" class="bar" aria-pressed={bar.checked} disabled={off(bar)} aria-label={`${bar.label}, ${plural(bar.count)}`} onclick={() => toggle(group, bar)}>
								<span class="bar-n" aria-hidden="true">{bar.count}</span>
								<span class="track" aria-hidden="true"><span class="fill" style={`--h: ${bar.count ? Math.max(bar.count / top, 0.14) : 0.04}`}></span></span>
								<span class="bar-label" aria-hidden="true">{SHORT_PRICE[bar.value] ?? bar.label}</span>
							</button>
						{/each}
					</div>
				{/if}
				{#if asked}<div class="rows tight">{@render row(group, asked, false)}</div>{/if}
			{:else if SEGMENTS.has(group.id)}
				<div class="segments" style={`--cols: ${group.options.length}`}>
					{#each group.options as option (option.value)}
						<button type="button" class="segment" aria-pressed={option.checked} disabled={off(option)} aria-label={`${option.label}, ${plural(option.count)}`} onclick={() => toggle(group, option)}>
							{#if group.id === 'comfort'}<span class="tier" aria-hidden="true">{#each [1, 2, 3] as step (step)}<i class:on={step <= (TIER[option.value] ?? 0)}></i>{/each}</span>{/if}
							<span class="seg-label" aria-hidden="true">{group.id === 'days' ? option.label.replace(/\s*days?$/i, '') : option.label}</span>
							<span class="seg-n" aria-hidden="true">{plural(option.count)}</span>
						</button>
					{/each}
				</div>
			{:else}
				<div id={`${idPrefix}-${group.id}`} class="rows">
					{#each shown as option (option.value)}{@render row(group, option, PICTURED.has(group.id))}{/each}
				</div>
				{#if long}
					<button type="button" class="more" aria-expanded={Boolean(opened[group.id])} aria-controls={`${idPrefix}-${group.id}`} onclick={() => (opened = { ...opened, [group.id]: !opened[group.id] })}>
						{opened[group.id] ? 'Show fewer' : `Show all ${group.options.length}`}<ChevronDown class={`size-4 transition-transform ${opened[group.id] ? 'rotate-180' : ''}`} aria-hidden="true" />
					</button>
				{/if}
			{/if}
		</div>
	{/each}

	{#if ages.length}
		<div class="facet">
			<div class="facet-head"><h3><label for={`${idPrefix}-age`}>Travelling with children</label></h3></div>
			<p class="hint">Age of the youngest traveller</p>
			<div class="select">
				<select id={`${idPrefix}-age`} value={query.age === null ? '' : String(query.age)} onchange={(event) => onchange({ ...query, age: event.currentTarget.value === '' ? null : Number(event.currentTarget.value) })}>
					{#each ages as choice (choice.value)}<option value={choice.value}>{choice.label}{choice.value === '' ? '' : ` · ${plural(choice.count)}`}</option>{/each}
				</select>
				<ChevronDown class="size-4" aria-hidden="true" />
			</div>
		</div>
	{/if}
</div>

<style>
	.facets { --line: oklch(0.91 0.01 80); --tint: oklch(0.968 0.012 84); --sand: oklch(0.86 0.035 78); display: grid; }
	.facet { min-width: 0; padding-block: 20px; }
	.facet + .facet { border-top: 1px solid var(--line); }
	.facet:first-child { padding-top: 4px; }
	.facet-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
	h3 { margin: 0; color: var(--navy); font-size: var(--text-sm); font-weight: 650; line-height: 1.4; }
	.reset { color: var(--muted-foreground); font-size: var(--text-xs); font-weight: 600; }
	.reset:hover { color: var(--navy); }
	.hint { margin: 2px 0 0; color: var(--muted-foreground); font-size: var(--text-xs); line-height: 1.45; }
	button:focus-visible, select:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }
	button:disabled { cursor: default; }

	/* Rows: places and styles with a photo, other lists with a check box. */
	.rows { display: grid; gap: 2px; margin: 10px -8px 0; }
	.rows.tight { margin-top: 8px; }
	.row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; width: 100%; min-height: 44px; padding: 4px 8px; border-radius: var(--radius-control); color: var(--navy); font-size: var(--text-sm); text-align: left; transition: background-color 160ms ease-out; }
	.row:hover:not(:disabled) { background: var(--tint); }
	.row[aria-pressed='true'] { background: var(--tint); }
	.row[aria-pressed='true'] .row-label { font-weight: 650; }
	.row:disabled { opacity: 0.42; }
	.row-label { min-width: 0; font-weight: 500; line-height: 1.35; overflow-wrap: anywhere; }
	.n { min-width: 2ch; color: var(--muted-foreground); font-size: var(--text-xs); font-variant-numeric: tabular-nums; text-align: right; }
	.row[aria-pressed='true'] .n { color: var(--navy); font-weight: 600; }
	.thumb { position: relative; display: grid; place-items: center; width: 40px; height: 40px; overflow: hidden; border-radius: 6px; background: var(--sand); color: color-mix(in oklch, var(--navy) 55%, transparent); }
	.thumb img { width: 100%; height: 100%; object-fit: cover; }
	.tick { position: absolute; inset: 0; display: grid; place-items: center; background: color-mix(in oklch, var(--navy) 62%, transparent); color: #fff; opacity: 0; transition: opacity 160ms ease-out; }
	.row[aria-pressed='true'] .tick { opacity: 1; }
	.box { display: grid; place-items: center; width: 20px; height: 20px; margin-inline: 2px; border: 1.5px solid oklch(0.78 0.015 80); border-radius: 5px; background: #fff; color: transparent; transition: background-color 160ms ease-out, border-color 160ms ease-out; }
	.row[aria-pressed='true'] .box { border-color: var(--navy); background: var(--navy); color: #fff; }

	/* Price: a histogram of what the safaris cost. */
	.bars { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 6px; margin-top: 12px; }
	.bar { display: grid; justify-items: center; gap: 6px; min-width: 0; padding: 0 0 2px; color: var(--navy); }
	.bar-n { color: var(--muted-foreground); font-size: var(--text-xs); font-variant-numeric: tabular-nums; }
	.track { position: relative; width: 100%; height: 64px; border-bottom: 1px solid oklch(0.8 0.02 80); }
	.fill { position: absolute; inset: 0 3px; border-radius: 4px 4px 0 0; background: var(--sand); transform: scaleY(var(--h)); transform-origin: bottom; transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1), background-color 160ms ease-out; }
	.bar:hover:not(:disabled) .fill { background: oklch(0.76 0.05 74); }
	.bar[aria-pressed='true'] .fill { background: var(--navy); }
	.bar[aria-pressed='true'] .bar-n, .bar[aria-pressed='true'] .bar-label { color: var(--navy); font-weight: 650; }
	.bar-label { max-width: 100%; color: color-mix(in oklch, var(--navy) 80%, transparent); font-size: var(--text-xs); font-weight: 500; line-height: 1.25; text-align: center; }
	.bar:disabled .bar-label, .bar:disabled .bar-n { opacity: 0.45; }

	/* Length and comfort: one joined segmented control. */
	.segments { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); margin-top: 12px; overflow: hidden; border: 1px solid oklch(0.86 0.014 80); border-radius: var(--radius-control); background: #fff; }
	.segment { display: grid; justify-items: center; align-content: center; gap: 2px; min-width: 0; min-height: 58px; padding: 8px 4px; color: var(--navy); transition: background-color 160ms ease-out, color 160ms ease-out; }
	.segment + .segment { border-left: 1px solid oklch(0.86 0.014 80); }
	.segment:hover:not(:disabled) { background: var(--tint); }
	.segment[aria-pressed='true'] { background: var(--navy); color: #fff; }
	.segment:disabled { color: color-mix(in oklch, var(--muted-foreground) 60%, transparent); background: oklch(0.985 0.004 85); }
	.seg-label { max-width: 100%; font-size: var(--text-sm); font-weight: 650; line-height: 1.25; text-align: center; overflow-wrap: anywhere; }
	.seg-n { color: var(--muted-foreground); font-size: var(--text-xs); font-variant-numeric: tabular-nums; white-space: nowrap; }
	.segment[aria-pressed='true'] .seg-n { color: rgb(255 255 255 / 0.68); }
	.tier { display: flex; align-items: flex-end; gap: 2px; height: 12px; margin-bottom: 3px; }
	.tier i { width: 3px; border-radius: 1px; background: oklch(0.85 0.02 80); }
	.tier i:nth-child(1) { height: 6px; } .tier i:nth-child(2) { height: 9px; } .tier i:nth-child(3) { height: 12px; }
	.tier i.on { background: #b98a3a; }
	.segment[aria-pressed='true'] .tier i { background: rgb(255 255 255 / 0.3); }
	.segment[aria-pressed='true'] .tier i.on { background: var(--sun); }

	.more { display: inline-flex; align-items: center; gap: 4px; min-height: 40px; margin-top: 6px; color: var(--navy); font-size: var(--text-sm); font-weight: 600; }
	.more:hover { color: color-mix(in oklch, var(--navy) 70%, transparent); }
	.select { position: relative; margin-top: 10px; }
	.select select { width: 100%; height: 44px; padding: 0 38px 0 12px; border: 1px solid oklch(0.86 0.014 80); border-radius: var(--radius-control); background: #fff; color: var(--navy); font-size: var(--text-sm); font-weight: 500; appearance: none; cursor: pointer; }
	.select :global(svg) { position: absolute; top: 50%; right: 12px; translate: 0 -50%; color: var(--muted-foreground); pointer-events: none; }
	@media (prefers-reduced-motion: reduce) { .row, .tick, .box, .fill, .segment { transition: none; } }
</style>
