<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	// The "on this page" bar that sticks under the site header. It highlights
	// the section being read and, on phones, scrolls sideways to keep it in view.
	let { items, canEnquire = false, onEnquire }: { items: { id: string; label: string }[]; canEnquire?: boolean; onEnquire?: () => void } = $props();
	let active = $state('');
	let list = $state<HTMLUListElement>();

	$effect(() => {
		const sections = items.map((item) => document.getElementById(item.id)).filter((element): element is HTMLElement => element !== null);
		if (!sections.length) return;
		// A thin reading line a third of the way down the screen decides the current section.
		const observer = new IntersectionObserver(
			(records) => {
				for (const record of records) if (record.isIntersecting) active = record.target.id;
				// Back up in the hero: nothing is current yet.
				if (sections[0].getBoundingClientRect().top > window.innerHeight * 0.35) active = '';
			},
			{ rootMargin: '-35% 0px -60% 0px' }
		);
		sections.forEach((section) => observer.observe(section));
		return () => observer.disconnect();
	});

	$effect(() => {
		const link = active ? list?.querySelector<HTMLElement>(`[data-section="${active}"]`) : null;
		if (!link || !list || list.scrollWidth <= list.clientWidth) return;
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		list.scrollTo({ left: link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
	});
</script>

<nav aria-label="On this page" class="section-nav">
	<div class="nav-shell">
		<div class="nav-inner">
			<ul bind:this={list} class="nav-tabs">
				{#each items as item (item.id)}
					<li class="nav-item">
						<a href={`#${item.id}`} data-section={item.id} aria-current={active === item.id ? 'location' : undefined} class={`section-link ${active === item.id ? 'is-active' : ''}`}>{item.label}</a>
					</li>
				{/each}
			</ul>
			{#if canEnquire}
				<div class="nav-cta"><Button variant="safari" href="#request-quote" onclick={onEnquire} class="h-11 rounded-lg px-6 text-sm font-bold">Request a Quote <ArrowRight class="size-4" /></Button></div>
			{/if}
		</div>
	</div>
</nav>

<style>
	.section-nav { position: sticky; top: var(--site-header-height, 0px); z-index: 40; width: 100%; background: color-mix(in oklch, var(--background) 94%, transparent); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
	.nav-shell { width:100%; border-block:1px solid var(--border); background:white; box-shadow:0 4px 20px -16px #14314d66; overflow:hidden; }
	/* Same width and side padding as .tour-container, so the tabs start where the page's headings do. */
	.nav-inner { display:flex; align-items:stretch; width:100%; max-width:1440px; margin-inline:auto; }
	.nav-tabs { position:relative; display:flex; flex:1; min-width:0; overflow-x:auto; padding-inline:20px; gap:24px; }
	.nav-item { display:flex; flex:none; }
	@media(min-width:768px) { .nav-tabs { padding-inline:32px; gap:40px; } }
	.section-link { display:flex; align-items:center; min-height:76px; border-bottom:3px solid transparent; padding:0 2px; white-space:nowrap; font-size:15px; font-weight:600; color:var(--muted-foreground); }
	.section-link:hover,.section-link.is-active { color:var(--navy); }
	.section-link.is-active { border-bottom-color:var(--sun); }
	.nav-cta { display:flex; align-items:center; border-left:1px solid var(--border); padding:12px 32px 12px 24px; }
	@media(max-width:767px) { .section-nav { padding:0; } .nav-shell { border-radius:0; border-left:0; border-right:0; } .section-link { min-height:58px; font-size:12px; } .nav-cta { display:none; } }
	.section-nav ul { scrollbar-width: none; }
	.section-nav ul::-webkit-scrollbar { display: none; }
</style>
