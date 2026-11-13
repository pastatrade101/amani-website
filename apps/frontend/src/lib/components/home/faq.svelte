<script lang="ts">
	import { ArrowRight, MessageCircle } from '@lucide/svelte';
	import FaqList, { type FaqItem } from '$lib/components/faq/faq-list.svelte';
	import { textContent } from '$lib/home-content';
	import { WHATSAPP_URL } from '$lib/homepage-refresh';
	import type { HomepageSection } from '$lib/types/api';

	// The section's heading comes from the homepage editor; its questions are the
	// ones the FAQ library places on the home page. None, no section.
	let { section, canEnquire, faqs = null }: { section: HomepageSection; canEnquire: boolean; faqs?: FaqItem[] | null } = $props();
</script>

{#if faqs?.length}
	<section id="safari-questions" class="home-band" aria-labelledby="faq-title">
		<div class="home-container faq-layout">
			<div class="faq-side">
				<header class="faq-head" data-motion="reveal">
					<h2 id="faq-title" class="home-heading">{section.title || 'Frequently Asked Questions'}</h2>
					{#if textContent(section.content)}<p class="home-copy mt-4">{textContent(section.content)}</p>{/if}
				</header>
				<div class="faq-help">
					<h3>Still have a question?</h3>
					<p>Ask our local team, or tell us about your trip and get a free quote.</p>
					<div class="faq-actions">
						<a class="faq-btn chat" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" data-cta="whatsapp" data-cta-location="faq"><MessageCircle aria-hidden="true" />Ask on WhatsApp</a>
						{#if canEnquire}<a class="faq-btn quote" href="#request-quote">Get a free quote<ArrowRight aria-hidden="true" /></a>{/if}
					</div>
				</div>
			</div>
			<div class="faq-main" data-motion="reveal"><FaqList {faqs} list /></div>
		</div>
	</section>
{/if}

<style>
	.faq-layout { display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 88px; align-items: start; }
	/* The heading and the way to ask stay in view while the questions scroll. */
	.faq-side { position: sticky; top: calc(var(--site-header-height) + 40px); }
	.faq-help { margin-top: 36px; padding: 26px 26px 28px; border-radius: var(--radius-surface); background: #f7f5ef; }
	.faq-help h3 { margin: 0; font-size: var(--text-lg); font-weight: 650; color: var(--navy); }
	.faq-help p { margin: 6px 0 0; font-size: var(--text-sm); line-height: 1.6; color: var(--muted-foreground); }
	.faq-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
	.faq-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 10px 18px; border-radius: var(--radius-control); font-size: var(--text-sm); font-weight: 700; text-decoration: none; transition: background-color 0.2s ease, border-color 0.2s ease; }
	.faq-btn :global(svg) { width: 17px; height: 17px; }
	.faq-btn.chat { border: 1px solid #cfe5d5; background: #fff; color: #128345; }
	.faq-btn.chat:hover { background: #f3faf5; }
	.faq-btn.quote { background: var(--sun); color: #2b2722; }
	.faq-btn.quote:hover { background: color-mix(in oklab, var(--sun) 90%, black); }
	.faq-btn:focus-visible { outline: 2px solid var(--navy); outline-offset: 3px; }
	@media (max-width: 1023px) { .faq-layout { gap: 48px; } }
	/* Phones and tablets: heading, the questions, then the way to ask. */
	@media (max-width: 860px) {
		.faq-layout { display: flex; flex-direction: column; gap: 28px; }
		.faq-side { display: contents; }
		.faq-head { order: 0; }
		.faq-main { order: 1; }
		.faq-help { order: 2; margin-top: 0; padding: 22px 20px; }
		.faq-actions { display: grid; grid-template-columns: 1fr 1fr; }
	}
	@media (max-width: 420px) { .faq-actions { grid-template-columns: 1fr; } }
</style>
