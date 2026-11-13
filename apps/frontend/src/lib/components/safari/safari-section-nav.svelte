<script lang="ts">
	import { CalendarDays, CircleDollarSign, Eye, ListChecks, MessageCircle } from '@lucide/svelte';

	// The bar that pins under the site header. The section being read gets a
	// sliding gold line; once the bar is pinned, the quote and WhatsApp
	// buttons appear at its end (wide screens). When it reaches the header,
	// the header slides away and comes back when the bar returns to its spot.
	type Item = { id: string; label: string; icon: 'overview' | 'days' | 'pricing' | 'inclusions' };
	let { items, quoteHref, whatsapp, onEnquire }: { items: Item[]; quoteHref: string; whatsapp: string; onEnquire?: () => void } = $props();
	const ICONS = { overview: Eye, days: CalendarDays, pricing: CircleDollarSign, inclusions: ListChecks };

	let nav = $state<HTMLElement>();
	let marker = $state<HTMLDivElement>();
	let active = $state('');
	let pinned = $state(false);
	let line = $state({ x: 0, width: 0 });

	function placeLine() {
		const link = active ? nav?.querySelector<HTMLElement>(`[data-section="${active}"]`) : null;
		if (!nav || !link) { line = { x: 0, width: 0 }; return; }
		line = { x: link.getBoundingClientRect().left - nav.getBoundingClientRect().left, width: link.offsetWidth };
	}

	$effect(() => {
		if (!nav || !marker) return;
		const root = document.documentElement;
		const sections = items.map((item) => document.getElementById(item.id)).filter((element): element is HTMLElement => element !== null);
		let headerHeight = 0;
		const update = () => {
			// The section whose top has passed just under the bar is the current one.
			const threshold = nav!.getBoundingClientRect().bottom + 55;
			let current = '';
			for (const section of sections) if (section.getBoundingClientRect().top <= threshold) current = section.id;
			active = current;
			const top = marker!.getBoundingClientRect().top;
			pinned = top < headerHeight + 1;
			if (top < headerHeight) root.dataset.headerHidden = 'true';
			else delete root.dataset.headerHidden;
			placeLine();
		};
		const measure = () => { headerHeight = parseFloat(getComputedStyle(root).getPropertyValue('--site-header-height')) || 0; update(); };
		measure();
		const observer = new ResizeObserver(placeLine);
		observer.observe(nav);
		document.fonts?.ready.then(placeLine);
		window.addEventListener('scroll', update, { passive: true });
		window.addEventListener('resize', measure);
		return () => {
			observer.disconnect();
			window.removeEventListener('scroll', update);
			window.removeEventListener('resize', measure);
			delete root.dataset.headerHidden;
		};
	});
</script>

<div bind:this={marker} aria-hidden="true"></div>
<nav bind:this={nav} aria-label="On this page" class="section-nav" class:is-pinned={pinned}>
	{#each items as item (item.id)}
		{@const Icon = ICONS[item.icon]}
		<a href={`#${item.id}`} data-section={item.id} aria-current={active === item.id ? 'location' : undefined} onclick={() => { active = item.id; placeLine(); }}><Icon aria-hidden="true" />{item.label}</a>
	{/each}
	<span class="active-line" aria-hidden="true" style={`width:${line.width}px;transform:translateX(${line.x}px)`}></span>
	{#if pinned}
		<div class="sticky-actions">
			<a class="nav-quote" href={quoteHref} onclick={onEnquire}>Request a quote</a>
			<a class="nav-whatsapp" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />WhatsApp</a>
		</div>
	{/if}
</nav>

<style>
	.section-nav { position: sticky; top: var(--site-header-height, 0px); z-index: 40; isolation: isolate; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 14px; padding: 8px var(--sp-gutter); border-block: 1px solid var(--sp-line); background: #fffffff5; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); transition: top 0.25s ease; }
	/* The header has slid away: the bar moves up into its place. */
	:global(html[data-header-hidden]) .section-nav { top: 0; }
	.section-nav > a { position: relative; display: flex; align-items: center; gap: 8px; padding: 14px 18px; white-space: nowrap; font-size: var(--text-sm); font-weight: 500; color: var(--sp-muted); text-decoration: none; transition: color 0.18s ease; }
	.section-nav > a:first-of-type { padding-left: 0; }
	.section-nav > a :global(svg) { width: 17px; height: 17px; }
	.section-nav > a:hover { color: var(--sp-ink); }
	.section-nav > a[aria-current='location'] { color: var(--sp-ink); font-weight: 600; }
	.active-line { position: absolute; left: 0; bottom: -1px; z-index: 1; height: 3px; border-radius: 3px; background: var(--sp-sun-dark); pointer-events: none; transition: transform 0.25s ease, width 0.25s ease; }
	.sticky-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
	.sticky-actions a { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; padding: 9px 18px; border-radius: var(--radius-control); font-size: var(--text-sm); font-weight: 700; line-height: 1.3; text-decoration: none; }
	.sticky-actions :global(svg) { width: 15px; height: 15px; }
	.nav-quote { background: var(--sp-sun); color: #2b2722; }
	.nav-whatsapp { background: var(--sp-green); color: #fff; }
	@media (prefers-reduced-motion: reduce) { .section-nav, .section-nav > a, .active-line { transition: none; } }
	/* Tablets: tighter tabs without icons, so the buttons still fit on the row. */
	@media (min-width: 768px) and (max-width: 1080px) {
		.section-nav { flex-wrap: nowrap; gap: 2px; }
		.section-nav > a { padding: 14px 12px; font-size: var(--text-sm); }
		.section-nav > a :global(svg) { display: none; }
	}
	@media (max-width: 767px) {
		.section-nav { flex-wrap: nowrap; gap: 0; margin-top: 10px; padding: 4px var(--sp-gutter); box-shadow: 0 3px 12px #2b27220d; }
		.section-nav > a { flex: 1 1 auto; justify-content: center; min-width: 0; min-height: 46px; padding: 12px 2px; font-size: var(--text-xs); line-height: 1.3; }
		.section-nav > a :global(svg) { display: none; }
		.sticky-actions { display: none; }
	}
	@media (max-width: 380px) { .section-nav > a { font-size: var(--text-xs); } }
</style>
