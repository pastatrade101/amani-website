<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsTable from '$lib/components/ui/table';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { Edit, Globe, Plus, Search, Trash2, X } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';
  import type { PageSeo } from '$lib/admin/types';

  type Option = { label: string; value: string };
  type Toast = { id: string; message: string; type: 'error' | 'success' };

  const robotsOptions: Option[] = [
    { label: 'index, follow (default)', value: 'index,follow' },
    { label: 'noindex, follow', value: 'noindex,follow' },
    { label: 'index, nofollow', value: 'index,nofollow' },
    { label: 'noindex, nofollow', value: 'noindex,nofollow' }
  ];

  const emptyForm = () => ({
    path: '',
    title: '',
    meta_description: '',
    og_title: '',
    og_description: '',
    og_image_url: '',
    canonical_url: '',
    robots: 'index,follow',
    structured_data: '',
    is_active: true
  });

  let rows: PageSeo[] = [];
  let loading = true;
  let saving = false;
  let deleting = false;
  let error = '';
  let search = '';

  let modalOpen = false;
  let confirmOpen = false;
  let editing: PageSeo | null = null;
  let toDelete: PageSeo | null = null;
  let form = emptyForm();
  let toasts: Toast[] = [];

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); }, 3500);
  };
  const dismissToast = (e: CustomEvent<string>) => { toasts = toasts.filter((t) => t.id !== e.detail); };

  const load = async () => {
    loading = true;
    error = '';
    try {
      const res = await api.pageSeo.list({ search, limit: 200 });
      rows = res.data.items as unknown as PageSeo[];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load page SEO overrides.';
    } finally {
      loading = false;
    }
  };

  const openCreate = () => { editing = null; form = emptyForm(); modalOpen = true; };

  const openEdit = (r: PageSeo) => {
    editing = r;
    form = {
      path: r.path,
      title: r.title ?? '',
      meta_description: r.meta_description ?? '',
      og_title: r.og_title ?? '',
      og_description: r.og_description ?? '',
      og_image_url: r.og_image_url ?? '',
      canonical_url: r.canonical_url ?? '',
      robots: r.robots || 'index,follow',
      structured_data: r.structured_data ? JSON.stringify(r.structured_data, null, 2) : '',
      is_active: r.is_active !== false
    };
    modalOpen = true;
  };

  const closeModal = () => { modalOpen = false; editing = null; form = emptyForm(); };

  const save = async () => {
    const path = form.path.trim();
    if (!path.startsWith('/')) { showToast('Path must start with "/".', 'error'); return; }

    let structured: unknown = null;
    if (form.structured_data.trim()) {
      try {
        structured = JSON.parse(form.structured_data);
      } catch {
        showToast('Structured data must be valid JSON (or left blank).', 'error');
        return;
      }
    }

    const payload = {
      path,
      title: form.title.trim() || null,
      meta_description: form.meta_description.trim() || null,
      og_title: form.og_title.trim() || null,
      og_description: form.og_description.trim() || null,
      og_image_url: form.og_image_url.trim(),
      canonical_url: form.canonical_url.trim(),
      robots: form.robots || 'index,follow',
      structured_data: structured,
      is_active: form.is_active
    };

    saving = true;
    try {
      if (editing) {
        await api.pageSeo.update(editing.id, payload);
        showToast('SEO override updated successfully.');
      } else {
        await api.pageSeo.create(payload);
        showToast('SEO override created successfully.');
      }
      closeModal();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save SEO override.', 'error');
    } finally {
      saving = false;
    }
  };

  const toggleActive = async (r: PageSeo) => {
    try {
      await api.pageSeo.update(r.id, { is_active: r.is_active === false });
      showToast(r.is_active === false ? 'Override enabled.' : 'Override disabled.');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update override.', 'error');
    }
  };

  const openDelete = (r: PageSeo) => { toDelete = r; confirmOpen = true; };

  const confirmDelete = async () => {
    if (!toDelete) return;
    deleting = true;
    try {
      await api.pageSeo.remove(toDelete.id);
      showToast('Override deleted.');
      confirmOpen = false;
      toDelete = null;
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete override.', 'error');
    } finally {
      deleting = false;
    }
  };

  onMount(load);
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1200px] gap-6">
  <AdminPageHeader
    eyebrow="Administration"
    title="Page SEO"
    description="Per-page title, meta, Open Graph, canonical and robots overrides. A page with no row here keeps the site defaults — nothing changes until you add one."
    actionLabel="New Override"
    actionIcon={Plus}
    on:action={openCreate}
  />

  <AdminToolbar className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
    <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
      <span>Search</span>
      <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
        <Search size={16} class="text-ink/45" />
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Path or title..." onkeydown={(e) => e.key === 'Enter' && load()} />
      </span>
    </CmsLabel>
    <AdminButton variant="secondary" on:click={load}>Apply</AdminButton>
  </AdminToolbar>

  {#if loading}
    <LoadingState message="Loading page SEO..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if rows.length === 0}
    <AdminEmptyState
      title="No page overrides yet"
      message="Add an override to control the title, description and social preview for a specific page. Pages without one use the site defaults."
      actionLabel="New Override"
      icon={Globe}
      on:action={openCreate}
    />
  {:else}
    <div class="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm">
      <CmsTable.Root class="w-full min-w-[780px] text-left text-sm">
        <CmsTable.Header class="border-b border-ink/10 bg-sand/40 text-xs font-semibold uppercase tracking-wide text-ink/55">
          <CmsTable.Row>
            <CmsTable.Head class="px-4 py-3">Path</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3">Title</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3">Robots</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3">Status</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 text-right">Actions</CmsTable.Head>
          </CmsTable.Row>
        </CmsTable.Header>
        <CmsTable.Body>
          {#each rows as r (r.id)}
            <CmsTable.Row class="border-b border-ink/[0.06] last:border-0">
              <CmsTable.Cell class="px-4 py-3"><span class="font-mono text-[13px] font-semibold text-ink">{r.path}</span></CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3"><span class="line-clamp-1 max-w-[280px] text-ink/70">{r.title || '—'}</span></CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3"><span class="rounded-md bg-sand/70 px-2 py-0.5 text-[11px] font-semibold text-ink/70">{r.robots || 'index,follow'}</span></CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3">
                <CmsButton variant="ghost" type="button" class="inline-flex items-center gap-1.5" onclick={() => toggleActive(r)} title="Toggle active">
                  <span class={`h-2 w-2 rounded-full ${r.is_active !== false ? 'bg-forest' : 'bg-slate-300'}`}></span>
                  <span class={`text-xs font-semibold ${r.is_active !== false ? 'text-forest' : 'text-ink/45'}`}>{r.is_active !== false ? 'Active' : 'Inactive'}</span>
                </CmsButton>
              </CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3">
                <div class="flex items-center justify-end gap-2">
                  <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openEdit(r)}>
                    <Edit size={13} />Edit
                  </CmsButton>
                  <CmsButton variant="ghost" class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-surface text-red-700 shadow-sm transition hover:bg-red-50" type="button" aria-label="Delete" onclick={() => openDelete(r)}>
                    <Trash2 size={13} />
                  </CmsButton>
                </div>
              </CmsTable.Cell>
            </CmsTable.Row>
          {/each}
        </CmsTable.Body>
      </CmsTable.Root>
    </div>
  {/if}
</div>

{#if modalOpen}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (closeModal)(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),42rem);max-width:none">
      <CmsDialog.Title class="sr-only">{editing ? 'Update page SEO' : 'Add page SEO'}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <form
      class="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-ink/10 bg-surface p-6 shadow-sm"
      
      on:submit|preventDefault={save}
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">{editing ? 'Edit override' : 'New override'}</p>
          <h2 class="mt-1 text-2xl font-bold text-ink">{editing ? 'Update page SEO' : 'Add page SEO'}</h2>
        </div>
        <CmsButton variant="ghost" class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand" type="button" aria-label="Close" onclick={closeModal}>
          <X size={18} />
        </CmsButton>
      </div>

      <div class="mt-6 grid gap-4">
        <AdminFormInput label="Path" name="path" bind:value={form.path} placeholder="/tours or /destinations/serengeti" required />
        <AdminFormInput label="Title" name="title" bind:value={form.title} placeholder="Page <title> — leave blank to keep the default" />
        <AdminTextArea label="Meta description" name="meta_description" bind:value={form.meta_description} rows={2} placeholder="~150–160 characters" />

        <div class="grid gap-4 sm:grid-cols-2">
          <AdminFormInput label="OG title" name="og_title" bind:value={form.og_title} placeholder="Social share title" />
          <MediaPicker label="Open Graph image" uploadFolder="seo" bind:value={form.og_image_url} />
        </div>
        <AdminTextArea label="OG description" name="og_description" bind:value={form.og_description} rows={2} placeholder="Social share description" />

        <div class="grid gap-4 sm:grid-cols-[1fr_200px] sm:items-end">
          <AdminFormInput label="Canonical URL" name="canonical_url" bind:value={form.canonical_url} placeholder="https://... (leave blank for auto)" />
          <AdminSelect label="Robots" name="robots" bind:value={form.robots} options={robotsOptions} />
        </div>

        <AdminTextArea label="Structured data (JSON-LD, optional)" name="structured_data" bind:value={form.structured_data} rows={4} placeholder={'{ "@type": "TouristAttraction", ... }'} />

        <CmsLabel class="flex h-11 cursor-pointer items-center gap-3 rounded-2xl border border-ink/10 bg-surface px-4 transition hover:bg-sand/30">
          <CmsCheckbox class="h-4 w-4 accent-forest"  bind:checked={form.is_active} />
          <span class="text-sm font-semibold text-ink">Active</span>
        </CmsLabel>
      </div>

      <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AdminButton variant="secondary" type="button" on:click={closeModal}>Cancel</AdminButton>
        <AdminButton type="submit" disabled={saving}>
          {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Override'}
        </AdminButton>
      </div>
    </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title="Delete override"
  message={`Delete the SEO override for "${toDelete?.path ?? 'this path'}"? The page will revert to site defaults.`}
  on:cancel={() => { confirmOpen = false; toDelete = null; }}
  on:confirm={confirmDelete}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting override...
  </div>
{/if}
