<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { rail, steer } from '$lib/motion/rail';

	// A row of cards that is the section's own grid from 768px up (pass its grid
	// classes) and, on phones, an app rail: the card in view rests in the middle,
	// its neighbours peek in either side and sit back a little in step with the
	// finger (use:rail), with dots underneath.
	let {
		items,
		card,
		label,
		key,
		class: gridClass = ''
	}: { items: T[]; card: Snippet<[T, number]>; label: string; key?: (item: T, index: number) => string; class?: string } = $props();

	let track = $state<HTMLUListElement>();
	let active = $state(0);

	const show = (index: number) => steer(track, index);
</script>

<div class="card-slider">
	<ul bind:this={track} class={`slider-track ${gridClass}`} aria-label={label} use:rail={{ onIndex: (i) => (active = i) }}>
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
	.slider-dots button { width: 8px; height: 8px; padding: 0; border: 0; border-radius: 999px; background: #dcd7cc; cursor: pointer; transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.3s ease; }
	.slider-dots button.on { width: 22px; background: var(--navy); }
	@media (max-width: 767px) {
		/* Runs edge to edge of the screen, whatever the page's side padding. */
		.card-slider .slider-track { --card: min(80vw, 380px); display: flex; gap: 10px; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory; margin-inline: calc(50% - 50vw); padding: 6px calc((100vw - var(--card)) / 2) 10px; scrollbar-width: none; }
		.card-slider .slider-track::-webkit-scrollbar { display: none; }
		.card-slider .slider-item { flex: 0 0 var(--card); scroll-snap-align: center; scroll-snap-stop: always; scale: calc(1 - var(--rail-abs, 0) * 0.05); }
		.slider-dots { display: flex; }
	}
	@media (max-width: 767px) and (prefers-reduced-motion: reduce) {
		.card-slider .slider-item { scale: none; }
		.slider-dots button { transition: none; }
	}
</style>
