<script lang="ts">
	import { ArrowUpRight, Star } from '@lucide/svelte';
	import GuestReviews from './guest-reviews.svelte';
	import { TRIPADVISOR_URL } from '$lib/homepage-refresh';
	import { safeUrl } from '$lib/home-content';
	import type { HomepageSection } from '$lib/types/api';
	import type { GuestReview } from '$lib/homepage-guides';

	// Guest proof: the average of the approved reviews, then the reviews
	// themselves two at a time, with the arrows beside the heading.
	let { section, reviews, reviewTotal, reviewAverage = null }: { section: HomepageSection; reviews: GuestReview[]; reviewTotal: number; reviewAverage?: number | null } = $props();

	let title = $derived.by(() => {
		const text = section.title || 'Reviews from real people';
		const mark = String(section.extra_data?.title_highlight ?? 'real people').trim();
		const at = mark ? text.lastIndexOf(mark) : -1;
		return at < 0 ? { before: text, mark: '', after: '' } : { before: text.slice(0, at), mark, after: text.slice(at + mark.length) };
	});
	let profile = $derived(safeUrl(String(section.extra_data?.reviews_url ?? TRIPADVISOR_URL), TRIPADVISOR_URL));
	let stars = $derived(Math.round(reviewAverage ?? 5));
</script>

{#if reviews.length}
	<section id="reviews-section" class="home-band home-cream" aria-labelledby="reviews-title">
		<div class="home-container" data-motion="reveal">
			{#snippet aside()}
				<div class="reviews-aside">
					<h2 id="reviews-title" class="home-heading">{title.before}{#if title.mark}<span class="mark">{title.mark}</span>{/if}{title.after}</h2>
					<div class="score">
						{#if reviewAverage}<strong class="score-value">{reviewAverage.toFixed(1)}</strong>{/if}
						<div class="score-meta">
							{#if reviewAverage}<span class="stars" role="img" aria-label={`${reviewAverage.toFixed(1)} out of 5 stars`}>{#each Array(5) as _, i}<Star size={16} strokeWidth={0} fill={i < stars ? 'currentColor' : '#d9d4ca'} aria-hidden="true" />{/each}</span>{/if}
							<span>{reviewTotal} guest {reviewTotal === 1 ? 'review' : 'reviews'}</span>
						</div>
					</div>
					<a class="home-see-all" href={profile} target="_blank" rel="noopener noreferrer">View us on Tripadvisor <ArrowUpRight /></a>
				</div>
			{/snippet}
			<GuestReviews {reviews} total={reviewTotal} variant="home" {aside} />
		</div>
	</section>
{/if}

<style>
	.mark { color: #9a6a2f; }
	.reviews-aside .home-heading { max-width: 11ch; }
	.score { display: flex; align-items: center; gap: 16px; margin-top: 28px; }
	.score-value { font-family: var(--font-display); font-size: 56px; font-weight: 600; line-height: 1; letter-spacing: -0.04em; color: var(--navy); font-variant-numeric: tabular-nums; }
	.score-meta { display: grid; gap: 6px; font-size: 14px; color: var(--muted-foreground); }
	.stars { display: inline-flex; gap: 3px; color: #22a352; }
	.reviews-aside .home-see-all { margin-top: 18px; }
	@media (max-width: 900px) {
		.reviews-aside { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; column-gap: 20px; }
		.reviews-aside .home-heading { grid-column: 1 / -1; max-width: none; }
		.score { margin-top: 20px; }
		.score-value { font-size: 44px; }
		.reviews-aside .home-see-all { margin-top: 0; font-size: 13px; }
	}
	/* Phones: the score above the link, so neither squeezes the other. */
	@media (max-width: 480px) {
		.reviews-aside { grid-template-columns: minmax(0, 1fr); }
		.score { margin-top: 18px; }
		.reviews-aside .home-see-all { margin-top: 14px; }
	}
</style>
