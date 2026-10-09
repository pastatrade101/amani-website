<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fly, scale } from 'svelte/transition';
	import { backOut, cubicOut, quintOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { ArrowRight, Check } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	/** The final screen: what was sent, the reference, and where to go next. */
	let { reference, recap }: { reference: string; recap: { label: string; value: string }[] } = $props();
	const ms = (n: number) => (prefersReducedMotion.current ? 0 : n);
	let heading = $state<HTMLElement>();
	onMount(async () => {
		await tick();
		window.scrollTo({ top: 0, behavior: prefersReducedMotion.current ? 'auto' : 'smooth' });
		heading?.focus({ preventScroll: true });
	});
</script>

<section class="bg-secondary/70 px-4 py-14 md:py-20" data-conversion="lead-submitted">
	<div class="mx-auto max-w-xl rounded-2xl border border-border bg-white p-6 text-center shadow-[0_20px_60px_-30px_rgba(16,45,65,.2)] md:p-10" in:fly={{ y: 24, duration: ms(560), easing: quintOut }}>
		<span class="relative mx-auto grid size-14 place-items-center" in:scale={{ start: 0.3, duration: ms(560), delay: ms(160), easing: backOut }}>
			<span class="pm-burst absolute inset-0 rounded-full" aria-hidden="true"></span>
			<span class="relative grid size-14 place-items-center rounded-full bg-sun/25 text-navy"><Check class="pm-tick size-7" strokeWidth={2.4} /></span>
		</span>
		<h2 bind:this={heading} tabindex="-1" class="lux-heading mt-5 !text-3xl outline-none md:!text-4xl">Thank you, your plan is on its way</h2>
		<p class="mt-3 text-sm leading-7 text-muted-foreground">Our team will read your answers and come back to you with ideas and a personalised proposal.</p>
		<p class="mt-2 text-sm text-muted-foreground">Your reference is <b class="text-navy">{reference}</b>.</p>
		{#if recap.length}
			<dl class="mt-6 divide-y divide-border rounded-xl border border-border text-left">
				{#each recap as row, i (row.label)}
					<div class="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-3 px-4 py-2.5 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]" in:fly|global={{ y: 10, duration: ms(420), delay: ms(480 + i * 80), easing: cubicOut }}>
						<dt class="text-muted-foreground">{row.label}</dt>
						<dd class="break-words text-navy">{row.value}</dd>
					</div>
				{/each}
			</dl>
		{/if}
		<div class="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
			<Button variant="safari" href="/" class="h-12 px-6">Back to home</Button>
			<Button variant="outline" href="/tours" class="h-12 px-6">Browse safaris <ArrowRight class="size-4" /></Button>
		</div>
	</div>
</section>
