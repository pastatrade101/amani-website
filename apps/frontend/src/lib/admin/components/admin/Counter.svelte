<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  // Animated number for KPI cards — counts up when the value changes.
  export let value = 0;
  export let suffix = '';
  export let decimals = 0;

  const n = tweened(0, { duration: 650, easing: cubicOut });
  $: n.set(Number(value) || 0);
  $: shown = decimals > 0 ? $n.toFixed(decimals) : Math.round($n).toLocaleString();
</script>

<span>{shown}{suffix}</span>
