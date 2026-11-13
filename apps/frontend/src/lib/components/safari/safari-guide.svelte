<script lang="ts">
	import { ArrowUpRight } from '@lucide/svelte';
	import RichText from '$lib/components/tours/rich-text.svelte';
	import { textContent } from '$lib/home-content';
	import { activityCost } from '$lib/optional-activities';
	import { SAFARI_STYLES, formatPrice, styleOf, type PricingSeason, type SafariStyle } from '$lib/safari-pricing';
	import { mealsLabel, stayFor } from '$lib/tour-itinerary';
	import { displayName } from '$lib/safari-page';
	import type { ItineraryDay, TourDetail } from '$lib/types/api';

	// "Important information before you book": numbered articles built only
	// from what this tour records — the days at a glance, getting there, where
	// travellers stay, seasons, personalising and optional activities. The
	// section shows when at least two of them have something to say.
	let { tour, days, styles, style, quoteHref, onEnquire }: { tour: TourDetail; days: ItineraryDay[]; styles: SafariStyle[]; style: SafariStyle; quoteHref: string; onEnquire: () => void } = $props();

	const styleName = (id: SafariStyle) => SAFARI_STYLES.find((item) => item.id === id)?.title.replace(/\s+Safari$/, '') ?? id;
	const dateLabel = (value?: string | null) => {
		if (!value) return '';
		const date = new Date(`${value}T00:00:00Z`);
		return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
	};

	let glance = $derived(days.map((day) => ({ day: day.day_number, title: day.title, place: day.destination?.name ?? '', meals: mealsLabel(day.meals), stay: stayFor(day, style)?.name ?? '' })));
	let showGlance = $derived(glance.length > 1 && glance.some((row) => row.place || row.meals || row.stay));

	let transfers = $derived([...new Set([tour.start_point?.transfer_info, tour.end_point?.transfer_info].map((text) => (text ?? '').trim()).filter(Boolean))]);

	// Each style's properties in order, with the nights spent at each.
	let stays = $derived(
		styles
			.map((id) => {
				const nights = new Map<string, number>();
				for (const day of days) {
					const name = stayFor(day, id)?.name;
					if (name) nights.set(name, (nights.get(name) ?? 0) + 1);
				}
				return { id, lodges: [...nights].map(([name, count]) => `${name} (${count} ${count === 1 ? 'night' : 'nights'})`) };
			})
			.filter((row) => row.lodges.length)
	);

	let seasons = $derived.by(() => {
		const list = (tour.tour_pricing_seasons ?? []).filter((season) => season.status === 'ACTIVE' && season.pricing_basis === 'PER_PERSON') as PricingSeason[];
		const named = [...new Set(list.map((season) => season.season_name))];
		const dated = list.some((season) => season.start_date && season.end_date);
		if (named.length < 2 && !dated) return [];
		return named.map((name) => {
			const rows = list.filter((season) => season.season_name === name);
			const first = rows.find((season) => season.start_date && season.end_date);
			const prices = rows.flatMap((season) => season.group_prices.filter((price) => price.price_status === 'FIXED_PRICE' && Number(price.price) > 0).map((price) => ({ amount: Number(price.price), currency: season.currency, style: styleOf(season) })));
			const lowest = prices.sort((a, b) => a.amount - b.amount)[0];
			return { name, dates: first ? `${dateLabel(first.start_date)} – ${dateLabel(first.end_date)}` : '', from: lowest ? `${formatPrice(lowest.amount, lowest.currency)} per person (${styleName(lowest.style)})` : '' };
		});
	});

	let customIntro = $derived(textContent(tour.customization_intro));
	let customOptions = $derived((tour.customization_options ?? []).map((option) => option.trim()).filter(Boolean));
	let optional = $derived((tour.tour_activities ?? []).filter((item) => item.is_optional));

	let articles = $derived(
		[
			showGlance && { id: 'guide-glance', nav: 'Your trip at a glance', title: 'Your trip at a glance' },
			transfers.length && { id: 'guide-arrivals', nav: 'Getting there', title: 'Getting there and away' },
			stays.length && { id: 'guide-stays', nav: 'Where you’ll stay', title: 'Where you’ll stay' },
			seasons.length && { id: 'guide-seasons', nav: 'Seasons & prices', title: 'Seasons and prices' },
			(customIntro || customOptions.length) && { id: 'guide-personalise', nav: 'Personalise your safari', title: 'Personalise your safari' },
			optional.length && { id: 'guide-activities', nav: 'Optional activities', title: 'Optional activities' }
		].filter((item): item is { id: string; nav: string; title: string } => Boolean(item))
	);
	const number = (id: string) => String(articles.findIndex((article) => article.id === id) + 1).padStart(2, '0');
	let start = $derived(displayName(tour.start_point?.name));
	let end = $derived(displayName(tour.end_point?.name));
</script>

{#if articles.length > 1}
	<section id="before-you-book" class="sp-section sp-cream guide" aria-labelledby="guide-title">
		<div class="sp-head guide-heading">
			<h2 id="guide-title" class="sp-h2">Important information before you book</h2>
			<p class="sp-sub">The practical details of the {tour.title}, gathered in one place.</p>
		</div>
		<div class="guide-layout">
			<nav class="guide-nav" aria-label="Before you book">
				{#each articles as article}<a href={`#${article.id}`}><span>{number(article.id)}</span>{article.nav}</a>{/each}
			</nav>
			<div class="articles">
				{#each articles as article (article.id)}
					<article id={article.id} aria-labelledby={`${article.id}-title`}>
						<h3 id={`${article.id}-title`}>{number(article.id)}. {article.title}</h3>
						{#if article.id === 'guide-glance'}
							<div class="compare-wrap">
								<table>
									<thead><tr><th scope="col">Day</th><th scope="col">Where</th><th scope="col">Meals</th><th scope="col">Overnight{styles.length > 1 ? ` (${styleName(style)})` : ''}</th></tr></thead>
									<tbody>{#each glance as row (row.day)}<tr><td>Day {row.day}</td><td>{row.place || row.title}</td><td>{row.meals || '—'}</td><td>{row.stay || '—'}</td></tr>{/each}</tbody>
								</table>
							</div>
							<p>Every day in full, with its travel, activities and accommodation, is in the <a href="#itinerary">day-by-day itinerary</a>.</p>
						{:else if article.id === 'guide-arrivals'}
							{#if start || end}<p><strong>{start && end ? (start === end ? `Starts and ends in ${start}.` : `Starts in ${start}, ends in ${end}.`) : start ? `Starts in ${start}.` : `Ends in ${end}.`}</strong></p>{/if}
							{#each transfers as text}<p>{text}</p>{/each}
						{:else if article.id === 'guide-stays'}
							{#each stays as row (row.id)}<p>{#if stays.length > 1 || styles.length > 1}<strong>{styleName(row.id)}:</strong> {/if}{row.lodges.join(', ')}.</p>{/each}
							<p>Properties are subject to availability; a similar property may be offered and is confirmed in your quotation.</p>
						{:else if article.id === 'guide-seasons'}
							{#each seasons as season (season.name)}<p><strong>{season.name}</strong>{season.dates ? ` (${season.dates})` : ''}{season.from ? `: from ${season.from}.` : '.'}</p>{/each}
							<p><a href="#prices">Compare prices by group size</a></p>
						{:else if article.id === 'guide-personalise'}
							{#if customIntro}<RichText value={tour.customization_intro} class="sp-rich" />{/if}
							{#if customOptions.length}<ul>{#each customOptions as option}<li>{option}</li>{/each}</ul>{/if}
						{:else if article.id === 'guide-activities'}
							<ul>{#each optional as item (item.activity.id)}<li><strong>{item.activity.name}</strong> · {activityCost(item)}{#if textContent(item.activity.short_description)}<br />{textContent(item.activity.short_description)}{/if}</li>{/each}</ul>
						{/if}
					</article>
				{/each}
			</div>
		</div>
		<div class="guide-cta">
			<p>Have your dates in mind?<br />Let’s shape the right safari for you.</p>
			<a href={quoteHref} onclick={onEnquire}>Enquire about this safari <ArrowUpRight aria-hidden="true" /></a>
		</div>
	</section>
{/if}

<style>
	.guide-layout { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 56px; }
	.guide-nav { position: sticky; top: calc(var(--site-header-height, 0px) + 96px); align-self: start; display: grid; gap: 2px; }
	:global(html[data-header-hidden]) .guide-nav { top: 96px; }
	.guide-nav a { display: flex; gap: 12px; padding: 10px 0; font-size: var(--text-sm); line-height: 1.5; color: var(--sp-muted); text-decoration: none; }
	.guide-nav a:hover { color: var(--sp-ink); }
	.guide-nav span { min-width: 22px; font-size: var(--text-sm); font-weight: 600; color: #98723c; }
	.articles { max-width: 920px; }
	article { margin: 0 0 32px; padding: 0 0 32px; border-bottom: 1px solid var(--sp-line); scroll-margin-top: 140px; }
	article:last-child { margin-bottom: 0; border-bottom: 0; }
	h3 { margin: 0 0 16px; font-size: var(--text-h4); font-weight: 650; line-height: 1.3; letter-spacing: -0.015em; color: var(--sp-ink); }
	article p, article li { margin: 0 0 12px; font-size: var(--text-base); line-height: 1.85; color: var(--sp-muted); }
	article p:last-child { margin-bottom: 0; }
	article strong { font-weight: 600; color: var(--sp-ink); }
	article a { font-weight: 600; color: var(--sp-ink); text-decoration: none; }
	article a:hover { color: #7b6500; }
	article ul { margin: 0; padding-left: 1.2rem; list-style: disc; }
	.compare-wrap { margin: 0 0 18px; overflow-x: auto; border: 1px solid var(--sp-line); border-radius: var(--radius-surface); background: #fff; }
	table { width: 100%; min-width: 560px; border-collapse: collapse; font-size: var(--text-sm); line-height: 1.6; }
	th { padding: 14px 16px; background: #efeadd; font-weight: 600; text-align: left; color: var(--sp-ink); }
	td { padding: 14px 16px; border-top: 1px solid var(--sp-line-soft); vertical-align: top; color: var(--sp-muted); }
	td:first-child { font-weight: 600; white-space: nowrap; color: var(--sp-ink); }
	.guide-cta { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-top: 36px; padding: 24px 28px; border-radius: var(--radius-surface); background: #fff; border: 1px solid var(--sp-line); }
	.guide-cta p { margin: 0; font-size: var(--text-base); line-height: 1.7; color: var(--sp-muted); }
	.guide-cta a { display: inline-flex; align-items: center; gap: 6px; min-height: 48px; padding: 12px 26px; border-radius: var(--radius-control); background: var(--sp-sun); color: #2b2722; font-size: var(--text-sm); font-weight: 700; text-decoration: none; white-space: nowrap; }
	.guide-cta a :global(svg) { width: 16px; height: 16px; }
	@media (max-width: 900px) {
		.guide-layout { grid-template-columns: minmax(0, 1fr); gap: 28px; }
		.guide-nav { position: static; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; padding-bottom: 22px; border-bottom: 1px solid var(--sp-line); }
		.guide-cta { flex-wrap: wrap; }
	}
	@media (max-width: 600px) { .guide-nav { grid-template-columns: minmax(0, 1fr); } table { min-width: 480px; } }
</style>
