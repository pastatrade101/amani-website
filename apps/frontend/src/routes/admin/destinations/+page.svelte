<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsTable from '$lib/components/ui/table';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { Edit, Plus, Search, Trash2, X } from '@lucide/svelte';
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
      location: form.location || null,
      longitude: numberOrNull(form.longitude),
      main_image_url: mainImage,
      meta_description: form.meta_description || null,
      meta_title: form.meta_title || null,
      name: form.name.trim(),
      og_image_url: form.og_image_url || null,
      region: form.region || null,
      safety_overview: form.safety_overview || null,
      security_advice: form.security_advice || null,
      short_description: form.short_description || null,
      slug: form.slug.trim(),
      status: form.status,
      travel_insurance_note: form.travel_insurance_note || null
    };
  };

  const saveDestination = async () => {
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
            <CmsTable.Head class="px-4 py-3 font-semibold">Region</CmsTable.Head>
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
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (closeModal)(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),64rem);max-width:none">
      <CmsDialog.Title class="sr-only">{editingDestination ? editingDestination.name : 'Create Destination'}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <div class="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-ink/10 bg-surface p-6 shadow-sm" >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">{editingDestination ? 'Edit destination' : 'New destination'}</p>
          <h2 class="mt-2 text-2xl font-bold tracking-normal text-ink">{editingDestination ? editingDestination.name : 'Create Destination'}</h2>
        </div>
        <CmsButton variant="ghost" class="grid h-10 w-10 place-items-center rounded-2xl border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand" type="button" aria-label="Close modal" onclick={closeModal}>
          <X size={18} />
        </CmsButton>
      </div>

      <form class="mt-6 grid gap-5" on:submit|preventDefault={saveDestination}>
        <div class="grid gap-4 md:grid-cols-2">
          <AdminFormInput label="Name" name="name" bind:value={form.name} required />

          <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
            <span>Slug</span>
            <CmsInput
              class="h-11 rounded-2xl border border-ink/10 bg-surface px-3 text-sm outline-none shadow-sm transition focus:border-forest focus:ring-2 focus:ring-forest/15"
              name="slug"
              bind:value={form.slug}
              required
              oninput={() => (slugManuallyEdited = true)}
            />
          </CmsLabel>
        </div>

        <div class="grid gap-4 md:grid-cols-3">
          <AdminFormInput label="Country" name="country" bind:value={form.country} required />
          <AdminFormInput label="Region" name="region" bind:value={form.region} />
          <AdminFormInput label="Location" name="location" bind:value={form.location} />
        </div>

        <AdminTextArea label="Short description" name="short_description" bind:value={form.short_description} rows={3} placeholder="Concise destination summary for cards and search." />
        <AdminRichText label="Description" name="description" bind:value={form.description} rows={10} placeholder="Destination overview for the public page." />

        <div class="rounded-2xl border border-ink/10 bg-sand/20 p-4">
          <p class="text-sm font-bold text-ink">Health &amp; safety</p>
          <p class="mt-0.5 text-xs text-ink/55">Shown as a "Health &amp; safety" section on this destination's page and summarised on the /safety hub. Leave blank to hide.</p>
          <div class="mt-4 grid gap-4">
            <AdminRichText label="Safety overview" name="safety_overview" bind:value={form.safety_overview} rows={6} placeholder="Is it safe? An honest, reassuring overview." />
            <div class="grid gap-4 md:grid-cols-2">
              <AdminRichText label="Health & vaccinations" name="health_vaccinations" bind:value={form.health_vaccinations} rows={6} />
              <AdminRichText label="Security advice" name="security_advice" bind:value={form.security_advice} rows={6} />
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <AdminRichText label="Travel insurance note" name="travel_insurance_note" bind:value={form.travel_insurance_note} rows={5} />
              <AdminTextArea label="Emergency contacts" name="emergency_contacts" bind:value={form.emergency_contacts} rows={2} />
            </div>
          </div>
        </div>

        <div class="rounded-2xl border border-ink/10 bg-sand/20 p-4">
          <p class="text-sm font-bold text-ink">Destination scores</p>
          <p class="mt-0.5 text-xs text-ink/55">Honest 0–10 ratings shown on the /destination-scores page. Leave blank to hide.</p>
          <div class="mt-4 grid gap-4 sm:grid-cols-3">
            <AdminFormInput label="Wildlife (0–10)" name="score_wildlife" type="number" bind:value={form.score_wildlife} />
            <AdminFormInput label="Luxury (0–10)" name="score_luxury" type="number" bind:value={form.score_luxury} />
            <AdminFormInput label="Family (0–10)" name="score_family" type="number" bind:value={form.score_family} />
            <AdminFormInput label="Photography (0–10)" name="score_photography" type="number" bind:value={form.score_photography} />
            <AdminFormInput label="Adventure (0–10)" name="score_adventure" type="number" bind:value={form.score_adventure} />
            <AdminFormInput label="Budget from (USD pp)" name="score_budget_from" type="number" bind:value={form.score_budget_from} />
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminSelect label="Status" name="status" bind:value={form.status} options={statusOptions} />
          <AdminFormInput label="Latitude" name="latitude" type="number" step="any" bind:value={form.latitude} placeholder="-6.3690" />
          <AdminFormInput label="Longitude" name="longitude" type="number" step="any" bind:value={form.longitude} placeholder="34.8888" />
          <CmsLabel class="flex h-full min-h-[74px] items-center gap-3 rounded-2xl border border-ink/10 bg-sand/20 px-4 py-3 text-sm font-medium text-ink">
            <CmsCheckbox class="h-4 w-4 rounded border-ink/20 text-forest focus:ring-forest"  bind:checked={form.is_featured} />
            Featured destination
          </CmsLabel>
        </div>

        <div class="grid gap-4 lg:grid-cols-3">
          <section class="grid gap-4 rounded-xl border border-ink/10 bg-sand/20 p-4">
            <div>
              <h3 class="text-base font-semibold text-ink">Main image</h3>
              <p class="mt-1 text-sm text-ink/55">Used for destination cards and list views.</p>
            </div>
            <MediaPicker label="Main image" media={mediaItems} uploadFolder="destinations" bind:value={form.main_image_url} />
          </section>

          <section class="grid gap-4 rounded-xl border border-ink/10 bg-sand/20 p-4">
            <div>
              <h3 class="text-base font-semibold text-ink">Banner image</h3>
              <p class="mt-1 text-sm text-ink/55">Used for public destination page headers.</p>
            </div>
            <MediaPicker label="Banner image" media={mediaItems} uploadFolder="destinations" bind:value={form.banner_image_url} />
          </section>

          <section class="grid gap-4 rounded-xl border border-ink/10 bg-sand/20 p-4">
            <div>
              <h3 class="text-base font-semibold text-ink">Open Graph image</h3>
              <p class="mt-1 text-sm text-ink/55">Used when the destination is shared online.</p>
            </div>
            <MediaPicker label="Open Graph image" media={mediaItems} uploadFolder="destinations" bind:value={form.og_image_url} />
          </section>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <AdminFormInput label="SEO title" name="meta_title" bind:value={form.meta_title} />
          <AdminTextArea label="SEO description" name="meta_description" bind:value={form.meta_description} rows={3} />
        </div>

        <!-- Translations (existing destinations only — needs an id) -->
        {#if editingDestination}
          <AdminTranslationTabs
            entityType="destinations"
            entityId={editingDestination.id}
            on:toast={(event) => showToast(event.detail.message, event.detail.type ?? 'success')}
          />
        {/if}

        <div class="flex justify-end gap-3 pt-2">
          <AdminButton variant="secondary" type="button" on:click={closeModal}>Cancel</AdminButton>
          <AdminButton type="submit" disabled={saving}>
            {saving ? 'Saving...' : editingDestination ? 'Save Changes' : 'Create Destination'}
          </AdminButton>
        </div>
      </form>
    </div>
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
