<script lang="ts">
	import { Tabs } from 'bits-ui';
	import { ArrowRight, Check, Sparkles } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { safeUrl, textContent } from '$lib/home-content';
	import { formatPrice } from '$lib/safari-pricing';
	import type { TourActivityItem } from '$lib/types/api';

	// The tour page's activities popup: one tab per activity, each with a photo,
	// its price, a short description and up to three quick highlights. Optional
	// ones can be added to the enquiry; included ones say so.
	let { items, canEnquire, selectedIds = $bindable([]) }: { items: TourActivityItem[]; canEnquire: boolean; selectedIds?: string[] } = $props();

	// Optional first: they are what this popup is opened for.
	let ordered = $derived([...items].sort((a, b) => Number(b.is_optional) - Number(a.is_optional) || a.sort_order - b.sort_order));
	let active = $derived(ordered[0]?.activity.id ?? '');

	const summary = (item: TourActivityItem) => {
		const own = item.activity.short_description?.trim();
		if (own) return own;
		// Until an editor writes one: the long description, cut at a word.
		const text = textContent(item.activity.description ?? '');
		return text.length > 200 ? `${text.slice(0, 200).replace(/\s+\S*$/, '')}…` : text;
	};
	const highlights = (item: TourActivityItem) => {
		const own = (item.activity.quick_highlights ?? []).map((value) => value.trim()).filter(Boolean).slice(0, 3);
		return own.length ? own : [item.activity.duration_label].filter((value): value is string => Boolean(value?.trim()));
	};
	const UNIT: Record<string, string> = { per_person: 'per person', per_group: 'per group', per_child: 'per child', upgrade: 'per group' };
	const price = (item: TourActivityItem) => {
		if (!item.is_optional) return null;
		if (!item.additional_cost) return { amount: 'No extra cost', unit: '' };
		const option = item.pricing_option;
		return option ? { amount: formatPrice(Number(option.price), option.currency || 'USD'), unit: UNIT[option.price_type] ?? '' } : { amount: 'On request', unit: '' };
	};
	const toggle = (id: string) => (selectedIds = selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id]);
</script>

{#if ordered.length}
	<Tabs.Root value={active} onValueChange={(value) => (active = value)}>
		<Tabs.List class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Activities">
			{#each ordered as item (item.activity.id)}
				{@const chosen = selectedIds.includes(item.activity.id)}
				<Tabs.Trigger value={item.activity.id} class="activity-tab">
					{#if chosen}<Check class="size-3.5" aria-hidden="true" />{/if}{item.activity.name}
				</Tabs.Trigger>
			{/each}
		</Tabs.List>

		{#each ordered as item (item.activity.id)}
			{@const activity = item.activity}
			{@const image = safeUrl(activity.hero_image_url || activity.image_url, '')}
			{@const cost = price(item)}
			{@const facts = highlights(item)}
			{@const chosen = selectedIds.includes(activity.id)}
			<Tabs.Content value={activity.id} class="mt-5">
				{#if image && !image.startsWith('#')}
					<img src={image} alt={activity.name} loading="lazy" class="aspect-[16/7] w-full rounded-2xl object-cover" />
				{:else}
					<div class="grid aspect-[16/7] w-full place-items-center rounded-2xl bg-linear-to-br from-sun/25 via-secondary to-secondary text-navy" aria-hidden="true"><Sparkles class="size-10 opacity-70" /></div>
				{/if}
				<div class="mt-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
					<h3 class="min-w-0 text-xl font-bold tracking-tight text-navy">{activity.name}</h3>
					{#if cost}
						<p class="text-right"><span class="block text-2xl font-bold leading-none text-navy">{cost.amount}</span>{#if cost.unit}<span class="mt-1 block text-xs text-muted-foreground">{cost.unit}</span>{/if}</p>
					{:else}
						<span class="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-navy">Included in your safari</span>
					{/if}
				</div>
				<!-- Capped at 200 characters in the CMS (and the fallback is cut to 200), so it always shows whole. -->
				{#if summary(item)}<p class="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{summary(item)}</p>{/if}
				{#if facts.length}
					<ul class="mt-5 grid gap-3 sm:grid-cols-3">
						{#each facts as fact}<li class="border-l-2 border-sun pl-3 text-xs leading-5 text-navy/80">{fact}</li>{/each}
					</ul>
				{/if}
				{#if item.is_optional && canEnquire}
					<Button variant={chosen ? 'outline' : 'safari'} class="mt-6 h-11 px-5 text-sm" aria-pressed={chosen} onclick={() => toggle(activity.id)}>
						{#if chosen}<Check class="size-4" />Added to my safari{:else}Add to My Safari <ArrowRight class="size-4" />{/if}
					</Button>
				{/if}
			</Tabs.Content>
		{/each}
	</Tabs.Root>
{/if}

<style>
	:global(.activity-tab) { display: inline-flex; flex: none; align-items: center; gap: 6px; min-height: 40px; border: 1px solid var(--border); border-radius: 10px; background: white; padding: 0 16px; font-size: 13px; font-weight: 600; color: var(--navy); white-space: nowrap; transition: background-color 0.2s ease, border-color 0.2s ease; }
	:global(.activity-tab:hover) { border-color: color-mix(in oklch, var(--navy) 30%, transparent); }
	:global(.activity-tab[data-state='active']) { border-color: var(--sun); background: var(--sun); }
	:global(.activity-tab:focus-visible) { outline: 2px solid var(--navy); outline-offset: 2px; }
</style>
