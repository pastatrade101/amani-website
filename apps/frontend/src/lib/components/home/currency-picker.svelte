<script lang="ts">
	import { Check, ChevronDown } from '@lucide/svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { currencyChoices, rateLine, ratesUpdated, selectedCurrency, setCurrency } from '$lib/currency';

	/**
	 * The display-currency switch: a quiet code in the header on desktop, a
	 * plain select in the phone menu. It only shows once rates are loaded, so
	 * it never offers a currency it cannot convert to.
	 */
	let { variant = 'header' }: { variant?: 'header' | 'sheet' } = $props();

	let open = $state(false);
	let choices = $derived(currencyChoices());
	let code = $derived(selectedCurrency());
	let rate = $derived(rateLine());
	let updated = $derived.by(() => {
		const at = ratesUpdated();
		if (!at) return '';
		const date = new Date(at);
		return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
	});
	const name = (item: { code: string; name: string }) => {
		try { return new Intl.DisplayNames(['en'], { type: 'currency' }).of(item.code) ?? item.name; } catch { return item.name; }
	};
	function pick(next: string) {
		setCurrency(next);
		open = false;
	}
</script>

{#if choices.length > 1}
	{#if variant === 'sheet'}
		<label class="sheet-picker">
			<span>Show prices in</span>
			<select value={code} onchange={(event) => setCurrency(event.currentTarget.value)}>
				{#each choices as item (item.code)}<option value={item.code}>{item.code} · {name(item)}</option>{/each}
			</select>
			<ChevronDown aria-hidden="true" />
		</label>
	{:else}
		<Popover.Root bind:open>
			<Popover.Trigger class="currency-trigger" aria-label={`Prices shown in ${code}. Change currency`}>{code}<ChevronDown aria-hidden="true" /></Popover.Trigger>
			<Popover.Content align="end" sideOffset={10} class="currency-panel">
				<p class="currency-title">Show prices in</p>
				<ul class="currency-list" role="listbox" aria-label="Currency">
					{#each choices as item (item.code)}
						<li role="option" aria-selected={item.code === code}>
							<button type="button" class="currency-option" class:on={item.code === code} onclick={() => pick(item.code)}>
								<strong>{item.code}</strong><span>{name(item)}</span>{#if item.code === code}<Check aria-hidden="true" />{/if}
							</button>
						</li>
					{/each}
				</ul>
				<p class="currency-note">{rate ? `${rate}. ` : ''}Our prices are set in US dollars; other currencies are a guide{updated ? `, rates from ${updated}` : ''}.</p>
			</Popover.Content>
		</Popover.Root>
	{/if}
{/if}

<style>
	:global(.currency-trigger) { display: inline-flex; align-items: center; gap: 4px; height: 40px; padding: 0 8px 0 10px; border: 0; border-radius: var(--radius-control); background: transparent; color: var(--navy); font: 600 var(--text-sm)/1 var(--font-sans); letter-spacing: 0.02em; cursor: pointer; transition: background-color 0.16s ease; }
	:global(.currency-trigger:hover), :global(.currency-trigger[data-state='open']) { background: var(--secondary); }
	:global(.currency-trigger:focus-visible) { outline: 2px solid var(--sun); outline-offset: 2px; }
	:global(.currency-trigger > svg) { width: 14px; height: 14px; color: var(--muted-foreground); transition: rotate 0.2s ease; }
	:global(.currency-trigger[data-state='open'] > svg) { rotate: 180deg; }
	:global(.currency-panel) { width: 272px; padding: 8px; border: 1px solid var(--border); border-radius: var(--radius-surface); background: var(--background); box-shadow: 0 24px 40px -24px rgb(39 36 31 / 0.35); }
	.currency-title { margin: 6px 8px 6px; font-size: var(--text-xs); font-weight: 600; color: var(--muted-foreground); }
	.currency-list { display: grid; gap: 1px; margin: 0; padding: 0; list-style: none; }
	.currency-option { display: grid; grid-template-columns: 44px minmax(0, 1fr) 16px; align-items: center; gap: 8px; width: 100%; min-height: 40px; padding: 0 8px; border: 0; border-radius: 6px; background: transparent; color: var(--navy); font: 500 var(--text-sm)/1.3 var(--font-sans); text-align: left; cursor: pointer; }
	.currency-option:hover { background: var(--secondary); }
	.currency-option:focus-visible { outline: 2px solid var(--sun); outline-offset: -2px; }
	.currency-option strong { font-weight: 700; font-variant-numeric: tabular-nums; }
	.currency-option span { overflow: hidden; color: var(--muted-foreground); white-space: nowrap; text-overflow: ellipsis; }
	.currency-option.on span { color: var(--navy); }
	.currency-option :global(svg) { width: 16px; height: 16px; }
	.currency-note { margin: 6px 0 0; padding: 10px 8px 4px; border-top: 1px solid var(--border); font-size: var(--text-xs); line-height: 1.5; color: var(--muted-foreground); }

	.sheet-picker { position: relative; display: grid; gap: 6px; margin-bottom: 14px; font-size: var(--text-xs); font-weight: 600; color: var(--muted-foreground); }
	.sheet-picker select { width: 100%; min-height: 44px; padding: 0 40px 0 14px; border: 1px solid var(--border); border-radius: var(--radius-control); background: var(--background); color: var(--navy); font: 500 var(--text-base)/1.2 var(--font-sans); appearance: none; }
	.sheet-picker select:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }
	.sheet-picker :global(svg) { position: absolute; right: 14px; bottom: 14px; width: 16px; height: 16px; color: var(--muted-foreground); pointer-events: none; }
</style>
