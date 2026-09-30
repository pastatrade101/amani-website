<script lang="ts">
  import EditorNavigation from '$lib/admin/components/admin/EditorNavigation.svelte';
  import { Switch } from '$lib/components/ui/switch';
  import { ArrowLeft, ArrowRight, Save, Sparkles } from '@lucide/svelte';
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsTable from '$lib/components/ui/table';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import {
    ArrowDown,
    ArrowUp,
    Compass,
    Edit,
    FileText,
    Images,
    Languages,
    LayoutTemplate,
    Plus,
    Search,
    Trash2,
    X
  } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminFileUpload from '$lib/admin/components/admin/AdminFileUpload.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminStyleLandingEditor from '$lib/admin/components/admin/AdminStyleLandingEditor.svelte';
  import AdminRichText from '$lib/admin/components/admin/AdminRichText.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import AdminTranslationTabs from '$lib/admin/components/admin/AdminTranslationTabs.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';
  import { hasRichContent, toMetaText } from '$lib/admin/richText';
  import { coversMonth, monthRange, seasonTone, type Season } from '$lib/seasons';
  import {
    defaultStyleLandingContent,
    parseStyleLandingJson,
    type StyleLandingContent
  } from '$lib/admin/safariStyleLanding';

  type FitnessLevel = '' | 'easy' | 'moderate' | 'active' | 'challenging' | 'strenuous';

  type Category = {
    id: string;
    name: string;
    slug: string;
    short_description?: string | null;
    description?: string | null;
    who_its_for?: string | null;
    /** Legacy free text; read-only fallback until fitness_level is set. */
    fitness?: string | null;
    fitness_level?: FitnessLevel | null;
    min_days?: number | null;
    max_days?: number | null;
    best_months?: number[] | null;
    planning_notes?: Record<string, unknown> | null;
    landing_page_content?: StyleLandingContent | null;
    highlights?: string[] | null;
    icon_url?: string | null;
    image_url?: string | null;
    lottie_url?: string | null;
    status: 'draft' | 'published' | 'archived';
    is_featured?: boolean | null;
    sort_order: number;
    meta_title?: string | null;
    meta_description?: string | null;
    seo_image_url?: string | null;
    created_at?: string;
    updated_at?: string;
  };

  type CategoryForm = {
    best_months: number[];
    description: string;
    fitness_level: FitnessLevel;
    highlights: string[];
    icon_url: string;
    image_url: string;
    is_featured: boolean;
    lottie_url: string;
    max_days: string;
    meta_description: string;
    meta_title: string;
    min_days: string;
    name: string;
    seo_image_url: string;
    short_description: string;
    slug: string;
    sort_order: string;
    status: 'draft' | 'published' | 'archived';
    who_its_for: string;
    planning_costs: string;
    planning_route: string;
    landing_page_json: string;
  };

  type VisualType = 'none' | 'icon' | 'lottie';
  type LottieSource = 'upload' | 'url';
  type TabKey = 'basics' | 'landing' | 'travel' | 'media' | 'seo' | 'translations';

  /**
   * The form is long enough that one scroll was hiding the Save button, so it
   * is split across tabs. Translations is listed here but only rendered for a
   * saved category — it needs an id.
   */
  const TABS = [
    ['basics', FileText, 'Essentials'],
    ['travel', Compass, 'Travel details'],
    ['media', Images, 'Photography'],
    ['landing', LayoutTemplate, 'Page builder'],
    ['seo', Search, 'Search & sharing'],
    ['translations', Languages, 'Translations']
  ] as const;

  type MediaItem = { file_name: string; file_url: string; id: string; thumbnail_url?: string | null };

  type Toast = {
    id: string;
    message: string;
    type: 'error' | 'success';
  };

  const emptyForm = (): CategoryForm => ({
    best_months: [],
    description: '',
    fitness_level: '',
    highlights: [''],
    icon_url: '',
    image_url: '',
    is_featured: false,
    lottie_url: '',
    max_days: '',
    meta_description: '',
    meta_title: '',
    min_days: '',
    name: '',
    seo_image_url: '',
    short_description: '',
    slug: '',
    sort_order: '0',
    status: 'draft',
    who_its_for: '',
    planning_costs: '',
    planning_route: '',
    landing_page_json: JSON.stringify(defaultStyleLandingContent(), null, 2)
  });

  const statusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' }
  ];

  const fitnessOptions = [
    { label: 'None', value: '' },
    { label: 'Easy', value: 'easy' },
    { label: 'Moderate', value: 'moderate' },
    { label: 'Active', value: 'active' },
    { label: 'Challenging', value: 'challenging' },
    { label: 'Strenuous', value: 'strenuous' }
  ];

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const visualTypeOptions = [
    { label: 'None', value: 'none' },
    { label: 'Icon', value: 'icon' },
    { label: 'Lottie animation', value: 'lottie' }
  ];

  const lottieSourceOptions = [
    { label: 'Upload Lottie JSON', value: 'upload' },
    { label: 'Paste Lottie URL', value: 'url' }
  ];

  let landingEnabled = false;
  $: visibleTabs = TABS.filter(([key]) => key !== 'translations' || editingCategory);
  $: stepIndex = visibleTabs.findIndex(([key]) => key === activeTab);
  let rows: Category[] = [];
  let mediaItems: MediaItem[] = [];
  let loadingMedia = false;
  let loading = true;
  let saving = false;
  let deleting = false;
  let error = '';
  let search = '';
  let status = 'all';
  let modalOpen = false;
  let confirmOpen = false;
  let slugManuallyEdited = false;
  let editingCategory: Category | null = null;
  let categoryToDelete: Category | null = null;
  let form = emptyForm();
  let visualType: VisualType = 'none';
  let lastVisualType: VisualType = 'none';
  let lottieSource: LottieSource = 'upload';
  let toasts: Toast[] = [];
  let activeTab: TabKey = 'basics';
  let bodyEl: HTMLDivElement;
  /** Name and slug only go red once the operator has tried to save. */
  let attemptedSave = false;

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  $: if (modalOpen && !slugManuallyEdited) {
    form.slug = slugify(form.name);
  }

  // Switching the visual type discards the other type's value, so a category
  // can never carry both an icon and a Lottie at once.
  $: if (modalOpen && visualType !== lastVisualType) {
    form.icon_url = '';
    form.lottie_url = '';
    lastVisualType = visualType;
  }

  // Cross-field rule surfaced while typing, not on submit.
  $: daysError =
    form.min_days && form.max_days && Number(form.max_days) < Number(form.min_days)
      ? 'Maximum days must be greater than or equal to minimum days.'
      : '';

  /**
   * Name and slug used to be gated by the browser's own `required`/`pattern`.
   * Inactive tabs stay in the DOM (see the panel comments), so those controls
   * are present but unfocusable — Chrome then refuses to submit and reports it
   * only to the console, leaving Save looking dead. The form is `novalidate`
   * and these checks run in JS instead, mirroring the API exactly:
   * backend/src/schemas/categories.schema.ts:147-152.
   */
  const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  $: nameError = form.name.trim().length < 2 ? 'Name must be at least 2 characters.' : '';
  $: slugError =
    form.slug.trim().length < 2 || !SLUG_RE.test(form.slug.trim())
      ? 'Lowercase letters, numbers and single hyphens, e.g. wildlife-safari'
      : '';

  const selectTab = (tab: TabKey) => {
    activeTab = tab;
    // Each tab starts at its own top rather than inheriting the last one's scroll.
    bodyEl?.scrollTo({ top: 0 });
  };

  /** Save blocked by a field the operator cannot see: go to it, then explain. */
  const failOn = (tab: TabKey, message: string) => {
    selectTab(tab);
    showToast(message, 'error');
  };

  const loadMedia = async () => {
    if (mediaItems.length || loadingMedia) return;
    loadingMedia = true;
    try {
      const res = await api.media.list({ file_type: 'image', limit: 200 });
      mediaItems = (res.data.items as unknown as MediaItem[]).filter((m) => m.file_url);
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to load media library.', 'error');
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

  const loadCategories = async () => {
    loading = true;
    error = '';

    try {
      const response = await api.categories.list({
        limit: 50,
        search,
        status
      });
      rows = response.data.items as Category[];
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : 'Unable to load categories.';
    } finally {
      loading = false;
    }
  };

  const openCreateModal = async () => {
    editingCategory = null;
    landingEnabled = false;
    form = emptyForm();
    visualType = 'none';
    lastVisualType = visualType;
    lottieSource = 'upload';
    activeTab = 'basics';
    attemptedSave = false;
    slugManuallyEdited = false;
    modalOpen = true;
    void loadSeasons();
    await loadMedia();
  };

  const openEditModal = async (category: Category) => {
    editingCategory = category;
    landingEnabled = Boolean(category.landing_page_content);
    form = {
      best_months: Array.isArray(category.best_months) ? category.best_months.map(Number).filter((m) => m >= 1 && m <= 12) : [],
      description: category.description ?? '',
      fitness_level: (category.fitness_level ?? '') as FitnessLevel,
      highlights: Array.isArray(category.highlights) && category.highlights.length ? category.highlights.map(String) : [''],
      icon_url: category.icon_url ?? '',
      image_url: category.image_url ?? '',
      is_featured: Boolean(category.is_featured),
      lottie_url: category.lottie_url ?? '',
      max_days: category.max_days != null ? String(category.max_days) : '',
      meta_description: category.meta_description ?? '',
      meta_title: category.meta_title ?? '',
      min_days: category.min_days != null ? String(category.min_days) : '',
      name: category.name,
      seo_image_url: category.seo_image_url ?? '',
      short_description: category.short_description ?? '',
      slug: category.slug,
      sort_order: String(category.sort_order ?? 0),
      status: category.status ?? 'draft',
      who_its_for: category.who_its_for ?? '',
      planning_costs: String((category.planning_notes as Record<string, unknown> | null)?.costs ?? ''),
      planning_route: String((category.planning_notes as Record<string, unknown> | null)?.route ?? ''),
      landing_page_json: JSON.stringify(category.landing_page_content ?? defaultStyleLandingContent(category), null, 2)
    };
    visualType = category.lottie_url ? 'lottie' : category.icon_url ? 'icon' : 'none';
    lastVisualType = visualType;
    lottieSource = 'url';
    activeTab = 'basics';
    attemptedSave = false;
    slugManuallyEdited = true;
    modalOpen = true;
    void loadSeasons();
    await loadMedia();
  };

  const closeModal = () => {
    modalOpen = false;
    editingCategory = null;
    slugManuallyEdited = false;
    form = emptyForm();
    visualType = 'none';
    lastVisualType = visualType;
    lottieSource = 'upload';
    activeTab = 'basics';
    attemptedSave = false;
  };

  // Best months are picked from the published Seasons (CMS → Seasons), so a
  // category's timing always matches the "When should you go?" section.
  let seasons: Season[] = [];
  const loadSeasons = async () => {
    if (seasons.length) return;
    try {
      const res = await api.seasons.list({ status: 'published', limit: 24 });
      seasons = res.data.items as unknown as Season[];
    } catch {
      seasons = [];
    }
  };
  const seasonMonths = (season: Season) =>
    Array.from({ length: 12 }, (_, i) => i + 1).filter((month) => coversMonth(season, month));
  const seasonSelected = (season: Season, picked: number[]) => seasonMonths(season).every((month) => picked.includes(month));
  const toggleSeason = (season: Season) => {
    const months = seasonMonths(season);
    form.best_months = seasonSelected(season, form.best_months)
      ? form.best_months.filter((month) => !months.includes(month))
      : [...new Set([...form.best_months, ...months])].sort((a, b) => a - b);
  };

  const toggleMonth = (month: number) => {
    form.best_months = form.best_months.includes(month)
      ? form.best_months.filter((m) => m !== month)
      : [...form.best_months, month].sort((a, b) => a - b);
  };

  const moveHighlight = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= form.highlights.length) return;
    const next = [...form.highlights];
    [next[index], next[target]] = [next[target], next[index]];
    form.highlights = next;
  };

  // Highlights are individually editable bullets, matching the tours form. An
  // empty bullet is a placeholder row, not content, so it is dropped on save.
  const cleanHighlights = () =>
    form.highlights.map((item) => String(item ?? '').trim()).filter((item) => hasRichContent(item));

  const addHighlight = () => {
    form.highlights = [...form.highlights, ''];
  };

  const removeHighlight = (index: number) => {
    const next = form.highlights.filter((_, currentIndex) => currentIndex !== index);
    form.highlights = next.length ? next : [''];
  };

  $: landingPageValidation = parseStyleLandingJson(form.landing_page_json);
  $: landingPageError = landingPageValidation.errors[0] ?? '';

  /**
   * Which tabs hold something that would stop a save. Without this a blocking
   * error can sit on a panel the operator is not looking at, and the only
   * symptom is that Save appears to do nothing.
   */
  $: landingBlocked = landingEnabled && Boolean(form.landing_page_json.trim()) && landingPageValidation.errors.length > 0;
  $: tabError = {
    basics: attemptedSave && Boolean(nameError || slugError),
    landing: landingBlocked,
    travel: Boolean(daysError),
    media: false,
    seo: false,
    translations: false
  } as Record<TabKey, boolean>;

  /** SEO is all optional, so the tab says whether anything was actually set. */
  $: seoFilled = Boolean(form.meta_title || form.meta_description || form.seo_image_url);

  /**
   * What a generated template is built from. Everything already typed into the
   * form above, so "start from a template" produces a page about THIS style
   * rather than a generic one the operator has to rewrite from scratch.
   */
  $: landingSeed = {
    name: form.name,
    short_description: form.short_description,
    description: form.description,
    highlights: cleanHighlights(),
    image_url: form.image_url,
    best_months: form.best_months,
    planning_notes: { costs: form.planning_costs, route: form.planning_route }
  };

  // Legacy `fitness` free text is deliberately absent: the API no longer
  // accepts it, and leaving it out of the update payload is what keeps the
  // stored text intact as a public-page fallback.
  const payload = () => ({
    best_months: form.best_months,
    description: form.description || null,
    fitness_level: form.fitness_level || null,
    highlights: cleanHighlights(),
    icon_url: visualType === 'icon' ? form.icon_url || null : null,
    image_url: form.image_url.trim() || null,
    is_featured: form.is_featured,
    lottie_url: visualType === 'lottie' ? form.lottie_url || null : null,
    max_days: form.max_days ? Number(form.max_days) : null,
    meta_description: form.meta_description || null,
    meta_title: form.meta_title || null,
    min_days: form.min_days ? Number(form.min_days) : null,
    name: form.name.trim(),
    seo_image_url: form.seo_image_url.trim() || null,
    short_description: form.short_description.trim() || null,
    slug: form.slug.trim(),
    sort_order: Number(form.sort_order || 0),
    status: form.status,
    who_its_for: form.who_its_for || null,
    planning_notes:
      form.planning_costs.trim() || form.planning_route.trim()
        ? { costs: form.planning_costs.trim() || null, route: form.planning_route.trim() || null }
        : null,
    landing_page_content: landingEnabled ? landingPageValidation.data : null
  });

  const saveCategory = async () => {
    if (saving) return;
    attemptedSave = true;
    // Each guard names the tab that owns the field, so a blocked save moves the
    // operator to the problem instead of just refusing.
    if (nameError) {
      failOn('basics', nameError);
      return;
    }
    if (slugError) {
      failOn('basics', slugError);
      return;
    }
    if (daysError) {
      failOn('travel', daysError);
      return;
    }
    if (form.status === 'published' && !landingEnabled) { failOn('landing', 'Add a landing page before publishing this category. You can save it as a draft now.'); return; }
    if (form.status === 'published' && landingPageValidation.errors.length) {
      failOn('landing', `Landing page is incomplete: ${landingPageValidation.errors[0]}`);
      return;
    }
    if (landingEnabled && form.landing_page_json.trim() && landingPageValidation.errors.length) {
      failOn('landing', landingPageValidation.errors[0]);
      return;
    }
    saving = true;

    try {
      if (editingCategory) {
        await api.categories.update(editingCategory.id, payload());
        showToast('Category updated successfully.');
      } else {
        await api.categories.create(payload());
        showToast('Category created successfully.');
      }

      closeModal();
      await loadCategories();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to save category.', 'error');
    } finally {
      saving = false;
    }
  };

  const openDeleteConfirm = (category: Category) => {
    categoryToDelete = category;
    confirmOpen = true;
  };

  const deleteCategory = async () => {
    if (!categoryToDelete) return;
    deleting = true;

    try {
      await api.categories.remove(categoryToDelete.id);
      showToast('Category deleted successfully.');
      confirmOpen = false;
      categoryToDelete = null;
      await loadCategories();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to delete category.', 'error');
    } finally {
      deleting = false;
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  };

  onMount(loadCategories);
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
<AdminPageHeader
  eyebrow="Tour Management"
  title="Tour Categories"
  description="Manage tour package categories, visual badges, sort order, publishing status, and SEO metadata."
  actionLabel="New Category"
  actionIcon={Plus}
  on:action={openCreateModal}
/>

<AdminToolbar className="grid gap-3 md:grid-cols-[1fr_190px_auto] md:items-end">
  <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
    <span>Search</span>
    <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
      <Search size={16} class="text-ink/45" />
      <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Search categories..." onkeydown={(event) => event.key === 'Enter' && loadCategories()} />
    </span>
  </CmsLabel>

  <AdminSelect label="Status" name="status_filter" bind:value={status} options={[{ label: 'All statuses', value: 'all' }, ...statusOptions]} />

  <AdminButton variant="secondary" on:click={loadCategories}>Apply</AdminButton>
</AdminToolbar>

{#if loading}
  <LoadingState message="Loading categories..." />
{:else if error}
  <ErrorState message={error} />
{:else if rows.length === 0}
  <AdminEmptyState
    title="No categories found"
    message="Create your first tour category to organize Key2africa tour packages and prepare reusable CMS navigation."
    actionLabel="Create category"
    on:action={openCreateModal}
  />
{:else}
  <!-- Phones: one card per category, no sideways scrolling. -->
  <div class="grid gap-3 md:hidden">
    {#each rows as category (category.id)}
      <article class="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="break-words font-semibold text-ink">{category.name}</h3>
            <p class="mt-0.5 truncate text-xs text-ink/50">/{category.slug}</p>
          </div>
          <StatusBadge status={category.status} />
        </div>
        <p class="mt-2 line-clamp-2 text-xs leading-5 text-ink/60">{toMetaText(category.short_description || category.description || 'No description yet.', 160)}</p>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span class="text-[11px] text-ink/45">Sort {category.sort_order ?? 0} · {formatDate(category.updated_at ?? category.created_at)}</span>
          <div class="flex gap-2">
            <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm" type="button" onclick={() => openEditModal(category)}><Edit size={14} />Edit</CmsButton>
            <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm" type="button" aria-label={`Delete ${category.name}`} onclick={() => openDeleteConfirm(category)}><Trash2 size={14} /></CmsButton>
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
            <CmsTable.Head class="px-4 py-3 font-semibold">Slug</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Status</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Sort</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Updated</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 text-right font-semibold">Actions</CmsTable.Head>
          </CmsTable.Row>
        </CmsTable.Header>
        <CmsTable.Body class="divide-y divide-ink/10">
          {#each rows as category}
            <CmsTable.Row class="transition hover:bg-sand/25">
              <CmsTable.Cell class="w-[38%] max-w-0 px-4 py-4">
                <div class="truncate font-semibold text-ink">{category.name}</div>
                <p class="mt-1 truncate text-xs text-ink/55">{toMetaText(category.short_description || category.description || 'No description yet.', 120)}</p>
              </CmsTable.Cell>
              <CmsTable.Cell class="w-[20%] max-w-0 truncate px-4 py-4 text-ink/65">{category.slug}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4"><StatusBadge status={category.status} /></CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4 text-ink/65">{category.sort_order ?? 0}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4 text-ink/65">{formatDate(category.updated_at ?? category.created_at)}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4">
                <div class="flex justify-end gap-2">
                  <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openEditModal(category)}>
                    <Edit size={14} />
                    Edit
                  </CmsButton>
                  <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDeleteConfirm(category)}>
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
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog cms-category-dialog gap-0 p-0 overflow-hidden" style="width:min(calc(100vw - 2rem),72rem);max-width:none">
      <CmsDialog.Title class="sr-only">{editingCategory ? editingCategory.name : 'Create Tour Category'}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <form class="cms-editor-form" novalidate on:submit|preventDefault={saveCategory}>
        <header class="cms-editor-header"><div class="flex items-center gap-3"><span class="cms-editor-emblem"><LayoutTemplate size={20}/></span><div><p>CATEGORY EDITOR</p><h2>{editingCategory ? editingCategory.name : 'Create a category'}</h2></div></div><div class="flex items-center gap-4"><StatusBadge status={form.status}/><CmsButton variant="ghost" size="icon" aria-label="Close category editor" onclick={closeModal}><X size={19}/></CmsButton></div></header>
        <div class="cms-editor-workspace">
          <EditorNavigation sections={visibleTabs} active={activeTab} errors={tabError} onNavigate={(key) => selectTab(key as TabKey)}/>
          <div class="cms-editor-canvas" bind:this={bodyEl}>
            <div class="cms-editor-section-heading"><p>STEP {String(stepIndex + 1).padStart(2,'0')} / {String(visibleTabs.length).padStart(2,'0')}</p><h3>{visibleTabs[stepIndex]?.[2]}</h3><span>{activeTab === 'basics' ? 'Give this safari collection a clear identity.' : activeTab === 'landing' ? 'Shape the page your travellers will explore.' : activeTab === 'travel' ? 'Help travellers decide if this experience is right for them.' : activeTab === 'media' ? 'Choose the images that tell your story.' : activeTab === 'seo' ? 'Make a great first impression in search and on social.' : 'Make your content feel local, everywhere.'}</span></div>
        <!--
          Panels are CSS-hidden, never {#if}-unmounted. AdminStyleLandingEditor
          rebuilds a fresh template on mount and has no branch for a document
          that is non-empty but mid-edit (AdminStyleLandingEditor.svelte:48-53),
          so unmounting it would write that template back over the operator's
          page through bind:json. AdminTranslationTabs likewise refetches and
          replaces its draft on mount. The toggle therefore lives on a bare
          wrapper — putting `hidden` on an element that also carries a display
          utility would lose to it.
        -->

        <!-- ── Basics ────────────────────────────────────────────────────── -->
        <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'basics'}>
        <section class="cms-form-section grid gap-5">
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Basic information</p>

          <div class="grid gap-4 md:grid-cols-2">
            <div class="grid gap-1.5">
              <AdminFormInput label="Category name" name="name" required bind:value={form.name} placeholder="Wildlife Safari" />
              {#if attemptedSave && nameError}
                <span class="text-[11px] font-semibold text-clay">{nameError}</span>
              {/if}
            </div>

            <CmsLabel class="grid gap-1.5">
              <span class="text-[13px] font-semibold text-ink/65">Page URL</span>
              <CmsInput
                class="h-11 rounded-md border border-ink/15 bg-black/[0.02] px-3.5 text-sm text-ink outline-none transition hover:border-ink/25 focus:border-forest focus:bg-surface focus:ring-2 focus:ring-forest/20"
                name="slug"
                bind:value={form.slug}
                title="Lowercase letters, numbers and single hyphens, e.g. wildlife-safari"
                oninput={() => (slugManuallyEdited = true)}
              />
              {#if attemptedSave && slugError}
                <span class="text-[11px] font-semibold text-clay">{slugError}</span>
              {:else}
                <span class="text-[11px] text-ink/40">Auto-generated from the name until you edit it.</span>
              {/if}
            </CmsLabel>
          </div>

          <AdminTextArea
            label="Short description"
            name="short_description"
            bind:value={form.short_description}
            rows={2}
            maxlength={250}
            placeholder="Experience Tanzania's iconic wildlife destinations through expertly designed safari journeys."
          />

          <AdminRichText label="Description" name="description" bind:value={form.description} rows={7} placeholder="Full category introduction for the public experience page." />

          <AdminTextArea label="Who it's for" name="who_its_for" bind:value={form.who_its_for} rows={2} placeholder="Ideal for first-time safari travellers, couples, families and wildlife enthusiasts." />

        </section>

        <!--
          Publishing lives on Basics rather than behind its own tab: status arms
          the strictest save guard (a published style must have a complete
          landing page), so it should not be the one thing you can only see by
          leaving the tab you are working on.
        -->
        <section class="cms-form-section grid gap-5">
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Publishing</p>
          <div class="grid gap-4 md:grid-cols-3">
            <AdminSelect label="Status" name="status" bind:value={form.status} options={statusOptions} />
            <AdminFormInput label="Sort order" name="sort_order" type="number" min={0} bind:value={form.sort_order} />
            <CmsLabel class="flex items-center gap-3 self-end rounded-md border border-ink/10 bg-surface px-4 py-3 text-sm font-semibold text-ink">
              <Switch bind:checked={form.is_featured} aria-label="Featured category"/>
              Featured category
            </CmsLabel>
          </div>
          <p class="-mt-2 text-xs text-ink/45">Featured marks this category for homepage and promotional sections. Sort order only controls list position — lower first.</p>
        </section>
        </div>

        <!-- ── Landing page ──────────────────────────────────────────────── -->
        <div class:hidden={activeTab !== 'landing'}>
          {#if landingEnabled}
            <AdminStyleLandingEditor bind:json={form.landing_page_json} seed={landingSeed} on:toast={(e) => showToast(e.detail.message, e.detail.tone)}/>
          {:else}
            <div class="cms-builder-intro"><span class="cms-builder-icon"><LayoutTemplate size={30} strokeWidth={1.3}/></span><h3>A dedicated page for this experience</h3><p>Bring your category to life with a hero, trip ideas, planning advice and a clear call to action. Start from your category details and make each section your own.</p><CmsButton variant="default" class="h-10 gap-2 px-5" onclick={() => { form.landing_page_json = JSON.stringify(defaultStyleLandingContent(landingSeed), null, 2); landingEnabled = true; }}><Sparkles size={15}/>Set up landing page</CmsButton><small>Optional for drafts · Required to publish this category</small></div>
          {/if}
        </div>

        <!-- ── Travel ────────────────────────────────────────────────────── -->
        <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'travel'}>
        <section class="cms-form-section grid gap-5">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Travel information</p>
            <p class="mt-1 text-xs text-ink/55">Shown on the public /experiences/{form.slug || 'slug'} page. Leave blank to hide.</p>
          </div>

          <div class="grid gap-4 md:grid-cols-3">
            <AdminSelect label="Fitness level" name="fitness_level" bind:value={form.fitness_level} options={fitnessOptions} />
            <AdminFormInput label="Recommended minimum days" name="min_days" type="number" min={1} bind:value={form.min_days} placeholder="3" />
            <AdminFormInput label="Recommended maximum days" name="max_days" type="number" min={1} bind:value={form.max_days} placeholder="10" />
          </div>
          {#if daysError}
            <p class="-mt-2 text-xs font-semibold text-clay">{daysError}</p>
          {/if}
          {#if editingCategory?.fitness && !form.fitness_level}
            <p class="-mt-2 text-xs text-ink/45">
              Legacy fitness text — “{editingCategory.fitness}” — still shows publicly until you pick a level here.
            </p>
          {/if}

          <div class="grid gap-1.5">
            <span class="text-[13px] font-semibold text-ink/65">Best months</span>
            {#if seasons.length}
              <p class="text-xs text-ink/45">Pick by season — each one ticks all of its months. Fine-tune single months below.</p>
              <div class="flex flex-wrap gap-2">
                {#each seasons as season (season.id ?? season.name)}
                  {@const picked = seasonSelected(season, form.best_months)}
                  <CmsButton variant="ghost"
                    class={`h-auto flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition ${picked ? 'border-deep-green ring-2 ring-deep-green/20' : 'border-ink/12 hover:border-forest/40'} ${seasonTone(season.tone).card}`}
                    type="button"
                    aria-pressed={picked}
                    onclick={() => toggleSeason(season)}
                  >
                    <span class="flex items-center gap-1.5 text-xs font-bold text-heading"><span class={`size-2.5 rounded-full ${seasonTone(season.tone).swatch}`}></span>{season.name}</span>
                    <span class="text-[11px] font-medium text-ink/55">{monthRange(season)}</span>
                  </CmsButton>
                {/each}
              </div>
            {/if}
            <div class="flex flex-wrap gap-1.5">
              {#each MONTHS as month, monthIndex}
                {@const monthNumber = monthIndex + 1}
                {@const selected = form.best_months.includes(monthNumber)}
                <CmsButton variant="ghost"
                  class={`h-9 rounded-full border px-3 text-xs font-bold transition ${selected ? 'border-deep-green bg-deep-green text-white' : 'border-ink/15 bg-surface text-ink/65 hover:border-forest/40 hover:text-heading'}`}
                  type="button"
                  aria-pressed={selected}
                  onclick={() => toggleMonth(monthNumber)}
                >
                  {month}
                </CmsButton>
              {/each}
            </div>
          </div>

          <div class="grid gap-1.5">
              <div class="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <span class="text-[13px] font-semibold text-ink/65">Highlights</span>
                  <p class="mt-0.5 text-xs text-ink/45">Each item renders as its own ticked line.</p>
                </div>
                <CmsButton variant="ghost"
                  class="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink/10 bg-surface px-3 text-xs font-bold text-ink transition hover:border-forest/25 hover:bg-sand/55"
                  type="button"
                  onclick={addHighlight}
                >
                  <Plus size={14} /> Add
                </CmsButton>
              </div>

              <div class="grid gap-3">
                {#each form.highlights as _highlight, index}
                  <div class="grid gap-2 rounded-xl border border-ink/10 bg-surface p-3 sm:grid-cols-[1fr_auto] sm:items-start">
                    <AdminRichText
                      label={`Highlight ${index + 1}`}
                      name={`highlight_${index}`}
                      bind:value={form.highlights[index]}
                      rows={2}
                      headings="none"
                      placeholder="e.g. The Great Migration river crossings"
                    />
                    <div class="flex gap-1.5 sm:mt-6">
                      <CmsButton variant="ghost"
                        class="grid h-10 w-9 place-items-center rounded-md border border-ink/10 bg-surface text-ink/60 transition hover:text-heading disabled:opacity-30"
                        type="button"
                        aria-label={`Move highlight ${index + 1} up`}
                        disabled={index === 0}
                        onclick={() => moveHighlight(index, -1)}
                      >
                        <ArrowUp size={14} />
                      </CmsButton>
                      <CmsButton variant="ghost"
                        class="grid h-10 w-9 place-items-center rounded-md border border-ink/10 bg-surface text-ink/60 transition hover:text-heading disabled:opacity-30"
                        type="button"
                        aria-label={`Move highlight ${index + 1} down`}
                        disabled={index === form.highlights.length - 1}
                        onclick={() => moveHighlight(index, 1)}
                      >
                        <ArrowDown size={14} />
                      </CmsButton>
                      <CmsButton variant="ghost"
                        class="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-red-200 bg-surface px-3 text-xs font-bold text-red-700 transition hover:bg-red-50"
                        type="button"
                        onclick={() => removeHighlight(index)}
                      >
                        <Trash2 size={14} /> Remove
                      </CmsButton>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
        </section>

        <!--
          The two planning facts that have no home of their own. They sit with
          best months, trip length and fitness because they answer the same
          question; the parks a style visits are read from its published tours,
          so they cannot go stale.
        -->
        <section class="cms-form-section grid gap-5">
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">How to plan this style</p>
          <AdminRichText
            label="Travel costs — how to plan"
            name="planning_costs"
            bind:value={form.planning_costs}
            rows={4}
            placeholder="What a trip of this style typically costs and what drives the price. A short list often reads better than a paragraph — park fees, lodge standard, season, group size."
          />
          <AdminRichText
            label="Route planning — how to plan"
            name="planning_route"
            bind:value={form.planning_route}
            rows={4}
            placeholder="How the route is usually put together for this style — where to start, how long to stay, what to leave out."
          />
          <p class="-mt-1 text-xs text-ink/55">Both optional, and both take bullets. Each appears as its own card on the style page; leave one blank and it is hidden.</p>
        </section>
        </div>

        <!-- ── Media ─────────────────────────────────────────────────────── -->
        <div class:hidden={activeTab !== 'media'}>
        <section class="cms-form-section grid gap-5">
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Media</p>

          <div class="grid gap-4 lg:grid-cols-2">
            <div class="grid content-start gap-4">
              <div>
                <h3 class="text-base font-semibold text-ink">Category image</h3>
                <p class="mt-1 text-sm text-ink/55">Primary image for cards, headers and the Tours menu. Media Library, upload or URL.</p>
              </div>
              <MediaPicker label="Category image" media={mediaItems} uploadFolder="categories/images" aspect="aspect-[16/9]" bind:value={form.image_url} />
            </div>

            <div class="grid content-start gap-4">
              <div>
                <h3 class="text-base font-semibold text-ink">Icon or animation</h3>
                <p class="mt-1 text-sm text-ink/55">Optional badge visual. One type at a time.</p>
              </div>

              <AdminSelect label="Visual type" name="visual_type" bind:value={visualType} options={visualTypeOptions} />

              {#if visualType === 'icon'}
                <!-- The Media Picker is all three sources in one control:
                     library, upload and paste-URL. -->
                <MediaPicker label="Icon" media={mediaItems} uploadFolder="categories/icons" aspect="aspect-square" fit="object-contain" bind:value={form.icon_url} />
              {:else if visualType === 'lottie'}
                <AdminSelect label="Source" name="lottie_source" bind:value={lottieSource} options={lottieSourceOptions} />
                {#if lottieSource === 'upload'}
                  <AdminFileUpload
                    label="Upload Lottie JSON"
                    accept="application/json,text/json,.json"
                    folder="categories/lottie"
                    kind="lottie"
                    value={form.lottie_url}
                    helper="Use a valid Lottie .json file."
                    on:uploaded={(event) => {
                      form.lottie_url = event.detail.url;
                      showToast('Lottie file uploaded successfully.');
                    }}
                    on:error={(event) => showToast(event.detail, 'error')}
                  />
                {:else}
                  <AdminFormInput label="Lottie URL" name="lottie_url" bind:value={form.lottie_url} placeholder="https://..." />
                {/if}
              {/if}
            </div>
          </div>
        </section>
        </div>

        <!-- ── SEO ───────────────────────────────────────────────────────── -->
        <div class:hidden={activeTab !== 'seo'}>
        <section class="cms-form-section grid gap-5">
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">SEO</p>
          <div class="grid gap-4 md:grid-cols-2">
            <div class="grid content-start gap-4">
              <AdminFormInput label="SEO title" name="meta_title" bind:value={form.meta_title} counter={60} placeholder="Falls back to the category name." />
              <AdminTextArea label="SEO description" name="meta_description" bind:value={form.meta_description} rows={3} counter={160} placeholder="Falls back to the short description." />
            </div>
            <MediaPicker label="Social / Open Graph image" media={mediaItems} uploadFolder="categories/seo" aspect="aspect-[16/9]" bind:value={form.seo_image_url} />
          </div>
          <p class="text-xs text-ink/45">All optional. Empty fields fall back to the category name, short description and category image.</p>
        </section>
        </div>

        <!-- ── Translations (existing categories only — needs an id) ─────── -->
        {#if editingCategory}
          <div class:hidden={activeTab !== 'translations'}>
            <AdminTranslationTabs
              entityType="tour_categories"
              entityId={editingCategory.id}
              on:toast={(event) => showToast(event.detail.message, event.detail.type ?? 'success')}
            />
          </div>
        {/if}
      </div>

        </div>
        <footer class="cms-editor-footer">
          <span class="cms-save-note">{form.status === 'draft' ? 'Draft · Not visible on your website' : form.status === 'published' ? 'Changes will be visible on your website' : 'Archived · Hidden from your website'}</span>
          <div class="cms-editor-footer-actions">
            {#if stepIndex > 0}<CmsButton variant="ghost" class="cms-editor-back" aria-label="Previous section" onclick={() => selectTab(visibleTabs[stepIndex - 1][0])}><ArrowLeft size={14}/><span>Back</span></CmsButton>{/if}
            {#if stepIndex < visibleTabs.length - 1}<CmsButton variant="outline" onclick={() => selectTab(visibleTabs[stepIndex + 1][0])}>Continue<ArrowRight size={14}/></CmsButton>{/if}
            <CmsButton variant="default" type="submit" disabled={saving} class="gap-2 px-5"><Save size={14}/>{saving ? 'Saving…' : form.status === 'draft' ? 'Save draft' : editingCategory ? 'Save changes' : 'Create category'}</CmsButton>
          </div>
        </footer>
    </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title="Delete category"
  message={`Delete "${categoryToDelete?.name ?? 'this category'}"? This will soft delete it when supported by the database.`}
  on:cancel={() => {
    confirmOpen = false;
    categoryToDelete = null;
  }}
  on:confirm={deleteCategory}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting category...
  </div>
{/if}
