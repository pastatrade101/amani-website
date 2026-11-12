<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { PHOTO } from '$lib/media-photos';
	import { safeUrl, textContent } from '$lib/home-content';
	import { offerHref, offerRowsFor, refreshSections } from '$lib/homepage-refresh';
	import type { Category, Destination, HomepageSection } from '$lib/types/api';

	// "What we offer": the four journeys travellers ask about most, one
	// editorial row each with the facts that decide them, photo side alternating.
	let { section, categories = [], destinations = [], canEnquire = true }: { section: HomepageSection; categories?: Category[]; destinations?: Destination[]; canEnquire?: boolean } = $props();

	let fallback = $derived(refreshSections.find((item) => item.section_key === 'safari_offers'));
	let rows = $derived(offerRowsFor(section));
	const extra = (key: string) => String(section.extra_data?.[key] ?? fallback?.extra_data?.[key] ?? '').trim();
	const paragraphs = (text: string) => text.split(/\n\s*\n/).map((part) => textContent(part)).filter(Boolean);
	let ctaHref = $derived.by(() => {
		const target = safeUrl(section.button_url, '#plan-form');
		return target === '#plan-form' && !canEnquire ? '/plan-my-trip' : target;
	});
</script>

{#if rows.length}
	<section id="safari-offers" class="home-band home-cream" aria-labelledby="offers-title">
		<div class="home-container">
			<header class="offers-head" data-motion="reveal">
				{#if section.subtitle}<p class="home-kicker">{section.subtitle}</p>{/if}
				<h2 id="offers-title" class="home-heading mt-4">{section.title}</h2>
				{#if textContent(section.content)}<p class="home-copy mt-4">{textContent(section.content)}</p>{/if}
			</header>

			<ol class="offers">
				{#each rows as row, i (row.title)}
					{@const href = offerHref(row, categories, destinations)}
					<li class="offer" class:flip={i % 2 === 1}>
						<a class="offer-photo" {href} tabindex="-1" aria-hidden="true" data-motion="image"><img src={safeUrl(row.image, PHOTO.popUpRoofView)} alt="" loading="lazy" width="1200" height="900" /></a>
						<div class="offer-copy" data-motion="reveal">
							<p class="offer-index">{String(i + 1).padStart(2, '0')}</p>
							<h3>{row.title}</h3>
							{#each paragraphs(row.text) as paragraph}<p class="offer-text">{paragraph}</p>{/each}
							{#if row.facts?.length}
								<dl class="offer-facts">
									{#each row.facts as fact}<div><dt>{fact.label}</dt><dd>{fact.value}</dd></div>{/each}
								</dl>
							{/if}
							<a class="offer-link" {href}>{row.cta_label || `Explore ${row.title}`}<ArrowRight aria-hidden="true" /></a>
						</div>
					</li>
				{/each}
			</ol>

			{#if extra('cta_title')}
				<div class="offers-cta" data-motion="reveal">
					<div><h3>{extra('cta_title')}</h3>{#if extra('cta_text')}<p>{extra('cta_text')}</p>{/if}</div>
					<Button variant="safari" class="h-12 shrink-0 px-7" href={ctaHref}>{section.button_text || 'Create My Safari'}<ArrowRight class="size-4" /></Button>
				</div>
			{/if}
		</div>
	</section>
{/if}

<style>
	.offers-head { padding-bottom: 48px; border-bottom: 1px solid #e3ddcf; }
	.offers-head > :global(*) { max-width: 46rem; }
	.offers { margin: 0; padding: 0; list-style: none; }
	.offer { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.08fr); gap: 72px; align-items: center; padding-block: 64px; }
	.offer + .offer { border-top: 1px solid #e3ddcf; }
	.offer.flip { grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr); }
	.offer.flip .offer-photo { order: 2; }
	.offer-photo { display: block; overflow: hidden; border-radius: var(--radius-surface); background: #e9e5da; }
	.offer-photo img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; transition: transform 0.7s cubic-bezier(0.22, 1, 0.36, 1); }
	.offer:hover .offer-photo img { transform: scale(1.035); }
	.offer-copy { max-width: 35rem; }
	.offer-index { display: flex; align-items: center; gap: 12px; margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.12em; color: #7a5a26; font-variant-numeric: tabular-nums; }
	.offer-index::before { content: ''; width: 26px; height: 2px; border-radius: 2px; background: var(--sun); }
	h3 { margin: 14px 0 0; font-size: clamp(24px, 2.2vw, 30px); font-weight: 650; line-height: 1.2; letter-spacing: -0.02em; color: var(--navy); }
	.offer-text { margin: 16px 0 0; font-size: 15px; line-height: 1.8; color: #574f45; }
	.offer-facts { display: grid; grid-template-columns: repeat(3, minmax(0, auto)); justify-content: start; gap: 12px 36px; margin: 26px 0 0; }
	.offer-facts dt { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #8a8174; }
	.offer-facts dd { margin: 4px 0 0; font-size: 14px; font-weight: 650; line-height: 1.4; color: var(--navy); }
	.offer-link { display: inline-flex; align-items: center; gap: 10px; margin-top: 28px; font-size: 14px; font-weight: 700; color: var(--navy); text-decoration: none; transition: color 0.2s ease; }
	.offer-link:hover { color: #7a5a26; }
	.offer-link :global(svg) { width: 16px; height: 16px; transition: transform 0.2s ease; }
	.offer-link:hover :global(svg) { transform: translateX(3px); }
	.offer-link:focus-visible { outline: 2px solid var(--sun); outline-offset: 4px; border-radius: 4px; }
	/* A quiet ending to the list, not another box. */
	.offers-cta { display: flex; flex-direction: column; align-items: center; gap: 22px; padding-top: 56px; border-top: 1px solid #e3ddcf; text-align: center; }
	.offers-cta h3 { margin: 0; font-size: clamp(22px, 2vw, 26px); }
	.offers-cta p { margin: 8px 0 0; font-size: 15px; line-height: 1.6; color: var(--muted-foreground); }
	@media (max-width: 1023px) { .offer, .offer.flip { gap: 44px; } }
	@media (max-width: 767px) {
		.offers-head { padding-bottom: 32px; }
		.offer, .offer.flip { grid-template-columns: 1fr; gap: 26px; padding-block: 40px; }
		.offer.flip .offer-photo { order: 0; }
		.offer-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 20px; }
		.offer-facts div:first-child { grid-column: 1 / -1; }
		.offers-cta { padding-top: 40px; }
	}
	@media (prefers-reduced-motion: reduce) { .offer:hover .offer-photo img, .offer-link:hover :global(svg) { transform: none; } }
</style>
