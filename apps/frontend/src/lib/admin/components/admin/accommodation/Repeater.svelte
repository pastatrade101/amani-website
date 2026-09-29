<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Input as CmsInput } from '$lib/components/ui/input';
import{Plus,Trash2}from'@lucide/svelte';export let title='';export let items:any[]=[];export let field='title';export let add:()=>void=()=>{};export let remove:(i:number)=>void=()=>{};</script>
<div><div class="flex items-center justify-between"><p class="text-sm font-semibold text-ink">{title}</p><CmsButton variant="ghost" class="inline-flex items-center gap-1 text-xs font-bold text-forest" type="button" onclick={add}><Plus size={13}/> Add</CmsButton></div><div class="mt-1.5 grid gap-1.5">{#each items as item,i}<div class="flex gap-1.5"><CmsInput class="h-9 min-w-0 flex-1 rounded-lg border border-ink/15 px-3 text-sm" bind:value={item[field]}/><CmsButton variant="ghost" class="grid h-9 w-9 place-items-center text-red-600" type="button" onclick={()=>remove(i)}><Trash2 size={14}/></CmsButton></div>{/each}</div></div>
