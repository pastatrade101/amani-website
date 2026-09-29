<script lang="ts">
  import { createEventDispatcher, type Component } from 'svelte';
  import { Compass, Plus } from '@lucide/svelte';
  import * as Card from '$lib/components/ui/card';
  import AdminButton from './AdminButton.svelte';
  export let title = 'Nothing here yet';
  export let message = 'Add your first item to get started.';
  export let actionLabel = '';
  export let icon: Component = Compass;
  const dispatch = createEventDispatcher<{ action: void }>();
</script>
<Card.Root class="cms-empty-state">
  <Card.Content class="flex flex-col items-center p-8 sm:p-14 text-center">
    <div class="cms-empty-icon"><svelte:component this={icon} size={26} strokeWidth={1.5}/></div>
    <h2 class="mt-5 text-base font-semibold tracking-tight">{title}</h2>
    <p class="mt-2 max-w-md text-[13px] leading-6 text-muted-foreground">{message}</p>
    {#if actionLabel}<div class="mt-6"><AdminButton on:click={() => dispatch('action')}><Plus size={15}/>{actionLabel}</AdminButton></div>{/if}
  </Card.Content>
</Card.Root>
