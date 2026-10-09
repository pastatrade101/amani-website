<script lang="ts">
	/** Every step named, so the length of the planner is never a surprise. Earlier steps can be revisited. */
	let { steps, step, onedit }: { steps: string[]; step: number; onedit: (index: number) => void } = $props();
</script>

<ol class="grid grid-cols-7 gap-1.5" aria-label="Planner steps">
	{#each steps as label, i (label)}
		<li aria-current={i === step ? 'step' : undefined}>
			<button type="button" class="w-full py-2 text-left disabled:cursor-default" disabled={i >= step} onclick={() => onedit(i)} aria-label={`Step ${i + 1}: ${label}`}>
				<span class="block h-1.5 overflow-hidden rounded-full bg-navy/10">
					<span class="pm-fill block h-full rounded-full bg-sun" style={`transform: scaleX(${i <= step ? 1 : 0})`}></span>
				</span>
				<span class={`mt-1.5 hidden text-[11px] leading-tight lg:block ${i === step ? 'font-semibold text-navy' : i < step ? 'text-navy hover:underline' : 'text-muted-foreground'}`}>{i + 1}. {label}</span>
			</button>
		</li>
	{/each}
</ol>
<p class="mt-3 text-xs text-muted-foreground">Step {step + 1} of {steps.length}<span class="lg:hidden"> · {steps[step]}</span></p>
