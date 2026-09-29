<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import * as CmsTable from '$lib/components/ui/table';

  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { CalendarDays, Edit, Plus, Save, Search, Trash2, X } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';

  type AvailableDate = {
    available_slots?: number | string | null;
    created_at?: string;
    currency?: string | null;
    end_date?: string | null;
    id: string;
    notes?: string | null;
    price?: number | string | null;
    start_date: string;
    status: 'available' | 'cancelled' | 'full' | 'limited';
    tour_id: string;
    updated_at?: string;
  };

  type Option = {
    label: string;
    value: string;
  };

  type Toast = {
    id: string;
    message: string;
    type: 'error' | 'success';
  };

  type TourSummary = {
    currency?: string | null;
    destination?: string;
    duration_days?: number | string | null;
    duration_nights?: number | string | null;
    id: string;
    price_from?: number | string | null;
    slug: string;
    status?: string;
    title: string;
  };

  const statusOptions: Option[] = [
    { label: 'Available', value: 'available' },
    { label: 'Limited', value: 'limited' },
    { label: 'Full', value: 'full' },
    { label: 'Cancelled', value: 'cancelled' }
  ];

  let loadingTours = true;
  let loadingDates = false;
  let saving = false;
  let deleting = false;
  let error = '';
  let datesError = '';
  let search = '';
  let selectedTourId = '';
  let tours: TourSummary[] = [];
  let tourOptions: Option[] = [{ label: 'Select a tour', value: '' }];
  let dates: AvailableDate[] = [];
  let modalOpen = false;
  let confirmOpen = false;
  let editingDate: AvailableDate | null = null;
  let dateToDelete: AvailableDate | null = null;
  let toasts: Toast[] = [];
  let form = {
    available_slots: '',
    currency: 'USD',
    end_date: '',
    notes: '',
    price: '',
    start_date: '',
    status: 'available',
    tour_id: ''
  };

  $: filteredTours = tours.filter((tour) => {
    const value = `${tour.title} ${tour.slug} ${tour.destination ?? ''}`.toLowerCase();
    return value.includes(search.trim().toLowerCase());
  });

  $: selectedTour = tours.find((tour) => tour.id === selectedTourId);
  $: sortedDates = [...dates].sort((first, second) => String(first.start_date).localeCompare(String(second.start_date)));

  const relationText = (value: unknown, key: string) => {
    if (Array.isArray(value)) return String((value[0] as Record<string, unknown> | undefined)?.[key] ?? '');
    if (value && typeof value === 'object') return String((value as Record<string, unknown>)[key] ?? '');
    return '';
  };

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

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  };

  const formatDuration = (tour: TourSummary) => `${tour.duration_days ?? '-'} days / ${tour.duration_nights ?? 0} nights`;

  const formatMoney = (amount?: number | string | null, currency = 'USD') => {
    if (amount === undefined || amount === null || amount === '') return '-';
    const value = Number(amount);
    return `${currency} ${Number.isFinite(value) ? value.toLocaleString() : '0'}`;
  };

  const dateRange = (date: AvailableDate) => {
    if (!date.end_date || date.end_date === date.start_date) return formatDate(date.start_date);
    return `${formatDate(date.start_date)} - ${formatDate(date.end_date)}`;
  };

  const normalizeDate = (value: Record<string, unknown>): AvailableDate => ({
    available_slots: value.available_slots === undefined ? null : (value.available_slots as number | string | null),
    created_at: String(value.created_at ?? ''),
    currency: String(value.currency ?? 'USD'),
    end_date: value.end_date ? String(value.end_date) : '',
    id: String(value.id ?? ''),
    notes: String(value.notes ?? ''),
    price: value.price === undefined ? null : (value.price as number | string | null),
    start_date: String(value.start_date ?? ''),
    status: String(value.status ?? 'available') as AvailableDate['status'],
    tour_id: String(value.tour_id ?? '')
  });

  const loadTours = async () => {
    loadingTours = true;
    error = '';

    try {
      const response = await api.tours.list({ limit: 100, status: 'all' });
      tours = response.data.items.map((tour) => ({
        currency: tour.currency,
        destination: relationText((tour as Record<string, unknown>).destinations, 'name'),
        duration_days: tour.duration_days,
        duration_nights: tour.duration_nights,
        id: tour.id,
        price_from: tour.price_from,
        slug: tour.slug,
        status: tour.status,
        title: tour.title
      }));
      tourOptions = [{ label: 'Select a tour', value: '' }, ...tours.map((tour) => ({ label: tour.title, value: tour.id }))];
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : 'Unable to load tours.';
    } finally {
      loadingTours = false;
    }
  };

  const loadDates = async () => {
    dates = [];
    datesError = '';
    if (!selectedTourId) return;

    loadingDates = true;

    try {
      const response = await api.availableDates.byTour(selectedTourId);
      dates = response.data.map((item) => normalizeDate(item));
    } catch (requestError) {
      datesError = requestError instanceof Error ? requestError.message : 'Unable to load available dates.';
    } finally {
      loadingDates = false;
    }
  };

  const handleTourSelection = async () => {
    await loadDates();
  };

  const selectTour = async (tourId: string) => {
    selectedTourId = tourId;
    await loadDates();
  };

  const resetForm = () => {
    form = {
      available_slots: '',
      currency: selectedTour?.currency || 'USD',
      end_date: '',
      notes: '',
      price: '',
      start_date: '',
      status: 'available',
      tour_id: selectedTourId
    };
  };

  const openCreateModal = () => {
    if (!selectedTourId) {
      showToast('Select a parent tour before adding departure dates.', 'error');
      return;
    }

    editingDate = null;
    resetForm();
    modalOpen = true;
  };

  const openEditModal = (date: AvailableDate) => {
    editingDate = date;
    form = {
      available_slots: date.available_slots === undefined || date.available_slots === null ? '' : String(date.available_slots),
      currency: date.currency || selectedTour?.currency || 'USD',
      end_date: date.end_date ?? '',
      notes: date.notes ?? '',
      price: date.price === undefined || date.price === null ? '' : String(date.price),
      start_date: date.start_date,
      status: date.status || 'available',
      tour_id: date.tour_id
    };
    modalOpen = true;
  };

  const closeModal = () => {
    modalOpen = false;
    editingDate = null;
    resetForm();
  };

  const nullableNumber = (value: unknown) => {
    const text = String(value ?? '').trim();
    return text === '' ? null : Number(text);
  };

  const validateForm = () => {
    if (!selectedTourId) return 'Select a parent tour first.';
    if (!form.start_date) return 'Start date is required.';
    if (form.end_date && form.end_date < form.start_date) return 'End date must not be before the start date.';
    if (form.available_slots && Number(form.available_slots) < 0) return 'Available slots must be zero or positive.';
    if (form.price && Number(form.price) < 0) return 'Price must be zero or positive.';
    return '';
  };

  const payload = () => ({
    available_slots: nullableNumber(form.available_slots),
    currency: (form.currency || 'USD').trim().toUpperCase(),
    end_date: form.end_date || null,
    notes: form.notes.trim() || null,
    price: nullableNumber(form.price),
    start_date: form.start_date,
    status: form.status,
    tour_id: form.tour_id || selectedTourId
  });

  const saveDate = async () => {
    const validationError = validateForm();
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    saving = true;

    try {
      if (editingDate) {
        await api.availableDates.update(editingDate.id, payload());
        showToast('Departure date updated successfully.');
      } else {
        await api.availableDates.create(payload());
        showToast('Departure date added successfully.');
      }

      closeModal();
      await loadDates();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to save departure date.', 'error');
    } finally {
      saving = false;
    }
  };

  const openDeleteConfirm = (date: AvailableDate) => {
    dateToDelete = date;
    confirmOpen = true;
  };

  const deleteDate = async () => {
    if (!dateToDelete) return;
    deleting = true;

    try {
      await api.availableDates.remove(dateToDelete.id);
      showToast('Departure date deleted successfully.');
      confirmOpen = false;
      dateToDelete = null;
      await loadDates();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to delete departure date.', 'error');
    } finally {
      deleting = false;
    }
  };

  onMount(loadTours);
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
  <AdminPageHeader
    eyebrow="Tour Management"
    title="Available Dates"
    description="Manage departure dates and travel windows as child records attached to a selected tour package."
    actionLabel="Add Departure Date"
    actionIcon={Plus}
    on:action={openCreateModal}
  />

  <AdminToolbar className="grid gap-3 lg:grid-cols-[1fr_360px] lg:items-end">
    <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
      <span>Search tours</span>
      <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
        <Search size={16} class="text-ink/45" />
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Find a parent tour..." />
      </span>
    </CmsLabel>

    <AdminSelect label="Parent tour" name="tour_id" bind:value={selectedTourId} options={tourOptions} on:change={handleTourSelection} />
  </AdminToolbar>

  {#if loadingTours}
    <LoadingState message="Loading tours..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if tours.length === 0}
    <AdminEmptyState
      title="Create a tour first"
      message="Available dates must belong to a parent tour. Create the tour package first, then return here to manage departure dates."
      icon={CalendarDays}
    />
  {:else if !selectedTour}
    <div class="grid gap-4 rounded-xl border border-ink/10 bg-surface p-5 shadow-sm">
      <div>
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Select a parent tour</p>
        <h2 class="mt-1 text-xl font-bold text-ink">Departure dates are child records</h2>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-ink/62">
          Tours are the main travel products. Available dates are separate departure records linked by <span class="font-semibold text-ink">available_dates.tour_id</span>.
          Select a tour before adding travel windows.
        </p>
      </div>

      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {#each filteredTours as tour}
          <CmsButton variant="ghost"
            class="rounded-xl border border-ink/10 bg-sand/20 p-4 text-left transition hover:border-goldfinch-gold/45 hover:bg-sand/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/20"
            type="button"
            onclick={() => selectTour(tour.id)}
          >
            <p class="font-semibold text-ink">{tour.title}</p>
            <p class="mt-1 text-xs text-ink/55">{tour.destination || tour.slug}</p>
            <div class="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-forest">
              <span>{formatDuration(tour)}</span>
              <span>{formatMoney(tour.price_from, tour.currency || 'USD')}</span>
            </div>
          </CmsButton>
        {/each}
      </div>
    </div>
  {:else}
    <section class="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Selected parent tour</p>
          <h2 class="mt-1 text-xl font-bold text-ink">{selectedTour.title}</h2>
          <div class="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink/58">
            <span class="rounded-full bg-sand/70 px-3 py-1">{selectedTour.destination || selectedTour.slug}</span>
            <span class="rounded-full bg-sand/70 px-3 py-1">{formatDuration(selectedTour)}</span>
            <span class="rounded-full bg-sand/70 px-3 py-1">{formatMoney(selectedTour.price_from, selectedTour.currency || 'USD')}</span>
            <StatusBadge status={selectedTour.status || 'draft'} />
          </div>
        </div>

        <AdminButton on:click={openCreateModal}>
          <Plus size={16} />
          Add Departure Date
        </AdminButton>
      </div>
    </section>

    {#if loadingDates}
      <LoadingState message="Loading available dates..." />
    {:else if datesError}
      <ErrorState message={datesError} />
    {:else if sortedDates.length === 0}
      <AdminEmptyState
        title="No departure dates added yet"
        message="Add the first available travel date for this tour."
        actionLabel="Add Departure Date"
        icon={CalendarDays}
        on:action={openCreateModal}
      />
    {:else}
      <div class="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm">
        <div class="overflow-x-auto">
          <CmsTable.Root class="w-full min-w-[980px] text-start text-sm">
            <CmsTable.Header class="bg-sand/70 text-xs uppercase tracking-[0.08em] text-ink/60">
              <CmsTable.Row>
                <CmsTable.Head class="px-4 py-3 font-semibold">Travel Window</CmsTable.Head>
                <CmsTable.Head class="px-4 py-3 font-semibold">Status</CmsTable.Head>
                <CmsTable.Head class="px-4 py-3 font-semibold">Available Slots</CmsTable.Head>
                <CmsTable.Head class="px-4 py-3 font-semibold">Price</CmsTable.Head>
                <CmsTable.Head class="px-4 py-3 font-semibold">Notes</CmsTable.Head>
                <CmsTable.Head class="px-4 py-3 text-right font-semibold">Actions</CmsTable.Head>
              </CmsTable.Row>
            </CmsTable.Header>
            <CmsTable.Body class="divide-y divide-ink/10">
              {#each sortedDates as date}
                <CmsTable.Row class="transition hover:bg-sand/25">
                  <CmsTable.Cell class="px-4 py-4">
                    <div class="flex items-center gap-3">
                      <span class="grid h-10 w-10 place-items-center rounded-2xl bg-forest/10 text-forest ring-1 ring-forest/15">
                        <CalendarDays size={17} />
                      </span>
                      <div>
                        <p class="font-semibold text-ink">{dateRange(date)}</p>
                        <p class="mt-1 text-xs text-ink/50">Starts {formatDate(date.start_date)}</p>
                      </div>
                    </div>
                  </CmsTable.Cell>
                  <CmsTable.Cell class="px-4 py-4"><StatusBadge status={date.status} /></CmsTable.Cell>
                  <CmsTable.Cell class="px-4 py-4 text-ink/65">{date.available_slots ?? '-'}</CmsTable.Cell>
                  <CmsTable.Cell class="px-4 py-4 font-semibold text-ink">{formatMoney(date.price, date.currency || selectedTour.currency || 'USD')}</CmsTable.Cell>
                  <CmsTable.Cell class="max-w-xs px-4 py-4 text-ink/62">
                    <p class="line-clamp-2">{date.notes || '-'}</p>
                  </CmsTable.Cell>
                  <CmsTable.Cell class="px-4 py-4">
                    <div class="flex justify-end gap-2">
                      <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openEditModal(date)}>
                        <Edit size={14} />
                        Edit
                      </CmsButton>
                      <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDeleteConfirm(date)}>
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
  {/if}
</div>

{#if modalOpen}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (closeModal)(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),48rem);max-width:none">
      <CmsDialog.Title class="sr-only">{editingDate ? dateRange(editingDate) : 'Add available travel date'}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <form class="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-ink/10 bg-surface p-5 shadow-sm sm:p-6"  on:submit|preventDefault={saveDate}>
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">{editingDate ? 'Edit departure date' : 'New departure date'}</p>
          <h2 class="mt-1 text-2xl font-bold text-ink">{editingDate ? dateRange(editingDate) : 'Add available travel date'}</h2>
          <p class="mt-2 text-sm leading-6 text-ink/60">Save the departure window for {selectedTour?.title ?? 'the selected tour'}.</p>
        </div>
        <CmsButton variant="ghost" class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand" type="button" aria-label="Close available date form" onclick={closeModal}>
          <X size={18} />
        </CmsButton>
      </div>

      <div class="mt-6 grid gap-4 md:grid-cols-2">
        <AdminFormInput label="Start date" name="start_date" type="date" bind:value={form.start_date} required />
        <AdminFormInput label="End date" name="end_date" type="date" bind:value={form.end_date} />
      </div>

      <div class="mt-4 grid gap-4 md:grid-cols-4">
        <AdminFormInput label="Available slots" name="available_slots" type="number" bind:value={form.available_slots} placeholder="12" />
        <AdminFormInput label="Price" name="price" type="number" bind:value={form.price} placeholder="2500" />
        <AdminFormInput label="Currency" name="currency" bind:value={form.currency} placeholder="USD" />
        <AdminSelect label="Status" name="status" bind:value={form.status} options={statusOptions} />
      </div>

      <div class="mt-4">
        <AdminTextArea label="Notes" name="notes" bind:value={form.notes} rows={4} placeholder="Internal notes, availability context, seasonal guidance..." />
      </div>

      <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AdminButton variant="secondary" type="button" on:click={closeModal}>Cancel</AdminButton>
        <AdminButton type="submit" disabled={saving}>
          <Save size={16} />
          {saving ? 'Saving...' : editingDate ? 'Save Changes' : 'Add Departure Date'}
        </AdminButton>
      </div>
    </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title="Delete departure date"
  message={`Delete "${dateToDelete ? dateRange(dateToDelete) : 'this departure date'}"?`}
  on:cancel={() => {
    confirmOpen = false;
    dateToDelete = null;
  }}
  on:confirm={deleteDate}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting departure date...
  </div>
{/if}
