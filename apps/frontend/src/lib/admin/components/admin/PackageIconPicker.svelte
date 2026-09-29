<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';

  import { Banknote, Car, Clock3, MapPin, Plane, Route, Tent, Users, X } from '@lucide/svelte';

  export let label = 'Icon';
  export let value = '';
  export let hint = '';

  const options = [
    { value: 'plane', label: 'Flight', Icon: Plane },
    { value: 'pin', label: 'Location', Icon: MapPin },
    { value: 'clock', label: 'Duration', Icon: Clock3 },
    { value: 'route', label: 'Route', Icon: Route },
    { value: 'price', label: 'Price', Icon: Banknote },
    { value: 'people', label: 'Travellers', Icon: Users },
    { value: 'vehicle', label: 'Vehicle', Icon: Car },
    { value: 'tent', label: 'Accommodation', Icon: Tent }
  ];
</script>

<div class="grid gap-1.5">
  <span class="text-[13px] font-semibold text-ink/65">{label}</span>
  <div class="flex flex-wrap gap-2" role="listbox" aria-label={label}>
    {#each options as option (option.value)}
      <CmsButton variant="ghost"
        type="button"
        class={`grid h-10 w-10 place-items-center rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/30 ${
          value === option.value
            ? 'border-goldfinch-gold bg-goldfinch-gold/15 text-heading'
            : 'border-ink/15 bg-surface text-ink/60 hover:border-goldfinch-gold/50 hover:text-heading'
        }`}
        role="option"
        aria-label={option.label}
        aria-selected={value === option.value}
        title={option.label}
        onclick={() => (value = option.value)}
      >
        <svelte:component this={option.Icon} size={18} strokeWidth={1.8} />
      </CmsButton>
    {/each}
    {#if value}
      <CmsButton variant="ghost"
        type="button"
        class="grid h-10 w-10 place-items-center rounded-md border border-ink/15 bg-surface text-ink/45 transition hover:border-red-300 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/30"
        aria-label="Clear selected icon"
        title="Clear selected icon"
        onclick={() => (value = '')}
      >
        <X size={17} />
      </CmsButton>
    {/if}
  </div>
  {#if !value}<span class="text-[11px] text-ink/45">Choose the matching icon above.</span>{/if}
  {#if hint}<span class="text-[11px] text-ink/45">{hint}</span>{/if}
</div>
