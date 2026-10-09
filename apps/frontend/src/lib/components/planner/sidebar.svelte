<script lang="ts" module>
	import { Sparkles } from '@lucide/svelte';
	export type SoFarRow = { key: string; icon: typeof Sparkles; label: string; value: string; chips: string[] };
</script>

<script lang="ts">
	import { fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { cubicOut, quintOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { Check, ChevronDown, Lightbulb, MessageCircle } from '@lucide/svelte';
	import { safeUrl } from '$lib/home-content';
	import { usd } from '$lib/planner/options';
	import type { Recommendation } from '$lib/planner/planner';

	/** The planner's running commentary: the answers so far, tips, and trips that fit. */
	let { rows, tips, recs, step, total, chosen }: { rows: SoFarRow[]; tips: string[]; recs: Recommendation[]; step: number; total: number; chosen: boolean } = $props();
	const ms = (n: number) => (prefersReducedMotion.current ? 0 : n);
	// Phones: the panels fold away under the form.
	let openSummary = $state(false);
	let openMatches = $state(false);
</script>

<aside class="grid min-w-0 content-start gap-4 lg:sticky lg:top-[calc(var(--site-header-height,88px)+24px)] lg:self-start" aria-label="Your trip so far">
	<div class="overflow-hidden rounded-2xl bg-navy text-white shadow-[0_18px_40px_-24px_rgba(16,45,65,.6)]">
		<button type="button" class="flex min-h-12 w-full items-center justify-between px-5 lg:hidden" aria-expanded={openSummary} onclick={() => (openSummary = !openSummary)}>
			<span class="flex items-center gap-2 text-[11px] font-bold tracking-[.16em] text-sun uppercase"><Sparkles class="size-3.5" />Your trip so far</span>
			<span class="flex items-center gap-2 text-[11px] font-semibold text-white/60">{step + 1}/{total}<ChevronDown class={`size-4 transition ${openSummary ? 'rotate-180' : ''}`} /></span>
		</button>
		<div class={`${openSummary ? 'block' : 'hidden'} lg:block`}>
			<div class="hidden items-center justify-between px-5 pt-5 lg:flex">
				<p class="flex items-center gap-2 text-[11px] font-bold tracking-[.16em] text-sun uppercase"><Sparkles class="size-3.5" />Your trip so far</p>
				<span class="text-[11px] font-semibold text-white/55 tabular-nums">{step + 1}/{total}</span>
			</div>
			{#if rows.length}
				<ul class="mt-1 px-2 pb-2 lg:mt-3">
					{#each rows as row (row.key)}
						<li class="flex items-start gap-3 rounded-xl px-3 py-2.5" animate:flip={{ duration: ms(320), easing: cubicOut }} in:fly|global={{ x: 14, duration: ms(380), easing: cubicOut }}>
							<span class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-sun"><row.icon class="size-4" /></span>
							<span class="min-w-0 flex-1">
								<span class="block text-[10px] font-semibold tracking-[.14em] text-white/55 uppercase">{row.label}</span>
								{#if row.chips.length > 1}
									<span class="mt-1.5 flex flex-wrap gap-1.5">{#each row.chips as chip (chip)}<span class="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs leading-5 font-medium">{chip}</span>{/each}</span>
								{:else}
									<span class="mt-0.5 block text-sm leading-snug font-medium break-words">{row.value}</span>
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="px-5 pb-5 text-sm text-white/70 lg:pt-3">Choose a trip type to begin. Your answers will build up here.</p>
			{/if}
		</div>
	</div>

	{#if tips.length}
		<div class="rounded-2xl border border-sun/40 bg-white p-5" in:fly={{ y: 18, duration: ms(480), easing: quintOut }}>
			<p class="flex items-center gap-2 text-[11px] font-bold tracking-[.16em] text-navy uppercase"><Lightbulb class="size-3.5 text-[#D9A900]" />Good to know</p>
			<ul class="mt-3 grid gap-2.5">
				{#each tips as tip (tip)}<li class="text-sm leading-snug text-navy" animate:flip={{ duration: ms(320), easing: cubicOut }}>{tip}</li>{/each}
			</ul>
		</div>
	{/if}

	{#if recs.length}
		<div class="rounded-2xl border border-border bg-white" in:fly={{ y: 24, duration: ms(560), easing: quintOut }}>
			<button type="button" class="flex min-h-12 w-full items-center justify-between px-5 lg:hidden" aria-expanded={openMatches} onclick={() => (openMatches = !openMatches)}>
				<span class="text-[11px] font-bold tracking-[.16em] text-navy uppercase">Trips that match ({recs.length})</span>
				<ChevronDown class={`size-4 transition ${openMatches ? 'rotate-180' : ''}`} />
			</button>
			<div class={`${openMatches ? 'block' : 'hidden'} px-5 pb-5 lg:block lg:pt-5`}>
				<p class="hidden text-[11px] font-bold tracking-[.16em] text-navy uppercase lg:block">Trips that match</p>
				<ul class="grid gap-3 lg:mt-3">
					{#each recs as rec (rec.tour.id)}
						{@const photo = safeUrl(rec.tour.thumbnail, '')}
						<li animate:flip={{ duration: ms(420), easing: cubicOut }} in:fly|global={{ x: 22, duration: ms(480), easing: quintOut }}>
							<a href={`/tours/${encodeURIComponent(rec.tour.slug)}`} target="_blank" rel="noopener" class="group flex gap-3 rounded-xl">
								{#if photo}<img src={photo} alt="" loading="lazy" class="h-14 w-16 shrink-0 rounded-lg object-cover" />{/if}
								<span class="min-w-0">
									<span class="line-clamp-2 text-[13px] leading-tight font-semibold text-navy group-hover:underline">{rec.tour.title}</span>
									<span class="mt-0.5 block text-[11px] text-muted-foreground">{[rec.tour.days ? `${rec.tour.days} days` : '', rec.tour.price ? `From ${usd(rec.tour.price)}` : ''].filter(Boolean).join(' · ')}</span>
									{#each rec.reasons.slice(0, 2) as reason (reason)}<span class="mt-0.5 flex items-start gap-1 text-[11px] leading-snug text-[#2F6B3C]"><Check class="mt-0.5 size-3 shrink-0" /><span class="line-clamp-1">{reason}</span></span>{/each}
								</span>
							</a>
						</li>
					{/each}
				</ul>
				<p class="mt-3 text-xs text-muted-foreground">We can tailor any of these, or plan something new around your answers.</p>
			</div>
		</div>
	{:else if chosen}
		<div class="rounded-2xl border border-border bg-white p-5">
			<p class="text-[11px] font-bold tracking-[.16em] text-navy uppercase">Made for you</p>
			<p class="mt-2 text-sm text-navy">None of our published trips fits these answers exactly yet. We’ll plan yours from scratch.</p>
		</div>
	{/if}

	<p class="flex items-center gap-2 px-1 text-xs text-muted-foreground"><MessageCircle class="size-3.5 shrink-0" />Prefer to talk? <a href="/#request-quote" class="font-semibold text-navy underline">Send us a message</a></p>
</aside>
