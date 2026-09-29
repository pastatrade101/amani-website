<script lang="ts">
  import { ArrowUpRight } from '@lucide/svelte';

  // A launcher into Microsoft Clarity for the things that CAN'T be exported
  // (recordings, heatmaps, rage-click reports). We never recreate Clarity's UI —
  // we open it. Disabled (with a hint) until Clarity is connected.
  export let title: string;
  export let desc: string;
  export let href: string;
  export let icon: typeof ArrowUpRight;
  export let accent = '#0F6CBD';
  export let enabled = true;
</script>

{#if enabled}
  <a
    class="group flex items-start gap-3 rounded-2xl border border-ink/10 bg-surface p-4 shadow-[0_1px_2px_rgba(28,26,22,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--a)]/40 hover:shadow-[0_10px_26px_rgba(28,26,22,0.09)]"
    style={`--a:${accent}`}
    href={href}
    target="_blank"
    rel="noopener noreferrer"
  >
    <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={`background:${accent}14;color:${accent}`}>
      <svelte:component this={icon} size={19} strokeWidth={2.1} />
    </span>
    <span class="min-w-0 flex-1">
      <span class="flex items-center gap-1 text-[13px] font-bold text-ink/85">
        {title}
        <ArrowUpRight size={13} strokeWidth={2.6} class="text-ink/30 transition group-hover:translate-x-0.5 group-hover:text-[color:var(--a)]" />
      </span>
      <span class="mt-0.5 block text-[11.5px] leading-4 text-ink/50">{desc}</span>
    </span>
  </a>
{:else}
  <div class="flex items-start gap-3 rounded-2xl border border-dashed border-ink/12 bg-sand/20 p-4 opacity-70">
    <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink/[0.05] text-ink/35">
      <svelte:component this={icon} size={19} strokeWidth={2.1} />
    </span>
    <span class="min-w-0 flex-1">
      <span class="text-[13px] font-bold text-ink/50">{title}</span>
      <span class="mt-0.5 block text-[11.5px] leading-4 text-ink/40">Connect Clarity to enable</span>
    </span>
  </div>
{/if}
