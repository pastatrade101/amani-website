<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import * as CmsTable from '$lib/components/ui/table';

  import { cdnUrl } from '$lib/admin/img';
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { Copy, Edit, Grid2X2, Image as ImageIcon, List, Plus, Search, Trash2, Upload, X } from '@lucide/svelte';
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
  import type { Pagination } from '$lib/admin/types';

  type MediaItem = {
    id: string;
    file_name: string;
    file_url: string;
    file_path: string;
    file_type: 'image' | 'video' | 'document';
    mime_type?: string | null;
    file_size?: number | string | null;
    alt_text?: string | null;
    caption?: string | null;
    uploaded_by?: string | null;
    created_at?: string;
    deleted_at?: string | null;
  };

  type Toast = {
    id: string;
    message: string;
    type: 'error' | 'success';
  };

  type ViewMode = 'grid' | 'list';

  const fileTypeOptions = [
    { label: 'All file types', value: 'all' },
    { label: 'Images', value: 'image' },
    { label: 'Videos', value: 'video' },
    { label: 'Documents', value: 'document' }
  ];

  let rows: MediaItem[] = [];
  let pagination: Pagination | null = null;
  let loading = true;
  let uploading = false;
  let saving = false;
  let deleting = false;
  let error = '';
  let search = '';
  let fileType = 'all';
  let page = 1;
  let viewMode: ViewMode = 'grid';
  let uploadModalOpen = false;
  let editModalOpen = false;
  let confirmOpen = false;
  let mediaToEdit: MediaItem | null = null;
  let mediaToDelete: MediaItem | null = null;
  type UploadItem = { id: string; file: File; name: string; size: number; status: 'queued' | 'uploading' | 'done' | 'error'; error?: string };
  let uploadItems: UploadItem[] = [];
  let uploadAltText = '';
  let uploadCaption = '';
  let uploadDragging = false;
  let uploadInput: HTMLInputElement | null = null;

  $: uploadPending = uploadItems.filter((u) => u.status === 'queued' || u.status === 'error').length;
  let editAltText = '';
  let editCaption = '';
  let toasts: Toast[] = [];

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => {
      toasts = toasts.filter((toast) => toast.id !== id);
    }, 3500);
  };

  const dismissToast = (event: CustomEvent<string>) => {
    toasts = toasts.filter((toast) => toast.id !== event.detail);
  };

  const loadMedia = async () => {
    loading = true;
    error = '';

    try {
      const response = await api.media.list({
        file_type: fileType,
        limit: 24,
        page,
        search
      });
      rows = response.data.items as MediaItem[];
      pagination = response.data.pagination;
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : 'Unable to load media library.';
    } finally {
      loading = false;
    }
  };

  const applyFilters = async () => {
    page = 1;
    await loadMedia();
  };

  const formatDate = (value?: string) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  };

  const formatFileSize = (value?: number | string | null) => {
    const bytes = Number(value ?? 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const MAX_UPLOAD = 5 * 1024 * 1024;
  const prettyName = (name: string) => name.replace(/\.[^./\\]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const setUploadItem = (id: string, patch: Partial<UploadItem>) => {
    uploadItems = uploadItems.map((u) => (u.id === id ? { ...u, ...patch } : u));
  };

  const addUploadFiles = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    const withinSize = images.filter((f) => f.size <= MAX_UPLOAD);
    if (images.length !== files.length) showToast('Skipped non-image files.', 'error');
    const tooBig = images.length - withinSize.length;
    if (tooBig) showToast(`${tooBig} file${tooBig === 1 ? '' : 's'} over 5MB skipped.`, 'error');
    uploadItems = [
      ...uploadItems,
      ...withinSize.map((file) => ({ id: crypto.randomUUID(), file, name: file.name, size: file.size, status: 'queued' as const }))
    ];
  };

  const handleUploadFileChange = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    addUploadFiles(Array.from(input.files ?? []));
    input.value = '';
  };
  const onUploadDrop = (event: DragEvent) => {
    uploadDragging = false;
    addUploadFiles(Array.from(event.dataTransfer?.files ?? []));
  };
  const removeUploadItem = (id: string) => { uploadItems = uploadItems.filter((u) => u.id !== id); };

  const resetUpload = () => {
    uploadItems = [];
    uploadAltText = '';
    uploadCaption = '';
  };

  const openUploadModal = () => {
    resetUpload();
    uploadModalOpen = true;
  };

  const closeUploadModal = () => {
    uploadModalOpen = false;
    resetUpload();
  };

  const uploadOne = async (item: UploadItem) => {
    setUploadItem(item.id, { status: 'uploading', error: undefined });
    try {
      await api.upload.image(item.file, 'media', {
        alt_text: uploadAltText.trim() || prettyName(item.name),
        caption: uploadCaption.trim()
      });
      setUploadItem(item.id, { status: 'done' });
    } catch (requestError) {
      setUploadItem(item.id, { status: 'error', error: requestError instanceof Error ? requestError.message : 'Upload failed.' });
    }
  };

  const uploadMedia = async () => {
    const pending = uploadItems.filter((u) => u.status === 'queued' || u.status === 'error');
    if (!pending.length) {
      showToast('Choose at least one image first.', 'error');
      return;
    }
    uploading = true;
    // upload with a small concurrency pool so many files don't hammer the server
    const queue = [...pending];
    const worker = async () => { let n; while ((n = queue.shift())) await uploadOne(n); };
    await Promise.all([worker(), worker(), worker()]);
    uploading = false;

    const ids = new Set(pending.map((p) => p.id));
    const ok = uploadItems.filter((u) => ids.has(u.id) && u.status === 'done').length;
    const failed = uploadItems.filter((u) => ids.has(u.id) && u.status === 'error').length;
    if (ok) {
      showToast(`${ok} image${ok === 1 ? '' : 's'} uploaded${failed ? ` · ${failed} failed` : ''}.`, failed ? 'error' : 'success');
      page = 1;
      await loadMedia();
      if (!failed) closeUploadModal();
    } else {
      showToast('Unable to upload media.', 'error');
    }
  };

  const openEditModal = (media: MediaItem) => {
    mediaToEdit = media;
    editAltText = media.alt_text ?? '';
    editCaption = media.caption ?? '';
    editModalOpen = true;
  };

  const closeEditModal = () => {
    editModalOpen = false;
    mediaToEdit = null;
    editAltText = '';
    editCaption = '';
  };

  const saveMetadata = async () => {
    if (!mediaToEdit) return;
    saving = true;

    try {
      await api.media.update(mediaToEdit.id, {
        alt_text: editAltText || null,
        caption: editCaption || null
      });
      showToast('Media metadata updated successfully.');
      closeEditModal();
      await loadMedia();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to update media metadata.', 'error');
    } finally {
      saving = false;
    }
  };

  const copyUrl = async (media: MediaItem) => {
    try {
      await navigator.clipboard.writeText(media.file_url);
      showToast('Image URL copied.');
    } catch {
      showToast('Unable to copy image URL.', 'error');
    }
  };

  const openDeleteConfirm = (media: MediaItem) => {
    mediaToDelete = media;
    confirmOpen = true;
  };

  const deleteMedia = async () => {
    if (!mediaToDelete) return;
    deleting = true;

    try {
      await api.media.remove(mediaToDelete.id);
      showToast('Media deleted successfully.');
      confirmOpen = false;
      mediaToDelete = null;
      await loadMedia();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to delete media.', 'error');
    } finally {
      deleting = false;
    }
  };

  const goToPage = async (nextPage: number) => {
    page = nextPage;
    await loadMedia();
  };

  onMount(loadMedia);
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
<AdminPageHeader
  eyebrow="Admin CMS"
  title="Media Library"
  description="Upload and reuse images across tours, destinations, blogs, gallery, testimonials, and homepage content."
  actionLabel="Upload Media"
  actionIcon={Plus}
  on:action={openUploadModal}
/>

<AdminToolbar className="grid gap-3 lg:grid-cols-[1fr_190px_auto_auto] lg:items-end">
  <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
    <span>Search</span>
    <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
      <Search size={16} class="text-ink/45" />
      <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Search file name, alt text, or caption..." onkeydown={(event) => event.key === 'Enter' && applyFilters()} />
    </span>
  </CmsLabel>

  <AdminSelect label="File type" name="file_type_filter" bind:value={fileType} options={fileTypeOptions} />

  <AdminButton variant="secondary" on:click={applyFilters}>Apply</AdminButton>

  <div class="flex h-11 rounded-2xl border border-ink/10 bg-surface p-1 shadow-sm">
    <CmsButton variant="ghost" class={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${viewMode === 'grid' ? 'bg-forest text-white shadow-sm' : 'text-ink/60 hover:bg-sand/70 hover:text-heading'}`} type="button" onclick={() => (viewMode = 'grid')} aria-label="Show media grid">
      <Grid2X2 size={15} />
      Grid
    </CmsButton>
    <CmsButton variant="ghost" class={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${viewMode === 'list' ? 'bg-forest text-white shadow-sm' : 'text-ink/60 hover:bg-sand/70 hover:text-heading'}`} type="button" onclick={() => (viewMode = 'list')} aria-label="Show media list">
      <List size={15} />
      List
    </CmsButton>
  </div>
</AdminToolbar>

{#if loading}
  <LoadingState message="Loading media library..." />
{:else if error}
  <ErrorState message={error} />
{:else if rows.length === 0}
  <AdminEmptyState
    title="No media uploaded yet"
    message="Upload images once and reuse them across tours, destinations, blogs, gallery, testimonials, and homepage sections."
    actionLabel="Upload first image"
    icon={ImageIcon}
    on:action={openUploadModal}
  />
{:else if viewMode === 'grid'}
  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {#each rows as media}
      <article class="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-sm">
        <div class="aspect-[4/3] bg-sand/60">
          {#if media.file_type === 'image'}
            <img class="h-full w-full object-cover" src={cdnUrl(media.file_url)} alt={media.alt_text || media.file_name} />
          {:else}
            <div class="grid h-full place-items-center text-ink/40">
              <ImageIcon size={34} />
            </div>
          {/if}
        </div>

        <div class="grid gap-3 p-4">
          <div>
            <h2 class="truncate text-sm font-semibold text-ink" title={media.file_name}>{media.file_name}</h2>
            <p class="mt-1 truncate text-xs text-ink/55">{media.mime_type || '-'} · {formatFileSize(media.file_size)}</p>
          </div>

          <div class="grid gap-1 text-xs text-ink/60">
            <p class="line-clamp-1"><span class="font-semibold text-ink/70">Alt:</span> {media.alt_text || '-'}</p>
            <p class="line-clamp-1"><span class="font-semibold text-ink/70">Caption:</span> {media.caption || '-'}</p>
            <p><span class="font-semibold text-ink/70">Uploaded:</span> {formatDate(media.created_at)}</p>
          </div>

          <div class="flex flex-wrap justify-end gap-2">
            <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => copyUrl(media)}>
              <Copy size={14} />
              Copy URL
            </CmsButton>
            <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openEditModal(media)}>
              <Edit size={14} />
              Edit
            </CmsButton>
            <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDeleteConfirm(media)}>
              <Trash2 size={14} />
              Delete
            </CmsButton>
          </div>
        </div>
      </article>
    {/each}
  </div>
{:else}
  <div class="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm">
    <div class="overflow-x-auto">
      <CmsTable.Root class="w-full min-w-[980px] text-start text-sm">
        <CmsTable.Header class="bg-sand/70 text-xs uppercase tracking-[0.08em] text-ink/60">
          <CmsTable.Row>
            <CmsTable.Head class="px-4 py-3 font-semibold">Preview</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">File</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Type</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Alt text</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Caption</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Uploaded</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 text-right font-semibold">Actions</CmsTable.Head>
          </CmsTable.Row>
        </CmsTable.Header>
        <CmsTable.Body class="divide-y divide-ink/10">
          {#each rows as media}
            <CmsTable.Row class="transition hover:bg-sand/25">
              <CmsTable.Cell class="px-4 py-3">
                <div class="h-12 w-16 overflow-hidden rounded-md bg-sand/60">
                  {#if media.file_type === 'image'}
                    <img class="h-full w-full object-cover" src={cdnUrl(media.file_url)} alt={media.alt_text || media.file_name} />
                  {:else}
                    <div class="grid h-full place-items-center text-ink/35"><ImageIcon size={18} /></div>
                  {/if}
                </div>
              </CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3">
                <div class="max-w-[220px] truncate font-semibold text-ink" title={media.file_name}>{media.file_name}</div>
                <p class="mt-1 text-xs text-ink/55">{media.mime_type || '-'} · {formatFileSize(media.file_size)}</p>
              </CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3 text-ink/65">{media.file_type}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3 text-ink/65">{media.alt_text || '-'}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3 text-ink/65">{media.caption || '-'}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3 text-ink/65">{formatDate(media.created_at)}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => copyUrl(media)}>
                    <Copy size={14} />
                    Copy
                  </CmsButton>
                  <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openEditModal(media)}>
                    <Edit size={14} />
                    Edit
                  </CmsButton>
                  <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDeleteConfirm(media)}>
                    <Trash2 size={14} />
                    Delete
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

{#if pagination && pagination.totalPages > 1}
  <div class="flex flex-col gap-3 rounded-xl border border-ink/10 bg-surface/90 p-4 text-sm text-ink/65 shadow-sm sm:flex-row sm:items-center sm:justify-between">
    <p>Page {pagination.page} of {pagination.totalPages} · {pagination.total} files</p>
    <div class="flex gap-2">
      <AdminButton variant="secondary" size="sm" disabled={page <= 1} on:click={() => goToPage(page - 1)}>Previous</AdminButton>
      <AdminButton variant="secondary" size="sm" disabled={page >= pagination.totalPages} on:click={() => goToPage(page + 1)}>Next</AdminButton>
    </div>
  </div>
{/if}
</div>

{#if uploadModalOpen}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (closeUploadModal)(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),42rem);max-width:none">
      <CmsDialog.Title class="sr-only">Add Images</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <form class="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm"  on:submit|preventDefault={uploadMedia}>
      <div class="flex items-start justify-between gap-4 border-b border-ink/10 p-6">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Upload media</p>
          <h2 class="mt-1 text-2xl font-bold tracking-normal text-ink">Add Images</h2>
          <p class="mt-1 text-sm text-ink/60">Upload one or many images at once. Alt text &amp; caption below apply to all of them.</p>
        </div>
        <CmsButton variant="ghost" class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand" type="button" aria-label="Close modal" onclick={closeUploadModal}>
          <X size={18} />
        </CmsButton>
      </div>

      <div class="grid gap-4 overflow-y-auto p-6">
        <!-- dropzone -->
        <CmsButton variant="ghost"
          type="button"
          class={`grid place-items-center gap-2 rounded-xl border-2 border-dashed px-6 py-9 text-center transition ${uploadDragging ? 'border-forest bg-forest/5' : 'border-ink/20 bg-sand/20 hover:border-forest/50 hover:bg-sand/40'}`}
          onclick={() => uploadInput?.click()}
          ondragover={(event) => { event.preventDefault(); (() => (uploadDragging = true))(); }}
          ondragleave={(event) => { event.preventDefault(); (() => (uploadDragging = false))(); }}
          ondrop={(event) => { event.preventDefault(); (onUploadDrop)(event); }}
        >
          <Upload size={26} class="text-forest" />
          <span class="text-sm font-semibold text-ink">Click to choose images, or drag &amp; drop</span>
          <span class="text-xs text-ink/50">JPG, PNG, WebP or AVIF · max 5MB each · select many at once</span>
        </CmsButton>

        <AdminFormInput label="Alt text (applied to all — blank uses each file name)" name="upload_alt_text" bind:value={uploadAltText} placeholder="Describe the images for accessibility" />
        <AdminTextArea label="Caption (applied to all, optional)" name="upload_caption" bind:value={uploadCaption} rows={2} placeholder="Optional CMS caption." />

        {#if uploadItems.length}
          <div class="grid gap-2">
            <p class="text-sm font-semibold text-ink">{uploadItems.length} file{uploadItems.length === 1 ? '' : 's'} selected</p>
            <div class="grid gap-2">
              {#each uploadItems as u (u.id)}
                <div class="flex items-center gap-3 rounded-lg border border-ink/10 bg-surface px-3 py-2 shadow-sm">
                  <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sand/50 text-ink/45">
                    {#if u.status === 'uploading'}
                      <span class="h-4 w-4 animate-spin rounded-full border-2 border-forest/30 border-t-forest"></span>
                    {:else}
                      <ImageIcon size={16} />
                    {/if}
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-ink" title={u.name}>{u.name}</p>
                    <p class="text-[11px] text-ink/50">
                      {formatFileSize(u.size)}
                      {#if u.status === 'done'} · <span class="font-semibold text-forest">Uploaded</span>
                      {:else if u.status === 'error'} · <span class="font-semibold text-red-600" title={u.error}>Failed — {u.error}</span>
                      {:else if u.status === 'uploading'} · <span class="text-ink/50">Uploading…</span>
                      {:else} · <span class="text-ink/50">Queued</span>{/if}
                    </p>
                  </div>
                  {#if u.status !== 'uploading'}
                    <CmsButton variant="ghost" type="button" class="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-ink/10 text-ink/50 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600" aria-label="Remove" onclick={() => removeUploadItem(u.id)}>
                      <X size={14} />
                    </CmsButton>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <div class="flex justify-end gap-3 border-t border-ink/10 p-6">
        <AdminButton variant="secondary" type="button" on:click={closeUploadModal}>Cancel</AdminButton>
        <AdminButton type="submit" disabled={uploading || uploadPending === 0}>
          <Upload size={15} />
          {uploading ? 'Uploading…' : `Upload ${uploadPending} image${uploadPending === 1 ? '' : 's'}`}
        </AdminButton>
      </div>
    </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
  <CmsInput class="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple bind:ref={uploadInput} onchange={handleUploadFileChange} />
{/if}

{#if editModalOpen && mediaToEdit}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (closeEditModal)(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),36rem);max-width:none">
      <CmsDialog.Title class="sr-only">{mediaToEdit.file_name}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <div class="w-full max-w-xl rounded-xl border border-ink/10 bg-surface p-6 shadow-sm" >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Edit metadata</p>
          <h2 class="mt-2 text-xl font-bold tracking-normal text-ink">{mediaToEdit.file_name}</h2>
        </div>
        <CmsButton variant="ghost" class="grid h-10 w-10 place-items-center rounded-2xl border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand" type="button" aria-label="Close modal" onclick={closeEditModal}>
          <X size={18} />
        </CmsButton>
      </div>

      <form class="mt-6 grid gap-4" on:submit|preventDefault={saveMetadata}>
        <AdminFormInput label="Alt text" name="edit_alt_text" bind:value={editAltText} placeholder="Describe the image for accessibility" />
        <AdminTextArea label="Caption" name="edit_caption" bind:value={editCaption} rows={3} placeholder="Optional CMS caption." />

        <div class="flex justify-end gap-3 pt-2">
          <AdminButton variant="secondary" type="button" on:click={closeEditModal}>Cancel</AdminButton>
          <AdminButton type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Metadata'}
          </AdminButton>
        </div>
      </form>
    </div>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title="Delete media"
  message={`Remove "${mediaToDelete?.file_name ?? 'this media file'}" from the media library? The database record will be soft deleted.`}
  on:cancel={() => {
    confirmOpen = false;
    mediaToDelete = null;
  }}
  on:confirm={deleteMedia}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting media...
  </div>
{/if}
