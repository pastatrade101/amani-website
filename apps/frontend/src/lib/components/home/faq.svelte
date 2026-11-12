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
		<div class="home-container" data-motion="reveal">
			<FaqList {faqs}>
				{#snippet head()}
					<header class="faq-head">
						{#if section.subtitle}<p class="home-kicker">{section.subtitle}</p>{/if}
						<h2 id="faq-title" class="home-heading mt-4">{section.title || 'Frequently Asked Questions'}</h2>
						{#if textContent(section.content)}<p class="home-copy mt-3">{textContent(section.content)}</p>{/if}
					</header>
				{/snippet}
			</FaqList>
			<div class="faq-help">
				<div><h3>Still have a question?</h3><p>Ask our local team, or tell us about your trip and get a free quote.</p></div>
				<div class="faq-actions">
					<a class="faq-btn chat" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />Ask on WhatsApp</a>
					{#if canEnquire}<a class="faq-btn quote" href="#request-quote">Get a free quote<ArrowRight aria-hidden="true" /></a>{/if}
				</div>
			</div>
		</div>
	</section>
{/if}

<style>
	.faq-head { max-width: 44rem; margin-inline: auto; text-align: center; }
	.faq-head :global(.home-kicker) { justify-content: center; }
	.faq-help { display: flex; align-items: center; justify-content: space-between; gap: 20px 40px; margin-top: 40px; padding: 28px 32px; border-radius: var(--radius-surface); background: #f7f5ef; }
	.faq-help h3 { margin: 0; font-size: 18px; font-weight: 650; color: var(--navy); }
	.faq-help p { margin: 4px 0 0; font-size: 14px; line-height: 1.6; color: var(--muted-foreground); }
	.faq-actions { display: flex; flex-wrap: wrap; gap: 12px; flex: none; }
	.faq-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 10px 20px; border-radius: var(--radius-control); font-size: 14px; font-weight: 700; text-decoration: none; transition: background-color 0.2s ease, border-color 0.2s ease; }
	.faq-btn :global(svg) { width: 17px; height: 17px; }
	.faq-btn.chat { border: 1px solid #cfe5d5; background: #fff; color: #128345; }
	.faq-btn.chat:hover { background: #f3faf5; }
	.faq-btn.quote { background: var(--sun); color: #2b2722; }
	.faq-btn.quote:hover { background: color-mix(in oklab, var(--sun) 90%, black); }
	.faq-btn:focus-visible { outline: 2px solid var(--navy); outline-offset: 3px; }
	@media (max-width: 767px) { .faq-help { flex-direction: column; align-items: stretch; padding: 22px 20px; } .faq-actions { flex-direction: column; } }
</style>
