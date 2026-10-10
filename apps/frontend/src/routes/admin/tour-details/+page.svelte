<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  import { cdnUrl } from '$lib/admin/img';
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import {
    CheckCircle,
    Edit,
    Image as ImageIcon,
    Images,
    ListMinus,
    ListPlus,
    Plus,
    Save,
    Search,
    Star,
    Trash2,
    X
  } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';

  // ─── types ────────────────────────────────────────────────────────────────

  type Tab = 'exclusions' | 'images' | 'inclusions';

  import type { TourListOption } from '$lib/admin/types';
  let listOptions: TourListOption[] = [];
  type InclusionItem = { option_id: string; created_at?: string; id: string; sort_order: number; title: string; tour_id: string };
  type ExclusionItem = { option_id: string; created_at?: string; id: string; sort_order: number; title: string; tour_id: string };
  type TourImage = {
    alt_text?: string | null;
    caption?: string | null;
    created_at?: string;
    id: string;
    image_url: string;
    is_featured: boolean;
    sort_order: number;
    tour_id: string;
  };

  type MediaItem = { file_name: string; file_url: string; id: string; thumbnail_url?: string | null };
  type Option = { label: string; value: string };
  type Toast = { id: string; message: string; type: 'error' | 'success' };

  type TourSummary = {
    category?: string;
    destination?: string;
    duration_days?: number | null;
    id: string;
    slug: string;
    status?: string;
    title: string;
  };

  // ─── state ────────────────────────────────────────────────────────────────

  let activeTab: Tab = 'inclusions';
  let loadingTours = true;
  let loadingItems = false;
  let loadingMedia = false;
  let saving = false;
  let deleting = false;
  let error = '';
  let itemsError = '';
  let search = '';
  let selectedTourId = '';

  let tours: TourSummary[] = [];
  let tourOptions: Option[] = [{ label: 'Select a tour', value: '' }];
  let inclusions: InclusionItem[] = [];
  let exclusions: ExclusionItem[] = [];
  let images: TourImage[] = [];
  let mediaItems: MediaItem[] = [];

  let modalOpen = false;
  let modalKind: 'exclusion' | 'image' | 'inclusion' = 'inclusion';
  let confirmOpen = false;
  let confirmKind: 'exclusion' | 'image' | 'inclusion' = 'inclusion';
  let toasts: Toast[] = [];

  let editingId: null | string = null;
  let deleteTarget: null | { id: string; label: string } = null;

  let itemForm = { sort_order: '0', option_id: '', tour_id: '' };
  let imageForm = {
    alt_text: '',
    caption: '',
    image_url: '',
    is_featured: false,
    sort_order: '0',
    tour_id: ''
  };

  // ─── derived ──────────────────────────────────────────────────────────────

  $: filteredTours = tours.filter((t) => {
    const val = `${t.title} ${t.slug} ${t.destination ?? ''} ${t.category ?? ''}`.toLowerCase();
    return val.includes(search.trim().toLowerCase());
  });

  $: selectedTour = tours.find((t) => t.id === selectedTourId);

  $: sortedInclusions = [...inclusions].sort((a, b) => a.sort_order - b.sort_order);
  $: sortedExclusions = [...exclusions].sort((a, b) => a.sort_order - b.sort_order);
  $: sortedImages = [...images].sort((a, b) => a.sort_order - b.sort_order);

  $: tabCount = { inclusions: sortedInclusions.length, exclusions: sortedExclusions.length, images: sortedImages.length };

  // ─── helpers ──────────────────────────────────────────────────────────────

  const rel = (value: unknown, key: string) => {
    if (Array.isArray(value)) return String((value[0] as Record<string, unknown> | undefined)?.[key] ?? '');
    if (value && typeof value === 'object') return String((value as Record<string, unknown>)[key] ?? '');
    return '';
  };

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); }, 3500);
  };

  const dismissToast = (e: CustomEvent<string>) => {
    toasts = toasts.filter((t) => t.id !== e.detail);
  };

  const nextOrder = (list: { sort_order: number }[]) =>
    list.length ? String(Math.max(...list.map((x) => x.sort_order)) + 1) : '0';

  const normalizeInclusion = (raw: Record<string, unknown>): InclusionItem => ({
    id: String(raw.id ?? ''),
    option_id: String(raw.option_id ?? ''),
    tour_id: String(raw.tour_id ?? ''),
    title: String(raw.title ?? ''),
    sort_order: Number(raw.sort_order ?? 0),
    created_at: String(raw.created_at ?? '')
  });

  const normalizeExclusion = (raw: Record<string, unknown>): ExclusionItem => ({
    id: String(raw.id ?? ''),
    option_id: String(raw.option_id ?? ''),
    tour_id: String(raw.tour_id ?? ''),
    title: String(raw.title ?? ''),
    sort_order: Number(raw.sort_order ?? 0),
    created_at: String(raw.created_at ?? '')
  });

  const normalizeImage = (raw: Record<string, unknown>): TourImage => ({
    id: String(raw.id ?? ''),
    tour_id: String(raw.tour_id ?? ''),
    image_url: String(raw.image_url ?? ''),
    alt_text: raw.alt_text ? String(raw.alt_text) : null,
    caption: raw.caption ? String(raw.caption) : null,
    is_featured: Boolean(raw.is_featured),
    sort_order: Number(raw.sort_order ?? 0),
    created_at: String(raw.created_at ?? '')
  });

  // ─── data loading ─────────────────────────────────────────────────────────

  const loadTours = async () => {
    loadingTours = true;
    error = '';
    try {
      const res = await api.tours.list({ limit: 200, status: 'all' });
      tours = res.data.items.map((t) => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        status: t.status,
        duration_days: t.duration_days,
        destination: rel((t as Record<string, unknown>).destinations, 'name'),
        category: rel((t as Record<string, unknown>).tour_categories, 'name')
      }));
      tourOptions = [{ label: 'Select a tour', value: '' }, ...tours.map((t) => ({ label: t.title, value: t.id }))];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load tours.';
    } finally {
      loadingTours = false;
    }
  };

  const loadMedia = async () => {
    if (mediaItems.length || loadingMedia) return;
    loadingMedia = true;
    try {
      const res = await api.media.list({ file_type: 'image', limit: 200 });
      mediaItems = res.data.items
        .map((m) => ({ id: String(m.id ?? ''), file_name: String(m.file_name ?? 'Untitled'), file_url: String(m.file_url ?? ''), thumbnail_url: (m.thumbnail_url as string | null | undefined) ?? null }))
        .filter((m) => m.id && m.file_url);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load media library.', 'error');
    } finally {
      loadingMedia = false;
    }
  };

  const loadItems = async () => {
    if (!selectedTourId) return;
    loadingItems = true;
    itemsError = '';
    inclusions = [];
    exclusions = [];
    images = [];
    try {
      const [incRes, excRes, imgRes] = await Promise.all([
        api.tourInclusions.byTour(selectedTourId),
        api.tourExclusions.byTour(selectedTourId),
        api.tourImages.byTour(selectedTourId)
      ]);
      inclusions = incRes.data.map((x) => normalizeInclusion(x));
      exclusions = excRes.data.map((x) => normalizeExclusion(x));
      images = imgRes.data.map((x) => normalizeImage(x));
    } catch (err) {
      itemsError = err instanceof Error ? err.message : 'Unable to load tour details.';
    } finally {
      loadingItems = false;
    }
  };

  const handleTourSelection = async () => {
    await loadItems();
  };

  const selectTour = async (id: string) => {
    selectedTourId = id;
    await loadItems();
  };

  // ─── modals ───────────────────────────────────────────────────────────────

  const openCreate = (kind: typeof modalKind) => {
    if (!selectedTourId) {
      showToast('Select a parent tour first.', 'error');
      return;
    }
    modalKind = kind;
    editingId = null;
    if (kind === 'image') void loadMedia();
    if (kind === 'inclusion') {
      itemForm = { sort_order: nextOrder(sortedInclusions), option_id: '', tour_id: selectedTourId };
    } else if (kind === 'exclusion') {
      itemForm = { sort_order: nextOrder(sortedExclusions), option_id: '', tour_id: selectedTourId };
    } else {
      imageForm = { alt_text: '', caption: '', image_url: '', is_featured: false, sort_order: nextOrder(sortedImages), tour_id: selectedTourId };
    }
    modalOpen = true;
  };

  const openEdit = (kind: typeof modalKind, item: ExclusionItem | InclusionItem | TourImage) => {
    modalKind = kind;
    editingId = item.id;
    if (kind === 'image') void loadMedia();
    if (kind === 'inclusion' || kind === 'exclusion') {
      const i = item as InclusionItem;
      itemForm = { sort_order: String(i.sort_order), option_id: i.option_id, tour_id: i.tour_id };
    } else {
      const img = item as TourImage;
      imageForm = {
        alt_text: img.alt_text ?? '',
        caption: img.caption ?? '',
        image_url: img.image_url,
        is_featured: img.is_featured,
        sort_order: String(img.sort_order),
        tour_id: img.tour_id
      };
    }
    modalOpen = true;
  };

  const closeModal = () => {
    modalOpen = false;
    editingId = null;
  };

  // ─── save / delete ────────────────────────────────────────────────────────

  const saveItem = async () => {
    if (!itemForm.option_id) {
      showToast('Select an option from the shared library.', 'error');
      return;
    }
    saving = true;
    const payload = {
      option_id: itemForm.option_id,
      tour_id: itemForm.tour_id || selectedTourId,
      sort_order: Number(itemForm.sort_order) || 0
    };
    try {
      if (modalKind === 'inclusion') {
        if (editingId) {
          await api.tourInclusions.update(editingId, payload);
          showToast('Inclusion updated.');
        } else {
          await api.tourInclusions.create(payload);
          showToast('Inclusion added.');
        }
      } else {
        if (editingId) {
          await api.tourExclusions.update(editingId, payload);
          showToast('Exclusion updated.');
        } else {
          await api.tourExclusions.create(payload);
          showToast('Exclusion added.');
        }
      }
      closeModal();
      await loadItems();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save item.', 'error');
    } finally {
      saving = false;
    }
  };

  const saveImage = async () => {
    if (!imageForm.image_url.trim()) {
      showToast('Image URL is required.', 'error');
      return;
    }
    saving = true;
    const payload = {
      alt_text: imageForm.alt_text.trim() || null,
      caption: imageForm.caption.trim() || null,
      image_url: imageForm.image_url.trim(),
      is_featured: imageForm.is_featured,
      sort_order: Number(imageForm.sort_order) || 0,
      tour_id: imageForm.tour_id || selectedTourId
    };
    try {
      if (editingId) {
        await api.tourImages.update(editingId, payload);
        showToast('Image updated.');
      } else {
        await api.tourImages.create(payload);
        showToast('Image added.');
      }
      closeModal();
      await loadItems();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save image.', 'error');
    } finally {
      saving = false;
    }
  };

  const handleSave = () => (modalKind === 'image' ? saveImage() : saveItem());

  const setFeatured = async (img: TourImage) => {
    try {
      await api.tourImages.update(img.id, { is_featured: true });
      showToast('Featured image set.');
      await loadItems();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to set featured image.', 'error');
    }
  };

  const openConfirm = (kind: typeof confirmKind, id: string, label: string) => {
    confirmKind = kind;
    deleteTarget = { id, label };
    confirmOpen = true;
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    deleting = true;
    try {
      if (confirmKind === 'inclusion') {
        await api.tourInclusions.remove(deleteTarget.id);
        showToast('Inclusion deleted.');
      } else if (confirmKind === 'exclusion') {
        await api.tourExclusions.remove(deleteTarget.id);
        showToast('Exclusion deleted.');
      } else {
        await api.tourImages.remove(deleteTarget.id);
        showToast('Image deleted.');
      }
      confirmOpen = false;
      deleteTarget = null;
      await loadItems();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete item.', 'error');
    } finally {
      deleting = false;
    }
  };

  onMount(()=>{void loadTours();void (async()=>{
    try {let page=1;const items:TourListOption[]=[];while(true){const r=await api.tourListOptions.list({page,limit:100});items.push(...r.data.items);if(page>=r.data.pagination.totalPages)break;page++;}listOptions=items;}
    catch(err){showToast(err instanceof Error?err.message:'Unable to load package options.','error');}
  })();});
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
  <AdminPageHeader
    eyebrow="Tour Management"
    title="Tour Details"
    description="Manage inclusions, exclusions, and images for each tour package."
    actionLabel={activeTab === 'images' ? 'Add Image' : activeTab === 'inclusions' ? 'Add Inclusion' : 'Add Exclusion'}
    actionIcon={Plus}
    on:action={() => openCreate(activeTab === 'images' ? 'image' : activeTab === 'inclusions' ? 'inclusion' : 'exclusion')}
  />

  <!-- Inclusions, exclusions and the gallery now live in the tour editor. -->
  <p class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-forest/20 bg-forest/5 px-4 py-3 text-sm text-heading">
    <ListPlus size={15} class="shrink-0 text-forest" />
    <span class="min-w-0 flex-1">Inclusions, exclusions and gallery photos are now edited in the tour editor, under “Included & excluded” and “Photography”.</span>
    <a class="font-semibold text-forest underline-offset-2 hover:underline" href={selectedTourId ? `/admin/tours/${selectedTourId}/edit` : '/admin/tours'}>{selectedTourId ? 'Open this tour in the editor' : 'Go to Tours'} →</a>
  </p>

  <AdminToolbar className="grid gap-3 lg:grid-cols-[1fr_360px] lg:items-end">
    <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
      <span>Search tours</span>
      <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
        <Search size={16} class="text-ink/45" />
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Find a tour..." />
      </span>
    </CmsLabel>
    <AdminSelect label="Parent tour" name="tour_id" bind:value={selectedTourId} options={tourOptions} on:change={handleTourSelection} />
  </AdminToolbar>

  {#if loadingTours}
    <LoadingState message="Loading tours..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if tours.length === 0}
    <AdminEmptyState title="No tours found" message="Create a tour package first, then return here to manage its details." icon={ListPlus} />
  {:else if !selectedTour}
    <!-- tour picker grid -->
    <div class="grid gap-4 rounded-xl border border-ink/10 bg-surface p-5 shadow-sm">
      <div>
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Select a parent tour</p>
        <h2 class="mt-1 text-xl font-bold text-ink">Inclusions, exclusions, and images are child records</h2>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-ink/62">
          Each of these records is linked to a tour via
          <span class="font-semibold text-ink">tour_id</span>. Select a tour to begin managing its details.
        </p>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {#each filteredTours as tour (tour.id)}
          <CmsButton variant="ghost"
            class="rounded-xl border border-ink/10 bg-sand/20 p-4 text-left transition hover:border-goldfinch-gold/45 hover:bg-sand/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/20"
            type="button"
            onclick={() => selectTour(tour.id)}
          >
            <p class="font-semibold text-ink">{tour.title}</p>
            <p class="mt-1 text-xs text-ink/55">{tour.destination || tour.slug}</p>
            {#if tour.category}
              <p class="mt-0.5 text-xs text-ink/45">{tour.category}</p>
            {/if}
            <div class="mt-3 flex items-center gap-2">
              <span class="rounded-full bg-forest/10 px-2.5 py-0.5 text-[11px] font-semibold text-forest">
                {tour.duration_days ?? '-'}d
              </span>
              <StatusBadge status={tour.status || 'draft'} />
            </div>
          </CmsButton>
        {/each}
      </div>
    </div>
  {:else}
    <!-- selected tour summary -->
    <section class="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Selected tour</p>
          <h2 class="mt-1 text-xl font-bold text-ink">{selectedTour.title}</h2>
          <div class="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink/58">
            {#if selectedTour.destination}
              <span class="rounded-full bg-sand/70 px-3 py-1">{selectedTour.destination}</span>
            {/if}
            {#if selectedTour.category}
              <span class="rounded-full bg-sand/70 px-3 py-1">{selectedTour.category}</span>
            {/if}
            {#if selectedTour.duration_days}
              <span class="rounded-full bg-sand/70 px-3 py-1">{selectedTour.duration_days} days</span>
            {/if}
            <StatusBadge status={selectedTour.status || 'draft'} />
          </div>
        </div>

        <div class="flex gap-2">
          <AdminButton variant="secondary" on:click={() => { selectedTourId = ''; inclusions = []; exclusions = []; images = []; }}>
            Change tour
          </AdminButton>
          <AdminButton on:click={() => openCreate(activeTab === 'images' ? 'image' : activeTab === 'inclusions' ? 'inclusion' : 'exclusion')}>
            <Plus size={16} />
            Add {activeTab === 'images' ? 'Image' : activeTab === 'inclusions' ? 'Inclusion' : 'Exclusion'}
          </AdminButton>
        </div>
      </div>
    </section>

    <!-- tabs -->
    <div class="flex gap-1 rounded-2xl border border-ink/10 bg-surface p-1.5 shadow-sm">
      {#each ([['inclusions', ListPlus, 'Inclusions'], ['exclusions', ListMinus, 'Exclusions'], ['images', Images, 'Tour Images']] as const) as [tab, Icon, label]}
        <CmsButton variant="ghost"
          class={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/20 ${
            activeTab === tab ? 'bg-forest text-white shadow-sm' : 'text-ink/55 hover:bg-sand/50 hover:text-ink'
          }`}
          type="button"
          onclick={() => (activeTab = tab)}
        >
          <Icon size={15} />
          {label}
          <span class={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${activeTab === tab ? 'bg-surface/20 text-white' : 'bg-sand/70 text-ink/60'}`}>
            {tabCount[tab]}
          </span>
        </CmsButton>
      {/each}
    </div>

    <!-- content -->
    {#if loadingItems}
      <LoadingState message="Loading tour details..." />
    {:else if itemsError}
      <ErrorState message={itemsError} />
    {:else if activeTab === 'inclusions'}
      {#if sortedInclusions.length === 0}
        <AdminEmptyState
          title="No inclusions added"
          message="List what's included in this tour package — accommodation, meals, transfers, park fees, etc."
          actionLabel="Add First Inclusion"
          icon={ListPlus}
          on:action={() => openCreate('inclusion')}
        />
      {:else}
        <div class="grid gap-3">
          {#each sortedInclusions as item (item.id)}
            <article class="flex items-center gap-4 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm" transition:fade={{ duration: 120 }}>
              <div class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60">
                <CheckCircle size={18} />
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-ink">{item.title}</p>
                <p class="text-xs text-ink/40">Sort order: {item.sort_order}</p>
              </div>
              <div class="flex shrink-0 gap-2">
                <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openEdit('inclusion', item)}>
                  <Edit size={13} />Edit
                </CmsButton>
                <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openConfirm('inclusion', item.id, item.title)}>
                  <Trash2 size={13} />Delete
                </CmsButton>
              </div>
            </article>
          {/each}
        </div>
      {/if}

    {:else if activeTab === 'exclusions'}
      {#if sortedExclusions.length === 0}
        <AdminEmptyState
          title="No exclusions added"
          message="List what's not included — international flights, visa fees, tips, personal expenses, etc."
          actionLabel="Add First Exclusion"
          icon={ListMinus}
          on:action={() => openCreate('exclusion')}
        />
      {:else}
        <div class="grid gap-3">
          {#each sortedExclusions as item (item.id)}
            <article class="flex items-center gap-4 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm" transition:fade={{ duration: 120 }}>
              <div class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-50 text-red-500 ring-1 ring-red-200/60">
                <X size={18} />
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-ink">{item.title}</p>
                <p class="text-xs text-ink/40">Sort order: {item.sort_order}</p>
              </div>
              <div class="flex shrink-0 gap-2">
                <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openEdit('exclusion', item)}>
                  <Edit size={13} />Edit
                </CmsButton>
                <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openConfirm('exclusion', item.id, item.title)}>
                  <Trash2 size={13} />Delete
                </CmsButton>
              </div>
            </article>
          {/each}
        </div>
      {/if}

    {:else if activeTab === 'images'}
      {#if sortedImages.length === 0}
        <AdminEmptyState
          title="No tour images added"
          message="Add photos for this tour's gallery. Set one as the featured image to appear on the tour card."
          actionLabel="Add First Image"
          icon={Images}
          on:action={() => openCreate('image')}
        />
      {:else}
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {#each sortedImages as img (img.id)}
            <article class="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm" transition:fade={{ duration: 120 }}>
              <div class="relative aspect-video bg-sand/40">
                {#if img.image_url}
                  <img class="h-full w-full object-cover" src={cdnUrl(img.image_url)} alt={img.alt_text || img.caption || 'Tour image'} />
                {:else}
                  <div class="grid h-full w-full place-items-center text-ink/25">
                    <ImageIcon size={32} />
                  </div>
                {/if}
                {#if img.is_featured}
                  <span class="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-goldfinch-gold px-2.5 py-1 text-[11px] font-bold text-heading shadow">
                    <Star size={11} fill="currentColor" />Featured
                  </span>
                {/if}
              </div>
              <div class="p-4">
                {#if img.alt_text || img.caption}
                  <p class="line-clamp-1 text-sm font-medium text-ink">{img.alt_text || img.caption}</p>
                {/if}
                {#if img.caption && img.alt_text}
                  <p class="mt-0.5 line-clamp-1 text-xs text-ink/50">{img.caption}</p>
                {/if}
                <p class="mt-1 text-xs text-ink/35">Sort: {img.sort_order}</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  {#if !img.is_featured}
                    <CmsButton variant="ghost" class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-goldfinch-gold/15 px-3 text-xs font-semibold text-heading transition hover:bg-goldfinch-gold/30" type="button" onclick={() => setFeatured(img)}>
                      <Star size={12} />Set featured
                    </CmsButton>
                  {/if}
                  <CmsButton variant="ghost" class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-ink/10 px-3 text-xs font-semibold text-ink transition hover:bg-sand/70" type="button" onclick={() => openEdit('image', img)}>
                    <Edit size={12} />Edit
                  </CmsButton>
                  <CmsButton variant="ghost" class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50" type="button" onclick={() => openConfirm('image', img.id, img.alt_text || img.image_url)}>
                    <Trash2 size={12} />Delete
                  </CmsButton>
                </div>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}
</div>

<!-- ─── add / edit modal ─────────────────────────────────────────────────── -->
{#if modalOpen}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (closeModal)(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),42rem);max-width:none">
      <CmsDialog.Title class="sr-only">{selectedTour?.title ?? ''}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <form
      class="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-ink/10 bg-surface p-5 shadow-sm sm:p-6"
      
      on:submit|preventDefault={handleSave}
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">
            {editingId ? 'Edit' : 'Add'}
            {modalKind === 'inclusion' ? 'Inclusion' : modalKind === 'exclusion' ? 'Exclusion' : 'Tour Image'}
          </p>
          <h2 class="mt-1 text-2xl font-bold text-ink">{selectedTour?.title ?? ''}</h2>
        </div>
        <CmsButton variant="ghost" class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand" type="button" aria-label="Close" onclick={closeModal}>
          <X size={18} />
        </CmsButton>
      </div>

      {#if modalKind === 'inclusion' || modalKind === 'exclusion'}
        <div class="mt-6 grid gap-4 sm:grid-cols-[1fr_160px]">
          <div class="grid gap-2">
            <AdminSelect label={modalKind==='inclusion'?'Included item':'Excluded item'} name="option_id" bind:value={itemForm.option_id}
              options={[{value:'',label:'Select a shared option'},...listOptions.filter(o=>o.kind===modalKind&&(o.is_active||o.id===itemForm.option_id)).map(o=>({value:o.id,label:o.title}))]} />
            <a href="/admin/tour-options" class="text-xs font-semibold text-forest hover:underline">Manage the shared library →</a>
          </div>
          <AdminFormInput label="Sort order" name="sort_order" type="number" bind:value={itemForm.sort_order} />
        </div>

      {:else}
        <!-- image form -->
        <div class="mt-6 rounded-xl border border-ink/10 bg-sand/25 p-4">
          <MediaPicker label="Tour image" media={mediaItems} uploadFolder="tours" bind:value={imageForm.image_url} />
        </div>

        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <AdminFormInput label="Alt text" name="alt_text" bind:value={imageForm.alt_text} placeholder="Descriptive alt text" />
          <AdminFormInput label="Sort order" name="sort_order" type="number" bind:value={imageForm.sort_order} />
        </div>
        <div class="mt-4">
          <AdminTextArea label="Caption" name="caption" bind:value={imageForm.caption} rows={2} placeholder="Optional caption shown beneath the image" />
        </div>
        <CmsLabel class="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-4 transition hover:bg-sand/30">
          <CmsCheckbox class="h-4 w-4 accent-forest"  bind:checked={imageForm.is_featured} />
          <div>
            <p class="text-sm font-semibold text-ink">Set as featured image</p>
            <p class="text-xs text-ink/50">This image will appear as the primary tour card photo. Only one image per tour can be featured.</p>
          </div>
        </CmsLabel>
      {/if}

      <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AdminButton variant="secondary" type="button" on:click={closeModal}>Cancel</AdminButton>
        <AdminButton type="submit" disabled={saving}>
          <Save size={16} />
          {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add'}
        </AdminButton>
      </div>
    </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title={`Delete ${confirmKind === 'inclusion' ? 'inclusion' : confirmKind === 'exclusion' ? 'exclusion' : 'image'}`}
  message={`Delete "${deleteTarget?.label ?? 'this item'}"? This cannot be undone.`}
  on:cancel={() => { confirmOpen = false; deleteTarget = null; }}
  on:confirm={confirmDelete}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting...
  </div>
{/if}
