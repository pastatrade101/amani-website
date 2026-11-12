<script lang="ts">
	import { onMount } from 'svelte';
	import { Maximize2 } from '@lucide/svelte';
	import 'maplibre-gl/dist/maplibre-gl.css';
	// MapLibre parses tiles in a web worker; Vite bundles it and hands back its URL.
	import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
	import { mapGeometry, routeLine, stopDays, type MapLeg, type MapStop } from '$lib/safari-page';

	// The tour's route on a real map (MapLibre GL JS on OpenFreeMap tiles):
	// each place a day is spent in, numbered in travel order and labelled with
	// its days, pinned at the destination's coordinates in the CMS. Flights are
	// dashed gold arcs, drives solid lines; a leg whose travel mode is not
	// recorded is a plain dotted line, never a guess.
	//
	// Built so nobody gets lost: the map can't be dragged far from the route or
	// zoomed out past it, "Whole route" always brings the full trip back, and
	// the numbered stops under the map fly to each place. The drawn SVG map
	// shows first (and stays when the browser has no WebGL).
	let { route, days, country, active = $bindable(null) }: { route: { stops: MapStop[]; legs: MapLeg[] }; days: number; country: string; active?: number | null } = $props();
	const ROLE = { start: 'Start', end: 'Finish', both: 'Start & finish' } as const;
	const caption = (stop: MapStop) => [stop.role ? ROLE[stop.role] : '', stopDays(stop.days)].filter(Boolean).join(' · ');

	let sketch = $derived(mapGeometry(route, 360, 280));
	let order = $derived(routeLine(route));
	let modes = $derived(new Set(route.legs.map((leg) => leg.mode)));
	let frame: HTMLDivElement;
	let ready = $state(false);
	let moved = $state(false);
	let showStop: (index: number) => void = () => {};
	let showRoute: () => void = () => {};
	let live: import('maplibre-gl').Map | undefined;

	/** Fly to a stop (the route list beside the map calls this). On a phone the map is brought into view first. */
	export function focusStop(index: number) {
		const box = frame?.getBoundingClientRect();
		if (box && (box.top < 0 || box.bottom > window.innerHeight)) frame.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
		if (ready) showStop(index);
		else active = index;
	}

	// Light the active stop's pin.
	$effect(() => {
		const current = active;
		if (!ready || !live) return;
		route.stops.forEach((_, i) => live!.setFeatureState({ source: 'stops', id: i }, { on: i === current }));
	});

	const STYLE = 'https://tiles.openfreemap.org/styles/positron';
	const LINE: Record<string, { color: string; width: number; dash?: number[] }> = {
		DRIVE: { color: '#4a3f2c', width: 2.75 },
		FLY: { color: '#a8860b', width: 2.5, dash: [2, 2] },
		BOAT: { color: '#3d6f86', width: 2.5, dash: [3, 2] },
		NONE: { color: '#8a8270', width: 2, dash: [0.4, 2.2] }
	};

	/** A gentle arc for flights, so they read as air and not as a road. */
	function arc(a: [number, number], b: [number, number]): [number, number][] {
		const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
		const control: [number, number] = [(a[0] + b[0]) / 2 - dy * 0.18, (a[1] + b[1]) / 2 + dx * 0.18];
		return Array.from({ length: 33 }, (_, i) => {
			const t = i / 32;
			return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * control[0] + t ** 2 * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * control[1] + t ** 2 * b[1]];
		});
	}

	onMount(() => {
		let map: import('maplibre-gl').Map | undefined;
		let cancelled = false;
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		async function start() {
			const maplibre = await import('maplibre-gl');
			if (cancelled) return;
			maplibre.setWorkerUrl(workerUrl);
			const points = route.stops.map((stop) => [stop.lng, stop.lat] as [number, number]);
			const bounds = points.reduce((box, point) => box.extend(point), new maplibre.LngLatBounds(points[0], points[0]));
			const padding = () => (frame.clientWidth < 480 ? { top: 56, bottom: 48, left: 70, right: 70 } : { top: 70, bottom: 60, left: 120, right: 120 });
			// The map may wander a little around the route, never off to another country.
			const spanX = Math.max(bounds.getEast() - bounds.getWest(), 1.2), spanY = Math.max(bounds.getNorth() - bounds.getSouth(), 1.2);
			const fence = new maplibre.LngLatBounds([bounds.getWest() - spanX, bounds.getSouth() - spanY], [bounds.getEast() + spanX, bounds.getNorth() + spanY]);
			map = live = new maplibre.Map({
				container: frame.querySelector('.gl') as HTMLElement,
				style: STYLE,
				bounds,
				fitBoundsOptions: { padding: padding(), maxZoom: 9 },
				maxBounds: fence,
				attributionControl: { compact: true },
				cooperativeGestures: true,
				dragRotate: false,
				pitchWithRotate: false,
				touchPitch: false,
				maxZoom: 12
			});
			map.touchZoomRotate.disableRotation();
			map.keyboard.disableRotation();
			map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

			const duration = reduceMotion ? 0 : 900;
			showRoute = () => { map?.fitBounds(bounds, { padding: padding(), maxZoom: 9, duration }); active = null; };
			// Zoom is held to a short range around the whole-route view: two steps in,
			// half a step out, so the route never shrinks away or blows up past recognition.
			let fitZoom = 7;
			showStop = (index) => { map?.flyTo({ center: points[index], zoom: fitZoom + 1.5, duration: reduceMotion ? 0 : 1100, essential: true }); active = index; };

			map.on('load', () => {
				if (!map) return;
				fitZoom = map.getZoom();
				map.setMinZoom(fitZoom - 0.5);
				map.setMaxZoom(fitZoom + 2);
				// Warm the neutral basemap toward the site's sand palette.
				const tint = [['background', 'background-color', '#f4f1e8'], ['water', 'fill-color', '#cfdcdc'], ['park', 'fill-color', '#dfe5cc']] as const;
				for (const [layer, property, value] of tint) if (map.getLayer(layer)) map.setPaintProperty(layer, property, value);

				map.addSource('route', {
					type: 'geojson',
					data: {
						type: 'FeatureCollection',
						features: route.legs.map((leg) => ({
							type: 'Feature',
							properties: { mode: leg.mode ?? 'NONE' },
							geometry: { type: 'LineString', coordinates: leg.mode === 'FLY' ? arc(points[leg.from], points[leg.to]) : [points[leg.from], points[leg.to]] }
						}))
					}
				});
				map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 6.5, 'line-opacity': 0.9 } });
				for (const [mode, line] of Object.entries(LINE)) {
					map.addLayer({ id: `route-${mode.toLowerCase()}`, type: 'line', source: 'route', filter: ['==', ['get', 'mode'], mode], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': line.color, 'line-width': line.width, ...(line.dash ? { 'line-dasharray': line.dash } : {}) } });
				}

				// Pins, numbers and names are map layers, so MapLibre keeps names from
				// colliding; names sit on the side facing the middle of the route so
				// none runs off the map. Each name carries its days underneath.
				const middle = (bounds.getWest() + bounds.getEast()) / 2;
				map.addSource('stops', {
					type: 'geojson',
					data: { type: 'FeatureCollection', features: route.stops.map((stop, i) => ({ type: 'Feature', id: i, properties: { i, n: stop.days.length && stop.n ? String(stop.n) : '', dayStop: stop.days.length > 0, name: stop.name, days: caption(stop), order: route.stops.length - i, side: stop.lng > middle ? 'left' : 'right' }, geometry: { type: 'Point', coordinates: points[i] } })) }
				});
				map.addLayer({ id: 'stop-halo', type: 'circle', source: 'stops', paint: { 'circle-radius': ['case', ['boolean', ['feature-state', 'on'], false], 20, 0], 'circle-color': '#f6d21b', 'circle-opacity': 0.3, 'circle-radius-transition': { duration: 250 } } });
				map.addLayer({ id: 'stop-pin', type: 'circle', source: 'stops', layout: { 'circle-sort-key': ['get', 'order'] }, paint: { 'circle-radius': ['case', ['boolean', ['feature-state', 'on'], false], 13, ['get', 'dayStop'], 11, 8], 'circle-color': ['case', ['get', 'dayStop'], '#f6d21b', '#2b2722'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 } });
				map.addLayer({ id: 'stop-number', type: 'symbol', source: 'stops', layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-allow-overlap': true, 'text-ignore-placement': true, 'symbol-sort-key': ['get', 'order'] }, paint: { 'text-color': '#2b2722' } });
				map.addLayer({
					id: 'stop-name', type: 'symbol', source: 'stops',
					layout: {
						'text-field': ['format', ['get', 'name'], {}, '\n', {}, ['get', 'days'], { 'font-scale': 0.85, 'text-font': ['literal', ['Noto Sans Regular']] }],
						'text-font': ['Noto Sans Bold'], 'text-size': 12.5, 'text-line-height': 1.25, 'text-max-width': 18, 'text-padding': 4, 'text-justify': 'auto',
						'text-variable-anchor-offset': ['match', ['get', 'side'], 'left', ['literal', ['right', [-1.4, 0], 'bottom-right', [-1, -1], 'top-right', [-1, 1], 'bottom', [0, -1.4], 'top', [0, 1.4], 'left', [1.4, 0]]], ['literal', ['left', [1.4, 0], 'bottom-left', [1, -1], 'top-left', [1, 1], 'bottom', [0, -1.4], 'top', [0, 1.4], 'right', [-1.4, 0]]]]
					},
					paint: { 'text-color': '#2b2722', 'text-halo-color': '#ffffff', 'text-halo-width': 2, 'text-halo-blur': 0.5 }
				});

				// Tapping a pin goes to it, just like the numbered list below.
				map.on('click', 'stop-pin', (event) => { const i = Number(event.features?.[0]?.properties?.i); if (Number.isInteger(i)) showStop(i); });
				map.on('mouseenter', 'stop-pin', () => { map!.getCanvas().style.cursor = 'pointer'; });
				map.on('mouseleave', 'stop-pin', () => { map!.getCanvas().style.cursor = ''; });
				// "Whole route" lights up as soon as the visitor has moved away from it.
				map.on('moveend', () => {
					if (!map) return;
					const view = map.getBounds();
					moved = !points.every((point) => view.contains(point)) || map.getZoom() > map.cameraForBounds(bounds, { padding: padding(), maxZoom: 9 })!.zoom! + 0.6;
				});
				// Keep the credit as a small (i) button rather than a strip across the route.
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

		return () => { cancelled = true; watch.disconnect(); resize.disconnect(); map?.remove(); };
	});
</script>

<figure class="route-map" aria-labelledby="route-map-title">
	<div class="map-top"><span id="route-map-title">Your safari route</span>{#if days > 0 || country}<span>{[days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}` : '', country].filter(Boolean).join(' · ')}</span>{/if}</div>
	<div class="map-frame" bind:this={frame}>
		<div class="gl" aria-hidden="true"></div>
		<svg class="map-sketch" class:hidden={ready} viewBox={`0 0 ${sketch.width} ${sketch.height}`} role="img" aria-label={`Route map: ${order.join(', then ')}`}>
			<path d={sketch.outline} fill="#dfe2cf" stroke="#c4cab5" stroke-width="1" />
			{#if sketch.countryLabel}<text x={sketch.countryLabel.x} y={sketch.countryLabel.y} class="country">TANZANIA</text>{/if}
			{#each sketch.legs as leg, i (i)}
				<path d={leg.d} fill="none" class={`leg ${leg.mode ? leg.mode.toLowerCase() : 'unstated'}`} />
			{/each}
			{#each sketch.points as point (point.name)}
				<circle cx={point.x} cy={point.y} r="5" fill="#ffcc00" stroke="#414f39" stroke-width="1.5" />
				<text x={point.labelX} y={point.labelY} text-anchor={point.anchor} class="stop">{point.name}</text>
			{/each}
		</svg>
		{#if ready}<button type="button" class="whole-route" class:moved onclick={() => showRoute()}><Maximize2 />Whole route</button>{/if}
	</div>
	{#if modes.size}
		<div class="map-legend">
			{#if modes.has('FLY')}<span><i class="dash"></i>Flight</span>{/if}
			{#if modes.has('DRIVE')}<span><i class="solid"></i>Game drive / road</span>{/if}
			{#if modes.has('BOAT')}<span><i class="boat"></i>Boat</span>{/if}
			{#if modes.has(null)}<span><i class="dotted"></i>Route</span>{/if}
		</div>
	{/if}
	<figcaption>
		<small class="map-source">{ready ? 'Tap a pin or a stop in the route to zoom in. Positions approximate.' : 'Map outline: Natural Earth · Positions approximate'}</small>
	</figcaption>
</figure>

<style>
	.route-map { margin: 0; padding: 20px; overflow: hidden; border: 1px solid var(--sp-line); border-radius: var(--radius-surface); background: #f4f1e8; }
	.map-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; font-size: 14px; font-weight: 600; }
	.map-top span:last-child { font-size: 13px; font-weight: 600; color: var(--sp-kicker); }
	.map-frame { position: relative; overflow: hidden; aspect-ratio: 4 / 3.4; min-height: 320px; max-height: 480px; border-radius: var(--radius-control); background: #ebe7da; }
	.gl { position: absolute; inset: 0; }
	.map-sketch { position: absolute; inset: 0; width: 100%; height: 100%; background: #f4f1e8; transition: opacity 0.5s ease; }
	.map-sketch.hidden { opacity: 0; pointer-events: none; }
	.country { fill: #8a8270; font-size: 11px; font-weight: 600; letter-spacing: 2px; text-anchor: middle; font-family: var(--sp-sans); }
	.stop { fill: #2b2722; font-size: 10px; font-weight: 500; font-family: var(--sp-sans); paint-order: stroke; stroke: #f4f1e8d9; stroke-width: 3px; stroke-linejoin: round; }
	.leg { stroke-linecap: round; }
	.leg.fly { stroke: #9b8000; stroke-width: 1.8; stroke-dasharray: 4 4; }
	.leg.drive { stroke: #4a443a; stroke-width: 2.5; }
	.leg.boat { stroke: #3d6f86; stroke-width: 2; stroke-dasharray: 8 4; }
	.leg.unstated { stroke: #9a927f; stroke-width: 1.6; stroke-dasharray: 1 4; }
	.whole-route { position: absolute; left: 10px; top: 10px; display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 7px 12px; border: 1px solid rgb(43 39 34 / 0.12); border-radius: var(--radius-control); background: #fff; box-shadow: 0 1px 6px rgb(20 18 15 / 0.14); font: 600 12px/1 var(--sp-sans); color: #2b2722; cursor: pointer; transition: background 0.2s, color 0.2s; }
	.whole-route :global(svg) { width: 14px; height: 14px; }
	.whole-route:hover, .whole-route.moved { background: #2b2722; color: #fff; }
	.whole-route:focus-visible { outline: 2px solid var(--sp-sun, #f6d21b); outline-offset: 2px; }
	.map-frame :global(.maplibregl-ctrl-group) { border-radius: var(--radius-control); box-shadow: 0 1px 6px rgb(20 18 15 / 0.16); }
	.map-frame :global(.maplibregl-ctrl-attrib) { font-size: 11px; }
	.map-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 18px; margin-top: 14px; font-size: 12px; color: var(--sp-muted); }
	.map-legend span { display: flex; align-items: center; gap: 7px; }
	.map-legend i { width: 22px; border-top: 2px solid #4a443a; }
	.map-legend .dash { border-top: 2px dashed #a8860b; }
	.map-legend .boat { border-top: 2px dashed #3d6f86; }
	.map-legend .dotted { border-top: 2px dotted #9a927f; }
	.map-source { display: block; margin-top: 10px; font-size: 12px; color: var(--sp-muted); }
</style>
