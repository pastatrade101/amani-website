<script lang="ts">
	import { BedDouble, Crown, Tent } from '@lucide/svelte';
	import { SAFARI_STYLES, SAFARI_STYLE_THEME, type SafariStyle } from '$lib/safari-pricing';

	// Budget / Midrange / Luxury tabs. Only the active tab takes its style colour.
	// `note` adds a small line under each tab (the CMS uses it for "4 of 6 prices set").
	// `compact` is the slim single-line version (the tour itinerary header uses it).
	let {
		value,
		onChange,
		styles = SAFARI_STYLES.map((style) => style.id),
		note,
		compact = false,
		label = 'Safari style',
		class: className = ''
	}: {
		value: SafariStyle;
		onChange: (style: SafariStyle) => void;
		styles?: SafariStyle[];
		note?: (style: SafariStyle) => string;
		compact?: boolean;
		label?: string;
		class?: string;
	} = $props();

	const icons = { budget: Tent, midrange: BedDouble, luxury: Crown };
	let shown = $derived(SAFARI_STYLES.filter((style) => styles.includes(style.id)));
	let list = $state<HTMLDivElement>();

	// Arrow keys move between tabs, as screen reader users expect from a tablist.
	function onKeydown(event: KeyboardEvent) {
		const ids = shown.map((style) => style.id);
		const current = ids.indexOf(value);
		const next = event.key === 'ArrowRight' ? current + 1 : event.key === 'ArrowLeft' ? current - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? ids.length - 1 : null;
		if (next == null || !ids.length) return;
		event.preventDefault();
		const target = ids[(next + ids.length) % ids.length];
		onChange(target);
		list?.querySelector<HTMLButtonElement>(`[data-style="${target}"]`)?.focus();
	}
</script>

<div class={className || (compact ? 'w-full max-w-[460px]' : 'mx-auto w-full max-w-[680px]')}>
	<div bind:this={list} class={`flex overflow-hidden border border-border bg-white p-1 ${compact ? 'rounded-full' : 'rounded-xl'}`} role="tablist" aria-label={label} tabindex="-1" onkeydown={onKeydown}>
		{#each shown as style (style.id)}
			{@const Icon = icons[style.id]}
			{@const active = value === style.id}
			{@const theme = SAFARI_STYLE_THEME[style.id]}
			<button
				type="button"
				role="tab"
				data-style={style.id}
				aria-selected={active}
				tabindex={active ? 0 : -1}
				onclick={() => onChange(style.id)}
				class={`flex min-w-0 flex-1 cursor-pointer items-center justify-center border text-center transition-all duration-200 hover:-translate-y-px hover:shadow-sm ${compact ? 'min-h-10 flex-row gap-1.5 rounded-full px-2 py-1.5 sm:px-3' : 'flex-col gap-0.5 rounded-lg px-1 py-2 sm:px-2 md:px-4 md:py-2.5'} ${active ? 'border-[var(--active-border)] bg-[var(--active-bg)]' : 'border-transparent bg-transparent hover:border-[var(--hover-border)] hover:bg-[var(--hover-bg)]'}`}
				style={`--active-bg:${theme.tabBg};--active-border:${theme.primary};--hover-bg:${theme.light};--hover-border:${theme.primary}`}
			>
				<Icon class={`size-4 shrink-0 ${compact ? '' : 'md:size-5'} ${active ? '' : 'text-primary'}`} style={active ? `color:${theme.primary}` : undefined} aria-hidden="true" />
				<span class={`font-semibold leading-tight ${compact ? 'truncate text-xs' : 'text-[11px] sm:text-xs md:text-sm'} ${active ? '' : 'text-primary'}`} style={active && theme.activeText ? `color:${theme.activeText}` : undefined}>{compact ? style.title.replace(/\s+Safari$/, '') : style.title}</span>
				{#if !compact}<span class={`text-[9px] leading-tight md:text-[11px] ${active ? 'text-primary/80' : 'text-muted-foreground'}`}>{note ? note(style.id) : style.subtitle}</span>{/if}
			</button>
		{/each}
	</div>
</div>
