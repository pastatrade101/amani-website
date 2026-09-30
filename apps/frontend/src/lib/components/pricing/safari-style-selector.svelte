<script lang="ts">
	import { BedDouble, Crown, Tent } from '@lucide/svelte';
	import { SAFARI_STYLES, SAFARI_STYLE_THEME, type SafariStyle } from '$lib/safari-pricing';

	// Budget / Midrange / Luxury tabs. Only the active tab takes its style colour.
	// `note` adds a small line under each tab (the CMS uses it for "4 of 6 prices set").
	let {
		value,
		onChange,
		styles = SAFARI_STYLES.map((style) => style.id),
		note
	}: { value: SafariStyle; onChange: (style: SafariStyle) => void; styles?: SafariStyle[]; note?: (style: SafariStyle) => string } = $props();

	const icons = { budget: Tent, midrange: BedDouble, luxury: Crown };
	let shown = $derived(SAFARI_STYLES.filter((style) => styles.includes(style.id)));
</script>

<div class="mx-auto w-full max-w-[680px]">
	<div class="flex overflow-hidden rounded-xl border border-border bg-white p-1" role="tablist" aria-label="Safari style">
		{#each shown as style (style.id)}
			{@const Icon = icons[style.id]}
			{@const active = value === style.id}
			{@const theme = SAFARI_STYLE_THEME[style.id]}
			<button
				type="button"
				role="tab"
				aria-selected={active}
				onclick={() => onChange(style.id)}
				class={`flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-2 text-center transition-all duration-200 hover:-translate-y-px hover:shadow-sm sm:px-2 md:px-4 md:py-2.5 ${active ? 'border-[var(--active-border)] bg-[var(--active-bg)]' : 'border-transparent bg-transparent hover:border-[var(--hover-border)] hover:bg-[var(--hover-bg)]'}`}
				style={`--active-bg:${theme.tabBg};--active-border:${theme.primary};--hover-bg:${theme.light};--hover-border:${theme.primary}`}
			>
				<Icon class={`size-4 shrink-0 md:size-5 ${active ? '' : 'text-primary'}`} style={active ? `color:${theme.primary}` : undefined} aria-hidden="true" />
				<span class={`text-[11px] font-semibold leading-tight sm:text-xs md:text-sm ${active ? '' : 'text-primary'}`} style={active && theme.activeText ? `color:${theme.activeText}` : undefined}>{style.title}</span>
				<span class={`text-[9px] leading-tight md:text-[11px] ${active ? 'text-primary/80' : 'text-muted-foreground'}`}>{note ? note(style.id) : style.subtitle}</span>
			</button>
		{/each}
	</div>
</div>
