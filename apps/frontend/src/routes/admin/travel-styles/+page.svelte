<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsTable from '$lib/components/ui/table';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { Edit, Heart, Plus, Search, Trash2, X } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminRichText from '$lib/admin/components/admin/AdminRichText.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';

  type TravelStyle = {
    id: string;
    name: string;
    slug: string;
    emotional_promise?: string | null;
    description?: string | null;
    desires?: string[] | null;
    concerns?: string[] | null;
    persona?: string | null;
    hero_image_url?: string | null;
    image_url?: string | null;
    status: 'archived' | 'draft' | 'published';
    is_featured?: boolean;
    sort_order?: number | null;
    seo_title?: string | null;
    meta_description?: string | null;
    created_at?: string;
    updated_at?: string;
  };

  type Toast = { id: string; message: string; type: 'error' | 'success' };

  const statusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' }
  ];
  const emptyForm = () => ({
    name: '',
    slug: '',
    emotional_promise: [''] as string[],
    description: '',
    desires: '',
    concerns: '',
    persona: '',
    hero_image_url: '',
    image_url: '',
    status: 'draft' as TravelStyle['status'],
    is_featured: false,
    sort_order: '0',
    seo_title: '',
    meta_description: ''
  });

  let rows: TravelStyle[] = [];
  let loading = true;
  let saving = false;
  let deleting = false;
  let error = '';
  let search = '';
  let statusFilter = 'all';
  let modalOpen = false;
  let confirmOpen = false;
  let slugManuallyEdited = false;
  let editing: TravelStyle | null = null;
  let toDelete: TravelStyle | null = null;
  let form = emptyForm();
  let toasts: Toast[] = [];

  const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const promiseList = (value: unknown) => {
    const items = String(value ?? '').split('\n').map((item) => item.trim()).filter(Boolean);
    return items.length ? items : [''];
  };
  const addPromise = () => { form.emotional_promise = [...form.emotional_promise, '']; };
  const removePromise = (index: number) => {
    const next = form.emotional_promise.filter((_, currentIndex) => currentIndex !== index);
    form.emotional_promise = next.length ? next : [''];
  };
  $: if (modalOpen && !slugManuallyEdited) form.slug = slugify(form.name);

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
      const res = await api.travelStyles.list({ search, status: statusFilter, limit: 100 });
      rows = res.data.items as TravelStyle[];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load travel styles.';
    } finally {
      loading = false;
    }
  };

  const openCreate = () => { editing = null; form = emptyForm(); slugManuallyEdited = false; modalOpen = true; };

  const openEdit = (s: TravelStyle) => {
    editing = s;
    form = {
      name: s.name,
      slug: s.slug,
      emotional_promise: promiseList(s.emotional_promise),
      description: s.description ?? '',
      desires: (s.desires ?? []).join('\n'),
      concerns: (s.concerns ?? []).join('\n'),
      persona: s.persona ?? '',
      hero_image_url: s.hero_image_url ?? '',
      image_url: s.image_url ?? '',
      status: s.status,
      is_featured: Boolean(s.is_featured),
      sort_order: s.sort_order != null ? String(s.sort_order) : '0',
      seo_title: s.seo_title ?? '',
      meta_description: s.meta_description ?? ''
    };
    slugManuallyEdited = true;
    modalOpen = true;
  };

  const closeModal = () => { modalOpen = false; editing = null; form = emptyForm(); slugManuallyEdited = false; };
  const lines = (v: string) => v.split('\n').map((x) => x.trim()).filter(Boolean);

  const save = async () => {
    if (!form.name.trim()) { showToast('Name is required.', 'error'); return; }
    saving = true;
    const sort = Number(form.sort_order);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      emotional_promise: form.emotional_promise.map((item) => item.trim()).filter(Boolean).join('\n') || null,
      description: form.description.trim() || null,
      desires: lines(form.desires),
      concerns: lines(form.concerns),
      persona: slugify(form.persona) || null,
      hero_image_url: form.hero_image_url.trim() || null,
      image_url: form.image_url.trim() || null,
      status: form.status,
      is_featured: form.is_featured,
      sort_order: Number.isFinite(sort) ? sort : 0,
      seo_title: form.seo_title.trim() || null,
      meta_description: form.meta_description.trim() || null
    };
    try {
      if (editing) { await api.travelStyles.update(editing.id, payload); showToast('Travel style updated.'); }
      else { await api.travelStyles.create(payload); showToast('Travel style created.'); }
      closeModal();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save travel style.', 'error');
    } finally {
      saving = false;
    }
  };

  const openDelete = (s: TravelStyle) => { toDelete = s; confirmOpen = true; };
  const confirmDelete = async () => {
    if (!toDelete) return;
    deleting = true;
    try {
      await api.travelStyles.remove(toDelete.id);
      showToast('Travel style deleted.');
      confirmOpen = false; toDelete = null; await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete travel style.', 'error');
    } finally {
      deleting = false;
    }
  };

  const fmt = (v?: string) => v ? new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(v)) : '-';
  onMount(load);
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
  <AdminPageHeader
    eyebrow="Content"
    title="Travel Styles"
    description="Persona-led landing pages (honeymoon, family, luxury…) shown at /travel-styles."
    actionLabel="New Style"
    actionIcon={Plus}
    on:action={openCreate}
  />

  <AdminToolbar className="grid gap-3 md:grid-cols-[1fr_190px_auto] md:items-end">
    <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
      <span>Search</span>
      <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
        <Search size={16} class="text-ink/45" />
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Search styles..." onkeydown={(e) => e.key === 'Enter' && load()} />
      </span>
    </CmsLabel>
    <AdminSelect label="Status" name="status_filter" bind:value={statusFilter} options={[{ label: 'All statuses', value: 'all' }, ...statusOptions]} />
    <AdminButton variant="secondary" on:click={load}>Apply</AdminButton>
  </AdminToolbar>

  {#if loading}
    <LoadingState message="Loading travel styles..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if rows.length === 0}
    <AdminEmptyState title="No travel styles yet" message="Add your first travel style." actionLabel="New Style" icon={Heart} on:action={openCreate} />
  {:else}
    <div class="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm">
      <div class="overflow-x-auto">
        <CmsTable.Root class="w-full min-w-[720px] text-sm">
          <CmsTable.Header class="bg-sand/70 text-xs uppercase tracking-[0.08em] text-ink/60">
            <CmsTable.Row>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Name</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Persona</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Order</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Status</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Updated</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-right font-semibold">Actions</CmsTable.Head>
            </CmsTable.Row>
          </CmsTable.Header>
          <CmsTable.Body class="divide-y divide-ink/10">
            {#each rows as s (s.id)}
              <CmsTable.Row class="transition hover:bg-sand/25">
                <CmsTable.Cell class="px-4 py-4">
                  <div class="font-semibold text-ink">{s.name}{#if s.is_featured}<span class="ml-2 rounded-full bg-goldfinch-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-goldfinch-gold">Featured</span>{/if}</div>
                  <p class="mt-0.5 font-mono text-xs text-ink/50">{s.slug}</p>
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/60 capitalize">{s.persona ?? '-'}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/60">{s.sort_order ?? 0}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4"><StatusBadge status={s.status} /></CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/60">{fmt(s.updated_at ?? s.created_at)}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4">
                  <div class="flex justify-end gap-2">
                    <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openEdit(s)}>
                      <Edit size={14} />Edit
                    </CmsButton>
                    <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDelete(s)}>
                      <Trash2 size={14} />Delete
                    </CmsButton>
                  </div>
                </CmsTable.Cell>
              </CmsTable.Row>
            {/each}
          </CmsTable.Body>
        </CmsTable.Root>
      </div>
    </div>
  {/if}
</div>

{#if modalOpen}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (closeModal)(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),42rem);max-width:none">
      <CmsDialog.Title class="sr-only">{editing ? editing.name : 'Create Travel Style'}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <form
      class="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-ink/10 bg-surface p-6 shadow-sm"
      
      on:submit|preventDefault={save}
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">{editing ? 'Edit style' : 'New style'}</p>
          <h2 class="mt-1 text-2xl font-bold text-ink">{editing ? editing.name : 'Create Travel Style'}</h2>
        </div>
        <CmsButton variant="ghost" class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand" type="button" aria-label="Close" onclick={closeModal}>
          <X size={18} />
        </CmsButton>
      </div>

      <div class="mt-6 grid gap-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <AdminFormInput label="Name" name="name" bind:value={form.name} required />
          <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
            <span>Slug</span>
            <CmsInput class="h-11 rounded-2xl border border-ink/10 bg-surface px-3 font-mono text-sm shadow-sm outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15" name="slug" bind:value={form.slug} required oninput={() => (slugManuallyEdited = true)} />
          </CmsLabel>
        </div>

        <div class="grid gap-2.5">
          <div class="flex items-center justify-between gap-3">
            <span class="text-[13px] font-semibold text-ink/65">Emotional promises</span>
            <CmsButton variant="ghost" type="button" class="inline-flex h-9 items-center gap-1.5 rounded-md border border-forest/25 bg-forest/5 px-3 text-xs font-bold text-forest transition hover:bg-forest hover:text-white" onclick={addPromise}>
              <Plus size={14} /> Add promise
            </CmsButton>
          </div>
          {#each form.emotional_promise as _promise, index}
            <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_40px] items-end gap-2">
              <AdminFormInput label={`Promise ${index + 1}`} name={`emotional_promise_${index}`} bind:value={form.emotional_promise[index]} placeholder="The most romantic start to forever" />
              <CmsButton variant="ghost"
                type="button"
                class="grid h-11 w-10 place-items-center rounded-md border border-ink/10 bg-surface text-ink/45 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-35"
                aria-label={`Remove promise ${index + 1}`}
                disabled={form.emotional_promise.length === 1}
                onclick={() => removePromise(index)}
              >
                <Trash2 size={16} />
              </CmsButton>
            </div>
          {/each}
        </div>
        <AdminRichText label="Description" name="description" bind:value={form.description} rows={7} />

        <div class="grid gap-4 sm:grid-cols-2">
          <AdminTextArea label="What they want (one per line)" name="desires" bind:value={form.desires} rows={4} />
          <AdminTextArea label="Concerns we plan around (one per line)" name="concerns" bind:value={form.concerns} rows={4} />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-1.5">
            <AdminFormInput label="Persona key" name="persona" bind:value={form.persona} placeholder="family, couple, solo-traveller" />
            <p class="text-xs leading-5 text-ink/55">
              Optional. Published styles with a persona key appear as travel-type filters on the Tours page. Keep the key stable because tour persona tags use it for matching.
            </p>
          </div>
          <MediaPicker label="Hero image" uploadFolder="travel-styles" bind:value={form.hero_image_url} />
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <AdminSelect label="Status" name="status" bind:value={form.status} options={statusOptions} />
          <AdminFormInput label="Sort order" name="sort_order" type="number" bind:value={form.sort_order} />
          <CmsLabel class="flex cursor-pointer items-center gap-3 self-end rounded-2xl border border-ink/10 bg-surface p-3">
            <CmsCheckbox class="h-4 w-4 accent-forest"  bind:checked={form.is_featured} />
            <span class="text-sm font-semibold text-ink">Featured</span>
          </CmsLabel>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <AdminFormInput label="SEO title" name="seo_title" bind:value={form.seo_title} />
          <AdminFormInput label="Meta description" name="meta_description" bind:value={form.meta_description} />
        </div>
      </div>

      <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AdminButton variant="secondary" type="button" on:click={closeModal}>Cancel</AdminButton>
        <AdminButton type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Style'}</AdminButton>
      </div>
    </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title="Delete travel style"
  message={`Delete "${toDelete?.name ?? 'this style'}"? This soft-deletes the record.`}
  on:cancel={() => { confirmOpen = false; toDelete = null; }}
  on:confirm={confirmDelete}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">Deleting travel style...</div>
{/if}
