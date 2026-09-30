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
  /** Length to aim for; the counter turns red past it (amber when `maxlength` still allows more). */
  export let counter: number | undefined = undefined;
  /** Hard cap: typing stops here, and the counter shows it when no `counter` is given. */
  export let maxlength: number | undefined = undefined;

  $: target = counter ?? maxlength;
  $: cap = maxlength ?? counter;
  $: length = String(value ?? '').length;
  // Amber only when a softer target sits below a hard cap (an SEO snippet cut short, still allowed).
  $: tone = cap !== undefined && length > cap ? 'text-destructive' : target !== undefined && length > target ? 'text-amber-700' : '';
</script>
<div class="cms-field">
  <Label for={name}>{label}{#if required}<span class="text-destructive" aria-hidden="true">*</span>{/if}</Label>
  <Input id={name} {name} {type} bind:value {placeholder} {required} {min} {step} {maxlength} aria-describedby={target ? `${name}-counter` : undefined}/>
  {#if target}<span id={`${name}-counter`} class={`cms-field-hint text-right ${tone}`}>{length}/{target}{#if cap && cap !== target && length > target} · max {cap}{/if}</span>{/if}
</div>
