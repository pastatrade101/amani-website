<script lang="ts">
	import { ArrowUpRight, CalendarDays, Compass, MapPin, MessageCircle, Tag } from '@lucide/svelte';
	import RichText from '$lib/components/tours/rich-text.svelte';
	import { safeUrl, textContent } from '$lib/home-content';
	import { formatPrice } from '$lib/safari-pricing';
	import { siteInfo } from '$lib/site-info';
	import type { GuestReview } from '$lib/homepage-guides';
	import type { FaqItem } from '$lib/components/faq/faq-list.svelte';
	import type { TourDetail } from '$lib/types/api';

	// Approved guest reviews, the "plan your safari" card (with the tour's
	// specialist when one is assigned, the trip's facts and one of its photos)
	// and the questions the FAQ library places on this tour.
	let { tour, reviews, faqs, title, quoteHref, whatsapp, onEnquire, image = '', from = null }: { tour: TourDetail; reviews: GuestReview[]; faqs: FaqItem[]; title: string; quoteHref: string; whatsapp: string; onEnquire: () => void; image?: string; from?: { amount: number; currency: string } | null } = $props();

	// Only what the CMS holds: length, where it starts and ends, the lowest price.
	let facts = $derived.by(() => {
		const list: { icon: typeof CalendarDays; label: string; value: string }[] = [];
		const days = Math.round(Number(tour.duration_days) || 0);
		const nights = Math.round(Number(tour.duration_nights) || 0);
		if (days > 0) list.push({ icon: CalendarDays, label: 'Length', value: `${days} ${days === 1 ? 'day' : 'days'}${nights > 0 ? ` · ${nights} ${nights === 1 ? 'night' : 'nights'}` : ''}` });
		const start = tour.start_point?.name?.trim();
		const end = tour.end_point?.name?.trim();
		if (start || end) list.push({ icon: MapPin, label: start && end && start !== end ? 'Starts · ends' : start && end ? 'Starts & ends' : start ? 'Starts' : 'Ends', value: start && end && start !== end ? `${start} → ${end}` : (start || end)! });
		if (from && from.amount > 0) list.push({ icon: Tag, label: 'From', value: `${formatPrice(from.amount, from.currency)} per person` });
		return list;
	});

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

	<div id="safari-booking" class="booking" class:first={!reviews.length} class:no-photo={!image}>
		<div class="booking-copy">
			<p class="eyebrow">Let’s plan your journey</p>
			<!-- Hyphenated words ("five-day") never break across lines. -->
			<h2>{#each title.split(/(\S+-\S+)/) as part, i (i)}{#if i % 2}<span class="nowrap">{part}</span>{:else}{part}{/if}{/each}</h2>
			{#if expert}
				<div class="expert">
					{#if photo}<img src={photo} alt="" loading="lazy" width="56" height="56" />{:else}<span class="expert-mark" aria-hidden="true"><Compass /></span>{/if}
					<p>Share your dates and travel style with <strong>{expert.name}</strong>{expert.role ? `, ${expert.role}` : ''}.</p>
				</div>
			{:else}
				<p class="booking-intro">Share your dates and travel style with our safari team.</p>
			{/if}
			{#if facts.length}
				<ul class="facts" aria-label="This safari at a glance">
					{#each facts as fact (fact.label)}
						{@const Icon = fact.icon}
						<li><Icon aria-hidden="true" /><span><small>{fact.label}</small>{fact.value}</span></li>
					{/each}
				</ul>
			{/if}
			<div class="booking-action">
				<a class="sp-btn sp-btn-sun" href={quoteHref} onclick={onEnquire}>Enquire about this safari <ArrowUpRight aria-hidden="true" /></a>
				<a class="sp-btn booking-chat" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />Chat on WhatsApp</a>
			</div>
			<p class="booking-note">An enquiry, with no obligation to book.</p>
		</div>
		{#if image}<div class="booking-photo"><img src={image} alt="" loading="lazy" width="900" height="700" /></div>{/if}
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
	.review { display: flex; flex-direction: column; min-width: 0; padding: 26px; border: 1px solid var(--sp-line); border-radius: var(--radius-surface); background: #fff; }
	.stars { margin: 0 0 16px; font-size: 17px; letter-spacing: 3px; color: var(--sp-green); }
	blockquote { flex: 1; margin: 0 0 14px; font-size: 15px; line-height: 1.8; color: var(--sp-muted); overflow-wrap: anywhere; }
	.read { align-self: flex-start; margin: 0 0 18px; padding: 4px 0; border: 0; background: none; color: var(--sp-ink); font: 600 14px var(--sp-sans); cursor: pointer; }
	.read:hover, .faq-intro a:hover { color: #7b6500; }
	.reviewer { display: flex; align-items: center; gap: 12px; margin-top: auto; padding-top: 18px; border-top: 1px solid var(--sp-line-soft); }
	.avatar { display: grid; flex-shrink: 0; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: #f3edce; color: #6a5a1c; font-size: 16px; font-weight: 600; }
	.reviewer strong { display: block; font-size: 15px; font-weight: 600; color: var(--sp-ink); }
	.reviewer small { display: block; margin-top: 3px; font-size: 13px; color: var(--sp-muted); }

	/* The plan card: the full width of the page, words on the left on the
	   dark of the hero, one of the tour's photos fading in on the right. */
	.booking { position: relative; isolation: isolate; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); min-height: 460px; margin: 0 0 72px; overflow: hidden; border-radius: var(--radius-surface); background: #2b2722; color: #fff; scroll-margin-top: 100px; box-shadow: 0 30px 60px -40px rgb(20 18 15 / 0.55); }
	.booking.no-photo { grid-template-columns: minmax(0, 1fr); }
	.booking.first { margin-top: 0; }
	.booking-copy { display: flex; flex-direction: column; justify-content: center; padding: 56px 8px 56px 56px; }
	.booking.no-photo .booking-copy { padding-right: 56px; }
	/* The photo runs under the whole card; an eased veil thins it from the
	   words on the left to clear on the right, so there is no seam and no flat block. */
	.booking-photo { position: absolute; inset: 0; z-index: -1; }
	.booking-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 80% 40%; }
	.booking-photo::after {
		content: ''; position: absolute; inset: 0;
		background:
			linear-gradient(90deg,
				rgb(43 39 34 / 0.94) 0%,
				rgb(43 39 34 / 0.9) 22%,
				rgb(43 39 34 / 0.82) 32%,
				rgb(43 39 34 / 0.7) 40%,
				rgb(43 39 34 / 0.55) 48%,
				rgb(43 39 34 / 0.4) 55%,
				rgb(43 39 34 / 0.26) 62%,
				rgb(43 39 34 / 0.14) 70%,
				rgb(43 39 34 / 0.06) 80%,
				rgb(43 39 34 / 0) 92%),
			linear-gradient(0deg, rgb(43 39 34 / 0.35) 0%, rgb(43 39 34 / 0) 40%);
	}
	.eyebrow { display: flex; align-items: center; gap: 14px; margin: 0 0 18px; font-size: 12px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: var(--sp-sun); }
	.eyebrow::before { content: ''; flex: none; width: 32px; height: 1px; background: currentColor; }
	.booking h2 { margin: 0 0 14px; max-width: 16ch; font-size: clamp(32px, 3.4vw, 48px); font-weight: 600; line-height: 1.08; letter-spacing: -0.03em; color: #fff; text-wrap: balance; }
	.nowrap { white-space: nowrap; }
	.booking-intro { margin: 0; max-width: 46ch; font-size: 16px; line-height: 1.7; color: rgb(255 255 255 / 0.78); }
	.expert { display: flex; align-items: center; gap: 14px; max-width: 48ch; }
	.expert img, .expert-mark { flex: none; width: 56px; height: 56px; border: 2px solid var(--sp-sun); border-radius: 50%; object-fit: cover; object-position: 50% 30%; }
	.expert-mark { display: grid; place-items: center; color: var(--sp-sun); }
	.expert-mark :global(svg) { width: 24px; height: 24px; }
	.expert p { margin: 0; font-size: 16px; line-height: 1.6; color: rgb(255 255 255 / 0.78); }
	.expert strong { font-weight: 600; color: #fff; }
	.facts { display: flex; flex-wrap: wrap; gap: 12px 28px; margin: 28px 0 0; padding: 20px 0 0; border-top: 1px solid rgb(255 255 255 / 0.14); list-style: none; }
	.facts li { display: flex; align-items: flex-start; gap: 10px; }
	.facts li :global(svg) { flex: none; width: 18px; height: 18px; margin-top: 2px; color: var(--sp-sun); }
	.facts span { font-size: 15px; font-weight: 600; line-height: 1.35; color: #fff; }
	.facts small { display: block; margin-bottom: 2px; font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgb(255 255 255 / 0.55); }
	.booking-action { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 30px; }
	.booking-chat { border: 1px solid rgb(255 255 255 / 0.4); background: transparent; color: #fff; }
	.booking-chat:hover { border-color: #fff; background: rgb(255 255 255 / 0.08); }
	.booking-chat :global(svg) { width: 18px; height: 18px; color: #4ade80; }
	.booking-note { margin: 14px 0 0; font-size: 13px; color: rgb(255 255 255 / 0.6); }

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
	@media (max-width: 960px) {
		.review-grid { grid-template-columns: 1fr; gap: 16px; }
		.faq-layout { grid-template-columns: 1fr; gap: 26px; }
		/* The photo moves to the top and fades down into the words. */
		.booking { grid-template-columns: minmax(0, 1fr); min-height: 0; }
		.booking-photo { position: relative; inset: auto; z-index: 0; order: -1; aspect-ratio: 16 / 9; }
		.booking-photo img { object-position: center 40%; }
		.booking-photo::after { background: linear-gradient(0deg, #2b2722 0%, rgb(43 39 34 / 0.8) 14%, rgb(43 39 34 / 0.5) 30%, rgb(43 39 34 / 0.22) 48%, rgb(43 39 34 / 0.06) 66%, rgb(43 39 34 / 0) 80%); }
		.booking-copy { padding: 8px 40px 44px; }
		.booking.no-photo .booking-copy { padding: 44px 40px; }
	}
	@media (max-width: 767px) { .review { padding: 22px; } .review-grid { margin-bottom: 40px; } .booking { margin-bottom: 48px; } }
	@media (max-width: 600px) {
		.booking-photo { aspect-ratio: 4 / 3; }
		.booking-copy, .booking.no-photo .booking-copy { padding: 4px 22px 28px; }
		.booking.no-photo .booking-copy { padding-top: 28px; }
		.booking h2 { font-size: clamp(30px, 8.5vw, 36px); }
		.facts { flex-direction: column; gap: 14px; }
		.booking-action { flex-direction: column; align-items: stretch; }
		.booking-action .sp-btn { width: 100%; }
	}
</style>
