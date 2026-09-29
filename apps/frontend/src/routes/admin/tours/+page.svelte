<script lang="ts">
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import * as CmsTable from '$lib/components/ui/table';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Edit, Plus, Search, Trash2 } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';
  import { getTourDestinationLabel } from '$lib/admin/tourDestinations';
  import type { Pagination, Tour as PublicTour } from '$lib/admin/types';

  type Option = {
    label: string;
    value: string;
  };

  type Tour = {
    category_id?: string | null;
    created_at?: string;
    currency?: string | null;
    destination_id?: string | null;
    destinations?: unknown;
    duration_days?: number | string | null;
    duration_nights?: number | string | null;
    id: string;
    is_available?: boolean | null;
    is_featured?: boolean | null;
    is_popular?: boolean | null;
    price_from?: number | string | null;
    short_description?: string | null;
    slug: string;
    status: 'draft' | 'published' | 'archived';
    title: string;
    tour_categories?: unknown;
    updated_at?: string;
  };

  type Toast = {
    id: string;
    message: string;
    type: 'error' | 'success';
  };

  const statusOptions = [
    { label: 'All statuses', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' }
  ];

  const booleanOptions = [
    { label: 'Any', value: 'all' },
    { label: 'Yes', value: 'true' },
    { label: 'No', value: 'false' }
  ];

  let rows: Tour[] = [];
  let destinationOptions: Option[] = [{ label: 'All destinations', value: 'all' }];
  let categoryOptions: Option[] = [{ label: 'All categories', value: 'all' }];
  let pagination: Pagination | null = null;
  let loading = true;
  let deleting = false;
  let error = '';
  let search = '';
  let status = 'all';
  let destination_id = 'all';
  let category_id = 'all';
  let is_featured = 'all';
  let is_popular = 'all';
  let is_available = 'all';
  let page = 1;
  let confirmOpen = false;
  let tourToDelete: Tour | null = null;
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

  const relationText = (value: unknown, key: string) => {
    if (Array.isArray(value)) return String((value[0] as Record<string, unknown> | undefined)?.[key] ?? '-');
    if (value && typeof value === 'object') return String((value as Record<string, unknown>)[key] ?? '-');
    return '-';
  };

  const formatDate = (value?: string) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  };

  const formatPrice = (tour: Tour) => {
    const amount = Number(tour.price_from ?? 0);
    const currency = tour.currency || 'USD';
    return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString() : '0'}`;
  };

  const loadFilters = async () => {
    try {
      const [destinations, categories] = await Promise.all([
        api.destinations.list({ limit: 100, status: 'all' }),
        api.categories.list({ limit: 100, status: 'all' })
      ]);

      destinationOptions = [
        { label: 'All destinations', value: 'all' },
        ...destinations.data.items.map((destination) => ({
          label: String(destination.name ?? destination.slug ?? 'Untitled destination'),
          value: String(destination.id)
        }))
      ];

      categoryOptions = [
        { label: 'All categories', value: 'all' },
        ...categories.data.items.map((category) => ({
          label: String(category.name ?? category.slug ?? 'Untitled category'),
          value: String(category.id)
        }))
      ];
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to load filters.', 'error');
    }
  };

  const loadTours = async () => {
    loading = true;
    error = '';

    try {
      const response = await api.tours.list({
        category_id,
        destination_id,
        is_available,
        is_featured,
        is_popular,
        limit: 20,
        page,
        search,
        status
      });
      rows = response.data.items as Tour[];
      pagination = response.data.pagination;
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : 'Unable to load tours.';
    } finally {
      loading = false;
    }
  };

  const applyFilters = async () => {
    page = 1;
    clearSelection();
    await loadTours();
  };

  const goToPage = async (nextPage: number) => {
    page = nextPage;
    clearSelection();
    await loadTours();
  };

  // ── bulk selection ────────────────────────────────────────────────────────
  // Selection is keyed by id and survives filtering, but is cleared whenever the
  // visible set changes so the count can never describe rows you cannot see.
  let selectedIds = new Set<string>();
  let bulkConfirmOpen = false;
  let bulkDeleting = false;

  $: visibleIds = rows.map((tour) => tour.id);
  $: selectedCount = selectedIds.size;
  $: allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  $: someVisibleSelected = visibleIds.some((id) => selectedIds.has(id)) && !allVisibleSelected;

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    selectedIds = next;
  };

  const toggleAllVisible = () => {
    const next = new Set(selectedIds);
    if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
    else visibleIds.forEach((id) => next.add(id));
    selectedIds = next;
  };

  const clearSelection = () => (selectedIds = new Set<string>());

  // "Select all" on the header checkbox only reaches the current page, which is
  // misleading when the list is paginated — so once the page is fully selected we
  // offer to pull every id matching the active filters.
  let selectingAll = false;
  const selectAllMatching = async () => {
    selectingAll = true;
    try {
      const response = await api.tours.list({
        category_id,
        destination_id,
        is_available,
        is_featured,
        is_popular,
        limit: 500,
        page: 1,
        search,
        status
      });
      selectedIds = new Set((response.data.items as Tour[]).map((tour) => tour.id));
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to select all tours.', 'error');
    } finally {
      selectingAll = false;
    }
  };

  const bulkDelete = async () => {
    if (!selectedIds.size) return;
    bulkDeleting = true;

    try {
      const response = await api.tours.bulkRemove([...selectedIds]);
      const deleted = response.data?.deleted ?? selectedIds.size;
      showToast(`Deleted ${deleted} tour${deleted === 1 ? '' : 's'}.`);
      bulkConfirmOpen = false;
      clearSelection();
      await loadTours();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to delete the selected tours.', 'error');
    } finally {
      bulkDeleting = false;
    }
  };

  const openDeleteConfirm = (tour: Tour) => {
    tourToDelete = tour;
    confirmOpen = true;
  };

  const deleteTour = async () => {
    if (!tourToDelete) return;
    deleting = true;

    try {
      await api.tours.remove(tourToDelete.id);
      showToast('Tour deleted successfully.');
      confirmOpen = false;
      tourToDelete = null;
      await loadTours();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to delete tour.', 'error');
    } finally {
      deleting = false;
    }
  };

  onMount(async () => {
    await loadFilters();
    await loadTours();
  });
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full min-w-0 max-w-[1500px] gap-6 overflow-x-hidden">
  <AdminPageHeader
    eyebrow="Tour Management"
    title="Tours"
    description="Manage tour packages, publishing status, AI matching data, pricing, image assets, and SEO metadata."
    actionLabel="New Tour"
    actionIcon={Plus}
    secondaryLabel="Import CSV"
    on:action={() => goto('/admin/tours/new')}
    on:secondary={() => goto('/admin/tours/import')}
  />

  <AdminToolbar className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(220px,1fr)_150px_minmax(160px,190px)_minmax(150px,170px)_130px_130px_130px_auto] 2xl:items-end">
    <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
      <span>Search</span>
      <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
        <Search size={16} class="text-ink/45" />
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Search tours..." onkeydown={(event) => event.key === 'Enter' && applyFilters()} />
      </span>
    </CmsLabel>

    <AdminSelect label="Status" name="status_filter" bind:value={status} options={statusOptions} />
    <AdminSelect label="Destination" name="destination_filter" bind:value={destination_id} options={destinationOptions} />
    <AdminSelect label="Category" name="category_filter" bind:value={category_id} options={categoryOptions} />
    <AdminSelect label="Available" name="available_filter" bind:value={is_available} options={booleanOptions} />
    <AdminSelect label="Featured" name="featured_filter" bind:value={is_featured} options={booleanOptions} />
    <AdminSelect label="Popular" name="popular_filter" bind:value={is_popular} options={booleanOptions} />
    <AdminButton variant="secondary" on:click={applyFilters}>Apply</AdminButton>
  </AdminToolbar>

  {#if loading}
    <LoadingState message="Loading tours..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if rows.length === 0}
    <AdminEmptyState
      title="No tours found"
      message="Create your first Key2africa tour package with CMS publishing controls, images, AI matching fields, and SEO metadata."
      actionLabel="Create tour"
      on:action={() => goto('/admin/tours/new')}
    />
  {:else}
    {#if selectedCount}
      <div class="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-goldfinch-gold/40 bg-goldfinch-gold/10 px-4 py-3">
        <p class="text-sm font-bold text-heading" aria-live="polite">
          {selectedCount} tour{selectedCount === 1 ? '' : 's'} selected
        </p>
        {#if allVisibleSelected && pagination && pagination.total > selectedCount}
          <CmsButton variant="ghost"
            class="text-xs font-bold text-forest underline-offset-2 transition hover:underline disabled:opacity-60"
            type="button"
            disabled={selectingAll}
            onclick={selectAllMatching}
          >
            {selectingAll ? 'Selecting…' : `Select all ${pagination.total} matching`}
          </CmsButton>
        {/if}
        <CmsButton variant="ghost"
          class="text-xs font-semibold text-ink/60 underline-offset-2 transition hover:text-ink hover:underline"
          type="button"
          onclick={clearSelection}
        >
          Clear selection
        </CmsButton>
        <CmsButton variant="ghost"
          class="ml-auto inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3.5 text-xs font-bold text-red-700 shadow-sm transition hover:bg-red-50 disabled:opacity-60"
          type="button"
          disabled={bulkDeleting}
          onclick={() => (bulkConfirmOpen = true)}
        >
          <Trash2 size={14} />
          {bulkDeleting ? 'Deleting…' : `Delete ${selectedCount}`}
        </CmsButton>
      </div>
    {/if}

    <div class="min-w-0 max-w-full overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm">
      <div class="max-w-full overflow-x-auto overscroll-x-contain" data-lenis-prevent>
        <CmsTable.Root class="w-full min-w-[1180px] text-start text-sm">
          <CmsTable.Header class="bg-sand/70 text-xs uppercase tracking-[0.08em] text-ink/60">
            <CmsTable.Row>
              <CmsTable.Head class="w-10 px-4 py-3">
                <CmsCheckbox
                  class="h-4 w-4 cursor-pointer accent-forest"
                  
                  aria-label={allVisibleSelected ? 'Deselect all tours on this page' : 'Select all tours on this page'}
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected}
                  onCheckedChange={toggleAllVisible}
                />
              </CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Tour</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Destination</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Category</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Status</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Flags</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Duration</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Price</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Updated</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-right font-semibold">Actions</CmsTable.Head>
            </CmsTable.Row>
          </CmsTable.Header>
          <CmsTable.Body class="divide-y divide-ink/10">
            {#each rows as tour}
              <CmsTable.Row class={`transition hover:bg-sand/25 ${selectedIds.has(tour.id) ? 'bg-goldfinch-gold/10' : ''}`}>
                <CmsTable.Cell class="px-4 py-4">
                  <CmsCheckbox
                    class="h-4 w-4 cursor-pointer accent-forest"
                    
                    aria-label={`Select ${tour.title}`}
                    checked={selectedIds.has(tour.id)}
                    onCheckedChange={() => toggleOne(tour.id)}
                  />
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4">
                  <div class="font-semibold text-ink">{tour.title}</div>
                  <p class="mt-1 line-clamp-1 text-xs text-ink/55">{tour.short_description || tour.slug}</p>
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/65">{getTourDestinationLabel(tour as unknown as PublicTour, 2) || relationText(tour.destinations, 'name')}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/65">{relationText(tour.tour_categories, 'name')}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4"><StatusBadge status={tour.status} /></CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4">
                  <div class="flex flex-wrap gap-1.5">
                    <span class={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${tour.is_available ? 'bg-forest/10 text-forest ring-forest/20' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                      {tour.is_available ? 'Available' : 'Unavailable'}
                    </span>
                    {#if tour.is_featured}
                      <span class="inline-flex rounded-full bg-goldfinch-gold/15 px-2.5 py-1 text-xs font-bold text-heading ring-1 ring-goldfinch-gold/25">Featured</span>
                    {/if}
                    {#if tour.is_popular}
                      <span class="inline-flex rounded-full bg-sand px-2.5 py-1 text-xs font-bold text-ink ring-1 ring-ink/10">Popular</span>
                    {/if}
                  </div>
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/65">{tour.duration_days ?? '-'}d / {tour.duration_nights ?? 0}n</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 font-semibold text-ink">{formatPrice(tour)}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/65">{formatDate(tour.updated_at ?? tour.created_at)}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4">
                  <div class="flex justify-end gap-2">
                    <a class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" href={`/admin/tours/${tour.id}/edit`}>
                      <Edit size={14} />
                      Edit
                    </a>
                    <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDeleteConfirm(tour)}>
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
      <p>Page {pagination.page} of {pagination.totalPages} · {pagination.total} tours</p>
      <div class="flex gap-2">
        <AdminButton variant="secondary" size="sm" disabled={page <= 1} on:click={() => goToPage(page - 1)}>Previous</AdminButton>
        <AdminButton variant="secondary" size="sm" disabled={page >= pagination.totalPages} on:click={() => goToPage(page + 1)}>Next</AdminButton>
      </div>
    </div>
  {/if}
</div>

<ConfirmModal
  open={bulkConfirmOpen}
  title={`Delete ${selectedCount} tour${selectedCount === 1 ? '' : 's'}`}
  message={`Delete ${selectedCount} selected tour${selectedCount === 1 ? '' : 's'}? They are soft deleted and can be restored in the database.`}
  on:cancel={() => (bulkConfirmOpen = false)}
  on:confirm={bulkDelete}
/>

<ConfirmModal
  open={confirmOpen}
  title="Delete tour"
  message={`Delete "${tourToDelete?.title ?? 'this tour'}"? This will soft delete it when supported by the database.`}
  on:cancel={() => {
    confirmOpen = false;
    tourToDelete = null;
  }}
  on:confirm={deleteTour}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting tour...
  </div>
{/if}
