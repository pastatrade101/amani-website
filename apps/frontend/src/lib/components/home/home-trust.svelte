<script lang="ts">
	import { ArrowDown } from '@lucide/svelte';
	import { PHOTO } from '$lib/media-photos';
	import { safeUrl, textContent } from '$lib/home-content';
	import { refreshSections } from '$lib/homepage-refresh';
	import { scrollcraft } from '$lib/motion/scrollcraft';
	import type { HomepageSection } from '$lib/types/api';

	// Why book with us: the heading and the reasoning side by side, a wide photo
	// of our own vehicle on the road, then the four promises on a panel that
	// rests over the photo's lower edge. ScrollCraft lets the photo drift a
	// little slower than the page on larger screens, so the panel reads as
	// sitting in front of it.
	let { section, hasReviews = false }: { section: HomepageSection; hasReviews?: boolean } = $props();

	let fallback = $derived(refreshSections.find((item) => item.section_key === 'trust_features'));
	type Row = { title: string; text: string };
	let rows = $derived(((Array.isArray(section.extra_data?.rows) ? section.extra_data.rows : fallback?.extra_data?.rows) as Row[] | undefined ?? []).filter((row) => row?.title?.trim()));
	let image = $derived(safeUrl(section.image_url, PHOTO.vehicleAbovePlains));
</script>

{#if rows.length}
	<section class="home-band trust" aria-labelledby="trust-title" use:scrollcraft={{ query: '(min-width: 768px) and (prefers-reduced-motion: no-preference)' }}>
		<div class="home-container" data-sc-act="flow">
			<div class="trust-top" data-motion="reveal">
				<h2 id="trust-title" class="home-heading">{section.title}</h2>
				<div>
					{#if textContent(section.content)}<p class="trust-lede">{textContent(section.content)}</p>{/if}
					{#if hasReviews}<a class="home-see-all trust-link" href="#reviews-section">Read what our guests say <ArrowDown /></a>{/if}
				</div>
			</div>
			<figure class="trust-photo" data-motion="image">
				<img src={image} alt={image === PHOTO.vehicleAbovePlains ? 'A Key2africa safari vehicle on the road above the plains' : ''} loading="lazy" width="1600" height="900" data-sc-parallax="1" />
			</figure>
			<ul class="trust-points">
				{#each rows as row}
					<li><h3>{row.title}</h3>{#if row.text}<p>{row.text}</p>{/if}</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}

<style>
	.trust-top { display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: 32px 80px; align-items: start; }
	.trust-top .home-heading { max-width: 13ch; }
	.trust-lede { margin: 6px 0 0; font-size: 16px; line-height: 1.8; color: #574f45; }
	.trust-link { margin-top: 14px; }
	.trust-link :global(svg) { transform: none; }
	.trust-link:hover :global(svg) { transform: translateY(2px); }
	.trust-photo { position: relative; margin: 48px 0 0; overflow: hidden; border-radius: var(--radius-surface); background: #e9e5da; aspect-ratio: 21 / 9; }
	/* Taller than the frame, so the drift never shows an edge. */
	.trust-photo img { position: absolute; inset: -56px 0; width: 100%; height: calc(100% + 112px); object-fit: cover; object-position: 50% 55%; }
	/* The promises sit on one panel over the photo's lower edge, ruled into four. */
	.trust-points { position: relative; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: -88px 32px 0; padding: 0; list-style: none; border-radius: var(--radius-surface); background: white; box-shadow: 0 30px 60px -40px rgb(31 27 22 / 0.5), 0 2px 8px -4px rgb(31 27 22 / 0.12); }
	.trust-points li { padding: 30px 28px 32px; }
	.trust-points li + li { box-shadow: inset 1px 0 #ebe6da; }
	h3 { margin: 0; font-size: 17px; font-weight: 650; line-height: 1.3; color: var(--navy); }
	.trust-points p { margin: 8px 0 0; font-size: 14px; line-height: 1.65; color: var(--muted-foreground); }
	@media (max-width: 1023px) {
		.trust-top { grid-template-columns: 1fr; }
		.trust-photo { aspect-ratio: 16 / 9; }
		.trust-points { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-inline: 20px; }
		.trust-points li:nth-child(3) { box-shadow: inset 0 1px #ebe6da; }
		.trust-points li:nth-child(4) { box-shadow: inset 1px 0 #ebe6da, inset 0 1px #ebe6da; }
	}
	@media (max-width: 600px) {
		.trust-photo { margin-top: 32px; aspect-ratio: 4 / 3; }
		.trust-points { grid-template-columns: 1fr; margin: -48px 12px 0; }
		.trust-points li { padding: 20px 20px 22px; }
		.trust-points li + li, .trust-points li:nth-child(4) { box-shadow: inset 0 1px #ebe6da; }
	}
	@media (prefers-reduced-motion: reduce) { .trust-link:hover :global(svg) { transform: none; } }
</style>
