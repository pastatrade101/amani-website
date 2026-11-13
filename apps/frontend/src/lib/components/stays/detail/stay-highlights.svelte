<script lang="ts">
	import { Check } from '@lucide/svelte';

	// Three or more highlights get their own section; fewer sit in the overview.
	let { highlights }: { highlights: string[] } = $props();
</script>

<section id="highlights" class="scroll-mt-14 bg-[oklch(.985_.006_85)] py-16 md:py-24" aria-labelledby="highlights-title">
	<div class="page-container">
		<div data-motion="reveal" class="max-w-2xl">
			<h2 id="highlights-title" class="lux-heading">What sets it apart</h2>
		</div>
		<ul class="list">
			{#each highlights as highlight, i (i)}
				<li data-motion="card"><span class="tick" aria-hidden="true"><Check class="size-4" strokeWidth={2.4} /></span><p>{highlight}</p></li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.list { display: grid; gap: 10px; margin: 32px 0 0; padding: 0; list-style: none; }
	li { display: flex; align-items: flex-start; gap: 14px; padding: 18px 18px 19px; border-radius: 12px; background: white; box-shadow: 0 0 0 1px rgb(43 39 34 / 0.08), 0 16px 34px -32px rgb(39 36 31 / 0.5); }
	.tick { display: grid; place-items: center; width: 28px; height: 28px; flex: none; border-radius: 8px; background: color-mix(in oklch, var(--sun) 32%, white); color: var(--navy); }
	p { margin: 2px 0 0; color: var(--navy); font-size: var(--text-base); font-weight: 500; line-height: 1.55; }
	@media (min-width: 768px) {
		.list { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 48px; }
		li { padding: 22px 24px 24px; }
		p { font-size: var(--text-base); }
	}
	@media (min-width: 1100px) { .list { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
