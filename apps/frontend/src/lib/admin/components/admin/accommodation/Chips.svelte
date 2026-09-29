<script lang="ts">
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Button as CmsButton } from '$lib/components/ui/button';

  import { enumLabel } from '$lib/admin/accommodationEnums';
  export let label=''; export let options:string[]=[]; export let selected:string[]=[]; export let onToggle:(x:string)=>void=()=>{};
  let search='';
  const display=(value:string)=>/^[A-Z0-9_]+$/.test(value)?enumLabel(value):value;
  $: shown=options.filter((value)=>display(value).toLowerCase().includes(search.toLowerCase()));
</script>
<div>
  <div class="flex items-end justify-between gap-3"><p class="text-sm font-semibold text-ink">{label}</p>{#if options.length>10}<CmsInput class="h-8 w-44 rounded-md border border-ink/10 px-2 text-xs" placeholder="Search…" bind:value={search}/>{/if}</div>
  <div class="mt-1.5 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">{#each shown as option}<CmsButton variant="ghost" class={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${selected.includes(option)?'border-forest bg-forest text-white':'border-ink/15 bg-surface text-ink/65 hover:border-forest/40'}`} type="button" onclick={()=>onToggle(option)}>{display(option)}</CmsButton>{/each}</div>
</div>
