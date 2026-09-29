<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { CheckCircle2, AlertCircle, X } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  type Toast = { id: string; message: string; type: 'error' | 'success' };
  export let toasts: Toast[] = [];
  const dispatch = createEventDispatcher<{ dismiss: string }>();
</script>
{#if toasts.length}
  <div class="fixed right-4 top-4 z-[300] grid w-[min(400px,calc(100vw-32px))] gap-3" aria-live="polite">
    {#each toasts as toast (toast.id)}
      <div class="flex items-start gap-3 rounded-xl border border-border bg-white p-4 text-primary shadow-lg" role={toast.type === 'error' ? 'alert' : 'status'} in:fly={{ y:-8,duration:150 }} out:fade={{duration:120}}>
        {#if toast.type === 'error'}<AlertCircle class="mt-0.5 shrink-0 text-destructive" size={18}/>{:else}<CheckCircle2 class="mt-0.5 shrink-0 text-emerald-600" size={18}/>{/if}
        <p class="flex-1 text-xs leading-6">{toast.message}</p><Button variant="ghost" size="icon-xs" aria-label="Dismiss notification" onclick={() => dispatch('dismiss',toast.id)}><X size={13}/></Button>
      </div>
    {/each}
  </div>
{/if}
