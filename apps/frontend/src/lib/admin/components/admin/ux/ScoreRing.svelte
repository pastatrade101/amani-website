<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  // Circular 0–100 score gauge (health + category scores). Shows N/A honestly
  // when the score can't be derived from real data.
  export let score: number | null = null;
  export let size = 132;
  export let stroke = 10;
  export let label = '';

  $: r = (size - stroke) / 2;
  $: circ = 2 * Math.PI * r;
  // band colour: green ≥ 70, amber ≥ 50, red below
  $: color = score == null ? '#9ca3af' : score >= 70 ? '#0f9d58' : score >= 50 ? '#E37400' : '#e04a3f';

  const tw = tweened(0, { duration: 900, easing: cubicOut });
  $: tw.set(score ?? 0);
  $: offset = circ - (($tw as number) / 100) * circ;
</script>

<div class="relative grid place-items-center" style={`width:${size}px;height:${size}px`}>
  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} class="-rotate-90" aria-hidden="true">
    <circle cx={size / 2} cy={size / 2} {r} fill="none" stroke="currentColor" class="text-ink/[0.08]" stroke-width={stroke} />
    {#if score != null}
      <circle
        cx={size / 2} cy={size / 2} {r} fill="none" stroke={color} stroke-width={stroke}
        stroke-linecap="round" stroke-dasharray={circ} stroke-dashoffset={offset}
      />
    {/if}
  </svg>
  <div class="absolute inset-0 grid place-content-center text-center">
    {#if score == null}
      <span class="text-lg font-bold text-ink/35">N/A</span>
    {:else}
      <span class="text-[26px] font-extrabold leading-none text-heading">{Math.round($tw as number)}</span>
      {#if label}<span class="mt-0.5 text-[10px] font-bold uppercase tracking-wide" style={`color:${color}`}>{label}</span>{/if}
    {/if}
  </div>
</div>
