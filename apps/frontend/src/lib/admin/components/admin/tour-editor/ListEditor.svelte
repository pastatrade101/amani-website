<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Input as CmsInput } from '$lib/components/ui/input';

  import { tick } from 'svelte';
  import { ArrowDown, ArrowUp, Check, Plus, Trash2, X } from '@lucide/svelte';
  import CountedInput from './CountedInput.svelte';
  import { moveItem, text } from './model';

  /**
   * An ordered list of short lines: add, remove, reorder, and Enter starts the
   * next line. A blank row is a placeholder, not content — the save drops it —
   * so the list is never shown empty.
   */
  export let items: string[] = [''];
  /** Screen-reader name for each row: "Inclusion 3". */
  export let label = 'Item';
  export let placeholder = '';
  export let max = 60;
  /** Characters per line; each row counts down to it and stops there. */
  export let maxLength: number | undefined = undefined;
  /** Why the list stops at `max`, said once it is full: "Ten short points read at a glance." */
  export let limitNote = '';
  /** One-click additions, only offered while not already in the list. */
  export let suggestions: string[] = [];
  export let addLabel = 'Add';
  export let tone: 'plain' | 'include' | 'exclude' = 'plain';

  let listEl: HTMLDivElement;
  const rowClass =
    'h-10 rounded-md border border-ink/15 bg-black/[0.02] px-3 text-sm text-ink outline-none focus:border-forest focus:bg-surface focus:ring-2 focus:ring-forest/20';

  $: used = new Set(items.map((item) => text(item).toLowerCase()));
  $: openSuggestions = suggestions.filter((suggestion) => !used.has(suggestion.toLowerCase()));
  $: filledCount = items.filter((item) => text(item)).length;
  $: full = items.length >= max;
  // Older or AI-written lists can arrive longer than the limit; the save explains, this shows it.
  $: overCount = Math.max(0, filledCount - max);
  $: fullNote = `That is the most this list takes${limitNote ? ` — ${limitNote}` : '.'}`;

  const focusRow = async (index: number) => {
    await tick();
    listEl?.querySelectorAll<HTMLInputElement>('input')[index]?.focus();
  };

  const insertAfter = (index: number) => {
    if (full) return;
    items = [...items.slice(0, index + 1), '', ...items.slice(index + 1)];
    void focusRow(index + 1);
  };

  const add = () => {
    const last = items.length - 1;
    // A trailing blank row is already the place to type.
    if (last >= 0 && !text(items[last])) return void focusRow(last);
    insertAfter(last);
  };

  const remove = (index: number) => {
    const next = items.filter((_, current) => current !== index);
    items = next.length ? next : [''];
  };

  const addSuggestion = (value: string) => {
    const blank = items.findIndex((item) => !text(item));
    if (blank >= 0) {
      items[blank] = value;
      items = items;
    } else if (!full) {
      items = [...items, value];
    }
  };

  const onKey = (event: KeyboardEvent, index: number) => {
    if (event.key !== 'Enter' || event.isComposing) return;
    // Enter starts the next line instead of submitting the whole editor.
    event.preventDefault();
    insertAfter(index);
  };
</script>

<div class="grid gap-2">
  <div class="grid gap-2" bind:this={listEl}>
    {#each items as _item, index}
      <div class="flex min-w-0 items-center gap-1.5">
        {#if tone === 'include'}
          <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70" aria-hidden="true"><Check size={13} /></span>
        {:else if tone === 'exclude'}
          <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 ring-1 ring-red-200/70" aria-hidden="true"><X size={13} /></span>
        {/if}
        {#if maxLength}
          <div class="min-w-0 flex-1">
            <CountedInput
              class={rowClass}
              label={`${label} ${index + 1}`}
              placeholder={index === 0 ? placeholder : ''}
              maxlength={maxLength}
              bind:value={items[index]}
              onkeydown={(event) => onKey(event, index)}
            />
          </div>
        {:else}
          <CmsInput
            class={`${rowClass} min-w-0 flex-1`}
            aria-label={`${label} ${index + 1}`}
            placeholder={index === 0 ? placeholder : ''}
            bind:value={items[index]}
            onkeydown={(event) => onKey(event, index)}
          />
        {/if}
        <CmsButton variant="ghost" type="button" class="hidden h-9 w-8 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-surface p-0 text-ink/60 disabled:opacity-30 sm:flex" aria-label={`Move ${label.toLowerCase()} ${index + 1} up`} disabled={index === 0} onclick={() => (items = moveItem(items, index, -1))}><ArrowUp size={14} /></CmsButton>
        <CmsButton variant="ghost" type="button" class="hidden h-9 w-8 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-surface p-0 text-ink/60 disabled:opacity-30 sm:flex" aria-label={`Move ${label.toLowerCase()} ${index + 1} down`} disabled={index === items.length - 1} onclick={() => (items = moveItem(items, index, 1))}><ArrowDown size={14} /></CmsButton>
        <CmsButton variant="ghost" type="button" class="flex h-9 w-8 shrink-0 items-center justify-center rounded-md border border-red-200 bg-surface p-0 text-red-700 hover:bg-red-50" aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} onclick={() => remove(index)}><Trash2 size={14} /></CmsButton>
      </div>
    {/each}
  </div>

  <div class="flex flex-wrap items-center justify-between gap-2">
    <CmsButton variant="ghost" type="button" class="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink/10 bg-surface px-3 text-xs font-bold text-ink disabled:opacity-40" disabled={full} title={full ? fullNote : undefined} onclick={add}><Plus size={14} />{addLabel}</CmsButton>
    {#if overCount}
      <span class="text-[11px] font-semibold text-destructive">{filledCount} of {max} · remove {overCount} before saving</span>
    {:else}
      <span class="text-[11px] text-ink/45">{filledCount} of {max}{full ? '' : ' · Enter adds the next line'}{maxLength ? ` · up to ${maxLength} characters each` : ''}</span>
    {/if}
  </div>
  {#if full && !overCount}
    <p class="text-[11px] text-amber-800" role="status">{fullNote}</p>
  {/if}

  {#if openSuggestions.length}
    <div class="flex flex-wrap items-center gap-1.5 pt-1">
      <span class="mr-1 text-[11px] font-semibold text-ink/50">Suggestions</span>
      {#each openSuggestions as suggestion (suggestion)}
        <button
          type="button"
          class="inline-flex min-h-8 items-center gap-1 rounded-full border border-dashed border-ink/20 bg-surface px-2.5 py-1 text-left text-[11px] font-medium text-ink/70 transition hover:border-forest/45 hover:text-heading disabled:opacity-40"
          disabled={full && !items.some((item) => !text(item))}
          on:click={() => addSuggestion(suggestion)}
        >
          <Plus size={11} class="shrink-0" />{suggestion}
        </button>
      {/each}
    </div>
  {/if}
</div>
