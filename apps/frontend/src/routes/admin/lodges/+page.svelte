<script lang="ts">
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import * as CmsTable from '$lib/components/ui/table';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  import { onMount } from 'svelte';
  import { Edit, Hotel, MapPin, Plus, Search, Star, Trash2 } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminAccommodationEditor from '$lib/admin/components/admin/AdminAccommodationEditor.svelte';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import StyleBadge from '$lib/admin/components/admin/accommodation/StyleBadge.svelte';
  import { LODGE_STATUSES, propertyTypeLabel } from '$lib/admin/components/admin/accommodation/property';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';
  import type { Lodge } from '$lib/admin/types';
  import { lodgeLevelLabel, lodgeLevelsForStyle, styleForLodgeLevel } from '$lib/lodge-levels';
  import { formatPrice, type SafariStyle } from '$lib/safari-pricing';

  type LodgeRow = Lodge & { created_at?: string; updated_at?: string };
  type DestinationOption = { id: string; name: string; status?: string | null };
  type Toast = { id: string; message: string; type: 'error' | 'success' };

  // Levels filter by the safari style they serve, so Luxury covers both luxury levels.
  const levelOptions = [
    { label: 'All levels', value: 'all' },
    { label: 'Budget', value: 'budget' },
    { label: 'Midrange', value: 'midrange' },
    { label: 'Luxury', value: 'luxury' }
  ];

  let rows: LodgeRow[] = [];
  let total = 0;
  let destinations: DestinationOption[] = [];
  let loading = true;
  let deleting = false;
  let opening = false;
  let error = '';
  let search = '';
  let statusFilter = 'all';
  let levelFilter = 'all';
  let editorOpen = false;
  let confirmOpen = false;
  let editing: LodgeRow | null = null;
  let toDelete: LodgeRow | null = null;
  let toasts: Toast[] = [];
  let selectedIds = new Set<string>();
  let bulkConfirmOpen = false;
  let bulkBusy = false;

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => (toasts = toasts.filter((t) => t.id !== id)), 3500);
  };
  const dismissToast = (e: CustomEvent<string>) => (toasts = toasts.filter((t) => t.id !== e.detail));

  const loadDestinations = async () => {
    try {
      const res = await api.destinations.list({ status: 'all', limit: 100 });
      destinations = (res.data.items as unknown as DestinationOption[]).sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      destinations = [];
    }
  };

  const newestFirst = (a: LodgeRow, b: LodgeRow) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));

  const load = async () => {
    loading = true;
    error = '';
    try {
      // The API filters one level at a time; Luxury needs LUXURY and PREMIUM_LUXURY.
      const levels = levelFilter === 'all' ? [undefined] : lodgeLevelsForStyle(levelFilter as SafariStyle);
      const pages = await Promise.all(
        levels.map((level) => api.lodges.list({ search, status: statusFilter, accommodation_level: level, limit: 100 }))
      );
      rows = pages.flatMap((page) => page.data.items as LodgeRow[]).sort(newestFirst);
      total = pages.reduce((sum, page) => sum + (page.data.pagination?.total ?? 0), 0);
      // Bulk actions only ever act on rows the operator can see.
      const visible = new Set(rows.map((row) => row.id));
      selectedIds = new Set([...selectedIds].filter((id) => visible.has(id)));
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load lodges.';
    } finally {
      loading = false;
    }
  };

  // ── Open the editor ───────────────────────────────────────────────────────
  const openCreate = () => {
    editing = null;
    editorOpen = true;
  };

  // The editor saves every field it shows, so it must start from a full record.
  const FULL_RECORD_KEYS = ['description', 'why_we_recommend', 'short_description', 'seo_title'];
  const isFullRecord = (row: LodgeRow | undefined): row is LodgeRow => Boolean(row) && FULL_RECORD_KEYS.every((key) => key in row!);

  const openEdit = async (slug: string, row?: LodgeRow) => {
    if (opening) return;
    opening = true;
    try {
      let full: LodgeRow | null = null;
      try {
        const res = await api.lodges.get(slug);
        full = { ...(row ?? {}), ...(res.data as LodgeRow) };
      } catch {
        // The single-record lookup 404s while "Show on website" is off; the
        // list row is a `*` projection, so it is complete enough to edit.
        const fallback = row ?? rows.find((item) => item.slug === slug);
        if (isFullRecord(fallback)) full = fallback;
      }
      if (!full) {
        showToast('Unable to open this property. Find it in the list below.', 'error');
        return;
      }
      editing = full;
      editorOpen = true;
    } finally {
      opening = false;
    }
  };

  const closeEditor = () => {
    editorOpen = false;
    editing = null;
  };

  const onSaved = (event: CustomEvent<{ close: boolean; message: string }>) => {
    void load();
    if (!event.detail.close) return;
    closeEditor();
    showToast(event.detail.message);
  };

  // ── Bulk selection ────────────────────────────────────────────────────────
  $: visibleIds = rows.map((l) => l.id);
  $: selectedCount = selectedIds.size;
  $: allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  $: someVisibleSelected = visibleIds.some((id) => selectedIds.has(id)) && !allVisibleSelected;

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
  };
  const toggleAllVisible = () => {
    const next = new Set(selectedIds);
    if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
    else visibleIds.forEach((id) => next.add(id));
    selectedIds = next;
  };
  const clearSelection = () => (selectedIds = new Set<string>());

  const bulkSetStatus = async (status: string) => {
    if (!selectedIds.size) return;
    bulkBusy = true;
    try {
      const res = await api.lodges.bulkStatus([...selectedIds], status);
      const n = res.data?.updated ?? selectedIds.size;
      showToast(`${n} propert${n === 1 ? 'y' : 'ies'} set to ${status}.`);
      clearSelection();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update the selected properties.', 'error');
    } finally {
      bulkBusy = false;
    }
  };

  const bulkDelete = async () => {
    if (!selectedIds.size) return;
    bulkBusy = true;
    try {
      const res = await api.lodges.bulkRemove([...selectedIds]);
      const n = res.data?.deleted ?? selectedIds.size;
      showToast(`Deleted ${n} propert${n === 1 ? 'y' : 'ies'}.`);
      bulkConfirmOpen = false;
      clearSelection();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete the selected properties.', 'error');
    } finally {
      bulkBusy = false;
    }
  };

  const openDelete = (l: LodgeRow) => {
    toDelete = l;
    confirmOpen = true;
  };
  const confirmDelete = async () => {
    if (!toDelete) return;
    deleting = true;
    try {
      await api.lodges.remove(toDelete.id);
      showToast('Property deleted.');
      confirmOpen = false;
      toDelete = null;
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete the property.', 'error');
    } finally {
      deleting = false;
    }
  };

  // ── List helpers ──────────────────────────────────────────────────────────
  const fmt = (v?: string) => (v ? new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(v)) : '—');
  const price = (l: LodgeRow) => (l.price_per_night_from != null ? `${formatPrice(Number(l.price_per_night_from), l.currency || 'USD')}/night` : '—');

  onMount(() => {
    void load();
    void loadDestinations();
    const editSlug = new URLSearchParams(window.location.search).get('edit');
    if (editSlug) void openEdit(editSlug);
  });
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
  <AdminPageHeader
    eyebrow="Tour Management"
    title="Lodges & Camps"
    description="Where travellers stay. Each property's comfort level matches a safari style, so tours can offer it as that style's overnight."
    actionLabel="New Property"
    actionIcon={Plus}
    on:action={openCreate}
  />

  <AdminToolbar className="grid gap-3 md:grid-cols-[1fr_170px_170px_auto] md:items-end">
    <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
      <span>Search</span>
      <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
        <Search size={16} class="text-ink/45" />
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Search lodges and camps..." onkeydown={(e) => e.key === 'Enter' && load()} />
      </span>
    </CmsLabel>
    <AdminSelect label="Level" name="level_filter" bind:value={levelFilter} options={levelOptions} />
    <AdminSelect label="Status" name="status_filter" bind:value={statusFilter} options={[{ label: 'All statuses', value: 'all' }, ...LODGE_STATUSES]} />
    <AdminButton variant="secondary" on:click={load}>Apply</AdminButton>
  </AdminToolbar>

  {#if loading}
    <LoadingState message="Loading lodges and camps..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if rows.length === 0}
    <AdminEmptyState
      title={search || statusFilter !== 'all' || levelFilter !== 'all' ? 'No properties match' : 'No lodges yet'}
      message={search || statusFilter !== 'all' || levelFilter !== 'all' ? 'Try another search, level or status.' : 'Add the lodges and camps your tours stay at, then pick them as overnights in each tour’s itinerary.'}
      actionLabel="New Property"
      icon={Hotel}
      on:action={openCreate}
    />
  {:else}
    {#if selectedCount}
      <div class="flex flex-wrap items-center gap-3 rounded-xl border border-goldfinch-gold/40 bg-goldfinch-gold/10 px-4 py-3">
        <p class="text-sm font-bold text-heading" aria-live="polite">
          {selectedCount} propert{selectedCount === 1 ? 'y' : 'ies'} selected
        </p>
        <CmsButton variant="ghost" class="text-xs font-semibold text-ink/60 underline-offset-2 transition hover:text-ink hover:underline" type="button" onclick={clearSelection}>
          Clear selection
        </CmsButton>

        <div class="flex w-full flex-wrap items-center gap-2 md:ml-auto md:w-auto">
          <span class="text-xs font-bold uppercase tracking-[0.12em] text-ink/45">Set status</span>
          {#each LODGE_STATUSES as option (option.value)}
            <CmsButton variant="ghost"
              class="inline-flex h-9 items-center rounded-xl border border-ink/12 bg-surface px-3 text-xs font-bold text-ink transition hover:border-goldfinch-gold/50 hover:bg-sand/60 disabled:opacity-60"
              type="button"
              disabled={bulkBusy}
              onclick={() => bulkSetStatus(option.value)}
            >
              {option.label}
            </CmsButton>
          {/each}
          <CmsButton variant="ghost"
            class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3.5 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
            type="button"
            disabled={bulkBusy}
            onclick={() => (bulkConfirmOpen = true)}
          >
            <Trash2 size={14} />
            Delete {selectedCount}
          </CmsButton>
        </div>
      </div>
    {/if}

    {#if total > rows.length}
      <p class="-mt-3 text-xs text-ink/50">Showing the newest {rows.length} of {total}. Search or filter to find the rest.</p>
    {/if}

    <!-- Phones: one card per property, no sideways scrolling. -->
    <div class="grid gap-3 md:hidden">
      <CmsLabel class="flex items-center gap-2 px-1 text-xs font-semibold text-ink/60">
        <CmsCheckbox class="h-4 w-4" checked={allVisibleSelected} indeterminate={someVisibleSelected} onCheckedChange={toggleAllVisible} />
        Select all
      </CmsLabel>
      {#each rows as l (l.id)}
        {@const style = styleForLodgeLevel(l.accommodation_level)}
        <article class={`rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ${selectedIds.has(l.id) ? 'ring-2 ring-goldfinch-gold/40' : ''}`}>
          <div class="flex items-start gap-3">
            <CmsCheckbox class="mt-1 h-4 w-4 shrink-0" aria-label={`Select ${l.name}`} checked={selectedIds.has(l.id)} onCheckedChange={() => toggleOne(l.id)} />
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="flex items-center gap-1.5 break-words font-semibold text-ink">{#if l.is_featured}<Star size={13} class="shrink-0 fill-goldfinch-gold text-goldfinch-gold" />{/if}{l.name}</h3>
                  <p class="mt-0.5 truncate text-xs text-ink/50">{propertyTypeLabel(l.lodge_type)}</p>
                </div>
                <StatusBadge status={l.status ?? 'draft'} />
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink/60">
                <StyleBadge {style} label={lodgeLevelLabel(l.accommodation_level)} />
                <span class="inline-flex min-w-0 items-center gap-1"><MapPin size={12} class="shrink-0" /><span class="truncate">{l.destinations?.name ?? 'No destination'}</span></span>
                <span>{price(l)}</span>
              </div>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span class="text-[11px] text-ink/45">Updated {fmt(l.updated_at ?? l.created_at)}</span>
            <div class="flex gap-2">
              <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm" type="button" disabled={opening} onclick={() => openEdit(l.slug, l)}><Edit size={14} />Edit</CmsButton>
              <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm" type="button" aria-label={`Delete ${l.name}`} onclick={() => openDelete(l)}><Trash2 size={14} /></CmsButton>
            </div>
          </div>
        </article>
      {/each}
    </div>

    <div class="hidden overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm md:block">
      <div class="overflow-x-auto">
        <CmsTable.Root class="w-full text-start text-sm">
          <CmsTable.Header class="bg-sand/70 text-xs uppercase tracking-[0.08em] text-ink/60">
            <CmsTable.Row>
              <CmsTable.Head class="w-10 px-4 py-3">
                <CmsCheckbox
                  class="h-4 w-4 cursor-pointer"
                  aria-label={allVisibleSelected ? 'Deselect all properties' : 'Select all properties'}
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected}
                  onCheckedChange={toggleAllVisible}
                />
              </CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Property</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Destination</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Level</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">From</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Status</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 font-semibold">Updated</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-right font-semibold">Actions</CmsTable.Head>
            </CmsTable.Row>
          </CmsTable.Header>
          <CmsTable.Body class="divide-y divide-ink/10">
            {#each rows as l (l.id)}
              <CmsTable.Row class={`transition hover:bg-sand/25 ${selectedIds.has(l.id) ? 'bg-goldfinch-gold/10' : ''}`}>
                <CmsTable.Cell class="px-4 py-4">
                  <CmsCheckbox class="h-4 w-4 cursor-pointer" aria-label={`Select ${l.name}`} checked={selectedIds.has(l.id)} onCheckedChange={() => toggleOne(l.id)} />
                </CmsTable.Cell>
                <CmsTable.Cell class="w-[34%] max-w-0 px-4 py-4">
                  <div class="flex items-center gap-2 font-semibold text-ink">{#if l.is_featured}<Star size={13} class="shrink-0 fill-goldfinch-gold text-goldfinch-gold" />{/if}<span class="truncate">{l.name}</span></div>
                  <p class="mt-1 truncate text-xs text-ink/55">{propertyTypeLabel(l.lodge_type)}{l.park_area ? ` · ${l.park_area}` : ''}</p>
                </CmsTable.Cell>
                <CmsTable.Cell class="max-w-0 truncate px-4 py-4 text-ink/65">{l.destinations?.name ?? '—'}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4"><StyleBadge style={styleForLodgeLevel(l.accommodation_level)} label={lodgeLevelLabel(l.accommodation_level)} /></CmsTable.Cell>
                <CmsTable.Cell class="whitespace-nowrap px-4 py-4 text-ink/65">{price(l)}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4"><StatusBadge status={l.status ?? 'draft'} /></CmsTable.Cell>
                <CmsTable.Cell class="whitespace-nowrap px-4 py-4 text-ink/65">{fmt(l.updated_at ?? l.created_at)}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4">
                  <div class="flex justify-end gap-2">
                    <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" disabled={opening} onclick={() => openEdit(l.slug, l)}>
                      <Edit size={14} />Edit
                    </CmsButton>
                    <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDelete(l)}>
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

{#if editorOpen}
  <AdminAccommodationEditor
    {editing}
    {destinations}
    on:close={closeEditor}
    on:saved={onSaved}
    on:toast={(event) => showToast(event.detail.message, event.detail.type)}
  />
{/if}

<ConfirmModal
  open={bulkConfirmOpen}
  title={`Delete ${selectedCount} propert${selectedCount === 1 ? 'y' : 'ies'}`}
  message={`Delete ${selectedCount} selected propert${selectedCount === 1 ? 'y' : 'ies'}? They are soft deleted and can be restored in the database.`}
  on:cancel={() => (bulkConfirmOpen = false)}
  on:confirm={bulkDelete}
/>

<ConfirmModal
  open={confirmOpen}
  title="Delete property"
  message={`Delete "${toDelete?.name ?? 'this property'}"? This soft-deletes the record.`}
  on:cancel={() => { confirmOpen = false; toDelete = null; }}
  on:confirm={confirmDelete}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting property...
  </div>
{/if}
