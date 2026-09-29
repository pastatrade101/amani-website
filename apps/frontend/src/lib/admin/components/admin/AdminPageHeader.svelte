<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Component } from 'svelte';
  import AdminButton from './AdminButton.svelte';

  export let actionLabel = '';
  export let actionIcon: Component | null = null;
  export let description = '';
  export let eyebrow = 'Admin CMS';
  export let secondaryLabel = '';
  export let title = '';

  const dispatch = createEventDispatcher<{ action: void; secondary: void }>();
</script>

<section class="cms-page-header">
  <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
    <div class="max-w-3xl">
      <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
      <h1 class="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-[30px]">{title}</h1>
      {#if description}
        <p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      {/if}
    </div>

    {#if actionLabel || secondaryLabel}
      <div class="flex flex-wrap gap-3">
        {#if secondaryLabel}
          <AdminButton variant="secondary" on:click={() => dispatch('secondary')}>{secondaryLabel}</AdminButton>
        {/if}
        {#if actionLabel}
          <AdminButton on:click={() => dispatch('action')}>
            {#if actionIcon}
              <svelte:component this={actionIcon} size={17} />
            {/if}
            {actionLabel}
          </AdminButton>
        {/if}
      </div>
    {/if}
  </div>
</section>
