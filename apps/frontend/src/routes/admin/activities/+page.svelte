<script lang="ts">
  import EditorNavigation from '$lib/admin/components/admin/EditorNavigation.svelte';
  import { Switch } from '$lib/components/ui/switch';
  import * as CmsDialog from '$lib/components/ui/dialog';
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsTable from '$lib/components/ui/table';
  import { Button as CmsButton } from '$lib/components/ui/button';

  import { onMount } from 'svelte';
  import {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    CircleDollarSign,
    Compass,
    Edit,
    FileText,
    Images,
    Languages,
    MapPin,
    Plus,
    Route,
    Save,
    ScrollText,
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
  import AdminRichText from '$lib/admin/components/admin/AdminRichText.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import AdminTranslationTabs from '$lib/admin/components/admin/AdminTranslationTabs.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';
  import { hasRichContent, toMetaText } from '$lib/admin/richText';
  import type { Activity } from '$lib/admin/types';
  import { coversMonth, monthRange, seasonTone, type Season } from '$lib/seasons';

  type TabKey = 'basics' | 'where' | 'tours' | 'story' | 'pricing' | 'media' | 'seo' | 'translations';
  type Toast = { id: string; message: string; type: 'error' | 'success' };
  type DestinationOption = { id: string; name: string; region?: string | null; status?: string };
  type TourOption = { id: string; title: string; status?: string };
  type MediaItem = { file_name: string; file_url: string; id: string; thumbnail_url?: string | null };

  /** Same stepped editor as Categories: one concern per step, Save always in reach. */
  const TABS = [
    ['basics', FileText, 'Essentials'],
    ['where', MapPin, 'Where & when'],
    ['tours', Route, 'Tours'],
    ['story', ScrollText, 'Story & highlights'],
    ['pricing', CircleDollarSign, 'Pricing'],
    ['media', Images, 'Photography'],
    ['seo', Search, 'Search & sharing'],
    ['translations', Languages, 'Translations']
  ] as const;

  const STEP_HINTS: Record<TabKey, string> = {
    basics: 'Name the activity and say what kind of experience it is.',
    where: 'Where travellers can do it, and the best time of year.',
    tours: 'The safari packages that include this activity.',
    story: 'What it involves, why we recommend it, and the moments to look forward to.',
    pricing: 'An indicative “from” price. Leave it blank to show no price.',
    media: 'The photos used on cards and at the top of the activity page.',
    seo: 'How the activity appears in search results and when shared.',
    translations: 'The activity in every language the site offers.'
  };

  const categoryOptions = [
    { label: 'Wildlife', value: 'wildlife' },
    { label: 'Adventure', value: 'adventure' },
    { label: 'Cultural', value: 'cultural' },
    { label: 'Water', value: 'water' },
    { label: 'Trekking', value: 'trekking' },
    { label: 'Relaxation', value: 'relaxation' }
  ];
  const difficultyOptions = [
    { label: 'Not set', value: '' },
    { label: 'Easy', value: 'easy' },
    { label: 'Moderate', value: 'moderate' },
    { label: 'Challenging', value: 'challenging' },
    { label: 'Strenuous', value: 'strenuous' }
  ];
  const statusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' }
  ];
  const PRICE_UNITS = ['Per person', 'Per couple', 'Per group', 'Per vehicle', 'Per day'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MAX_HIGHLIGHTS = 20;
  const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const categoryLabel = (value?: string | null) => categoryOptions.find((option) => option.value === value)?.label ?? '—';

  type ActivityForm = {
    name: string;
    slug: string;
    category: string;
    difficulty: string;
    badge: string;
    duration_label: string;
    status: 'draft' | 'published' | 'archived';
    sort_order: string;
    is_featured: boolean;
    destination_ids: string[];
    location_label: string;
    best_months: number[];
    tour_ids: string[];
    description: string;
    why_we_recommend: string;
    highlights: string[];
    price_from: string;
    currency: string;
    price_unit: string;
    hero_image_url: string;
    image_url: string;
    meta_title: string;
    meta_description: string;
    og_image_url: string;
  };

  const emptyForm = (sortOrder = 0): ActivityForm => ({
    name: '',
    slug: '',
    category: 'wildlife',
    difficulty: '',
    badge: '',
    duration_label: '',
    status: 'draft',
    sort_order: String(sortOrder),
    is_featured: false,
    destination_ids: [],
    location_label: '',
    best_months: [],
    tour_ids: [],
    description: '',
    why_we_recommend: '',
    highlights: [''],
    price_from: '',
    currency: 'USD',
    price_unit: '',
    hero_image_url: '',
    image_url: '',
    meta_title: '',
    meta_description: '',
    og_image_url: ''
  });

  let rows: Activity[] = [];
  let destinations: DestinationOption[] = [];
  let tours: TourOption[] = [];
  let seasons: Season[] = [];
  let mediaItems: MediaItem[] = [];
  let loading = true;
  let saving = false;
  let deleting = false;
  let opening = false;
  let error = '';
  let search = '';
  let statusFilter = 'all';
  let modalOpen = false;
  let confirmOpen = false;
  let editing: Activity | null = null;
  let toDelete: Activity | null = null;
  let form = emptyForm();
  let toasts: Toast[] = [];
  let activeTab: TabKey = 'basics';
  let bodyEl: HTMLDivElement;
  let attemptedSave = false;
  let slugManuallyEdited = false;
  let destinationSearch = '';
  let tourSearch = '';

  const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  $: if (modalOpen && !slugManuallyEdited) form.slug = slugify(form.name);

  $: visibleTabs = TABS.filter(([key]) => key !== 'translations' || editing);
  $: stepIndex = visibleTabs.findIndex(([key]) => key === activeTab);

  // A price field may hold a number (number input) or text; never call .trim() on a number.
  const numberOrNull = (value: unknown) => {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : NaN;
  };
  const cleanHighlights = () => form.highlights.map((item) => String(item ?? '').trim()).filter(Boolean);

  $: nameError = form.name.trim().length < 2 ? 'Give the activity a name of at least 2 characters.' : '';
  $: slugError = !SLUG_RE.test(form.slug.trim()) ? 'Page URL: lowercase letters, numbers and single hyphens, e.g. hot-air-balloon-safari.' : '';
  $: priceValue = numberOrNull(form.price_from);
  $: priceError = Number.isNaN(priceValue) || (priceValue != null && priceValue < 0) ? 'Enter the price as a number, e.g. 550, or leave it blank.' : '';
  $: currencyError = !/^[A-Za-z]{3}$/.test(form.currency.trim()) ? 'Currency is a 3-letter code, e.g. USD.' : '';
  $: publishNeedsWhere = form.status === 'published' && !form.destination_ids.length;
  $: publishNeedsStory = form.status === 'published' && !hasRichContent(form.description);
  $: tabError = {
    basics: attemptedSave && Boolean(nameError || slugError),
    where: attemptedSave && publishNeedsWhere,
    tours: false,
    story: attemptedSave && publishNeedsStory,
    pricing: Boolean(priceError || currencyError),
    media: false,
    seo: false,
    translations: false
  } as Record<TabKey, boolean>;

  $: destinationMatches = destinations.filter((d) => `${d.name} ${d.region ?? ''}`.toLowerCase().includes(destinationSearch.trim().toLowerCase()));
  $: tourMatches = tours.filter((t) => t.title.toLowerCase().includes(tourSearch.trim().toLowerCase()));
  $: destinationName = (id: string) => destinations.find((d) => d.id === id)?.name ?? 'Unknown destination';
  $: priceUnitOptions = [
    { label: 'Not set', value: '' },
    ...PRICE_UNITS.map((unit) => ({ label: unit, value: unit })),
    ...(form.price_unit && !PRICE_UNITS.includes(form.price_unit) ? [{ label: form.price_unit, value: form.price_unit }] : [])
  ];

  const selectTab = (tab: TabKey) => {
    activeTab = tab;
    bodyEl?.scrollTo({ top: 0 });
  };
  const failOn = (tab: TabKey, message: string) => {
    selectTab(tab);
    showToast(message, 'error');
  };
  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => (toasts = toasts.filter((toast) => toast.id !== id)), 3500);
  };
  const dismissToast = (event: CustomEvent<string>) => (toasts = toasts.filter((toast) => toast.id !== event.detail));

  // ── Loading ──────────────────────────────────────────────────────────────
  const loadActivities = async () => {
    loading = true;
    error = '';
    try {
      const res = await api.activities.list({ search, status: statusFilter, limit: 200 });
      rows = res.data.items as Activity[];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unable to load activities.';
    } finally {
      loading = false;
    }
  };

  const loadLinks = async () => {
    const [d, t, s] = await Promise.allSettled([
      api.destinations.list({ status: 'all', limit: 200 }),
      api.tours.list({ status: 'all', limit: 200, view: 'summary' }),
      api.seasons.list({ status: 'published', limit: 24 })
    ]);
    if (d.status === 'fulfilled') destinations = (d.value.data.items as unknown as DestinationOption[]).sort((a, b) => a.name.localeCompare(b.name));
    if (t.status === 'fulfilled') tours = (t.value.data.items as unknown as TourOption[]).sort((a, b) => a.title.localeCompare(b.title));
    if (s.status === 'fulfilled') seasons = s.value.data.items as unknown as Season[];
  };

  const loadMedia = async () => {
    if (mediaItems.length) return;
    try {
      const res = await api.media.list({ file_type: 'image', limit: 200 });
      mediaItems = (res.data.items as unknown as MediaItem[]).filter((m) => m.file_url);
    } catch {
      /* the pickers still accept an upload or a pasted URL */
    }
  };

  // ── Open / close ─────────────────────────────────────────────────────────
  const openCreateModal = () => {
    editing = null;
    const nextSort = rows.reduce((max, row) => Math.max(max, Number(row.sort_order ?? 0)), 0) + 10;
    form = emptyForm(nextSort);
    activeTab = 'basics';
    attemptedSave = false;
    slugManuallyEdited = false;
    destinationSearch = '';
    tourSearch = '';
    modalOpen = true;
    void loadMedia();
  };

  // The list row is a light projection; load the full record so saving never
  // blanks fields the list doesn't carry.
  const openEditModal = async (row: Activity) => {
    if (opening) return;
    opening = true;
    try {
      const res = await api.activities.get(row.slug);
      const a = { ...row, ...(res.data as Activity) };
      const links = [...(a.activity_destinations ?? [])].sort((x, y) => Number(Boolean(y.is_primary)) - Number(Boolean(x.is_primary)) || (x.sort_order ?? 0) - (y.sort_order ?? 0));
      const destinationIds = links.map((link) => link.destination_id);
      if (!destinationIds.length && a.destination_id) destinationIds.push(a.destination_id);
      editing = a;
      form = {
        name: a.name ?? '',
        slug: a.slug ?? '',
        category: a.category ?? 'wildlife',
        difficulty: a.difficulty ?? '',
        badge: a.badge ?? '',
        duration_label: a.duration_label ?? '',
        status: (a.status as ActivityForm['status']) ?? 'draft',
        sort_order: String(a.sort_order ?? 0),
        is_featured: Boolean(a.is_featured),
        destination_ids: destinationIds,
        location_label: a.location_label ?? '',
        best_months: Array.isArray(a.best_months) ? a.best_months.map(Number).filter((m) => m >= 1 && m <= 12) : [],
        tour_ids: (a.tour_activities ?? []).map((link) => link.tour_id),
        description: a.description ?? '',
        why_we_recommend: a.why_we_recommend ?? '',
        highlights: a.highlights?.length ? [...a.highlights] : [''],
        price_from: a.price_from != null ? String(a.price_from) : '',
        currency: a.currency || 'USD',
        price_unit: a.price_unit ?? '',
        hero_image_url: a.hero_image_url ?? '',
        image_url: a.image_url ?? '',
        meta_title: a.meta_title || a.seo_title || '',
        meta_description: a.meta_description ?? '',
        og_image_url: a.og_image_url ?? ''
      };
      activeTab = 'basics';
      attemptedSave = false;
      slugManuallyEdited = true;
      destinationSearch = '';
      tourSearch = '';
      modalOpen = true;
      void loadMedia();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Unable to load this activity.', 'error');
    } finally {
      opening = false;
    }
  };

  const closeModal = () => {
    modalOpen = false;
    editing = null;
    form = emptyForm();
    activeTab = 'basics';
    attemptedSave = false;
  };

  // ── Destinations (primary first) ─────────────────────────────────────────
  const toggleDestination = (id: string) => {
    form.destination_ids = form.destination_ids.includes(id) ? form.destination_ids.filter((x) => x !== id) : [...form.destination_ids, id];
  };
  const makePrimary = (id: string) => {
    form.destination_ids = [id, ...form.destination_ids.filter((x) => x !== id)];
  };

  // ── Tours ────────────────────────────────────────────────────────────────
  const toggleTour = (id: string) => {
    form.tour_ids = form.tour_ids.includes(id) ? form.tour_ids.filter((x) => x !== id) : [...form.tour_ids, id];
  };

  // ── Best time, picked from the Seasons module (like tour categories) ─────
  const seasonMonths = (season: Season) => Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => coversMonth(season, m));
  const seasonPicked = (season: Season, picked: number[]) => seasonMonths(season).every((m) => picked.includes(m));
  const toggleSeason = (season: Season) => {
    const months = seasonMonths(season);
    form.best_months = seasonPicked(season, form.best_months)
      ? form.best_months.filter((m) => !months.includes(m))
      : [...new Set([...form.best_months, ...months])].sort((a, b) => a - b);
  };
  const toggleMonth = (month: number) => {
    form.best_months = form.best_months.includes(month) ? form.best_months.filter((m) => m !== month) : [...form.best_months, month].sort((a, b) => a - b);
  };

  // ── Highlights ───────────────────────────────────────────────────────────
  const addHighlight = () => {
    if (form.highlights.length < MAX_HIGHLIGHTS) form.highlights = [...form.highlights, ''];
  };
  const removeHighlight = (index: number) => {
    const next = form.highlights.filter((_, i) => i !== index);
    form.highlights = next.length ? next : [''];
  };
  const moveHighlight = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= form.highlights.length) return;
    const next = [...form.highlights];
    [next[index], next[target]] = [next[target], next[index]];
    form.highlights = next;
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const payload = () => {
    const text = (value: string) => value.trim() || null;
    return {
      name: form.name.trim(),
      slug: form.slug.trim(),
      category: form.category,
      difficulty: form.difficulty || null,
      badge: text(form.badge),
      duration_label: text(form.duration_label),
      status: form.status,
      sort_order: Number(form.sort_order) || 0,
      is_featured: form.is_featured,
      destination_ids: form.destination_ids,
      location_label: text(form.location_label),
      best_months: [...form.best_months].sort((a, b) => a - b),
      tour_ids: form.tour_ids,
      description: hasRichContent(form.description) ? form.description : null,
      why_we_recommend: hasRichContent(form.why_we_recommend) ? form.why_we_recommend : null,
      highlights: cleanHighlights(),
      price_from: priceValue,
      currency: form.currency.trim().toUpperCase() || 'USD',
      price_unit: text(form.price_unit),
      hero_image_url: form.hero_image_url.trim(),
      image_url: form.image_url.trim(),
      og_image_url: form.og_image_url.trim(),
      meta_title: text(form.meta_title),
      meta_description: text(form.meta_description)
    };
  };

  const saveActivity = async () => {
    if (saving) return;
    attemptedSave = true;
    // Each guard names the step that owns the field, so a blocked save moves
    // the editor there instead of just refusing.
    if (nameError) return failOn('basics', nameError);
    if (slugError) return failOn('basics', slugError);
    if (priceError) return failOn('pricing', priceError);
    if (currencyError) return failOn('pricing', currencyError);
    if (publishNeedsWhere) return failOn('where', 'Choose at least one destination before publishing — or save it as a draft.');
    if (publishNeedsStory) return failOn('story', 'Add a description before publishing — or save it as a draft.');
    saving = true;
    try {
      if (editing) {
        await api.activities.update(editing.id, payload());
        showToast('Activity updated successfully.');
      } else {
        await api.activities.create(payload());
        showToast('Activity created successfully.');
      }
      closeModal();
      await loadActivities();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Unable to save the activity.', 'error');
    } finally {
      saving = false;
    }
  };

  const openDeleteConfirm = (row: Activity) => {
    toDelete = row;
    confirmOpen = true;
  };
  const deleteActivity = async () => {
    if (!toDelete) return;
    deleting = true;
    try {
      await api.activities.remove(toDelete.id);
      showToast('Activity deleted successfully.');
      confirmOpen = false;
      toDelete = null;
      await loadActivities();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Unable to delete the activity.', 'error');
    } finally {
      deleting = false;
    }
  };

  // ── List helpers ─────────────────────────────────────────────────────────
  const whereLabel = (row: Activity) => {
    const count = row.activity_destinations?.length ?? (row.destination_id ? 1 : 0);
    const primary = row.destinations?.name;
    if (!count) return 'No destination';
    return count > 1 ? `${primary ?? 'Several'} +${count - 1}` : (primary ?? '1 destination');
  };
  const tourCount = (row: Activity) => row.tour_activities?.length ?? 0;
  const formatDate = (value?: string) => (value ? new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '-');

  onMount(() => {
    void loadActivities();
    void loadLinks();
  });
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
<AdminPageHeader
  eyebrow="Safaris & destinations"
  title="Activities"
  description="Experiences travellers can add to a trip — linked to the destinations where they happen and the tours that include them."
  actionLabel="New Activity"
  actionIcon={Plus}
  on:action={openCreateModal}
/>

<AdminToolbar className="grid gap-3 md:grid-cols-[1fr_190px_auto] md:items-end">
  <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
    <span>Search</span>
    <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
      <Search size={16} class="text-ink/45" />
      <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Search activities..." onkeydown={(event) => event.key === 'Enter' && loadActivities()} />
    </span>
  </CmsLabel>
  <AdminSelect label="Status" name="status_filter" bind:value={statusFilter} options={[{ label: 'All statuses', value: 'all' }, ...statusOptions]} />
  <AdminButton variant="secondary" on:click={loadActivities}>Apply</AdminButton>
</AdminToolbar>

{#if loading}
  <LoadingState message="Loading activities..." />
{:else if error}
  <ErrorState message={error} />
{:else if rows.length === 0}
  <AdminEmptyState
    title="No activities yet"
    message="Add the experiences travellers can enjoy — game drives, balloon safaris, walking safaris, cultural visits — and link them to destinations and tours."
    actionLabel="Create activity"
    on:action={openCreateModal}
  />
{:else}
  <!-- Phones: one card per activity, no sideways scrolling. -->
  <div class="grid gap-3 md:hidden">
    {#each rows as row (row.id)}
      <article class="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="break-words font-semibold text-ink">{row.name}</h3>
            <p class="mt-0.5 truncate text-xs text-ink/50">{categoryLabel(row.category)}{row.duration_label ? ` · ${row.duration_label}` : ''}</p>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1.5">
            <StatusBadge status={row.status} />
            {#if row.is_featured}<span class="rounded-full bg-goldfinch-gold/15 px-2 py-0.5 text-[10px] font-semibold text-heading ring-1 ring-goldfinch-gold/30">Featured</span>{/if}
          </div>
        </div>
        <p class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/60"><span class="inline-flex items-center gap-1"><MapPin size={12} />{whereLabel(row)}</span><span class="inline-flex items-center gap-1"><Route size={12} />{tourCount(row)} {tourCount(row) === 1 ? 'tour' : 'tours'}</span></p>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span class="text-[11px] text-ink/45">Updated {formatDate(row.updated_at ?? row.created_at)}</span>
          <div class="flex gap-2">
            <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm" type="button" disabled={opening} onclick={() => openEditModal(row)}><Edit size={14} />Edit</CmsButton>
            <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm" type="button" aria-label={`Delete ${row.name}`} onclick={() => openDeleteConfirm(row)}><Trash2 size={14} /></CmsButton>
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
            <CmsTable.Head class="px-4 py-3 font-semibold">Activity</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Where</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Tours</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Status</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Updated</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 text-right font-semibold">Actions</CmsTable.Head>
          </CmsTable.Row>
        </CmsTable.Header>
        <CmsTable.Body class="divide-y divide-ink/10">
          {#each rows as row (row.id)}
            <CmsTable.Row class="transition hover:bg-sand/25">
              <CmsTable.Cell class="w-[34%] max-w-0 px-4 py-4">
                <div class="flex items-center gap-2 truncate font-semibold text-ink">{#if row.is_featured}<Star size={13} class="shrink-0 fill-goldfinch-gold text-goldfinch-gold" />{/if}<span class="truncate">{row.name}</span></div>
                <p class="mt-1 truncate text-xs text-ink/55">{categoryLabel(row.category)}{row.duration_label ? ` · ${row.duration_label}` : ''}{row.description ? ` · ${toMetaText(row.description, 90)}` : ''}</p>
              </CmsTable.Cell>
              <CmsTable.Cell class="max-w-0 truncate px-4 py-4 text-ink/65">{whereLabel(row)}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4 text-ink/65">{tourCount(row)}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4"><StatusBadge status={row.status} /></CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4 text-ink/65">{formatDate(row.updated_at ?? row.created_at)}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4">
                <div class="flex justify-end gap-2">
                  <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" disabled={opening} onclick={() => openEditModal(row)}><Edit size={14} />Edit</CmsButton>
                  <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDeleteConfirm(row)}><Trash2 size={14} />Delete</CmsButton>
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
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog cms-category-dialog gap-0 p-0 overflow-hidden" style="width:min(calc(100vw - 2rem),72rem);max-width:none">
      <CmsDialog.Title class="sr-only">{editing ? editing.name : 'Create activity'}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <form class="cms-editor-form" novalidate on:submit|preventDefault={saveActivity}>
        <header class="cms-editor-header"><div class="flex items-center gap-3"><span class="cms-editor-emblem"><Compass size={20} /></span><div><p>ACTIVITY EDITOR</p><h2>{editing ? editing.name : 'Create an activity'}</h2></div></div><div class="flex items-center gap-4"><StatusBadge status={form.status} /><CmsButton variant="ghost" size="icon" aria-label="Close activity editor" onclick={closeModal}><X size={19} /></CmsButton></div></header>
        <div class="cms-editor-workspace">
          <EditorNavigation sections={visibleTabs} active={activeTab} errors={tabError} onNavigate={(key) => selectTab(key as TabKey)} />
          <div class="cms-editor-canvas" bind:this={bodyEl}>
            <div class="cms-editor-section-heading"><p>STEP {String(stepIndex + 1).padStart(2, '0')} / {String(visibleTabs.length).padStart(2, '0')}</p><h3>{visibleTabs[stepIndex]?.[2]}</h3><span>{STEP_HINTS[activeTab]}</span></div>

        <!-- Panels are CSS-hidden, not unmounted, so rich-text editors keep their state. -->

        <!-- ── Essentials ─────────────────────────────────────────────── -->
        <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'basics'}>
          <section class="cms-form-section grid gap-5">
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">The activity</p>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="grid gap-1.5">
                <AdminFormInput label="Activity name" name="name" required bind:value={form.name} placeholder="Hot-air balloon safari" counter={120} />
                {#if attemptedSave && nameError}<span class="text-[11px] font-semibold text-clay">{nameError}</span>{/if}
              </div>
              <CmsLabel class="grid gap-1.5">
                <span class="text-[13px] font-semibold text-ink/65">Page URL</span>
                <CmsInput class="h-11 rounded-md border border-ink/15 bg-black/[0.02] px-3.5 text-sm text-ink outline-none transition hover:border-ink/25 focus:border-forest focus:bg-surface focus:ring-2 focus:ring-forest/20" name="slug" bind:value={form.slug} oninput={() => (slugManuallyEdited = true)} />
                {#if attemptedSave && slugError}<span class="text-[11px] font-semibold text-clay">{slugError}</span>{:else}<span class="text-[11px] text-ink/40">Auto-generated from the name until you edit it.</span>{/if}
              </CmsLabel>
            </div>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <AdminSelect label="Category" name="category" bind:value={form.category} options={categoryOptions} />
              <AdminSelect label="Fitness level" name="difficulty" bind:value={form.difficulty} options={difficultyOptions} />
              <AdminFormInput label="Duration" name="duration_label" bind:value={form.duration_label} placeholder="3–4 hours · Full day" counter={80} />
              <AdminFormInput label="Badge (optional)" name="badge" bind:value={form.badge} placeholder="Once in a lifetime" counter={40} />
            </div>
          </section>

          <section class="cms-form-section grid gap-5">
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Publishing</p>
            <div class="grid gap-4 md:grid-cols-3">
              <AdminSelect label="Status" name="status" bind:value={form.status} options={statusOptions} />
              <AdminFormInput label="Sort order" name="sort_order" type="number" min={0} bind:value={form.sort_order} />
              <CmsLabel class="flex items-center gap-3 self-end rounded-md border border-ink/10 bg-surface px-4 py-3 text-sm font-semibold text-ink">
                <Switch bind:checked={form.is_featured} aria-label="Featured activity" />
                Featured activity
              </CmsLabel>
            </div>
            <p class="-mt-2 text-xs text-ink/45">Publishing needs at least one destination and a description. Featured activities are shown first; sort order sets the list position — lower first.</p>
          </section>
        </div>

        <!-- ── Where & when ───────────────────────────────────────────── -->
        <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'where'}>
          <section class="cms-form-section grid gap-4">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Destinations</p>
                <p class="mt-1 text-xs text-ink/55">Tick every place this can be done. The primary destination is the one shown first on cards.</p>
              </div>
              <span class="text-xs font-semibold text-ink/55">{form.destination_ids.length} selected</span>
            </div>
            {#if attemptedSave && publishNeedsWhere}<p class="text-xs font-semibold text-clay">Choose at least one destination before publishing.</p>{/if}

            {#if form.destination_ids.length}
              <div class="flex flex-wrap gap-2">
                {#each form.destination_ids as id, i (id)}
                  <span class={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${i === 0 ? 'border-deep-green bg-deep-green text-white' : 'border-ink/15 bg-surface text-ink/70'}`}>
                    {#if i === 0}<Star size={12} class="fill-current" />{/if}{destinationName(id)}
                    <button type="button" class="ml-0.5 opacity-70 hover:opacity-100" aria-label={`Remove ${destinationName(id)}`} on:click={() => toggleDestination(id)}><X size={12} /></button>
                  </span>
                {/each}
              </div>
            {/if}

            {#if !destinations.length}
              <p class="rounded-md border border-dashed border-ink/20 px-3 py-4 text-sm text-ink/55">No destinations yet. Add them under Destinations, then link them here.</p>
            {:else}
              <CmsInput class="h-10 rounded-md border border-ink/15 bg-black/[0.02] px-3 text-sm" placeholder="Filter destinations…" bind:value={destinationSearch} />
              <div class="grid max-h-80 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                {#each destinationMatches as d (d.id)}
                  {@const picked = form.destination_ids.includes(d.id)}
                  {@const primary = form.destination_ids[0] === d.id}
                  <div class={`flex items-center gap-2.5 rounded-md border px-3 py-2 transition ${picked ? 'border-forest/40 bg-forest/5' : 'border-ink/10 bg-surface'}`}>
                    <input type="checkbox" class="h-4 w-4 accent-forest" checked={picked} aria-label={`Include ${d.name}`} on:change={() => toggleDestination(d.id)} />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-ink">{d.name}</p>
                      <p class="truncate text-[11px] text-ink/45">{d.region || 'No region'}{d.status && d.status !== 'published' ? ` · ${d.status}` : ''}</p>
                    </div>
                    {#if picked}
                      {#if primary}
                        <span class="shrink-0 text-[10px] font-bold uppercase tracking-wide text-forest">Primary</span>
                      {:else}
                        <button type="button" class="shrink-0 rounded border border-ink/15 px-2 py-0.5 text-[10px] font-semibold text-ink/60 hover:border-forest/40 hover:text-heading" on:click={() => makePrimary(d.id)}>Make primary</button>
                      {/if}
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
            <AdminFormInput label="Meeting point or area (optional)" name="location_label" bind:value={form.location_label} placeholder="Central Serengeti (Seronera)" counter={160} />
          </section>

          <section class="cms-form-section grid gap-3">
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Best time</p>
            {#if seasons.length}
              <p class="text-xs text-ink/45">Pick by season — each one ticks all of its months. Fine-tune single months below.</p>
              <div class="flex flex-wrap gap-2">
                {#each seasons as season (season.id ?? season.name)}
                  {@const picked = seasonPicked(season, form.best_months)}
                  <CmsButton variant="ghost" type="button" aria-pressed={picked} class={`h-auto flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition ${picked ? 'border-deep-green ring-2 ring-deep-green/20' : 'border-ink/12 hover:border-forest/40'} ${seasonTone(season.tone).card}`} onclick={() => toggleSeason(season)}>
                    <span class="flex items-center gap-1.5 text-xs font-bold text-heading"><span class={`size-2.5 rounded-full ${seasonTone(season.tone).swatch}`}></span>{season.name}</span>
                    <span class="text-[11px] font-medium text-ink/55">{monthRange(season)}</span>
                  </CmsButton>
                {/each}
              </div>
            {/if}
            <div class="flex flex-wrap gap-1.5">
              {#each MONTHS as month, monthIndex}
                {@const selected = form.best_months.includes(monthIndex + 1)}
                <CmsButton variant="ghost" type="button" aria-pressed={selected} class={`h-9 rounded-full border px-3 text-xs font-bold transition ${selected ? 'border-deep-green bg-deep-green text-white' : 'border-ink/15 bg-surface text-ink/65 hover:border-forest/40 hover:text-heading'}`} onclick={() => toggleMonth(monthIndex + 1)}>{month.slice(0, 3)}</CmsButton>
              {/each}
            </div>
          </section>
        </div>

        <!-- ── Tours ──────────────────────────────────────────────────── -->
        <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'tours'}>
          <section class="cms-form-section grid gap-4">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Included in tours</p>
                <p class="mt-1 text-xs text-ink/55">Tick the safari packages that include this activity. New links are added at the end of each tour’s activity list.</p>
              </div>
              <span class="text-xs font-semibold text-ink/55">{form.tour_ids.length} selected</span>
            </div>
            {#if !tours.length}
              <p class="rounded-md border border-dashed border-ink/20 px-3 py-4 text-sm text-ink/55">No tours yet. Once you add tours, link this activity to them here.</p>
            {:else}
              <CmsInput class="h-10 rounded-md border border-ink/15 bg-black/[0.02] px-3 text-sm" placeholder="Filter tours…" bind:value={tourSearch} />
              <div class="grid max-h-96 gap-1.5 overflow-y-auto pr-1">
                {#each tourMatches as t (t.id)}
                  {@const picked = form.tour_ids.includes(t.id)}
                  <label class={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 transition ${picked ? 'border-forest/40 bg-forest/5' : 'border-ink/10 bg-surface'}`}>
                    <input type="checkbox" class="h-4 w-4 accent-forest" checked={picked} on:change={() => toggleTour(t.id)} />
                    <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">{t.title}</span>
                    {#if t.status && t.status !== 'published'}<span class="shrink-0 text-[10px] uppercase tracking-wide text-ink/40">{t.status}</span>{/if}
                  </label>
                {/each}
              </div>
            {/if}
          </section>
        </div>

        <!-- ── Story & highlights ─────────────────────────────────────── -->
        <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'story'}>
          <section class="cms-form-section grid gap-5">
            <AdminRichText label="Description" name="description" bind:value={form.description} rows={8} placeholder="What the activity involves, how long it takes and what to expect." />
            {#if attemptedSave && publishNeedsStory}<p class="-mt-3 text-xs font-semibold text-clay">Add a description before publishing.</p>{/if}
            <AdminRichText label="Why we recommend it" name="why_we_recommend" bind:value={form.why_we_recommend} rows={4} headings="none" placeholder="Our honest take — who will love it, and when it's worth it." />
          </section>
          <section class="cms-form-section grid gap-3">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Highlights</p>
                <p class="mt-1 text-xs text-ink/55">One short point per line — up to {MAX_HIGHLIGHTS}. Empty lines are ignored.</p>
              </div>
              <CmsButton variant="ghost" type="button" class="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink/10 bg-surface px-3 text-xs font-bold text-ink disabled:opacity-40" disabled={form.highlights.length >= MAX_HIGHLIGHTS} onclick={addHighlight}><Plus size={14} />Add</CmsButton>
            </div>
            {#each form.highlights as _item, index}
              <div class="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                <CmsInput class="h-11 rounded-md border border-ink/15 bg-black/[0.02] px-3.5 text-sm text-ink outline-none focus:border-forest focus:bg-surface focus:ring-2 focus:ring-forest/20" aria-label={`Highlight ${index + 1}`} placeholder={index === 0 ? 'e.g. Sunrise over the Serengeti plains' : ''} bind:value={form.highlights[index]} />
                <div class="flex gap-1.5">
                  <CmsButton variant="ghost" type="button" class="grid h-10 w-9 place-items-center rounded-md border border-ink/10 bg-surface text-ink/60 disabled:opacity-30" aria-label={`Move highlight ${index + 1} up`} disabled={index === 0} onclick={() => moveHighlight(index, -1)}><ArrowUp size={14} /></CmsButton>
                  <CmsButton variant="ghost" type="button" class="grid h-10 w-9 place-items-center rounded-md border border-ink/10 bg-surface text-ink/60 disabled:opacity-30" aria-label={`Move highlight ${index + 1} down`} disabled={index === form.highlights.length - 1} onclick={() => moveHighlight(index, 1)}><ArrowDown size={14} /></CmsButton>
                  <CmsButton variant="ghost" type="button" class="inline-flex h-10 items-center rounded-md border border-red-200 bg-surface px-3 text-red-700 hover:bg-red-50" aria-label={`Remove highlight ${index + 1}`} onclick={() => removeHighlight(index)}><Trash2 size={14} /></CmsButton>
                </div>
              </div>
            {/each}
          </section>
        </div>

        <!-- ── Pricing ────────────────────────────────────────────────── -->
        <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'pricing'}>
          <section class="cms-form-section grid gap-4">
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">From price</p>
            <div class="grid gap-4 sm:grid-cols-3">
              <div class="grid gap-1.5">
                <AdminFormInput label="Price from" name="price_from" type="number" min={0} step="any" bind:value={form.price_from} placeholder="550" />
                {#if priceError}<span class="text-[11px] font-semibold text-clay">{priceError}</span>{/if}
              </div>
              <div class="grid gap-1.5">
                <AdminFormInput label="Currency" name="currency" bind:value={form.currency} placeholder="USD" />
                {#if currencyError}<span class="text-[11px] font-semibold text-clay">{currencyError}</span>{/if}
              </div>
              <AdminSelect label="Price is" name="price_unit" bind:value={form.price_unit} options={priceUnitOptions} />
            </div>
            <p class="text-xs text-ink/45">An indicative starting price. Leave it blank if you quote this activity case by case.</p>
          </section>
        </div>

        <!-- ── Photography ────────────────────────────────────────────── -->
        <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'media'}>
          <section class="cms-form-section grid gap-5 lg:grid-cols-2">
            <div class="grid content-start gap-3">
              <div><h3 class="text-base font-semibold text-ink">Hero image</h3><p class="mt-1 text-sm text-ink/55">Wide photo at the top of the activity page.</p></div>
              <MediaPicker label="Hero image" media={mediaItems} uploadFolder="activities" aspect="aspect-[16/9]" bind:value={form.hero_image_url} />
            </div>
            <div class="grid content-start gap-3">
              <div><h3 class="text-base font-semibold text-ink">Card image</h3><p class="mt-1 text-sm text-ink/55">Used on activity cards and menus. Falls back to the hero image.</p></div>
              <MediaPicker label="Card image" media={mediaItems} uploadFolder="activities" aspect="aspect-[4/3]" bind:value={form.image_url} />
            </div>
          </section>
        </div>

        <!-- ── Search & sharing ───────────────────────────────────────── -->
        <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'seo'}>
          <section class="cms-form-section grid gap-5">
            <div class="grid gap-4 md:grid-cols-2">
              <div class="grid content-start gap-4">
                <AdminFormInput label="SEO title" name="meta_title" bind:value={form.meta_title} counter={60} placeholder="Falls back to the activity name." />
                <AdminTextArea label="SEO description" name="meta_description" bind:value={form.meta_description} rows={3} counter={160} placeholder="Falls back to the start of the description." />
              </div>
              <MediaPicker label="Social / Open Graph image" media={mediaItems} uploadFolder="activities/seo" aspect="aspect-[16/9]" bind:value={form.og_image_url} />
            </div>
            <p class="text-xs text-ink/45">All optional. Empty fields fall back to the activity name, description and hero image.</p>
          </section>
        </div>

        <!-- ── Translations (saved activities only — needs an id) ─────── -->
        {#if editing}
          <div class:hidden={activeTab !== 'translations'}>
            <AdminTranslationTabs entityType="activities" entityId={editing.id} on:toast={(event) => showToast(event.detail.message, event.detail.type ?? 'success')} />
          </div>
        {/if}

          </div>
        </div>
        <footer class="cms-editor-footer">
          <span class="cms-save-note">{form.status === 'draft' ? 'Draft · Not visible on your website' : form.status === 'published' ? 'Changes will be visible on your website' : 'Archived · Hidden from your website'}</span>
          <div class="cms-editor-footer-actions">
            {#if stepIndex > 0}<CmsButton variant="ghost" class="cms-editor-back" aria-label="Previous section" onclick={() => selectTab(visibleTabs[stepIndex - 1][0])}><ArrowLeft size={14} /><span>Back</span></CmsButton>{/if}
            {#if stepIndex < visibleTabs.length - 1}<CmsButton variant="outline" onclick={() => selectTab(visibleTabs[stepIndex + 1][0])}>Continue<ArrowRight size={14} /></CmsButton>{/if}
            <CmsButton variant="default" type="submit" disabled={saving} class="gap-2 px-5"><Save size={14} />{saving ? 'Saving…' : form.status === 'draft' ? 'Save draft' : editing ? 'Save changes' : 'Create activity'}</CmsButton>
          </div>
        </footer>
      </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title="Delete activity"
  message={`Delete "${toDelete?.name ?? 'this activity'}"? It disappears from the website and from any tour that includes it.`}
  on:cancel={() => {
    confirmOpen = false;
    toDelete = null;
  }}
  on:confirm={deleteActivity}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">Deleting activity...</div>
{/if}
