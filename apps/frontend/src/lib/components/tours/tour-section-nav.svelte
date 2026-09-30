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
	<div class="page-container flex items-center gap-4">
		<ul bind:this={list} class="relative -mx-4 flex min-w-0 flex-1 gap-1 overflow-x-auto px-4 py-2 md:mx-0 md:px-0">
			{#each items as item (item.id)}
				<li class="shrink-0">
					<a href={`#${item.id}`} data-section={item.id} aria-current={active === item.id ? 'location' : undefined} class={`inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 ${active === item.id ? 'bg-navy text-white' : 'text-muted-foreground hover:bg-secondary hover:text-primary'}`}>{item.label}</a>
				</li>
			{/each}
		</ul>
		{#if canEnquire}
			<Button variant="safari" href="#request-quote" onclick={onEnquire} class="hidden h-9 shrink-0 px-4 text-xs md:inline-flex">Enquire <ArrowRight class="size-3.5" /></Button>
		{/if}
	</div>
</nav>

<style>
	.section-nav { position: sticky; top: var(--site-header-height); z-index: 40; border-bottom: 1px solid var(--border); background: color-mix(in oklch, var(--background) 94%, transparent); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
	.section-nav ul { scrollbar-width: none; }
	.section-nav ul::-webkit-scrollbar { display: none; }
</style>
