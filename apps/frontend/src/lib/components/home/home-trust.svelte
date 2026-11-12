<script lang="ts">
	import { ArrowDown, Compass, MessagesSquare, ReceiptText, ShieldCheck } from '@lucide/svelte';
	import { textContent } from '$lib/home-content';
	import { refreshSections } from '$lib/homepage-refresh';
	import type { HomepageSection } from '$lib/types/api';

	// Why book with us: the reasoning on the left, the four promises on the
	// right, then on to what guests say.
	let { section, hasReviews = false }: { section: HomepageSection; hasReviews?: boolean } = $props();

	let fallback = $derived(refreshSections.find((item) => item.section_key === 'trust_features'));
	type Row = { title: string; text: string };
	let rows = $derived(((Array.isArray(section.extra_data?.rows) ? section.extra_data.rows : fallback?.extra_data?.rows) as Row[] | undefined ?? []).filter((row) => row?.title?.trim()));
	const icons = [Compass, MessagesSquare, ReceiptText, ShieldCheck];
</script>

{#if rows.length}
	<section class="home-band" aria-labelledby="trust-title">
		<div class="home-container trust">
			<div class="trust-copy" data-motion="reveal">
				{#if section.subtitle}<p class="home-kicker">{section.subtitle}</p>{/if}
				<h2 id="trust-title" class="home-heading mt-4">{section.title}</h2>
				{#if textContent(section.content)}<p class="home-copy mt-5">{textContent(section.content)}</p>{/if}
				{#if hasReviews}<a class="trust-link" href="#reviews-section">Read what our guests say <ArrowDown aria-hidden="true" /></a>{/if}
			</div>
			<ul class="trust-points">
				{#each rows as row, i}
					{@const Icon = icons[i % icons.length]}
					<li data-motion="reveal">
						<span class="trust-icon" aria-hidden="true"><Icon strokeWidth={1.7} /></span>
						<h3>{row.title}</h3>
						{#if row.text}<p>{row.text}</p>{/if}
					</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}

<style>
	.trust { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 80px; align-items: center; }
	.trust-copy { max-width: 34rem; }
	.trust-link { display: inline-flex; align-items: center; gap: 10px; margin-top: 26px; font-size: 14px; font-weight: 700; color: var(--navy); text-decoration: none; transition: color 0.2s ease; }
	.trust-link:hover { color: #7a5a26; }
	.trust-link :global(svg) { width: 16px; height: 16px; transition: transform 0.2s ease; }
	.trust-link:hover :global(svg) { transform: translateY(2px); }
	.trust-points { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 44px 48px; margin: 0; padding: 0; list-style: none; }
	.trust-icon { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 10px; background: color-mix(in oklch, var(--sun) 22%, white); color: #7a5a26; }
	.trust-icon :global(svg) { width: 22px; height: 22px; }
	h3 { margin: 22px 0 0; font-size: 17px; font-weight: 650; line-height: 1.3; color: var(--navy); }
	.trust-points p { margin: 8px 0 0; font-size: 14px; line-height: 1.65; color: var(--muted-foreground); }
	@media (max-width: 1023px) { .trust { grid-template-columns: 1fr; gap: 40px; } .trust-copy { max-width: 44rem; } }
	@media (max-width: 600px) {
		.trust-points { grid-template-columns: 1fr; }
		.trust-points { gap: 28px; }
		.trust-points li { display: grid; grid-template-columns: auto 1fr; column-gap: 16px; }
		.trust-icon { grid-row: span 2; width: 42px; height: 42px; }
		h3 { margin-top: 2px; }
		.trust-points p { margin-top: 4px; }
	}
	@media (prefers-reduced-motion: reduce) { .trust-link:hover :global(svg) { transform: none; } }
</style>
