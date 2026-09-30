<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import type { HTMLInputTypeAttribute } from 'svelte/elements';
  export let label: string;
  export let name: string;
  export let type: Exclude<HTMLInputTypeAttribute, 'file'> = 'text';
  export let value = '';
  export let placeholder = '';
  export let required = false;
  export let min: number | undefined = undefined;
  export let step: number | 'any' | undefined = undefined;
  export let counter: number | undefined = undefined;
</script>
<div class="cms-field">
  <Label for={name}>{label}{#if required}<span class="text-destructive" aria-hidden="true">*</span>{/if}</Label>
  <Input id={name} {name} {type} bind:value {placeholder} {required} {min} {step} aria-describedby={counter ? `${name}-counter` : undefined}/>
  {#if counter}<span id={`${name}-counter`} class={`cms-field-hint text-right ${String(value ?? '').length > counter ? 'text-destructive' : ''}`}>{String(value ?? '').length}/{counter}</span>{/if}
</div>
