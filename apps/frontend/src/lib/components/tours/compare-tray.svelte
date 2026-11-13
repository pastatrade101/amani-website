<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight, X } from '@lucide/svelte';
	import { page } from '$app/state';
	import { compare, MAX_COMPARE } from '$lib/compare.svelte';

	// The shortlist, following the visitor from page to page: one safari comes off
	// a destination, another off the tours list. Picking a second never costs the
	// first, and the comparison is always one press away. Sits above the phone tab bar.
	onMount(() => compare.restore());

	let tray = $state<HTMLElement | null>(null);
	let hidden = $derived(page.url.pathname === '/compare' || page.url.pathname.startsWith('/plan-my-trip'));
	let shown = $derived(compare.ready && compare.count > 0 && !hidden);

	// Publish the tray's height so the end of the page can scroll clear of it.
	$effect(() => {
		const el = tray;
		const root = document.documentElement;
		if (!el) {
			root.style.removeProperty('--compare-offset');
			return;
		}
		const publish = () => root.style.setProperty('--compare-offset', `${Math.round(el.getBoundingClientRect().height)}px`);
		publish();
		const observer = new ResizeObserver(publish);
		observer.observe(el);
		return () => {
			observer.disconnect();
			root.style.removeProperty('--compare-offset');
		};
	});
</script>

{#if shown}
	<aside class="tray" aria-label="Safaris you are comparing" bind:this={tray}>
		<div class="page-container inner">
			<div class="count">
				<strong>Compare safaris</strong>
				<span>{compare.count} of {MAX_COMPARE} chosen</span>
			</div>
			<ul class="picks">
				{#each compare.items as item (item.slug)}
					<li>
						<span class="thumb">{#if item.image}<img src={item.image} alt="" width="48" height="36" loading="lazy" />{/if}</span>
						<a class="name" href={`/tours/${encodeURIComponent(item.slug)}`}>{item.title}</a>
						<button type="button" class="drop" aria-label={`Remove ${item.title} from the comparison`} onclick={() => compare.remove(item.slug)}><X class="size-3.5" aria-hidden="true" /></button>
					</li>
				{/each}
				{#each { length: MAX_COMPARE - compare.count } as _, i (i)}<li class="slot" aria-hidden="true"></li>{/each}
			</ul>
			<div class="actions">
				<button type="button" class="clear" onclick={() => compare.clear()}>Clear</button>
				{#if compare.count > 1}
					<a class="go" href={compare.href} data-cta="compare" data-cta-location="compare_tray"><span>Compare {compare.count}<span class="wide">&nbsp;safaris</span></span><ArrowRight class="size-4" aria-hidden="true" /></a>
				{:else}
					<span class="hint">Add one more to compare</span>
				{/if}
			</div>
		</div>
	</aside>
{/if}

<style>
	.tray { position: fixed; inset-inline: 0; bottom: var(--tab-offset, 0px); z-index: 58; padding: 10px 0 max(10px, env(safe-area-inset-bottom)); border-top: 1px solid var(--border); background: rgb(255 255 255 / 0.97); box-shadow: 0 -12px 28px -26px rgb(39 36 31 / 0.5); animation: tray-in 260ms cubic-bezier(0.22, 1, 0.36, 1); }
	@keyframes tray-in { from { transform: translateY(100%); } }
	.inner { display: flex; align-items: center; gap: 20px; }
	.count { display: grid; flex: none; gap: 1px; line-height: 1.25; }
	.count strong { color: var(--navy); font-size: var(--text-sm); font-weight: 650; }
	.count span { color: var(--muted-foreground); font-size: var(--text-xs); }
	.picks { display: flex; flex: 1; gap: 8px; min-width: 0; margin: 0; padding: 0; overflow-x: auto; list-style: none; scrollbar-width: none; }
	.picks li { display: flex; flex: 1 1 0; max-width: 280px; align-items: center; gap: 10px; min-width: 0; height: 48px; padding: 5px 4px 5px 5px; border: 1px solid var(--border); border-radius: var(--radius-control); background: oklch(0.985 0.005 85); }
	.picks li.slot { flex: 0 0 52px; border-style: dashed; background: transparent; }
	.thumb { flex: none; width: 48px; height: 36px; overflow: hidden; border-radius: 5px; background: oklch(0.9 0.02 80); }
	.thumb img { width: 100%; height: 100%; object-fit: cover; }
	.name { display: -webkit-box; flex: 1; min-width: 0; overflow: hidden; color: var(--navy); font-size: var(--text-xs); font-weight: 600; line-height: 1.3; text-decoration: none; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
	.name:hover { color: #7a5a26; }
	.drop { display: grid; flex: none; place-items: center; width: 32px; height: 32px; border-radius: 6px; color: var(--muted-foreground); }
	.drop:hover { background: oklch(0.95 0.01 80); color: var(--navy); }
	.actions { display: flex; flex: none; align-items: center; gap: 16px; }
	.clear { min-height: 40px; color: var(--muted-foreground); font-size: var(--text-sm); font-weight: 600; }
	.clear:hover { color: var(--navy); }
	.hint { color: var(--muted-foreground); font-size: var(--text-sm); }
	.go { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: var(--radius-control); background: var(--sun); color: var(--sun-foreground); font-size: var(--text-sm); font-weight: 700; text-decoration: none; white-space: nowrap; transition: background-color 160ms ease-out; }
	.go:hover { background: color-mix(in oklch, var(--sun) 88%, black); }
	.tray :global(:focus-visible) { outline: 2px solid var(--sun); outline-offset: 2px; }
	/* Phones: the photos are the shortlist; titles would leave a word and a half each. */
	/* The tab bar below already clears the home indicator. */
	@media (max-width: 1023px) { .tray { padding-bottom: 10px; } }
	@media (max-width: 767px) {
		.inner { gap: 10px; }
		.count { flex: 1; min-width: 0; }
		.count strong { display: none; }
		.count span { color: var(--navy); font-size: var(--text-xs); font-weight: 600; }
		.picks { order: -1; flex: none; gap: 0; overflow: visible; }
		.picks li { flex: none; width: auto; max-width: none; height: auto; padding: 0; border: 0; background: none; }
		.picks li + li { margin-left: -10px; }
		.picks li.slot, .name, .drop { display: none; }
		.thumb { width: 38px; height: 38px; border: 2px solid #fff; border-radius: 7px; }
		.actions { flex: none; gap: 10px; }
		.hint { font-size: var(--text-xs); text-align: right; }
		.wide { display: none; }
		.go { padding: 0 14px; }
	}
	@media (prefers-reduced-motion: reduce) { .tray { animation: none; } .go { transition: none; } }
</style>
