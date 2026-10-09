<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { setupSiteMotion } from '$lib/motion/site-motion';
	import { safeUrl } from '$lib/home-content';
	import ConsentBanner from '$lib/components/consent-banner.svelte';
	import { consent } from '$lib/admin/consent';
	import { trackPageView, trackSession } from '$lib/admin/analytics';
	import { rememberFirstTouch } from '$lib/tracking/attribution';
	import { isAdminPath } from '$lib/tracking/host';
	import { installLinkTracking } from '$lib/tracking/link-tracking';
	import { initTags } from '$lib/tracking/tags';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();
	// CMS favicon when one is set; the built-in mark otherwise.
	let icon = $derived(safeUrl(data.branding?.favicon_url, ''));
	let isPublic = $derived(!isAdminPath(page.url.pathname));

	onMount(() => {
		const motion = setupSiteMotion();
		// Google tags, campaign attribution and click tracking: public pages only,
		// and the live site only (each module checks the host itself).
		if (isAdminPath(window.location.pathname)) return motion;
		initTags();
		trackSession();
		const stopLinks = installLinkTracking();
		const stopConsent = consent.subscribe((value) => value === 'granted' && rememberFirstTouch());
		return () => {
			stopLinks();
			stopConsent();
			motion();
		};
	});
	// Runs for the first page too: the tags are set not to send their own page view.
	afterNavigate(({ to }) => {
		if (to && !isAdminPath(to.url.pathname)) trackPageView();
	});
</script>

<svelte:head>
	{#if icon}
		<link rel="icon" href={icon} />
		<link rel="apple-touch-icon" href={icon} />
	{:else}
		<link rel="icon" href={favicon} />
	{/if}
</svelte:head>

{@render children()}
{#if isPublic}<ConsentBanner />{/if}
