<script lang="ts">
	import { House, Binoculars, BedDouble, MessageCircle, NotebookPen, MapPinned } from '@lucide/svelte';
	import { page } from '$app/state';
	import { PLANNER_PATH, planHref } from '$lib/planner/plan-href';
	import { WHATSAPP_URL } from '$lib/homepage-refresh';
	import { glide } from '$lib/motion/glide';

	// Phones and tablets: the site's main places one thumb away, the way an app
	// does it. Planning a trip sits in the middle as the one primary action. The
	// planner hides the bar: it is a task with its own bottom dock.
	let { canEnquire = true }: { canEnquire?: boolean } = $props();

	// Browsers with view transitions carry the marker from the old tab to the
	// new one as the page changes (layout.css, `tab-mark`), in one movement.
	// Elsewhere the tapped tab lights up at once and its marker glides while
	// the next page loads; the page's own path takes over when it arrives.
	let tapped = $state<string | null>(null);
	let path = $derived(page.url.pathname);
	$effect(() => {
		path;
		tapped = null;
	});
	let here = $derived(tapped ?? path);
	let onPlanner = $derived(path === PLANNER_PATH);
	const is = (prefix: string) => (prefix === '/' ? here === '/' : here === prefix || here.startsWith(`${prefix}/`));
	const tap = (prefix: string) => () => {
		if (!('startViewTransition' in document)) tapped = prefix;
	};
</script>

{#if !onPlanner}
	<nav class="app-tabs" aria-label="Quick navigation" use:glide={{ selector: '[aria-current="page"] .tab-icon', name: 'tab-mark' }}>
		<a href="/" aria-current={is('/') ? 'page' : undefined} onclick={tap('/')}><span class="tab-icon"><House strokeWidth={1.9} /></span>Home</a>
		<a href="/tours" aria-current={is('/tours') ? 'page' : undefined} onclick={tap('/tours')}><span class="tab-icon"><Binoculars strokeWidth={1.9} /></span>Safaris</a>
		{#if canEnquire}
			<a class="tab-plan" href={planHref({ from: 'tab_bar' })} data-cta="plan_my_trip" data-cta-location="tab_bar"><span class="tab-icon"><NotebookPen strokeWidth={2} /></span>Plan</a>
		{:else}
			<a href="/destinations" aria-current={is('/destinations') ? 'page' : undefined} onclick={tap('/destinations')}><span class="tab-icon"><MapPinned strokeWidth={1.9} /></span>Places</a>
		{/if}
		<a href="/stays" aria-current={is('/stays') ? 'page' : undefined} onclick={tap('/stays')}><span class="tab-icon"><BedDouble strokeWidth={1.9} /></span>Stays</a>
		<a class="tab-chat" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" data-cta="whatsapp" data-cta-location="tab_bar"><span class="tab-icon"><MessageCircle strokeWidth={1.9} /></span>WhatsApp</a>
	</nav>
{/if}

<style>
	.app-tabs { display: none; }
	@media (max-width: 1023px) {
		.app-tabs {
			view-transition-name: app-tabs;
			position: fixed; inset-inline: 0; bottom: 0; z-index: 60;
			display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
			padding: 6px max(8px, env(safe-area-inset-left)) max(6px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-right));
			border-top: 1px solid rgb(43 39 34 / 0.08);
			background: rgb(255 255 255 / 0.97);
			box-shadow: 0 -10px 30px -24px rgb(43 39 34 / 0.45);
		}
		a {
			display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
			min-height: 54px; border-radius: var(--radius-control);
			color: #6f675c; font-size: 11px; font-weight: 600; line-height: 1.1; letter-spacing: 0.01em; text-decoration: none;
			-webkit-tap-highlight-color: transparent; transition: color 0.18s ease;
		}
		.tab-icon { display: grid; place-items: center; width: 48px; height: 30px; border-radius: 9px; transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
		/* The marker behind the current tab's icon; it glides between tabs. */
		.app-tabs :global(.glide-mark) { border-radius: 9px; background: color-mix(in oklch, var(--sun) 38%, white); }
		.tab-icon :global(svg) { width: 21px; height: 21px; }
		a[aria-current='page'] { color: var(--navy); font-weight: 700; }
		a[aria-current='page'] .tab-icon { transform: translateY(-1px); }
		/* The one primary action: always filled, a little larger. */
		.tab-plan { color: var(--navy); font-weight: 700; }
		.tab-plan .tab-icon { width: 50px; height: 32px; margin-top: -2px; background: var(--sun); box-shadow: 0 6px 14px -8px rgb(122 90 38 / 0.7); }
		.tab-chat .tab-icon { color: #128345; }
		a:active .tab-icon { transform: scale(0.92); transition-duration: 0.12s; }
		a:focus-visible { outline: 2px solid var(--navy); outline-offset: -2px; }
	}
	@media (max-width: 1023px) and (prefers-reduced-motion: reduce) { a:active .tab-icon, a[aria-current='page'] .tab-icon { transform: none; } }
</style>
