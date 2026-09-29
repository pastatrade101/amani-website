<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  import { cdnUrl } from '$lib/admin/img';
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { BadgeCheck, CheckCircle2, Clock, Edit, ExternalLink, MapPin, Plus, Search, Star, Trash2, X } from '@lucide/svelte';
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
  import type { Review, ReviewSummary } from '$lib/admin/types';

  type TourOption = { id: string; slug: string; title: string };
  type MediaItem = { file_name: string; file_url: string; id: string; thumbnail_url?: string | null };
  type Option = { label: string; value: string };
  type Toast = { id: string; message: string; type: 'error' | 'success' };

  const platformOptions: Option[] = [
    { label: 'TripAdvisor', value: 'TripAdvisor' },
    { label: 'SafariBookings', value: 'SafariBookings' },
    { label: 'Google', value: 'Google' }
  ];

  const statusOptions: Option[] = [
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' }
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
    platform: 'TripAdvisor' as Review['platform'],
    author_name: '',
    author_initials: '',
    author_photo_url: '',
    country: '',
    message: '',
    rating: 5,
    source_url: '',
    tour_id: '',
    status: 'pending' as NonNullable<Review['status']>,
    is_featured: false,
    sort_order: '0'
  });

  let rows: Review[] = [];
  let summary: ReviewSummary | null = null;
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
  let platformFilter = 'all';
  let ratingFilter = 'all';
  let featuredFilter = 'all';
  let tourFilter = 'all';

  let modalOpen = false;
  let confirmOpen = false;
  let editing: Review | null = null;
  let toDelete: Review | null = null;
  let form = emptyForm();
  let toasts: Toast[] = [];

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); }, 3500);
  };
  const dismissToast = (e: CustomEvent<string>) => { toasts = toasts.filter((t) => t.id !== e.detail); };

  const initials = (r: Review) =>
    (r.author_initials && r.author_initials.trim()) ||
    r.author_name?.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') ||
    '?';

  const load = async () => {
    loading = true;
    error = '';
    try {
      const res = await api.reviews.list({
        search,
        status: statusFilter,
        platform: platformFilter === 'all' ? undefined : platformFilter,
        rating: ratingFilter === 'all' ? undefined : ratingFilter,
        is_featured: featuredFilter === 'all' ? undefined : featuredFilter,
        tour_id: tourFilter === 'all' ? undefined : tourFilter,
        limit: 200
      });
      rows = res.data.items as unknown as Review[];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load reviews.';
    } finally {
      loading = false;
    }
  };

  const loadSummary = async () => {
    try {
      const res = await api.reviews.summary();
      summary = res.data;
    } catch {
      summary = null;
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

  const openEdit = (r: Review) => {
    editing = r;
    form = {
      platform: r.platform,
      author_name: r.author_name,
      author_initials: r.author_initials ?? '',
      author_photo_url: r.author_photo_url ?? '',
      country: r.country ?? '',
      message: r.message,
      rating: r.rating,
      source_url: r.source_url ?? '',
      tour_id: r.tour_id ?? '',
      status: r.status ?? 'pending',
      is_featured: Boolean(r.is_featured),
      sort_order: String(r.sort_order ?? 0)
    };
    void loadMedia();
    modalOpen = true;
  };

  const closeModal = () => { modalOpen = false; editing = null; form = emptyForm(); };

  const payload = () => ({
    platform: form.platform,
    author_name: form.author_name.trim(),
    author_initials: form.author_initials.trim(),
    author_photo_url: form.author_photo_url.trim(),
    country: form.country.trim(),
    message: form.message.trim(),
    rating: form.rating,
    source_url: form.source_url.trim(),
    tour_id: form.tour_id || null,
    tour_title: tours.find((t) => t.id === form.tour_id)?.title ?? null,
    status: form.status,
    is_featured: form.is_featured,
    sort_order: Number(form.sort_order || 0)
  });

  const save = async () => {
    if (form.author_name.trim().length < 2) { showToast('Author name is required.', 'error'); return; }
    if (form.message.trim().length < 5) { showToast('Message must be at least 5 characters.', 'error'); return; }
    saving = true;
    try {
      if (editing) {
        await api.reviews.update(editing.id, payload());
        showToast('Review updated successfully.');
      } else {
        await api.reviews.create(payload());
        showToast('Review created successfully.');
      }
      closeModal();
      await Promise.all([load(), loadSummary()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save review.', 'error');
    } finally {
      saving = false;
    }
  };

  const toggleApproved = async (r: Review) => {
    const next = r.status === 'approved' ? 'pending' : 'approved';
    try {
      await api.reviews.update(r.id, { status: next });
      showToast(next === 'approved' ? 'Review approved — now live.' : 'Review moved back to pending.');
      await Promise.all([load(), loadSummary()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update status.', 'error');
    }
  };

  const toggleFeatured = async (r: Review) => {
    try {
      await api.reviews.update(r.id, { is_featured: !r.is_featured });
      showToast(r.is_featured ? 'Removed from featured.' : 'Marked as featured.');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update featured state.', 'error');
    }
  };

  const openDelete = (r: Review) => { toDelete = r; confirmOpen = true; };

  const confirmDelete = async () => {
    if (!toDelete) return;
    deleting = true;
    try {
      await api.reviews.remove(toDelete.id);
      showToast('Review deleted successfully.');
      confirmOpen = false;
      toDelete = null;
      await Promise.all([load(), loadSummary()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete review.', 'error');
    } finally {
      deleting = false;
    }
  };

  onMount(async () => {
    await Promise.all([load(), loadSummary(), loadTours()]);
  });
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
  <AdminPageHeader
    eyebrow="Content Management"
    title="Reviews"
    description="Platform-attributed reviews (TripAdvisor, SafariBookings, Google). Approved reviews power the homepage trust widget and AggregateRating SEO stars."
    actionLabel="New Review"
    actionIcon={Plus}
    on:action={openCreate}
  />

  {#if summary}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-wide text-ink/50">Approved reviews</p>
        <p class="mt-1 text-2xl font-bold text-ink">{summary.count}</p>
      </div>
      <div class="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-wide text-ink/50">Average rating</p>
        <p class="mt-1 flex items-center gap-1.5 text-2xl font-bold text-ink">
          {summary.average.toFixed(1)}<Star size={18} class="text-goldfinch-gold" fill="currentColor" />
        </p>
      </div>
      {#each summary.by_platform.slice(0, 2) as p}
        <div class="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
          <p class="truncate text-xs font-semibold uppercase tracking-wide text-ink/50">{p.platform}</p>
          <p class="mt-1 text-2xl font-bold text-ink">{p.average.toFixed(1)} <span class="text-sm font-semibold text-ink/45">({p.count})</span></p>
        </div>
      {/each}
    </div>
  {/if}

  <AdminToolbar className="grid gap-3 lg:grid-cols-[1fr_repeat(5,140px)_auto] lg:items-end">
    <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
      <span>Search</span>
      <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
        <Search size={16} class="text-ink/45" />
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Name, message, tour..." onkeydown={(e) => e.key === 'Enter' && load()} />
      </span>
    </CmsLabel>
    <AdminSelect label="Status" name="status_filter" bind:value={statusFilter} options={[{ label: 'All statuses', value: 'all' }, ...statusOptions]} />
    <AdminSelect label="Platform" name="platform_filter" bind:value={platformFilter} options={[{ label: 'All platforms', value: 'all' }, ...platformOptions]} />
    <AdminSelect label="Rating" name="rating_filter" bind:value={ratingFilter} options={ratingFilterOptions} />
    <AdminSelect label="Featured" name="featured_filter" bind:value={featuredFilter} options={featuredFilterOptions} />
    <AdminSelect label="Tour" name="tour_filter" bind:value={tourFilter} options={tourFilterOptions} />
    <AdminButton variant="secondary" on:click={load}>Apply</AdminButton>
  </AdminToolbar>

  {#if loading}
    <LoadingState message="Loading reviews..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if rows.length === 0}
    <AdminEmptyState
      title="No reviews yet"
      message="Add reviews from TripAdvisor, SafariBookings or Google to build trust and earn review stars in search results."
      actionLabel="New Review"
      icon={BadgeCheck}
      on:action={openCreate}
    />
  {:else}
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {#each rows as r (r.id)}
        <article class="flex flex-col gap-4 rounded-xl border border-ink/10 bg-surface p-5 shadow-sm" transition:fade={{ duration: 120 }}>
          {#if r.author_photo_url}
            <img
              class="aspect-[16/10] w-full rounded-xl object-cover ring-1 ring-ink/10"
              src={cdnUrl(r.author_photo_url)}
              alt={`Review card image for ${r.author_name}`}
              loading="lazy"
              decoding="async"
            />
          {/if}
          <div class="flex items-start gap-3">
            <div class="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-forest/10 text-sm font-bold text-forest ring-1 ring-forest/15">{initials(r)}</div>
            <div class="min-w-0 flex-1">
              <p class="truncate font-bold text-ink">{r.author_name}</p>
              {#if r.country}<p class="truncate text-xs text-ink/55">{r.country}</p>{/if}
            </div>
            <span class="shrink-0 rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-bold text-forest">{r.platform}</span>
          </div>

          <div class="flex items-center gap-0.5">
            {#each Array(5) as _, i}
              <Star size={15} class={i < r.rating ? 'text-goldfinch-gold' : 'text-ink/15'} fill={i < r.rating ? 'currentColor' : 'none'} />
            {/each}
            <span class="ml-1 text-xs font-semibold text-ink/45">{r.rating}/5</span>
          </div>

          <blockquote class="line-clamp-4 text-sm leading-6 text-ink/70">"{r.message}"</blockquote>

          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge status={r.status ?? 'pending'} />
            {#if r.is_featured}
              <span class="inline-flex items-center gap-1 rounded-full bg-goldfinch-gold px-2 py-0.5 text-[11px] font-bold text-heading"><Star size={10} fill="currentColor" />Featured</span>
            {/if}
            <span class="rounded-full bg-sand/70 px-2 py-0.5 text-[11px] font-semibold text-ink/55">Sort {r.sort_order ?? 0}</span>
            {#if r.tour_title}
              <span class="inline-flex items-center gap-1 rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-semibold text-forest"><MapPin size={10} />{r.tour_title}</span>
            {/if}
            {#if r.source_url}
              <a class="inline-flex items-center gap-1 rounded-full bg-sand/70 px-2 py-0.5 text-[11px] font-semibold text-forest transition hover:text-heading" href={r.source_url} target="_blank" rel="noopener nofollow">Source <ExternalLink size={10} /></a>
            {/if}
          </div>

          <div class="mt-auto flex flex-wrap gap-2 border-t border-ink/10 pt-3">
            <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-forest/10 px-3 text-xs font-semibold text-forest transition hover:bg-forest/20" type="button" onclick={() => toggleApproved(r)}>
              {#if r.status === 'approved'}<Clock size={13} />Unapprove{:else}<CheckCircle2 size={13} />Approve{/if}
            </CmsButton>
            <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-goldfinch-gold/15 px-3 text-xs font-semibold text-heading transition hover:bg-goldfinch-gold/30" type="button" onclick={() => toggleFeatured(r)}>
              <Star size={13} fill={r.is_featured ? 'currentColor' : 'none'} />{r.is_featured ? 'Unfeature' : 'Feature'}
            </CmsButton>
            <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openEdit(r)}>
              <Edit size={13} />Edit
            </CmsButton>
            <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDelete(r)}>
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
      <CmsDialog.Title class="sr-only">{editing ? 'Update review' : 'Add platform review'}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <form
      class="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-ink/10 bg-surface p-6 shadow-sm"
      
      on:submit|preventDefault={save}
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">{editing ? 'Edit review' : 'New review'}</p>
          <h2 class="mt-1 text-2xl font-bold text-ink">{editing ? 'Update review' : 'Add platform review'}</h2>
        </div>
        <CmsButton variant="ghost" class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand" type="button" aria-label="Close" onclick={closeModal}>
          <X size={18} />
        </CmsButton>
      </div>

      <div class="mt-6 grid gap-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <AdminSelect label="Platform" name="platform" bind:value={form.platform} options={platformOptions} />
          <AdminFormInput label="Author name" name="author_name" bind:value={form.author_name} placeholder="e.g. Amelia Carter" required />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <AdminFormInput label="Author initials (optional)" name="author_initials" bind:value={form.author_initials} placeholder="Auto from name if blank" />
          <AdminFormInput label="Country (optional)" name="country" bind:value={form.country} placeholder="e.g. United Kingdom" />
        </div>

        <AdminTextArea label="Message" name="message" bind:value={form.message} rows={5} placeholder="What did the traveller say?" />

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

        <AdminFormInput label="Source URL (optional)" name="source_url" bind:value={form.source_url} placeholder="https://www.tripadvisor.com/..." />

        <div class="rounded-xl border border-ink/10 bg-sand/25 p-4">
          <MediaPicker label="Review card image (optional)" media={mediaItems} uploadFolder="reviews" aspect="aspect-[16/10]" bind:value={form.author_photo_url} />
          <p class="mt-2 text-xs leading-5 text-ink/55">Shown as the large image at the top of review cards. Choose an existing image from the media gallery or upload a new one.</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <AdminSelect label="Linked tour (optional)" name="tour_id" bind:value={form.tour_id} options={tourOptions} />
          <AdminSelect label="Status" name="status" bind:value={form.status} options={statusOptions} />
        </div>

        <div class="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <AdminFormInput label="Sort order" name="sort_order" type="number" bind:value={form.sort_order} />
          <CmsLabel class="flex h-11 cursor-pointer items-center gap-3 rounded-2xl border border-ink/10 bg-surface px-4 transition hover:bg-sand/30">
            <CmsCheckbox class="h-4 w-4 accent-forest"  bind:checked={form.is_featured} />
            <span class="text-sm font-semibold text-ink">Featured review</span>
          </CmsLabel>
        </div>
      </div>

      <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AdminButton variant="secondary" type="button" on:click={closeModal}>Cancel</AdminButton>
        <AdminButton type="submit" disabled={saving}>
          {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Review'}
        </AdminButton>
      </div>
    </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title="Delete review"
  message={`Delete the review from "${toDelete?.author_name ?? 'this traveller'}"? This action soft-deletes the record.`}
  on:cancel={() => { confirmOpen = false; toDelete = null; }}
  on:confirm={confirmDelete}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting review...
  </div>
{/if}
