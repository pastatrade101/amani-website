<script lang="ts">
  import type { ArrowRight } from '@lucide/svelte';

  // Onboarding empty state: says what will appear here and how to make it happen,
  // instead of a blank "No data yet" box. `icon` is any Lucide icon component.
  export let icon: typeof ArrowRight;
  export let title: string;
  export let description = '';
  export let hint = '';
  export let minHeight = 220;
</script>

<div
  class="grid place-items-center gap-2.5 rounded-xl border border-dashed border-ink/15 bg-sand/20 px-6 py-8 text-center"
  style={`min-height:${minHeight}px`}
>
  <span class="grid h-12 w-12 place-items-center rounded-2xl bg-forest/10 text-forest ring-1 ring-ink/5 dark:text-goldfinch-gold">
    <svelte:component this={icon} size={22} strokeWidth={1.8} />
  </span>
  <p class="text-sm font-bold text-ink/75">{title}</p>
  {#if description}<p class="max-w-sm text-xs leading-5 text-ink/55">{description}</p>{/if}
  {#if hint}
    <p class="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-goldfinch-gold/12 px-3 py-1 text-[11px] font-semibold text-clay">
      <span aria-hidden="true">💡</span> {hint}
    </p>
  {/if}
</div>
