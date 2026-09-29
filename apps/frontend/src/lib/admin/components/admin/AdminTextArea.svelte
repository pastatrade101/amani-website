<script lang="ts">
  import { Textarea } from '$lib/components/ui/textarea';
  import { Label } from '$lib/components/ui/label';
  export let label: string;
  export let name: string;
  export let value = '';
  export let rows = 5;
  export let placeholder = '';
  export let maxlength: number | undefined = undefined;
  export let counter: number | undefined = undefined;
  $: target = counter ?? maxlength;
</script>
<div class="cms-field">
  <Label for={name}>{label}</Label>
  <Textarea id={name} {name} bind:value {rows} {placeholder} {maxlength} aria-describedby={target ? `${name}-counter` : undefined}/>
  {#if target}<span id={`${name}-counter`} class={`cms-field-hint text-right ${(value ?? '').length > target ? 'text-destructive' : ''}`}>{(value ?? '').length}/{target}</span>{/if}
</div>
