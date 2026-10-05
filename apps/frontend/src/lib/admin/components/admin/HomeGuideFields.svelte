<script lang="ts">
  import { ArrowDown, ArrowUp, Plus, Trash2 } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Label } from '$lib/components/ui/label';
  import type { GuideRow } from '$lib/homepage-guides';
  let { rows = $bindable<GuideRow[]>([]), note = $bindable(''), sectionKey }: { rows: GuideRow[]; note: string; sectionKey: string } = $props();
  function move(index:number, delta:number) { const next=[...rows]; [next[index],next[index+delta]]=[next[index+delta],next[index]]; rows=next; }
</script>
<section class="grid gap-4 rounded-xl border border-border bg-secondary/30 p-5">
  <div class="flex flex-wrap items-center justify-between gap-3"><div><h3 class="font-semibold">Section content</h3><p class="mt-1 text-xs text-muted-foreground">Edit the cards in display order. Changes appear after you save this section.</p></div>{#if sectionKey !== 'cost_ranges'}<Button type="button" variant="outline" onclick={() => rows=[...rows,{label:'',title:'',text:''}]}><Plus size={15}/> Add item</Button>{/if}</div>
  {#if sectionKey !== 'cost_ranges'}
    {#each rows as row,i}
      <div class="grid gap-4 rounded-lg border border-border bg-white p-4">
        <div class="flex items-center justify-between"><span class="text-xs font-semibold text-muted-foreground">ITEM {i+1}</span><div class="flex gap-1"><Button type="button" variant="ghost" size="icon" aria-label={`Move item ${i+1} up`} disabled={i===0} onclick={() => move(i,-1)}><ArrowUp size={15}/></Button><Button type="button" variant="ghost" size="icon" aria-label={`Move item ${i+1} down`} disabled={i===rows.length-1} onclick={() => move(i,1)}><ArrowDown size={15}/></Button><Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${i+1}`} onclick={() => rows=rows.filter((_,index)=>index!==i)}><Trash2 size={15}/></Button></div></div>
        <div class="grid gap-4 sm:grid-cols-[150px_1fr]"><div class="grid gap-2"><Label for={`guide-label-${i}`}>{sectionKey==='safari_day'?'Time':sectionKey==='safari_duration'?'Duration':'Small label'}</Label><Input id={`guide-label-${i}`} bind:value={row.label}/></div><div class="grid gap-2"><Label for={`guide-title-${i}`}>Heading</Label><Input id={`guide-title-${i}`} bind:value={row.title} required/></div></div>
        <div class="grid gap-2"><Label for={`guide-copy-${i}`}>Description</Label><Textarea id={`guide-copy-${i}`} bind:value={row.text} rows={3}/></div>
      </div>
    {/each}
    {#if !rows.length}<p class="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">No items. Add one to display a card in this section.</p>{/if}
  {/if}
  {#if sectionKey==='safari_inclusions'||sectionKey==='cost_ranges'}<div class="grid gap-2"><Label for="guide-note">{sectionKey==='safari_inclusions'?'Exclusions / extra costs':'Price context / quotation note'}</Label><Textarea id="guide-note" bind:value={note} rows={3}/></div>{/if}
</section>
