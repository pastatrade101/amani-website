<script lang="ts">
	import { ChevronLeft, ChevronRight, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { photoGroupLabel, type StayGalleryPhoto } from '$lib/stay-content';

	// Full-screen photo viewer: arrow keys, swipe, thumbnails from md, and focus
	// goes back to whatever opened it (Safari does not focus clicked buttons).
	let {
		photos,
		open = $bindable(false),
		index = $bindable(0),
		title,
		opener = null
	}: { photos: StayGalleryPhoto[]; open?: boolean; index?: number; title: string; opener?: HTMLElement | null } = $props();
	let count = $derived(photos.length);
	let current = $derived(Math.min(Math.max(index, 0), Math.max(count - 1, 0)));
	let photo = $derived(photos[current]);
	let group = $derived(photo ? photoGroupLabel(photo.category) : '');
	let strip = $state<HTMLDivElement>();
	let startX: number | null = null;

	const go = (step: number) => { if (count > 1) index = (current + step + count) % count; };

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
		if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
	}
	function onpointerup(event: PointerEvent) {
		if (startX === null) return;
		const distance = event.clientX - startX;
		startX = null;
		if (Math.abs(distance) > 50) go(distance < 0 ? 1 : -1);
	}

	// The neighbours load while this one is on screen, so stepping feels instant.
	$effect(() => {
		if (!open || count < 2) return;
		for (const step of [-1, 1]) new Image().src = photos[(current + step + count) % count].src;
	});

	// Keep the current thumbnail in view without scrolling anything else.
	$effect(() => {
		const thumb = open ? strip?.querySelector<HTMLElement>(`[data-index="${current}"]`) : null;
		if (!strip || !thumb) return;
		strip.scrollTo({ left: thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2 });
	});
</script>

{#snippet arrow(step: number, className: string)}
	<Button size="icon" aria-label={step < 0 ? 'Previous photo' : 'Next photo'} onclick={() => go(step)} class={`size-12 shrink-0 rounded-full bg-white/10 text-white hover:bg-white/20 ${className}`}>
		{#if step < 0}<ChevronLeft class="size-6" />{:else}<ChevronRight class="size-6" />{/if}
	</Button>
{/snippet}

<Dialog.Root bind:open>
	<Dialog.Content
		showCloseButton={false}
		{onkeydown}
		onCloseAutoFocus={(event) => { if (opener?.isConnected) { event.preventDefault(); opener.focus(); } }}
		class="grid h-[100dvh] w-screen max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-none border-0 bg-[oklch(.16_.03_252)] p-0 text-white ring-0 sm:max-w-none"
	>
		<div class="flex items-center gap-4 px-4 py-3 md:px-6">
			<Dialog.Title class="sr-only">{title} photos</Dialog.Title>
			<p aria-live="polite" aria-atomic="true" class="text-sm tabular-nums text-white/85"><span class="sr-only">Photo </span>{current + 1}<span aria-hidden="true"> / </span><span class="sr-only"> of </span>{count}</p>
			{#if group}<p class="text-[11px] font-medium uppercase tracking-[.16em] text-white/60">{group}</p>{/if}
			<Dialog.Close>
				{#snippet child({ props })}
					<Button variant="ghost" size="icon" class="ml-auto size-11 rounded-full text-white hover:bg-white/10 hover:text-white" {...props}><X class="size-5" /><span class="sr-only">Close photos</span></Button>
				{/snippet}
			</Dialog.Close>
		</div>

		<div role="presentation" class="relative flex min-h-0 touch-pan-y items-center justify-center px-4 md:px-24" onpointerdown={(event) => (startX = event.clientX)} {onpointerup} onpointercancel={() => (startX = null)}>
			{#if photo}
				{#key photo.src}<img src={photo.src} alt={photo.alt} decoding="async" draggable="false" class="lightbox-image size-full object-contain select-none" />{/key}
			{/if}
			{#if count > 1}
				{@render arrow(-1, 'absolute top-1/2 left-6 hidden -translate-y-1/2 md:inline-flex')}
				{@render arrow(1, 'absolute top-1/2 right-6 hidden -translate-y-1/2 md:inline-flex')}
			{/if}
		</div>

		<div class="grid gap-3 px-4 pt-3 pb-4 md:px-6 md:pb-5">
			<div class="flex items-center gap-3">
				{#if count > 1}{@render arrow(-1, 'md:hidden')}{/if}
				<Dialog.Description class="min-w-0 flex-1 text-center text-[13px] leading-5 text-white/75 md:text-left">{photo?.caption || photo?.alt}</Dialog.Description>
				{#if count > 1}{@render arrow(1, 'md:hidden')}{/if}
			</div>
			{#if count > 1}
				<div bind:this={strip} class="thumbs relative hidden gap-2 overflow-x-auto md:flex">
					{#each photos as item, i (item.id)}
						<button type="button" data-index={i} aria-label={`Show photo ${i + 1}`} aria-current={i === current ? 'true' : undefined} onclick={() => (index = i)} class={`h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 transition-opacity focus-visible:outline-white focus-visible:-outline-offset-2 ${i === current ? 'border-sun opacity-100' : 'border-transparent opacity-55 hover:opacity-90'}`}>
							<img src={item.src} alt="" loading="lazy" decoding="async" class="size-full object-cover" />
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>

<style>
	.lightbox-image { animation: photo-in 220ms ease-out; }
	@keyframes photo-in { from { opacity: 0; } }
	.thumbs { scrollbar-width: none; }
	.thumbs::-webkit-scrollbar { display: none; }
	@media (prefers-reduced-motion: reduce) { .lightbox-image { animation: none; } }
</style>
