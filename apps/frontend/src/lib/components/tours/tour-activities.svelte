<script lang="ts">
	import { Clock, Plus, Sparkles } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { safeUrl } from '$lib/home-content';
	import { formatPrice } from '$lib/safari-pricing';
	import { readableLabel } from '$lib/tour-itinerary';
	import type { TourDetail } from '$lib/types/api';

	type Item = NonNullable<TourDetail['tour_activities']>[number];
	// Optional extras linked to the tour in the CMS (published activities only).
	// "Add to enquiry" writes the activity into the enquiry form's interest field.
	let { items, tourTitle, canEnquire, onInterest }: { items: Item[]; tourTitle: string; canEnquire: boolean; onInterest: (name: string) => void } = $props();
	let sorted = $derived([...items].sort((a, b) => a.sort_order - b.sort_order));
</script>

<div data-motion="reveal" class="max-w-2xl">
	<p class="eyebrow text-muted-foreground">Make it yours</p>
	<h2 class="section-heading mt-3">Add to your safari</h2>
	<p class="section-description mt-3">Experiences that pair well with this itinerary. Mention the ones you like in your enquiry and we’ll look at fitting them in.</p>
</div>
<ul class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
	{#each sorted as { activity } (activity.id)}
		{@const image = safeUrl(activity.hero_image_url || activity.image_url, '')}
		{@const price = Number(activity.price_from)}
		<li data-motion="card" data-motion-hover="card" class="flex flex-col overflow-hidden rounded-2xl border border-border bg-white">
			{#if image && !image.startsWith('#')}
				<img src={image} alt={activity.name} loading="lazy" decoding="async" class="aspect-[16/10] w-full object-cover" />
			{:else}
				<div class="grid aspect-[16/10] w-full place-items-center bg-sun/10 text-navy/60" aria-hidden="true"><Sparkles class="size-8" /></div>
			{/if}
			<div class="flex flex-1 flex-col p-5">
				{#if activity.category || activity.badge}
					<div class="flex flex-wrap items-center gap-2 text-[11px] font-medium">
						{#if activity.category}<span class="text-muted-foreground">{readableLabel(activity.category)}</span>{/if}
						{#if activity.badge}<span class="rounded-full bg-sun/25 px-2 py-0.5 text-navy">{activity.badge}</span>{/if}
					</div>
				{/if}
				<h3 class="mt-2 text-lg font-bold leading-snug text-navy">{activity.name}</h3>
				{#if activity.duration_label}<p class="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock class="size-3.5" aria-hidden="true" />{activity.duration_label}</p>{/if}
				<div class="mt-auto flex flex-wrap items-end justify-between gap-3 pt-5">
					{#if price > 0}
						<p class="text-sm"><span class="block text-[10px] text-muted-foreground">From</span><span class="font-semibold text-navy">{formatPrice(price, activity.currency || 'USD')}</span>{#if activity.price_unit}<span class="text-xs text-muted-foreground"> {readableLabel(activity.price_unit).toLowerCase()}</span>{/if}</p>
					{:else}
						<span></span>
					{/if}
					{#if canEnquire}
						<Button href="#request-quote" variant="outline" onclick={() => onInterest(`${tourTitle} + ${activity.name}`.slice(0, 200))} class="h-10 rounded-lg px-4 text-xs font-semibold">Add to enquiry <Plus class="size-3.5" /></Button>
					{/if}
				</div>
			</div>
		</li>
	{/each}
</ul>
