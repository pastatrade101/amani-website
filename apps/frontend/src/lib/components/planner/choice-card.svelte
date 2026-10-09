<script lang="ts">
	import type { Snippet } from 'svelte';
	import { scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { Check } from '@lucide/svelte';
	import { prefersReducedMotion } from 'svelte/motion';

	/** One answer on the planner: a card that toggles, with a check badge when chosen. */
	let { selected, title, desc = '', meta = '', disabled = false, index = 0, class: className = '', onclick, children }: {
		selected: boolean; title: string; desc?: string; meta?: string; disabled?: boolean; index?: number; class?: string; onclick: () => void; children?: Snippet;
	} = $props();
</script>

<button type="button" aria-pressed={selected} {disabled} {onclick} style={`--i: ${index}`}
	class={`pm-rise relative min-h-14 rounded-xl border p-4 pr-10 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${selected ? 'border-sun bg-sun/15' : 'border-border bg-white hover:border-sun'} ${className}`}>
	{#if selected}<span class="absolute top-3 right-3 grid size-5 place-items-center rounded-full bg-navy text-white" in:scale={{ start: 0.3, duration: prefersReducedMotion.current ? 0 : 280, easing: backOut }}><Check class="size-3" strokeWidth={3} /></span>{/if}
	<span class="block text-sm font-semibold text-navy">{title}</span>
	{#if desc}<span class="mt-0.5 block text-xs leading-5 text-muted-foreground">{desc}</span>{/if}
	{#if meta}<span class="mt-2 block text-xs font-semibold text-[#2F6B3C]">{meta}</span>{/if}
	{@render children?.()}
</button>
