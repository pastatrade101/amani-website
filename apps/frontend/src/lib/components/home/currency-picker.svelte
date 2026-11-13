<script lang="ts">
	import { Check, ChevronDown } from '@lucide/svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { currencyChoices, rateLine, ratesUpdated, selectedCurrency, setCurrency } from '$lib/currency';

	/**
	 * The display-currency switch: a flag and code in the header on desktop, a
	 * plain select in the phone menu. It only shows once rates are loaded, so
	 * it never offers a currency it cannot convert to.
	 */
	let { variant = 'header' }: { variant?: 'header' | 'sheet' } = $props();

	// Square flags from flag-icons (MIT, static/flags/LICENSE.txt), framed 4:3.
	// Flags with a canton keep their top-left corner in the crop.
	const FLAGS: Record<string, { file: string; focus?: string }> = {
		USD: { file: 'us', focus: 'left top' },
		EUR: { file: 'eu' },
		GBP: { file: 'gb' },
		TZS: { file: 'tz' },
		KES: { file: 'ke' },
		ZAR: { file: 'za' },
		AUD: { file: 'au', focus: 'left top' },
		CAD: { file: 'ca' }
	};

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
	let currentName = $derived(name(choices.find((item) => item.code === code) ?? { code, name: code }));
	function pick(next: string) {
		setCurrency(next);
		open = false;
	}
</script>

{#snippet flag(currency: string)}
	{@const item = FLAGS[currency]}
	<span class="flag" class:blank={!item} aria-hidden="true">
		{#if item}<img src={`/flags/${item.file}.svg`} alt="" width="20" height="15" decoding="async" style:object-position={item.focus ?? 'center'} />{/if}
	</span>
{/snippet}

{#if choices.length > 1}
	{#if variant === 'sheet'}
		<label class="sheet-picker">
			<span class="sheet-label">Show prices in</span>
			<span class="sheet-field">
				{@render flag(code)}
				<select value={code} onchange={(event) => setCurrency(event.currentTarget.value)}>
					{#each choices as item (item.code)}<option value={item.code}>{item.code} · {name(item)}</option>{/each}
				</select>
				<ChevronDown aria-hidden="true" />
			</span>
		</label>
	{:else}
		<Popover.Root bind:open>
			<Popover.Trigger class="currency-trigger" aria-label={`Prices in ${currentName}. Change currency`}>
				{@render flag(code)}<span class="trigger-code">{code}</span><ChevronDown class="trigger-chevron" aria-hidden="true" />
			</Popover.Trigger>
			<Popover.Content align="end" sideOffset={10} class="currency-panel">
				<p class="currency-title">Show prices in</p>
				<ul class="currency-list">
					{#each choices as item (item.code)}
						{@const on = item.code === code}
						<li>
							<button type="button" class="currency-option" class:on aria-pressed={on} onclick={() => pick(item.code)}>
								{@render flag(item.code)}
								<strong>{item.code}</strong>
								<span class="currency-name">{name(item)}</span>
								{#if on}<Check aria-hidden="true" />{/if}
							</button>
						</li>
					{/each}
				</ul>
				<div class="currency-foot">
					{#if rate}<p class="currency-rate">{rate}</p>{/if}
					<p class="currency-note">Prices are set in US dollars. Other currencies are a guide{updated ? `, using rates from ${updated}` : ''}.</p>
				</div>
			</Popover.Content>
		</Popover.Root>
	{/if}
{/if}

<style>
	/* Flag: a small 4:3 frame with a hairline, so pale flags keep an edge on white. */
	.flag { position: relative; display: block; flex: none; width: 20px; height: 15px; overflow: hidden; border-radius: 2px; background: var(--secondary); }
	.flag img { display: block; width: 100%; height: 100%; object-fit: cover; }
	.flag::after { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 1px rgb(39 36 31 / 0.14); pointer-events: none; }

	:global(.currency-trigger) { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 8px 0 10px; border: 0; border-radius: var(--radius-control); background: transparent; color: var(--navy); font: 600 var(--text-sm)/1 var(--font-sans); cursor: pointer; transition: background-color 0.16s ease; }
	:global(.currency-trigger:hover), :global(.currency-trigger[data-state='open']) { background: var(--secondary); }
	:global(.currency-trigger:focus-visible) { outline: 2px solid var(--sun); outline-offset: 2px; }
	.trigger-code { font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
	:global(.currency-trigger .trigger-chevron) { width: 14px; height: 14px; margin-left: -2px; color: var(--muted-foreground); transition: rotate 0.2s ease; }
	:global(.currency-trigger[data-state='open'] .trigger-chevron) { rotate: 180deg; }

	:global(.currency-panel) { width: 288px; padding: 6px; border: 1px solid var(--border); border-radius: var(--radius-surface); background: var(--background); box-shadow: 0 24px 40px -24px rgb(39 36 31 / 0.35); }
	.currency-title { margin: 8px 10px 6px; font-size: var(--text-xs); font-weight: 600; line-height: 1.2; color: var(--muted-foreground); }
	.currency-list { display: grid; margin: 0; padding: 0; list-style: none; }
	.currency-option { display: grid; grid-template-columns: 20px 34px minmax(0, 1fr) 16px; align-items: center; column-gap: 12px; width: 100%; height: 38px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; color: var(--navy); font: 500 var(--text-sm)/1.2 var(--font-sans); text-align: left; cursor: pointer; transition: background-color 0.12s ease; }
	.currency-option:hover { background: var(--secondary); }
	.currency-option:focus-visible { outline: 2px solid var(--sun); outline-offset: -2px; }
	.currency-option strong { font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
	.currency-name { overflow: hidden; color: var(--muted-foreground); white-space: nowrap; text-overflow: ellipsis; }
	.currency-option.on { background: color-mix(in oklab, var(--secondary) 70%, transparent); }
	.currency-option.on .currency-name { color: var(--navy); }
	.currency-option :global(svg) { grid-column: 4; width: 16px; height: 16px; color: var(--navy); }

	.currency-foot { margin: 6px 0 0; padding: 10px 10px 6px; border-top: 1px solid var(--border); }
	.currency-rate { margin: 0 0 3px; font-size: var(--text-xs); font-weight: 600; line-height: 1.4; color: var(--navy); font-variant-numeric: tabular-nums; }
	.currency-note { margin: 0; font-size: var(--text-xs); line-height: 1.5; color: var(--muted-foreground); }

	.sheet-picker { display: grid; gap: 6px; margin-bottom: 14px; }
	.sheet-label { font-size: var(--text-xs); font-weight: 600; color: var(--muted-foreground); }
	.sheet-field { position: relative; display: block; }
	.sheet-field .flag { position: absolute; top: 50%; left: 14px; translate: 0 -50%; pointer-events: none; }
	.sheet-field select { width: 100%; min-height: 44px; padding: 0 40px 0 46px; border: 1px solid var(--border); border-radius: var(--radius-control); background: var(--background); color: var(--navy); font: 500 var(--text-base)/1.2 var(--font-sans); appearance: none; }
	.sheet-field select:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }
	.sheet-field :global(svg) { position: absolute; top: 50%; right: 14px; translate: 0 -50%; width: 16px; height: 16px; color: var(--muted-foreground); pointer-events: none; }
</style>
