<script lang="ts">
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import * as CmsTable from '$lib/components/ui/table';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  import { onMount } from 'svelte';
  import { Edit, Hotel, Plus, Search, Trash2 } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import AdminLodgeMedia from '$lib/admin/components/admin/AdminLodgeMedia.svelte';
  import AdminAccommodationEditor from '$lib/admin/components/admin/AdminAccommodationEditor.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminRichText from '$lib/admin/components/admin/AdminRichText.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';

  type Lodge = {
    id: string;
    name: string;
    slug: string;
    destination_id?: string | null;
    destinations?: { name: string; slug: string } | null;
    accommodation_level: 'BUDGET' | 'MID_RANGE' | 'LUXURY' | 'PREMIUM_LUXURY';
    lodge_type: 'HOTEL'|'SAFARI_LODGE'|'TENTED_CAMP'|'MOBILE_CAMP'|'BEACH_RESORT'|'VILLA'|'GUEST_HOUSE'|'ECO_LODGE'|'BOUTIQUE_HOTEL';
    description?: string | null;
    why_we_recommend?: string | null;
    hero_image_url?: string | null;
    image_url?: string | null;
    price_per_night_from?: number | null;
    currency?: string | null;
    best_for?: string[] | null;
    romantic_rating?: number | null;
    family_rating?: number | null;
    website_url?: string | null;
    status: 'archived' | 'draft' | 'hidden' | 'published';
    is_featured?: boolean;
    seo_title?: string | null;
    meta_description?: string | null;
    created_at?: string;
    updated_at?: string;
  };

  type Toast = { id: string; message: string; type: 'error' | 'success' };

  const statusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Hidden', value: 'hidden' },
    { label: 'Archived', value: 'archived' }
  ];
  const levelOptions = [
    { label: 'Budget', value: 'BUDGET' }, { label: 'Mid-range', value: 'MID_RANGE' }, { label: 'Luxury', value: 'LUXURY' }, { label: 'Premium luxury', value: 'PREMIUM_LUXURY' },
    { label: 'Budget', value: 'budget' },
    { label: 'Mid-range', value: 'mid_range' },
    { label: 'Luxury', value: 'luxury' },
    { label: 'Ultra-luxury', value: 'ultra_luxury' }
  ];
  const typeOptions = [
    { label: 'Hotel', value: 'HOTEL' }, { label: 'Safari lodge', value: 'SAFARI_LODGE' }, { label: 'Tented camp', value: 'TENTED_CAMP' }, { label: 'Mobile camp', value: 'MOBILE_CAMP' }, { label: 'Beach resort', value: 'BEACH_RESORT' }, { label: 'Villa', value: 'VILLA' }, { label: 'Guest house', value: 'GUEST_HOUSE' }, { label: 'Eco lodge', value: 'ECO_LODGE' }, { label: 'Boutique hotel', value: 'BOUTIQUE_HOTEL' },
    { label: 'Tented camp', value: 'tented_camp' },
    { label: 'Lodge', value: 'lodge' },
    { label: 'Hotel', value: 'hotel' },
    { label: 'Mobile camp', value: 'mobile_camp' },
    { label: 'Treehouse', value: 'treehouse' }
  ];
  const levelLabel = (v: string) => levelOptions.find((o) => o.value === v)?.label ?? v;
  const typeLabel = (v: string) => typeOptions.find((o) => o.value === v)?.label ?? v;

  const emptyForm = () => ({
    name: '',
    slug: '',
    destination_id: '',
    accommodation_level: 'MID_RANGE' as Lodge['accommodation_level'],
    lodge_type: 'SAFARI_LODGE' as Lodge['lodge_type'],
    description: '',
    why_we_recommend: '',
    hero_image_url: '',
    image_url: '',
    price_per_night_from: '',
    currency: 'USD',
    best_for: '',
    romantic_rating: '',
    family_rating: '',
    website_url: '',
    status: 'draft' as Lodge['status'],
    is_featured: false,
    seo_title: '',
    meta_description: ''
  });

  let rows: Lodge[] = [];
  let destinationOptions: { label: string; value: string }[] = [{ label: 'No destination', value: '' }];
  let loading = true;
  let saving = false;
  let deleting = false;
  let error = '';
  let search = '';
  let statusFilter = 'all';
  let modalOpen = false;
  let confirmOpen = false;
  let slugManuallyEdited = false;
  let editing: Lodge | null = null;
  // Gallery + amenities live in their own component but save through here, so a
  // brand-new property has an id to attach them to.
  let mediaEditor: AdminLodgeMedia | undefined;
  let toDelete: Lodge | null = null;
  let form = emptyForm();
  let toasts: Toast[] = [];

  const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  $: if (modalOpen && !slugManuallyEdited) form.slug = slugify(form.name);

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); }, 3500);
  };
  const dismissToast = (e: CustomEvent<string>) => { toasts = toasts.filter((t) => t.id !== e.detail); };

  const loadDestinations = async () => {
    try {
      const res = await api.destinations.list({ status: 'published', limit: 100 });
      const items = res.data.items as { id: string; name: string }[];
      destinationOptions = [{ label: 'No destination', value: '' }, ...items.map((d) => ({ label: d.name, value: d.id }))];
    } catch {
      destinationOptions = [{ label: 'No destination', value: '' }];
    }
  };

  const load = async () => {
    loading = true;
    error = '';
    try {
      const res = await api.lodges.list({ search, status: statusFilter, limit: 100 });
      rows = res.data.items as Lodge[];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load lodges.';
    } finally {
      loading = false;
    }
  };

  const openCreate = () => {
    editing = null;
    form = emptyForm();
    slugManuallyEdited = false;
    void mediaEditor?.load(null);
    modalOpen = true;
  };

  const openEdit = (l: Lodge) => {
    editing = l;
    void mediaEditor?.load(l.id);
    form = {
      name: l.name,
      slug: l.slug,
      destination_id: l.destination_id ?? '',
      accommodation_level: l.accommodation_level,
      lodge_type: l.lodge_type,
      description: l.description ?? '',
      why_we_recommend: l.why_we_recommend ?? '',
      hero_image_url: l.hero_image_url ?? '',
      image_url: l.image_url ?? '',
      price_per_night_from: l.price_per_night_from != null ? String(l.price_per_night_from) : '',
      currency: l.currency ?? 'USD',
      best_for: (l.best_for ?? []).join(', '),
      romantic_rating: l.romantic_rating != null ? String(l.romantic_rating) : '',
      family_rating: l.family_rating != null ? String(l.family_rating) : '',
      website_url: l.website_url ?? '',
      status: l.status,
      is_featured: Boolean(l.is_featured),
      seo_title: l.seo_title ?? '',
      meta_description: l.meta_description ?? ''
    };
    slugManuallyEdited = true;
    modalOpen = true;
  };

  const closeModal = () => { modalOpen = false; editing = null; form = emptyForm(); slugManuallyEdited = false; };

  const numOrNull = (v: string) => { const n = Number(v); return v.trim() !== '' && Number.isFinite(n) ? n : null; };

  const save = async () => {
    if (!form.name.trim()) { showToast('Name is required.', 'error'); return; }
    saving = true;
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      destination_id: form.destination_id || null,
      accommodation_level: form.accommodation_level,
      lodge_type: form.lodge_type,
      description: form.description.trim() || null,
      why_we_recommend: form.why_we_recommend.trim() || null,
      hero_image_url: form.hero_image_url.trim() || null,
      image_url: form.image_url.trim() || null,
      price_per_night_from: numOrNull(form.price_per_night_from),
      currency: form.currency.trim() || 'USD',
      best_for: form.best_for.split(',').map((s) => s.trim()).filter(Boolean),
      romantic_rating: numOrNull(form.romantic_rating),
      family_rating: numOrNull(form.family_rating),
      website_url: form.website_url.trim() || null,
      status: form.status,
      is_featured: form.is_featured,
      seo_title: form.seo_title.trim() || null,
      meta_description: form.meta_description.trim() || null
    };
    try {
      // Gallery and amenities are saved after the lodge, because a new
      // property has no id to attach them to until it exists. A failure here
      // is reported without losing the lodge that did save.
      let savedId = editing?.id ?? '';
      if (editing) {
        await api.lodges.update(editing.id, payload);
        showToast('Lodge updated.');
      } else {
        const created = await api.lodges.create(payload);
        savedId = String((created.data as { id?: string } | undefined)?.id ?? '');
        showToast('Lodge created.');
      }

      if (savedId) {
        try {
          await mediaEditor?.save(savedId);
        } catch (mediaError) {
          showToast(
            mediaError instanceof Error ? mediaError.message : 'The lodge saved, but its gallery did not.',
            'error'
          );
        }
      }

      closeModal();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save lodge.', 'error');
    } finally {
      saving = false;
    }
  };

  // ── bulk selection ────────────────────────────────────────────────────────
  let selectedIds = new Set<string>();
  let bulkConfirmOpen = false;
  let bulkBusy = false;

  $: visibleIds = rows.map((l) => l.id);
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

  const bulkSetStatus = async (status: string) => {
    if (!selectedIds.size) return;
    bulkBusy = true;
    try {
      const res = await api.lodges.bulkStatus([...selectedIds], status);
      const n = res.data?.updated ?? selectedIds.size;
      showToast(`${n} lodge${n === 1 ? '' : 's'} set to ${status}.`);
      clearSelection();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update the selected lodges.', 'error');
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
      showToast(`Deleted ${n} lodge${n === 1 ? '' : 's'}.`);
      bulkConfirmOpen = false;
      clearSelection();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete the selected lodges.', 'error');
    } finally {
      bulkBusy = false;
    }
  };

  const openDelete = (l: Lodge) => { toDelete = l; confirmOpen = true; };
  const confirmDelete = async () => {
    if (!toDelete) return;
    deleting = true;
    try {
      await api.lodges.remove(toDelete.id);
      showToast('Lodge deleted.');
      confirmOpen = false;
      toDelete = null;
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete lodge.', 'error');
    } finally {
      deleting = false;
    }
  };

  const fmt = (v?: string) => v ? new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(v)) : '-';
  const price = (l: Lodge) => l.price_per_night_from != null ? `${l.currency ?? 'USD'} ${Math.round(l.price_per_night_from).toLocaleString()}/night` : '-';

  onMount(() => {
    void load();
    void loadDestinations();
    const editSlug = new URLSearchParams(window.location.search).get('edit');
    if (editSlug) void api.lodges.get(editSlug).then((response) => openEdit(response.data as Lodge)).catch(() => showToast('Unable to open this property. Find it in the list below.', 'error'));
  });
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
  <AdminPageHeader
    eyebrow="Tour Management"
    title="Lodges & Camps"
    description="Recommended accommodation — surfaced as 'Where to stay' on destination pages and used to plan itineraries."
    actionLabel="New Lodge"
    actionIcon={Plus}
    on:action={openCreate}
  />

  <AdminToolbar className="grid gap-3 md:grid-cols-[1fr_190px_auto] md:items-end">
    <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
      <span>Search</span>
      <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
        <Search size={16} class="text-ink/45" />
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Search lodges..." onkeydown={(e) => e.key === 'Enter' && load()} />
      </span>
    </CmsLabel>
    <AdminSelect label="Status" name="status_filter" bind:value={statusFilter} options={[{ label: 'All statuses', value: 'all' }, ...statusOptions]} />
    <AdminButton variant="secondary" on:click={load}>Apply</AdminButton>
  </AdminToolbar>

  {#if loading}
    <LoadingState message="Loading lodges..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if rows.length === 0}
    <AdminEmptyState title="No lodges yet" message="Add your first recommended lodge or camp." actionLabel="New Lodge" icon={Hotel} on:action={openCreate} />
  {:else}
    {#if selectedCount}
      <div class="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-goldfinch-gold/40 bg-goldfinch-gold/10 px-4 py-3">
        <p class="text-sm font-bold text-heading" aria-live="polite">
          {selectedCount} lodge{selectedCount === 1 ? '' : 's'} selected
        </p>
        <CmsButton variant="ghost" class="text-xs font-semibold text-ink/60 underline-offset-2 transition hover:text-ink hover:underline" type="button" onclick={clearSelection}>
          Clear selection
        </CmsButton>

        <div class="ml-auto flex flex-wrap items-center gap-2">
          <span class="text-xs font-bold uppercase tracking-[0.12em] text-ink/45">Set status</span>
          {#each statusOptions as option (option.value)}
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

    <div class="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm">
      <div class="overflow-x-auto">
        <CmsTable.Root class="w-full min-w-[860px] text-sm">
          <CmsTable.Header class="bg-sand/70 text-xs uppercase tracking-[0.08em] text-ink/60">
            <CmsTable.Row>
              <CmsTable.Head class="w-10 px-4 py-3">
                <CmsCheckbox
                  class="h-4 w-4 cursor-pointer accent-forest"
                  
                  aria-label={allVisibleSelected ? 'Deselect all lodges' : 'Select all lodges'}
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected}
                  onCheckedChange={toggleAllVisible}
                />
              </CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Name</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Destination</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Level / Type</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">From</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Status</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Updated</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-right font-semibold">Actions</CmsTable.Head>
            </CmsTable.Row>
          </CmsTable.Header>
          <CmsTable.Body class="divide-y divide-ink/10">
            {#each rows as l (l.id)}
              <CmsTable.Row class={`transition hover:bg-sand/25 ${selectedIds.has(l.id) ? 'bg-goldfinch-gold/10' : ''}`}>
                <CmsTable.Cell class="px-4 py-4">
                  <CmsCheckbox
                    class="h-4 w-4 cursor-pointer accent-forest"
                    
                    aria-label={`Select ${l.name}`}
                    checked={selectedIds.has(l.id)}
                    onCheckedChange={() => toggleOne(l.id)}
                  />
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4">
                  <div class="font-semibold text-ink">{l.name}{#if l.is_featured}<span class="ml-2 rounded-full bg-goldfinch-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-goldfinch-gold">Featured</span>{/if}</div>
                  <p class="mt-0.5 font-mono text-xs text-ink/50">{l.slug}</p>
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/60">{l.destinations?.name ?? '-'}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/60">{levelLabel(l.accommodation_level)} · {typeLabel(l.lodge_type)}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/60">{price(l)}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4"><StatusBadge status={l.status} /></CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4 text-ink/60">{fmt(l.updated_at ?? l.created_at)}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-4">
                  <div class="flex justify-end gap-2">
                    <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openEdit(l)}>
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

{#if modalOpen}
  <AdminAccommodationEditor
    {editing}
    destinations={destinationOptions}
    on:close={closeModal}
    on:saved={() => { showToast(editing ? 'Property updated.' : 'Property created.'); void load(); }}
  />
{/if}

<ConfirmModal
  open={bulkConfirmOpen}
  title={`Delete ${selectedCount} lodge${selectedCount === 1 ? '' : 's'}`}
  message={`Delete ${selectedCount} selected lodge${selectedCount === 1 ? '' : 's'}? They are soft deleted and can be restored in the database.`}
  on:cancel={() => (bulkConfirmOpen = false)}
  on:confirm={bulkDelete}
/>

<ConfirmModal
  open={confirmOpen}
  title="Delete lodge"
  message={`Delete "${toDelete?.name ?? 'this lodge'}"? This soft-deletes the record.`}
  on:cancel={() => { confirmOpen = false; toDelete = null; }}
  on:confirm={confirmDelete}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting lodge...
  </div>
{/if}
