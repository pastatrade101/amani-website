<script lang="ts">
	import { ArrowRight, BedDouble, UtensilsCrossed } from '@lucide/svelte';
	import { safeUrl, textContent } from '$lib/home-content';
	import { stayTypeLabel } from '$lib/stay-content';
	import { stayFor, stayHref } from '$lib/tour-itinerary';
	import type { SafariStyle } from '$lib/safari-pricing';
	import type { ItineraryDay } from '$lib/types/api';

	// A day's overnight and meals. A lodge with a public page gets a small card
	// (its own photo when it has one, never a stand-in); a draft or hidden lodge
	// and a property typed as free text keep a plain line with just the name.
	let {
		day,
		style,
		meals = '',
		badge = null
	}: {
		day: ItineraryDay;
		style: SafariStyle;
		meals?: string;
		/** The safari style the overnight belongs to, when the page offers several. */
		badge?: { color: string; name: string } | null;
	} = $props();

	let stay = $derived(stayFor(day, style));
	let lodge = $derived(stay?.lodge ?? null);
	let href = $derived(stayHref(day, style));
	let name = $derived((stay?.name ?? '').replace(/\s+or similar$/i, ''));
	let photo = $derived(
		[lodge?.image_url_thumbnail, lodge?.hero_image_url_thumbnail, lodge?.image_url, lodge?.hero_image_url]
			.map((url) => safeUrl(url ?? '', ''))
			.find((url) => url && !url.startsWith('#')) ?? ''
	);
	let meta = $derived([stayTypeLabel(lodge?.lodge_type), lodge?.park_area?.trim() || lodge?.region?.trim()].filter(Boolean).join(' · '));
	let excerpt = $derived(textContent(lodge?.short_description));
</script>

{#snippet label()}
	<p class="night-label"><BedDouble class="size-3.5" aria-hidden="true" />Overnight{#if badge}<span class="night-style"><span class="size-1.5 rounded-full" style={`background:${badge.color}`} aria-hidden="true"></span>{badge.name}</span>{/if}</p>
{/snippet}

<div class="overnight">
	{#if name && lodge && href}
		<div class={`night-card ${photo ? 'has-photo' : ''}`}>
			{#if photo}<div class="night-photo"><img src={photo} alt="" loading="lazy" decoding="async" /></div>{/if}
			<div class="night-body">
				{@render label()}
				<p class="night-name"><a {href} class="night-link">{name}</a><span class="night-similar">or similar</span></p>
				{#if meta}<p class="night-meta">{meta}</p>{/if}
				{#if excerpt}<p class="night-excerpt">{excerpt}</p>{/if}
				<span class="night-cta" aria-hidden="true">View the stay<ArrowRight class="size-3.5" /></span>
			</div>
		</div>
	{:else if name}
		<div class="night-line">
			{@render label()}
			<p class="night-name">{name}<span class="night-similar">or similar</span></p>
		</div>
	{/if}
	{#if meals}
		<p class="night-meals"><UtensilsCrossed class="size-3.5 shrink-0" aria-hidden="true" /><span class="night-meals-label">Meals</span>{meals}</p>
	{/if}
</div>

<style>
	.overnight { display: grid; gap: 0.75rem; margin-top: 1.25rem; }
	.night-card, .night-line { position: relative; border-radius: 1rem; background: color-mix(in oklch, var(--sun) 7%, white); box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--navy) 10%, transparent); }
	.night-card { display: grid; overflow: hidden; transition: box-shadow 200ms ease-out; }
	.night-card.has-photo { grid-template-columns: 6.5rem minmax(0, 1fr); }
	.night-card:hover { box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--navy) 22%, transparent), 0 14px 30px -24px rgb(15 35 55 / 0.45); }
	.night-photo { position: relative; min-height: 100%; background: var(--secondary); }
	.night-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: scale 450ms ease-out; }
	.night-card:hover .night-photo img { scale: 1.04; }
	.night-body { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; padding: 0.9rem 1rem 1rem; }
	.night-line { padding: 0.9rem 1rem; }
	.night-label { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-size: 10.5px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted-foreground); }
	.night-label :global(svg) { color: #D9A900; }
	.night-style { display: inline-flex; align-items: center; gap: 0.35rem; margin-left: 0.25rem; letter-spacing: 0.08em; }
	.night-name { margin-top: 0.35rem; font-family: var(--font-display); font-variant-numeric: lining-nums; font-size: 21px; font-weight: 500; line-height: 1.2; color: var(--navy); overflow-wrap: anywhere; }
	.night-similar { margin-left: 0.4rem; font-family: var(--font-sans); font-size: 12px; font-weight: 400; color: var(--muted-foreground); white-space: nowrap; }
	/* One link per card: the name covers it, and the whole card shows its focus
	   (browsers without :has() keep the link's own outline). */
	.night-link::after { content: ''; position: absolute; inset: 0; z-index: 1; }
	@supports selector(:has(*)) {
		.night-link:focus-visible { outline: none; }
		.night-card:has(.night-link:focus-visible) { outline: 3px solid var(--sun); outline-offset: 3px; }
	}
	/* Long area names wrap and stop at two lines in the narrow column beside a photo. */
	.night-meta { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; margin-top: 0.3rem; font-size: 11px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted-foreground); overflow-wrap: anywhere; }
	.night-excerpt { display: none; margin-top: 0.5rem; font-size: 13.5px; line-height: 1.7; color: color-mix(in oklch, var(--navy) 72%, transparent); }
	.night-cta { display: inline-flex; align-items: center; gap: 0.35rem; margin-top: 0.7rem; font-size: 13px; font-weight: 600; color: var(--navy); }
	.night-cta :global(svg) { transition: translate 180ms ease-out; }
	.night-card:hover .night-cta :global(svg) { translate: 3px 0; }
	.night-meals { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; padding: 0 0.25rem; font-size: 13.5px; font-weight: 500; color: var(--navy); }
	.night-meals :global(svg) { color: #D9A900; }
	.night-meals-label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted-foreground); }
	@media (min-width: 640px) {
		.night-card.has-photo { grid-template-columns: 13rem minmax(0, 1fr); }
		.night-photo { min-height: 10.5rem; }
		.night-body { padding: 1.15rem 1.35rem 1.2rem; }
		.night-line { padding: 1rem 1.35rem; }
		.night-name { font-size: 24px; }
		/* Two lines of the stay's own description once there is room for them. */
		.night-excerpt { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
	}
	@media (prefers-reduced-motion: reduce) {
		.night-photo img, .night-cta :global(svg) { transition: none; }
		.night-card:hover .night-photo img { scale: none; }
		.night-card:hover .night-cta :global(svg) { translate: none; }
	}
</style>
