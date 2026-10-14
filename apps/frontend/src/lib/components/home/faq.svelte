<script lang="ts">
	import { ArrowUpRight } from '@lucide/svelte';
	import FaqList, { type FaqItem } from '$lib/components/faq/faq-list.svelte';
	import { textContent } from '$lib/home-content';
	import type { HomepageSection } from '$lib/types/api';

	// The section's heading comes from the homepage editor; its questions are the
	// ones the FAQ library places on the home page. None, no section.
	let { section, canEnquire, faqs = null }: { section: HomepageSection; canEnquire: boolean; faqs?: FaqItem[] | null } = $props();
</script>

{#if faqs?.length}
	<section id="safari-questions" class="page-container py-16 md:py-20" data-motion="reveal">
		<FaqList {faqs} eyebrow={section.subtitle ?? ''} title={section.title || 'Frequently Asked Questions'} intro={textContent(section.content)} />
		{#if canEnquire}<p class="mt-8 text-center"><a href="#request-quote" class="inline-flex items-center gap-2 text-sm font-semibold">Ask our local team <ArrowUpRight class="size-4" /></a></p>{/if}
	</section>
{/if}
