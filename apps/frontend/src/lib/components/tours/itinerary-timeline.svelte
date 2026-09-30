<script lang="ts">
	import { ArrowRight, ChevronDown, ChevronUp } from '@lucide/svelte';
	import SafariStyleSelector from '$lib/components/pricing/safari-style-selector.svelte';
	import ItineraryDayHeading from './itinerary-day-heading.svelte';
	import ItineraryStayCell from './itinerary-stay-cell.svelte';
	import RichText from './rich-text.svelte';
	import { SAFARI_STYLES, SAFARI_STYLE_THEME, type SafariStyle } from '$lib/safari-pricing';
	import { sanitizeRichText } from '$lib/tour-html';
	import { activityList, dayPhotos, hasStylePerStay, mealsLabel, overnightLabel, stayHref } from '$lib/tour-itinerary';
	import type { ItineraryDay } from '$lib/types/api';

	// "Your Safari Itinerary": a dashed timeline of day cards. Each card opens
	// and closes on its own; "View all" opens every day. The Overnight line and
	// the fallback lodge photos follow the page's safari style.
	let {
		days,
		style,
		styles,
		onStyleChange
	}: { days: ItineraryDay[]; style: SafariStyle; styles: SafariStyle[]; onStyleChange: (style: SafariStyle) => void } = $props();

	const uid = $props.id();
	// Null until the visitor toggles something; until then only the first day is open.
	let opened = $state<string[] | null>(null);
	let openIds = $derived(opened ?? (days[0] ? [days[0].id] : []));
	let entries = $derived(
		days.map((day, index) => {
			const hasDescription = Boolean(sanitizeRichText(day.description));
			const activities = activityList(day.activities);
			const overnight = overnightLabel(day, style);
			const meals = mealsLabel(day.meals);
			const photos = dayPhotos(day, style);
			return {
				day,
				key: `${uid}-${index}`,
				activities,
				overnight,
				stayLink: stayHref(day, style),
				meals,
				photos,
				perStyle: hasStylePerStay(day),
				expandable: Boolean(hasDescription || activities.length || overnight || meals || photos.length || day.destination?.name)
			};
		})
	);
	let expandable = $derived(entries.filter((entry) => entry.expandable));
	let allOpen = $derived(expandable.length > 0 && expandable.every((entry) => openIds.includes(entry.day.id)));
	let styleName = $derived(SAFARI_STYLES.find((item) => item.id === style)?.title.replace(/\s+Safari$/, '') ?? '');

	function toggle(id: string) {
		opened = openIds.includes(id) ? openIds.filter((item) => item !== id) : [...openIds, id];
	}
	function toggleAll() {
		opened = allOpen ? [] : expandable.map((entry) => entry.day.id);
	}
</script>

<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
	<div data-motion="reveal" class="min-w-0">
		<p class="eyebrow text-muted-foreground">Day by day</p>
		<h2 class="section-heading mt-3">Your Safari Itinerary</h2>
	</div>
	{#if expandable.length > 1}
		<button type="button" onclick={toggleAll} aria-expanded={allOpen} aria-controls={expandable.map((entry) => `${entry.key}-panel`).join(' ')} class="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline md:text-base">
			{allOpen ? 'Collapse all' : 'View all'}
			{#if allOpen}<ChevronUp class="size-4" aria-hidden="true" />{:else}<ArrowRight class="size-4" aria-hidden="true" />{/if}
		</button>
	{/if}
</div>

{#if styles.length > 1}
	<div class="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
		<p class="shrink-0 text-xs font-medium text-muted-foreground">Show overnight stays for</p>
		<SafariStyleSelector compact value={style} onChange={onStyleChange} {styles} label="Safari style for overnight stays" />
	</div>
{/if}

<ol class="timeline mt-8 md:mt-10">
	{#each entries as entry (entry.day.id)}
		{@const day = entry.day}
		{@const open = entry.expandable && openIds.includes(day.id)}
		<li class="timeline-day">
			<div class="timeline-marker" aria-hidden="true"><span>Day {day.day_number}</span></div>
			<article class="day-card">
				<h3>
					{#if entry.expandable}
						<button type="button" id={`${entry.key}-toggle`} aria-expanded={open} aria-controls={`${entry.key}-panel`} onclick={() => toggle(day.id)} class="day-head">
							{@render heading()}
							<span class="day-chevron" aria-hidden="true"><ChevronDown class={`size-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} /></span>
						</button>
					{:else}
						<span class="day-head">{@render heading()}</span>
					{/if}
				</h3>
				{#snippet heading()}
					<ItineraryDayHeading {day} />
				{/snippet}
				{#if entry.expandable}
					<div id={`${entry.key}-panel`} role="region" aria-labelledby={`${entry.key}-toggle`} class="day-panel" data-open={open} inert={!open}>
						<div class="min-h-0 overflow-hidden">
							<div class="day-body">
								<RichText value={day.description} />
								{#if day.destination?.name || entry.activities.length}
									<div class="mt-5 grid gap-4 sm:grid-cols-2">
										{#if day.destination?.name}<div><p class="meta-label">Main Destination</p><p class="meta-value">{day.destination.name}</p></div>{/if}
										{#if entry.activities.length}
											<div><p class="meta-label">Activities</p><ul class="mt-1.5 flex flex-wrap gap-1.5">{#each entry.activities as activity}<li class="activity-chip">{activity}</li>{/each}</ul></div>
										{/if}
									</div>
								{/if}
								{#if entry.overnight || entry.meals}
									<div class="stay-panel">
										{#if entry.overnight}
											<ItineraryStayCell
												kind="overnight"
												label="Overnight"
												value={entry.overnight}
												href={entry.stayLink}
												badge={entry.perStyle && styles.length > 1 ? { color: SAFARI_STYLE_THEME[style].primary, name: styleName } : null}
											/>
										{/if}
										{#if entry.meals}
											<ItineraryStayCell kind="meals" label="Meals" value={entry.meals} />
										{/if}
									</div>
								{/if}
								{#if entry.photos.length}
									<ul class="day-photos" style={`--count:${entry.photos.length}`} aria-label={`Photos for day ${day.day_number}`}>
										{#each entry.photos as photo (photo.src)}
											<li><img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" /></li>
										{/each}
									</ul>
								{/if}
							</div>
						</div>
					</div>
				{/if}
			</article>
		</li>
	{/each}
</ol>

<style>
	/* Phones: the card takes the full width and carries its own "Day N" pill;
	   the circle-and-dashed-line column only appears from sm, where there is room for it. */
	.timeline { --marker: 4rem; --col-gap: 1.25rem; --row-gap: 0.875rem; display: grid; gap: var(--row-gap); }
	.timeline-day { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); }
	.timeline-marker { display: none; }
	.timeline-marker > span { display: grid; place-items: center; width: var(--marker); height: var(--marker); border-radius: 999px; background: var(--sun); color: var(--navy); font-size: 11px; font-weight: 700; line-height: 1; letter-spacing: -0.01em; box-shadow: 0 10px 22px -14px oklch(0.55 0.14 90 / 0.8); }
	.day-card { min-width: 0; border: 1px solid var(--border); border-radius: 1.25rem; background: var(--card); box-shadow: 0 14px 34px -28px rgb(15 35 55 / 0.4); }
	.day-head { display: flex; width: 100%; align-items: flex-start; gap: 0.75rem; padding: 1rem; border-radius: 1.25rem; text-align: left; }
	.day-chevron { display: grid; flex-shrink: 0; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: 999px; background: color-mix(in oklch, var(--sun) 18%, white); color: var(--navy); transition: background 160ms ease-out; }
	button.day-head:hover .day-chevron { background: color-mix(in oklch, var(--sun) 32%, white); }
	.day-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 320ms cubic-bezier(0.22, 1, 0.36, 1); }
	.day-panel[data-open='true'] { grid-template-rows: 1fr; }
	.day-body { padding: 0 1rem 1.1rem; }
	.meta-label { font-size: 11px; font-weight: 600; color: var(--muted-foreground); }
	.meta-value { margin-top: 0.2rem; font-size: 15px; font-weight: 700; color: var(--navy); overflow-wrap: anywhere; }
	/* Long unbroken words wrap inside the chip instead of widening the card. */
	.activity-chip { border-radius: 999px; border: 1px solid var(--border); padding: 0.2rem 0.65rem; font-size: 12px; color: var(--navy); overflow-wrap: anywhere; }
	/* The cells (itinerary-stay-cell) are phone-sized; the panel lays them out. */
	.stay-panel { display: grid; gap: 0.9rem; margin-top: 1.25rem; border-radius: 1rem; background: color-mix(in oklch, var(--sun) 9%, white); padding: 0.9rem 1rem; }
	/* Phones: a swipeable row that snaps photo by photo; from sm: one row of up to three. */
	.day-photos { display: flex; gap: 0.75rem; margin-top: 1.25rem; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; overscroll-behavior-x: contain; }
	.day-photos::-webkit-scrollbar { display: none; }
	.day-photos > li { flex: 0 0 82%; scroll-snap-align: start; }
	.day-photos > li:only-child { flex-basis: 100%; }
	.day-photos img { display: block; width: 100%; aspect-ratio: 4 / 3; border-radius: 0.75rem; background: var(--secondary); object-fit: cover; }
	@media (min-width: 640px) {
		.timeline { --row-gap: 1.5rem; }
		.timeline-day { grid-template-columns: var(--marker) minmax(0, 1fr); gap: var(--col-gap); }
		/* The dashed line runs from under this day's circle to the next one. */
		.timeline-day:not(:last-child)::before { content: ''; position: absolute; top: calc(var(--marker) + 6px); bottom: calc(6px - var(--row-gap)); left: calc(var(--marker) / 2 - 1px); border-left: 2px dashed color-mix(in oklch, var(--navy) 22%, transparent); }
		.timeline-marker { display: block; }
		/* The circle carries "Day N" from here; the heading (itinerary-day-heading) is phone-sized. */
		.day-head :global(.day-pill) { display: none; }
		.timeline-marker > span { font-size: 13px; }
		.day-head { gap: 1rem; padding: 1.35rem 1.5rem; }
		.day-head :global(.day-title) { font-size: 18px; }
		.day-head :global(.day-summary) { font-size: 14px; }
		.day-chevron { width: 2.5rem; height: 2.5rem; }
		.day-body { padding: 0 1.5rem 1.5rem; }
		.stay-panel { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 1rem 1.25rem; }
		.stay-panel :global(.stay-value) { font-size: 15px; }
		.day-photos { display: grid; grid-template-columns: repeat(var(--count), minmax(0, 1fr)); overflow: visible; }
		.day-photos > li:only-child img { aspect-ratio: 21 / 9; }
	}
	@media (min-width: 1024px) {
		.timeline { --marker: 4.5rem; --col-gap: 2rem; --row-gap: 1.75rem; }
		.timeline-marker > span { font-size: 15px; }
		.day-head { padding: 1.75rem 2rem 1.5rem; }
		.day-head :global(.day-title) { font-size: 21px; }
		.day-head :global(.day-summary) { font-size: 15px; }
		.day-body { padding: 0 2rem 2rem; }
		.day-photos { gap: 1rem; }
	}
	@media (prefers-reduced-motion: reduce) {
		.day-panel { transition: none; }
	}
</style>
