<script lang="ts">
	import { ArrowUpRight, BedDouble, Binoculars, Car, Images, MapPin, Moon, Plane, Ship, Sun, UtensilsCrossed } from '@lucide/svelte';
	import StayLightbox from '$lib/components/stays/detail/stay-lightbox.svelte';
	import StayPhoto from '$lib/components/stays/stay-photo.svelte';
	import RichText from '$lib/components/tours/rich-text.svelte';
	import { safeUrl, textContent } from '$lib/home-content';
	import { SAFARI_STYLES, type SafariStyle } from '$lib/safari-pricing';
	import { activityList, mealsLabel, stayFor, stayHref, travelModeLabel } from '$lib/tour-itinerary';
	import { displayName, numberWord } from '$lib/safari-page';
	import type { ItineraryDay, Stay, StayLodge, TourDetail } from '$lib/types/api';

	// Day by day: each day's place, title, story, travel, activities and meals,
	// then where travellers sleep in every safari style the tour offers.
	let { tour, days, styles, route }: { tour: TourDetail; days: ItineraryDay[]; styles: SafariStyle[]; route: string[] } = $props();

	const MODE_ICONS = { FLY: Plane, DRIVE: Car, BOAT: Ship } as const;
	const styleName = (id: SafariStyle) => SAFARI_STYLES.find((style) => style.id === id)?.title.replace(/\s+Safari$/, '') ?? id;
	const usable = (url: string | null | undefined) => { const safe = safeUrl(url, ''); return safe.startsWith('#') ? '' : safe; };
	/** A lodge's photos: its gallery (cover first, then CMS order), else its main photos. */
	function lodgePhotos(lodge: StayLodge | null) {
		const gallery = [...(lodge?.lodge_images ?? [])].sort((a, b) => Number(Boolean(b.is_cover)) - Number(Boolean(a.is_cover)) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
		const urls = [...gallery.map((shot) => ({ src: shot.image_url, alt: shot.alt_text || shot.caption || '', caption: shot.caption || '' })), { src: lodge?.hero_image_url, alt: '', caption: '' }, { src: lodge?.image_url, alt: '', caption: '' }];
		const seen = new Set<string>();
		return urls
			.map((shot) => ({ ...shot, src: usable(shot.src) }))
			.filter((shot) => shot.src && !seen.has(shot.src) && seen.add(shot.src))
			.map((shot, index) => ({ id: String(index), src: shot.src, alt: shot.alt || lodge?.name || '', caption: shot.caption, category: '' }));
	}
	/**
	 * A stay with no photos of its own stands in with the landscape of its own
	 * park area, named as such, or a placeholder. Never the day's destination:
	 * that is where the day goes, not always where the night is spent.
	 */
	const standIn = (name: string, lodge: StayLodge | null): Stay => ({ id: lodge?.id ?? name, name, slug: lodge?.slug ?? '', park_area: lodge?.park_area ?? null });

	// One full-screen viewer for whichever lodge's photos are opened.
	let viewer = $state({ open: false, index: 0, title: '', photos: [] as ReturnType<typeof lodgePhotos>, opener: null as HTMLElement | null });
	function openPhotos(lodge: StayLodge | null, name: string, index: number, event: MouseEvent) {
		viewer = { open: true, index, title: name, photos: lodgePhotos(lodge), opener: event.currentTarget as HTMLElement };
	}
	const where = (lodge: StayLodge | null) => (lodge?.park_area || lodge?.region || '').trim();
	/** "TENTED_CAMP" → "Tented camp". */
	const kindOf = (lodge: StayLodge | null) => { const raw = (lodge?.lodge_type ?? '').trim().toLowerCase().replace(/_/g, ' '); return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : ''; };
	/** How many nights in a row the itinerary spends at this stay, and on which days. */
	function nightsAt(i: number, style: SafariStyle, name: string) {
		const same = (k: number) => stayFor(days[k], style)?.name === name;
		let first = i, last = i;
		while (first > 0 && same(first - 1)) first--;
		while (last < days.length - 1 && same(last + 1)) last++;
		const count = last - first + 1;
		return { count, when: count > 1 ? `Days ${days[first].day_number}–${days[last].day_number}` : `Day ${days[i].day_number}` };
	}

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
	// Phones: a long day opens at its first lines; the rest is one tap away.
	let opened = $state<Record<string, boolean>>({});
</script>

<section id="itinerary" class="sp-section sp-cream itinerary" aria-labelledby="itinerary-title">
	<div class="sp-head itinerary-heading">
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
			{@const long = textContent(day.description).length > 360}
			<article aria-labelledby={`day-${day.day_number}-title`}>
				<p class="day-label">{[`Day ${day.day_number}`, day.destination?.name].filter(Boolean).join(' · ')}</p>
				<h3 id={`day-${day.day_number}-title`}>{day.title}</h3>
				{#if textContent(day.summary)}<p class="summary">{textContent(day.summary)}</p>{/if}
				<div class="description" class:long class:open={opened[day.id]} id={`day-${day.day_number}-story`}><RichText value={day.description} class="sp-rich" /></div>
				{#if long}<button type="button" class="read-day" aria-expanded={Boolean(opened[day.id])} aria-controls={`day-${day.day_number}-story`} onclick={() => (opened[day.id] = !opened[day.id])}>{opened[day.id] ? 'Show less' : 'Read the full day'}</button>{/if}
				{#if mode || activities.length || meals}
					<ul class="day-meta">
						{#if mode && ModeIcon}<li><ModeIcon aria-hidden="true" />{mode}</li>{/if}
						{#if activities.length}<li><Binoculars aria-hidden="true" />{activities.join(' · ')}</li>{/if}
						{#if meals}<li><UtensilsCrossed aria-hidden="true" /><span class="sr-only">Meals: </span>{meals}</li>{/if}
					</ul>
				{/if}
				{#if stays.length}
					<!-- Every stay is the same card: photos (or an honest stand-in), the comfort,
					     the name and place, a short read, the facts and the ways in. One stay
					     takes the whole row, words beside its photos; several share the row. -->
					<h4>{stays.length === 1 ? 'Accommodation' : 'Accommodation options'}</h4>
					<ul class="stays" class:single={stays.length === 1} data-count={Math.min(stays.length, 3)}>
						{#each stays as card (card.style)}
							{@const lodge = card.stay!.lodge}
							{@const name = card.stay!.name}
							{@const shots = lodgePhotos(lodge)}
							{@const tiles = shots.slice(0, stays.length === 1 ? 3 : 1)}
							{@const kind = kindOf(lodge)}
							{@const nights = nightsAt(i, card.style, name)}
							{@const area = where(lodge)}
							{@const blurb = textContent(lodge?.short_description)}
							<li class="stay-card">
								<div class="stay-media">
									{#if tiles.length}
										<div class="mosaic" data-count={tiles.length}>
											{#each tiles as shot, k (shot.src)}
												<button type="button" aria-label={`Open photo ${k + 1} of ${shots.length} of ${name}`} onclick={(event) => openPhotos(lodge, name, k, event)}>
													<img src={shot.src} alt="" loading="lazy" width="640" height="420" />
													{#if k === 2 && shots.length > 3}<span class="more">+{shots.length - 3}</span>{/if}
												</button>
											{/each}
										</div>
									{:else}
										<div class="stand-in"><StayPhoto stay={standIn(name, lodge)} /></div>
									{/if}
								</div>
								<div class="stay-body">
									<span class="style-tag">{card.label}</span>
									<strong class="stay-name">{#if card.href}<a href={card.href}>{name}</a>{:else}{name}{/if}</strong>
									{#if area}<p class="area"><MapPin aria-hidden="true" />{area}</p>{/if}
									{#if blurb}<p class="blurb">{blurb}</p>{/if}
									<dl class="stay-facts">
										{#if kind}<div><dt><BedDouble aria-hidden="true" />Type</dt><dd>{kind}</dd></div>{/if}
										<div><dt><Moon aria-hidden="true" />Nights</dt><dd>{nights.count} {nights.count === 1 ? 'night' : 'nights'}<span> · {nights.when}</span></dd></div>
									</dl>
									{#if card.href || shots.length > 1}
										<div class="stay-actions">
											{#if card.href}<a class="stay-btn" href={card.href}>See the stay <ArrowUpRight aria-hidden="true" /></a>{/if}
											{#if shots.length > 1}<button type="button" class="stay-btn quiet" onclick={(event) => openPhotos(lodge, name, 0, event)}><Images aria-hidden="true" />{shots.length} photos</button>{/if}
										</div>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
				{#if i === days.length - 1 && end}<p class="ending"><Sun aria-hidden="true" />Your safari ends in {end}.</p>{/if}
			</article>
		{/each}
	</div>
	{#if viewer.photos.length}<StayLightbox photos={viewer.photos} bind:open={viewer.open} bind:index={viewer.index} title={viewer.title} opener={viewer.opener} />{/if}
	{#if anyStays}<p class="stay-note">Accommodation is subject to availability; a similar property may be offered. Your final properties are confirmed in your quotation.</p>{/if}
</section>

<style>
	.itinerary-heading { margin-bottom: 44px; }
	.timeline { margin-left: 8px; padding-left: 36px; border-left: 1px solid #ddd6c6; }
	article { position: relative; padding-bottom: 48px; }
	article:last-child { padding-bottom: 0; }
	article::before { content: ''; position: absolute; top: 4px; left: -44px; width: 15px; height: 15px; border: 3px solid var(--sp-cream); border-radius: 50%; background: var(--sp-sun); box-shadow: 0 0 0 1px #b5a98a; }
	.day-label { margin: 0 0 10px; font-size: var(--text-sm); font-weight: 600; color: #98723c; }
	h3 { max-width: 860px; margin: 0 0 14px; font-size: var(--text-h4); font-weight: 650; line-height: 1.3; letter-spacing: -0.015em; color: var(--sp-ink); }
	.summary { max-width: 860px; margin: 0 0 12px; font-size: var(--text-base); font-weight: 500; line-height: 1.75; color: var(--sp-ink); }
	.description { max-width: 860px; margin: 0 0 18px; }
	.read-day { display: none; }
	.day-meta { display: flex; flex-wrap: wrap; gap: 10px 24px; margin: 0 0 24px; padding: 0; list-style: none; }
	.day-meta li { display: flex; align-items: center; gap: 8px; font-size: var(--text-sm); color: var(--sp-muted); }
	.day-meta :global(svg) { flex-shrink: 0; width: 17px; height: 17px; color: #98723c; }
	h4 { margin: 0 0 14px; font-size: var(--text-base); font-weight: 600; color: var(--sp-ink); }
	/* One card for every stay. Several share the row, photo over words. */
	.stays { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin: 0; padding: 0; list-style: none; }
	.stays[data-count='2'] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.stay-card { display: flex; flex-direction: column; min-width: 0; overflow: hidden; border: 1px solid var(--sp-line); border-radius: var(--radius-surface); background: #fff; }
	.stay-media { position: relative; aspect-ratio: 16 / 10; overflow: hidden; background: #ece8dd; }
	.stand-in { position: absolute; inset: 0; }
	.stay-body { display: flex; flex: 1; flex-direction: column; align-items: flex-start; min-width: 0; padding: 20px 22px 22px; }
	.style-tag { padding: 5px 10px; border-radius: 6px; background: #faf3d6; font-size: var(--text-sm); font-weight: 700; color: #7a5a12; }
	.stay-name { display: block; margin-top: 12px; overflow-wrap: anywhere; font-size: var(--text-xl); font-weight: 650; line-height: 1.25; letter-spacing: -0.02em; color: var(--sp-ink); text-wrap: balance; }
	.stay-name a { color: inherit; text-decoration: none; }
	.stay-name a:hover { color: #7b6500; }
	.area { display: flex; align-items: center; gap: 6px; margin: 8px 0 0; font-size: var(--text-sm); color: var(--sp-muted); }
	.area :global(svg) { flex: none; width: 15px; height: 15px; color: #98723c; }
	.blurb { display: -webkit-box; margin: 12px 0 0; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; font-size: var(--text-sm); line-height: 1.7; color: var(--sp-muted); }
	/* The facts in the tour cards' row style, settled at the foot so cards in a row line up. */
	.stay-facts { align-self: stretch; margin: auto 0 0; padding-top: 18px; }
	.stay-facts div { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 0; border-top: 1px solid var(--sp-line-soft); }
	.stay-facts div:last-child { border-bottom: 1px solid var(--sp-line-soft); }
	.stay-facts dt { display: flex; align-items: center; gap: 9px; font-size: var(--text-sm); font-weight: 500; color: var(--sp-muted); }
	.stay-facts dt :global(svg) { width: 17px; height: 17px; color: #98723c; }
	.stay-facts dd { margin: 0; text-align: right; font-size: var(--text-sm); font-weight: 600; color: var(--sp-ink); }
	.stay-facts dd span { font-weight: 500; color: var(--sp-muted); }
	.stay-actions { display: flex; flex-wrap: wrap; align-self: stretch; gap: 10px; margin-top: 18px; }
	.stay-btn { display: inline-flex; flex: 1 1 auto; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 10px 18px; border: 1.5px solid var(--sp-ink); border-radius: var(--radius-control); background: #fff; font: 600 14px var(--sp-sans); color: var(--sp-ink); text-decoration: none; cursor: pointer; transition: background-color 0.18s ease, border-color 0.18s ease; }
	.stay-btn:hover { border-color: var(--sp-sun); background: var(--sp-sun); }
	.stay-btn.quiet { border: 1px solid var(--sp-line); }
	.stay-btn.quiet:hover { border-color: #cfc6b2; background: var(--sp-cream); }
	.stay-btn :global(svg) { width: 16px; height: 16px; }
	.mosaic { position: absolute; inset: 0; display: grid; gap: 4px; }
	.mosaic[data-count='3'] { grid-template-columns: 1.6fr 1fr; grid-template-rows: 1fr 1fr; }
	.mosaic[data-count='3'] button:first-child { grid-row: span 2; }
	.mosaic[data-count='2'] { grid-template-columns: 1fr 1fr; }
	.mosaic button { position: relative; min-height: 0; padding: 0; overflow: hidden; border: 0; background: #ece8dd; cursor: zoom-in; }
	.mosaic img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
	.mosaic button:hover img { transform: scale(1.04); }
	.mosaic button:focus-visible { outline: 2px solid var(--sp-sun); outline-offset: -2px; }
	.mosaic .more { position: absolute; inset: 0; display: grid; place-items: center; background: rgb(20 18 15 / 0.45); font-size: var(--text-xl); font-weight: 600; color: #fff; }
	/* One stay takes the row: the words on the left, its photos (or the stand-in) on the right. */
	.single { grid-template-columns: minmax(0, 1fr); }
	.single .stay-card { display: grid; grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.7fr); }
	.single .stay-media { order: 2; aspect-ratio: auto; min-height: 320px; margin: 4px; border-radius: calc(var(--radius-surface) - 4px); }
	.single .stay-body { justify-content: center; padding: 32px; }
	.single .stay-name { margin-top: 14px; font-size: var(--text-2xl); }
	.single .blurb { margin-top: 16px; -webkit-line-clamp: 3; line-clamp: 3; }
	.single .stay-facts { margin-top: 0; padding-top: 22px; }
	.single .mosaic button { border-radius: 0; }
	.single .mosaic[data-count='3'] button:first-child { border-radius: calc(var(--radius-surface) - 4px) 0 0 calc(var(--radius-surface) - 4px); }
	.ending { display: flex; align-items: center; gap: 10px; max-width: 860px; margin: 24px 0 0; padding: 15px 18px; border-radius: var(--radius-control); background: #fff1b8; color: #5c4b00; font-size: var(--text-base); font-weight: 500; }
	.ending :global(svg) { width: 18px; height: 18px; }
	.stay-note { margin: 32px 0 0; padding-left: 44px; font-size: var(--text-sm); line-height: 1.7; color: var(--sp-muted); }
	@media (max-width: 960px) {
		.stays { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.single .stay-card { display: flex; }
		.single .stay-media { order: 0; min-height: 0; aspect-ratio: 16 / 9; }
		.single .mosaic button, .single .mosaic[data-count='3'] button:first-child { border-radius: 0; }
		.single .stay-media { margin: 0; border-radius: 0; }
	}
	@media (max-width: 600px) { .stays, .stays[data-count='2'] { grid-template-columns: minmax(0, 1fr); } .stay-body, .single .stay-body { padding: 20px; } .single .stay-name { font-size: var(--text-xl); } }
	@media (prefers-reduced-motion: reduce) { .mosaic img { transition: none; } }
	@media (max-width: 767px) {
		.timeline { margin-left: 6px; padding-left: 24px; } article { padding-bottom: 40px; } article::before { left: -32px; } .summary { font-size: var(--text-base); } .stay-note { padding-left: 0; }
		/* A long day shows its first lines, fading out, until it is opened. */
		.description.long:not(.open) { max-height: 9.2em; overflow: hidden; -webkit-mask-image: linear-gradient(#000 55%, transparent); mask-image: linear-gradient(#000 55%, transparent); }
		.description.long { margin-bottom: 4px; }
		.read-day { display: inline-flex; align-items: center; min-height: 44px; margin: 0 0 10px; padding: 0; border: 0; background: none; color: var(--sp-ink); font: 600 14px var(--sp-sans); cursor: pointer; }
		.read-day::after { content: ''; width: 7px; height: 7px; margin: -3px 0 0 9px; border-right: 1.6px solid currentColor; border-bottom: 1.6px solid currentColor; rotate: 45deg; transition: rotate 0.2s ease, margin 0.2s ease; }
		.read-day[aria-expanded='true']::after { rotate: -135deg; margin-top: 4px; }
		/* Phones: every stay card reads the same, photos over a shorter read. */
		.single .blurb { -webkit-line-clamp: 2; line-clamp: 2; }
		.stay-facts, .single .stay-facts { padding-top: 16px; }
	}
</style>
