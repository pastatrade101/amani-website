<script lang="ts">
	import { destinationHref } from '$lib/destination-content';
	import { ArrowUpRight } from '@lucide/svelte';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import type { Destination, HomepageSection } from '$lib/types/api';
	import { circuitFor, destinationPhoto, textContent } from '$lib/home-content';
	let { items, section, reference, canEnquire = true, showPackages = true, onInterest }: { items: Destination[]; section: HomepageSection; reference: boolean; canEnquire?: boolean; showPackages?: boolean; onInterest: (name: string) => void } = $props();
	const circuits = [ { id: 'northern', label: 'Northern Circuit' }, { id: 'southern', label: 'Southern Circuit' }, { id: 'western', label: 'Western Circuit' }, { id: 'coast', label: 'Zanzibar & Coast' }, { id: 'other', label: 'More Places' } ];
	let available = $derived(circuits.filter((circuit) => circuit.id !== 'other' || items.some((item) => circuitFor(item) === 'other')));
</script>
<section id="destinations" class="page-container py-14 md:py-20">
	<div data-motion="reveal" class="mx-auto max-w-2xl text-center"><p class="text-xs font-semibold uppercase tracking-[.2em] text-[#111111]">{section.subtitle}</p><h2 class="section-heading mt-3">{section.title}</h2><p class="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">{textContent(section.content)}</p></div>
	<Tabs.Root value="northern" class="mt-8">
		<div class="circuit-tabs-scroll"><Tabs.List class="circuit-tabs" aria-label="Tanzania safari regions">
			{#each available as circuit}<Tabs.Trigger value={circuit.id} class="circuit-tab">{circuit.label}</Tabs.Trigger>{/each}
		</Tabs.List></div>
		{#each available as circuit}
			<Tabs.Content value={circuit.id} class="mt-6">
				<div class="destination-grid">
					{#each items.filter((item) => circuitFor(item) === circuit.id).slice(0, 6) as item, index}
						{@const href = !reference ? destinationHref(item) : canEnquire ? '#request-quote' : '#destinations'}
						<a data-motion="card" data-motion-hover="card" {href} onclick={() => { if (reference) onInterest(item.name); }} class={`destination-cell cell-${index} group relative block min-h-60 overflow-hidden rounded-2xl bg-navy`}>
							<img src={destinationPhoto(item, index)} alt={item.name} loading="lazy" class="absolute inset-0 size-full object-cover transition-transform duration-[350ms] ease-out group-hover:scale-[1.04] motion-reduce:transition-none" />
							<div class="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-transparent"></div>
							<div class="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-white"><div><div class="gold-line w-8"></div><h3 class="mt-3 text-lg font-bold">{item.name}</h3><p class="mt-1.5 line-clamp-2 text-xs leading-5 text-white/85">{textContent(item.short_description || item.description)}</p></div><span class="grid size-8 shrink-0 place-items-center rounded-full bg-sun text-navy"><ArrowUpRight class="size-4" /></span></div>
						</a>
					{:else}<p class="col-span-full rounded-xl bg-secondary p-10 text-center text-sm">There are no published destinations in this circuit yet. Our team can help you explore the possibilities.</p>{/each}
				</div>
			</Tabs.Content>
		{/each}
	</Tabs.Root>
	<div class="mt-8 text-center"><a href="/destinations" class="inline-flex min-h-12 items-center gap-3 rounded-lg bg-navy px-6 text-sm font-semibold text-white">Explore all destinations <ArrowUpRight size={16}/></a></div>
</section>
<style>
	/* Mobile first: every region visible at once as a 2-column grid of full
	   44px tap targets, instead of a pill that scrolls its last tabs off-screen.
	   An odd last tab ("More Places") spans the full row. */
	.circuit-tabs-scroll { padding: 4px 0 8px; }
	:global(.circuit-tabs) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; max-width: 440px; height: auto; margin-inline: auto; gap: 4px; border: 1px solid var(--border); border-radius: 24px; background: var(--secondary); padding: 5px; }
	:global(.circuit-tab) { height: 44px; min-width: 0; gap: 8px; border: 0; border-radius: 999px; padding: 0 12px; background: transparent; color: var(--muted-foreground); font-size: 13px; font-weight: 500; line-height: 1.4; white-space: nowrap; box-shadow: none; transition: color 160ms ease-out, background 160ms ease-out, box-shadow 160ms ease-out; }
	:global(.circuit-tab:last-child:nth-child(odd)) { grid-column: 1 / -1; }
	:global(.circuit-tab::after) { display: none; }
	:global(.circuit-tab[data-state="active"]), :global(.circuit-tab[data-active]) { background: var(--navy); color: white; box-shadow: 0 3px 8px rgb(15 35 55 / .13); }
	:global(.circuit-tab:focus-visible) { outline: 2px solid var(--sun); outline-offset: 2px; }
	/* Hover only where there is a pointer, so a tapped tab doesn't stay lit. */
	@media (hover: hover) { :global(.circuit-tab:not([data-state="active"]):not([data-active]):hover) { background: white; color: var(--navy); } }
	/* From 640px: the single-row pill. */
	@media (min-width: 640px) {
		.circuit-tabs-scroll { overflow-x: auto; padding-inline: 2px; scrollbar-width: thin; }
		:global(.circuit-tabs) { display: flex; width: max-content; max-width: none; border-radius: 999px; }
		:global(.circuit-tab) { flex: none; padding-inline: 23px; }
		:global(.circuit-tab:last-child:nth-child(odd)) { grid-column: auto; }
	}

	.destination-grid { display: grid; gap: 16px; }
	@media (min-width: 640px) { .destination-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
	@media (min-width: 1024px) {
		.destination-grid { grid-template-columns: 1fr 1fr 1.2fr 1fr 1fr; grid-template-rows: 270px 230px; }
		.cell-0 { grid-column: 1 / 3; grid-row: 1; }
		.cell-1 { grid-column: 1; grid-row: 2; }
		.cell-2 { grid-column: 3; grid-row: 1 / 3; }
		.cell-3 { grid-column: 2; grid-row: 2; }
		.cell-4 { grid-column: 4 / 6; grid-row: 1; }
		.cell-5 { grid-column: 4 / 6; grid-row: 2; }
		.destination-cell { min-height: 0; }
	}
</style>
