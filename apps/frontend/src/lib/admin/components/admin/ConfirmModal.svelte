<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Button } from '$lib/components/ui/button';
  import { AlertTriangle } from '@lucide/svelte';
  export let open = false;
  export let title = 'Confirm action';
  export let message = 'Are you sure you want to continue?';
  const dispatch = createEventDispatcher<{ confirm: void; cancel: void }>();
</script>
<AlertDialog.Root {open} onOpenChange={(next) => { if (!next) dispatch('cancel'); }}>
  <AlertDialog.Content>
    <div class="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><AlertTriangle size={21}/></div>
    <AlertDialog.Header><AlertDialog.Title>{title}</AlertDialog.Title><AlertDialog.Description>{message}</AlertDialog.Description></AlertDialog.Header>
    <AlertDialog.Footer><AlertDialog.Cancel onclick={() => dispatch('cancel')}>Cancel</AlertDialog.Cancel><Button variant="destructive" onclick={() => dispatch('confirm')}>Confirm</Button></AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
