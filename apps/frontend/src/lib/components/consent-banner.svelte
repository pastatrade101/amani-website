<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { Cookie } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { consent, setConsent } from '$lib/admin/consent';
	import { tagMode } from '$lib/tracking/tags';

	// Shown only once the page is live, and only while a Google tag is configured
	// and the visitor has not chosen yet. Without a tag there is nothing to ask about.
	let mounted = $state(false);
	let hasTags = $state(false);
	onMount(() => {
		hasTags = tagMode() !== null;
		mounted = true;
	});
</script>

{#if mounted && hasTags && $consent === null}
	<!-- The strip lets clicks through beside the card. -->
	<div class="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4 sm:bottom-8" transition:fly={{ y: 24, duration: 240 }}>
		<div role="dialog" aria-label="Cookie choices" class="pointer-events-auto w-full max-w-2xl rounded-2xl border border-border bg-white p-4 shadow-[0_24px_70px_-20px_rgba(16,45,65,.35)] sm:p-5">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
				<div class="flex min-w-0 items-start gap-3">
					<span class="grid size-10 shrink-0 place-items-center rounded-xl bg-sun/20 text-navy"><Cookie class="size-5" /></span>
					<p class="text-sm leading-6 text-muted-foreground">We’d like to use Google analytics and advertising cookies to understand how our site is used and to measure our campaigns. They’re only set if you accept.</p>
				</div>
				<div class="grid shrink-0 grid-cols-2 gap-2 sm:flex">
					<Button variant="outline" class="h-11 px-5" onclick={() => setConsent('denied')}>Decline</Button>
					<Button variant="safari" class="h-11 px-5" onclick={() => setConsent('granted')}>Accept</Button>
				</div>
			</div>
		</div>
	</div>
{/if}
