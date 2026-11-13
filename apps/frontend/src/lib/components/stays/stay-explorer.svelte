<script lang="ts">
	import { ArrowRight, List, Map as MapIcon, Search, X } from '@lucide/svelte';
	import { glide } from '$lib/motion/glide';
	import DestinationMap from '$lib/components/destinations/destination-map.svelte';
	import StayCard from './stay-card.svelte';
	import { filterStays, styleCounts, toStayItem, typeCounts, type StayPlace, type StayQuery } from '$lib/stay-explorer';
	import { SAFARI_STYLE_THEME } from '$lib/safari-pricing';
	import type { SafariStyle } from '$lib/safari-pricing';
	import type { Destination, Stay } from '$lib/types/api';

	// The stays explorer: comfort tabs, a search, and place and kind filters
	// over every stay, grouped by the place it is in, with those places on the
	// map beside the list. Each pin carries how many stays match there; tap one
	// to see only that place's stays.
	type PlaceDetail = Pick<Destination, 'id' | 'name' | 'slug' | 'image_url' | 'main_image_url' | 'banner_image_url'>;
	let { stays, places, placeDetails, query, onquery }: { stays: Stay[]; places: StayPlace[]; placeDetails: PlaceDetail[]; query: StayQuery; onquery: (next: StayQuery) => void } = $props();

	let items = $derived(stays.map(toStayItem));
	let byId = $derived(new Map(stays.map((stay) => [stay.id, stay])));
	let details = $derived(new Map(placeDetails.map((d) => [d.id, d as Destination])));
	let shown = $derived(filterStays(items, query));
	let filtered = $derived(Boolean(query.search || query.place || query.style || query.type || query.country));

	// Counts answer "what would I get?": each filter counted with the others applied.
	let styles = $derived(styleCounts(filterStays(items, query, 'style')));
	let anyStyle = $derived(filterStays(items, query, 'style').length);
	let types = $derived(typeCounts(filterStays(items, query, 'type')));
	let elsewhere = $derived(filterStays(items, query, 'place'));
	let pins = $derived(places.map((place) => ({ ...place, count: elsewhere.filter((item) => item.placeId === place.id).length })));
	let lit = $derived(query.place ? pins.filter((pin) => pin.id === query.place) : pins.filter((pin) => pin.count > 0));

	// Without a place or a search, the list reads place by place.
	let groups = $derived(!query.place && !query.search ? places.map((place) => ({ place, items: shown.filter((item) => item.placeId === place.id) })).filter((group) => group.items.length) : null);
	let current = $derived(places.find((place) => place.id === query.place) ?? null);
	let currentCount = $derived(current ? shown.length : 0);

	let hovered = $state<string | null>(null);
	let picked = $state<string | null>(null);
	let view = $state<'list' | 'map'>('list');

	// A pin tapped on the map chooses that place (tapping it again lets go).
	$effect(() => {
		const id = picked;
		if (!id) return;
		picked = null;
		onquery({ ...query, place: query.place === id ? '' : id });
	});

	const stayWord = (n: number) => `${n} ${n === 1 ? 'stay' : 'stays'}`;
	const styleHref = (style: string) => `/stays${style ? `?style=${style}` : ''}#stay-results`;
	function pickStyle(event: MouseEvent, style: SafariStyle | '') {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
		event.preventDefault();
		onquery({ ...query, style });
	}
	const clear = () => onquery({ search: '', place: '', style: '', type: '', country: '' });
</script>

<div class="explorer">
	<div class="toolbar">
		<nav class="styles" aria-label="Comfort" use:glide={{ center: true }}>
			<a href={styleHref('')} data-sveltekit-noscroll aria-current={query.style === '' ? 'true' : undefined} onclick={(e) => pickStyle(e, '')}>All stays<span>{anyStyle}</span></a>
			{#each styles as style (style.id)}
				<a href={styleHref(style.id)} data-sveltekit-noscroll aria-current={query.style === style.id ? 'true' : undefined} onclick={(e) => pickStyle(e, style.id)}><i style:background={SAFARI_STYLE_THEME[style.id].primary} aria-hidden="true"></i>{style.label}<span>{style.count}</span></a>
			{/each}
		</nav>
		<div class="controls">
			<form class="search" role="search" method="GET" action="/stays#stay-results" onsubmit={(e) => e.preventDefault()}>
				<Search class="search-icon" aria-hidden="true" />
				<label for="stay-query" class="sr-only">Find a stay</label>
				<input id="stay-query" name="search" type="search" value={query.search} oninput={(e) => onquery({ ...query, search: e.currentTarget.value.slice(0, 120) })} maxlength={120} autocomplete="off" enterkeyhint="search" placeholder="Find a lodge, camp or hotel" />
				{#if query.search}<button type="button" class="clear-search" aria-label="Clear search" onclick={() => onquery({ ...query, search: '' })}><X aria-hidden="true" /></button>{/if}
			</form>
			<label class="pick">
				<span class="sr-only">Place</span>
				<select value={query.place} onchange={(e) => onquery({ ...query, place: e.currentTarget.value })}>
					<option value="">Every place</option>
					{#each pins as pin (pin.id)}<option value={pin.id}>{pin.name} ({pin.count})</option>{/each}
				</select>
			</label>
			{#if types.length > 1}
				<label class="pick">
					<span class="sr-only">Kind of stay</span>
					<select value={query.type} onchange={(e) => onquery({ ...query, type: e.currentTarget.value as StayQuery['type'] })}>
						<option value="">Every kind of stay</option>
						{#each types as type (type.value)}<option value={type.value}>{type.label} ({type.count})</option>{/each}
					</select>
				</label>
			{/if}
		</div>
	</div>

	<div class="status">
		<p aria-live="polite">{shown.length === items.length ? stayWord(items.length) : `${shown.length} of ${stayWord(items.length)}`}{current ? ` in ${current.name}` : ''}</p>
		{#if filtered}<button type="button" class="clear" onclick={clear}>Clear filters</button>{/if}
		<div class="view-switch" role="group" aria-label="Show as" use:glide>
			<button type="button" aria-pressed={view === 'list'} onclick={() => (view = 'list')}><List aria-hidden="true" />List</button>
			<button type="button" aria-pressed={view === 'map'} onclick={() => (view = 'map')}><MapIcon aria-hidden="true" />Map</button>
		</div>
	</div>

	<div class="body" class:map-view={view === 'map'}>
		<div class="list">
			{#if !shown.length}
				<div class="empty">
					<h3>No stays match</h3>
					<p>Try another word, comfort or place, or look across every stay.</p>
					<button type="button" onclick={clear}>Show every stay</button>
				</div>
			{:else if groups}
				{#each groups as group (group.place.id)}
					<section class="group" class:lit={hovered === group.place.id} aria-labelledby={`place-${group.place.id}`}>
						<div class="group-head">
							<div>
								<h3 id={`place-${group.place.id}`}>{group.place.name}</h3>
								<p>{stayWord(group.items.length)}</p>
							</div>
							<a href={`/tours?destination_id=${encodeURIComponent(group.place.id)}#tour-results`}>Safaris here<span class="sr-only"> to {group.place.name}</span><ArrowRight aria-hidden="true" /></a>
						</div>
						<ul class="cards">
							{#each group.items as item (item.id)}
								<li onpointerenter={() => (hovered = item.placeId)} onpointerleave={() => (hovered = null)} onfocusin={() => (hovered = item.placeId)} onfocusout={() => (hovered = null)}><StayCard stay={byId.get(item.id)!} destination={details.get(item.placeId) ?? null} compact /></li>
							{/each}
						</ul>
					</section>
				{/each}
			{:else}
				<ul class="cards">
					{#each shown as item (item.id)}
						<li onpointerenter={() => (hovered = item.placeId)} onpointerleave={() => (hovered = null)} onfocusin={() => (hovered = item.placeId)} onfocusout={() => (hovered = null)}><StayCard stay={byId.get(item.id)!} destination={details.get(item.placeId) ?? null} compact /></li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="map-col">
			<div class="map-stick">
				<DestinationMap places={pins} shown={lit} bind:hovered bind:selected={picked} />
				{#if current}
					{@const detail = details.get(current.id)}
					<div class="map-card">
						<div class="map-card-body">
							<strong>{current.name}</strong>
							<p>{stayWord(currentCount)}{query.style || query.type || query.search ? ' match' : ''}</p>
							<div class="map-card-links">
								<button type="button" class="to-list" onclick={() => (view = 'list')}>Show {stayWord(currentCount)}<ArrowRight aria-hidden="true" /></button>
								{#if detail?.slug}<a href={`/destinations/${encodeURIComponent(detail.slug)}`}>About {current.name}</a>{/if}
								<a href={`/tours?destination_id=${encodeURIComponent(current.id)}#tour-results`}>Safaris here</a>
							</div>
						</div>
						<button type="button" class="map-card-close" aria-label="Show every place" onclick={() => onquery({ ...query, place: '' })}><X aria-hidden="true" /></button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.explorer { margin-top: 28px; }
	.toolbar { display: grid; gap: 14px; }

	/* Comfort: tabs under one gliding marker, each with its colour and how many stays it holds. */
	.styles { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
	.styles::-webkit-scrollbar { display: none; }
	.styles :global(.glide-mark) { border-radius: var(--radius-control); background: var(--navy); box-shadow: 0 10px 20px -12px rgb(31 27 22 / 0.8); }
	.styles a { position: relative; display: inline-flex; flex: none; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px; border-radius: var(--radius-control); color: #5f584e; font-size: var(--text-sm); font-weight: 600; text-decoration: none; white-space: nowrap; -webkit-tap-highlight-color: transparent; transition: color 0.45s cubic-bezier(0.22, 1, 0.36, 1); }
	.styles a::before { content: ''; position: absolute; inset: 0; z-index: -2; border-radius: inherit; background: #ebe6da; transition: background-color 0.2s ease; }
	.styles a i { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 0 2px rgb(255 255 255 / 0.6); }
	.styles a span { font-weight: 500; font-variant-numeric: tabular-nums; opacity: 0.6; }
	.styles a:hover { color: var(--navy); }
	.styles a:hover::before { background: #e3ddcf; }
	.styles a[aria-current='true'] { color: #fff; }
	.styles a:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }

	.controls { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 15rem) minmax(0, 15rem); gap: 10px; }
	.search { position: relative; min-width: 0; }
	.search :global(.search-icon) { position: absolute; top: 50%; left: 14px; width: 18px; height: 18px; color: var(--muted-foreground); translate: 0 -50%; pointer-events: none; }
	.search input { width: 100%; height: 48px; padding: 0 44px; border: 1px solid var(--border); border-radius: var(--radius-control); background: #fff; color: var(--navy); font-size: var(--text-base); }
	.search input::placeholder { color: color-mix(in oklch, var(--muted-foreground) 80%, white); }
	.search input::-webkit-search-cancel-button { display: none; }
	.search input:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }
	.clear-search { position: absolute; top: 50%; right: 8px; display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 6px; background: transparent; color: var(--muted-foreground); translate: 0 -50%; cursor: pointer; }
	.clear-search:hover { background: var(--secondary); color: var(--navy); }
	.clear-search :global(svg) { width: 16px; height: 16px; }
	.pick select { width: 100%; height: 48px; padding: 0 40px 0 14px; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-control); background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%237a7263' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 14px center; color: var(--navy); font: 600 var(--text-sm)/1 var(--font-sans); text-overflow: ellipsis; white-space: nowrap; appearance: none; cursor: pointer; }
	.pick select:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }

	.status { display: flex; align-items: center; gap: 16px; min-height: 32px; margin: 18px 0 14px; }
	.status p { margin: 0; color: var(--muted-foreground); font-size: var(--text-sm); }
	.status .clear, .empty button { padding: 0; border: 0; background: none; color: var(--navy); font: 700 var(--text-sm)/1.2 var(--font-sans); cursor: pointer; }
	.status .clear:hover, .empty button:hover { opacity: 0.7; }

	/* List / map: a two-way switch on screens too narrow for both side by side. */
	.view-switch { position: relative; display: none; flex: none; margin-left: auto; padding: 4px; border-radius: var(--radius-control); background: #ebe6da; }
	.view-switch :global(.glide-mark) { border-radius: 6px; background: #fff; box-shadow: 0 1px 4px rgb(20 18 15 / 0.14); }
	.view-switch button { position: relative; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; color: #5f584e; font: 600 var(--text-sm)/1 var(--font-sans); cursor: pointer; }
	.view-switch button[aria-pressed='true'] { color: var(--navy); }
	.view-switch button :global(svg) { width: 16px; height: 16px; }
	.view-switch button:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }

	.body { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 32px; align-items: start; }
	.list { display: grid; gap: 40px; min-width: 0; }
	.group { display: grid; gap: 16px; }
	.group-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
	.group-head h3 { margin: 0; font-size: var(--text-xl); font-weight: 600; letter-spacing: -0.02em; color: var(--navy); transition: color 0.2s ease; }
	.group-head p { margin: 4px 0 0; color: var(--muted-foreground); font-size: var(--text-sm); }
	/* The group whose pin is under the pointer. */
	.group.lit .group-head h3 { color: #8a6d00; }
	.group-head a { display: inline-flex; flex: none; align-items: center; gap: 6px; min-height: 32px; color: var(--navy); font-size: var(--text-sm); font-weight: 700; text-decoration: none; }
	.group-head a :global(svg) { width: 15px; height: 15px; transition: translate 0.2s ease; }
	.group-head a:hover :global(svg) { translate: 3px 0; }
	.group-head a:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; border-radius: 4px; }
	.cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin: 0; padding: 0; list-style: none; }
	.empty { padding: 40px 24px; border-radius: var(--radius-surface); background: #fff; text-align: center; box-shadow: 0 0 0 1px rgb(43 39 34 / 0.07); }
	.empty h3 { margin: 0; font-size: var(--text-lg); font-weight: 600; color: var(--navy); }
	.empty p { margin: 6px 0 16px; color: var(--muted-foreground); font-size: var(--text-sm); }

	.map-col { position: sticky; top: calc(var(--site-header-height) + 20px); }
	.map-stick { position: relative; height: min(calc(100svh - var(--site-header-height) - 40px), 760px); }

	/* The chosen place, over the foot of the map. */
	.map-card { position: absolute; right: 12px; bottom: 12px; left: 12px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; padding: 14px 10px 14px 16px; border-radius: var(--radius-surface); background: #fff; box-shadow: 0 18px 40px -18px rgb(20 18 15 / 0.45), 0 0 0 1px rgb(43 39 34 / 0.06); animation: card-in 0.22s cubic-bezier(0.22, 1, 0.36, 1); }
	.map-card-body { min-width: 0; }
	.map-card-body strong { display: block; overflow: hidden; color: var(--navy); font-size: var(--text-base); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
	.map-card-body p { margin: 2px 0 0; color: var(--muted-foreground); font-size: var(--text-sm); }
	.map-card-links { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; margin-top: 10px; }
	.map-card-links a, .to-list { display: inline-flex; align-items: center; gap: 5px; padding: 0; border: 0; background: none; color: var(--muted-foreground); font: 600 var(--text-sm)/1.3 var(--font-sans); text-decoration: none; cursor: pointer; }
	.map-card-links a:hover { color: var(--navy); }
	.to-list { display: none; height: 36px; padding: 0 12px; border-radius: var(--radius-control); background: var(--navy); color: #fff; }
	.to-list :global(svg) { width: 14px; height: 14px; }
	.map-card-close { align-self: start; display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 6px; background: transparent; color: var(--muted-foreground); cursor: pointer; }
	.map-card-close:hover { background: var(--secondary); color: var(--navy); }
	.map-card-close :global(svg) { width: 16px; height: 16px; }
	@keyframes card-in { from { opacity: 0; translate: 0 8px; } }

	@media (max-width: 1179px) {
		.view-switch { display: flex; }
		.body { grid-template-columns: minmax(0, 1fr); }
		.cards { grid-template-columns: repeat(3, minmax(0, 1fr)); }
		.map-col { display: none; position: static; }
		.body.map-view .list { display: none; }
		.body.map-view .map-col { display: block; }
		.map-stick { height: min(68svh, 620px); }
		.to-list { display: inline-flex; }
	}
	@media (max-width: 1023px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
	@media (max-width: 767px) { .controls { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .search { grid-column: 1 / -1; } }
	@media (max-width: 639px) {
		.explorer { margin-top: 20px; }
		.styles { margin-inline: -1rem; padding: 2px 1rem; }
		.list { gap: 28px; }
		.group { gap: 12px; }
		.group-head h3 { font-size: var(--text-lg); }
		.cards { grid-template-columns: minmax(0, 1fr); gap: 10px; }
		.map-stick { height: 64svh; margin-inline: -1rem; }
		.map-stick :global(.place-map) { border-radius: 0; }
	}
	@media (prefers-reduced-motion: reduce) { .styles a, .map-card { transition: none; animation: none; } }
</style>
