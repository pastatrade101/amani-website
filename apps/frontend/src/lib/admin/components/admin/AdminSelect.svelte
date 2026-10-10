<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import * as Select from '$lib/components/ui/select';
  import { Label } from '$lib/components/ui/label';
  export let label: string;
  export let name: string;
  export let value = '';
  export let options: { label: string; value: string }[] = [];
  const dispatch = createEventDispatcher<{ change: string }>();
  $: selected = options.find(option => option.value === value)?.label ?? 'Select an option';
</script>
<div class="cms-field">
  <Label for={name}>{label}</Label>
  <Select.Root type="single" {name} bind:value onValueChange={(next) => dispatch('change', next)}>
    <Select.Trigger id={name} class="w-full min-w-0 h-10"><span class="truncate">{selected}</span></Select.Trigger>
    <Select.Content class="cms-select-content">
      {#each options as option}<Select.Item value={option.value} label={option.label}>{option.label}</Select.Item>{/each}
    </Select.Content>
  </Select.Root>
</div>
