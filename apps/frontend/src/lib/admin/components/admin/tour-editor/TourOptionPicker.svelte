<script lang="ts">
  import { ArrowDown, ArrowUp, Check, Minus, Search, X } from '@lucide/svelte';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  import type { TourListOption } from '$lib/admin/types';
  import { MAX_LIST_ITEMS, moveItem } from './model';
  export let selected: string[] = [];
  export let options: TourListOption[] = [];
  export let kind: 'inclusion' | 'exclusion';
  export let loading = false;
  let search = '';
  $: visible = options.filter(o=>o.kind===kind && (o.is_active||selected.includes(o.id)) && o.title.toLowerCase().includes(search.trim().toLowerCase()));
  $: selectedOptions = selected.map(id=>options.find(o=>o.id===id));
  const toggle = (id:string) => {
    if(selected.includes(id)) selected=selected.filter(value=>value!==id);
    else if(selected.length<MAX_LIST_ITEMS) selected=[...selected,id];
  };
</script>
<section class="cms-form-section min-w-0 overflow-hidden p-0">
  <div class="border-b border-ink/10 p-4 sm:p-5">
    <div class="flex items-center justify-between gap-3"><h3 class="flex items-center gap-2 text-sm font-semibold text-heading">{#if kind==='inclusion'}<Check class="size-4 text-emerald-600" />Included{:else}<Minus class="size-4 text-clay" />Not included{/if}</h3><span class="rounded-full bg-forest/5 px-2.5 py-1 text-xs font-semibold text-forest">{selected.length} / {MAX_LIST_ITEMS}</span></div>
    <p class="mt-2 text-xs leading-5 text-ink/55">{kind==='inclusion'?'What the tour price covers.':'What guests arrange or pay for separately.'} Select every item that applies.</p>
    <div class="relative mt-4"><Search class="pointer-events-none absolute left-3 top-3 size-4 text-ink/40" /><Input aria-label={`Search ${kind} options`} bind:value={search} placeholder="Search the library…" class="h-10 pl-9" /></div>
  </div>
  <div class="max-h-72 overflow-y-auto p-2" aria-label={`Available ${kind} options`}>
    {#if loading}<p class="p-3 text-sm text-ink/50" role="status">Loading shared options…</p>
    {:else if !visible.length}<p class="p-3 text-sm text-ink/50">{search?'No matching options.':'No available options yet. Add them in the shared library.'}</p>
    {:else}{#each visible as option (option.id)}
      <div class={`flex items-start gap-3 rounded-lg px-3 py-3 transition ${selected.includes(option.id)?'bg-forest/5':'hover:bg-sand/40'}`}>
        <Checkbox id={`select-${kind}-${option.id}`} checked={selected.includes(option.id)} disabled={!selected.includes(option.id)&&selected.length>=MAX_LIST_ITEMS} onCheckedChange={()=>toggle(option.id)} class="mt-0.5" />
        <Label for={`select-${kind}-${option.id}`} class="min-w-0 cursor-pointer text-[13px] font-normal leading-5 text-heading">{option.title}{#if !option.is_active}<span class="ml-2 text-[10px] text-ink/45">Inactive · already selected</span>{/if}</Label>
      </div>
    {/each}{/if}
  </div>
  <div class="border-t border-ink/10 bg-sand/20 p-4 sm:p-5">
    <p class="text-[10px] font-bold uppercase tracking-wider text-forest/65">Selected · website order</p>
    {#if !selected.length}<p class="mt-2 text-xs text-ink/45">Only selected options appear on this tour.</p>
    {:else}<ol class="mt-3 grid gap-2">{#each selectedOptions as option, index}
      <li class="flex items-start gap-2 rounded-md border border-ink/10 bg-surface p-2.5">
        <span class="pt-0.5 text-[11px] font-semibold text-ink/40">{String(index+1).padStart(2,'0')}</span>
        <p class="min-w-0 flex-1 text-xs leading-5 text-heading">{option?.title??'Selected option unavailable — refresh the library.'}</p>
        <div class="flex shrink-0"><Button variant="ghost" size="icon" class="size-6" aria-label={`Move ${kind} ${index+1} up`} disabled={index===0} onclick={()=>selected=moveItem(selected,index,-1)}><ArrowUp class="size-3" /></Button><Button variant="ghost" size="icon" class="size-6" aria-label={`Move ${kind} ${index+1} down`} disabled={index===selected.length-1} onclick={()=>selected=moveItem(selected,index,1)}><ArrowDown class="size-3" /></Button><Button variant="ghost" size="icon" class="size-6" aria-label={`Remove ${kind} ${index+1}`} onclick={()=>selected=selected.filter((_,i)=>i!==index)}><X class="size-3" /></Button></div>
      </li>
    {/each}</ol>{/if}
  </div>
</section>
