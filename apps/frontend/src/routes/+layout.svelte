<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { setupSiteMotion } from '$lib/motion/site-motion';
	onMount(() => setupSiteMotion());
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
