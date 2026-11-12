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
		<div class="home-container">
			<header class="reviews-head" data-motion="reveal">
				<h2 id="reviews-title" class="home-heading">{title.before}{#if title.mark}<span class="mark">{title.mark}</span>{/if}{title.after}</h2>
				<p class="reviews-rating">
					{#if reviewAverage}<span class="stars" role="img" aria-label={`${reviewAverage} out of 5 stars`}>{#each Array(5) as _, i}<Star size={17} strokeWidth={0} fill={i < stars ? 'currentColor' : '#d9d4ca'} aria-hidden="true" />{/each}</span><strong>{reviewAverage.toFixed(1)}</strong><span class="sep" aria-hidden="true"></span>{/if}
					<span>{reviewTotal} guest {reviewTotal === 1 ? 'review' : 'reviews'}</span><span class="sep" aria-hidden="true"></span>
					<a href={profile} target="_blank" rel="noopener noreferrer">View us on Tripadvisor<ArrowUpRight aria-hidden="true" /></a>
				</p>
			</header>
			<div class="reviews-body" data-motion="reveal">
				{#snippet aside()}
					<div class="reviews-aside">
						<span class="quote" aria-hidden="true">“</span>
						<h3>What our guests are saying</h3>
					</div>
				{/snippet}
				<GuestReviews {reviews} total={reviewTotal} variant="home" {aside} />
			</div>
		</div>
	</section>
{/if}

<style>
	.reviews-head { text-align: center; }
	.mark { color: #9a6a2f; }
	.reviews-rating { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 12px; margin: 16px 0 0; font-size: 14px; color: var(--muted-foreground); }
	.stars { display: inline-flex; gap: 3px; color: #22a352; }
	.reviews-rating strong { font-weight: 700; color: var(--navy); }
	.sep { width: 1px; height: 14px; background: #d9d4ca; }
	.reviews-rating a { display: inline-flex; align-items: center; gap: 5px; font-weight: 700; color: var(--navy); text-decoration: none; transition: color 0.2s ease; }
	.reviews-rating a:hover { color: #7a5a26; }
	.reviews-rating a :global(svg) { width: 15px; height: 15px; }
	.reviews-body { margin-top: 48px; }
	.quote { display: block; height: 64px; font-family: Georgia, 'Times New Roman', serif; font-size: 112px; line-height: 1; color: #9a6a2f; }
	.reviews-aside h3 { max-width: 12ch; margin: 18px 0 0; font-size: clamp(22px, 2vw, 28px); font-weight: 650; line-height: 1.22; letter-spacing: -0.02em; color: var(--navy); }
	@media (max-width: 900px) {
		.reviews-body { margin-top: 32px; }
		.quote { height: 40px; font-size: 76px; }
		.reviews-aside h3 { margin-top: 8px; max-width: 14ch; }
	}
	/* Phones: the link takes its own line, so no divider is left hanging. */
	@media (max-width: 600px) { .sep { display: none; } .reviews-rating a { flex-basis: 100%; justify-content: center; } }
</style>
