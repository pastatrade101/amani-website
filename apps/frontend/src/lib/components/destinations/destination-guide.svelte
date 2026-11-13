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
      {#if block.type==='part'}<h2>{block.title}</h2>
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
        {#if ['callout','did_you_know','field_notes'].includes(block.type)}<div class="callout-label">{#if block.type==='field_notes'}<Quote size={22}/>{:else}<Compass size={22}/>{/if}<span class="callout-name">{block.type==='field_notes'?'Field notes':block.type==='did_you_know'?'A closer look':'Local insight'}</span></div>{/if}
        {#if block.title}<h2>{block.title}</h2>{/if}
        {#if block.body}<RichText value={block.body}/>{/if}
        {#if block.items.length}<div class="guide-items">{#each block.items as item}<div>{#if item.title}<h3>{item.title}</h3>{/if}<RichText value={item.body}/></div>{/each}</div>{/if}
      {/if}
    </section>
  {/each}
</div>
<style>
.destination-guide{display:grid;gap:32px;min-width:0}.destination-guide section{min-width:0;scroll-margin-top:120px}.destination-guide h2{font-size:var(--text-h3);font-weight:600;line-height:1.3;letter-spacing:-.035em;margin-bottom:20px}.destination-guide h3{font-size:var(--text-lg);font-weight:600;margin-bottom:10px}.guide-part{padding-top:28px;border-top:1px solid #e7e5e1}.guide-part h2{margin:13px 0 0}.destination-guide figure{overflow:hidden;border-radius:var(--radius-surface);background:#f4f5f2}.guide-photo{aspect-ratio:16/10;max-height:460px}.destination-guide figcaption{font-size:var(--text-xs);line-height:1.8;color:#837a67;padding:16px 20px}.guide-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border:1px solid #e7e5e1;border-radius:var(--radius-surface);overflow:hidden;background:#f7f8f5}.guide-facts>div{padding:22px;border-bottom:1px solid #e7e5e1}.guide-facts dt{font-size:var(--text-sm);font-weight:500;color:#7d7357;margin-bottom:8px}.guide-callout{background:#faf6e8;border-left:3px solid #e5c340;border-radius:0 16px 16px 0;padding:28px}.callout-label{display:flex;align-items:center;gap:12px;color:#8b701e;margin-bottom:18px}.callout-name{font-size:var(--text-sm);font-weight:600}.guide-table{overflow:auto;border:1px solid #e7e5e1;border-radius:var(--radius-surface)}.guide-table :global(th){background:#36312b;color:white;font-size:var(--text-xs);padding:18px}.guide-table :global(td){font-size:var(--text-sm);line-height:1.8;padding:16px;min-width:160px}.guide-items{display:grid;gap:22px;margin-top:22px}@media(max-width:639px){.guide-facts{grid-template-columns:minmax(0,1fr)}.guide-callout{padding:22px}.destination-guide{gap:26px}}
</style>
