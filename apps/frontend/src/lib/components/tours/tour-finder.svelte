<script lang="ts">
	import { ArrowRight, Check } from '@lucide/svelte';
	import { facetGroups, filterTours, toggleOption, type TourFacts, type TourQuery } from '$lib/tour-filter';
	import type { Category } from '$lib/types/api';

	/**
	 * The card in the tours hero: pick the places and a length, watch the count
	 * change, then jump to the list with those choices applied. It starts from
	 * the filters already chosen, so it never disagrees with the list below.
	 */
	let {
		facts,
		query,
		categories,
		destinations,
		photos,
		onapply
	}: {
		facts: TourFacts[];
		query: TourQuery;
		categories: Category[];
		destinations: { id: string; name: string }[];
		photos: Record<string, string>;
		onapply: (next: TourQuery) => void;
	} = $props();

	const SHORT_DAYS: Record<string, string> = { '1-3': '1–3 days', '4-6': '4–6 days', '7-10': '7–10 days', '11-plus': '11+ days' };
	const TILES = 4;

	// A draft of the query; it follows the list's own filters until changed here.
	let draft = $derived(query);
	let groups = $derived(facetGroups(facts, draft, { categories, destinations }));
	let places = $derived(groups.find((group) => group.id === 'places')?.options ?? []);
	let days = $derived(groups.find((group) => group.id === 'days')?.options ?? []);
	// The busiest places, plus any already chosen elsewhere, in a fixed order.
	let tiles = $derived(places.filter((option, i) => i < TILES || option.checked).slice(0, TILES + 2));
	let placeCount = $derived(facetGroups(facts, { ...query, places: [] }, { categories, destinations }).find((group) => group.id === 'places')?.options.length ?? 0);
	let count = $derived(filterTours(facts, draft).length);
	let chosen = $derived(draft.places.length + draft.days.length > 0);
	const safaris = (n: number) => `${n} ${n === 1 ? 'safari' : 'safaris'}`;
</script>

<form class="finder" aria-labelledby="finder-title" onsubmit={(event) => { event.preventDefault(); onapply(draft); }}>
	<div class="finder-head">
		<h2 id="finder-title">Find your safari</h2>
		<p>{safaris(facts.length)}{placeCount ? ` across ${placeCount} places` : ''}</p>
	</div>

	{#if tiles.length}
		<fieldset>
			<legend>Where would you like to go?</legend>
			<div class="tiles">
				{#each tiles as option (option.value)}
					<button
						type="button"
						class="tile"
						aria-pressed={option.checked}
						disabled={!option.checked && option.count === 0}
						onclick={() => (draft = toggleOption(draft, 'places', option.value))}
					>
						{#if photos[option.value]}<img src={photos[option.value]} alt="" loading="lazy" decoding="async" />{/if}
						<span class="tile-text"><strong>{option.label}</strong><small>{safaris(option.count)}</small></span>
						<span class="tick" aria-hidden="true"><Check /></span>
					</button>
				{/each}
			</div>
		</fieldset>
	{/if}

	{#if days.length > 1}
		<fieldset>
			<legend>How many days?</legend>
			<div class="segments" style:--n={days.length}>
				{#each days as option (option.value)}
					<button
						type="button"
						aria-pressed={option.checked}
						disabled={!option.checked && option.count === 0}
						onclick={() => (draft = toggleOption(draft, 'days', option.value))}
					>{SHORT_DAYS[option.value] ?? option.label}</button>
				{/each}
			</div>
		</fieldset>
	{/if}

	<div class="finder-foot">
		<button type="submit" class="show" disabled={count === 0}>
			<span>{count ? `Show ${safaris(count)}` : 'No safaris match'}</span><ArrowRight aria-hidden="true" />
		</button>
		{#if chosen}<button type="button" class="reset" onclick={() => (draft = { ...draft, places: [], days: [] })}>Reset</button>{/if}
	</div>
</form>

<style>
	.finder {
		display: grid;
		gap: 20px;
		padding: 24px;
		border: 1px solid rgb(255 255 255 / 0.16);
		border-radius: var(--radius-surface);
		background: linear-gradient(160deg, rgb(30 34 36 / 0.72), rgb(36 30 24 / 0.66));
		backdrop-filter: blur(14px) saturate(1.1);
		-webkit-backdrop-filter: blur(14px) saturate(1.1);
		box-shadow: 0 30px 70px -30px rgb(0 0 0 / 0.6);
		color: #fff;
	}
	.finder-head h2 { margin: 0; font-size: var(--text-xl); font-weight: 600; line-height: 1.2; letter-spacing: -0.02em; }
	.finder-head p { margin: 4px 0 0; font-size: var(--text-sm); color: rgb(255 255 255 / 0.7); }
	fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
	legend { margin-bottom: 10px; padding: 0; font-size: var(--text-sm); font-weight: 600; color: rgb(255 255 255 / 0.92); }

	.tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
	.tile {
		position: relative; isolation: isolate; overflow: hidden;
		display: flex; align-items: flex-end;
		min-height: 74px; padding: 10px 12px;
		border: 0; border-radius: var(--radius-control);
		background: rgb(255 255 255 / 0.08);
		color: #fff; text-align: left; cursor: pointer;
	}
	.tile img { position: absolute; inset: 0; z-index: -2; width: 100%; height: 100%; object-fit: cover; transition: scale 0.5s cubic-bezier(0.2, 0.7, 0.2, 1); }
	.tile::before { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(0deg, rgb(14 12 10 / 0.86) 0%, rgb(14 12 10 / 0.35) 70%, rgb(14 12 10 / 0.15) 100%); transition: background-color 0.2s; }
	.tile::after { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.14); transition: box-shadow 0.2s; pointer-events: none; }
	.tile:hover img { scale: 1.06; }
	.tile[aria-pressed='true']::after { box-shadow: inset 0 0 0 2px var(--sun); }
	.tile:disabled { opacity: 0.4; cursor: not-allowed; }
	.tile:disabled img { filter: grayscale(1); }
	.tile-text { display: grid; gap: 1px; min-width: 0; }
	.tile-text strong { overflow: hidden; font-size: var(--text-sm); font-weight: 600; line-height: 1.25; white-space: nowrap; text-overflow: ellipsis; }
	.tile-text small { font-size: var(--text-xs); color: rgb(255 255 255 / 0.75); }
	.tick {
		position: absolute; top: 8px; right: 8px;
		display: grid; place-items: center; width: 20px; height: 20px;
		border-radius: 4px; background: var(--sun); color: var(--navy);
		opacity: 0; scale: 0.6; transition: opacity 0.18s, scale 0.18s;
	}
	.tick :global(svg) { width: 13px; height: 13px; stroke-width: 3; }
	.tile[aria-pressed='true'] .tick { opacity: 1; scale: 1; }

	.segments { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); border: 1px solid rgb(255 255 255 / 0.22); border-radius: var(--radius-control); overflow: hidden; }
	.segments button { min-height: 42px; padding: 0 6px; border: 0; background: transparent; color: rgb(255 255 255 / 0.88); font: 600 var(--text-sm)/1.1 var(--font-sans); white-space: nowrap; cursor: pointer; transition: background-color 0.18s, color 0.18s; }
	.segments button + button { border-left: 1px solid rgb(255 255 255 / 0.18); }
	.segments button:hover:not(:disabled) { background: rgb(255 255 255 / 0.08); }
	.segments button[aria-pressed='true'] { background: var(--sun); color: var(--navy); }
	.segments button:disabled { color: rgb(255 255 255 / 0.35); cursor: not-allowed; }

	.finder-foot { display: flex; align-items: center; gap: 16px; }
	.show {
		display: inline-flex; flex: 1; align-items: center; justify-content: center; gap: 8px;
		min-height: 46px; padding: 0 20px; border: 0; border-radius: var(--radius-control);
		background: var(--sun); color: var(--navy); font: 700 var(--text-sm)/1 var(--font-sans);
		cursor: pointer; transition: background-color 0.18s;
	}
	.show span { font-variant-numeric: tabular-nums; }
	.show :global(svg) { width: 16px; height: 16px; transition: translate 0.18s; }
	.show:hover:not(:disabled) { background: color-mix(in oklab, var(--sun) 90%, black); }
	.show:hover:not(:disabled) :global(svg) { translate: 3px 0; }
	.show:disabled { opacity: 0.6; cursor: not-allowed; }
	.reset { flex: none; padding: 6px 2px; border: 0; background: none; color: rgb(255 255 255 / 0.8); font: 600 var(--text-sm)/1 var(--font-sans); cursor: pointer; }
	.reset:hover { color: #fff; }
	.finder :global(:focus-visible) { outline: 2px solid var(--sun); outline-offset: 2px; }

	@media (prefers-reduced-motion: reduce) { .tile img, .tick, .show :global(svg) { transition: none; } .tile:hover img { scale: 1; } }
</style>
