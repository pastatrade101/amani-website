<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { setupSiteMotion } from '$lib/motion/site-motion';
	import { safeUrl } from '$lib/home-content';
	onMount(() => setupSiteMotion());
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();
	// CMS favicon when one is set; the built-in mark otherwise.
	let icon = $derived(safeUrl(data.branding?.favicon_url, ''));
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
