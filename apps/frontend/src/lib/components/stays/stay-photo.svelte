<script lang="ts">
	import { BedDouble, MapPin } from '@lucide/svelte';
	import { stayPhoto } from '$lib/stay-content';
	import type { Destination, Stay } from '$lib/types/api';

	// A stay's photo, or an honest stand-in: the landscape of its park with the
	// place named on it, or a branded placeholder. Never a stock photo posing as the property.
	let {
		stay,
		destination = null,
		loading = 'lazy',
		priority = false,
		note = '',
		srcset = '',
		sizes = '',
		class: className = ''
	}: { stay: Stay; destination?: Destination | null; loading?: 'lazy' | 'eager'; priority?: boolean; note?: string; srcset?: string; sizes?: string; class?: string } = $props();
	let photo = $derived(stayPhoto(stay, destination));
</script>

{#if photo.kind === 'own'}
	<!-- srcset describes the stay's own photo, so stand-ins never get it. -->
	<img src={photo.src} srcset={srcset || undefined} sizes={srcset && sizes ? sizes : undefined} alt={stay.name} {loading} decoding="async" fetchpriority={priority ? 'high' : undefined} width="640" height="400" class={`size-full object-cover ${className}`} />
{:else if photo.kind === 'place'}
	<!-- Described by the label below, which names the place. -->
	<img src={photo.src} alt="" {loading} decoding="async" fetchpriority={priority ? 'high' : undefined} width="640" height="400" class={`size-full object-cover ${className}`} />
	<span class="place-label"><MapPin class="size-3.5 shrink-0" aria-hidden="true" /><span><span class="sr-only">{'Photo of the area: '}</span>{photo.place}{#if note}<span class="place-note">{` · ${note}`}</span>{/if}</span></span>
{:else}
	<span class="stay-placeholder" role="img" aria-label={`${stay.name}: photos coming soon`}>
		<span class="placeholder-mark"><BedDouble class="size-6" strokeWidth={1.4} aria-hidden="true" /></span>
		<span class="placeholder-text" aria-hidden="true">Photos coming soon</span>
	</span>
{/if}

<style>
	/* Sits above the photo so nobody mistakes a park landscape for the rooms. */
	.place-label { position: absolute; left: 0.75rem; bottom: 0.75rem; z-index: 1; display: inline-flex; max-width: calc(100% - 1.5rem); align-items: flex-start; gap: 0.35rem; border-radius: 0.9rem; background: rgb(8 22 38 / 0.72); padding: 0.3rem 0.7rem; color: white; font-size: 11px; font-weight: 500; line-height: 1.3; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
	.place-label :global(svg) { margin-top: 0.05rem; color: var(--sun); }
	.place-note { color: rgb(255 255 255 / 0.75); font-weight: 400; }
	.stay-placeholder { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.85rem; overflow: hidden; background: radial-gradient(120% 90% at 50% 0%, oklch(0.38 0.07 252) 0%, var(--navy) 55%, oklch(0.22 0.05 252) 100%); color: white; }
	/* Faint contour rings, like a map of the plains. */
	.stay-placeholder::before { content: ''; position: absolute; inset: -40%; background: repeating-radial-gradient(circle at 70% 120%, transparent 0 22px, rgb(255 255 255 / 0.045) 22px 23px); }
	.placeholder-mark { position: relative; display: grid; width: 3.5rem; height: 3.5rem; place-items: center; border: 1.5px solid var(--sun); border-radius: 999px; color: var(--sun); }
	.placeholder-text { position: relative; font-size: 10px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgb(255 255 255 / 0.75); }
</style>
