<script lang="ts">
  import { Textarea } from '$lib/components/ui/textarea';
  import { Label } from '$lib/components/ui/label';
  export let label: string;
  export let name: string;
  export let value = '';
  export let rows = 5;
  export let placeholder = '';
  /** Hard cap: typing stops here. */
  export let maxlength: number | undefined = undefined;
  /** Length to aim for; with `maxlength` above it, passing it turns the counter amber rather than red. */
  export let counter: number | undefined = undefined;
  $: target = counter ?? maxlength;
  $: cap = maxlength ?? counter;
  $: length = (value ?? '').length;
  $: tone = cap !== undefined && length > cap ? 'text-destructive' : target !== undefined && length > target ? 'text-amber-700' : '';
</script>
<div class="cms-field">
  <Label for={name}>{label}</Label>
  <Textarea id={name} {name} bind:value {rows} {placeholder} {maxlength} aria-describedby={target ? `${name}-counter` : undefined}/>
  {#if target}<span id={`${name}-counter`} class={`cms-field-hint text-right ${tone}`}>{length}/{target}{#if cap && cap !== target && length > target} · max {cap}{/if}</span>{/if}
</div>
