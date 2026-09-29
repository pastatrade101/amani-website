<script lang="ts">
  import { ArrowDownRight, ArrowUpRight } from '@lucide/svelte';
  import Counter from '../Counter.svelte';
  import Sparkline from '../Sparkline.svelte';
  import SourceBadge from './SourceBadge.svelte';

  // One KPI, provider-agnostic. Renders a real value + its source, OR — when the
  // metric isn't available from any connected source — an honest empty/deep-link
  // state. It NEVER invents a number.
  export let label: string;
  export let value: number | null = null;
  export let format: 'number' | 'percent' | 'duration' | 'currency' = 'number';
  export let source = 'makutano';
  export let available = true;
  export let deepLink: string | undefined = undefined;
  export let deepLinkLabel = 'Open in Clarity';
  export let emptyText = '';
  export let hint = '';
  export let series: number[] = [];
  export let icon: typeof ArrowUpRight | undefined = undefined;
  export let accent = '#153733';
  export let loading = false;
  // Previous-period benchmark. `invertChange` = a drop is good (bounce/quick-backs).
  export let changePct: number | null = null;
  export let invertChange = false;

  $: changeGood = changePct == null ? null : invertChange ? changePct < 0 : changePct > 0;
  $: changeUp = changePct != null && changePct > 0;

  // ms → "1m 20s" / "45s"
  const duration = (ms: number): string => {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
  };
  $: show = available && value != null && Number.isFinite(value);
  $: emptyLabel = emptyText || (deepLink ? 'Available in Clarity' : 'No data yet');
</script>

<div
  class="group relative flex flex-col rounded-2xl border border-ink/10 bg-surface p-4 shadow-[0_1px_2px_rgba(28,26,22,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-[0_10px_28px_rgba(28,26,22,0.09)]"
>
  <div class="flex items-start justify-between gap-2">
    <div class="flex min-w-0 items-center gap-2">
      {#if icon}
        <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={`background:${accent}14;color:${accent}`}>
          <svelte:component this={icon} size={15} strokeWidth={2.2} />
        </span>
      {/if}
      <p class="truncate text-[12px] font-semibold text-ink/60" title={label}>{label}</p>
    </div>
    {#if show && series.length > 1}
      <Sparkline data={series} color={accent} width={62} height={22} />
    {/if}
  </div>

  {#if loading}
    <div class="mt-3 h-7 w-24 animate-pulse rounded-md bg-ink/[0.06]"></div>
    <div class="mt-2.5 h-3 w-20 animate-pulse rounded bg-ink/[0.05]"></div>
  {:else if show}
    <p class="mt-2 text-[26px] font-extrabold leading-none tracking-tight text-heading">
      {#if format === 'currency'}${''}<Counter value={value ?? 0} />
      {:else if format === 'percent'}<Counter value={value ?? 0} suffix="%" />
      {:else if format === 'duration'}{duration(value ?? 0)}
      {:else}<Counter value={value ?? 0} />{/if}
    </p>
    <div class="mt-2.5 flex items-center justify-between gap-2">
      <SourceBadge {source} />
      <span class="flex items-center gap-2">
        {#if changePct != null}
          <span class={`inline-flex items-center gap-0.5 text-[11px] font-bold ${changeGood ? 'text-emerald-600' : 'text-red-500'}`} title="vs previous period">
            <svelte:component this={changeUp ? ArrowUpRight : ArrowDownRight} size={12} strokeWidth={2.6} />{Math.abs(changePct)}%
          </span>
        {/if}
        {#if hint}<span class="truncate text-[10px] text-ink/40" title={hint}>{hint}</span>{/if}
      </span>
    </div>
  {:else}
    <p class="mt-2 text-[13px] font-semibold text-ink/35">{emptyLabel}</p>
    <div class="mt-2.5 flex items-center justify-between gap-2">
      <SourceBadge {source} />
      {#if deepLink}
        <a
          class="inline-flex items-center gap-0.5 text-[11px] font-bold text-forest transition hover:gap-1 hover:underline"
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          {deepLinkLabel}<ArrowUpRight size={12} strokeWidth={2.6} />
        </a>
      {/if}
    </div>
  {/if}
</div>
