<script lang="ts">
  import { ArrowDown, ArrowUp, Plus, Trash2 } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';
  import * as NativeSelect from '$lib/components/ui/native-select';
  import AdminRichText from './AdminRichText.svelte';
  type Block={type?:string;title?:string;heading?:string;body?:string;url?:string;caption?:string;items?:Record<string,unknown>[];columns?:string[];rows?:string[][];[key:string]:unknown};
  let {blocks=$bindable<Block[]>([])}:{blocks?:Block[]}=$props();
  let nextType=$state('richtext');
  const types=[['richtext','Text section'],['part','Section heading'],['facts','Quick facts'],['photo','Photo'],['table','Comparison table'],['callout','Local insight'],['did_you_know','Did you know?'],['field_notes','Field notes'],['faq','Questions & answers']];
  const kind=(block:Block)=>block.type||(block.items?'facts':'richtext');
  const str=(v:unknown)=>typeof v==='string'?v:'';
  const move=(i:number,step:number)=>{const copy=[...blocks];[copy[i],copy[i+step]]=[copy[i+step],copy[i]];blocks=copy;};
  const add=()=>{blocks=[...blocks,{type:nextType,title:'',body:'',...(nextType==='facts'||nextType==='faq'?{items:[]}:{}),...(nextType==='table'?{columns:['Topic','Details'],rows:[['','']]}:{})}];};
  const itemKey=(item:Record<string,unknown>,first:boolean,faq:boolean)=>first?('label'in item?'label':'q'in item?'q':'question'in item?'question':'title'):('value'in item?'value':'a'in item?'a':'answer'in item?'answer':'body');
</script>
<section class="rounded-2xl border border-border bg-white p-5">
  <h3 class="text-base font-semibold text-navy">Destination page guide</h3>
  <p class="mt-2 text-xs leading-6 text-muted-foreground">Build the sections shown after the overview. Existing content stays in its original order. Photos, facts, tables, travel advice and FAQs appear directly on this destination’s page.</p>
  <div class="mt-5 grid gap-3">
    {#each blocks as block,i}
      <details class="rounded-xl border border-border bg-secondary/20 p-4">
        <summary class="cursor-pointer text-sm font-semibold">{i+1}. {block.title||block.heading||types.find(t=>t[0]===kind(block))?.[1]||'Content section'}</summary>
        <div class="mt-4 grid gap-4">
          <div class="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" size="sm" disabled={i===0} onclick={()=>move(i,-1)} aria-label={`Move section ${i+1} up`}><ArrowUp size={15}/></Button><Button type="button" variant="outline" size="sm" disabled={i===blocks.length-1} onclick={()=>move(i,1)} aria-label={`Move section ${i+1} down`}><ArrowDown size={15}/></Button><Button type="button" variant="outline" size="sm" onclick={()=>{blocks=blocks.filter((_,j)=>j!==i);}} aria-label={`Remove section ${i+1}`}><Trash2 size={15}/></Button></div>
          <div><Label for={`guide-title-${i}`}>Section heading</Label><Input id={`guide-title-${i}`} class="mt-2" value={block.title||block.heading||''} oninput={e=>{if('heading'in block&&!('title'in block))block.heading=e.currentTarget.value;else block.title=e.currentTarget.value;}}/></div>
          {#if ['photo','image'].includes(kind(block))}<div><Label for={`guide-image-${i}`}>Image URL</Label><Input id={`guide-image-${i}`} class="mt-2" value={block.url||str(block.image_url)} oninput={e=>{block.url=e.currentTarget.value;}}/></div><div><Label for={`guide-caption-${i}`}>Caption / image description</Label><Input id={`guide-caption-${i}`} class="mt-2" bind:value={block.caption}/></div>
          {:else if kind(block)==='table'}
            <div class="overflow-x-auto"><p class="mb-3 text-xs text-muted-foreground">Column headings and rows</p><div class="grid gap-2" style={`grid-template-columns:repeat(${Math.max(1,block.columns?.length||2)},minmax(120px,1fr))`}>{#each block.columns||[] as column,c}<Input value={column} aria-label={`Column ${c+1} heading`} oninput={e=>{block.columns![c]=e.currentTarget.value;}}/>{/each}{#each block.rows||[] as row,r}{#each row as cell,c}<Input value={cell} aria-label={`Row ${r+1}, column ${c+1}`} oninput={e=>{block.rows![r][c]=e.currentTarget.value;}}/>{/each}{/each}</div></div><div class="flex gap-2"><Button type="button" variant="outline" size="sm" onclick={()=>{block.rows=[...(block.rows||[]),Array(block.columns?.length||2).fill('')];}}>Add row</Button><Button type="button" variant="outline" size="sm" disabled={!block.rows?.length} onclick={()=>{block.rows=block.rows?.slice(0,-1);}}>Remove last row</Button></div>
          {:else if kind(block)!=='part'}<AdminRichText label="Content" name={`guide-body-${i}`} bind:value={block.body} rows={6}/>{/if}
          {#if Array.isArray(block.items)||['facts','faq'].includes(kind(block))}
            {#each block.items||[] as item,j}
              {@const labelKey=itemKey(item,true,kind(block)==='faq')}{@const bodyKey=itemKey(item,false,kind(block)==='faq')}
              <div class="grid gap-2 rounded-lg border border-border p-3"><Label for={`guide-item-${i}-${j}`}>{kind(block)==='faq'?'Question':'Label'}</Label><Input id={`guide-item-${i}-${j}`} value={str(item[labelKey])} oninput={e=>{item[labelKey]=e.currentTarget.value;}}/><Label for={`guide-value-${i}-${j}`}>{kind(block)==='faq'?'Answer':'Details'}</Label><Textarea id={`guide-value-${i}-${j}`} value={str(item[bodyKey])} oninput={e=>{item[bodyKey]=e.currentTarget.value;}}/><Button type="button" variant="ghost" size="sm" class="justify-self-end" onclick={()=>{block.items=block.items?.filter((_,k)=>k!==j);}}>Remove item</Button></div>
            {/each}<Button type="button" variant="outline" size="sm" class="justify-self-start" onclick={()=>{block.items=[...(block.items||[]),{title:'',body:''}];}}>Add {kind(block)==='faq'?'question':'fact'}</Button>
          {/if}
        </div>
      </details>
    {/each}
  </div>
  <div class="mt-5 flex flex-wrap gap-3"><NativeSelect.Root aria-label="New guide section type" bind:value={nextType}>{#each types as [value,label]}<option {value}>{label}</option>{/each}</NativeSelect.Root><Button type="button" variant="outline" onclick={add}><Plus size={16}/>Add section</Button></div>
</section>
