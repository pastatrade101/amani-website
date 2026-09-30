<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { Info } from '@lucide/svelte';
	import SafariStyleSelector from './safari-style-selector.svelte';
	import {
		DEFAULT_STYLE,
		SAFARI_STYLE_THEME,
		formatPrice,
		seasonForStyle,
		stylesWithPrices,
		tiersForStyle,
		type PricingSeason,
		type SafariStyle
	} from '$lib/safari-pricing';

	// "Safari Price by Group Size": pick a style, the table fades out, swaps to
	// that style's per-person prices and fades back in — no reload, no jump.
	// Renders nothing until at least one style has prices.
	// Three ways to use it:
	//  - on its own: the built-in tabs pick the style;
	//  - `style` alone (the CMS preview): the parent drives the style, no tabs;
	//  - `style` + `onStyleChange` (the tour page): the tabs ask the parent to
	//    change the style, so another switcher on the page stays in step.
	// `styles` lists the tabs (default: styles with prices); a tab without prices
	// shows the `empty` snippet, or a short note.
	let {
		seasons,
		style,
		onStyleChange,
		styles,
		showSelector = true,
		headingClass = 'text-base leading-tight md:text-[28px]',
		empty
	}: {
		seasons: PricingSeason[];
		style?: SafariStyle;
		onStyleChange?: (style: SafariStyle) => void;
		styles?: SafariStyle[];
		showSelector?: boolean;
		headingClass?: string;
		empty?: Snippet<[SafariStyle]>;
	} = $props();

	let available = $derived(stylesWithPrices(seasons));
	let tabs = $derived(styles?.length ? styles : available);
	let initial = $derived(available.includes(DEFAULT_STYLE) ? DEFAULT_STYLE : (available[0] ?? DEFAULT_STYLE));
	let picked = $state<SafariStyle | null>(null);
	let displayed = $state<SafariStyle | null>(null);
	let fading = $state(false);

	let selected = $derived(style ?? (picked && tabs.includes(picked) ? picked : initial));
	// The style whose prices are on screen; it trails `selected` by the fade.
	let shown = $derived(displayed && (style || tabs.includes(displayed)) ? displayed : selected);
	let tiers = $derived(tiersForStyle(seasons, shown));
	let currency = $derived(seasonForStyle(seasons, shown)?.currency ?? seasonForStyle(seasons, selected)?.currency ?? 'USD');
	let theme = $derived(SAFARI_STYLE_THEME[shown]);

	function choose(next: SafariStyle) {
		if (next === selected) return;
		if (onStyleChange) onStyleChange(next);
		else picked = next;
	}

	// Fade whenever the selected style changes, whoever changed it.
	$effect(() => {
		const next = selected;
		const current = untrack(() => displayed);
		if (current === null || next === current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			displayed = next;
			fading = false;
			return;
		}
		fading = true;
		const timer = setTimeout(() => {
			displayed = next;
			fading = false;
		}, 200);
		return () => clearTimeout(timer);
	});
</script>

{#if available.length || style}
	<div class="min-w-0">
		<h2 class={`text-center font-bold tracking-tight text-primary ${headingClass}`}>Safari Price by Group Size</h2>
		{#if showSelector && tabs.length > 1}
			<div class="mt-5 md:mt-6">
				<p class="mb-2 text-center text-[13px] leading-relaxed text-[#64748B] md:mb-3 md:text-sm">Explore the safari style that best matches the way you want to experience Tanzania.</p>
				<SafariStyleSelector value={selected} onChange={choose} styles={tabs} label="Safari style for prices" />
			</div>
		{/if}

		<div class="mt-5 rounded-2xl border border-border bg-white p-3 sm:p-4 md:p-6">
			<div class={`transition-opacity duration-200 ${fading ? 'opacity-0' : 'opacity-100'}`}>
				{#if tiers.length}
					<!-- Mobile first: 3 across on phones, 6 across from sm; gap-px draws the dividers. -->
					<div class="mx-auto grid w-full grid-cols-3 gap-px overflow-hidden rounded-xl border sm:grid-cols-6 md:w-[90%]" style={`border-color:${theme.primary};background-color:${theme.light}`}>
						{#each tiers as tier (tier.key)}
							<div class="flex flex-col items-center justify-center bg-white px-1 py-3 text-center md:px-4 md:py-5">
								<span class="text-[11px] font-semibold uppercase tracking-wide text-primary/80 md:text-sm">{tier.label}</span>
								{#if tier.price != null}
									<span class="mt-1 text-[15px] font-bold leading-none transition-colors duration-200 md:mt-2 md:text-3xl" style={`color:${theme.priceColor}`}>{formatPrice(tier.price, currency)}</span>
									<span class="mt-0.5 text-[10px] text-muted-foreground md:text-xs">per person</span>
								{:else}
									<span class="mt-1 text-[13px] font-semibold leading-none text-primary/70 md:mt-2 md:text-base">On request</span>
								{/if}
							</div>
						{/each}
					</div>
				{:else if empty}
					{@render empty(shown)}
				{:else}
					<p class="py-6 text-center text-sm text-muted-foreground">No prices for this safari style yet.</p>
				{/if}
			</div>

			<div class="mt-4 flex items-start justify-center gap-3 rounded-xl border-l-4 border-l-border bg-white/50 p-4 text-center md:mx-auto md:mt-5 md:w-[86%] md:p-5">
				<Info class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
				<div>
					<p class="text-xs leading-relaxed text-primary/90 md:text-sm"><span class="font-semibold text-primary">Prices are quoted per person in {currency}</span> and may vary slightly based on your travel dates, accommodation preferences and availability.</p>
					<p class="mt-0.5 text-xs text-primary/80 md:text-sm">Contact us for a customized quote.</p>
				</div>
			</div>
		</div>
	</div>
{/if}
