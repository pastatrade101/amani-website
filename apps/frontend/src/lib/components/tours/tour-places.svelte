<script lang="ts">
	import { ArrowDown } from '@lucide/svelte';
	import DestinationCard from '$lib/components/destinations/destination-card.svelte';
	import { rail } from '$lib/motion/rail';
	import type { Destination } from '$lib/types/api';

	// The places on the safaris above, most visited first. Each opens its
	// guide, and "Show its safaris" narrows the list to it.
	let { places, filtered, total, onShow }: { places: { destination: Destination; count: number }[]; filtered: boolean; total: number; onShow: (id: string) => void } = $props();
	const plural = (count: number) => `${count} ${count === 1 ? 'safari' : 'safaris'}`;
</script>

<section class="places" aria-labelledby="places-title">
	<div class="page-container">
		<div class="head" data-motion="reveal">
			<h2 id="places-title" class="section-heading">{filtered ? 'Where these safaris go' : 'Where our safaris go'}</h2>
			<p class="section-description">Open a place to see what it is like, then come back to the safaris that visit it.</p>
		</div>
		<ul class="row" use:rail>
			{#each places as { destination, count } (destination.id)}
				<li>
					<DestinationCard {destination} />
					<div class="meta">
						<span>{filtered ? `On ${count} of these` : `On ${plural(count)}`}</span>
						{#if count < total}<button type="button" onclick={() => onShow(destination.id)}>Show its safaris<ArrowDown class="size-3.5" aria-hidden="true" /></button>{/if}
					</div>
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.places { padding-block: 56px; background: #fff; border-top: 1px solid var(--border); }
	.head { max-width: 640px; }
	.head p { margin: 12px 0 0; }
	/* Phones: a centred swipe rail. */
	.row { --card: min(74vw, 300px); display: flex; gap: 12px; margin: 26px calc(50% - 50vw) 0; padding: 4px calc((100vw - var(--card)) / 2) 8px; list-style: none; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory; scrollbar-width: none; }
	.row::-webkit-scrollbar { display: none; }
	li { flex: none; width: var(--card); min-width: 0; scroll-snap-align: center; scale: calc(1 - var(--rail-abs, 0) * 0.04); opacity: calc(1 - var(--rail-abs, 0) * 0.25); }
	.meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 44px; margin-top: 8px; color: var(--muted-foreground); font-size: var(--text-sm); }
	.meta button { display: inline-flex; align-items: center; gap: 5px; min-height: 40px; color: var(--navy); font-size: var(--text-sm); font-weight: 600; white-space: nowrap; }
	.meta button:hover { color: #7a5a26; }
	@media (min-width: 768px) {
		.places { padding-block: 72px; }
		.row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; margin: 34px 0 0; padding: 0; overflow: visible; scroll-snap-type: none; }
		li { width: auto; scale: none; opacity: 1; }
	}
	@media (min-width: 1100px) { .row { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
</style>
