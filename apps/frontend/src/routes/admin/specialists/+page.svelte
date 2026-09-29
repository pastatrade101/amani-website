<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { Edit, ExternalLink, MessageCircle, Plus, Search, Star, Trash2, Users, X } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import Img from '$lib/admin/components/public/Img.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';
  import type { Specialist } from '$lib/admin/types';

  type SpecialistRow = Specialist & {
    id: string;
    is_featured: boolean;
    sort_order: number;
    status: 'archived' | 'draft' | 'published';
  };
  type MediaItem = { file_name: string; file_url: string; id: string; thumbnail_url?: string | null };
  type Option = { label: string; value: string };
  type Toast = { id: string; message: string; type: 'error' | 'success' };

  const statusOptions: Option[] = [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' }
  ];

  const featuredFilterOptions: Option[] = [
    { label: 'All', value: 'all' },
    { label: 'Featured only', value: 'true' },
    { label: 'Not featured', value: 'false' }
  ];

  const emptyForm = () => ({
    name: '',
    role: '',
    photo_url: '',
    blurb: '',
    whatsapp_number: '',
    tripadvisor_url: '',
    status: 'draft' as SpecialistRow['status'],
    is_featured: false,
    sort_order: '0'
  });

  let rows: SpecialistRow[] = [];
  let mediaItems: MediaItem[] = [];
  let loading = true;
  let loadingMedia = false;
  let saving = false;
  let deleting = false;
  let error = '';
  let search = '';
  let statusFilter = 'all';
  let featuredFilter = 'all';
  let modalOpen = false;
  let confirmOpen = false;
  let editing: SpecialistRow | null = null;
  let toDelete: SpecialistRow | null = null;
  let form = emptyForm();
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

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';

  const photoOf = (specialist: Specialist) => specialist.photo_url || specialist.photo || '';

  const load = async () => {
    loading = true;
    error = '';
    try {
      const response = await api.specialists.list({
        search,
        status: statusFilter,
        is_featured: featuredFilter === 'all' ? undefined : featuredFilter,
        limit: 200
      });
      rows = response.data.items as SpecialistRow[];
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : 'Unable to load specialists.';
    } finally {
      loading = false;
    }
  };

  const loadMedia = async () => {
    if (mediaItems.length || loadingMedia) return;
    loadingMedia = true;
    try {
      const response = await api.media.list({ file_type: 'image', limit: 200 });
      mediaItems = (response.data.items as unknown as MediaItem[]).filter((item) => item.file_url);
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to load media library.', 'error');
    } finally {
      loadingMedia = false;
    }
  };

  const openCreate = () => {
    editing = null;
    form = emptyForm();
    void loadMedia();
    modalOpen = true;
  };

  const openEdit = (specialist: SpecialistRow) => {
    editing = specialist;
    form = {
      name: specialist.name,
      role: specialist.role,
      photo_url: specialist.photo_url ?? specialist.photo ?? '',
      blurb: specialist.blurb ?? '',
      whatsapp_number: specialist.whatsapp_number ?? '',
      tripadvisor_url: specialist.tripadvisor_url ?? '',
      status: specialist.status,
      is_featured: Boolean(specialist.is_featured),
      sort_order: String(specialist.sort_order ?? 0)
    };
    void loadMedia();
    modalOpen = true;
  };

  const closeModal = () => {
    modalOpen = false;
    editing = null;
    form = emptyForm();
  };

  const payload = () => ({
    name: form.name.trim(),
    role: form.role.trim(),
    photo_url: form.photo_url.trim() || null,
    blurb: form.blurb.trim() || null,
    whatsapp_number: form.whatsapp_number.trim() || null,
    tripadvisor_url: form.tripadvisor_url.trim() || null,
    status: form.status,
    is_featured: form.is_featured,
    sort_order: Number(form.sort_order || 0)
  });

  const save = async () => {
    if (form.name.trim().length < 2) {
      showToast('Specialist name is required.', 'error');
      return;
    }
    if (form.role.trim().length < 2) {
      showToast('Specialist role is required.', 'error');
      return;
    }

    saving = true;
    try {
      if (editing) {
        await api.specialists.update(editing.id, payload());
        showToast('Specialist updated successfully.');
      } else {
        await api.specialists.create(payload());
        showToast('Specialist created successfully.');
      }
      closeModal();
      await load();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to save specialist.', 'error');
    } finally {
      saving = false;
    }
  };

  const toggleFeatured = async (specialist: SpecialistRow) => {
    try {
      await api.specialists.update(specialist.id, { is_featured: !specialist.is_featured });
      showToast(specialist.is_featured ? 'Removed from featured.' : 'Marked as featured.');
      await load();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to update featured state.', 'error');
    }
  };

  const openDelete = (specialist: SpecialistRow) => {
    toDelete = specialist;
    confirmOpen = true;
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    deleting = true;
    try {
      await api.specialists.remove(toDelete.id);
      showToast('Specialist deleted successfully.');
      confirmOpen = false;
      toDelete = null;
      await load();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to delete specialist.', 'error');
    } finally {
      deleting = false;
    }
  };

  onMount(() => {
    void load();
  });
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
  <AdminPageHeader
    eyebrow="Tour Management"
    title="Tour Specialists"
    description="Manage the travel specialists editors can attach to individual tours and show on the About page."
    actionLabel="New Specialist"
    actionIcon={Plus}
    on:action={openCreate}
  />

  <AdminToolbar className="grid gap-3 lg:grid-cols-[1fr_170px_160px_auto] lg:items-end">
    <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
      <span>Search</span>
      <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
        <Search size={16} class="text-ink/45" />
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Name, role, bio..." onkeydown={(event) => event.key === 'Enter' && load()} />
      </span>
    </CmsLabel>
    <AdminSelect label="Status" name="status_filter" bind:value={statusFilter} options={[{ label: 'All statuses', value: 'all' }, ...statusOptions]} />
    <AdminSelect label="Featured" name="featured_filter" bind:value={featuredFilter} options={featuredFilterOptions} />
    <AdminButton variant="secondary" on:click={load}>Apply</AdminButton>
  </AdminToolbar>

  {#if loading}
    <LoadingState message="Loading specialists..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if rows.length === 0}
    <AdminEmptyState
      title="No specialists yet"
      message="Create travel specialists here, then attach one to each tour in the tour editor."
      actionLabel="New Specialist"
      icon={Users}
      on:action={openCreate}
    />
  {:else}
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {#each rows as specialist (specialist.id)}
        {@const photo = photoOf(specialist)}
        <article class="flex flex-col overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm" transition:fade={{ duration: 120 }}>
          <div class="flex gap-4 p-5">
            {#if photo}
              <Img record={specialist} fields={['photo_url', 'photo']} src={photo} alt={specialist.name} width={128} height={128} className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-ink/10" />
            {:else}
              <div class="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-forest/10 text-lg font-bold text-forest ring-1 ring-forest/15">
                {initials(specialist.name)}
              </div>
            {/if}
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <StatusBadge status={specialist.status} />
                {#if specialist.is_featured}
                  <span class="inline-flex items-center gap-1 rounded-full bg-goldfinch-gold px-2 py-0.5 text-[11px] font-bold text-heading">
                    <Star size={10} fill="currentColor" />Featured
                  </span>
                {/if}
              </div>
              <p class="mt-2 truncate font-bold text-ink">{specialist.name}</p>
              <p class="text-sm font-semibold text-clay">{specialist.role}</p>
            </div>
          </div>

          <div class="flex flex-1 flex-col px-5 pb-5">
            {#if specialist.blurb}
              <p class="line-clamp-4 text-sm leading-6 text-ink/70">{specialist.blurb}</p>
            {:else}
              <p class="text-sm leading-6 text-ink/45">No bio written yet.</p>
            {/if}

            <div class="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              {#if specialist.whatsapp_number}
                <span class="inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/10 px-2.5 py-1 text-[#168A44]">
                  <MessageCircle size={12} /> WhatsApp
                </span>
              {/if}
              {#if specialist.tripadvisor_url}
                <a class="inline-flex items-center gap-1.5 rounded-full bg-sand/60 px-2.5 py-1 text-heading transition hover:bg-sand" href={specialist.tripadvisor_url} target="_blank" rel="noopener noreferrer">
                  TripAdvisor <ExternalLink size={12} />
                </a>
              {/if}
              <span class="rounded-full bg-sand/60 px-2.5 py-1 text-ink/55">Sort {specialist.sort_order ?? 0}</span>
            </div>

            <div class="mt-auto flex flex-wrap gap-2 border-t border-ink/10 pt-4">
              <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-goldfinch-gold/15 px-3 text-xs font-semibold text-heading transition hover:bg-goldfinch-gold/30" type="button" onclick={() => toggleFeatured(specialist)}>
                <Star size={13} fill={specialist.is_featured ? 'currentColor' : 'none'} />
                {specialist.is_featured ? 'Unfeature' : 'Feature'}
              </CmsButton>
              <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openEdit(specialist)}>
                <Edit size={13} />Edit
              </CmsButton>
              <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDelete(specialist)}>
                <Trash2 size={13} />Delete
              </CmsButton>
            </div>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</div>

{#if modalOpen}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (closeModal)(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),42rem);max-width:none">
      <CmsDialog.Title class="sr-only">{editing ? 'Update travel specialist' : 'Create travel specialist'}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <form
      class="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-ink/10 bg-surface p-6 shadow-sm"
      
      on:submit|preventDefault={save}
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">{editing ? 'Edit specialist' : 'New specialist'}</p>
          <h2 class="mt-1 text-2xl font-bold text-ink">{editing ? 'Update travel specialist' : 'Create travel specialist'}</h2>
        </div>
        <CmsButton variant="ghost" class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand" type="button" aria-label="Close" onclick={closeModal}>
          <X size={18} />
        </CmsButton>
      </div>

      <div class="mt-6 grid gap-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <AdminFormInput label="Name" name="name" bind:value={form.name} placeholder="e.g. Amani Mushi" required />
          <AdminFormInput label="Role" name="role" bind:value={form.role} placeholder="e.g. Safari Specialist" required />
        </div>

        <div class="rounded-xl border border-ink/10 bg-sand/25 p-4">
          <MediaPicker label="Specialist photo" media={mediaItems} uploadFolder="specialists" aspect="aspect-square" bind:value={form.photo_url} />
        </div>

        <AdminTextArea label="Short bio" name="blurb" bind:value={form.blurb} rows={4} placeholder="Brief planning experience, region knowledge, or what this person helps with." />

        <div class="grid gap-4 sm:grid-cols-2">
          <AdminFormInput label="WhatsApp number" name="whatsapp_number" bind:value={form.whatsapp_number} placeholder="+255..." />
          <AdminFormInput label="TripAdvisor link" name="tripadvisor_url" type="url" bind:value={form.tripadvisor_url} placeholder="https://www.tripadvisor.com/..." />
        </div>

        <div class="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <AdminSelect label="Status" name="status" bind:value={form.status} options={statusOptions} />
          <AdminFormInput label="Sort order" name="sort_order" type="number" bind:value={form.sort_order} />
          <CmsLabel class="flex h-11 cursor-pointer items-center gap-3 rounded-2xl border border-ink/10 bg-surface px-4 transition hover:bg-sand/30">
            <CmsCheckbox class="h-4 w-4 accent-forest"  bind:checked={form.is_featured} />
            <span class="text-sm font-semibold text-ink">Featured</span>
          </CmsLabel>
        </div>
      </div>

      <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AdminButton variant="secondary" type="button" on:click={closeModal}>Cancel</AdminButton>
        <AdminButton type="submit" disabled={saving}>
          {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Specialist'}
        </AdminButton>
      </div>
    </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title="Delete specialist"
  message={`Delete "${toDelete?.name ?? 'this specialist'}"? This action soft-deletes the record.`}
  on:cancel={() => { confirmOpen = false; toDelete = null; }}
  on:confirm={confirmDelete}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting specialist...
  </div>
{/if}
