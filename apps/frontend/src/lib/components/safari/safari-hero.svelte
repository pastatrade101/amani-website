<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowDown, Check, Heart, Images, Link, Mail, Share2 } from '@lucide/svelte';
	import * as Popover from '$lib/components/ui/popover';
	import { savedTours } from '$lib/saved-tours.svelte';
	import { durationLabel } from '$lib/tour-itinerary';
	import { destinationCount, heroEyebrow } from '$lib/safari-page';
	import type { TourPhoto } from '$lib/safari-page';
	import type { TourDetail } from '$lib/types/api';

	// The photo hero: the tour's photos crossfading behind its country and kind
	// of safari, the title, then how many places, how long and the lowest
	// per-person price. The strip of photos under the hero picks the slide.
	let { tour, image, from, slides = [], slide = 0, photoCount = 0, onPhotos }: { tour: TourDetail; image: string; from: { amount: number; currency: string } | null; slides?: TourPhoto[]; slide?: number; photoCount?: number; onPhotos?: (index: number) => void } = $props();
	let frames = $derived(slides.length ? slides : [{ id: '0', src: image, thumb: image, alt: '', caption: '', category: '' }]);
	let current = $derived(slide < frames.length ? slide : 0);

	let eyebrow = $derived(heroEyebrow(tour));
	let places = $derived(destinationCount(tour));
	let days = $derived(Math.round(Number(tour.duration_days) || 0));
	let saved = $derived(savedTours.has(tour.slug));
	let shareOpen = $state(false), copied = $state(false), pageUrl = $state('');
	onMount(() => { savedTours.load(); pageUrl = window.location.href.split('#')[0]; });
	const toggleSaved = () => savedTours.toggle({ slug: tour.slug, title: tour.title, image, duration: durationLabel(tour.duration_days, tour.duration_nights) });
	async function copy() { try { await navigator.clipboard.writeText(pageUrl); copied = true; } catch { copied = false; } }
</script>

<section id="safari-hero" class="hero" aria-labelledby="safari-title">
	{#each frames as photo, i (photo.src)}
		<img class="photo" class:on={i === current} src={photo.src} alt="" fetchpriority={i === 0 ? 'high' : 'auto'} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" width="1600" height="900" />
	{/each}
	<div class="veil" aria-hidden="true"></div>
	<div class="tools">
		{#if onPhotos && photoCount > 1}<button type="button" class="tool" onclick={() => onPhotos(current)}><Images />{photoCount} photos</button>{/if}
		<button type="button" class="tool" aria-pressed={saved} aria-label={saved ? 'Remove safari from saved' : 'Save this safari'} onclick={toggleSaved}><Heart class={saved ? 'fill-current' : ''} />{saved ? 'Saved' : 'Save'}</button>
		<Popover.Root bind:open={shareOpen}>
			<Popover.Trigger class="tool" aria-label="Share this safari"><Share2 />Share</Popover.Trigger>
			<Popover.Content align="end" class="w-60 p-2">
				<a class="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-secondary" href={`https://wa.me/?text=${encodeURIComponent(`${tour.title} ${pageUrl}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
				<a class="flex items-center gap-3 rounded-lg p-3 text-sm hover:bg-secondary" href={`mailto:?subject=${encodeURIComponent(tour.title)}&body=${encodeURIComponent(pageUrl)}`}><Mail class="size-4" />Email</a>
				<button type="button" class="flex w-full items-center gap-3 rounded-lg p-3 text-sm hover:bg-secondary" onclick={copy}>{#if copied}<Check class="size-4" />Link copied{:else}<Link class="size-4" />Copy link{/if}</button>
			</Popover.Content>
		</Popover.Root>
	</div>
	<div class="content">
		{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
		<h1 id="safari-title">{tour.title}</h1>
		<dl class="facts">
			{#if places > 0}<div><dt class="label">Destinations</dt><dd class="value">{places} {places === 1 ? 'destination' : 'destinations'}</dd></div>{/if}
			{#if days > 0}<div><dt class="label">Duration</dt><dd class="value">{days} {days === 1 ? 'day' : 'days'}</dd></div>{/if}
			<div class="price">
				<dt class="sr-only">Price</dt>
				{#if from}
					<dd><span class="currency">{from.currency}</span><span class="amount">{Math.round(from.amount).toLocaleString('en-US')}</span><small>From price, per person</small></dd>
				{:else}
					<dd><span class="amount on-request">On request</span><small>Priced for your dates and group</small></dd>
				{/if}
			</div>
		</dl>
	</div>
	<a class="scroll" href="#overview">Explore the journey <ArrowDown /></a>
</section>

<style>
	.hero { position: relative; isolation: isolate; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; min-height: min(640px, 78vh); background: #36312b; color: #fff; }
	.photo { position: absolute; inset: 0; z-index: -3; width: 100%; height: 100%; object-fit: cover; object-position: center; opacity: 0; transition: opacity 1.2s ease; }
	/* The photo on screen fades in and settles from a slight zoom. */
	.photo.on { opacity: 1; animation: settle 8s cubic-bezier(0.22, 1, 0.36, 1) both; }
	@keyframes settle { from { transform: scale(1.07); } to { transform: scale(1); } }
	@media (prefers-reduced-motion: reduce) { .photo { transition-duration: 0.01s; } .photo.on { animation: none; } }
	.veil { position: absolute; inset: 0; z-index: -2; background: linear-gradient(180deg, rgb(20 18 15 / 0.5) 0%, rgb(20 18 15 / 0) 22%), linear-gradient(0deg, rgb(20 18 15 / 0.92) 0%, rgb(20 18 15 / 0.64) 40%, rgb(20 18 15 / 0.14) 78%), linear-gradient(90deg, rgb(20 18 15 / 0.5) 0%, rgb(20 18 15 / 0) 60%); }
	.tools { position: absolute; top: 24px; right: var(--sp-gutter); display: flex; gap: 10px; }
	.tools :global(.tool) { display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 9px 16px; border: 1px solid #ffffff40; border-radius: var(--radius-control); background: #1b1916b3; color: #fff; font: 600 13px var(--sp-sans); cursor: pointer; backdrop-filter: blur(6px); }
	.tools :global(.tool svg) { width: 16px; height: 16px; }
	.tools :global(.tool[aria-pressed='true'] svg) { color: var(--sp-sun); }
	.content { max-width: calc(900px + var(--sp-gutter)); padding: 0 var(--sp-gutter) 56px; }
	.eyebrow { display: flex; align-items: center; gap: 14px; margin: 0 0 18px; font-size: 12px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: var(--sp-sun); text-shadow: 0 1px 8px rgba(20, 18, 15, 0.55); }
	.eyebrow::before { content: ''; flex: none; width: 32px; height: 1px; background: currentColor; }
	h1 { max-width: 18ch; margin: 0; font-family: var(--sp-display); font-size: clamp(36px, 4.4vw, 60px); line-height: 1.06; text-wrap: balance; }
	.facts { display: flex; flex-wrap: wrap; align-items: center; gap: 24px 44px; margin: 30px 0 0; }
	.facts dd { margin: 0; }
	.label { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #ffffffb8; }
	.value { font-size: 20px; font-weight: 600; }
	.price { padding-left: 44px; border-left: 1px solid #ffffff45; }
	.price .currency { margin-right: 8px; font-size: 13px; font-weight: 600; }
	.price .amount { font-size: 36px; font-weight: 650; line-height: 1; letter-spacing: -0.02em; color: var(--sp-sun); }
	.price .amount.on-request { font-size: 26px; }
	.price small { display: block; margin-top: 8px; font-size: 12px; color: #ffffffb8; }
	.scroll { position: absolute; right: var(--sp-gutter); bottom: 60px; display: flex; align-items: center; gap: 10px; color: #ffffffd9; font-size: 12px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; text-decoration: none; }
	.scroll :global(svg) { width: 16px; height: 16px; }
	@media (max-width: 900px) { .scroll { display: none; } }
	@media (max-width: 767px) {
		.hero { min-height: 540px; }
		.veil { background: linear-gradient(180deg, rgb(20 18 15 / 0.5) 0%, rgb(20 18 15 / 0) 20%), linear-gradient(0deg, rgb(20 18 15 / 0.94) 0%, rgb(20 18 15 / 0.74) 50%, rgb(20 18 15 / 0.22) 86%); }
		.photo { object-position: 52% center; }
		.tools { top: 16px; }
		.content { padding-bottom: 40px; }
		.facts { gap: 18px 28px; }
		.value { font-size: 18px; }
		.price { padding-left: 0; border: 0; }
		.price .amount { font-size: 32px; }
	}
</style>
