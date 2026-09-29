<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  export let ariaLabel: string | undefined = undefined;
  export let className = '';
  export let disabled = false;
  export let size: 'sm' | 'md' = 'md';
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let variant: 'danger' | 'ghost' | 'primary' | 'secondary' = 'primary';
  const dispatch = createEventDispatcher<{ click: MouseEvent }>();
  const variants = { danger: 'destructive', ghost: 'ghost', primary: 'default', secondary: 'outline' } as const;
</script>
<Button {type} {disabled} aria-label={ariaLabel} variant={variants[variant]} size={size === 'sm' ? 'sm' : 'default'} class={`cms-button ${className}`} onclick={(event) => dispatch('click', event)}><slot/></Button>
