<script lang="ts">
	// Three or more highlights get their own numbered section; fewer sit in the overview.
	let { highlights }: { highlights: string[] } = $props();
</script>

<section id="highlights" class="scroll-mt-14 bg-[oklch(.985_.006_85)] py-16 md:py-24" aria-labelledby="highlights-title">
	<div class="page-container">
		<div data-motion="reveal" class="max-w-2xl">
			<p class="eyebrow text-[var(--gold-ink)]">Highlights</p>
			<h2 id="highlights-title" class="lux-heading mt-4">What sets it apart</h2>
		</div>
		<ol class="mt-10 grid gap-x-10 md:mt-14 md:grid-cols-2 lg:grid-cols-3">
			{#each highlights as highlight, i (i)}
				<li data-motion="reveal" class="border-t border-navy/10 pt-6 pb-8">
					<span class="block font-display text-[40px] leading-none text-[var(--gold-ink)]" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
					<p class="mt-4 text-[17px] leading-7 font-medium text-navy">{highlight}</p>
				</li>
			{/each}
		</ol>
	</div>
</section>

