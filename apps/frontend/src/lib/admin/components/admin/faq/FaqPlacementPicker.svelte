<script lang="ts">
  import type { Component } from 'svelte';
  import { Search, X } from '@lucide/svelte';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  import type { FaqPickerRecord } from '$lib/admin/faqEntities';

  /** Plural heading, e.g. "Travel styles"; also the noun in search and empty states. */
  export let label: string;
  export let description = '';
  export let icon: Component | null = null;
  /** Prefix for checkbox ids — several pickers share one dialog. */
  export let id: string;
  export let options: FaqPickerRecord[] = [];
  export let selected: string[] = [];
  /**
   * Names the FAQ already carries for its places. A chosen record can be
   * missing from `options` (beyond the loaded pages); its chip still needs a
   * name, and saving keeps it.
   */
  export let known: Array<{ id: string; name: string }> = [];
  export let loading = false;
  export let error = '';

  let search = '';
  $: noun = label.toLowerCase();
  $: query = search.trim().toLowerCase();
  $: visible = query ? options.filter((option) => option.label.toLowerCase().includes(query)) : options;
  $: chosen = new Set(selected);
  $: names = new Map<string, string>([
    ...known.map((entry) => [entry.id, entry.name] as [string, string]),
    ...options.map((option) => [option.id, option.label] as [string, string])
  ]);
  $: chips = selected.map((value) => ({ id: value, label: names.get(value) || 'Unavailable record' }));

  const toggle = (value: string, on: boolean) => {
    if (on) selected = selected.includes(value) ? selected : [...selected, value];
    else selected = selected.filter((entry) => entry !== value);
  };
</script>

<section class="cms-form-section min-w-0 overflow-hidden p-0">
  <div class="grid gap-3 border-b border-ink/10 p-4">
    <div class="flex items-center justify-between gap-3">
      <h3 class="flex min-w-0 items-center gap-2 text-sm font-semibold text-heading">
        {#if icon}<svelte:component this={icon} class="size-4 shrink-0 text-forest/70" />{/if}
        <span class="truncate">{label}</span>
      </h3>
      <div class="flex shrink-0 items-center gap-1">
        {#if selected.length > 1}
          <Button variant="ghost" size="xs" class="text-ink/55 hover:text-heading" onclick={() => (selected = [])}>Clear</Button>
        {/if}
        <span class="rounded-full bg-forest/5 px-2.5 py-1 text-xs font-semibold text-forest">{selected.length} selected</span>
      </div>
    </div>
    {#if description}<p class="text-xs leading-5 text-ink/55">{description}</p>{/if}

    {#if chips.length}
      <ul class="flex flex-wrap gap-1.5" aria-label={`Chosen ${noun}`}>
        {#each chips as chip (chip.id)}
          <li class="inline-flex max-w-full items-center gap-0.5 rounded-full border border-forest/15 bg-forest/5 py-0.5 pl-2.5 pr-0.5 text-xs font-medium text-forest">
            <span class="truncate">{chip.label}</span>
            <Button variant="ghost" size="icon-xs" class="shrink-0 rounded-full text-forest/70 hover:text-forest" aria-label={`Remove ${chip.label}`} onclick={() => toggle(chip.id, false)}>
              <X class="size-3" />
            </Button>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="relative">
      <Search class="pointer-events-none absolute left-3 top-3 size-4 text-ink/40" />
      <!-- Enter here is a search habit, not "save the FAQ" (the editor is a form). -->
      <Input aria-label={`Search ${noun}`} bind:value={search} placeholder={`Search ${noun}…`} class="h-10 pl-9" onkeydown={(event) => { if (event.key === 'Enter') event.preventDefault(); }} />
    </div>
  </div>

  <div class="max-h-56 overflow-y-auto p-2" role="group" aria-label={`Available ${noun}`}>
    {#if loading}
      <p class="p-3 text-sm text-ink/50" role="status">Loading {noun}…</p>
    {:else if error}
      <p class="p-3 text-sm font-semibold text-clay" role="alert">{error}</p>
    {:else if !visible.length}
      <p class="p-3 text-sm text-ink/50">{query ? `No ${noun} match “${search.trim()}”.` : `No ${noun} yet.`}</p>
    {:else}
      {#each visible as option (option.id)}
        <div class={`flex items-center gap-3 rounded-lg px-3 py-2 transition ${chosen.has(option.id) ? 'bg-forest/5' : 'hover:bg-sand/40'}`}>
          <Checkbox id={`${id}-${option.id}`} checked={chosen.has(option.id)} onCheckedChange={(on) => toggle(option.id, on === true)} />
          <Label for={`${id}-${option.id}`} class="min-w-0 flex-1 cursor-pointer text-[13px] font-normal leading-5 text-heading">{option.label}</Label>
        </div>
      {/each}
    {/if}
  </div>
</section>
