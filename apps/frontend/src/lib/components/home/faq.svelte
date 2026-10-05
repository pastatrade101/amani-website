<script lang="ts">
	import { ArrowUpRight } from '@lucide/svelte';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import { textContent } from '$lib/home-content';
	import type { HomepageSection } from '$lib/types/api';
	let { section, canEnquire, faqs = null }: { section: HomepageSection; canEnquire: boolean; faqs?: {question:string;answer:string}[] | null } = $props();
	const fallbackQuestions = [
		{ question: 'Can I customise my safari?', answer: 'Start with a destination or an itinerary that inspires you, then tell us about your dates, interests and budget. Our team can help shape a journey around your preferences.' },
		{ question: 'Can I combine a safari with Zanzibar?', answer: 'Yes. Share how you would like to balance wildlife experiences and time by the ocean, and we can discuss a route that brings both together.' },
		{ question: 'What if I don’t know where to start?', answer: 'You don’t need a complete plan. A rough idea of your dates, the number of travelers and what you would love to experience is a helpful starting point.' },
		{ question: 'What happens after I send an enquiry?', answer: 'Your ideas go to our team, who can follow up to discuss the trip. Sending an enquiry does not confirm a booking or take a payment.' }
	];
	let questions = $derived.by(() => {
		const own = section.extra_data?.faqs;
		const source = Array.isArray(own) && own.length ? own : faqs ?? fallbackQuestions;
		return source.filter(row => row && typeof row.question === 'string' && typeof row.answer === 'string').map(row => ({question: textContent(row.question),answer:textContent(row.answer)}));
	});
</script>
<section id="safari-questions" class="page-container faq-section">
	<div data-motion="reveal"><p class="eyebrow text-muted-foreground">{section.subtitle}</p><h2 class="section-heading mt-4">{section.title}</h2><p class="section-description mt-5">{textContent(section.content)}</p>{#if canEnquire}<a href="#request-quote" class="mt-6 inline-flex items-center gap-2 text-sm font-semibold">Ask our local team <ArrowUpRight class="size-4" /></a>{/if}</div>
	<Accordion.Root data-motion="reveal" type="single" class="faq-list">{#each questions as item, i}<Accordion.Item value={`question-${i}`}><Accordion.Trigger class="py-6 text-left text-sm font-semibold hover:no-underline">{item.question}</Accordion.Trigger><Accordion.Content class="pr-8 pb-6 text-[13px] leading-7 text-muted-foreground">{item.answer}</Accordion.Content></Accordion.Item>{/each}</Accordion.Root>
</section>
<style>
	.faq-section { display: grid; grid-template-columns: .8fr 1.2fr; align-items: start; gap: 100px; padding-block: 85px; }
	@media (max-width: 767px) { .faq-section { grid-template-columns: 1fr; gap: 25px; padding-block: 60px; } }
</style>
