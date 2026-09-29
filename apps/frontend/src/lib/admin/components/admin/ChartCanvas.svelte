<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  // Generic Chart.js wrapper. Loaded in the browser only (lib touches canvas).
  export let type: 'line' | 'bar' | 'doughnut' = 'bar';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export let data: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export let options: Record<string, any> = {};
  export let height = 280;

  let canvas: HTMLCanvasElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chart: any = null;
  let mounted = false;

  onMount(async () => {
    const [{ Chart, registerables }, datalabels] = await Promise.all([
      import('chart.js'),
      import('chartjs-plugin-datalabels')
    ]);
    Chart.register(...registerables, datalabels.default);
    Chart.defaults.font.family = 'Figtree, Inter, ui-sans-serif, sans-serif';
    // datalabels is opt-in per chart (charts enable it via options.plugins.datalabels).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Chart.defaults.plugins as any).datalabels = { ...(Chart.defaults.plugins as any).datalabels, display: false };
    chart = new Chart(canvas, { type, data, options });
    mounted = true;
  });

  onDestroy(() => {
    try { chart?.destroy?.(); } catch { /* ignore */ }
  });

  // Update (re-animates) when the data/options objects change.
  $: if (mounted && chart) {
    chart.data = data;
    chart.options = options;
    chart.update();
  }
</script>

<div class="relative w-full" style={`height:${height}px`}>
  <canvas bind:this={canvas}></canvas>
</div>
