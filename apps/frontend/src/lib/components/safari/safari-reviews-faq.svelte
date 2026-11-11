<script lang="ts">
	import { ArrowUpRight, Compass, MessageCircle } from '@lucide/svelte';
	import RichText from '$lib/components/tours/rich-text.svelte';
	import { safeUrl, textContent } from '$lib/home-content';
	import { siteInfo } from '$lib/site-info';
	import type { GuestReview } from '$lib/homepage-guides';
	import type { FaqItem } from '$lib/components/faq/faq-list.svelte';
	import type { TourDetail } from '$lib/types/api';

	// Approved guest reviews, the "plan your safari" card (with the tour's
	// specialist when one is assigned) and the questions the FAQ library places
	// on this tour.
	let { tour, reviews, faqs, title, quoteHref, whatsapp, onEnquire }: { tour: TourDetail; reviews: GuestReview[]; faqs: FaqItem[]; title: string; quoteHref: string; whatsapp: string; onEnquire: () => void } = $props();

	const LIMIT = 300;
	let open = $state<string[]>([]);
	const plain = (text: string) => textContent(text);
	const expandable = (review: GuestReview) => plain(review.message).length > LIMIT;
	const shown = (review: GuestReview) => (open.includes(review.id) || !expandable(review) ? plain(review.message) : `${plain(review.message).slice(0, LIMIT).replace(/\s+\S*$/, '')}…`);
	const stars = (rating: number) => Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
	let expert = $derived(tour.specialist?.status === 'published' ? tour.specialist : null);
	let photo = $derived(expert?.photo_url ? safeUrl(expert.photo_url, '') : '');
	let questions = $derived(faqs.filter((faq) => faq?.question?.trim() && faq?.answer?.trim()));
</script>

<section id="reviews" class="sp-section sp-cream reviews-faq" aria-label="Reviews and questions">
	{#if reviews.length}
		<div class="sp-head">
			<p class="sp-eyebrow">Memories from the wild</p>
			<h2 class="sp-h2">Stories worth bringing home.</h2>
			<p class="sp-sub">What travellers say about their safari with {siteInfo.brand}.</p>
		</div>
		<ul class="review-grid">
			{#each reviews as review (review.id)}
				<li class="review">
					<p class="stars" aria-label={`Rated ${stars(review.rating)} out of 5`}>{'★'.repeat(stars(review.rating))}</p>
					<blockquote>“{shown(review)}”</blockquote>
					{#if expandable(review)}<button type="button" class="read" aria-expanded={open.includes(review.id)} onclick={() => (open = open.includes(review.id) ? open.filter((id) => id !== review.id) : [...open, review.id])}>{open.includes(review.id) ? 'Show less' : 'Read full review'}</button>{/if}
					<div class="reviewer">
						<span class="avatar" aria-hidden="true">{review.author_name.trim().charAt(0).toUpperCase()}</span>
						<div><strong>{review.author_name}</strong>{#if review.country || review.platform}<small>{[review.country, review.platform ? `Reviewed on ${review.platform}` : ''].filter(Boolean).join(' · ')}</small>{/if}</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	<div id="safari-booking" class="booking" class:first={!reviews.length}>
		{#if photo}<img class="sales-photo" src={photo} alt={expert?.name ?? ''} loading="lazy" width="127" height="127" />{:else}<span class="sales-photo placeholder" aria-hidden="true"><Compass /></span>{/if}
		<div>
			<p class="eyebrow">Let’s plan your journey</p>
			<h2>{title}</h2>
			<p class="booking-intro">{expert ? `Share your dates and travel style with ${expert.name}${expert.role ? `, ${expert.role}` : ''}.` : 'Share your dates and travel style with our safari team.'}</p>
			<div class="booking-action">
				<a class="sp-btn sp-btn-sun" href={quoteHref} onclick={onEnquire}>Enquire about this safari <ArrowUpRight aria-hidden="true" /></a>
				<a class="sp-btn sp-btn-whatsapp" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />WhatsApp</a>
			</div>
			<p class="booking-note">An enquiry, with no obligation to book.</p>
		</div>
	</div>

	{#if questions.length}
		<div class="sp-head">
			<p class="sp-eyebrow">Before you go</p>
			<h2 class="sp-h2">A few things you might be wondering.</h2>
		</div>
		<div class="faq-layout">
			<div class="faq-intro">
				<p>Planning your first safari or fine-tuning the details? Here are answers to the questions that help shape this journey.</p>
				<a href={quoteHref} onclick={onEnquire}>Talk to a safari specialist <ArrowUpRight aria-hidden="true" /></a>
			</div>
			<div class="faq-list">
				{#each questions as faq, i (faq.id ?? i)}
					<details open={i === 0}>
						<summary>{faq.question}</summary>
						<div class="answer"><RichText value={faq.answer} class="sp-rich" /></div>
					</details>
				{/each}
			</div>
		</div>
	{/if}
</section>

<style>
	.review-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; margin: 0 0 48px; padding: 0; list-style: none; }
	.review { display: flex; flex-direction: column; min-width: 0; padding: 26px; border: 1px solid var(--sp-line); border-radius: 20px; background: #fff; }
	.stars { margin: 0 0 16px; font-size: 17px; letter-spacing: 3px; color: var(--sp-green); }
	blockquote { flex: 1; margin: 0 0 14px; font-size: 15px; line-height: 1.8; color: var(--sp-muted); overflow-wrap: anywhere; }
	.read { align-self: flex-start; margin: 0 0 18px; padding: 4px 0; border: 0; background: none; color: var(--sp-ink); font: 600 14px var(--sp-sans); cursor: pointer; }
	.read:hover, .faq-intro a:hover { color: #7b6500; }
	.reviewer { display: flex; align-items: center; gap: 12px; margin-top: auto; padding-top: 18px; border-top: 1px solid var(--sp-line-soft); }
	.avatar { display: grid; flex-shrink: 0; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: #f3edce; color: #6a5a1c; font-size: 16px; font-weight: 600; }
	.reviewer strong { display: block; font-size: 15px; font-weight: 600; color: var(--sp-ink); }
	.reviewer small { display: block; margin-top: 3px; font-size: 13px; color: var(--sp-muted); }

	.booking { display: grid; grid-template-columns: 150px minmax(0, 1fr); align-items: center; gap: 32px; max-width: 860px; margin: 0 auto 64px; padding: 34px 40px; border: 1px solid var(--sp-line); border-radius: 24px; background: #fff; color: var(--sp-ink); scroll-margin-top: 100px; }
	.booking.first { margin-top: 0; }
	.sales-photo { width: 150px; height: 150px; padding: 7px; border-radius: 50%; background: #fff0ad; object-fit: cover; object-position: 50% 30%; }
	.sales-photo.placeholder { display: grid; place-items: center; color: #98723c; }
	.sales-photo.placeholder :global(svg) { width: 46px; height: 46px; }
	.eyebrow { margin: 0 0 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--sp-kicker); }
	.booking h2 { margin: 0 0 10px; font-size: clamp(24px, 2.2vw, 30px); font-weight: 650; line-height: 1.2; letter-spacing: -0.025em; }
	.booking-intro { margin: 0 0 20px; font-size: 15px; line-height: 1.75; color: var(--sp-muted); }
	.booking-action { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
	.booking-note { margin: 12px 0 0; font-size: 13px; color: var(--sp-muted); }

	.faq-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.8fr); gap: 64px; }
	.faq-intro p { margin: 0 0 20px; font-size: 15px; line-height: 1.85; color: var(--sp-muted); }
	.faq-intro a { display: inline-flex; align-items: center; gap: 8px; color: var(--sp-ink); font-size: 14px; font-weight: 600; text-decoration: none; }
	.faq-intro a :global(svg) { width: 16px; height: 16px; }
	details { border-bottom: 1px solid var(--sp-line); }
	details:first-child { border-top: 1px solid var(--sp-line); }
	summary { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 22px 0; list-style: none; cursor: pointer; font-size: 16px; font-weight: 600; line-height: 1.5; color: var(--sp-ink); }
	summary::-webkit-details-marker { display: none; }
	summary::after { content: '+'; flex-shrink: 0; font-size: 24px; font-weight: 400; line-height: 1; color: var(--sp-muted); }
	details[open] summary::after { content: '−'; color: #98723c; }
	.answer { padding: 0 32px 22px 0; }
	.answer :global(.sp-rich.rich-text) { font-size: 15px; }
	@media (max-width: 960px) { .review-grid { grid-template-columns: 1fr; gap: 16px; } .faq-layout { grid-template-columns: 1fr; gap: 26px; } }
	@media (max-width: 767px) { .review { padding: 22px; } .review-grid { margin-bottom: 40px; } .booking { margin-bottom: 48px; } }
	@media (max-width: 600px) {
		.booking { grid-template-columns: 1fr; justify-items: start; gap: 18px; padding: 24px; }
		.sales-photo { width: 96px; height: 96px; padding: 5px; }
	}
</style>
