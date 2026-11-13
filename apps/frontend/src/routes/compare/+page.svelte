<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowRight, Check, ChevronDown, ChevronRight, Link2, MessageCircle, Plus, Star, X } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { compare, compareHref, MAX_COMPARE } from '$lib/compare.svelte';
	import { tourDuration, tourFromPrice, tourPhotos, tourRoute } from '$lib/home-content';
	import { COMFORT, tourFacts, tourPriceValue } from '$lib/tour-filter';
	import { planHref } from '$lib/planner/plan-href';
	import type { TourDetail } from '$lib/types/api';

	// Two to four safaris side by side. A card carries a price and a length; it
	// can't carry what actually decides between two trips: where you sleep, how
	// you travel, what the price covers. Every cell is the safari's own data, and
	// where a safari doesn't say, the cell says so rather than guessing.
	let { data } = $props();
	let tours = $derived(data.tours as TourDetail[]);
	let enough = $derived(tours.length > 1);
	let photos = $derived(tourPhotos(tours));
	let onlyDiff = $state(false);
	let copied = $state(false);
	let shareUrl = $derived(`${data.siteOrigin}${compareHref(tours.map((tour) => tour.slug))}`);
	onMount(() => compare.restore());

	type Value = string | string[] | null;
	type Row = { label: string; get: (tour: TourDetail, index: number) => Value };

	const words = (value: string) => value.replace(/[_-]+/g, ' ').trim().replace(/^./, (letter) => letter.toUpperCase());
	const unique = (values: (string | null | undefined)[]) => [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
	const MODES: Record<string, string> = { DRIVE: 'By road in a safari vehicle', FLY: 'Light aircraft', BOAT: 'Boat' };

	const groupSize = (tour: TourDetail) => {
		const min = Number(tour.group_size_min) || 0, max = Number(tour.group_size_max) || 0;
		if (min && max) return min === max ? `${min} travellers` : `${min}–${max} travellers`;
		return max ? `Up to ${max} travellers` : min ? `From ${min} travellers` : null;
	};
	const lodges = (tour: TourDetail) => unique((tour.itinerary_days ?? []).flatMap((day) => [...(day.stays ?? []).map((stay) => stay.lodge?.name || stay.accommodation), day.lodge?.name || day.accommodation]));
	const children = (tour: TourDetail) => (tour.minimum_age == null ? null : Number(tour.minimum_age) > 0 ? `From ${tour.minimum_age} years` : 'All ages welcome');

	// The cheapest "from" price, when the safaris share a currency and more than one is priced.
	let cheapest = $derived.by(() => {
		const priced = tours.map((tour) => ({ id: tour.id, price: tourPriceValue(tour) })).filter((item) => item.price);
		if (priced.length < 2 || new Set(priced.map((item) => item.price!.currency)).size > 1) return null;
		const low = Math.min(...priced.map((item) => item.price!.amount));
		const at = priced.filter((item) => item.price!.amount === low);
		return at.length === 1 ? at[0].id : null;
	});

	const SECTIONS: { title: string; rows: Row[] }[] = [
		{
			title: 'At a glance',
			rows: [
				{ label: 'From, per person', get: (tour) => tourFromPrice(tour) ?? 'Price on request' },
				{ label: 'Length', get: (tour) => tourDuration(tour.duration_days, tour.duration_nights) || null },
				{ label: 'Comfort levels', get: (tour) => (tour.pricing_summary?.styles ?? []).map((style) => COMFORT.find((item) => item.key === style)?.label ?? words(style)) },
				{ label: 'Starts in', get: (tour, i) => tourFacts(tour, i).start?.label ?? null },
				{ label: 'Group size', get: groupSize }
			]
		},
		{
			title: 'Route and stays',
			rows: [
				{ label: 'Where you go', get: (tour) => tourRoute(tour).map((place) => place.name) },
				{ label: 'Where you sleep', get: lodges },
				{ label: 'Getting around', get: (tour) => unique((tour.itinerary_days ?? []).map((day) => (day.travel_mode ? MODES[day.travel_mode] : null))) }
			]
		},
		{
			title: 'Who it suits',
			rows: [
				{ label: 'Safari style', get: (tour) => tour.tour_categories?.name ?? null },
				{ label: 'Ideal for', get: (tour) => (tour.persona_tags ?? []).map(words) },
				{ label: 'Activity level', get: (tour) => (tour.difficulty_level ? words(tour.difficulty_level) : null) },
				{ label: 'Children', get: children }
			]
		},
		{ title: 'Highlights', rows: [{ label: 'Moments to expect', get: (tour) => (tour.highlights ?? []).filter(Boolean).slice(0, 5) }] },
		{
			title: 'What the price covers',
			rows: [
				{ label: 'Included', get: (tour) => [...(tour.tour_inclusions ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((item) => item.title) },
				{ label: 'Not included', get: (tour) => [...(tour.tour_exclusions ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((item) => item.title) }
			]
		}
	];

	const empty = (value: Value) => value === null || value === '' || (Array.isArray(value) && !value.length);
	// Rows no safari fills are left out; "only differences" also hides rows where all agree.
	let sections = $derived(
		SECTIONS.map((section) => ({
			title: section.title,
			rows: section.rows
				.map((row) => ({ label: row.label, values: tours.map((tour, i) => row.get(tour, i)) }))
				.filter((row) => row.values.some((value) => !empty(value)))
				.map((row) => ({ ...row, same: new Set(row.values.map((value) => JSON.stringify(value ?? null))).size === 1 }))
		})).filter((section) => section.rows.length)
	);
	// Phones show two safaris at a time; with three or four, each column's title picks which.
	let pick = $state<[number, number]>([0, 1]);
	let pair = $derived.by((): [number, number] => {
		let [a, b] = pick;
		if (a >= tours.length) a = 0;
		if (b >= tours.length || b === a) b = a === 0 ? 1 : 0;
		return [a, b];
	});
	function choose(slot: 0 | 1, index: number) {
		const next: [number, number] = [...pair];
		// Picking the safari the other column shows swaps the two.
		if (next[1 - slot] === index) next[1 - slot] = next[slot];
		next[slot] = index;
		pick = next;
	}
	let pairSections = $derived(
		sections
			.map((section) => ({
				title: section.title,
				rows: section.rows
					.map((row) => ({ label: row.label, values: pair.map((i) => row.values[i]), same: JSON.stringify(row.values[pair[0]] ?? null) === JSON.stringify(row.values[pair[1]] ?? null) }))
					.filter((row) => row.values.some((value) => !empty(value)))
			}))
			.filter((section) => section.rows.length)
	);
	let pairSame = $derived(pairSections.reduce((sum, section) => sum + section.rows.filter((row) => row.same).length, 0));
	let sameCount = $derived(sections.reduce((sum, section) => sum + section.rows.filter((row) => row.same).length, 0));

	function drop(slug: string) {
		compare.remove(slug);
		const rest = tours.filter((tour) => tour.slug !== slug).map((tour) => tour.slug);
		goto(rest.length ? compareHref(rest) : '/tours', { replaceState: true, noScroll: true, keepFocus: true });
	}
	async function copyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			copied = true;
			setTimeout(() => (copied = false), 2200);
		} catch {
			copied = false;
		}
	}
	const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
	let canEnquire = $derived(data.visible.includes('enquiry'));
</script>

<svelte:head>
	<title>Compare safaris | Key2africa</title>
	<meta name="description" content="Compare Key2africa safaris side by side: price, length, route, lodges and what each price covers." />
	<!-- Someone's shortlist: worth sending, not worth indexing. -->
	<meta name="robots" content="noindex, follow" />
	<link rel="canonical" href={`${data.siteOrigin}/compare`} />
</svelte:head>

{#snippet cell(value: Value, label: string, index: number)}
	{#if Array.isArray(value) && value.length}
		<ul>{#each value as entry, j (j)}<li>{entry}</li>{/each}</ul>
	{:else if typeof value === 'string' && value}
		<span class:strong={label.startsWith('From')}>{value}</span>
		{#if label.startsWith('From') && cheapest === tours[index].id}<span class="best">Lowest price here</span>{/if}
	{:else}
		<span class="blank">Not stated</span>
	{/if}
{/snippet}

<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-sun focus:p-4">Skip to content</a>
<SiteHeader visible={data.visible} activities={data.activities} destinations={data.destinations} onInterest={() => {}} tours={data.navTours} categories={data.categories} stays={data.navStays} onPage={['top']} />
<main id="main" class="compare-page">
	<div class="page-container">
		<nav aria-label="Breadcrumb" class="crumbs">
			<ol>
				<li><a href="/">Home</a><ChevronRight class="size-3.5" aria-hidden="true" /></li>
				<li><a href="/tours">Tours</a><ChevronRight class="size-3.5" aria-hidden="true" /></li>
				<li aria-current="page">Compare</li>
			</ol>
		</nav>
		<header class="head">
			<div>
				<h1>Compare safaris</h1>
				<p>Side by side, from each safari’s own itinerary. Where a safari doesn’t say, ask us and we’ll tell you.</p>
			</div>
			{#if enough}
				<div class="share">
					<button type="button" class="ghost" onclick={copyLink} aria-live="polite">{#if copied}<Check class="size-4" aria-hidden="true" />Link copied{:else}<Link2 class="size-4" aria-hidden="true" />Copy link{/if}</button>
					<a class="ghost" href={`https://wa.me/?text=${encodeURIComponent(`Safaris I’m comparing: ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle class="size-4" aria-hidden="true" /><span><span class="long">Send on </span>WhatsApp</span></a>
				</div>
			{/if}
		</header>

		{#if data.missing}
			<p class="note">{data.missing === 1 ? 'One safari is' : `${data.missing} safaris are`} no longer offered and {data.missing === 1 ? 'has' : 'have'} been left out.</p>
		{/if}

		{#if !enough}
			<div class="empty">
				<h2>{tours.length === 1 ? 'Add one more safari' : 'Nothing to compare yet'}</h2>
				<p>{tours.length === 1 ? `Comparing needs at least two. Tick Compare on another safari and it joins ${tours[0].title} here.` : 'Tick Compare on any safari card. Your picks collect at the bottom of the screen, up to four at a time.'}</p>
				<Button variant="safari" href="/tours" class="h-12 px-6">Browse safaris <ArrowRight class="size-4" /></Button>
			</div>
		{:else}
			<div class="tools">
				<label class="switch">
					<input type="checkbox" bind:checked={onlyDiff} disabled={!sameCount && !pairSame} />
					<span class="track" aria-hidden="true"></span>
					Only show differences
				</label>
				{#if tours.length < MAX_COMPARE}<a class="add" href="/tours"><Plus class="size-4" aria-hidden="true" />Add a safari</a>{/if}
			</div>

			<!-- Phones: two safaris at a time, each label above its two answers. -->
			<div class="phone">
				<div class="phone-photos">
					{#each pair as index, slot (slot)}
						{@const rating = data.ratings[tours[index].id]}
						<a class="phone-photo" href={`/tours/${encodeURIComponent(tours[index].slug)}`} aria-hidden="true" tabindex="-1">
							<img src={photos[index]} alt="" width="320" height="200" loading="lazy" />
							{#if rating}<span class="phone-rating"><Star class="size-3" aria-hidden="true" />{rating.average.toFixed(1)} · {plural(rating.count, 'review')}</span>{/if}
						</a>
					{/each}
				</div>
				<div class="phone-heads">
					{#each pair as index, slot (slot)}
						{@const tour = tours[index]}
						<div class="phone-head">
							<div class="phone-title">
								<span>{tour.title}</span>
								{#if tours.length > 2}
									<ChevronDown class="size-4 flex-none" aria-hidden="true" />
									<select aria-label={`Safari in column ${slot + 1}`} value={String(index)} onchange={(event) => choose(slot as 0 | 1, Number(event.currentTarget.value))}>
										{#each tours as option, i (option.id)}<option value={String(i)}>{option.title}</option>{/each}
									</select>
								{/if}
							</div>
							<button type="button" class="phone-drop" onclick={() => drop(tour.slug)} aria-label={`Remove ${tour.title} from the comparison`}><X class="size-4" aria-hidden="true" /></button>
						</div>
					{/each}
				</div>
				{#if tours.length > 2}<p class="phone-note">Showing 2 of {tours.length}. Tap a title to switch.</p>{/if}
				{#each pairSections as section (section.title)}
					{@const rows = onlyDiff ? section.rows.filter((row) => !row.same) : section.rows}
					{#if rows.length}
						<section class="phone-section" aria-label={section.title}>
							<h2>{section.title}</h2>
							{#each rows as row (row.label)}
								<div class="phone-row">
									<p class="phone-label">{row.label}</p>
									<div class="phone-vals">
										{#each row.values as value, slot (slot)}<div>{@render cell(value, row.label, pair[slot])}</div>{/each}
									</div>
								</div>
							{/each}
						</section>
					{/if}
				{/each}
				<div class="phone-cta">
					{#each pair as index, slot (slot)}
						<div>
							{#if canEnquire}<Button variant="safari" href={planHref({ tour: tours[index].slug, from: 'compare' })} data-cta="plan_my_trip" data-cta-location="compare" class="h-11 w-full px-3">Plan this</Button>{/if}
							<a class="itinerary" href={`/tours/${encodeURIComponent(tours[index].slug)}`}>Full itinerary <ArrowRight class="size-3.5" aria-hidden="true" /></a>
						</div>
					{/each}
				</div>
			</div>

			<div class="scroll" role="region" aria-label="Safari comparison" tabindex="-1">
				<table style={`--cols: ${tours.length}`}>
					<thead>
						<tr>
							<th class="corner" scope="col"><span class="sr-only">Detail</span></th>
							{#each tours as tour, i (tour.id)}
								{@const rating = data.ratings[tour.id]}
								<th scope="col">
									<div class="col">
										<a class="shot" href={`/tours/${encodeURIComponent(tour.slug)}`} tabindex="-1" aria-hidden="true"><img src={photos[i]} alt="" width="320" height="200" loading="lazy" /></a>
										<a class="name" href={`/tours/${encodeURIComponent(tour.slug)}`}>{tour.title}</a>
										{#if rating}
											<p class="rating"><Star class="size-3.5" aria-hidden="true" /><strong>{rating.average.toFixed(1)}</strong><span>{plural(rating.count, 'guest review')}</span></p>
										{:else}
											<p class="rating none">No guest reviews yet</p>
										{/if}
										<button type="button" class="drop" onclick={() => drop(tour.slug)} aria-label={`Remove ${tour.title} from the comparison`}><X class="size-3.5" aria-hidden="true" />Remove</button>
									</div>
								</th>
							{/each}
						</tr>
					</thead>
					{#each sections as section (section.title)}
						{@const rows = onlyDiff ? section.rows.filter((row) => !row.same) : section.rows}
						{#if rows.length}
							<tbody>
								<tr class="band"><th scope="colgroup" colspan={tours.length + 1}><span>{section.title}</span></th></tr>
								{#each rows as row (row.label)}
									<tr>
										<th scope="row">{row.label}</th>
										{#each row.values as value, i (tours[i].id)}
											<td>{@render cell(value, row.label, i)}</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						{/if}
					{/each}
					<tbody>
						<tr class="cta">
							<th scope="row"><span class="sr-only">Next step</span></th>
							{#each tours as tour (tour.id)}
								<td>
									{#if canEnquire}<Button variant="safari" href={planHref({ tour: tour.slug, from: 'compare' })} data-cta="plan_my_trip" data-cta-location="compare" class="h-11 w-full px-4">Plan this safari</Button>{/if}
									<a class="itinerary" href={`/tours/${encodeURIComponent(tour.slug)}`}>See the full itinerary <ArrowRight class="size-3.5" aria-hidden="true" /></a>
								</td>
							{/each}
						</tr>
					</tbody>
				</table>
			</div>
			{#if onlyDiff && sameCount}<p class="note after desk">{plural(sameCount, 'row')} where these safaris agree {sameCount === 1 ? 'is' : 'are'} hidden.</p>{/if}
			{#if onlyDiff && pairSame}<p class="note after mobile">{plural(pairSame, 'row')} where these two agree {pairSame === 1 ? 'is' : 'are'} hidden.</p>{/if}
		{/if}
	</div>
</main>
<SiteFooter visible={data.visible} destinations={data.destinations} onInterest={() => {}} onPage={['top']} />

<style>
	.compare-page { padding: 28px 0 72px; background: oklch(0.985 0.006 85); }
	.crumbs ol { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 0; padding: 0; list-style: none; color: var(--muted-foreground); font-size: var(--text-xs); }
	.crumbs li { display: inline-flex; align-items: center; gap: 6px; }
	.crumbs a { color: inherit; text-decoration: none; }
	.crumbs a:hover { color: var(--navy); }
	.crumbs [aria-current] { color: var(--navy); font-weight: 600; }
	.head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 18px 32px; margin-top: 18px; }
	h1 { margin: 0; color: var(--navy); font-size: var(--text-title); line-height: 1.08; letter-spacing: -0.03em; }
	.head p { max-width: 58ch; margin: 12px 0 0; color: var(--muted-foreground); font-size: var(--text-base); line-height: 1.65; }
	.share { display: flex; flex-wrap: wrap; gap: 8px; }
	.ghost { display: inline-flex; align-items: center; gap: 8px; height: 42px; padding: 0 14px; border: 1px solid var(--border); border-radius: var(--radius-control); background: #fff; color: var(--navy); font-size: var(--text-sm); font-weight: 600; text-decoration: none; white-space: nowrap; transition: border-color 160ms ease-out; }
	.ghost:hover { border-color: color-mix(in oklch, var(--navy) 35%, transparent); }
	.note { margin: 18px 0 0; color: var(--muted-foreground); font-size: var(--text-sm); }
	.note.after { margin-top: 12px; }

	.empty { display: grid; justify-items: start; gap: 14px; max-width: 620px; margin-top: 32px; padding: 32px; border: 1px solid var(--border); border-radius: var(--radius-surface); background: #fff; }
	.empty h2 { margin: 0; color: var(--navy); font-size: var(--text-h4); line-height: 1.2; }
	.empty p { margin: 0; color: var(--muted-foreground); font-size: var(--text-base); line-height: 1.65; }

	.tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-top: 28px; }
	.switch { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; color: var(--navy); font-size: var(--text-sm); font-weight: 600; cursor: pointer; }
	.switch input { position: absolute; opacity: 0; pointer-events: none; }
	.switch .track { position: relative; width: 38px; height: 22px; border-radius: 11px; background: oklch(0.86 0.015 80); transition: background-color 180ms ease-out; }
	.switch .track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgb(39 36 31 / 0.25); transition: translate 180ms cubic-bezier(0.22, 1, 0.36, 1); }
	.switch input:checked + .track { background: var(--navy); }
	.switch input:checked + .track::after { translate: 16px 0; }
	.switch input:focus-visible + .track { outline: 2px solid var(--sun); outline-offset: 2px; }
	.switch:has(input:disabled) { opacity: 0.5; cursor: default; }
	.add { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; color: var(--navy); font-size: var(--text-sm); font-weight: 600; text-decoration: none; }
	.add:hover { color: #7a5a26; }

	/* The table scrolls, the page doesn't; the row labels stay put while safaris pass. */
	.scroll { margin-top: 12px; overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius-surface); background: #fff; scrollbar-width: thin; }
	.scroll:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }
	table { width: 100%; min-width: calc(170px + var(--cols) * 240px); table-layout: fixed; border-collapse: collapse; }
	th, td { padding: 16px 18px; border-bottom: 1px solid oklch(0.93 0.008 80); color: var(--navy); font-size: var(--text-sm); line-height: 1.55; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
	td + td, th + td, thead th + th { border-left: 1px solid oklch(0.95 0.006 80); }
	tbody th[scope='row'], .corner { position: sticky; left: 0; z-index: 1; width: 170px; background: oklch(0.985 0.006 85); color: var(--muted-foreground); font-size: var(--text-xs); font-weight: 600; }
	.corner { z-index: 2; }
	thead th { padding-bottom: 18px; background: #fff; font-weight: 400; }
	.col { display: grid; gap: 8px; }
	.shot { display: block; aspect-ratio: 16 / 10; overflow: hidden; border-radius: 8px; background: oklch(0.9 0.02 80); }
	.shot img { width: 100%; height: 100%; object-fit: cover; transition: scale 300ms ease-out; }
	.shot:hover img { scale: 1.03; }
	.name { display: -webkit-box; overflow: hidden; margin-top: 4px; color: var(--navy); font-size: var(--text-base); font-weight: 650; line-height: 1.35; text-decoration: none; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
	.name:hover { color: #7a5a26; }
	.rating { display: flex; align-items: center; gap: 5px; margin: 0; color: var(--muted-foreground); font-size: var(--text-xs); }
	.rating :global(svg) { color: #b98a3a; fill: #b98a3a; }
	.rating strong { color: var(--navy); }
	.rating.none { color: oklch(0.65 0.015 80); }
	.drop { display: inline-flex; align-items: center; gap: 5px; justify-self: start; min-height: 32px; color: var(--muted-foreground); font-size: var(--text-xs); font-weight: 600; }
	.drop:hover { color: #a3392b; }
	.band th { position: static; padding: 12px 18px; background: oklch(0.965 0.012 84); color: var(--navy); font-size: var(--text-sm); font-weight: 650; }
	.band th span { position: sticky; left: 18px; }
	td ul { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
	td li { position: relative; padding-left: 14px; }
	td li::before { content: ''; position: absolute; top: 0.62em; left: 0; width: 5px; height: 5px; border-radius: 1px; background: #b98a3a; }
	.strong { font-size: var(--text-base); font-weight: 650; }
	.best { display: block; margin-top: 4px; color: #2f7a4f; font-size: var(--text-xs); font-weight: 600; }
	.blank { color: oklch(0.7 0.012 80); }
	.cta td { border-bottom: 0; }
	.cta th { border-bottom: 0; }
	.itinerary { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; margin-top: 6px; color: var(--navy); font-size: var(--text-sm); font-weight: 600; text-decoration: none; }
	.itinerary:hover { color: #7a5a26; }
	:global(.compare-page :focus-visible) { outline: 2px solid var(--sun); outline-offset: 2px; }

	/* Phones get their own layout; the table is for wider screens. */
	.phone, .note.mobile { display: none; }
	@media (max-width: 767px) {
		.compare-page { padding: 18px 0 40px; }
		.share { width: 100%; }
		.share { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.share > * { justify-content: center; height: 44px; }
		.long { display: none; }
		.scroll, .note.desk { display: none; }
		.phone { display: block; margin-top: 8px; }
		.note.mobile { display: block; }
		.phone-photos, .phone-heads, .phone-vals, .phone-cta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
		.phone-photo { position: relative; display: block; aspect-ratio: 4 / 3; overflow: hidden; border-radius: 8px; background: oklch(0.9 0.02 80); }
		.phone-photo img { width: 100%; height: 100%; object-fit: cover; }
		.phone-rating { position: absolute; left: 6px; bottom: 6px; display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: 5px; background: rgb(255 255 255 / 0.94); color: var(--navy); font-size: var(--text-xs); font-weight: 600; }
		.phone-rating :global(svg) { color: #b98a3a; fill: #b98a3a; }
		/* The column titles stay in view, under the header while it shows. */
		.phone-heads { position: sticky; top: var(--site-header-height); z-index: 3; margin: 0 -16px; padding: 10px 16px; border-bottom: 1px solid var(--border); background: oklch(0.985 0.006 85); transition: top 250ms ease; }
		:global(html[data-header-hidden]) .phone-heads { top: 0; }
		.phone-head { display: flex; align-items: flex-start; gap: 4px; min-width: 0; }
		.phone-title { position: relative; display: flex; flex: 1; align-items: flex-start; gap: 2px; min-width: 0; color: var(--navy); }
		.phone-title > span { display: -webkit-box; overflow: hidden; font-size: var(--text-sm); font-weight: 650; line-height: 1.3; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
		.phone-title :global(svg) { margin-top: 1px; color: var(--muted-foreground); }
		/* The native picker covers the title, so tapping it opens the list. */
		.phone-title select { position: absolute; inset: 0; width: 100%; opacity: 0; font-size: 16px; cursor: pointer; }
		.phone-title:has(select:focus-visible) { outline: 2px solid var(--sun); outline-offset: 2px; border-radius: 4px; }
		.phone-drop { display: grid; flex: none; place-items: center; width: 32px; height: 32px; margin: -6px -6px 0 0; border-radius: 6px; color: var(--muted-foreground); }
		.phone-drop:active { background: oklch(0.94 0.01 80); }
		.phone-note { margin: 10px 0 0; color: var(--muted-foreground); font-size: var(--text-xs); }
		.phone-section h2 { margin: 26px 0 0; padding-bottom: 8px; color: var(--navy); font-size: var(--text-base); font-weight: 650; }
		.phone-row { padding: 12px 0 14px; border-top: 1px solid oklch(0.92 0.01 80); }
		.phone-label { margin: 0 0 6px; color: var(--muted-foreground); font-size: var(--text-xs); font-weight: 600; }
		.phone-vals { color: var(--navy); font-size: var(--text-sm); line-height: 1.5; overflow-wrap: anywhere; }
		.phone-vals ul { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
		.phone-vals li { position: relative; padding-left: 12px; }
		.phone-vals li::before { content: ''; position: absolute; top: 0.6em; left: 0; width: 5px; height: 5px; border-radius: 1px; background: #b98a3a; }
		.phone-cta { margin-top: 8px; padding-top: 18px; border-top: 1px solid oklch(0.92 0.01 80); }
		.phone-cta .itinerary { width: 100%; justify-content: center; }
	}
	@media (prefers-reduced-motion: reduce) { .shot img, .switch .track, .switch .track::after, .ghost { transition: none; } }
</style>
