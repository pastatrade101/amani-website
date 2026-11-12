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
						{@const blurb = textContent(item.short_description || item.description)}
						<a data-motion="card" {href} onclick={() => { if (reference) onInterest(item.name); }} class={`destination-cell cell-${index}`}>
							<img src={destinationPhoto(item, index)} alt="" loading="lazy" class="dest-photo" />
							<span class="dest-veil" aria-hidden="true"></span>
							<span class="dest-go" aria-hidden="true"><ArrowUpRight /></span>
							<div class="dest-copy">
								<span class="dest-rule" aria-hidden="true"></span>
								<h3>{item.name}</h3>
								{#if blurb}<div class="dest-reveal"><p>{blurb}</p></div>{/if}
							</div>
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
	:global(.circuit-tabs) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; max-width: 440px; height: auto; margin-inline: auto; gap: 4px; border: 1px solid var(--border); border-radius: var(--radius-surface); background: var(--secondary); padding: 5px; }
	:global(.circuit-tab) { height: 44px; min-width: 0; gap: 8px; border: 0; border-radius: var(--radius-control); padding: 0 12px; background: transparent; color: var(--muted-foreground); font-size: 13px; font-weight: 500; line-height: 1.4; white-space: nowrap; box-shadow: none; transition: color 160ms ease-out, background 160ms ease-out, box-shadow 160ms ease-out; }
	:global(.circuit-tab:last-child:nth-child(odd)) { grid-column: 1 / -1; }
	:global(.circuit-tab::after) { display: none; }
	:global(.circuit-tab[data-state="active"]), :global(.circuit-tab[data-active]) { background: var(--navy); color: white; box-shadow: 0 3px 8px rgb(39 36 31 / .13); }
	:global(.circuit-tab:focus-visible) { outline: 2px solid var(--sun); outline-offset: 2px; }
	/* Hover only where there is a pointer, so a tapped tab doesn't stay lit. */
	@media (hover: hover) { :global(.circuit-tab:not([data-state="active"]):not([data-active]):hover) { background: white; color: var(--navy); } }
	/* From 640px: the single-row pill. */
	@media (min-width: 640px) {
		.circuit-tabs-scroll { overflow-x: auto; padding-inline: 2px; scrollbar-width: thin; }
		:global(.circuit-tabs) { display: flex; width: max-content; max-width: none; border-radius: var(--radius-control); }
		:global(.circuit-tab) { flex: none; padding-inline: 23px; }
		:global(.circuit-tab:last-child:nth-child(odd)) { grid-column: auto; }
	}

	/* Destination tiles: the photo, an eased veil that only darkens where the
	   words sit, the region on a gold rule, the name, and a short read that
	   slides in on hover where there is a pointer (always shown on touch). */
	.destination-cell { position: relative; isolation: isolate; display: flex; align-items: flex-end; min-height: 300px; overflow: hidden; border-radius: var(--radius-surface); background: #2b2722; color: #fff; text-decoration: none; }
	.dest-photo { position: absolute; inset: 0; z-index: -2; width: 100%; height: 100%; object-fit: cover; transition: transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1), filter 0.5s ease; }
	.dest-veil {
		position: absolute; inset: 0; z-index: -1;
		background:
			linear-gradient(0deg, rgb(20 18 15 / 0.86) 0%, rgb(20 18 15 / 0.7) 16%, rgb(20 18 15 / 0.48) 32%, rgb(20 18 15 / 0.26) 48%, rgb(20 18 15 / 0.1) 64%, rgb(20 18 15 / 0) 80%),
			linear-gradient(180deg, rgb(20 18 15 / 0.22) 0%, rgb(20 18 15 / 0) 26%);
		transition: opacity 0.4s ease;
	}
	.dest-copy { width: 100%; min-width: 0; padding: 24px 26px; }
	/* The region field holds the circuit, which the tab already names, so a gold rule leads instead. */
	.dest-rule { display: block; width: 32px; height: 2px; border-radius: 2px; background: var(--sun); transition: width 0.4s cubic-bezier(0.2, 0.7, 0.2, 1); }
	.destination-cell:hover .dest-rule { width: 48px; }
	.destination-cell h3 { margin: 12px 0 0; font-size: clamp(20px, 1.7vw, 25px); font-weight: 600; line-height: 1.15; letter-spacing: -0.025em; color: #fff; text-wrap: balance; }
	.dest-reveal { display: grid; grid-template-rows: 1fr; margin-top: 10px; }
	.dest-reveal p { min-height: 0; margin: 0; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; max-width: 46ch; font-size: 13.5px; line-height: 1.6; color: rgb(255 255 255 / 0.84); }
	.dest-go { position: absolute; top: 18px; right: 18px; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: rgb(255 255 255 / 0.94); color: var(--navy); box-shadow: 0 6px 16px -8px rgb(20 18 15 / 0.5); transition: background-color 0.3s ease, transform 0.3s ease; }
	.dest-go :global(svg) { width: 18px; height: 18px; transition: transform 0.3s ease; }
	.destination-cell:hover .dest-photo { transform: scale(1.05); }
	.destination-cell:hover .dest-go, .destination-cell:focus-visible .dest-go { background: var(--sun); }
	.destination-cell:hover .dest-go :global(svg), .destination-cell:focus-visible .dest-go :global(svg) { transform: rotate(45deg); }
	.destination-cell:focus-visible { outline: 3px solid var(--sun); outline-offset: 3px; }
	@media (hover: hover) and (min-width: 1024px) {
		.dest-reveal { grid-template-rows: 0fr; margin-top: 0; opacity: 0; transition: grid-template-rows 0.4s cubic-bezier(0.2, 0.7, 0.2, 1), margin-top 0.4s cubic-bezier(0.2, 0.7, 0.2, 1), opacity 0.3s ease; }
		.destination-cell:hover .dest-reveal, .destination-cell:focus-visible .dest-reveal { grid-template-rows: 1fr; margin-top: 10px; opacity: 1; }
	}
	@media (prefers-reduced-motion: reduce) { .dest-rule, .dest-photo, .dest-veil, .dest-go, .dest-go :global(svg), .dest-reveal { transition: none; } .destination-cell:hover .dest-photo { transform: none; } }
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
