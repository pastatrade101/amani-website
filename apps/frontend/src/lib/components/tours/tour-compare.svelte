<script lang="ts">
	import { routeSentence, tourDuration, tourFromPrice } from '$lib/home-content';
	import type { TourFacts } from '$lib/tour-filter';

	// The safaris on show side by side, in the list's order: what a guest
	// weighs when the cards look alike. Every cell is the tour's own data.
	const MAX = 8;
	let { results }: { results: TourFacts[] } = $props();
	let rows = $derived(results.slice(0, MAX));
	const age = (item: TourFacts) => (item.minAge ? `${item.minAge}+ years` : item.tour.minimum_age === 0 ? 'Any age' : null);
</script>

<section class="compare" aria-labelledby="compare-title" data-motion="reveal">
	<div class="head">
		<h2 id="compare-title">These safaris at a glance</h2>
		{#if results.length > MAX}<p>The first {MAX}, in the order above</p>{/if}
	</div>
	<div class="scroll" role="region" aria-labelledby="compare-title" tabindex="-1">
		<table>
			<colgroup><col class="c-safari" /><col class="c-length" /><col class="c-price" /><col class="c-start" /><col class="c-route" /><col class="c-age" /></colgroup>
			<thead>
				<tr><th scope="col">Safari</th><th scope="col">Length</th><th scope="col">From, per person</th><th scope="col">Starts in</th><th scope="col">Visits</th><th scope="col">Children</th></tr>
			</thead>
			<tbody>
				{#each rows as item (item.tour.id)}
					{@const price = tourFromPrice(item.tour)}
					{@const children = age(item)}
					<tr>
						<th scope="row"><a href={`/tours/${encodeURIComponent(item.tour.slug)}`}>{item.tour.title}</a></th>
						<td>{tourDuration(item.tour.duration_days, item.tour.duration_nights) || '–'}</td>
						<td class="nowrap strong">{price ?? 'On request'}</td>
						<td>{item.start?.label ?? '–'}</td>
						<td class="route">{routeSentence(item.tour, 4) || '–'}</td>
						<td>{#if children}{children}{:else}<span aria-label="Not stated">–</span>{/if}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<style>
	.compare { margin-top: 48px; }
	.head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 16px; }
	h2 { margin: 0; color: var(--navy); font-size: var(--text-h4); line-height: 1.2; }
	.head p { margin: 0; color: var(--muted-foreground); font-size: var(--text-sm); }
	.scroll { margin-top: 16px; overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius-surface); background: #fff; scrollbar-width: thin; }
	.scroll:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }
	table { width: 100%; min-width: 720px; table-layout: fixed; border-collapse: collapse; font-size: var(--text-sm); }
	.c-safari { width: 27%; } .c-length { width: 12%; } .c-price { width: 12%; } .c-start { width: 14%; } .c-route { width: 23%; } .c-age { width: 12%; }
	th, td { padding: 14px 14px; overflow-wrap: anywhere; border-top: 1px solid var(--border); color: var(--navy); line-height: 1.45; text-align: left; vertical-align: top; }
	thead th { border-top: 0; padding-block: 12px; background: oklch(0.975 0.008 85); color: var(--muted-foreground); font-size: var(--text-xs); font-weight: 600; }
	tbody th { position: sticky; left: 0; z-index: 1; background: #fff; font-weight: 600; overflow-wrap: normal; }
	thead th:first-child { position: sticky; left: 0; z-index: 1; }
	tbody th a { color: var(--navy); text-decoration: none; }
	tbody th a:hover { color: #7a5a26; }
	tbody tr:hover th, tbody tr:hover td { background: oklch(0.985 0.005 85); }
	.nowrap { white-space: nowrap; }
	.strong { font-weight: 600; }
	.route { color: color-mix(in oklch, var(--navy) 78%, white); }
	@media (min-width: 1024px) { .compare { margin-top: 56px; } }
</style>
