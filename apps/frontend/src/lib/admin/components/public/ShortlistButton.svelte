<script lang="ts">
  import { Heart } from '@lucide/svelte';
  import { shortlist, toggleShortlist, type ShortlistItem } from '$lib/admin/shortlist';

  export let item: ShortlistItem;
  export let variant: 'icon' | 'full' = 'icon';

  $: saved = $shortlist.some((i) => i.slug === item.slug);

  const toggle = (event: MouseEvent) => {
    // The card wraps a link, so never let the toggle navigate.
    event.preventDefault();
    event.stopPropagation();
    toggleShortlist(item);
  };
</script>

{#if variant === 'full'}
  <button
    type="button"
    aria-pressed={saved}
    class={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-5 font-semibold transition ${
      saved ? 'border-clay/40 bg-clay/10 text-clay' : 'border-ink/15 bg-surface text-ink/70 hover:bg-canvas'
    }`}
    on:click={toggle}
  >
    <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
    {saved ? 'Saved' : 'Save trip'}
  </button>
{:else}
  <button
    type="button"
    aria-label={saved ? 'Remove from saved trips' : 'Save this trip'}
    aria-pressed={saved}
    class={`grid h-9 w-9 place-items-center rounded-full shadow-sm backdrop-blur transition ${
      saved ? 'bg-clay text-white' : 'bg-surface/85 text-ink/70 hover:bg-surface hover:text-clay'
    }`}
    on:click={toggle}
  >
    <Heart size={17} fill={saved ? 'currentColor' : 'none'} />
  </button>
{/if}
