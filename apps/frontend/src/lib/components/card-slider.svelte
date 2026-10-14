<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	// A row of cards that is the section's own grid from 768px up (pass its grid
	// classes) and, on phones, one card at a time with the next peeking in,
	// swiped sideways, with dots underneath.
	let {
		items,
		card,
		label,
		key,
		class: gridClass = ''
	}: { items: T[]; card: Snippet<[T, number]>; label: string; key?: (item: T, index: number) => string; class?: string } = $props();

	let track = $state<HTMLUListElement>();
	let active = $state(0);

	function syncDots() {
		if (!track) return;
		const first = track.children[0] as HTMLElement | undefined;
		const step = first ? first.getBoundingClientRect().width + 16 : 1;
		active = Math.min(items.length - 1, Math.max(0, Math.round(track.scrollLeft / step)));
	}
	function show(index: number) {
		const item = track?.children[index] as HTMLElement | undefined;
		if (!track || !item) return;
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		track.scrollTo({ left: item.offsetLeft - track.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
	}
</script>

<div class="card-slider">
	<ul bind:this={track} onscroll={syncDots} class={`slider-track ${gridClass}`} aria-label={label}>
		{#each items as item, i (key ? key(item, i) : i)}
			<li class="slider-item">{@render card(item, i)}</li>
		{/each}
	</ul>
	{#if items.length > 1}
		<div class="slider-dots" aria-label={`Choose from ${label.toLowerCase()}`}>
			{#each items as _, i}
				<button type="button" class:on={i === active} aria-label={`Show ${i + 1} of ${items.length}`} aria-current={i === active ? 'true' : undefined} onclick={() => show(i)}></button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.slider-track { margin: 0; padding: 0; list-style: none; }
	.slider-item { display: flex; flex-direction: column; min-width: 0; }
	.slider-dots { display: none; justify-content: center; gap: 8px; margin-top: 18px; }
	.slider-dots button { width: 8px; height: 8px; padding: 0; border: 0; border-radius: 999px; background: #d7dde0; cursor: pointer; transition: background-color 0.2s ease; }
	.slider-dots button.on { background: var(--sun); }
	@media (max-width: 767px) {
		/* Runs edge to edge of the screen; --slider-bleed is the page's side padding. */
		.card-slider .slider-track { --bleed: var(--slider-bleed, 16px); display: flex; gap: 16px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline: var(--bleed); margin-inline: calc(var(--bleed) * -1); padding: 4px var(--bleed) 8px; scrollbar-width: none; }
		.card-slider .slider-track::-webkit-scrollbar { display: none; }
		.card-slider .slider-item { flex: 0 0 84%; scroll-snap-align: start; }
		.slider-dots { display: flex; }
	}
</style>
