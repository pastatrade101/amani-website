<script lang="ts">
  import { ArrowUpRight } from '@lucide/svelte';
  import SourceBadge from './SourceBadge.svelte';

  // Labeled horizontal bars for a dimension breakdown (device, country, page…).
  // Renders real rows only; shows a smart empty state when the source is dry.
  export let title: string;
  export let source = 'ga4';
  export let rows: Array<{ label: string; value: number }> = [];
  export let icon: typeof ArrowUpRight | undefined = undefined;
  export let accent = '#153733';
  export let format: 'number' | 'percent' = 'number';
  export let emptyText = 'No data yet for this period.';

  $: clean = (rows ?? []).filter((r) => r && r.label && r.value > 0).slice(0, 6);
  $: max = clean.reduce((m, r) => Math.max(m, r.value), 0) || 1;
  const fmt = (v: number) => (format === 'percent' ? `${Math.round(v)}%` : v.toLocaleString());
</script>

<div class="flex h-full flex-col rounded-2xl border border-ink/10 bg-surface p-4 shadow-[0_1px_2px_rgba(28,26,22,0.04)]">
  <div class="flex items-center justify-between gap-2">
    <div class="flex items-center gap-2">
      {#if icon}
        <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={`background:${accent}14;color:${accent}`}>
          <svelte:component this={icon} size={15} strokeWidth={2.2} />
        </span>
      {/if}
      <p class="text-[13px] font-bold text-ink/80">{title}</p>
    </div>
    <SourceBadge {source} />
  </div>

  {#if clean.length}
    <div class="mt-3 grid gap-2.5">
      {#each clean as row}
        <div>
          <div class="flex items-center justify-between gap-2 text-[12px]">
            <span class="min-w-0 truncate font-medium text-ink/70" title={row.label}>{row.label}</span>
            <span class="shrink-0 font-bold text-ink/80">{fmt(row.value)}</span>
          </div>
          <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
            <div class="h-full rounded-full transition-[width] duration-500" style={`width:${Math.max(4, (row.value / max) * 100)}%;background:${accent}`}></div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="mt-3 flex flex-1 items-center justify-center rounded-xl border border-dashed border-ink/10 bg-sand/20 px-3 py-6 text-center">
      <p class="text-[12px] leading-5 text-ink/45">{emptyText}</p>
    </div>
  {/if}
</div>
