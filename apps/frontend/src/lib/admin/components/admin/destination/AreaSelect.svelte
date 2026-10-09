<script lang="ts">
  import * as Select from '$lib/components/ui/select';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { adminAreasFor, joinAreas, splitAreas } from '$lib/admin/destination-places';

  /**
   * The administrative area(s) a destination lies in, picked from the
   * country's list. A park can span a border (the Serengeti is in Mara and
   * Simiyu), so up to three. Older free-text locations, and countries without
   * a list, use a plain text box instead.
   */
  let {
    name,
    country,
    value = $bindable(''),
    label = 'Administrative region',
    hint = '',
    max = 3
  }: { name: string; country: string; value?: string; label?: string; hint?: string; max?: number } = $props();

  let options = $derived(adminAreasFor(country));
  let parsed = $derived(splitAreas(country, value));
  let typing = $state(false);
  // Text that is not a list of known areas stays editable as typed.
  $effect(() => {
    if (parsed.custom) typing = true;
  });
  let areaWord = $derived(country === 'Kenya' ? 'county' : 'region');
  let shown = $derived(parsed.areas.length ? parsed.areas.join(', ') : `Choose a ${areaWord}…`);
</script>

<div class="cms-field">
  <Label for={name}>{label}</Label>
  {#if options.length && !typing}
    <Select.Root type="multiple" value={parsed.areas} onValueChange={(next: string[]) => (value = joinAreas(next.slice(0, max)))}>
      <Select.Trigger id={name} class="h-10 w-full min-w-0" aria-describedby={`${name}-hint`}>
        <span class={`truncate ${parsed.areas.length ? '' : 'text-ink/45'}`}>{shown}</span>
      </Select.Trigger>
      <Select.Content class="cms-select-content max-h-72">
        {#each options as option (option)}
          <Select.Item value={option} label={option} disabled={!parsed.areas.includes(option) && parsed.areas.length >= max}>{option}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <span id={`${name}-hint`} class="cms-field-hint">
      {hint}{hint ? ' ' : ''}Up to {max}. <button type="button" class="font-semibold text-forest underline-offset-2 hover:underline" onclick={() => (typing = true)}>Type it instead</button>
    </span>
  {:else}
    <Input id={name} {name} bind:value placeholder={options.length ? `e.g. ${options[0]}` : 'e.g. the district or province'} aria-describedby={`${name}-hint`} />
    <span id={`${name}-hint`} class="cms-field-hint">
      {hint}
      {#if options.length}{hint ? ' ' : ''}<button type="button" class="font-semibold text-forest underline-offset-2 hover:underline" onclick={() => { typing = false; if (parsed.custom) value = ''; }}>Choose from the list</button>{/if}
    </span>
  {/if}
</div>
