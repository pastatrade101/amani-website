<script lang="ts">
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import * as CmsTable from '$lib/components/ui/table';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Edit, ExternalLink, MapPin, Plus, Route, Search, Star, Trash2 } from '@lucide/svelte';
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
  import { getTourDestinations } from '$lib/admin/tourDestinations';
  import type { Pagination, Tour } from '$lib/admin/types';
  import { SAFARI_STYLES, SAFARI_STYLE_THEME, formatPrice } from '$lib/safari-pricing';

  type Option = {
    label: string;
    value: string;
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

  const formatDate = (value?: string) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  };

  /** "Serengeti +2": the primary destination and how many more the route visits. */
  const routeLabel = (tour: Tour) => {
    const places = getTourDestinations(tour);
    if (!places.length) return 'No destination';
    return places.length > 1 ? `${places[0].name} +${places.length - 1}` : places[0].name;
  };
  const routeTitle = (tour: Tour) => getTourDestinations(tour).map((place) => place.name).join(' → ');

  const dayCount = (tour: Tour) => Number(tour.itinerary_day_count ?? tour.itinerary_days?.length ?? 0);
  const tripDays = (tour: Tour) => Number(tour.duration_days ?? 0);
  /** Itinerary days that do not match the trip length are worth a second look. */
  const itineraryOff = (tour: Tour) => dayCount(tour) !== tripDays(tour);

  const priceStyles = (tour: Tour) => SAFARI_STYLES.filter((style) => tour.pricing_summary?.styles?.includes(style.id));
  const priceFrom = (tour: Tour) => {
    const summary = tour.pricing_summary;
    return summary?.from != null ? `from ${formatPrice(Number(summary.from), summary.currency || tour.currency || 'USD')}` : '';
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
    description="Safari packages with their day-by-day itinerary, overnights per safari style, prices, photos and publishing status."
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
      message="Create your first Key2africa safari: its itinerary, where travellers sleep in each safari style, prices, photos and SEO."
      actionLabel="Create tour"
      on:action={() => goto('/admin/tours/new')}
    />
  {:else}
    {#if selectedCount}
      <div class="flex flex-wrap items-center gap-3 rounded-xl border border-goldfinch-gold/40 bg-goldfinch-gold/10 px-4 py-3">
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

    <!-- Phones: one card per tour, no sideways scrolling. -->
    <div class="grid gap-3 md:hidden">
      <label class="flex items-center gap-2 px-1 text-xs font-semibold text-ink/60">
        <CmsCheckbox class="h-4 w-4 cursor-pointer accent-forest" checked={allVisibleSelected} indeterminate={someVisibleSelected} onCheckedChange={toggleAllVisible} />
        Select all on this page
      </label>
      {#each rows as tour (tour.id)}
        <article class={`rounded-xl border bg-surface p-4 shadow-sm ${selectedIds.has(tour.id) ? 'border-goldfinch-gold/50 bg-goldfinch-gold/5' : 'border-ink/10'}`}>
          <div class="flex items-start gap-3">
            <CmsCheckbox class="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-forest" aria-label={`Select ${tour.title}`} checked={selectedIds.has(tour.id)} onCheckedChange={() => toggleOne(tour.id)} />
            <div class="min-w-0 flex-1">
              <h3 class="flex items-start gap-1.5 break-words font-semibold text-ink">
                {#if tour.is_featured}<Star size={13} class="mt-1 shrink-0 fill-goldfinch-gold text-goldfinch-gold" />{/if}{tour.title}
              </h3>
              <p class="mt-0.5 truncate text-xs text-ink/50">/{tour.slug}</p>
            </div>
            <StatusBadge status={tour.status || 'draft'} />
          </div>
          <p class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/60">
            <span>{tripDays(tour)} {tripDays(tour) === 1 ? 'day' : 'days'}</span>
            <span class="inline-flex min-w-0 items-center gap-1"><MapPin size={12} class="shrink-0" /><span class="truncate">{routeLabel(tour)}</span></span>
            <span class={`inline-flex items-center gap-1 ${itineraryOff(tour) ? 'font-semibold text-amber-700' : ''}`}><Route size={12} />{dayCount(tour)}/{tripDays(tour)} days planned</span>
          </p>
          <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink/60">
            {#if priceStyles(tour).length}
              <span class="inline-flex items-center gap-1">
                {#each priceStyles(tour) as style (style.id)}<span class="size-2.5 rounded-full" style={`background:${SAFARI_STYLE_THEME[style.id].primary}`} title={style.title}></span>{/each}
              </span>
              <span>{priceFrom(tour) || 'Prices on request'}</span>
            {:else}
              <span>On request</span>
            {/if}
          </div>
          <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span class="text-[11px] text-ink/45">Updated {formatDate(tour.updated_at ?? tour.created_at)}</span>
            <div class="flex gap-2">
              <a class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm" href={`/admin/tours/${tour.id}/edit`}><Edit size={14} />Edit</a>
              {#if tour.status === 'published'}
                <a class="inline-flex h-9 items-center rounded-xl border border-ink/10 bg-surface px-3 text-ink/70 shadow-sm" href={`/tours/${tour.slug}`} target="_blank" rel="noopener" aria-label={`View ${tour.title} on the site`}><ExternalLink size={14} /></a>
              {/if}
              <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm" type="button" aria-label={`Delete ${tour.title}`} onclick={() => openDeleteConfirm(tour)}><Trash2 size={14} /></CmsButton>
            </div>
          </div>
        </article>
      {/each}
    </div>

    <div class="hidden min-w-0 max-w-full overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm md:block">
      <div class="max-w-full overflow-x-auto overscroll-x-contain" data-lenis-prevent>
        <CmsTable.Root class="w-full min-w-[900px] text-start text-sm">
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
              <CmsTable.Head class="px-4 py-3 font-semibold">Days</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Route</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Itinerary</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Prices</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Status</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Updated</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-right font-semibold">Actions</CmsTable.Head>
            </CmsTable.Row>
          </CmsTable.Header>
          <CmsTable.Body class="divide-y divide-ink/10">
            {#each rows as tour (tour.id)}
              <CmsTable.Row class={`transition hover:bg-sand/25 ${selectedIds.has(tour.id) ? 'bg-goldfinch-gold/10' : ''}`}>
                <CmsTable.Cell class="px-4 py-4">
                  <CmsCheckbox
                    class="h-4 w-4 cursor-pointer accent-forest"
                    aria-label={`Select ${tour.title}`}
                    checked={selectedIds.has(tour.id)}
                    onCheckedChange={() => toggleOne(tour.id)}
                  />
                </CmsTable.Cell>
                <CmsTable.Cell class="w-[34%] max-w-0 px-4 py-4">
                  <div class="flex items-center gap-2 font-semibold text-ink">{#if tour.is_featured}<Star size={13} class="shrink-0 fill-goldfinch-gold text-goldfinch-gold" />{/if}<span class="truncate" title={tour.title}>{tour.title}</span></div>
                  <p class="mt-1 truncate text-xs text-ink/55">/{tour.slug}</p>
                </CmsTable.Cell>
                <CmsTable.Cell class="whitespace-nowrap px-4 py-4 text-ink/65">{tripDays(tour)}d / {tour.duration_nights ?? Math.max(0, tripDays(tour) - 1)}n</CmsTable.Cell>
                <CmsTable.Cell class="max-w-[180px] truncate px-4 py-4 text-ink/65" title={routeTitle(tour)}>{routeLabel(tour)}</CmsTable.Cell>
                <CmsTable.Cell class={`whitespace-nowrap px-4 py-4 ${itineraryOff(tour) ? 'font-semibold text-amber-700' : 'text-ink/65'}`} title={itineraryOff(tour) ? 'The planned days do not match the trip length' : undefined}>
                  {dayCount(tour)} / {tripDays(tour)}
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4">
                  {#if priceStyles(tour).length}
                    <div class="flex items-center gap-1" aria-label={`Prices for ${priceStyles(tour).map((style) => style.title).join(', ')}`}>
                      {#each priceStyles(tour) as style (style.id)}<span class="size-2.5 rounded-full" style={`background:${SAFARI_STYLE_THEME[style.id].primary}`} title={style.title}></span>{/each}
                    </div>
                    {#if priceFrom(tour)}<p class="mt-1 whitespace-nowrap text-xs text-ink/55">{priceFrom(tour)}</p>{/if}
                  {:else}
                    <span class="text-xs text-ink/50">On request</span>
                  {/if}
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4"><StatusBadge status={tour.status || 'draft'} /></CmsTable.Cell>
                <CmsTable.Cell class="whitespace-nowrap px-4 py-4 text-ink/65">{formatDate(tour.updated_at ?? tour.created_at)}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4">
                  <div class="flex justify-end gap-2">
                    <a class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" href={`/admin/tours/${tour.id}/edit`}>
                      <Edit size={14} />
                      Edit
                    </a>
                    {#if tour.status === 'published'}
                      <a class="inline-flex h-9 items-center rounded-xl border border-ink/10 bg-surface px-3 text-ink/70 shadow-sm transition hover:bg-sand/70" href={`/tours/${tour.slug}`} target="_blank" rel="noopener" aria-label={`View ${tour.title} on the site`} title="View on site"><ExternalLink size={14} /></a>
                    {/if}
                    <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" aria-label={`Delete ${tour.title}`} title="Delete" onclick={() => openDeleteConfirm(tour)}>
                      <Trash2 size={14} />
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
