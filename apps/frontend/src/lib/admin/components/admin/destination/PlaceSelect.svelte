<script lang="ts">
  import * as Select from '$lib/components/ui/select';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  /**
   * One place field as a dropdown. "Other…" opens a text box for a place that
   * is not on the list, and a stored value that is not on it (older free text)
   * opens there too, so nothing typed before is ever lost.
   */
  let {
    label,
    name,
    options,
    value = $bindable(''),
    hint = '',
    placeholder = 'Choose…',
    required = false,
    emptyLabel = 'Not set',
    customPlaceholder = 'Type the name as visitors should read it',
    onchange
  }: {
    label: string;
    name: string;
    options: string[];
    value?: string;
    hint?: string;
    placeholder?: string;
    required?: boolean;
    /** The "nothing chosen" item; hidden for required fields. */
    emptyLabel?: string;
    customPlaceholder?: string;
    onchange?: (value: string) => void;
  } = $props();

  const OTHER = '__other';
  const NONE = '__none';
  // "Other…" picked, or a value the list does not have (shown with its text).
  // A value that is on the list (set here or from outside, e.g. a suggested
  // fix) always shows as the list item.
  let forced = $state(false);
  let custom = $derived(forced || (Boolean(value) && !options.includes(value)));
  $effect(() => {
    if (options.includes(value)) forced = false;
  });
  let selected = $derived(custom ? OTHER : value || NONE);
  let shown = $derived(custom ? `Other: ${value || '…'}` : value || placeholder);

  function pick(next: string) {
    if (next === OTHER) {
      forced = true;
      value = options.includes(value) ? '' : value;
    } else {
      forced = false;
      value = next === NONE ? '' : next;
    }
    onchange?.(value);
  }
</script>

<div class="cms-field">
  <Label for={name}>{label}{#if required}<span class="text-destructive" aria-hidden="true">*</span>{/if}</Label>
  <Select.Root type="single" value={selected} onValueChange={pick}>
    <Select.Trigger id={name} class="h-10 w-full min-w-0" aria-describedby={hint ? `${name}-hint` : undefined}>
      <span class={`truncate ${!value && !custom ? 'text-ink/45' : ''}`}>{shown}</span>
    </Select.Trigger>
    <Select.Content class="cms-select-content max-h-72">
      {#if !required}<Select.Item value={NONE} label={emptyLabel}><span class="text-ink/55">{emptyLabel}</span></Select.Item>{/if}
      {#each options as option (option)}<Select.Item value={option} label={option}>{option}</Select.Item>{/each}
      <Select.Item value={OTHER} label="Other…">Other…</Select.Item>
    </Select.Content>
  </Select.Root>
  {#if custom}
    <Input id={`${name}-custom`} {name} bind:value placeholder={customPlaceholder} aria-label={`${label}, typed`} oninput={() => onchange?.(value)} />
  {/if}
  {#if hint}<span id={`${name}-hint`} class="cms-field-hint">{hint}</span>{/if}
</div>
