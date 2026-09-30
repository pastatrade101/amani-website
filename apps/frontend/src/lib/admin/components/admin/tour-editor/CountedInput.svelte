<script lang="ts">
  import { Input as CmsInput } from '$lib/components/ui/input';

  /**
   * A one-line input that counts toward its limit inside the field: faint
   * while focused, amber near the cap, red when text arrived longer than it
   * (older data, an AI draft). `maxlength` stops typing at the cap; the form's
   * save check explains anything already past it.
   */
  export let value = '';
  export let maxlength: number;
  /** Accessible name; these rows have no visible label. */
  export let label: string;
  export let placeholder = '';
  let className = '';
  export { className as class };
  export let onkeydown: ((event: KeyboardEvent) => void) | undefined = undefined;

  $: length = String(value ?? '').length;
  $: tone =
    length > maxlength
      ? 'block font-semibold text-destructive'
      : length >= maxlength * 0.85
        ? 'block text-amber-700'
        : 'hidden text-ink/35 group-focus-within:block';
</script>

<div class="group relative min-w-0">
  <CmsInput class={`${className} w-full pr-16`} aria-label={label} {placeholder} {maxlength} bind:value {onkeydown} />
  <span class={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] tabular-nums ${tone}`} aria-hidden="true">{length}/{maxlength}</span>
</div>
