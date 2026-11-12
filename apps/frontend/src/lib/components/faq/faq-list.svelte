<script lang="ts" module>
	export type FaqItem = { id?: string; question: string; answer: string };
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Accordion as AccordionPrimitive } from 'bits-ui';
	import { Minus, Plus } from '@lucide/svelte';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import RichText from '$lib/components/tours/rich-text.svelte';

	// The one FAQ design every page uses: a centred heading, then the questions
	// as cards in two columns (one on phones) with the first answer open.
	let {
		faqs,
		title = 'Frequently Asked Questions',
		intro = '',
		eyebrow = '',
		id,
		head,
		list = false
	}: { faqs: FaqItem[]; title?: string; intro?: string; eyebrow?: string; id?: string; head?: Snippet; list?: boolean } = $props();

	let items = $derived(
		faqs
			.filter((faq) => faq?.question?.trim() && faq?.answer?.trim())
			.map((faq, index) => ({ ...faq, key: faq.id ?? `faq-${index}` }))
	);
	// Column by column, so the left column reads first, in the library's order.
	// `list`: one ruled column and no heading of its own; the page places the heading.
	let columns = $derived.by(() => {
		if (list) return [items];
		const half = Math.ceil(items.length / 2);
		return [items.slice(0, half), items.slice(half)].filter((column) => column.length);
	});
	// Writable derived: opening another question overrides it, and a new list
	// (another locale, another tour) starts again from its first question.
	let open = $derived(items[0]?.key ?? '');
</script>

{#if items.length}
	<div {id} class="faq-block" class:list>
		<!-- `head` replaces the default heading, for a page with its own heading style. -->
		{#if head}{@render head()}{:else if !list}<header class="mx-auto max-w-2xl text-center">
			{#if eyebrow}<p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>{/if}
			<h2 class={`faq-title ${eyebrow ? 'mt-3' : ''}`}>{title}</h2>
			{#if intro}<p class="mt-3 text-sm leading-6 text-muted-foreground md:text-[15px]">{intro}</p>{/if}
		</header>{/if}
		<Accordion.Root type="single" value={open} onValueChange={(value) => (open = value)} class={`faq-grid ${columns.length > 1 ? 'two' : ''}`}>
			{#each columns as column, c (c)}
				<div class="grid content-start gap-4">
					{#each column as faq (faq.key)}
						<Accordion.Item value={faq.key} class="faq-card">
							<AccordionPrimitive.Header level={3}>
								<AccordionPrimitive.Trigger class="faq-trigger group">
									<span>{faq.question}</span>
									<span class="faq-icon" aria-hidden="true">
										<Plus class="size-3.5 group-aria-expanded:hidden" strokeWidth={2.5} />
										<Minus class="hidden size-3.5 group-aria-expanded:block" strokeWidth={2.5} />
									</span>
								</AccordionPrimitive.Trigger>
							</AccordionPrimitive.Header>
							<Accordion.Content class="pb-5"><RichText value={faq.answer} /></Accordion.Content>
						</Accordion.Item>
					{/each}
				</div>
			{/each}
		</Accordion.Root>
	</div>
{/if}

<style>
	.faq-title { font-size: 26px; font-weight: 600; line-height: 1.2; letter-spacing: -0.02em; color: var(--navy); }
	.faq-block :global(.faq-grid) { display: grid; gap: 16px; margin-top: 32px; }
	.faq-block :global(.faq-card) { border: 1px solid var(--border); border-radius: var(--radius-surface); background: white; padding-inline: 20px; transition: box-shadow 0.2s ease; }
	.faq-block :global(.faq-card[data-state='open']) { box-shadow: 0 10px 30px -22px color-mix(in oklch, var(--navy) 55%, transparent); }
	.faq-block :global(.faq-trigger) { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 16px; padding-block: 20px; text-align: left; font-size: 15px; font-weight: 600; line-height: 1.45; color: var(--navy); }
	.faq-block :global(.faq-trigger:focus-visible) { outline: 2px solid var(--sun); outline-offset: 4px; border-radius: 6px; }
	.faq-icon { display: grid; flex: none; place-items: center; width: 26px; height: 26px; border-radius: 999px; background: var(--secondary); color: var(--navy); transition: background-color 0.2s ease; }
	.faq-block :global(.faq-trigger[aria-expanded='true'] .faq-icon) { background: var(--sun); }
	/* The ruled list: rows split by hairlines instead of separate cards. */
	.faq-block.list :global(.faq-grid) { margin-top: 0; }
	.faq-block.list :global(.faq-grid > div) { gap: 0; }
	.faq-block.list :global(.faq-card) { border: 0; border-bottom: 1px solid #e3ddcf; border-radius: 0; background: transparent; padding-inline: 0; box-shadow: none; }
	.faq-block.list :global(.faq-card:first-child) { border-top: 1px solid #e3ddcf; }
	.faq-block.list :global(.faq-trigger) { padding-block: 22px; font-size: 16px; }
	.faq-block.list .faq-icon { background: #f1ede3; }
	@media (min-width: 768px) {
		.faq-title { font-size: 32px; }
		.faq-block :global(.faq-grid.two) { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
	}
</style>
