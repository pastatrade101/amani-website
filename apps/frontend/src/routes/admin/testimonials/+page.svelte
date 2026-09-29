<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  import { cdnUrl } from '$lib/admin/img';
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { Edit, MapPin, MessageCircleHeart, Plus, Search, Star, Trash2, X } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';

  type Testimonial = {
    client_country?: string | null;
    client_image_url?: string | null;
    client_name: string;
    created_at?: string;
    id: string;
    is_featured: boolean;
    message: string;
    rating: number;
    sort_order: number;
    status: 'archived' | 'draft' | 'published';
    tour_id?: string | null;
    tours?: { id: string; slug: string; title: string } | null;
  };

  type TourOption = { id: string; slug: string; title: string };
  type MediaItem = { file_name: string; file_url: string; id: string; thumbnail_url?: string | null };
  type Option = { label: string; value: string };
  type Toast = { id: string; message: string; type: 'error' | 'success' };

  const statusOptions: Option[] = [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' }
  ];

  const ratingFilterOptions: Option[] = [
    { label: 'All ratings', value: 'all' },
    { label: '5 stars', value: '5' },
    { label: '4 stars', value: '4' },
    { label: '3 stars', value: '3' },
    { label: '2 stars', value: '2' },
    { label: '1 star', value: '1' }
  ];

  const featuredFilterOptions: Option[] = [
    { label: 'All', value: 'all' },
    { label: 'Featured only', value: 'true' },
    { label: 'Not featured', value: 'false' }
  ];

  const emptyForm = () => ({
    client_country: '',
    client_image_url: '',
    client_name: '',
    is_featured: false,
    message: '',
    rating: 5,
    sort_order: '0',
    status: 'draft' as Testimonial['status'],
    tour_id: ''
  });

  let rows: Testimonial[] = [];
  let tours: TourOption[] = [];
  let tourOptions: Option[] = [{ label: 'No tour', value: '' }];
  let tourFilterOptions: Option[] = [{ label: 'All tours', value: 'all' }];
  let mediaItems: MediaItem[] = [];

  let loading = true;
  let loadingMedia = false;
  let saving = false;
  let deleting = false;
  let error = '';

  let search = '';
  let statusFilter = 'all';
  let ratingFilter = 'all';
  let featuredFilter = 'all';
  let tourFilter = 'all';

  let modalOpen = false;
  let confirmOpen = false;
  let editing: Testimonial | null = null;
  let toDelete: Testimonial | null = null;
  let form = emptyForm();
  let toasts: Toast[] = [];

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); }, 3500);
  };

  const dismissToast = (e: CustomEvent<string>) => { toasts = toasts.filter((t) => t.id !== e.detail); };

  const initials = (name: string) =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

  const tourTitle = (t: Testimonial) => {
    if (t.tours && typeof t.tours === 'object' && 'title' in t.tours) return t.tours.title;
    return '';
  };

  const load = async () => {
    loading = true;
    error = '';
    try {
      const res = await api.testimonials.list({
        search,
        status: statusFilter,
        rating: ratingFilter === 'all' ? undefined : ratingFilter,
        is_featured: featuredFilter === 'all' ? undefined : featuredFilter,
        tour_id: tourFilter === 'all' ? undefined : tourFilter,
        limit: 200
      });
      rows = res.data.items as unknown as Testimonial[];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load testimonials.';
    } finally {
      loading = false;
    }
  };

  const loadTours = async () => {
    try {
      const res = await api.tours.list({ limit: 200, status: 'all' });
      tours = res.data.items.map((t) => ({ id: t.id, slug: t.slug, title: t.title }));
      tourOptions = [{ label: 'No tour', value: '' }, ...tours.map((t) => ({ label: t.title, value: t.id }))];
      tourFilterOptions = [{ label: 'All tours', value: 'all' }, ...tours.map((t) => ({ label: t.title, value: t.id }))];
    } catch {
      // non-critical
    }
  };

  const loadMedia = async () => {
    if (mediaItems.length || loadingMedia) return;
    loadingMedia = true;
    try {
      const res = await api.media.list({ file_type: 'image', limit: 200 });
      mediaItems = (res.data.items as unknown as MediaItem[]).filter((m) => m.file_url);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load media library.', 'error');
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

  const openEdit = (t: Testimonial) => {
    editing = t;
    form = {
      client_country: t.client_country ?? '',
      client_image_url: t.client_image_url ?? '',
      client_name: t.client_name,
      is_featured: t.is_featured,
      message: t.message,
      rating: t.rating,
      sort_order: String(t.sort_order ?? 0),
      status: t.status,
      tour_id: t.tour_id ?? ''
    };
    void loadMedia();
    modalOpen = true;
  };

  const closeModal = () => { modalOpen = false; editing = null; form = emptyForm(); };

  const payload = () => ({
    client_country: form.client_country.trim() || null,
    client_image_url: form.client_image_url.trim() || null,
    client_name: form.client_name.trim(),
    is_featured: form.is_featured,
    message: form.message.trim(),
    rating: form.rating,
    sort_order: Number(form.sort_order || 0),
    status: form.status,
    tour_id: form.tour_id || null
  });

  const save = async () => {
    if (form.client_name.trim().length < 2) { showToast('Client name is required.', 'error'); return; }
    if (form.message.trim().length < 5) { showToast('Message must be at least 5 characters.', 'error'); return; }
    saving = true;
    try {
      if (editing) {
        await api.testimonials.update(editing.id, payload());
        showToast('Testimonial updated successfully.');
      } else {
        await api.testimonials.create(payload());
        showToast('Testimonial created successfully.');
      }
      closeModal();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save testimonial.', 'error');
    } finally {
      saving = false;
    }
  };

  const toggleFeatured = async (t: Testimonial) => {
    try {
      await api.testimonials.update(t.id, { is_featured: !t.is_featured });
      showToast(t.is_featured ? 'Removed from featured.' : 'Marked as featured.');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update featured state.', 'error');
    }
  };

  const openDelete = (t: Testimonial) => { toDelete = t; confirmOpen = true; };

  const confirmDelete = async () => {
    if (!toDelete) return;
    deleting = true;
    try {
      await api.testimonials.remove(toDelete.id);
      showToast('Testimonial deleted successfully.');
      confirmOpen = false;
      toDelete = null;
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete testimonial.', 'error');
    } finally {
      deleting = false;
    }
  };

  onMount(async () => {
    await Promise.all([load(), loadTours()]);
  });
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
  <AdminPageHeader
    eyebrow="Content Management"
    title="Testimonials"
    description="Manage client reviews for social proof, homepage content, tour pages, and conversion support."
    actionLabel="New Testimonial"
    actionIcon={Plus}
    on:action={openCreate}
  />

  <AdminToolbar className="grid gap-3 lg:grid-cols-[1fr_repeat(4,150px)_auto] lg:items-end">
    <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
      <span>Search</span>
      <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
        <Search size={16} class="text-ink/45" />
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Name, country, message..." onkeydown={(e) => e.key === 'Enter' && load()} />
      </span>
    </CmsLabel>
    <AdminSelect label="Status" name="status_filter" bind:value={statusFilter} options={[{ label: 'All statuses', value: 'all' }, ...statusOptions]} />
    <AdminSelect label="Rating" name="rating_filter" bind:value={ratingFilter} options={ratingFilterOptions} />
    <AdminSelect label="Featured" name="featured_filter" bind:value={featuredFilter} options={featuredFilterOptions} />
    <AdminSelect label="Tour" name="tour_filter" bind:value={tourFilter} options={tourFilterOptions} />
    <AdminButton variant="secondary" on:click={load}>Apply</AdminButton>
  </AdminToolbar>

  {#if loading}
    <LoadingState message="Loading testimonials..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if rows.length === 0}
    <AdminEmptyState
      title="No testimonials yet"
      message="Add your first client review to build trust and provide social proof across the website."
      actionLabel="New Testimonial"
      icon={MessageCircleHeart}
      on:action={openCreate}
    />
  {:else}
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {#each rows as t (t.id)}
        <article class="flex flex-col gap-4 rounded-xl border border-ink/10 bg-surface p-5 shadow-sm" transition:fade={{ duration: 120 }}>
          <div class="flex items-start gap-3">
            {#if t.client_image_url}
              <img class="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-ink/10" src={cdnUrl(t.client_image_url)} alt={t.client_name} />
            {:else}
              <div class="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-forest/10 text-sm font-bold text-forest ring-1 ring-forest/15">
                {initials(t.client_name)}
              </div>
            {/if}
            <div class="min-w-0 flex-1">
              <p class="truncate font-bold text-ink">{t.client_name}</p>
              {#if t.client_country}
                <p class="truncate text-xs text-ink/55">{t.client_country}</p>
              {/if}
            </div>
            {#if t.is_featured}
              <span class="flex shrink-0 items-center gap-1 rounded-full bg-goldfinch-gold px-2 py-0.5 text-[11px] font-bold text-heading">
                <Star size={10} fill="currentColor" />Featured
              </span>
            {/if}
          </div>

          <div class="flex items-center gap-0.5">
            {#each Array(5) as _, i}
              <Star size={15} class={i < t.rating ? 'text-goldfinch-gold' : 'text-ink/15'} fill={i < t.rating ? 'currentColor' : 'none'} />
            {/each}
            <span class="ml-1 text-xs font-semibold text-ink/45">{t.rating}/5</span>
          </div>

          <blockquote class="line-clamp-4 text-sm leading-6 text-ink/70">"{t.message}"</blockquote>

          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge status={t.status} />
            <span class="rounded-full bg-sand/70 px-2 py-0.5 text-[11px] font-semibold text-ink/55">Sort {t.sort_order}</span>
            {#if tourTitle(t)}
              <span class="inline-flex items-center gap-1 rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-semibold text-forest">
                <MapPin size={10} />{tourTitle(t)}
              </span>
            {/if}
          </div>

          <div class="mt-auto flex flex-wrap gap-2 border-t border-ink/10 pt-3">
            <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-goldfinch-gold/15 px-3 text-xs font-semibold text-heading transition hover:bg-goldfinch-gold/30" type="button" onclick={() => toggleFeatured(t)}>
              <Star size={13} fill={t.is_featured ? 'currentColor' : 'none'} />
              {t.is_featured ? 'Unfeature' : 'Feature'}
            </CmsButton>
            <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openEdit(t)}>
              <Edit size={13} />Edit
            </CmsButton>
            <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDelete(t)}>
              <Trash2 size={13} />Delete
            </CmsButton>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</div>

{#if modalOpen}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (closeModal)(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),42rem);max-width:none">
      <CmsDialog.Title class="sr-only">{editing ? 'Update review' : 'Add client review'}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <form
      class="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-ink/10 bg-surface p-6 shadow-sm"
      
      on:submit|preventDefault={save}
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">{editing ? 'Edit testimonial' : 'New testimonial'}</p>
          <h2 class="mt-1 text-2xl font-bold text-ink">{editing ? 'Update review' : 'Add client review'}</h2>
        </div>
        <CmsButton variant="ghost" class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand" type="button" aria-label="Close" onclick={closeModal}>
          <X size={18} />
        </CmsButton>
      </div>

      <div class="mt-6 grid gap-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <AdminFormInput label="Client name" name="client_name" bind:value={form.client_name} placeholder="e.g. Amelia Carter" required />
          <AdminFormInput label="Client country" name="client_country" bind:value={form.client_country} placeholder="e.g. United Kingdom" />
        </div>

        <AdminTextArea label="Message" name="message" bind:value={form.message} rows={5} placeholder="What did the client say about their experience?" />

        <!-- rating star picker -->
        <div class="grid gap-2">
          <span class="text-sm font-medium text-ink">Rating</span>
          <div class="flex items-center gap-1.5">
            {#each Array(5) as _, i}
              <CmsButton variant="ghost" type="button" class="transition hover:scale-110" aria-label={`Rate ${i + 1}`} onclick={() => (form.rating = i + 1)}>
                <Star size={26} class={i < form.rating ? 'text-goldfinch-gold' : 'text-ink/20'} fill={i < form.rating ? 'currentColor' : 'none'} />
              </CmsButton>
            {/each}
            <span class="ml-2 text-sm font-semibold text-ink/55">{form.rating} / 5</span>
          </div>
        </div>

        <!-- client image -->
        <div class="rounded-xl border border-ink/10 bg-sand/25 p-4">
          <MediaPicker label="Client image" media={mediaItems} uploadFolder="testimonials" aspect="aspect-square" bind:value={form.client_image_url} />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <AdminSelect label="Linked tour (optional)" name="tour_id" bind:value={form.tour_id} options={tourOptions} />
          <AdminSelect label="Status" name="status" bind:value={form.status} options={statusOptions} />
        </div>

        <div class="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <AdminFormInput label="Sort order" name="sort_order" type="number" bind:value={form.sort_order} />
          <CmsLabel class="flex h-11 cursor-pointer items-center gap-3 rounded-2xl border border-ink/10 bg-surface px-4 transition hover:bg-sand/30">
            <CmsCheckbox class="h-4 w-4 accent-forest"  bind:checked={form.is_featured} />
            <span class="text-sm font-semibold text-ink">Featured testimonial</span>
          </CmsLabel>
        </div>
      </div>

      <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AdminButton variant="secondary" type="button" on:click={closeModal}>Cancel</AdminButton>
        <AdminButton type="submit" disabled={saving}>
          {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Testimonial'}
        </AdminButton>
      </div>
    </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title="Delete testimonial"
  message={`Delete the review from "${toDelete?.client_name ?? 'this client'}"? This action soft-deletes the record.`}
  on:cancel={() => { confirmOpen = false; toDelete = null; }}
  on:confirm={confirmDelete}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting testimonial...
  </div>
{/if}
