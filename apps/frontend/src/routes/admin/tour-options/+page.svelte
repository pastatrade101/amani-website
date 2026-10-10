<script lang="ts">
  import { onMount } from 'svelte';
  import { Check, Edit3, ListPlus, Minus, Plus, Search } from '@lucide/svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import { api } from '$lib/admin/api/client';
  import type { TourListOption } from '$lib/admin/types';

  let options: TourListOption[] = [];
  let loading = true;
  let saving = false;
  let error = '';
  let notice = '';
  let search = '';
  let open = false;
  let bulkOpen = false;
  let editing: TourListOption | null = null;
  let title = '';
  let kind: 'inclusion' | 'exclusion' = 'inclusion';
  let active = true;
  let bulkKind: 'inclusion' | 'exclusion' = 'inclusion';
  let pasted = '';
  let formError = '';
  const kindOptions = [{value:'inclusion',label:'Inclusion'},{value:'exclusion',label:'Exclusion'}];
  $: filtered = options.filter(o=>o.title.toLowerCase().includes(search.trim().toLowerCase()));
  $: bulkTitles = pasted.split('\n').map(line=>line.replace(/^\s*(?:[-•]\s+|\d+[.)]\s+)/,'').trim()).filter(Boolean);

  async function load() {
    loading = true; error = '';
    try {
      const items: TourListOption[]=[];
      for(let page=1;;page++) {const r=await api.tourListOptions.list({limit:100,page});items.push(...r.data.items);if(page>=r.data.pagination.totalPages)break;}
      options=items;
    } catch(err) {error=err instanceof Error?err.message:'Unable to load the shared options.';}
    finally {loading=false;}
  }
  function edit(option: TourListOption | null, optionKind: 'inclusion'|'exclusion' = 'inclusion') {
    editing=option; title=option?.title??'';kind=option?.kind??optionKind;active=option?.is_active??true;formError='';open=true;
  }
  async function save() {
    if(!title.trim()||title.trim().length>100){formError='Enter an option between 1 and 100 characters.';return;}
    saving=true;formError='';notice='';
    try {
      if(editing)await api.tourListOptions.update(editing.id,{title:title.trim(),is_active:active});
      else await api.tourListOptions.create({kind,title:title.trim(),is_active:active});
      open=false;notice=editing?'Wording updated on all linked tours.':'Option added. Select it in a tour’s Included & excluded section.';await load();
    }catch(err){formError=err instanceof Error?err.message:'Unable to save the option.';}finally{saving=false;}
  }
  async function bulkSave() {
    if(!bulkTitles.length||bulkTitles.length>200||bulkTitles.some(t=>t.length>100)){formError='Paste 1–200 items, one per line, with up to 100 characters each.';return;}
    saving=true;formError='';notice='';
    try{const r=await api.tourListOptions.bulk(bulkKind,bulkTitles);bulkOpen=false;pasted='';notice=`${r.data.length} options ready to select. Duplicate wording was reused.`;await load();}
    catch(err){formError=err instanceof Error?err.message:'Unable to prefill the options.';}finally{saving=false;}
  }
  async function toggle(option:TourListOption) {
    error='';notice='';
    try{await api.tourListOptions.update(option.id,{is_active:!option.is_active});notice=option.is_active?'Option hidden from new selections. Existing tours keep it.':'Option available for new selections.';await load();}
    catch(err){error=err instanceof Error?err.message:'Unable to change availability.';}
  }
  onMount(load);
</script>

<svelte:head><title>Inclusions & Exclusions | Key2africa CMS</title></svelte:head>
<div class="grid gap-5">
  <AdminPageHeader title="Inclusions & exclusions" eyebrow="Shared safari library" description="Write each package term once. Select it across your tours, and keep every journey’s details consistent." actionLabel="Add option" actionIcon={Plus} secondaryLabel="Paste a list" on:action={()=>edit(null)} on:secondary={()=>{bulkOpen=true;formError='';}} />
  <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-forest/15 bg-forest/5 px-5 py-4">
    <p class="max-w-2xl text-xs leading-5 text-heading">Changes to wording appear on every linked tour. Deactivating an option hides it from new selections while preserving existing tour promises.</p>
    <Button variant="outline" size="sm" href="/admin/tours">Select options on a tour →</Button>
  </div>
  <div class="relative max-w-md"><Search class="pointer-events-none absolute left-3 top-3 size-4 text-ink/40" /><Input aria-label="Search shared options" bind:value={search} placeholder="Search inclusions and exclusions…" class="h-10 pl-9" /></div>
  {#if notice}<p role="status" class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>{/if}
  {#if error}<div role="alert" class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}<Button variant="ghost" size="sm" onclick={load}>Retry</Button></div>{/if}
  {#if loading}<p role="status" class="p-5 text-sm text-ink/50">Loading shared options…</p>
  {:else}<div class="grid items-start gap-5 lg:grid-cols-2">
    {#each ['inclusion','exclusion'] as group}
      <section class="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm">
        <div class="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-4"><div><h2 class="flex items-center gap-2 text-base font-semibold text-heading">{#if group==='inclusion'}<Check class="size-4 text-emerald-600" />Inclusions{:else}<Minus class="size-4 text-clay" />Exclusions{/if}<span class="text-xs font-normal text-ink/45">{options.filter(o=>o.kind===group).length}</span></h2><p class="mt-1 text-xs text-ink/50">{group==='inclusion'?'Covered by the tour price.':'Paid for or arranged separately.'}</p></div><Button variant="outline" size="sm" onclick={()=>edit(null,group==='inclusion'?'inclusion':'exclusion')}><Plus class="size-3.5" />Add</Button></div>
        <ul class="divide-y divide-ink/8">{#each filtered.filter(o=>o.kind===group) as option (option.id)}
          <li class="flex items-center gap-3 px-5 py-3.5"><div class="min-w-0 flex-1"><p class="text-[13px] leading-5 text-heading">{option.title}</p>{#if !option.is_active}<p class="mt-1 text-[10px] text-ink/45">Inactive · kept on existing tours</p>{/if}</div><Switch checked={option.is_active} onCheckedChange={()=>toggle(option)} aria-label={`Available: ${option.title}`} /><Button variant="ghost" size="icon" class="size-8" aria-label={`Edit ${option.title}`} onclick={()=>edit(option)}><Edit3 class="size-3.5" /></Button></li>
        {:else}<li class="p-5 text-sm text-ink/45">{search?'No matching options.':'Add your first option or paste a list.'}</li>{/each}</ul>
      </section>
    {/each}
  </div>{/if}
</div>

<Dialog.Root bind:open>
  <Dialog.Content class="cms-dialog sm:max-w-lg">
    <Dialog.Header><Dialog.Title>{editing?'Edit shared option':'Add shared option'}</Dialog.Title><Dialog.Description>{editing?'Changing the wording updates every tour using this option.':'Add it once, then select it on any tour.'}</Dialog.Description></Dialog.Header>
    <form class="grid gap-5 py-2" on:submit|preventDefault={save}>
      {#if !editing}<AdminSelect label="Option type" name="option_kind" bind:value={kind} options={kindOptions} />{:else}<p class="text-xs font-semibold capitalize text-forest">{kind}</p>{/if}
      <div class="grid gap-2"><Label for="option_title">Wording</Label><Textarea id="option_title" bind:value={title} maxlength={100} rows={3} placeholder="e.g. Park entry and conservation fees" required /><span class="text-right text-[10px] text-ink/40">{title.length} / 100</span></div>
      <div class="flex items-center justify-between"><Label for="option_active">Available for new selections</Label><Switch id="option_active" bind:checked={active} /></div>
      {#if formError}<p role="alert" class="text-sm text-clay">{formError}</p>{/if}
      <Dialog.Footer><Button type="button" variant="outline" onclick={()=>open=false}>Cancel</Button><Button type="submit" disabled={saving}>{saving?'Saving…':editing?'Save changes':'Add option'}</Button></Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
<Dialog.Root bind:open={bulkOpen}>
  <Dialog.Content class="cms-dialog sm:max-w-xl">
    <Dialog.Header><Dialog.Title>Prefill your shared library</Dialog.Title><Dialog.Description>Paste one item per line. Existing wording is reused, so repeated lists do not create duplicates.</Dialog.Description></Dialog.Header>
    <form class="grid gap-5 py-2" on:submit|preventDefault={bulkSave}>
      <AdminSelect label="List type" name="bulk_kind" bind:value={bulkKind} options={kindOptions} />
      <div class="grid gap-2"><Label for="pasted_options">Options · one per line</Label><Textarea id="pasted_options" bind:value={pasted} rows={9} placeholder="Paste your inclusion or exclusion list here…" required /><p class="text-xs text-ink/50">{bulkTitles.length} items · up to 100 characters per item</p></div>
      {#if formError}<p role="alert" class="text-sm text-clay">{formError}</p>{/if}
      <Dialog.Footer><Button type="button" variant="outline" onclick={()=>bulkOpen=false}>Cancel</Button><Button type="submit" disabled={saving||!bulkTitles.length}><ListPlus class="size-4" />{saving?'Adding…':'Add to library'}</Button></Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
