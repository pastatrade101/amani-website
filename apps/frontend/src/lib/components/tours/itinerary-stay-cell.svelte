<script lang="ts">
	import { BedDouble, UtensilsCrossed } from '@lucide/svelte';

	// One cell of a day's stay panel: "Overnight" or "Meals". Phone-sized here;
	// itinerary-timeline sizes the value up from sm. The admin day editor
	// previews the Overnight line with this same component.
	let {
		kind,
		label,
		value,
		badge = null,
		href = ''
	}: {
		kind: 'overnight' | 'meals';
		label: string;
		value: string;
		/** The safari style the overnight belongs to, when the page offers several. */
		badge?: { color: string; name: string } | null;
		/** The stay's own page, when it has a public one. */
		href?: string;
	} = $props();
</script>

<div class="stay-cell">
	<span class="stay-icon">
		{#if kind === 'overnight'}<BedDouble class="size-[18px]" aria-hidden="true" />{:else}<UtensilsCrossed class="size-[18px]" aria-hidden="true" />{/if}
	</span>
	<div class="min-w-0">
		<p class="stay-label">{label}{#if badge}<span class="ml-1.5 inline-flex items-center gap-1 normal-case tracking-normal"><span class="size-1.5 rounded-full" style={`background:${badge.color}`}></span>{badge.name}</span>{/if}</p>
		<p class="stay-value">{#if href}<a {href} class="stay-link">{value}</a>{:else}{value}{/if}</p>
	</div>
</div>

<style>
	.stay-cell { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
	.stay-icon { display: grid; flex-shrink: 0; place-items: center; width: 2.5rem; height: 2.5rem; border-radius: 999px; background: color-mix(in oklch, var(--sun) 22%, white); color: var(--navy); }
	.stay-label { display: flex; flex-wrap: wrap; align-items: center; font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted-foreground); }
	/* Property names can be one long word; they wrap rather than widen the panel. */
	.stay-value { margin-top: 0.1rem; font-size: 14px; font-weight: 600; line-height: 1.45; color: var(--navy); overflow-wrap: anywhere; }
	.stay-link { text-decoration: underline; text-decoration-color: color-mix(in oklch, var(--sun) 70%, transparent); text-decoration-thickness: 2px; text-underline-offset: 3px; transition: text-decoration-color 160ms ease-out; }
	.stay-link:hover, .stay-link:focus-visible { text-decoration-color: var(--navy); }
</style>
