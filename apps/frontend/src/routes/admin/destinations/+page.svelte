<script lang="ts">
  import { destinationHref } from '$lib/destination-content';
  import DestinationGuideEditor from '$lib/admin/components/admin/DestinationGuideEditor.svelte';
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsTable from '$lib/components/ui/table';
  import { Button as CmsButton } from '$lib/components/ui/button';

  import { onMount } from 'svelte';
  import { ArrowLeft, ArrowRight, BookOpen, Edit, ExternalLink, FileText, Images, Languages, MapPin, Plus, Save, Search, ShieldCheck, Star, Trash2, WandSparkles, X } from '@lucide/svelte';
  import EditorNavigation from '$lib/admin/components/admin/EditorNavigation.svelte';
  import { Switch } from '$lib/components/ui/switch';
  import AreaSelect from '$lib/admin/components/admin/destination/AreaSelect.svelte';
  import DestinationPreview from '$lib/admin/components/admin/destination/DestinationPreview.svelte';
  import PlaceSelect from '$lib/admin/components/admin/destination/PlaceSelect.svelte';
  import { coordinateError, DESTINATION_COUNTRIES, regionTidyUp, safariRegionsFor, splitAreas } from '$lib/admin/destination-places';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminRichText from '$lib/admin/components/admin/AdminRichText.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import AdminTranslationTabs from '$lib/admin/components/admin/AdminTranslationTabs.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';

  type PublishStatus = 'draft' | 'published' | 'archived';
  type MediaItem = { file_name: string; file_url: string; id: string; thumbnail_url?: string | null };

  type Destination = {
    guide?: Record<string, any>[] | null;
    id: string;
    name: string;
    slug: string;
    country?: string | null;
    region?: string | null;
    location?: string | null;
    short_description?: string | null;
    description?: string | null;
    main_image_url?: string | null;
    banner_image_url?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    safety_overview?: string | null;
    health_vaccinations?: string | null;
    security_advice?: string | null;
    travel_insurance_note?: string | null;
    emergency_contacts?: string | null;
    score_wildlife?: number | string | null;
    score_luxury?: number | string | null;
    score_family?: number | string | null;
    score_photography?: number | string | null;
    score_adventure?: number | string | null;
    score_budget_from?: number | string | null;
    status: PublishStatus;
    is_featured?: boolean | null;
    meta_title?: string | null;
    meta_description?: string | null;
    og_image_url?: string | null;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
  };

  type DestinationForm = {
    guide: Record<string, any>[];
    banner_image_url: string;
    country: string;
    description: string;
    emergency_contacts: string;
    health_vaccinations: string;
    score_wildlife: string;
    score_luxury: string;
    score_family: string;
    score_photography: string;
    score_adventure: string;
    score_budget_from: string;
    is_featured: boolean;
    latitude: string;
    location: string;
    longitude: string;
    main_image_url: string;
    meta_description: string;
    meta_title: string;
    name: string;
    og_image_url: string;
    region: string;
    safety_overview: string;
    security_advice: string;
    short_description: string;
    slug: string;
    status: PublishStatus;
    travel_insurance_note: string;
  };

  type Toast = {
    id: string;
    message: string;
    type: 'error' | 'success';
  };

  const emptyForm = (): DestinationForm => ({
    guide: [],
    banner_image_url: '',
    country: 'Tanzania',
    description: '',
    emergency_contacts: '',
    health_vaccinations: '',
    score_wildlife: '',
    score_luxury: '',
    score_family: '',
    score_photography: '',
    score_adventure: '',
    score_budget_from: '',
    is_featured: false,
    latitude: '',
    location: '',
    longitude: '',
    main_image_url: '',
    meta_description: '',
    meta_title: '',
    name: '',
    og_image_url: '',
    region: '',
    safety_overview: '',
    security_advice: '',
    short_description: '',
    slug: '',
    status: 'draft',
    travel_insurance_note: ''
  });

  const statusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' }
  ];


  let rows: Destination[] = [];
  let loading = true;
  let saving = false;
  let deleting = false;
  let error = '';
  let search = '';
  let status = 'all';
  let modalOpen = false;
  let confirmOpen = false;
  let slugManuallyEdited = false;
  let editingDestination: Destination | null = null;
  let destinationToDelete: Destination | null = null;
  let form = emptyForm();
  let mediaItems: MediaItem[] = [];
  let loadingMedia = false;
  let toasts: Toast[] = [];

  type TabKey = 'basics' | 'place' | 'overview' | 'safety' | 'ratings' | 'media' | 'seo' | 'translations';
  /**
   * The same stepped editor as categories: one concern per step, so the
   * place fields sit next to a preview of how they read on the website.
   * Translations needs an id, so it only appears for a saved destination.
   */
  const TABS = [
    ['basics', FileText, 'Essentials'],
    ['place', MapPin, 'Place & map'],
    ['overview', BookOpen, 'Story & guide'],
    ['safety', ShieldCheck, 'Health & safety'],
    ['ratings', Star, 'Ratings'],
    ['media', Images, 'Photography'],
    ['seo', Search, 'Search & sharing'],
    ['translations', Languages, 'Translations']
  ] as const;
  const STEP_NOTES: Record<TabKey, string> = {
    basics: 'Name it, sum it up in a line and decide when it goes live.',
    place: 'Where it is, exactly as visitors read it on cards, filters and the page.',
    overview: 'The story and the practical guide on the destination page.',
    safety: 'Honest, reassuring advice. Leave a field blank to hide it.',
    ratings: 'Scores travellers compare. Leave blank to hide them.',
    media: 'The photos for cards and the page header.',
    seo: 'Make a great first impression in search and on social.',
    translations: 'Make your content feel local, everywhere.'
  };
  const SCORES = [
    ['score_wildlife', 'Wildlife'],
    ['score_luxury', 'Comfort & luxury'],
    ['score_family', 'Families'],
    ['score_photography', 'Photography'],
    ['score_adventure', 'Adventure']
  ] as const;
  const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  let activeTab: TabKey = 'basics';
  let bodyEl: HTMLDivElement;
  /** Fields only go red once the operator has tried to save. */
  let attemptedSave = false;
  let lastCountry = 'Tanzania';

  $: visibleTabs = TABS.filter(([key]) => key !== 'translations' || editingDestination);
  $: stepIndex = visibleTabs.findIndex(([key]) => key === activeTab);
  $: regionOptions = safariRegionsFor(form.country);
  $: tidyUp = regionTidyUp(form.country, form.region);

  $: nameError = form.name.trim().length < 2 ? 'Give the destination a name of at least 2 characters.' : '';
  $: slugError = !SLUG_RE.test(form.slug.trim()) ? 'Lowercase letters, numbers and single hyphens, e.g. serengeti-national-park.' : '';
  $: countryError = form.country.trim() ? '' : 'Choose the country.';
  $: coordError = coordinateError(form.latitude, form.longitude);
  $: scoreError = SCORES.some(([key]) => {
    const text = String(form[key] ?? '').trim();
    return text !== '' && !(Number(text) >= 0 && Number(text) <= 10);
  })
    ? 'Scores run from 0 to 10.'
    : String(form.score_budget_from ?? '').trim() !== '' && !(Number(form.score_budget_from) >= 0)
      ? 'The budget is a USD amount of 0 or more.'
      : '';
  $: mapLink = !coordError && form.latitude.trim() && form.longitude.trim() ? `https://www.google.com/maps/search/?api=1&query=${Number(form.latitude)},${Number(form.longitude)}` : '';
  $: tabError = {
    basics: attemptedSave && Boolean(nameError || slugError),
    place: Boolean(coordError) || (attemptedSave && Boolean(countryError)),
    overview: false,
    safety: false,
    ratings: Boolean(scoreError),
    media: false,
    seo: false,
    translations: false
  } as Record<TabKey, boolean>;

  const selectTab = (tab: TabKey) => {
    activeTab = tab;
    // Each step starts at its own top rather than inheriting the last one's scroll.
    bodyEl?.scrollTo({ top: 0 });
  };

  /** Save blocked by a field the operator cannot see: go to it, then explain. */
  const failOn = (tab: TabKey, message: string) => {
    selectTab(tab);
    showToast(message, 'error');
  };

  /**
   * A new country empties the place fields picked from the old country's lists
   * (a Kenyan park cannot be in the Northern Circuit); typed text is kept.
   */
  const changeCountry = (next: string) => {
    if (safariRegionsFor(lastCountry).includes(form.region) && !safariRegionsFor(next).includes(form.region)) form.region = '';
    if (splitAreas(lastCountry, form.location).areas.length && !splitAreas(next, form.location).areas.length) form.location = '';
    lastCountry = next;
  };

  /** Move an administrative area out of the safari region field, where it read wrongly. */
  const applyTidyUp = () => {
    if (!tidyUp) return;
    const areas = splitAreas(form.country, form.location).areas;
    if (!form.location.trim() || areas.length) form.location = [...new Set([...areas, tidyUp.area])].slice(0, 3).join(', ');
    form.region = tidyUp.safariRegion;
  };

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  $: if (modalOpen && !slugManuallyEdited) {
    form.slug = slugify(form.name);
  }

  const loadMedia = async () => {
    if (mediaItems.length || loadingMedia) return;
    loadingMedia = true;
    try {
      const res = await api.media.list({ file_type: 'image', limit: 200 });
      mediaItems = (res.data.items as unknown as MediaItem[]).filter((m) => m.file_url);
    } catch {
      /* non-fatal — the picker can still upload/paste a URL */
    } finally {
      loadingMedia = false;
    }
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

  const loadDestinations = async () => {
    loading = true;
    error = '';

    try {
      const response = await api.destinations.list({
        limit: 50,
        search,
        status
      });
      rows = response.data.items as Destination[];
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : 'Unable to load destinations.';
    } finally {
      loading = false;
    }
  };

  const openCreateModal = () => {
    editingDestination = null;
    form = emptyForm();
    lastCountry = form.country;
    activeTab = 'basics';
    attemptedSave = false;
    void loadMedia();
    slugManuallyEdited = false;
    modalOpen = true;
  };

  // The list endpoint returns a trimmed projection without the health & safety
  // fields, so editing from a list row and saving would blank them. Load the
  // full record first, and refuse to open rather than edit partial data.
  const openEditModal = async (listRow: Destination) => {
    let destination: Destination;
    try {
      const res = await api.destinations.get(listRow.slug);
      destination = { ...listRow, ...(res.data as Destination) };
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to load this destination.', 'error');
      return;
    }
    editingDestination = destination;
    form = {
      guide: structuredClone(destination.guide ?? []),
      banner_image_url: destination.banner_image_url ?? '',
      country: destination.country ?? 'Tanzania',
      description: destination.description ?? '',
      emergency_contacts: destination.emergency_contacts ?? '',
      health_vaccinations: destination.health_vaccinations ?? '',
      score_wildlife: destination.score_wildlife == null ? '' : String(destination.score_wildlife),
      score_luxury: destination.score_luxury == null ? '' : String(destination.score_luxury),
      score_family: destination.score_family == null ? '' : String(destination.score_family),
      score_photography: destination.score_photography == null ? '' : String(destination.score_photography),
      score_adventure: destination.score_adventure == null ? '' : String(destination.score_adventure),
      score_budget_from: destination.score_budget_from == null ? '' : String(destination.score_budget_from),
      is_featured: Boolean(destination.is_featured),
      latitude: destination.latitude === null || destination.latitude === undefined ? '' : String(destination.latitude),
      location: destination.location ?? '',
      longitude: destination.longitude === null || destination.longitude === undefined ? '' : String(destination.longitude),
      main_image_url: destination.main_image_url ?? '',
      meta_description: destination.meta_description ?? '',
      meta_title: destination.meta_title ?? '',
      name: destination.name,
      og_image_url: destination.og_image_url ?? '',
      region: destination.region ?? '',
      safety_overview: destination.safety_overview ?? '',
      security_advice: destination.security_advice ?? '',
      short_description: destination.short_description ?? '',
      slug: destination.slug,
      status: destination.status ?? 'draft',
      travel_insurance_note: destination.travel_insurance_note ?? ''
    };
    lastCountry = form.country;
    activeTab = 'basics';
    attemptedSave = false;
    void loadMedia();
    slugManuallyEdited = true;
    modalOpen = true;
  };

  const closeModal = () => {
    modalOpen = false;
    editingDestination = null;
    slugManuallyEdited = false;
    form = emptyForm();
  };

  const numberOrNull = (value: unknown) => {
    const text = String(value ?? '').trim();
    return text === '' ? null : Number(text);
  };

  const payload = () => {
    const mainImage = form.main_image_url || null;

    return {
      guide: form.guide,
      banner_image_url: form.banner_image_url || null,
      country: form.country.trim() || 'Tanzania',
      description: form.description || null,
      emergency_contacts: form.emergency_contacts || null,
      health_vaccinations: form.health_vaccinations || null,
      score_wildlife: numberOrNull(form.score_wildlife),
      score_luxury: numberOrNull(form.score_luxury),
      score_family: numberOrNull(form.score_family),
      score_photography: numberOrNull(form.score_photography),
      score_adventure: numberOrNull(form.score_adventure),
      score_budget_from: numberOrNull(form.score_budget_from),
      // Keep the canonical `image_url` in sync with the main image so public
      // cards and detail pages (which read image_url) always have an image.
      image_url: mainImage,
      is_featured: form.is_featured,
      latitude: numberOrNull(form.latitude),
      location: form.location.trim() || null,
      longitude: numberOrNull(form.longitude),
      main_image_url: mainImage,
      meta_description: form.meta_description || null,
      meta_title: form.meta_title || null,
      name: form.name.trim(),
      og_image_url: form.og_image_url || null,
      region: form.region.trim() || null,
      safety_overview: form.safety_overview || null,
      security_advice: form.security_advice || null,
      short_description: form.short_description || null,
      slug: form.slug.trim(),
      status: form.status,
      travel_insurance_note: form.travel_insurance_note || null
    };
  };

  const saveDestination = async () => {
    if (saving) return;
    attemptedSave = true;
    // Each guard names the step that owns the field, so a blocked save moves the
    // operator to the problem instead of just refusing.
    if (nameError) return failOn('basics', nameError);
    if (slugError) return failOn('basics', slugError);
    if (countryError) return failOn('place', countryError);
    if (coordError) return failOn('place', coordError);
    if (scoreError) return failOn('ratings', scoreError);
    saving = true;

    try {
      if (editingDestination) {
        await api.destinations.update(editingDestination.id, payload());
        showToast('Destination updated successfully.');
      } else {
        await api.destinations.create(payload());
        showToast('Destination created successfully.');
      }

      closeModal();
      await loadDestinations();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to save destination.', 'error');
    } finally {
      saving = false;
    }
  };

  const openDeleteConfirm = (destination: Destination) => {
    destinationToDelete = destination;
    confirmOpen = true;
  };

  const deleteDestination = async () => {
    if (!destinationToDelete) return;
    deleting = true;

    try {
      await api.destinations.remove(destinationToDelete.id);
      showToast('Destination deleted successfully.');
      confirmOpen = false;
      destinationToDelete = null;
      await loadDestinations();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to delete destination.', 'error');
    } finally {
      deleting = false;
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  };

  onMount(loadDestinations);
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
<AdminPageHeader
  eyebrow="Tour Management"
  title="Destinations"
  description="Manage countries, regions, destination pages, featured states, image assets, and SEO metadata."
  actionLabel="New Destination"
  actionIcon={Plus}
  on:action={openCreateModal}
/>

<AdminToolbar className="grid gap-3 md:grid-cols-[1fr_190px_auto] md:items-end">
  <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
    <span>Search</span>
    <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
      <Search size={16} class="text-ink/45" />
      <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Search destinations..." onkeydown={(event) => event.key === 'Enter' && loadDestinations()} />
    </span>
  </CmsLabel>

  <AdminSelect label="Status" name="status_filter" bind:value={status} options={[{ label: 'All statuses', value: 'all' }, ...statusOptions]} />

  <AdminButton variant="secondary" on:click={loadDestinations}>Apply</AdminButton>
</AdminToolbar>

{#if loading}
  <LoadingState message="Loading destinations..." />
{:else if error}
  <ErrorState message={error} />
{:else if rows.length === 0}
  <AdminEmptyState
    title="No destinations found"
    message="Create your first Key2africa destination to start building public destination pages and tour filters."
    actionLabel="Create destination"
    on:action={openCreateModal}
  />
{:else}
  <!-- Phones: one card per destination, no sideways scrolling. -->
  <div class="grid gap-3 md:hidden">
    {#each rows as destination (destination.id)}
      <article class="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="break-words font-semibold text-ink">{destination.name}</h3>
            <p class="mt-0.5 truncate text-xs text-ink/50">{[destination.region, destination.country].filter(Boolean).join(' · ') || destination.slug}</p>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1.5">
            <StatusBadge status={destination.status} />
            {#if destination.is_featured}<span class="rounded-full bg-goldfinch-gold/15 px-2 py-0.5 text-[10px] font-semibold text-heading ring-1 ring-goldfinch-gold/30">Featured</span>{/if}
          </div>
        </div>
        <p class="mt-2 line-clamp-2 text-xs leading-5 text-ink/60">{destination.short_description || destination.location || ''}</p>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span class="text-[11px] text-ink/45">Updated {formatDate(destination.updated_at ?? destination.created_at)}</span>
          <div class="flex gap-2">
            <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm" type="button" onclick={() => openEditModal(destination)}><Edit size={14} />Edit</CmsButton>
            <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm" type="button" aria-label={`Delete ${destination.name}`} onclick={() => openDeleteConfirm(destination)}><Trash2 size={14} /></CmsButton>
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
            <CmsTable.Head class="px-4 py-3 font-semibold">Name</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Country</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Safari region</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Status</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Featured</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Updated</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 text-right font-semibold">Actions</CmsTable.Head>
          </CmsTable.Row>
        </CmsTable.Header>
        <CmsTable.Body class="divide-y divide-ink/10">
          {#each rows as destination}
            <CmsTable.Row class="transition hover:bg-sand/25">
              <CmsTable.Cell class="w-[34%] max-w-0 px-4 py-4">
                <div class="truncate font-semibold text-ink">{destination.name}</div>
                <p class="mt-1 truncate text-xs text-ink/55">{destination.short_description || destination.location || destination.slug}</p>
              </CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4 text-ink/65">{destination.country || '-'}</CmsTable.Cell>
              <CmsTable.Cell class="max-w-0 truncate px-4 py-4 text-ink/65">{destination.region || '-'}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4"><StatusBadge status={destination.status} /></CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4">
                {#if destination.is_featured}
                  <span class="inline-flex rounded-full bg-goldfinch-gold/15 px-2.5 py-1 text-xs font-semibold text-heading ring-1 ring-goldfinch-gold/30">Featured</span>
                {:else}
                  <span class="text-xs text-ink/45">No</span>
                {/if}
              </CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4 text-ink/65">{formatDate(destination.updated_at ?? destination.created_at)}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4">
                <div class="flex justify-end gap-2">
                  <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openEditModal(destination)}>
                    <Edit size={14} />
                    Edit
                  </CmsButton>
                  <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDeleteConfirm(destination)}>
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
</div>

{#if modalOpen}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) closeModal(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog cms-category-dialog gap-0 overflow-hidden p-0" style="width:min(calc(100vw - 2rem),72rem);max-width:none">
      <CmsDialog.Title class="sr-only">{editingDestination ? editingDestination.name : 'Create destination'}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Edit the destination step by step. Save your changes or close to return to the list.</CmsDialog.Description>
      <form class="cms-editor-form" novalidate on:submit|preventDefault={saveDestination}>
        <header class="cms-editor-header">
          <div class="flex min-w-0 items-center gap-3">
            <span class="cms-editor-emblem"><MapPin size={20} /></span>
            <div class="min-w-0"><p>DESTINATION EDITOR</p><h2 class="truncate">{form.name.trim() || (editingDestination ? editingDestination.name : 'Create a destination')}</h2></div>
          </div>
          <div class="flex items-center gap-3">
            {#if editingDestination?.status === 'published'}<a href={destinationHref(editingDestination)} target="_blank" rel="noopener noreferrer" class="hidden items-center gap-1.5 text-xs font-semibold text-ink/65 underline-offset-4 hover:text-heading hover:underline sm:inline-flex">View page <ExternalLink size={13} /><span class="sr-only"> (opens in a new tab)</span></a>{/if}
            <StatusBadge status={form.status} />
            <CmsButton variant="ghost" size="icon" aria-label="Close destination editor" onclick={closeModal}><X size={19} /></CmsButton>
          </div>
        </header>
        <div class="cms-editor-workspace">
          <EditorNavigation sections={visibleTabs} active={activeTab} errors={tabError} onNavigate={(key) => selectTab(key as TabKey)} />
          <div class="cms-editor-canvas" bind:this={bodyEl}>
            <div class="cms-editor-section-heading"><p>STEP {String(stepIndex + 1).padStart(2, '0')} / {String(visibleTabs.length).padStart(2, '0')}</p><h3>{visibleTabs[stepIndex]?.[2]}</h3><span>{STEP_NOTES[activeTab]}</span></div>
            <!-- Panels are CSS-hidden, never unmounted: the guide editor and the
                 translations panel would otherwise rebuild and lose unsaved edits. -->

            <!-- ── Essentials ─────────────────────────────────────────────── -->
            <div class="cms-form-panel grid gap-5" class:hidden={activeTab !== 'basics'}>
              <section class="cms-form-section grid gap-5">
                <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Basic information</p>
                <div class="grid gap-4 md:grid-cols-2">
                  <div class="grid gap-1.5">
                    <AdminFormInput label="Destination name" name="name" required bind:value={form.name} placeholder="Serengeti National Park" />
                    {#if attemptedSave && nameError}<span class="text-[11px] font-semibold text-clay">{nameError}</span>{/if}
                  </div>
                  <CmsLabel class="grid gap-1.5">
                    <span class="text-[13px] font-semibold text-ink/65">Page URL</span>
                    <CmsInput class="h-11 rounded-md border border-ink/15 bg-black/[0.02] px-3.5 text-sm text-ink outline-none transition hover:border-ink/25 focus:border-forest focus:bg-surface focus:ring-2 focus:ring-forest/20" name="slug" bind:value={form.slug} oninput={() => (slugManuallyEdited = true)} />
                    {#if attemptedSave && slugError}<span class="text-[11px] font-semibold text-clay">{slugError}</span>{:else}<span class="text-[11px] text-ink/40">/destinations/{form.slug || 'page-url'} · made from the name until you edit it.</span>{/if}
                  </CmsLabel>
                </div>
                <div class="grid gap-1.5">
                  <AdminTextArea label="Short description" name="short_description" bind:value={form.short_description} rows={3} counter={160} maxlength={300} placeholder="Endless plains, the Great Migration and Africa's big cats, in Tanzania's most famous park." />
                  <span class="text-[11px] text-ink/45">One or two sentences: the summary on destination cards and the line under the title on the page.</span>
                </div>
              </section>
              <section class="cms-form-section grid gap-5">
                <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Publishing</p>
                <div class="grid gap-4 md:grid-cols-2">
                  <AdminSelect label="Status" name="status" bind:value={form.status} options={statusOptions} />
                  <CmsLabel class="flex items-center gap-3 self-end rounded-md border border-ink/10 bg-surface px-4 py-3 text-sm font-semibold text-ink">
                    <Switch bind:checked={form.is_featured} aria-label="Featured destination" />
                    Featured destination
                  </CmsLabel>
                </div>
                <p class="-mt-2 text-xs text-ink/45">Published destinations appear on /destinations, in menus and in tour filters. Featured ones are picked first for the "Your next discovery" spot and home page highlights.</p>
              </section>
            </div>

            <!-- ── Place & map ────────────────────────────────────────────── -->
            <div class="cms-form-panel" class:hidden={activeTab !== 'place'}>
              <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div class="grid content-start gap-5">
                  <section class="cms-form-section grid gap-5">
                    <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Where it is</p>
                    <div class="grid gap-1.5">
                      <PlaceSelect label="Country" name="country" required options={DESTINATION_COUNTRIES} bind:value={form.country} onchange={changeCountry} hint="Shown on the card photo and in the page header, and used by the Country filter on /destinations." />
                      {#if attemptedSave && countryError}<span class="text-[11px] font-semibold text-clay">{countryError}</span>{/if}
                    </div>
                    <PlaceSelect label="Safari region" name="region" options={regionOptions} bind:value={form.region} emptyLabel="Not set" placeholder="Choose a safari region…" hint={form.country === 'Tanzania' ? 'The label above the name on cards, and the Safari region filter on /destinations (Northern, Southern, Western circuit, Zanzibar & coast).' : 'The label above the name on destination cards, and part of the page header.'} />
                    {#if tidyUp}
                      <div class="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-[12.5px] leading-5 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                        <p><strong>“{form.region}”</strong> is an administrative region, so cards would read “{form.region.toUpperCase()}” instead of the safari region. Use <strong>{tidyUp.safariRegion}</strong> here and move <strong>{tidyUp.area}</strong> to the administrative region?</p>
                        <CmsButton variant="outline" type="button" class="h-9 shrink-0 gap-1.5 bg-white text-xs" onclick={applyTidyUp}><WandSparkles size={14} />Fix it</CmsButton>
                      </div>
                    {/if}
                    <AreaSelect name="location" country={form.country} bind:value={form.location} hint="Starts the page's location line." />
                  </section>
                  <section class="cms-form-section grid gap-5">
                    <div>
                      <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">On the map</p>
                      <p class="mt-1 text-xs text-ink/55">Adds a “See the location” link to the page. Copy the two numbers from Google Maps (right-click the spot).</p>
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                      <AdminFormInput label="Latitude" name="latitude" type="number" step="any" bind:value={form.latitude} placeholder="-2.3333" />
                      <AdminFormInput label="Longitude" name="longitude" type="number" step="any" bind:value={form.longitude} placeholder="34.8333" />
                    </div>
                    {#if coordError}<p class="-mt-2 text-xs font-semibold text-clay">{coordError}</p>{:else if mapLink}<a href={mapLink} target="_blank" rel="noopener noreferrer" class="-mt-2 inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-forest underline-offset-4 hover:underline">Check the spot on Google Maps <ExternalLink size={12} /><span class="sr-only"> (opens in a new tab)</span></a>{/if}
                  </section>
                </div>
                <aside class="lg:sticky lg:top-0 lg:self-start">
                  <DestinationPreview name={form.name} country={form.country} region={form.region} location={form.location} summary={form.short_description || form.description} image={form.main_image_url} />
                </aside>
              </div>
            </div>

            <!-- ── Story & guide ──────────────────────────────────────────── -->
            <div class="cms-form-panel grid gap-5" class:hidden={activeTab !== 'overview'}>
              <section class="cms-form-section grid gap-5">
                <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Overview</p>
                <AdminRichText label="Description" name="description" bind:value={form.description} rows={10} hint="The Overview section of the destination page." placeholder="What it is like to be there: the landscape, the wildlife, when to go and why it belongs on a Tanzania safari." />
              </section>
              <section class="cms-form-section grid gap-5">
                <DestinationGuideEditor bind:blocks={form.guide} />
              </section>
            </div>

            <!-- ── Health & safety ────────────────────────────────────────── -->
            <div class="cms-form-panel grid gap-5" class:hidden={activeTab !== 'safety'}>
              <section class="cms-form-section grid gap-5">
                <div>
                  <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Health & safety</p>
                  <p class="mt-1 text-xs text-ink/55">A “Health &amp; safety” section on this page, also summarised on the /safety hub. Each blank field is left out.</p>
                </div>
                <AdminRichText label="Safety overview" name="safety_overview" bind:value={form.safety_overview} rows={6} placeholder="Is it safe? An honest, reassuring overview." />
                <div class="grid gap-4 md:grid-cols-2">
                  <AdminRichText label="Health & vaccinations" name="health_vaccinations" bind:value={form.health_vaccinations} rows={6} placeholder="Malaria, yellow fever and anything else to arrange before travelling." />
                  <AdminRichText label="Security advice" name="security_advice" bind:value={form.security_advice} rows={6} placeholder="Sensible precautions for this area." />
                </div>
                <div class="grid gap-4 md:grid-cols-2">
                  <AdminRichText label="Travel insurance note" name="travel_insurance_note" bind:value={form.travel_insurance_note} rows={5} />
                  <AdminTextArea label="Emergency contacts" name="emergency_contacts" bind:value={form.emergency_contacts} rows={4} placeholder="Park HQ, nearest hospital, flying doctors…" />
                </div>
              </section>
            </div>

            <!-- ── Ratings ────────────────────────────────────────────────── -->
            <div class="cms-form-panel grid gap-5" class:hidden={activeTab !== 'ratings'}>
              <section class="cms-form-section grid gap-5">
                <div>
                  <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Our ratings</p>
                  <p class="mt-1 text-xs text-ink/55">Honest scores from 0 to 10, shown as bars in the page's “At a glance” box and compared on /destination-scores. A blank score is hidden.</p>
                </div>
                <div class="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  {#each SCORES as [key, title] (key)}
                    {@const raw = String(form[key] ?? '').trim()}
                    {@const value = Number(raw)}
                    <div class="grid gap-2">
                      <AdminFormInput label={`${title} (0–10)`} name={key} type="number" min={0} step="any" bind:value={form[key]} placeholder="—" />
                      <div class="flex items-center gap-2" aria-hidden="true">
                        <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10"><span class={`block h-full rounded-full ${raw && value >= 0 && value <= 10 ? 'bg-forest' : 'bg-transparent'}`} style={`width:${raw && value >= 0 && value <= 10 ? value * 10 : 0}%`}></span></span>
                        <span class="w-10 text-right text-[11px] tabular-nums text-ink/50">{raw ? `${raw}/10` : 'hidden'}</span>
                      </div>
                    </div>
                  {/each}
                  <div class="grid content-start gap-2">
                    <AdminFormInput label="Budget from (USD per person)" name="score_budget_from" type="number" min={0} step="any" bind:value={form.score_budget_from} placeholder="—" />
                    <span class="text-[11px] text-ink/45">A typical starting price per person, on /destination-scores.</span>
                  </div>
                </div>
                {#if scoreError}<p class="-mt-1 text-xs font-semibold text-clay">{scoreError}</p>{/if}
              </section>
            </div>

            <!-- ── Photography ────────────────────────────────────────────── -->
            <div class="cms-form-panel grid gap-5" class:hidden={activeTab !== 'media'}>
              <section class="cms-form-section grid gap-5">
                <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Photography</p>
                <div class="grid gap-6 lg:grid-cols-2">
                  <div class="grid content-start gap-3">
                    <div>
                      <h3 class="text-base font-semibold text-ink">Main image</h3>
                      <p class="mt-1 text-sm text-ink/55">Destination cards on /destinations, the home page and menus. Also the page header when there is no banner.</p>
                    </div>
                    <MediaPicker label="Main image" media={mediaItems} uploadFolder="destinations" aspect="aspect-[1.4]" bind:value={form.main_image_url} />
                  </div>
                  <div class="grid content-start gap-3">
                    <div>
                      <h3 class="text-base font-semibold text-ink">Banner image</h3>
                      <p class="mt-1 text-sm text-ink/55">The wide header at the top of the destination page. Empty uses the main image.</p>
                    </div>
                    <MediaPicker label="Banner image" media={mediaItems} uploadFolder="destinations" aspect="aspect-[21/9]" bind:value={form.banner_image_url} />
                  </div>
                </div>
              </section>
            </div>

            <!-- ── Search & sharing ───────────────────────────────────────── -->
            <div class="cms-form-panel grid gap-5" class:hidden={activeTab !== 'seo'}>
              <section class="cms-form-section grid gap-5">
                <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">SEO</p>
                <div class="grid gap-4 md:grid-cols-2">
                  <div class="grid content-start gap-4">
                    <AdminFormInput label="SEO title" name="meta_title" bind:value={form.meta_title} counter={60} placeholder={form.name ? `${form.name} | Tanzania safari guide` : 'Falls back to the destination name.'} />
                    <AdminTextArea label="SEO description" name="meta_description" bind:value={form.meta_description} rows={3} counter={160} placeholder="Falls back to the short description." />
                  </div>
                  <MediaPicker label="Social / Open Graph image" media={mediaItems} uploadFolder="destinations" aspect="aspect-[1.91]" bind:value={form.og_image_url} />
                </div>
                <p class="text-xs text-ink/45">All optional. Empty fields fall back to the name, the short description and the banner or main image.</p>
              </section>
            </div>

            <!-- ── Translations (saved destinations only: needs an id) ───── -->
            {#if editingDestination}
              <div class:hidden={activeTab !== 'translations'}>
                <AdminTranslationTabs entityType="destinations" entityId={editingDestination.id} on:toast={(event) => showToast(event.detail.message, event.detail.type ?? 'success')} />
              </div>
            {/if}
          </div>
        </div>
        <footer class="cms-editor-footer">
          <span class="cms-save-note">{form.status === 'draft' ? 'Draft · Not visible on your website' : form.status === 'published' ? 'Changes will be visible on your website' : 'Archived · Hidden from your website'}</span>
          <div class="cms-editor-footer-actions">
            {#if stepIndex > 0}<CmsButton variant="ghost" class="cms-editor-back" aria-label="Previous step" onclick={() => selectTab(visibleTabs[stepIndex - 1][0])}><ArrowLeft size={14} /><span>Back</span></CmsButton>{/if}
            {#if stepIndex < visibleTabs.length - 1}<CmsButton variant="outline" onclick={() => selectTab(visibleTabs[stepIndex + 1][0])}>Continue<ArrowRight size={14} /></CmsButton>{/if}
            <CmsButton variant="default" type="submit" disabled={saving} class="gap-2 px-5"><Save size={14} />{saving ? 'Saving…' : form.status === 'draft' ? 'Save draft' : editingDestination ? 'Save changes' : 'Create destination'}</CmsButton>
          </div>
        </footer>
      </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title="Delete destination"
  message={`Delete "${destinationToDelete?.name ?? 'this destination'}"? This will soft delete it when supported by the database.`}
  on:cancel={() => {
    confirmOpen = false;
    destinationToDelete = null;
  }}
  on:confirm={deleteDestination}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting destination...
  </div>
{/if}
