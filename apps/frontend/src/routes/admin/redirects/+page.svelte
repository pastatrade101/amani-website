<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsTable from '$lib/components/ui/table';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { ArrowRight, Edit, Plus, Search, Signpost, Trash2, X } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
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

  type Redirect = {
    id: string;
    from_path: string;
    to_path: string;
    status_code: number;
    is_active: boolean;
    note?: string | null;
    created_at?: string;
  };
  type Option = { label: string; value: string };
  type Toast = { id: string; message: string; type: 'error' | 'success' };

  const statusCodeOptions: Option[] = [
    { label: '301 — Permanent', value: '301' },
    { label: '302 — Temporary', value: '302' },
    { label: '307 — Temporary (keep method)', value: '307' },
    { label: '308 — Permanent (keep method)', value: '308' }
  ];

  const emptyForm = () => ({
    from_path: '',
    to_path: '',
    status_code: '301',
    is_active: true,
    note: ''
  });

  let rows: Redirect[] = [];
  let loading = true;
  let saving = false;
  let deleting = false;
  let error = '';
  let search = '';

  let modalOpen = false;
  let confirmOpen = false;
  let editing: Redirect | null = null;
  let toDelete: Redirect | null = null;
  let form = emptyForm();
  let toasts: Toast[] = [];

  // Live resolver tester
  let testPath = '';
  let testResult = '';
  let testing = false;

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
      const res = await api.redirects.list({ search, limit: 200 });
      rows = res.data.items as unknown as Redirect[];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load redirects.';
    } finally {
      loading = false;
    }
  };

  const openCreate = () => { editing = null; form = emptyForm(); modalOpen = true; };

  const openEdit = (r: Redirect) => {
    editing = r;
    form = {
      from_path: r.from_path,
      to_path: r.to_path,
      status_code: String(r.status_code ?? 301),
      is_active: r.is_active !== false,
      note: r.note ?? ''
    };
    modalOpen = true;
  };

  const closeModal = () => { modalOpen = false; editing = null; form = emptyForm(); };

  const payload = () => ({
    from_path: form.from_path.trim(),
    to_path: form.to_path.trim(),
    status_code: Number(form.status_code),
    is_active: form.is_active,
    note: form.note.trim() || null
  });

  const save = async () => {
    const from = form.from_path.trim();
    const to = form.to_path.trim();
    if (!from.startsWith('/')) { showToast('From path must start with "/".', 'error'); return; }
    if (!to) { showToast('To path is required.', 'error'); return; }
    if (from === to) { showToast('From and To cannot be the same path.', 'error'); return; }
    saving = true;
    try {
      if (editing) {
        await api.redirects.update(editing.id, payload());
        showToast('Redirect updated successfully.');
      } else {
        await api.redirects.create(payload());
        showToast('Redirect created successfully.');
      }
      closeModal();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save redirect.', 'error');
    } finally {
      saving = false;
    }
  };

  const toggleActive = async (r: Redirect) => {
    try {
      await api.redirects.update(r.id, { is_active: !r.is_active });
      showToast(r.is_active ? 'Redirect disabled.' : 'Redirect enabled.');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update redirect.', 'error');
    }
  };

  const openDelete = (r: Redirect) => { toDelete = r; confirmOpen = true; };

  const confirmDelete = async () => {
    if (!toDelete) return;
    deleting = true;
    try {
      await api.redirects.remove(toDelete.id);
      showToast('Redirect deleted successfully.');
      confirmOpen = false;
      toDelete = null;
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete redirect.', 'error');
    } finally {
      deleting = false;
    }
  };

  const runTest = async () => {
    const path = testPath.trim();
    if (!path) { testResult = ''; return; }
    testing = true;
    testResult = '';
    try {
      const res = await api.redirects.resolve(path.startsWith('/') ? path : `/${path}`);
      const d = res.data;
      testResult = d.match ? `✓ ${d.status_code} → ${d.to_path}` : '✕ No redirect — this path would 404 (then report to Error logs).';
    } catch (err) {
      testResult = err instanceof Error ? err.message : 'Test failed.';
    } finally {
      testing = false;
    }
  };

  // `loading` starts true, so without this the page sat on "Loading
  // redirects..." until someone happened to press Apply.
  onMount(load);
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1200px] gap-6">
  <AdminPageHeader
    eyebrow="Administration"
    title="Redirects"
    description="Map old or changed URLs to new ones. When a page would 404, the server checks here first and issues a real 301/302 — preserving SEO link equity."
    actionLabel="New Redirect"
    actionIcon={Plus}
    on:action={openCreate}
  />

  <AdminToolbar className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
    <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
      <span>Search</span>
      <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
        <Search size={16} class="text-ink/45" />
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="From or to path..." onkeydown={(e) => e.key === 'Enter' && load()} />
      </span>
    </CmsLabel>
    <AdminButton variant="secondary" on:click={load}>Apply</AdminButton>
  </AdminToolbar>

  <!-- Live resolver tester -->
  <div class="rounded-xl border border-ink/10 bg-sand/25 p-4">
    <p class="text-sm font-semibold text-ink">Test a path</p>
    <p class="mt-0.5 text-xs text-ink/55">Check what the live resolver returns for any path — exactly what the server does on a 404.</p>
    <div class="mt-3 flex flex-wrap items-center gap-3">
      <span class="flex h-11 min-w-[240px] flex-1 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm">
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={testPath} placeholder="/old-page" onkeydown={(e) => e.key === 'Enter' && runTest()} />
      </span>
      <AdminButton variant="secondary" type="button" disabled={testing} on:click={runTest}>{testing ? 'Testing...' : 'Test'}</AdminButton>
      {#if testResult}
        <span class="text-sm font-semibold {testResult.startsWith('✓') ? 'text-forest' : 'text-ink/60'}">{testResult}</span>
      {/if}
    </div>
  </div>

  {#if loading}
    <LoadingState message="Loading redirects..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if rows.length === 0}
    <AdminEmptyState
      title="No redirects yet"
      message="Add a redirect to send an old URL to its new home and keep your search rankings."
      actionLabel="New Redirect"
      icon={Signpost}
      on:action={openCreate}
    />
  {:else}
    <div class="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm">
      <CmsTable.Root class="w-full min-w-[720px] text-left text-sm">
        <CmsTable.Header class="border-b border-ink/10 bg-sand/40 text-xs font-semibold uppercase tracking-wide text-ink/55">
          <CmsTable.Row>
            <CmsTable.Head class="px-4 py-3">From</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3">To</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3">Code</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3">Status</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 text-right">Actions</CmsTable.Head>
          </CmsTable.Row>
        </CmsTable.Header>
        <CmsTable.Body>
          {#each rows as r (r.id)}
            <CmsTable.Row class="border-b border-ink/[0.06] last:border-0">
              <CmsTable.Cell class="px-4 py-3">
                <span class="font-mono text-[13px] font-semibold text-ink">{r.from_path}</span>
                {#if r.note}<p class="mt-0.5 max-w-[220px] truncate text-xs text-ink/45">{r.note}</p>{/if}
              </CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3">
                <span class="inline-flex items-center gap-1.5 font-mono text-[13px] text-forest"><ArrowRight size={12} />{r.to_path}</span>
              </CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3"><span class="rounded-md bg-sand/70 px-2 py-0.5 text-xs font-bold text-ink/70">{r.status_code}</span></CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3">
                <CmsButton variant="ghost" type="button" class="inline-flex items-center gap-1.5" onclick={() => toggleActive(r)} title="Toggle active">
                  <span class={`h-2 w-2 rounded-full ${r.is_active ? 'bg-forest' : 'bg-slate-300'}`}></span>
                  <span class={`text-xs font-semibold ${r.is_active ? 'text-forest' : 'text-ink/45'}`}>{r.is_active ? 'Active' : 'Inactive'}</span>
                </CmsButton>
              </CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3">
                <div class="flex items-center justify-end gap-2">
                  <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openEdit(r)}>
                    <Edit size={13} />Edit
                  </CmsButton>
                  <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDelete(r)}>
                    <Trash2 size={13} />Delete
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
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),32rem);max-width:none">
      <CmsDialog.Title class="sr-only">{editing ? 'Update redirect' : 'Add redirect'}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <form
      class="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-ink/10 bg-surface p-6 shadow-sm"
      
      on:submit|preventDefault={save}
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">{editing ? 'Edit redirect' : 'New redirect'}</p>
          <h2 class="mt-1 text-2xl font-bold text-ink">{editing ? 'Update redirect' : 'Add redirect'}</h2>
        </div>
        <CmsButton variant="ghost" class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand" type="button" aria-label="Close" onclick={closeModal}>
          <X size={18} />
        </CmsButton>
      </div>

      <div class="mt-6 grid gap-4">
        <AdminFormInput label="From path" name="from_path" bind:value={form.from_path} placeholder="/old-safari-guide" required />
        <AdminFormInput label="To path" name="to_path" bind:value={form.to_path} placeholder="/destinations or https://..." required />
        <div class="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <AdminSelect label="Status code" name="status_code" bind:value={form.status_code} options={statusCodeOptions} />
          <CmsLabel class="flex h-11 cursor-pointer items-center gap-3 rounded-2xl border border-ink/10 bg-surface px-4 transition hover:bg-sand/30">
            <CmsCheckbox class="h-4 w-4 accent-forest"  bind:checked={form.is_active} />
            <span class="text-sm font-semibold text-ink">Active</span>
          </CmsLabel>
        </div>
        <AdminTextArea label="Note (optional)" name="note" bind:value={form.note} rows={2} placeholder="Why this redirect exists (internal only)" />
      </div>

      <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AdminButton variant="secondary" type="button" on:click={closeModal}>Cancel</AdminButton>
        <AdminButton type="submit" disabled={saving}>
          {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Redirect'}
        </AdminButton>
      </div>
    </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title="Delete redirect"
  message={`Delete the redirect from "${toDelete?.from_path ?? 'this path'}"? This is permanent.`}
  on:cancel={() => { confirmOpen = false; toDelete = null; }}
  on:confirm={confirmDelete}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting redirect...
  </div>
{/if}
