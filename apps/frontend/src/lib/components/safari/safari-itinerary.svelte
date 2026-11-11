<script lang="ts">
	import { BedDouble, Binoculars, Car, Plane, Ship, Sun, UtensilsCrossed } from '@lucide/svelte';
	import RichText from '$lib/components/tours/rich-text.svelte';
	import { safeUrl, textContent } from '$lib/home-content';
	import { SAFARI_STYLES, type SafariStyle } from '$lib/safari-pricing';
	import { activityList, mealsLabel, stayFor, stayHref, travelModeLabel } from '$lib/tour-itinerary';
	import { displayName, numberWord } from '$lib/safari-page';
	import type { ItineraryDay, StayLodge, TourDetail } from '$lib/types/api';

	// Day by day: each day's place, title, story, travel, activities and meals,
	// then where travellers sleep in every safari style the tour offers.
	let { tour, days, styles, route }: { tour: TourDetail; days: ItineraryDay[]; styles: SafariStyle[]; route: string[] } = $props();

	const MODE_ICONS = { FLY: Plane, DRIVE: Car, BOAT: Ship } as const;
	const styleName = (id: SafariStyle) => SAFARI_STYLES.find((style) => style.id === id)?.title.replace(/\s+Safari$/, '') ?? id;
	const photo = (lodge: StayLodge | null) => {
		const url = safeUrl(lodge?.image_url_thumbnail || lodge?.hero_image_url_thumbnail || lodge?.hero_image_url || lodge?.image_url, '');
		return url.startsWith('#') ? '' : url;
	};
	const where = (lodge: StayLodge | null) => (lodge?.park_area || lodge?.region || '').trim();

	/** The day's stay in each offered style; a day without per-style stays shows its one overnight. */
	function staysOf(day: ItineraryDay) {
		// A tour with no styles yet can still name one overnight per day.
		const cards = (styles.length ? styles : (['midrange'] as SafariStyle[]))
			.map((style) => ({ style, stay: stayFor(day, style), href: stayHref(day, style) }))
			.filter((card) => card.stay);
		// Older days hold a single lodge for every style: show it once.
		const names = new Set(cards.map((card) => card.stay!.name));
		if (cards.length > 1 && names.size === 1 && !(day.stays ?? []).length) return [{ ...cards[0], label: 'Overnight' }];
		return cards.map((card) => ({ ...card, label: styles.length ? styleName(card.style) : 'Overnight' }));
	}
	let total = $derived(Math.round(Number(tour.duration_days) || days.length));
	let end = $derived(displayName(tour.end_point?.name));
	let anyStays = $derived(days.some((day) => staysOf(day).length));
</script>

<section id="itinerary" class="sp-section sp-cream itinerary" aria-labelledby="itinerary-title">
	<div class="sp-head itinerary-heading">
		<p class="sp-eyebrow">Every day, a new discovery</p>
		<h2 id="itinerary-title" class="sp-h2">Your {numberWord(total)}-day itinerary</h2>
		{#if route.length > 1}<p class="sp-sub">{route.join(' → ')}</p>{/if}
	</div>
	<div class="timeline">
		{#each days as day, i (day.id)}
			{@const stays = staysOf(day)}
			{@const mode = travelModeLabel(day)}
			{@const ModeIcon = day.travel_mode ? MODE_ICONS[day.travel_mode] : null}
			{@const activities = activityList(day.activities)}
			{@const meals = mealsLabel(day.meals)}
			<article aria-labelledby={`day-${day.day_number}-title`}>
				<p class="day-label">{[`Day ${String(day.day_number).padStart(2, '0')}`, day.destination?.name].filter(Boolean).join(' · ')}</p>
				<h3 id={`day-${day.day_number}-title`}>{day.title}</h3>
				{#if textContent(day.summary)}<p class="summary">{textContent(day.summary)}</p>{/if}
				<div class="description"><RichText value={day.description} class="sp-rich" /></div>
				{#if mode || activities.length || meals}
					<ul class="day-meta">
						{#if mode && ModeIcon}<li><ModeIcon aria-hidden="true" />{mode}</li>{/if}
						{#if activities.length}<li><Binoculars aria-hidden="true" />{activities.join(' · ')}</li>{/if}
						{#if meals}<li><UtensilsCrossed aria-hidden="true" /><span class="sr-only">Meals: </span>{meals}</li>{/if}
					</ul>
				{/if}
				{#if stays.length}
					<h4>{stays.length > 1 ? 'Accommodation options' : 'Accommodation'}</h4>
					<ul class="stays">
						{#each stays as card (card.style)}
							{@const image = photo(card.stay!.lodge)}
							<li class="stay">
								{#if image}<img src={image} alt={card.stay!.name} loading="lazy" width="320" height="125" />{:else}<span class="no-photo" aria-hidden="true"><BedDouble /></span>{/if}
								<div>
									<small>{card.label}</small>
									<strong>{#if card.href}<a href={card.href}>{card.stay!.name}</a>{:else}{card.stay!.name}{/if}</strong>
									{#if where(card.stay!.lodge)}<p>{where(card.stay!.lodge)}</p>{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
				{#if i === days.length - 1 && end}<p class="ending"><Sun aria-hidden="true" />Your safari ends in {end}.</p>{/if}
			</article>
		{/each}
	</div>
	{#if anyStays}<p class="stay-note">Accommodation is subject to availability; a similar property may be offered. Your final properties are confirmed in your quotation.</p>{/if}
</section>

<style>
	.itinerary-heading { margin-bottom: 44px; }
	.timeline { margin-left: 8px; padding-left: 36px; border-left: 1px solid #ddd6c6; }
	article { position: relative; padding-bottom: 48px; }
	article:last-child { padding-bottom: 0; }
	article::before { content: ''; position: absolute; top: 4px; left: -44px; width: 15px; height: 15px; border: 3px solid var(--sp-cream); border-radius: 50%; background: var(--sp-sun); box-shadow: 0 0 0 1px #b5a98a; }
	.day-label { margin: 0 0 10px; font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #98723c; }
	h3 { max-width: 860px; margin: 0 0 14px; font-size: clamp(20px, 1.8vw, 24px); font-weight: 650; line-height: 1.3; letter-spacing: -0.015em; color: var(--sp-ink); }
	.summary { max-width: 860px; margin: 0 0 12px; font-size: 16px; font-weight: 500; line-height: 1.75; color: var(--sp-ink); }
	.description { max-width: 860px; margin: 0 0 18px; }
	.day-meta { display: flex; flex-wrap: wrap; gap: 10px 24px; margin: 0 0 24px; padding: 0; list-style: none; }
	.day-meta li { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--sp-muted); }
	.day-meta :global(svg) { flex-shrink: 0; width: 17px; height: 17px; color: #98723c; }
	h4 { margin: 0 0 14px; font-size: 15px; font-weight: 600; color: var(--sp-ink); }
	.stays { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin: 0; padding: 0; list-style: none; }
	.stay { display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--sp-line); border-radius: 16px; background: #fff; }
	.stay img, .no-photo { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; }
	.no-photo { display: grid; place-items: center; background: #ece8dd; color: #a89f8a; }
	.no-photo :global(svg) { width: 30px; height: 30px; }
	.stay > div { padding: 16px 18px 18px; }
	.stay small { display: block; margin-bottom: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--sp-kicker); }
	.stay strong { display: block; overflow-wrap: anywhere; font-size: 16px; font-weight: 600; line-height: 1.4; color: var(--sp-ink); }
	.stay strong a { color: inherit; text-decoration: none; }
	.stay strong a:hover { color: #7b6500; }
	.stay p { margin: 5px 0 0; font-size: 13px; line-height: 1.6; color: var(--sp-muted); }
	.ending { display: flex; align-items: center; gap: 10px; max-width: 860px; margin: 24px 0 0; padding: 15px 18px; border-radius: 12px; background: #fff1b8; color: #5c4b00; font-size: 15px; font-weight: 500; }
	.ending :global(svg) { width: 18px; height: 18px; }
	.stay-note { margin: 32px 0 0; padding-left: 44px; font-size: 13px; line-height: 1.7; color: var(--sp-muted); }
	@media (max-width: 960px) { .stays { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
	@media (max-width: 600px) { .stays { grid-template-columns: 1fr; } }
	@media (max-width: 767px) { .timeline { margin-left: 6px; padding-left: 24px; } article { padding-bottom: 40px; } article::before { left: -32px; } .summary { font-size: 15px; } .stay-note { padding-left: 0; } }
</style>
