<script lang="ts">
	import { ArrowRight, List, Map as MapIcon, Search, X } from '@lucide/svelte';
	import { glide } from '$lib/motion/glide';
	import DestinationMap from './destination-map.svelte';
	import DestinationRow from './destination-row.svelte';
	import LocatorMap from './locator-map.svelte';
	import { explore, queryString, TRAITS, type ExplorerQuery, type Place, type Region, type SortKey } from '$lib/destination-explorer';
	import { destinationHref } from '$lib/destination-content';
	import { formatPrice } from '$lib/safari-pricing';

	// The explorer: region tabs, a search and a "best for" sort over the list
	// of places, with every place on the map beside it. The list and the map
	// answer each other: hover a place to find it, tap a pin to open it.
	let { places, regions, sorts, query, onquery }: { places: Place[]; regions: Region[]; sorts: SortKey[]; query: ExplorerQuery; onquery: (next: ExplorerQuery) => void } = $props();

	let hovered = $state<string | null>(null);
	let selected = $state<string | null>(null);
	let view = $state<'list' | 'map'>('list');
	let shown = $derived(explore(places, query));
	let others = $derived(places.filter((p) => p.lat !== null && p.lng !== null).map((p) => ({ lat: p.lat as number, lng: p.lng as number })));
	let filtered = $derived(Boolean(query.search || query.region || query.country));
	// With nothing chosen the list reads by region; a filter or a sort makes it one ranked list.
	let groups = $derived(!filtered && query.sort === 'recommended' ? regions.map((region) => ({ region, items: shown.filter((p) => p.region === region.key) })).filter((g) => g.items.length) : null);
	let current = $derived(places.find((p) => p.id === selected) ?? null);
	const SORT_LABEL: Record<SortKey, string> = { recommended: 'Recommended', wildlife: 'Best for wildlife', photography: 'Best for photography', family: 'Best for families', adventure: 'Best for adventure', luxury: 'Best for comfort' };

	const regionHref = (key: string) => `/destinations${queryString({ ...query, region: key as ExplorerQuery['region'] })}#destination-results`;
	function pickRegion(event: MouseEvent, key: ExplorerQuery['region']) {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
		event.preventDefault();
		selected = null;
		onquery({ ...query, region: key });
	}
	const clear = () => { selected = null; onquery({ search: '', region: '', country: '', sort: query.sort }); };
	const where = (p: Place) => [p.area, p.country].filter((part, i, all) => part && all.indexOf(part) === i).join(' · ');
	const safaris = (p: Place) => (p.safaris.count ? `${p.safaris.count} ${p.safaris.count === 1 ? 'safari' : 'safaris'}${p.safaris.from ? ` from ${formatPrice(p.safaris.from.amount, p.safaris.from.currency)}` : ''}` : '');
</script>

<svelte:window onkeydown={(event) => { if (event.key === 'Escape' && selected) selected = null; }} />

<div class="explorer">
	<div class="toolbar">
		<nav class="regions" aria-label="Safari region" use:glide={{ center: true }}>
			<a href={regionHref('')} data-sveltekit-noscroll aria-current={query.region === '' ? 'true' : undefined} onclick={(e) => pickRegion(e, '')}>All places<span>{places.length}</span></a>
			{#each regions as region (region.key)}
				<a href={regionHref(region.key)} data-sveltekit-noscroll aria-current={query.region === region.key ? 'true' : undefined} onclick={(e) => pickRegion(e, region.key)}>{region.title}<span>{region.count}</span></a>
			{/each}
		</nav>
		<div class="controls">
			<form class="search" role="search" method="GET" action="/destinations#destination-results" onsubmit={(e) => e.preventDefault()}>
				<Search class="search-icon" aria-hidden="true" />
				<label for="destination-query" class="sr-only">Find a place</label>
				<input id="destination-query" name="search" type="search" value={query.search} oninput={(e) => onquery({ ...query, search: e.currentTarget.value.slice(0, 120) })} maxlength={120} autocomplete="off" enterkeyhint="search" placeholder="Find a park, island or town" />
				{#if query.search}<button type="button" class="clear-search" aria-label="Clear search" onclick={() => onquery({ ...query, search: '' })}><X aria-hidden="true" /></button>{/if}
			</form>
			{#if sorts.length > 1}
				<label class="sort">
					<span class="sr-only">Order places by</span>
					<select value={query.sort} onchange={(e) => onquery({ ...query, sort: e.currentTarget.value as SortKey })}>
						{#each sorts as key (key)}<option value={key}>{SORT_LABEL[key]}</option>{/each}
					</select>
				</label>
			{/if}
			<div class="view-switch" role="group" aria-label="Show as" use:glide>
				<button type="button" aria-pressed={view === 'list'} onclick={() => (view = 'list')}><List aria-hidden="true" />List</button>
				<button type="button" aria-pressed={view === 'map'} onclick={() => (view = 'map')}><MapIcon aria-hidden="true" />Map</button>
			</div>
		</div>
	</div>

	<div class="status" aria-live="polite">
		<p>{shown.length === places.length ? `${places.length} places` : `${shown.length} of ${places.length} places`}{query.sort !== 'recommended' ? `, ${SORT_LABEL[query.sort].toLowerCase()} first` : ''}</p>
		{#if filtered}<button type="button" onclick={clear}>Clear filters</button>{/if}
	</div>

	<div class="body" class:map-view={view === 'map'}>
		<div class="list">
			{#if !shown.length}
				<div class="empty">
					<h3>No places match</h3>
					<p>Try another word, or look across every region.</p>
					<button type="button" onclick={clear}>Show every place</button>
				</div>
			{:else if groups}
				{#each groups as group (group.region.key)}
					<section class="group" aria-labelledby={`region-${group.region.key}`}>
						<div class="group-head">
							<h3 id={`region-${group.region.key}`}>{group.region.title}</h3>
							<p>{[group.region.description, `${group.items.length} ${group.items.length === 1 ? 'place' : 'places'}`].filter(Boolean).join(' · ')}</p>
						</div>
						<div class="rows">
							{#each group.items as place (place.id)}<DestinationRow {place} {others} level={4} active={hovered === place.id || selected === place.id} onhover={(id) => (hovered = id)} />{/each}
						</div>
					</section>
				{/each}
			{:else}
				<div class="rows">
					{#each shown as place (place.id)}<DestinationRow {place} {others} sort={query.sort} active={hovered === place.id || selected === place.id} onhover={(id) => (hovered = id)} />{/each}
				</div>
			{/if}
		</div>

		<div class="map-col">
			<div class="map-stick">
				<DestinationMap {places} {shown} bind:hovered bind:selected />
				{#if current}
					<div class="map-card">
						<div class="map-card-media">
							{#if current.photos[0]}<img src={current.photos[0]} alt="" />{:else}<LocatorMap lat={current.lat} lng={current.lng} {others} name={current.name} />{/if}
						</div>
						<div class="map-card-body">
							{#if where(current)}<p>{where(current)}</p>{/if}
							<strong>{current.name}</strong>
							<div class="map-card-links">
								<a href={destinationHref(current)}>View place<ArrowRight aria-hidden="true" /></a>
								{#if safaris(current)}<a href={`/tours?destination_id=${encodeURIComponent(current.id)}#tour-results`} class="quiet">{safaris(current)}</a>{/if}
							</div>
						</div>
						<button type="button" class="map-card-close" aria-label="Close" onclick={() => (selected = null)}><X aria-hidden="true" /></button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.explorer { margin-top: 28px; }
	.toolbar { display: grid; gap: 14px; }

	/* Regions: tabs under one gliding marker, with how many places each holds. */
	.regions { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
	.regions::-webkit-scrollbar { display: none; }
	.regions :global(.glide-mark) { border-radius: var(--radius-control); background: var(--navy); box-shadow: 0 10px 20px -12px rgb(31 27 22 / 0.8); }
	.regions a { position: relative; display: inline-flex; flex: none; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px; border-radius: var(--radius-control); color: #5f584e; font-size: var(--text-sm); font-weight: 600; text-decoration: none; white-space: nowrap; -webkit-tap-highlight-color: transparent; transition: color 0.45s cubic-bezier(0.22, 1, 0.36, 1); }
	.regions a::before { content: ''; position: absolute; inset: 0; z-index: -2; border-radius: inherit; background: #ebe6da; transition: background-color 0.2s ease; }
	.regions a span { font-weight: 500; font-variant-numeric: tabular-nums; opacity: 0.6; }
	.regions a:hover { color: var(--navy); }
	.regions a:hover::before { background: #e3ddcf; }
	.regions a[aria-current='true'] { color: #fff; }
	.regions a:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }

	.controls { display: flex; gap: 10px; }
	.search { position: relative; flex: 1; min-width: 0; }
	.search :global(.search-icon) { position: absolute; top: 50%; left: 14px; width: 18px; height: 18px; color: var(--muted-foreground); translate: 0 -50%; pointer-events: none; }
	.search input { width: 100%; height: 48px; padding: 0 44px; border: 1px solid var(--border); border-radius: var(--radius-control); background: #fff; color: var(--navy); font-size: var(--text-base); }
	.search input::placeholder { color: color-mix(in oklch, var(--muted-foreground) 80%, white); }
	.search input::-webkit-search-cancel-button { display: none; }
	.search input:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }
	.clear-search { position: absolute; top: 50%; right: 8px; display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 6px; background: transparent; color: var(--muted-foreground); translate: 0 -50%; cursor: pointer; }
	.clear-search:hover { background: var(--secondary); color: var(--navy); }
	.clear-search :global(svg) { width: 16px; height: 16px; }
	.sort select { height: 48px; padding: 0 40px 0 14px; border: 1px solid var(--border); border-radius: var(--radius-control); background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%237a7263' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 14px center; color: var(--navy); font: 600 var(--text-sm)/1 var(--font-sans); appearance: none; cursor: pointer; }
	.sort select:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }

	/* List / map: a two-way switch on screens too narrow for both side by side. */
	.view-switch { position: relative; display: none; flex: none; padding: 4px; border-radius: var(--radius-control); background: #ebe6da; }
	.view-switch :global(.glide-mark) { border-radius: 6px; background: #fff; box-shadow: 0 1px 4px rgb(20 18 15 / 0.14); }
	.view-switch button { position: relative; display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; color: #5f584e; font: 600 var(--text-sm)/1 var(--font-sans); cursor: pointer; }
	.view-switch button[aria-pressed='true'] { color: var(--navy); }
	.view-switch button :global(svg) { width: 16px; height: 16px; }
	.view-switch button:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }

	.status { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 32px; margin: 18px 0 14px; }
	.status p { margin: 0; color: var(--muted-foreground); font-size: var(--text-sm); }
	.status button, .empty button { padding: 0; border: 0; background: none; color: var(--navy); font: 700 var(--text-sm)/1.2 var(--font-sans); cursor: pointer; }
	.status button:hover, .empty button:hover { opacity: 0.7; }

	.body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 0.86fr); gap: 32px; align-items: start; }
	.list { display: grid; gap: 36px; min-width: 0; }
	.group { display: grid; gap: 14px; }
	.group-head h3 { margin: 0; font-size: var(--text-xl); font-weight: 600; letter-spacing: -0.02em; color: var(--navy); }
	.group-head p { margin: 4px 0 0; color: var(--muted-foreground); font-size: var(--text-sm); }
	.rows { display: grid; gap: 12px; }
	.empty { padding: 40px 24px; border-radius: var(--radius-surface); background: #fff; text-align: center; box-shadow: 0 0 0 1px rgb(43 39 34 / 0.07); }
	.empty h3 { margin: 0; font-size: var(--text-lg); font-weight: 600; color: var(--navy); }
	.empty p { margin: 6px 0 16px; color: var(--muted-foreground); font-size: var(--text-sm); }

	.map-col { position: sticky; top: calc(var(--site-header-height) + 20px); }
	.map-stick { position: relative; height: min(calc(100svh - var(--site-header-height) - 40px), 760px); }

	/* The place a pin opened, over the foot of the map. */
	.map-card { position: absolute; right: 12px; bottom: 12px; left: 12px; display: grid; grid-template-columns: 76px minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 10px; border-radius: var(--radius-surface); background: #fff; box-shadow: 0 18px 40px -18px rgb(20 18 15 / 0.45), 0 0 0 1px rgb(43 39 34 / 0.06); animation: card-in 0.22s cubic-bezier(0.22, 1, 0.36, 1); }
	.map-card-media { overflow: hidden; aspect-ratio: 1; border-radius: var(--radius-control); background: #f1eee4; }
	.map-card-media img { display: block; width: 100%; height: 100%; object-fit: cover; }
	.map-card-body { min-width: 0; }
	.map-card-body p { margin: 0; overflow: hidden; color: var(--muted-foreground); font-size: var(--text-xs); text-overflow: ellipsis; white-space: nowrap; }
	.map-card-body strong { display: block; margin-top: 2px; overflow: hidden; color: var(--navy); font-size: var(--text-base); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
	.map-card-links { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 6px; }
	.map-card-links a { display: inline-flex; align-items: center; gap: 5px; color: var(--navy); font-size: var(--text-sm); font-weight: 700; text-decoration: none; }
	.map-card-links a.quiet { color: var(--muted-foreground); font-weight: 600; }
	.map-card-links a:hover { opacity: 0.75; }
	.map-card-links :global(svg) { width: 14px; height: 14px; transition: translate 0.2s ease; }
	.map-card-links a:hover :global(svg) { translate: 3px 0; }
	.map-card-close { align-self: start; display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 6px; background: transparent; color: var(--muted-foreground); cursor: pointer; }
	.map-card-close:hover { background: var(--secondary); color: var(--navy); }
	.map-card-close :global(svg) { width: 16px; height: 16px; }
	@keyframes card-in { from { opacity: 0; translate: 0 8px; } }

	@media (max-width: 1179px) {
		.view-switch { display: flex; }
		.body { grid-template-columns: minmax(0, 1fr); }
		.map-col { display: none; position: static; }
		.body.map-view .list { display: none; }
		.body.map-view .map-col { display: block; }
		.map-stick { height: min(68svh, 620px); }
	}
	@media (max-width: 639px) {
		.explorer { margin-top: 20px; }
		.regions { margin-inline: -1rem; padding: 2px 1rem; }
		.controls { flex-wrap: wrap; }
		.search { flex-basis: 100%; }
		.sort { flex: 1; min-width: 0; }
		.sort select { width: 100%; }
		.view-switch { margin-left: auto; }
		.list { gap: 28px; }
		.rows { gap: 10px; }
		.map-stick { height: 64svh; margin-inline: -1rem; }
		.map-stick :global(.place-map) { border-radius: 0; }
		.map-card { grid-template-columns: 64px minmax(0, 1fr) auto; }
	}
	@media (prefers-reduced-motion: reduce) { .regions a, .map-card { transition: none; animation: none; } }
</style>
