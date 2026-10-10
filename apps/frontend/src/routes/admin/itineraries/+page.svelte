<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Button as CmsButton } from '$lib/components/ui/button';

  import { cdnUrl } from '$lib/admin/img';
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { BedDouble, CalendarDays, Edit, MapPin, Image as ImageIcon, ListChecks, Plus, Route, Save, Search, Sparkles, Trash2, Utensils, X } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import AdminRichText from '$lib/admin/components/admin/AdminRichText.svelte';
  import AdminItineraryTranslations from '$lib/admin/components/admin/AdminItineraryTranslations.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';
  import { toMetaText } from '$lib/admin/richText';
  import type { Destination, Lodge } from '$lib/admin/types';

  type ItineraryDay = {
    accommodation?: string | null;
    accommodation_id?: string | null;
    activities?: string | null;
    destination_id?: string | null;
    travel_mode?: string | null;
    created_at?: string;
    day_number: number;
    description?: string | null;
    id: string;
    image_url?: string | null;
    meals?: string | null;
    title: string;
    tour_id: string;
    lodge?: Pick<Lodge, 'id' | 'name' | 'slug'> | null;
    updated_at?: string;
  };

  type MediaItem = {
    file_name: string;
    file_url: string;
    id: string;
    thumbnail_url?: string | null;
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
    start_point?: import('$lib/types/api').TripEndpoint | null;
    end_point?: import('$lib/types/api').TripEndpoint | null;
    destination?: string;
    duration_days?: number | string | null;
    duration_nights?: number | string | null;
    id: string;
    slug: string;
    status?: string;
    title: string;
  };

  let loadingTours = true;
  let loadingDays = false;
  let loadingMedia = false;
  let saving = false;
  let deleting = false;
  let error = '';
  let daysError = '';
  let search = '';
  let selectedTourId = '';
  let tours: TourSummary[] = [];
  let tourOptions: Option[] = [{ label: 'Select a tour', value: '' }];
  let accommodationOptions: Option[] = [{ label: 'No linked accommodation', value: '' }];
  let destinationOptions: Option[] = [{ label: 'No mapped place', value: '' }];
  /** Destination id -> whether it can be drawn. A place without coordinates is
   *  linkable but invisible on the route, and the editor should say so. */
  let destinationPinned: Record<string, boolean> = {};
  /** Lodge id -> its destination, so choosing a stay can suggest the place. */
  let lodgeDestination: Record<string, string> = {};
  const TRAVEL_MODES: Option[] = [
    { label: 'Not stated', value: '' },
    { label: 'By road', value: 'DRIVE' },
    { label: 'By air', value: 'FLY' },
    { label: 'By boat', value: 'BOAT' }
  ];
  let days: ItineraryDay[] = [];
  let mediaItems: MediaItem[] = [];
  let modalOpen = false;
  let confirmOpen = false;
  let editingDay: ItineraryDay | null = null;
  let dayToDelete: ItineraryDay | null = null;
  let toasts: Toast[] = [];
  let form = {
    accommodation: '',
    accommodation_id: '',
    activities: [''] as string[],
    destination_id: '',
    travel_mode: '',
    day_number: '1',
    description: '',
    image_url: '',
    meals: '',
    title: '',
    tour_id: ''
  };

  $: filteredTours = tours.filter((tour) => {
    const value = `${tour.title} ${tour.slug} ${tour.destination ?? ''}`.toLowerCase();
    return value.includes(search.trim().toLowerCase());
  });

  $: selectedTour = tours.find((tour) => tour.id === selectedTourId);
  $: sortedDays = [...days].sort((first, second) => Number(first.day_number) - Number(second.day_number));

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

  const formatDuration = (tour: TourSummary) => {
    const daysValue = tour.duration_days ?? '-';
    const nightsValue = tour.duration_nights ?? 0;
    return `${daysValue} days / ${nightsValue} nights`;
  };

  const activityList = (value: unknown): string[] => {
    const text = String(value ?? '').trim();
    if (!text) return [''];
    const parts = text.includes('\n') ? text.split('\n') : text.split(/,\s*/);
    const items = parts.map((item) => item.trim()).filter(Boolean);
    return items.length ? items : [''];
  };

  const addActivity = () => {
    form.activities = [...form.activities, ''];
  };

  const removeActivity = (index: number) => {
    const next = form.activities.filter((_, currentIndex) => currentIndex !== index);
    form.activities = next.length ? next : [''];
  };

  const normalizeDay = (value: Record<string, unknown>): ItineraryDay => ({
    accommodation: String(value.accommodation ?? ''),
    accommodation_id: String(value.accommodation_id ?? ''),
    activities: String(value.activities ?? ''),
    destination_id: String(value.destination_id ?? ''),
    travel_mode: String(value.travel_mode ?? ''),
    created_at: String(value.created_at ?? ''),
    day_number: Number(value.day_number ?? 0),
    description: String(value.description ?? ''),
    id: String(value.id ?? ''),
    image_url: String(value.image_url ?? ''),
    meals: String(value.meals ?? ''),
    title: String(value.title ?? 'Untitled day'),
    tour_id: String(value.tour_id ?? ''),
    lodge: value.lodge && typeof value.lodge === 'object' ? value.lodge as ItineraryDay['lodge'] : null
  });

  const loadTours = async () => {
    loadingTours = true;
    error = '';

    try {
      const response = await api.tours.list({ limit: 100, status: 'all', view: 'summary' });
      tours = response.data.items.map((tour) => ({
        destination: relationText((tour as Record<string, unknown>).destinations, 'name'),
        start_point: tour.start_point,
        end_point: tour.end_point,
        duration_days: tour.duration_days,
        duration_nights: tour.duration_nights,
        id: tour.id,
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

  const loadAccommodations = async () => {
    try {
      const response = await api.lodges.list({ limit: 100, status: 'all' });
      accommodationOptions = [
        { label: 'No linked accommodation', value: '' },
        ...response.data.items
          .filter((lodge) => lodge.id && lodge.status !== 'archived')
          .map((lodge) => {
            if (lodge.destination_id) lodgeDestination[lodge.id] = lodge.destination_id;
            const destination = lodge.destinations?.name?.trim();
            const level = String(lodge.accommodation_level ?? '').replace(/_/g, ' ');
            const detail = [destination, level].filter(Boolean).join(' - ');
            return { label: detail ? `${lodge.name} (${detail})` : lodge.name, value: lodge.id };
          })
      ];
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to load accommodations.', 'error');
    }
  };

  const loadDestinations = async () => {
    try {
      // Paged, not one call: the API caps limit at 100, so a single request for
      // 200 quietly returns 100 and every place after the hundredth would be
      // missing from this list with no sign that it was.
      const items: Destination[] = [];
      for (let page = 1; page <= 20; page++) {
        const response = await api.destinations.list({ limit: 100, page, status: 'all' });
        const batch = (response.data.items ?? []) as Destination[];
        items.push(...batch);
        if (batch.length < 100) break;
      }
      destinationPinned = Object.fromEntries(
        items.map((place) => [place.id, Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude)) && place.latitude != null && place.longitude != null])
      );
      destinationOptions = [
        { label: 'No mapped place', value: '' },
        ...items
          .filter((place) => place.id && place.status !== 'archived')
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((place) => ({
            // Marked in the list itself, so an editor sees BEFORE choosing that a
            // place will not appear on the map.
            label: destinationPinned[place.id] ? place.name : `${place.name} — not on the map yet`,
            value: place.id
          }))
      ];
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to load destinations.', 'error');
    }
  };

  /*
   * Choosing a stay suggests the place — the same rule the migration used to
   * backfill existing days, applied live so new days stay consistent with old
   * ones. It only fills an EMPTY place: an editor's own choice is never replaced.
   */
  $: if (form.accommodation_id && !form.destination_id && lodgeDestination[form.accommodation_id]) {
    form.destination_id = lodgeDestination[form.accommodation_id];
  }

  $: if (form.accommodation_id) {
    const selectedAccommodation = accommodationOptions.find((option) => option.value === form.accommodation_id);
    if (selectedAccommodation) form.accommodation = selectedAccommodation.label.replace(/\s+\([^)]*\)$/, '');
  }

  const loadMedia = async () => {
    if (mediaItems.length || loadingMedia) return;
    loadingMedia = true;

    try {
      const response = await api.media.list({ file_type: 'image', limit: 100 });
      mediaItems = response.data.items.map((item) => ({
        file_name: String(item.file_name ?? 'Untitled image'),
        file_url: String(item.file_url ?? ''),
        id: String(item.id ?? ''),
        thumbnail_url: (item.thumbnail_url as string | null | undefined) ?? null
      })).filter((item) => item.id && item.file_url);
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to load media images.', 'error');
    } finally {
      loadingMedia = false;
    }
  };

  const loadDays = async () => {
    days = [];
    daysError = '';
    if (!selectedTourId) return;

    loadingDays = true;

    try {
      const response = await api.itineraries.byTour(selectedTourId);
      days = response.data.map((item) => normalizeDay(item));
    } catch (requestError) {
      daysError = requestError instanceof Error ? requestError.message : 'Unable to load itinerary days.';
    } finally {
      loadingDays = false;
    }
  };

  const handleTourSelection = async () => {
    await loadDays();
  };

  const selectTour = async (tourId: string) => {
    selectedTourId = tourId;
    await loadDays();
  };

  const nextDayNumber = () => {
    const maxDay = sortedDays.reduce((max, day) => Math.max(max, Number(day.day_number)), 0);
    return String(maxDay + 1);
  };

  const resetForm = () => {
    form = {
      accommodation: '',
      accommodation_id: '',
      activities: [''],
      destination_id: '',
      travel_mode: '',
      day_number: nextDayNumber(),
      description: '',
      image_url: '',
      meals: '',
      title: '',
      tour_id: selectedTourId
    };
  };

  const openCreateModal = async () => {
    if (!selectedTourId) {
      showToast('Select a parent tour before adding itinerary days.', 'error');
      return;
    }

    editingDay = null;
    resetForm();
    void loadMedia();
    modalOpen = true;
  };

  const openEditModal = async (day: ItineraryDay) => {
    editingDay = day;
    form = {
      accommodation: day.accommodation ?? '',
      accommodation_id: day.accommodation_id ?? day.lodge?.id ?? '',
      activities: activityList(day.activities),
      destination_id: day.destination_id ?? '',
      travel_mode: day.travel_mode ?? '',
      day_number: String(day.day_number),
      description: day.description ?? '',
      image_url: day.image_url ?? '',
      meals: day.meals ?? '',
      title: day.title,
      tour_id: day.tour_id
    };
    void loadMedia();
    modalOpen = true;
  };

  const closeModal = () => {
    modalOpen = false;
    editingDay = null;
    resetForm();
  };

  const duplicateDayExists = () => {
    const dayNumber = Number(form.day_number);
    return sortedDays.some((day) => Number(day.day_number) === dayNumber && day.id !== editingDay?.id);
  };

  const payload = () => ({
    accommodation: form.accommodation.trim() || null,
    accommodation_id: form.accommodation_id || null,
    destination_id: form.destination_id || null,
    // Day 1 has no previous stop to travel from, so its mode is never sent.
    travel_mode: Number(form.day_number) > 1 ? form.travel_mode || null : null,
    activities: form.activities.map((activity) => activity.trim()).filter(Boolean).join('\n') || null,
    day_number: Number(form.day_number),
    description: form.description.trim() || null,
    image_url: form.image_url.trim() || null,
    meals: form.meals.trim() || null,
    title: form.title.trim(),
    tour_id: form.tour_id || selectedTourId
  });

  // ✨ AI co-pilot: draft the whole day-by-day itinerary from the tour context
  // and create the days that don't exist yet (review/edit afterwards).
  let drafting = false;
  const draftItinerary = async () => {
    if (!selectedTour || drafting) return;
    if (sortedDays.length && !confirm('Generate AI-drafted days for any day numbers not already added? Existing days are kept.')) return;
    drafting = true;
    try {
      const res = await api.aiTravelAdvisor.assist({
        task: 'draft_itinerary',
        context: {
          title: selectedTour.title,
          destination: selectedTour.destination,
          duration_days: Number(selectedTour.duration_days) || undefined
        }
      });
      const generated = (res.data.itinerary ?? []) as Array<Record<string, unknown>>;
      if (!generated.length) {
        showToast('The AI did not return any days. Please try again.', 'error');
        return;
      }
      const existing = new Set(sortedDays.map((day) => Number(day.day_number)));
      let created = 0;
      for (const day of generated) {
        const dayNumber = Number(day.day_number);
        if (!dayNumber || existing.has(dayNumber)) continue;
        await api.itineraries.create({
          tour_id: selectedTourId,
          day_number: dayNumber,
          title: String(day.title ?? `Day ${dayNumber}`),
          description: (day.description as string) ?? null,
          accommodation: (day.accommodation as string) ?? null,
          meals: (day.meals as string) ?? null,
          activities: (day.activities as string) ?? null
        });
        created += 1;
      }
      await loadDays();
      showToast(created ? `Drafted ${created} day${created === 1 ? '' : 's'} — review and edit as needed.` : 'All day numbers already exist; nothing added.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'AI draft failed.', 'error');
    } finally {
      drafting = false;
    }
  };

  const saveDay = async () => {
    if (!selectedTourId) {
      showToast('Select a parent tour first.', 'error');
      return;
    }

    if (!form.title.trim()) {
      showToast('Day title is required.', 'error');
      return;
    }

    if (!Number.isInteger(Number(form.day_number)) || Number(form.day_number) < 1) {
      showToast('Day number must be a positive number.', 'error');
      return;
    }

    if (duplicateDayExists()) {
      showToast('This tour already has an itinerary day with that day number.', 'error');
      return;
    }

    saving = true;

    try {
      if (editingDay) {
        await api.itineraries.update(editingDay.id, payload());
        showToast('Itinerary day updated successfully.');
      } else {
        await api.itineraries.create(payload());
        showToast('Itinerary day added successfully.');
      }

      closeModal();
      await loadDays();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to save itinerary day.', 'error');
    } finally {
      saving = false;
    }
  };

  const openDeleteConfirm = (day: ItineraryDay) => {
    dayToDelete = day;
    confirmOpen = true;
  };

  const deleteDay = async () => {
    if (!dayToDelete) return;
    deleting = true;

    try {
      await api.itineraries.remove(dayToDelete.id);
      showToast('Itinerary day deleted successfully.');
      confirmOpen = false;
      dayToDelete = null;
      await loadDays();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to delete itinerary day.', 'error');
    } finally {
      deleting = false;
    }
  };

  onMount(async () => {
    await Promise.all([loadTours(), loadAccommodations(), loadDestinations()]);
  });
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
  <AdminPageHeader
    eyebrow="Tour Management"
    title="Itineraries"
    description="Pick a tour to build its day-by-day plan — or edit it inside the full tour editor."
  />

  <!-- Itineraries now live in the tour editor, next to the overnights per safari style. -->
  <p class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-forest/20 bg-forest/5 px-4 py-3 text-sm text-heading">
    <Route size={15} class="shrink-0 text-forest" />
    <span class="min-w-0 flex-1">Itineraries are now edited in the tour editor, where each day also has an overnight per safari style. Changes made here do not update those overnights.</span>
    <a class="font-semibold text-forest underline-offset-2 hover:underline" href={selectedTourId ? `/admin/tours/${selectedTourId}/edit` : '/admin/tours'}>{selectedTourId ? 'Open this tour in the editor' : 'Go to Tours'} →</a>
  </p>

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
      message="Itinerary days must belong to a parent tour. Create the tour package first, then return here to manage day-by-day plans."
      icon={Route}
    />
  {:else if !selectedTour}
    <div class="grid gap-4 rounded-xl border border-ink/10 bg-surface p-5 shadow-sm">
      <div>
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Select a parent tour</p>
        <h2 class="mt-1 text-xl font-bold text-ink">Itinerary days are child records</h2>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-ink/62">
          Tours are the main travel package records. Itinerary days are separate records linked by <span class="font-semibold text-ink">itinerary_days.tour_id</span>.
          Select a tour before adding day-by-day items.
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
            <p class="mt-1 text-xs text-ink/55 dark:text-ink/75">{tour.destination || tour.slug}</p>
            <p class="mt-3 text-xs font-semibold text-forest">{formatDuration(tour)}</p>
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
          <p class="mt-2 text-sm text-forest"><strong>{selectedTour.start_point?.name ?? 'Start point not selected'}</strong> → <strong>{selectedTour.end_point?.name ?? 'End point not selected'}</strong></p>
          <p class="mt-1 text-xs text-ink/50">The first and final days inherit these endpoints. Change them in the parent tour editor.</p>
          <div class="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink/58">
            <span class="rounded-full bg-sand/70 px-3 py-1">{selectedTour.destination || selectedTour.slug}</span>
            <span class="rounded-full bg-sand/70 px-3 py-1">{formatDuration(selectedTour)}</span>
            <StatusBadge status={selectedTour.status || 'draft'} />
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <CmsButton variant="ghost"
            type="button"
            onclick={draftItinerary}
            disabled={drafting}
            class="inline-flex h-10 items-center gap-2 rounded-lg border border-forest/30 bg-forest/5 px-4 text-sm font-bold text-forest transition hover:bg-forest hover:text-white disabled:opacity-50"
            title="Draft the day-by-day plan with AI"
          >
            <Sparkles size={16} strokeWidth={2.4} />
            {drafting ? 'Drafting…' : 'Draft with AI'}
          </CmsButton>
          <AdminButton on:click={openCreateModal}>
            <Plus size={16} />
            Add Day
          </AdminButton>
        </div>
      </div>
    </section>

    {#if loadingDays}
      <LoadingState message="Loading itinerary days..." />
    {:else if daysError}
      <ErrorState message={daysError} />
    {:else if sortedDays.length === 0}
      <AdminEmptyState
        title="No itinerary days added yet"
        message="Start by adding Day 1. Each itinerary record stays linked to this selected tour."
        actionLabel="Add Day 1"
        icon={Route}
        on:action={openCreateModal}
      />
    {:else}
      <div class="grid gap-4">
        {#each sortedDays as day}
          <article class="grid gap-4 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm lg:grid-cols-[auto_1fr_auto] lg:items-start">
            <div class="grid h-16 w-16 place-items-center rounded-2xl bg-forest text-center text-white shadow-sm shadow-forest/15">
              <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">Day</span>
              <strong class="-mt-3 text-2xl">{day.day_number}</strong>
            </div>

            <div class="min-w-0">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 class="text-lg font-bold text-ink">{day.title}</h3>
                  {#if day.description}
                    <p class="mt-2 max-w-4xl text-sm leading-6 text-ink/62">{toMetaText(day.description, 220)}</p>
                  {/if}
                </div>
              </div>

              <div class="mt-4 grid gap-3 md:grid-cols-3">
                <div class="rounded-2xl bg-sand/35 p-3">
                  <p class="text-[11px] font-bold uppercase tracking-[0.12em] text-forest/70">Accommodation</p>
                  <p class="mt-1 text-sm text-ink/70">{day.lodge?.name || day.accommodation || 'Not specified'}</p>
                </div>
                <div class="rounded-2xl bg-sand/35 p-3">
                  <p class="text-[11px] font-bold uppercase tracking-[0.12em] text-forest/70">Meals</p>
                  <p class="mt-1 text-sm text-ink/70">{day.meals || 'Not specified'}</p>
                </div>
                <div class="rounded-2xl bg-sand/35 p-3">
                  <p class="text-[11px] font-bold uppercase tracking-[0.12em] text-forest/70">Activities</p>
                  <p class="mt-1 line-clamp-2 text-sm text-ink/70">{day.activities || 'Not specified'}</p>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 lg:flex-col lg:items-end">
              {#if day.image_url}
                <img class="h-16 w-24 rounded-2xl object-cover ring-1 ring-ink/10 lg:h-20 lg:w-28" src={cdnUrl(day.image_url)} alt={day.title} />
              {:else}
                <div class="grid h-16 w-24 place-items-center rounded-2xl bg-sand/50 text-ink/35 ring-1 ring-ink/10 lg:h-20 lg:w-28">
                  <ImageIcon size={20} />
                </div>
              {/if}

              <div class="flex gap-2">
                <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openEditModal(day)}>
                  <Edit size={14} />
                  Edit
                </CmsButton>
                <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDeleteConfirm(day)}>
                  <Trash2 size={14} />
                  Delete
                </CmsButton>
              </div>
            </div>
          </article>
        {/each}
      </div>
    {/if}

      <!-- Translating the whole trip at once, rather than a separate editor
           per day. An itinerary only makes sense read in order. -->
      {#if selectedTourId && sortedDays.length}
        <AdminItineraryTranslations
          days={sortedDays}
          on:toast={(event) => showToast(event.detail.message, event.detail.type ?? 'success')}
        />
      {/if}

  {/if}
</div>

{#if modalOpen}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (closeModal)(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),64rem);max-width:none">
      <CmsDialog.Title class="sr-only">{editingDay ? `Day ${editingDay.day_number}` : 'Add day plan'}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <form class="flex h-full max-h-full w-full max-w-5xl flex-col overflow-hidden bg-surface shadow-sm sm:h-auto sm:max-h-[94vh] sm:rounded-xl sm:border sm:border-ink/10"  on:submit|preventDefault={saveDay}>
      <header class="flex shrink-0 items-start justify-between gap-4 border-b border-ink/10 bg-surface px-4 py-4 sm:px-6 sm:py-5">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">{editingDay ? 'Edit itinerary day' : 'New itinerary day'}</p>
          <h2 class="mt-1 text-xl font-bold leading-tight text-ink sm:text-2xl">{editingDay ? `Day ${editingDay.day_number}` : 'Add day plan'}</h2>
          <p class="mt-1 line-clamp-1 text-sm text-ink/55">{selectedTour?.title ?? 'Selected tour'}</p>
        </div>
        <CmsButton variant="ghost" class="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-ink/10 bg-surface text-ink transition hover:bg-sand" type="button" aria-label="Close itinerary form" onclick={closeModal}>
          <X size={18} />
        </CmsButton>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
        <section>
          <div class="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70">
            <CalendarDays size={15} /> Day details
          </div>
          <div class="grid min-w-0 gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
            <AdminFormInput label="Day number" name="day_number" type="number" bind:value={form.day_number} required />
            <AdminFormInput label="Day title" name="title" bind:value={form.title} placeholder="Arrival in Arusha" required />
          </div>
        </section>

        <div class="mt-6 grid min-w-0 gap-7 border-t border-ink/10 pt-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:gap-8">
          <section class="min-w-0">
            <div class="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70">
              <ListChecks size={15} /> Day narrative
            </div>
            <AdminRichText label="Description" name="description" bind:value={form.description} rows={9} placeholder="Describe what happens on this day..." />

            <div class="mt-5 grid gap-3">
              <div class="flex items-center justify-between gap-3">
                <span class="text-[13px] font-semibold text-ink/65">Activities</span>
                <CmsButton variant="ghost" type="button" class="inline-flex h-9 items-center gap-1.5 rounded-md border border-forest/25 bg-forest/5 px-3 text-xs font-bold text-forest transition hover:bg-forest hover:text-white" onclick={addActivity}>
                  <Plus size={14} /> Add activity
                </CmsButton>
              </div>
              <div class="grid gap-2.5">
                {#each form.activities as _activity, index}
                  <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_40px] items-end gap-2">
                    <AdminFormInput label={`Activity ${index + 1}`} name={`activity_${index}`} bind:value={form.activities[index]} placeholder="Game drive" />
                    <CmsButton variant="ghost"
                      type="button"
                      class="grid h-11 w-10 place-items-center rounded-md border border-ink/10 bg-surface text-ink/45 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label={`Remove activity ${index + 1}`}
                      disabled={form.activities.length === 1}
                      onclick={() => removeActivity(index)}
                    >
                      <Trash2 size={16} />
                    </CmsButton>
                  </div>
                {/each}
              </div>
            </div>
          </section>

          <div class="min-w-0 space-y-7">
            <section class="min-w-0">
              <div class="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70">
                <MapPin size={15} /> Route map
              </div>
              <div class="grid min-w-0 gap-4">
                <AdminSelect label="Where this day is spent" name="destination_id" bind:value={form.destination_id} options={destinationOptions} />
                <!-- Says what the choice DOES to the public page, because the
                     consequence is invisible from inside this form. -->
                {#if !form.destination_id}
                  <p class="text-[12.5px] leading-5 text-ink/55">Pick a place and this day appears as a numbered pin on the tour's route map.</p>
                {:else if destinationPinned[form.destination_id] === false}
                  <p class="rounded-md border border-clay/25 bg-clay/5 px-3 py-2 text-[12.5px] leading-5 text-clay">
                    This place has no map position yet, so the day will not appear on the route.
                    <a class="font-semibold underline" href="/admin/destinations" target="_blank" rel="noopener">Add its latitude and longitude</a>
                    once and every tour that visits it is mapped.
                  </p>
                {:else}
                  <p class="text-[12.5px] leading-5 text-ink/55">Pinned on the route map.</p>
                {/if}
                {#if Number(form.day_number) > 1}
                  <AdminSelect label="How travellers get here" name="travel_mode" bind:value={form.travel_mode} options={TRAVEL_MODES} />
                  <p class="-mt-2 text-[12.5px] leading-5 text-ink/55">Draws the leg into this day's place. Leave it as not stated rather than guess.</p>
                {/if}
              </div>
            </section>

            <section class="min-w-0 border-t border-ink/10 pt-6">
              <div class="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70">
                <BedDouble size={15} /> Stay
              </div>
              <div class="grid min-w-0 gap-4">
                <AdminSelect label="Available accommodation" name="accommodation_id" bind:value={form.accommodation_id} options={accommodationOptions} />
                {#if form.accommodation_id}
                  <div class="grid gap-1.5">
                    <span class="text-[13px] font-semibold text-ink/65">Display name</span>
                    <div class="flex min-h-11 items-center rounded-md border border-ink/10 bg-sand/35 px-3.5 text-sm font-semibold text-ink/70">
                      {form.accommodation}
                    </div>
                  </div>
                {:else}
                  <AdminFormInput label="Custom accommodation name" name="accommodation" bind:value={form.accommodation} placeholder="Only for stays not in CMS" />
                {/if}
              </div>
            </section>

            <section class="border-t border-ink/10 pt-6">
              <div class="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70">
                <Utensils size={15} /> Meals
              </div>
              <AdminFormInput label="Meals included" name="meals" bind:value={form.meals} placeholder="Breakfast, lunch, dinner" />
            </section>

            <section class="border-t border-ink/10 pt-6">
              <div class="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70">
                <ImageIcon size={15} /> Day image
              </div>
              <MediaPicker label="Image" media={mediaItems} uploadFolder="itineraries" bind:value={form.image_url} />
            </section>
          </div>
        </div>
      </div>

      <footer class="flex shrink-0 items-center justify-end gap-3 border-t border-ink/10 bg-surface px-4 py-3 shadow-[0_-8px_24px_rgba(57,61,50,0.04)] sm:px-6 sm:py-4">
        <AdminButton variant="secondary" type="button" on:click={closeModal}>Cancel</AdminButton>
        <AdminButton type="submit" disabled={saving}>
          <Save size={16} />
          {saving ? 'Saving...' : editingDay ? 'Save Changes' : 'Add Day'}
        </AdminButton>
      </footer>
    </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title="Delete itinerary day"
  message={`Delete Day ${dayToDelete?.day_number ?? ''}: "${dayToDelete?.title ?? 'this itinerary day'}"?`}
  on:cancel={() => {
    confirmOpen = false;
    dayToDelete = null;
  }}
  on:confirm={deleteDay}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting itinerary day...
  </div>
{/if}
