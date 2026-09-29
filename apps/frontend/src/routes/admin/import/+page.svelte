<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsTable from '$lib/components/ui/table';

  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { AlertTriangle, Download, FileUp, Trash2, Upload, X } from '@lucide/svelte';
  import { fade, scale } from 'svelte/transition';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';

  type Entity = { key: string; label: string; description: string; keys: string[]; headers: string[]; example: string[] };
  type RowResult = { line: number; status: 'ok' | 'error'; action?: 'created' | 'updated'; title?: string; slug?: string; warnings?: string[]; error?: string };
  type ImportResult = { summary: { total: number; created: number; updated: number; failed: number }; results: RowResult[] };

  type Toast = { id: string; message: string; type: 'error' | 'success' };
  let toasts: Toast[] = [];
  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => (toasts = toasts.filter((t) => t.id !== id)), 4000);
  };
  const dismissToast = (e: CustomEvent<string>) => (toasts = toasts.filter((t) => t.id !== e.detail));

  let entities: Entity[] = [];
  let selectedKey = '';
  let file: File | null = null;
  let importing = false;
  let result: ImportResult | null = null;

  // ── danger zone: reset all content ─────────────────────────────────────────
  let resetOpen = false;
  let resetConfirm = '';
  let resetting = false;
  let resetTables: string[] = [];
  let resetResults: Array<{ table: string; deleted: number; error?: string }> | null = null;

  const openReset = async () => {
    resetConfirm = '';
    resetResults = null;
    resetOpen = true;
    try {
      const res = await api.imports.resetInfo();
      resetTables = res.data.tables;
    } catch {
      resetTables = [];
    }
  };

  const runReset = async () => {
    if (resetConfirm !== 'RESET') return;
    resetting = true;
    try {
      const res = await api.imports.reset('RESET');
      resetResults = res.data.results;
      showToast(`${res.data.total} records deleted. You can now import fresh data.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Reset failed.', 'error');
    } finally {
      resetting = false;
    }
  };

  $: selected = entities.find((e) => e.key === selectedKey);

  onMount(async () => {
    try {
      const res = await api.imports.entities();
      entities = res.data.entities;
      if (entities.length) selectedKey = entities[0].key;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load import types.', 'error');
    }
  });

  const selectEntity = (key: string) => {
    selectedKey = key;
    file = null;
    result = null;
  };

  const onFileChange = (event: Event) => {
    file = (event.target as HTMLInputElement).files?.[0] ?? null;
    result = null;
  };

  const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const downloadTemplate = () => {
    if (!selected) return;
    const csv = `${selected.headers.join(',')}\n${selected.example.map(csvCell).join(',')}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goldfinch-${selected.key}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    if (!selected || !file) {
      showToast('Choose an import type and a CSV file.', 'error');
      return;
    }
    importing = true;
    result = null;
    try {
      const res = await api.imports.run(selected.key, file);
      result = res.data;
      const { created, updated, failed } = res.data.summary;
      showToast(`${created} created · ${updated} updated${failed ? ` · ${failed} failed` : ''}.`, failed ? 'error' : 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import failed.', 'error');
    } finally {
      importing = false;
    }
  };
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<AdminPageHeader
  eyebrow="Content"
  title="Import Content"
  description="Bulk-create or update any content type from a CSV. Re-importing updates existing records by their natural key (nothing is duplicated)."
  secondaryLabel="Import full itineraries →"
  on:secondary={() => goto('/admin/tours/import')}
/>

<div class="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
  <!-- Entity picker -->
  <nav class="grid content-start gap-1.5 rounded-2xl border border-ink/10 bg-surface p-3">
    <p class="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-ink/45">Import type</p>
    {#each entities as e (e.key)}
      <CmsButton variant="ghost"
        type="button"
        class={`rounded-xl px-3 py-2.5 text-left text-sm transition ${selectedKey === e.key ? 'bg-forest text-white' : 'text-ink/75 hover:bg-sand'}`}
        onclick={() => selectEntity(e.key)}
      >
        <span class="font-semibold">{e.label}</span>
      </CmsButton>
    {/each}
    {#if !entities.length}
      <p class="px-3 py-2 text-sm text-ink/50">Loading…</p>
    {/if}
  </nav>

  <div class="grid content-start gap-6">
    {#if selected}
      <section class="rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm">
        <h2 class="text-lg font-bold text-heading">{selected.label}</h2>
        <p class="mt-1 text-sm text-ink/65">{selected.description}</p>
        <p class="mt-2 text-xs text-ink/50">
          Matched by <code class="rounded bg-sand px-1.5 py-0.5 font-mono">{selected.keys.join(' + ')}</code> — existing rows are updated, new ones created.
        </p>

        <CmsLabel
          class="mt-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/15 bg-sand/40 px-6 py-9 text-center transition hover:border-goldfinch-gold/60 hover:bg-sand/70"
        >
          <FileUp size={24} class="text-forest" />
          <span class="text-sm font-semibold text-heading">{file ? file.name : 'Click to choose a .csv file'}</span>
          <span class="text-xs text-ink/50">{file ? `${(file.size / 1024).toFixed(1)} KB` : `for ${selected.label.toLowerCase()}`}</span>
          <CmsInput class="hidden" type="file" accept=".csv,text/csv" onchange={onFileChange} />
        </CmsLabel>

        <div class="mt-5 flex flex-wrap items-center gap-3">
          <AdminButton disabled={!file || importing} on:click={runImport}>
            <Upload size={16} />
            {importing ? 'Importing…' : `Import ${selected.label}`}
          </AdminButton>
          <AdminButton variant="secondary" on:click={downloadTemplate}>
            <Download size={16} />
            Download template
          </AdminButton>
        </div>

        <details class="mt-5 text-sm">
          <summary class="cursor-pointer font-semibold text-forest">Columns for this type</summary>
          <div class="mt-2 flex flex-wrap gap-1.5">
            {#each selected.headers as h}
              <code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs text-ink/70">{h}</code>
            {/each}
          </div>
          <p class="mt-2 text-xs text-ink/50">List columns (e.g. highlights, best_for) separate items with <code class="font-mono">|</code>. Only required columns must be filled.</p>
        </details>
      </section>
    {/if}

    {#if result}
      <section class="rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="text-base font-bold text-heading">Results</h2>
          <span class="rounded-full bg-forest/10 px-3 py-1 text-xs font-bold text-forest">{result.summary.created} created</span>
          <span class="rounded-full bg-goldfinch-gold/15 px-3 py-1 text-xs font-bold text-clay">{result.summary.updated} updated</span>
          {#if result.summary.failed}
            <span class="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">{result.summary.failed} failed</span>
          {/if}
        </div>
        <div class="mt-4 overflow-x-auto">
          <CmsTable.Root class="w-full min-w-[560px] border-collapse text-sm">
            <CmsTable.Header>
              <CmsTable.Row class="border-b border-ink/10 text-left text-xs font-bold uppercase tracking-wide text-ink/50">
                <CmsTable.Head class="py-2 pr-3">Row</CmsTable.Head>
                <CmsTable.Head class="py-2 pr-3">Status</CmsTable.Head>
                <CmsTable.Head class="py-2 pr-3">Record</CmsTable.Head>
                <CmsTable.Head class="py-2 pr-3">Notes</CmsTable.Head>
              </CmsTable.Row>
            </CmsTable.Header>
            <CmsTable.Body>
              {#each result.results as row (row.line)}
                <CmsTable.Row class="border-b border-ink/[0.06] align-top">
                  <CmsTable.Cell class="py-2 pr-3 font-mono text-xs text-ink/60">{row.line}</CmsTable.Cell>
                  <CmsTable.Cell class="py-2 pr-3">
                    {#if row.status === 'ok'}
                      <span class="rounded-full bg-forest/10 px-2 py-0.5 text-xs font-bold text-forest">{row.action}</span>
                    {:else}
                      <span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">error</span>
                    {/if}
                  </CmsTable.Cell>
                  <CmsTable.Cell class="py-2 pr-3">
                    <p class="font-semibold text-heading">{row.title ?? '—'}</p>
                    {#if row.slug}<p class="font-mono text-xs text-ink/45">{row.slug}</p>{/if}
                  </CmsTable.Cell>
                  <CmsTable.Cell class="py-2 pr-3 text-xs">
                    {#if row.error}<p class="text-red-700">{row.error}</p>{/if}
                    {#if row.warnings}{#each row.warnings as w}<p class="text-clay/80">{w}</p>{/each}{/if}
                  </CmsTable.Cell>
                </CmsTable.Row>
              {/each}
            </CmsTable.Body>
          </CmsTable.Root>
        </div>
      </section>
    {/if}

    <!-- Danger zone -->
    <section class="rounded-2xl border border-red-200 bg-red-50/40 p-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3">
          <AlertTriangle size={22} class="mt-0.5 shrink-0 text-red-600" />
          <div>
            <h2 class="text-base font-bold text-red-800">Start fresh — reset all content</h2>
            <p class="mt-1 max-w-xl text-sm text-red-700/80">
              Permanently deletes all tours &amp; itineraries, categories, destinations, lodges, journal
              posts &amp; categories, FAQs and testimonials — so you can import your own data on a clean slate. Your
              admin users, roles, branding, settings and homepage are kept. This cannot be undone.
            </p>
          </div>
        </div>
        <AdminButton variant="danger" on:click={openReset}>
          <Trash2 size={16} /> Reset all content
        </AdminButton>
      </div>
    </section>
  </div>
</div>

<!-- Reset confirmation modal -->
{#if resetOpen}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (() => (resetOpen = false))(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),32rem);max-width:none">
      <CmsDialog.Title class="sr-only">Reset all content?</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <div class="w-full max-w-lg rounded-2xl border border-ink/10 bg-surface p-6 shadow-2xl" >
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-2.5">
          <span class="grid h-10 w-10 place-items-center rounded-full bg-red-100 text-red-600"><AlertTriangle size={20} /></span>
          <h2 class="text-lg font-bold text-heading">Reset all content?</h2>
        </div>
        <CmsButton variant="ghost" class="grid h-9 w-9 place-items-center rounded-full border border-ink/10 text-ink transition hover:bg-sand" type="button" aria-label="Close" onclick={() => (resetOpen = false)}>
          <X size={18} />
        </CmsButton>
      </div>

      {#if resetResults}
        <p class="mt-4 text-sm font-semibold text-forest">Done — content cleared. Import your own data above.</p>
        <div class="mt-3 grid gap-1 text-sm">
          {#each resetResults as r (r.table)}
            <div class="flex items-center justify-between border-b border-ink/[0.06] py-1.5">
              <span class="font-mono text-xs text-ink/70">{r.table}</span>
              {#if r.error}<span class="text-xs text-red-700">{r.error}</span>{:else}<span class="text-xs font-semibold text-ink/60">{r.deleted} deleted</span>{/if}
            </div>
          {/each}
        </div>
        <div class="mt-5 flex justify-end">
          <AdminButton on:click={() => (resetOpen = false)}>Close</AdminButton>
        </div>
      {:else}
        <p class="mt-4 text-sm leading-6 text-ink/70">
          This permanently deletes <strong>all</strong> content in these tables. It cannot be undone.
        </p>
        <div class="mt-3 flex flex-wrap gap-1.5">
          {#each resetTables as t}
            <code class="rounded bg-red-50 px-1.5 py-0.5 font-mono text-xs text-red-700">{t}</code>
          {/each}
        </div>
        <CmsLabel class="mt-5 grid gap-2 text-sm font-medium text-ink">
          <span>Type <strong class="font-mono">RESET</strong> to confirm</span>
          <CmsInput
            class="rounded-lg border border-ink/15 bg-surface px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200"
            placeholder="RESET"
            bind:value={resetConfirm}
            autocomplete="off"
          />
        </CmsLabel>
        <div class="mt-5 flex justify-end gap-3">
          <AdminButton variant="secondary" type="button" on:click={() => (resetOpen = false)}>Cancel</AdminButton>
          <AdminButton variant="danger" disabled={resetConfirm !== 'RESET' || resetting} on:click={runReset}>
            <Trash2 size={16} />
            {resetting ? 'Deleting…' : 'Permanently delete all content'}
          </AdminButton>
        </div>
      {/if}
    </div>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}
