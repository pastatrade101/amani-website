<script lang="ts">
	import { onMount } from 'svelte';
	import { Maximize2 } from '@lucide/svelte';
	import 'maplibre-gl/dist/maplibre-gl.css';
	// MapLibre parses tiles in a web worker; Vite bundles it and hands back its URL.
	import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
	import { TANZANIA } from '$lib/safari-page';
	import type { Place } from '$lib/destination-explorer';

	// Every place on a real map (MapLibre on OpenFreeMap tiles, as on the safari
	// pages), pinned at its CMS coordinates. The list beside it drives the map:
	// hovering a place lights its pin, the filters frame what is shown, and a
	// pin opens that place. A drawn outline shows first and stays without WebGL.
	let { places, shown, hovered = $bindable(null), selected = $bindable(null) }: { places: Place[]; shown: Place[]; hovered?: string | null; selected?: string | null } = $props();

	type Pinned = Place & { lat: number; lng: number };
	let pinned = $derived(places.filter((place): place is Pinned => place.lat !== null && place.lng !== null));
	let visible = $derived(shown.filter((place): place is Pinned => place.lat !== null && place.lng !== null));

	let frame: HTMLDivElement;
	let ready = $state(false);
	let moved = $state(false);
	let live: import('maplibre-gl').Map | undefined;
	let frameTo: (items: Pinned[], animate: boolean) => void = () => {};

	// The drawn fallback: Tanzania's outline and the pins, framed on every place.
	const W = 400, H = 400;
	const mercator = (lng: number, lat: number): [number, number] => [(lng * Math.PI) / 180, -Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
	let sketch = $derived.by(() => {
		const outline = TANZANIA.map(([lng, lat]) => mercator(lng, lat));
		const all = [...outline, ...pinned.map((p) => mercator(p.lng, p.lat))];
		const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
		const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
		const scale = Math.min((W - 40) / (maxX - minX), (H - 40) / (maxY - minY));
		const ox = (W - (maxX - minX) * scale) / 2, oy = (H - (maxY - minY) * scale) / 2;
		const at = ([x, y]: [number, number]) => [Math.round(ox + (x - minX) * scale), Math.round(oy + (y - minY) * scale)];
		return { outline: `M${outline.map(at).map((p) => p.join(',')).join('L')}Z`, pins: pinned.map((p) => ({ id: p.id, at: at(mercator(p.lng, p.lat)) })) };
	});

	const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	// Light the hovered or selected pin.
	$effect(() => {
		const on = new Set([hovered, selected].filter(Boolean));
		if (!ready || !live) return;
		pinned.forEach((place, i) => live!.setFeatureState({ source: 'places', id: i }, { on: on.has(place.id) }));
	});

	// Show only the places the filters leave, and frame them.
	$effect(() => {
		const ids = new Set(visible.map((place) => place.id));
		if (!ready || !live) return;
		pinned.forEach((place, i) => live!.setFeatureState({ source: 'places', id: i }, { hidden: !ids.has(place.id) }));
		frameTo(visible.length ? visible : pinned, true);
	});

	// A pin chosen from the list (or the map) is brought into view.
	$effect(() => {
		const id = selected;
		if (!ready || !live || !id) return;
		const place = pinned.find((item) => item.id === id);
		if (place && !live.getBounds().contains([place.lng, place.lat])) live.easeTo({ center: [place.lng, place.lat], duration: reduceMotion() ? 0 : 600 });
	});

	export function showAll() {
		frameTo(visible.length ? visible : pinned, true);
	}

	onMount(() => {
		let map: import('maplibre-gl').Map | undefined;
		let cancelled = false;

		async function start() {
			if (!pinned.length) return;
			const maplibre = await import('maplibre-gl');
			if (cancelled) return;
			maplibre.setWorkerUrl(workerUrl);
			const box = (items: Pinned[]) => items.reduce((b, p) => b.extend([p.lng, p.lat]), new maplibre.LngLatBounds([items[0].lng, items[0].lat], [items[0].lng, items[0].lat]));
			const all = box(pinned);
			const padding = () => (frame.clientWidth < 480 ? { top: 60, bottom: 60, left: 44, right: 44 } : { top: 72, bottom: 72, left: 72, right: 72 });
			// The map can wander around the places, never off to another continent.
			const span = Math.max(all.getEast() - all.getWest(), all.getNorth() - all.getSouth(), 4);
			const fence = new maplibre.LngLatBounds([all.getWest() - span, all.getSouth() - span], [all.getEast() + span, all.getNorth() + span]);
			map = live = new maplibre.Map({
				container: frame.querySelector('.gl') as HTMLElement,
				style: 'https://tiles.openfreemap.org/styles/positron',
				bounds: all,
				fitBoundsOptions: { padding: padding(), maxZoom: 8 },
				maxBounds: fence,
				attributionControl: { compact: true },
				cooperativeGestures: true,
				dragRotate: false,
				pitchWithRotate: false,
				touchPitch: false,
				minZoom: 3,
				maxZoom: 13
			});
			map.touchZoomRotate.disableRotation();
			map.keyboard.disableRotation();
			map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

			frameTo = (items, animate) => {
				if (!map || !items.length) return;
				if (items.length === 1) map.easeTo({ center: [items[0].lng, items[0].lat], zoom: 8, duration: animate && !reduceMotion() ? 700 : 0 });
				else map.fitBounds(box(items), { padding: padding(), maxZoom: 8, duration: animate && !reduceMotion() ? 700 : 0 });
			};

			map.on('load', () => {
				if (!map) return;
				// Warm the neutral basemap toward the site's sand palette.
				const tint = [['background', 'background-color', '#f4f1e8'], ['water', 'fill-color', '#cfdcdc'], ['park', 'fill-color', '#dfe5cc']] as const;
				for (const [layer, property, value] of tint) if (map.getLayer(layer)) map.setPaintProperty(layer, property, value);

				map.addSource('places', {
					type: 'geojson',
					data: { type: 'FeatureCollection', features: pinned.map((place, i) => ({ type: 'Feature', id: i, properties: { i, name: place.name, safaris: place.safaris.count > 0 }, geometry: { type: 'Point', coordinates: [place.lng, place.lat] } })) }
				});
				const hidden = ['boolean', ['feature-state', 'hidden'], false];
				const on = ['boolean', ['feature-state', 'on'], false];
				map.addLayer({ id: 'place-halo', type: 'circle', source: 'places', paint: { 'circle-radius': ['case', on, 22, 0], 'circle-color': '#f6d21b', 'circle-opacity': ['case', hidden, 0, 0.35], 'circle-radius-transition': { duration: 220 } } as never });
				map.addLayer({ id: 'place-pin', type: 'circle', source: 'places', paint: { 'circle-radius': ['case', on, 10, 7.5], 'circle-color': ['case', hidden, '#b9b2a2', '#f6d21b'], 'circle-opacity': ['case', hidden, 0.45, 1], 'circle-stroke-color': ['case', hidden, '#ffffff', '#2b2722'], 'circle-stroke-width': ['case', on, 3, 2], 'circle-stroke-opacity': ['case', hidden, 0.6, 1], 'circle-radius-transition': { duration: 220 } } as never });
				map.addLayer({
					id: 'place-name', type: 'symbol', source: 'places',
					layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-max-width': 12, 'text-padding': 3, 'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 1.1, 'text-justify': 'auto' },
					paint: { 'text-color': '#2b2722', 'text-halo-color': '#ffffff', 'text-halo-width': 2, 'text-opacity': ['case', hidden, 0, 1] } as never
				});

				// A pin opens its place; hovering one lights its row in the list.
				map.on('click', 'place-pin', (event) => { const i = Number(event.features?.[0]?.properties?.i); if (Number.isInteger(i)) selected = pinned[i].id; });
				map.on('mousemove', 'place-pin', (event) => { map!.getCanvas().style.cursor = 'pointer'; const i = Number(event.features?.[0]?.properties?.i); if (Number.isInteger(i)) hovered = pinned[i].id; });
				map.on('mouseleave', 'place-pin', () => { map!.getCanvas().style.cursor = ''; hovered = null; });
				map.on('moveend', () => {
					if (!map) return;
					const view = map.getBounds();
					const items = visible.length ? visible : pinned;
					moved = !items.every((place) => view.contains([place.lng, place.lat]));
				});
				// Keep the credit as a small (i) button rather than a strip across the map.
				frame.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
				ready = true;
			});
		}

		const watch = new IntersectionObserver((entries) => {
			if (!entries.some((entry) => entry.isIntersecting)) return;
			watch.disconnect();
			start().catch(() => { ready = false; });
		}, { rootMargin: '400px' });
		watch.observe(frame);
		const resize = new ResizeObserver(() => map?.resize());
		resize.observe(frame);
		return () => { cancelled = true; watch.disconnect(); resize.disconnect(); map?.remove(); live = undefined; };
	});
</script>

<div class="place-map" bind:this={frame}>
	<div class="gl" aria-hidden="true"></div>
	<svg class="sketch" class:hidden={ready} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Map of ${pinned.length} places`}>
		<path d={sketch.outline} class="land" />
		{#each sketch.pins as pin (pin.id)}
			{@const off = !visible.some((place) => place.id === pin.id)}
			<circle cx={pin.at[0]} cy={pin.at[1]} r={hovered === pin.id || selected === pin.id ? 7 : 5} class="pin" class:off />
		{/each}
	</svg>
	{#if ready}<button type="button" class="show-all" class:moved onclick={showAll}><Maximize2 aria-hidden="true" />{visible.length && visible.length < pinned.length ? 'Show these places' : 'Show all places'}</button>{/if}
</div>

<style>
	.place-map { position: relative; overflow: hidden; width: 100%; height: 100%; min-height: 320px; border-radius: var(--radius-surface); background: #f4f1e8; box-shadow: inset 0 0 0 1px rgb(43 39 34 / 0.08); }
	.gl { position: absolute; inset: 0; }
	.sketch { position: absolute; inset: 0; width: 100%; height: 100%; background: #f4f1e8; transition: opacity 0.5s ease; }
	.sketch.hidden { opacity: 0; pointer-events: none; }
	.land { fill: #e0e2cf; stroke: #c6cab4; stroke-width: 1; stroke-linejoin: round; }
	.pin { fill: #f6d21b; stroke: #2b2722; stroke-width: 2; }
	.pin.off { fill: #c9c3b5; stroke: #fff; }
	.show-all { position: absolute; left: 12px; top: 12px; display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 0 12px; border: 1px solid rgb(43 39 34 / 0.12); border-radius: var(--radius-control); background: #fff; box-shadow: 0 1px 6px rgb(20 18 15 / 0.14); font: 600 var(--text-xs)/1 var(--font-sans); color: var(--navy); cursor: pointer; transition: background-color 0.2s, color 0.2s; }
	.show-all :global(svg) { width: 14px; height: 14px; }
	.show-all:hover, .show-all.moved { background: var(--navy); color: #fff; }
	.show-all:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }
	.place-map :global(.maplibregl-ctrl-group) { border-radius: var(--radius-control); box-shadow: 0 1px 6px rgb(20 18 15 / 0.16); }
	.place-map :global(.maplibregl-ctrl-attrib) { font-size: var(--text-xs); }
	@media (prefers-reduced-motion: reduce) { .sketch { transition: none; } }
</style>
