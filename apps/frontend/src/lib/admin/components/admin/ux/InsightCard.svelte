<script lang="ts">
  import { Clock, Gauge, TrendingUp, Wrench } from '@lucide/svelte';
  import SourceBadge from './SourceBadge.svelte';

  export let insight: {
    priority: 'critical' | 'high' | 'medium' | 'low';
    confidence: 'high' | 'medium' | 'low';
    title: string;
    why: string;
    impact: string;
    difficulty: 'easy' | 'medium' | 'hard';
    estTime: string;
    source: string;
  };

  const PRIORITY: Record<string, { label: string; cls: string; bar: string }> = {
    critical: { label: 'Critical', cls: 'bg-red-500/12 text-red-600', bar: 'bg-red-500' },
    high: { label: 'High', cls: 'bg-amber-500/12 text-amber-600', bar: 'bg-amber-500' },
    medium: { label: 'Medium', cls: 'bg-forest/12 text-forest', bar: 'bg-forest' },
    low: { label: 'Low', cls: 'bg-ink/[0.06] text-ink/50', bar: 'bg-ink/30' }
  };
  const CONFIDENCE: Record<string, string> = {
    high: 'text-emerald-600', medium: 'text-amber-600', low: 'text-ink/45'
  };
  $: p = PRIORITY[insight.priority] ?? PRIORITY.medium;
</script>

<div class="relative flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-surface p-4 pl-5 shadow-[0_1px_2px_rgba(28,26,22,0.04)] transition hover:shadow-[0_8px_22px_rgba(28,26,22,0.08)]">
  <span class={`absolute inset-y-0 left-0 w-1 ${p.bar}`} aria-hidden="true"></span>

  <div class="flex flex-wrap items-center gap-2">
    <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${p.cls}`}>{p.label}</span>
    <span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ink/40">
      <Gauge size={11} strokeWidth={2.4} /> Confidence <span class={CONFIDENCE[insight.confidence] ?? 'text-ink/45'}>{insight.confidence}</span>
    </span>
  </div>

  <h4 class="mt-2 text-[15px] font-bold leading-snug text-heading">{insight.title}</h4>
  <p class="mt-1.5 text-[13px] leading-6 text-ink/65">{insight.why}</p>

  <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/[0.07] pt-3">
    <span class="inline-flex items-center gap-1 rounded-lg bg-emerald-500/[0.08] px-2 py-1 text-[11px] font-bold text-emerald-700">
      <TrendingUp size={12} strokeWidth={2.6} /> {insight.impact}
    </span>
    <span class="inline-flex items-center gap-1 rounded-lg bg-sand/50 px-2 py-1 text-[11px] font-semibold text-ink/65">
      <Wrench size={12} strokeWidth={2.4} /> {insight.difficulty}
    </span>
    <span class="inline-flex items-center gap-1 rounded-lg bg-sand/50 px-2 py-1 text-[11px] font-semibold text-ink/65">
      <Clock size={12} strokeWidth={2.4} /> {insight.estTime}
    </span>
    <span class="ml-auto"><SourceBadge source={insight.source} /></span>
  </div>
</div>
