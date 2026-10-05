<script lang="ts">
  import { Compass, Quote } from '@lucide/svelte';
  import * as Accordion from '$lib/components/ui/accordion';
  import * as Table from '$lib/components/ui/table';
  import DestinationImage from './destination-image.svelte';
  import RichText from '$lib/components/tours/rich-text.svelte';
  import type { GuideBlock } from '$lib/destination-content';
  let {blocks}:{blocks:GuideBlock[]}=$props();
</script>
<div class="destination-guide">
  {#each blocks as block,i}
    <section id={`guide-${i}`} class:guide-callout={['callout','did_you_know','field_notes'].includes(block.type)} class:guide-part={block.type==='part'}>
      {#if block.type==='part'}<p class="eyebrow">EXPLORE A LITTLE DEEPER</p><h2>{block.title}</h2>
      {:else if block.type==='photo'||block.type==='image'}
        {#if block.url}<figure><div class="guide-photo"><DestinationImage urls={[block.url]} alt={block.caption||block.title}/></div>{#if block.caption}<figcaption>{block.caption}</figcaption>{/if}</figure>{/if}
      {:else if block.type==='table'}
        {#if block.title}<h2>{block.title}</h2>{/if}
        <div class="guide-table"><Table.Root><Table.Header><Table.Row>{#each block.columns as title}<Table.Head>{title}</Table.Head>{/each}</Table.Row></Table.Header><Table.Body>{#each block.rows as row}<Table.Row>{#each row as cell}<Table.Cell class="whitespace-normal align-top">{cell}</Table.Cell>{/each}</Table.Row>{/each}</Table.Body></Table.Root></div>
      {:else if block.type==='faq'}
        <h2>{block.title||'Your questions, answered.'}</h2><Accordion.Root type="multiple">{#each block.items as item,j}<Accordion.Item value={String(j)}><Accordion.Trigger class="text-left text-sm">{item.title}</Accordion.Trigger><Accordion.Content><RichText value={item.body}/></Accordion.Content></Accordion.Item>{/each}</Accordion.Root>
      {:else if block.type==='facts'||(!block.body&&block.items.length)}
        {#if block.title}<h2>{block.title}</h2>{/if}<dl class="guide-facts">{#each block.items as item}<div><dt>{item.title}</dt><dd><RichText value={item.body}/></dd></div>{/each}</dl>
      {:else}
        {#if ['callout','did_you_know','field_notes'].includes(block.type)}<div class="callout-label">{#if block.type==='field_notes'}<Quote size={22}/>{:else}<Compass size={22}/>{/if}<span class="eyebrow">{block.type==='field_notes'?'FIELD NOTES':block.type==='did_you_know'?'A CLOSER LOOK':'LOCAL INSIGHT'}</span></div>{/if}
        {#if block.title}<h2>{block.title}</h2>{/if}
        {#if block.body}<RichText value={block.body}/>{/if}
        {#if block.items.length}<div class="guide-items">{#each block.items as item}<div>{#if item.title}<h3>{item.title}</h3>{/if}<RichText value={item.body}/></div>{/each}</div>{/if}
      {/if}
    </section>
  {/each}
</div>
<style>
.destination-guide{display:grid;gap:32px;min-width:0}.destination-guide section{min-width:0;scroll-margin-top:120px}.destination-guide h2{font-size:clamp(22px,2.5vw,30px);font-weight:600;line-height:1.3;letter-spacing:-.035em;margin-bottom:20px}.destination-guide h3{font-size:17px;font-weight:600;margin-bottom:10px}.guide-part{padding-top:28px;border-top:1px solid #e0e5e8}.guide-part h2{margin:13px 0 0}.guide-part .eyebrow{font-size:9px;color:#817349}.destination-guide figure{overflow:hidden;border-radius:16px;background:#f4f5f2}.guide-photo{aspect-ratio:16/10;max-height:460px}.destination-guide figcaption{font-size:11px;line-height:1.8;color:#647586;padding:16px 20px}.guide-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border:1px solid #e1e5e7;border-radius:14px;overflow:hidden;background:#f7f8f5}.guide-facts>div{padding:22px;border-bottom:1px solid #e1e5e7}.guide-facts dt{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#7d7357;margin-bottom:9px}.guide-callout{background:#faf6e8;border-left:3px solid #e5c340;border-radius:0 16px 16px 0;padding:28px}.callout-label{display:flex;align-items:center;gap:12px;color:#8b701e;margin-bottom:18px}.guide-table{overflow:auto;border:1px solid #e1e5e7;border-radius:12px}.guide-table :global(th){background:#14314d;color:white;font-size:12px;padding:18px}.guide-table :global(td){font-size:13px;line-height:1.8;padding:16px;min-width:160px}.guide-items{display:grid;gap:22px;margin-top:22px}@media(max-width:639px){.guide-facts{grid-template-columns:minmax(0,1fr)}.guide-callout{padding:22px}.destination-guide{gap:26px}}
</style>
