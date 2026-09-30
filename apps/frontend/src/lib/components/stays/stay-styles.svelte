<script lang="ts">
	import { ArrowRight, Check } from '@lucide/svelte';
	import { STYLE_ICONS } from './stay-icons';
	import { SAFARI_STYLE_THEME } from '$lib/safari-pricing';
	import { STAY_STYLES, staysHref, type StayFilters } from '$lib/stay-content';

	// "Choose your style": one large card per safari style. Each card is one
	// link that filters the grid below and keeps the visitor's other filters.
	let { filters }: { filters: StayFilters } = $props();
</script>

<section id="stay-styles" class="bg-[oklch(.975_.009_85)] py-14 md:py-20" aria-labelledby="stay-styles-title">
	<div class="page-container">
		<div data-motion="reveal" class="max-w-2xl">
			<p class="eyebrow text-muted-foreground">CHOOSE YOUR STYLE</p>
			<div class="gold-line mt-4"></div>
			<h2 id="stay-styles-title" class="section-heading mt-5">Three ways to stay</h2>
			<p class="section-description mt-4 max-w-xl">Every safari can be planned in Budget, Midrange or Luxury comfort. Choose yours to see the lodges and camps that fit it.</p>
		</div>
		<ul class="mt-9 grid gap-4 md:grid-cols-3 md:gap-6">
			{#each STAY_STYLES as style (style.id)}
				{@const Icon = STYLE_ICONS[style.id]}
				{@const theme = SAFARI_STYLE_THEME[style.id]}
				{@const active = filters.style === style.id}
				<li data-motion="card" class="style-card" class:active style={`--style-color:${theme.primary};--style-ink:${theme.priceColor};--style-text:${theme.activeText ?? 'var(--navy)'};--style-light:${theme.light}`}>
					<span class="style-icon"><Icon class="size-6" strokeWidth={1.6} aria-hidden="true" /></span>
					<div class="min-w-0 flex-1">
						<h3 class="flex items-center gap-2 text-xl font-bold tracking-[-.02em] text-navy md:text-2xl">
							<a href={staysHref(filters, { style: style.id, page: '1' })} aria-current={active ? 'true' : undefined} class="style-link">{style.label}</a>
							{#if active}<span class="showing"><Check class="size-3" aria-hidden="true" />Showing</span>{/if}
						</h3>
						<p class="mt-2 text-sm leading-6 text-muted-foreground">{style.hint}</p>
						<span class="style-cta" aria-hidden="true">See {style.label.toLowerCase()} stays <ArrowRight class="size-4" /></span>
					</div>
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.style-card { position: relative; display: flex; gap: 1rem; overflow: hidden; border: 1px solid var(--border); border-radius: 1.25rem; background: white; padding: 1.4rem 1.25rem; box-shadow: 0 18px 40px -34px rgb(15 35 55 / .45); transition: border-color 200ms ease-out, box-shadow 250ms ease-out, translate 250ms ease-out; }
	/* The style's colour runs along the top, as on the price tabs. */
	.style-card::before { content: ''; position: absolute; inset: 0 0 auto; height: 4px; background: var(--style-color); }
	.style-card:hover { translate: 0 -2px; box-shadow: 0 22px 40px -28px rgb(15 35 55 / .45); }
	.style-card.active { border-color: var(--style-color); background: var(--style-light); }
	.style-card:has(.style-link:focus-visible) { outline: 3px solid var(--sun); outline-offset: 4px; }
	.style-link::after { content: ''; position: absolute; inset: 0; z-index: 1; }
	.style-link:focus-visible { outline: none; }
	.style-icon { display: grid; width: 3.25rem; height: 3.25rem; flex-shrink: 0; place-items: center; border-radius: 999px; background: var(--style-light); color: var(--style-ink); }
	.style-card.active .style-icon { background: white; }
	.showing { display: inline-flex; align-items: center; gap: 0.25rem; border-radius: 999px; background: white; padding: 0.2rem 0.55rem; color: var(--style-text); font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
	.style-cta { display: inline-flex; align-items: center; gap: 0.4rem; margin-top: 1rem; color: var(--navy); font-size: 13px; font-weight: 700; }
	.style-cta :global(svg) { transition: translate 180ms ease-out; }
	.style-card:hover .style-cta :global(svg) { translate: 3px 0; }
	@media (min-width: 768px) {
		.style-card { flex-direction: column; gap: 1.25rem; padding: 2rem 1.75rem 1.75rem; }
		.style-icon { width: 3.75rem; height: 3.75rem; }
		.style-cta { margin-top: 1.5rem; }
	}
	@media (prefers-reduced-motion: reduce) { .style-card, .style-cta :global(svg) { transition: none; } .style-card:hover { translate: none; } .style-card:hover .style-cta :global(svg) { translate: none; } }
</style>
