<script lang="ts">
  // Lightweight inline-SVG trend line for KPI cards — no Chart.js overhead.
  export let data: number[] = [];
  export let color = '#4A3728';
  export let width = 96;
  export let height = 30;

  $: clean = (data ?? []).map((n) => (Number.isFinite(n) ? Number(n) : 0));
  $: path = (() => {
    if (clean.length < 2) return '';
    const max = Math.max(...clean);
    const min = Math.min(...clean);
    const range = max - min || 1;
    const step = width / (clean.length - 1);
    const pad = 3;
    return clean
      .map((v, i) => `${(i * step).toFixed(1)},${(height - pad - ((v - min) / range) * (height - pad * 2)).toFixed(1)}`)
      .join(' ');
  })();
  // Last point (for the little end dot).
  $: end = path ? path.split(' ').pop()!.split(',').map(Number) : null;
</script>

{#if path}
  <svg {width} {height} viewBox={`0 0 ${width} ${height}`} class="overflow-visible" aria-hidden="true">
    <polyline points={path} fill="none" stroke={color} stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" />
    {#if end}<circle cx={end[0]} cy={end[1]} r="2.2" fill={color} />{/if}
  </svg>
{/if}
