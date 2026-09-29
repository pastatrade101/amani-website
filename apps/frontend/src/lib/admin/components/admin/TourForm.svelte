<script lang="ts">
  import EditorNavigation from './EditorNavigation.svelte';
  import StatusBadge from './StatusBadge.svelte';
  import { ArrowRight } from '@lucide/svelte';
  import { Switch } from '$lib/components/ui/switch';
  import * as Accordion from '$lib/components/ui/accordion';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import {
    ArrowLeft,
    Compass,
    FileText,
    Images,
    Languages,
    ListChecks,
    Plus,
    Save,
    Search,
    Trash2,
    X
  } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminRichText from '$lib/admin/components/admin/AdminRichText.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import AdminTranslationTabs from './AdminTranslationTabs.svelte';
  import { hasRichContent, toPlainText } from '$lib/admin/richText';
  import AiAssistButton from '$lib/admin/components/admin/AiAssistButton.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import type { TravelStyle } from '$lib/admin/types';

  type Option = {
    label: string;
    value: string;
  };

  type MediaItem = {
    file_name: string;
    file_url: string;
    thumbnail_url?: string | null;
    id: string;
  };

  type PublishStatus = 'draft' | 'published' | 'archived';

  type Toast = {
    id: string;
    message: string;
    type: 'error' | 'success';
  };

  export let mode: 'create' | 'edit' = 'create';
  export let tourId = '';

  type TabKey = 'basics' | 'trip' | 'highlights' | 'media' | 'seo' | 'translations';

  /**
   * Seven stacked sections were one long scroll with Save at the far bottom.
   * Translations is listed here but only rendered once the tour has an id.
   */
  const TABS = [
    ['basics', FileText, 'Essentials'],
    ['trip', Compass, 'Price & logistics'],
    ['highlights', ListChecks, 'Highlights'],
    ['media', Images, 'Photography'],
    ['seo', Search, 'Search & sharing'],
    ['translations', Languages, 'Translations']
  ] as const;

  let activeTab: TabKey = 'basics';
  $: visibleTabs = TABS.filter(([key]) => key !== 'translations' || (mode === 'edit' && tourId));
  $: stepIndex = visibleTabs.findIndex(([key]) => key === activeTab);
  let editorBody: HTMLDivElement;

  /** The required fields only go red once someone has tried to save. */
  let attemptedSave = false;

  const statusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' }
  ];

  const budgetTierOptions = [
    { label: 'Not set', value: '' },
    { label: 'Budget', value: 'budget' },
    { label: 'Mid-range', value: 'mid_range' },
    { label: 'Luxury', value: 'luxury' },
    { label: 'Ultra luxury', value: 'ultra_luxury' }
  ];

  let loading = mode === 'edit';
  let loadingOptions = true;
  let saving = false;
  let error = '';
  let slugManuallyEdited = false;
  let toasts: Toast[] = [];

  let destinationOptions: Option[] = [{ label: 'No destination', value: '' }];
  let categoryOptions: Option[] = [{ label: 'No category', value: '' }];
  let specialistOptions: Option[] = [{ label: 'No specialist', value: '' }];
  let travelStyleOptions: Option[] = [];
  let mediaItems: MediaItem[] = [];

  let form = {
    banner_image_url: '',
    budget_tier: '',
    category_id: '',
    currency: 'USD',
    customization_intro: '',
    customization_options: [''] as string[],
    destination_ids: [] as string[],
    difficulty_level: '',
    duration_days: '1',
    duration_nights: '0',
    end_location: '',
    experience_type: '',
    full_description: '',
    group_size_max: '',
    group_size_min: '',
    highlights: [''] as string[],
    is_available: true,
    is_featured: false,
    is_popular: false,
    main_image_url: '',
    meta_description: '',
    minimum_age: '',
    og_image_url: '',
    persona_tags: '',
    price_from: '0',
    seo_title: '',
    short_description: '',
    slug: '',
    specialist_id: '',
    start_location: '',
    status: 'draft' as PublishStatus,
    title: ''
  };

  // Live context handed to the AI co-pilot so its drafts fit the trip.
  const aiContext = () => ({
    title: form.title || undefined,
    destination: selectedDestinationLabels().join(', ') || undefined,
    duration_days: Number(form.duration_days) || undefined,
    budget_tier: form.budget_tier || undefined,
    highlights: highlightPlainList().join('\n') || undefined,
    short_description: form.short_description || undefined,
    // The co-pilot reads and writes prose, not markup — full_description is
    // rich text now, so it is flattened on the way out and re-paragraphed on
    // the way back in by the editor itself.
    full_description: toPlainText(form.full_description) || undefined
  });

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

  // Coerce to string first — number <input>s bind as numbers in Svelte, so these
  // helpers must tolerate non-string values (otherwise .trim() throws on save).
  const slugify = (value: unknown) =>
    String(value ?? '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const stringList = (value: unknown) =>
    String(value ?? '')
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);

  const highlightPlainList = () =>
    form.highlights
      .map((item) => toPlainText(item).trim())
      .filter(Boolean);

  const cleanHighlights = () =>
    form.highlights
      .map((item) => String(item ?? '').trim())
      .filter((item) => hasRichContent(item));

  const selectedDestinationLabels = () =>
    form.destination_ids
      .map((id) => destinationOptions.find((option) => option.value === id)?.label)
      .filter(Boolean) as string[];

  const isDestinationSelected = (id: string) => form.destination_ids.includes(id);

  const toggleDestination = (id: string) => {
    if (!id) return;
    form.destination_ids = isDestinationSelected(id)
      ? form.destination_ids.filter((current) => current !== id)
      : [...form.destination_ids, id];
  };

  const removeDestination = (id: string) => {
    form.destination_ids = form.destination_ids.filter((current) => current !== id);
  };

  const selectedPersonaKeys = () => stringList(form.persona_tags);
  const isTravelStyleSelected = (key: string) => selectedPersonaKeys().includes(key);
  const toggleTravelStyle = (key: string) => {
    const current = selectedPersonaKeys();
    form.persona_tags = (current.includes(key)
      ? current.filter((value) => value !== key)
      : [...current, key]
    ).join(', ');
  };

  const addHighlight = () => {
    form.highlights = [...form.highlights, ''];
  };

  const removeHighlight = (index: number) => {
    const next = form.highlights.filter((_, currentIndex) => currentIndex !== index);
    form.highlights = next.length ? next : [''];
  };

  const addCustomizationOption = () => {
    form.customization_options = [...form.customization_options, ''];
  };

  const removeCustomizationOption = (index: number) => {
    const next = form.customization_options.filter((_, currentIndex) => currentIndex !== index);
    form.customization_options = next.length ? next : [''];
  };

  const nullableNumber = (value: unknown) => {
    const text = String(value ?? '').trim();
    return text === '' ? null : Number(text);
  };

  $: if (!slugManuallyEdited) {
    form.slug = slugify(form.title);
  }

  const loadOptions = async () => {
    loadingOptions = true;

    try {
      const [destinations, categories, specialists, media, travelStyles] = await Promise.all([
        api.destinations.list({ limit: 100, status: 'all' }),
        api.categories.list({ limit: 100, status: 'all' }),
        api.specialists.list({ limit: 100, status: 'all' }),
        api.media.list({ file_type: 'image', limit: 100 }),
        api.travelStyles.list({ limit: 100, status: 'all' })
      ]);

      destinationOptions = [
        ...destinations.data.items.map((destination) => ({
          label: String(destination.name ?? destination.slug ?? 'Untitled destination'),
          value: String(destination.id)
        }))
      ];

      categoryOptions = [
        { label: 'No category', value: '' },
        ...categories.data.items.map((category) => ({
          label: String(category.name ?? category.slug ?? 'Untitled category'),
          value: String(category.id)
        }))
      ];

      specialistOptions = [
        { label: 'No specialist', value: '' },
        ...specialists.data.items.filter((specialist) => specialist.id).map((specialist) => {
          const name = String(specialist.name ?? 'Untitled specialist');
          const role = String(specialist.role ?? '').trim();
          return {
            label: role ? `${name} - ${role}` : name,
            value: String(specialist.id)
          };
        })
      ];

      travelStyleOptions = (travelStyles.data.items as TravelStyle[])
        .filter((style) => style.persona?.trim() && style.status !== 'archived')
        .map((style) => ({
          label: style.name,
          value: slugify(style.persona)
        }))
        .filter((option, index, options) => option.value && options.findIndex((item) => item.value === option.value) === index);

      mediaItems = media.data.items as MediaItem[];
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to load form options.', 'error');
    } finally {
      loadingOptions = false;
    }
  };

  const loadTour = async () => {
    if (mode !== 'edit' || !tourId) return;
    loading = true;
    error = '';

    try {
      const response = await api.tours.get(tourId);
      const tour = response.data as Record<string, unknown>;
      const tourDestinationIds = Array.isArray(tour.tour_destinations)
        ? (tour.tour_destinations as Array<Record<string, unknown>>)
            .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
            .map((row) => String(row.destination_id ?? ''))
            .filter(Boolean)
        : [];
      const primaryDestinationId = String(tour.destination_id ?? '');

      form = {
        banner_image_url: String(tour.banner_image_url ?? ''),
        budget_tier: String(tour.budget_tier ?? ''),
        category_id: String(tour.category_id ?? ''),
        currency: String(tour.currency ?? 'USD'),
        customization_intro: String(tour.customization_intro ?? ''),
        customization_options: Array.isArray(tour.customization_options) && tour.customization_options.length
          ? tour.customization_options.map(String)
          : [''],
        destination_ids: [...new Set([...tourDestinationIds, primaryDestinationId].filter(Boolean))],
        difficulty_level: String(tour.difficulty_level ?? ''),
        duration_days: String(tour.duration_days ?? '1'),
        duration_nights: String(tour.duration_nights ?? '0'),
        end_location: String(tour.end_location ?? ''),
        experience_type: String(tour.experience_type ?? ''),
        full_description: String(tour.full_description ?? ''),
        group_size_max: tour.group_size_max === null || tour.group_size_max === undefined ? '' : String(tour.group_size_max),
        group_size_min: tour.group_size_min === null || tour.group_size_min === undefined ? '' : String(tour.group_size_min),
        highlights: Array.isArray(tour.highlights) && tour.highlights.length ? tour.highlights.map(String) : [''],
        is_available: Boolean(tour.is_available ?? true),
        is_featured: Boolean(tour.is_featured),
        is_popular: Boolean(tour.is_popular),
        main_image_url: String(tour.main_image_url ?? ''),
        meta_description: String(tour.meta_description ?? ''),
        minimum_age: tour.minimum_age === null || tour.minimum_age === undefined ? '' : String(tour.minimum_age),
        og_image_url: String(tour.og_image_url ?? tour.og_image ?? ''),
        persona_tags: Array.isArray(tour.persona_tags) ? tour.persona_tags.join(', ') : '',
        price_from: String(tour.price_from ?? '0'),
        seo_title: String(tour.seo_title ?? tour.meta_title ?? ''),
        short_description: String(tour.short_description ?? ''),
        slug: String(tour.slug ?? ''),
        specialist_id: String(tour.specialist_id ?? (tour.specialist as Record<string, unknown> | null | undefined)?.id ?? ''),
        start_location: String(tour.start_location ?? ''),
        status: (tour.status ?? 'draft') as PublishStatus,
        title: String(tour.title ?? '')
      };

      slugManuallyEdited = true;
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : 'Unable to load tour.';
    } finally {
      loading = false;
    }
  };

  const payload = () => ({
    banner_image_url: form.banner_image_url || null,
    budget_tier: form.budget_tier || null,
    category_id: form.category_id || null,
    currency: String(form.currency ?? '').trim().toUpperCase() || 'USD',
    customization_intro: form.customization_intro.trim() || null,
    customization_options: form.customization_options.map((option) => option.trim()).filter(Boolean),
    destination_id: form.destination_ids[0] || null,
    destination_ids: form.destination_ids,
    difficulty_level: form.difficulty_level || null,
    duration_days: Number(form.duration_days || 1),
    duration_nights: Number(form.duration_nights || 0),
    end_location: form.end_location || null,
    experience_type: form.experience_type || null,
    full_description: form.full_description || null,
    group_size_max: nullableNumber(form.group_size_max),
    group_size_min: nullableNumber(form.group_size_min),
    highlights: cleanHighlights(),
    is_available: form.is_available,
    is_featured: form.is_featured,
    is_popular: form.is_popular,
    main_image_url: form.main_image_url || null,
    meta_description: form.meta_description || null,
    minimum_age: nullableNumber(form.minimum_age),
    og_image_url: form.og_image_url || null,
    persona_tags: stringList(form.persona_tags),
    price_from: Number(form.price_from || 0),
    seo_title: form.seo_title || null,
    short_description: form.short_description || null,
    slug: String(form.slug ?? '').trim(),
    specialist_id: form.specialist_id || null,
    start_location: form.start_location || null,
    status: form.status,
    title: String(form.title ?? '').trim()
  });

  /**
   * Title, slug and duration used to be gated by the browser's own `required`.
   * That never covered both ways in: the page header's Save calls saveTour()
   * directly, which is not a form submit, so those checks simply did not run.
   * Splitting the form across tabs would have broken the other path too — a
   * `required` control on an inactive panel is present but unfocusable, and
   * Chrome then refuses to submit while reporting it only to the console.
   *
   * So the rules live here, in one place both paths go through, mirroring
   * backend/src/schemas/tours.schema.ts.
   */
  $: titleError = form.title.trim().length < 2 ? 'Title must be at least 2 characters.' : '';
  $: slugError = form.slug.trim().length < 2 ? 'Slug must be at least 2 characters.' : '';
  $: durationError =
    !Number.isInteger(Number(form.duration_days)) || Number(form.duration_days) < 1
      ? 'Duration must be a whole number of days, at least 1.'
      : '';
  $: currencyError =
    String(form.currency ?? '').trim().length !== 3 ? 'Currency must be a 3-letter code, e.g. USD.' : '';

  $: tabError = {
    basics: attemptedSave && Boolean(titleError || slugError),
    trip: attemptedSave && Boolean(durationError || currencyError),
    highlights: false,
    media: false,
    seo: false,
    translations: false
  } as Record<TabKey, boolean>;

  const selectTab = (tab: TabKey) => {
    activeTab = tab;
    // `main` is the admin layout's scroll container, so each tab starts at its
    // own top rather than inheriting the last one's scroll position.
    if (typeof document !== 'undefined') editorBody?.scrollTo({ top: 0 });
  };

  /** Save blocked by a field on a panel the editor cannot see: go there, then say why. */
  const failOn = (tab: TabKey, message: string) => {
    selectTab(tab);
    showToast(message, 'error');
  };

  const saveTour = async () => {
    if (saving) return;
    attemptedSave = true;
    if (titleError) return failOn('basics', titleError);
    if (slugError) return failOn('basics', slugError);
    if (durationError) return failOn('trip', durationError);
    if (currencyError) return failOn('trip', currencyError);

    saving = true;

    try {
      if (mode === 'edit') {
        await api.tours.update(tourId, payload());
        showToast('Tour updated successfully.');
      } else {
        await api.tours.create(payload());
        showToast('Tour created successfully.');
      }

      await goto('/admin/tours');
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to save tour.', 'error');
    } finally {
      saving = false;
    }
  };

  onMount(async () => {
    await loadOptions();
    await loadTour();
  });
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="cms-tour-workspace">
  <div class="cms-tour-breadcrumb"><CmsButton variant="ghost" size="sm" onclick={() => goto('/admin/tours')}><ArrowLeft size={14}/>All tours</CmsButton><span>/</span><span>{mode === 'edit' ? 'Edit safari' : 'New safari'}</span></div>
  {#if loading}
    <LoadingState message="Loading tour..." />
  {:else if error}
    <ErrorState message={error} />
  {:else}
    <!--
      Panels are CSS-hidden, never {#if}-unmounted. AdminTranslationTabs
      refetches and replaces its draft on mount, so unmounting it would discard
      a half-typed translation the moment someone clicked another tab.
      The toggle sits on a bare wrapper: `hidden` on an element that also
      carries a display utility would lose to it.
    -->
    <form class="cms-editor-form cms-tour-editor" novalidate on:submit|preventDefault={saveTour}>
      <header class="cms-editor-header"><div class="flex items-center gap-3"><span class="cms-editor-emblem"><Compass size={20}/></span><div><p>SAFARI EDITOR</p><h2>{mode === 'edit' ? form.title || 'Edit safari' : 'Create a safari'}</h2></div></div><StatusBadge status={form.status}/></header>
      <div class="cms-editor-workspace">
        <EditorNavigation sections={visibleTabs} active={activeTab} errors={tabError} onNavigate={(key) => selectTab(key as TabKey)}/>
        <div class="cms-editor-canvas" bind:this={editorBody}>
          <div class="cms-editor-section-heading"><p>STEP {String(stepIndex + 1).padStart(2,'0')} / {String(visibleTabs.length).padStart(2,'0')}</p><h3>{visibleTabs[stepIndex]?.[2]}</h3><span>{activeTab === 'basics' ? 'Introduce a journey worth taking.' : activeTab === 'trip' ? 'Set the practical details, from the first day to the last.' : activeTab === 'highlights' ? 'Tell travellers what they will remember.' : activeTab === 'media' ? 'Let your photography do the talking.' : activeTab === 'seo' ? 'Help the right travellers discover this safari.' : 'Make your safari accessible in more languages.'}</span></div>
      <!-- ── Basics ──────────────────────────────────────────────────────── -->
      <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'basics'}>
      <section class="cms-form-section">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="grid gap-1.5">
            <AdminFormInput label="Safari title" name="title" required placeholder="e.g. 7-day Serengeti & Ngorongoro safari" bind:value={form.title} />
            {#if attemptedSave && titleError}
              <span class="text-[11px] font-semibold text-clay">{titleError}</span>
            {/if}
          </div>
          <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
            <span>Page URL</span>
            <CmsInput
              class="h-11 rounded-2xl border border-ink/10 bg-surface px-3 text-sm outline-none shadow-sm transition focus:border-forest focus:ring-2 focus:ring-forest/15"
              name="slug"
              bind:value={form.slug}
              oninput={() => (slugManuallyEdited = true)}
            />
            {#if attemptedSave && slugError}
              <span class="text-[11px] font-semibold text-clay">{slugError}</span>
            {/if}
          </CmsLabel>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-3">
          <AdminSelect label="Status" name="status" bind:value={form.status} options={statusOptions} />
          <AdminSelect label="Category" name="category_id" bind:value={form.category_id} options={categoryOptions} />
          <AdminSelect label="Trip specialist" name="specialist_id" bind:value={form.specialist_id} options={specialistOptions} />
        </div>

        <div class="mt-4 grid gap-2">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span class="text-[13px] font-semibold text-ink/65">Destinations</span>
              <p class="mt-0.5 text-xs text-ink/45">Select every destination this tour visits. The first selected item is the primary destination used by older pages and reports.</p>
            </div>
            {#if form.destination_ids.length}
              <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink/10 bg-surface px-3 text-xs font-bold text-ink/60 transition hover:border-red-200 hover:text-red-700" type="button" onclick={() => (form.destination_ids = [])}>
                <X size={14} /> Clear
              </CmsButton>
            {/if}
          </div>

          {#if form.destination_ids.length}
            <div class="flex flex-wrap gap-2">
              {#each form.destination_ids as id, index (id)}
                {@const option = destinationOptions.find((item) => item.value === id)}
                {#if option}
                  <span class="inline-flex max-w-full items-center gap-2 rounded-md border border-forest/15 bg-forest/5 px-3 py-2 text-sm font-semibold text-forest">
                    {#if index === 0}
                      <span class="rounded bg-goldfinch-gold/25 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-heading">Primary</span>
                    {/if}
                    <span class="truncate">{option.label}</span>
                    <CmsButton variant="ghost" class="text-forest/55 transition hover:text-red-700" type="button" aria-label={`Remove ${option.label}`} onclick={() => removeDestination(id)}>
                      <X size={14} />
                    </CmsButton>
                  </span>
                {/if}
              {/each}
            </div>
          {/if}

          <div class="grid max-h-56 gap-2 overflow-y-auto rounded-md border border-ink/10 bg-black/[0.02] p-2 sm:grid-cols-2 lg:grid-cols-3">
            {#each destinationOptions as option (option.value)}
              <CmsButton variant="ghost"
                type="button"
                class={`flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition ${
                  isDestinationSelected(option.value)
                    ? 'border-forest/45 bg-forest/10 text-heading'
                    : 'border-transparent bg-surface text-ink/68 hover:border-ink/10 hover:bg-sand/55'
                }`}
                aria-pressed={isDestinationSelected(option.value)}
                onclick={() => toggleDestination(option.value)}
              >
                <span class="min-w-0 truncate font-semibold">{option.label}</span>
                <span class={`grid h-5 w-5 shrink-0 place-items-center rounded border text-[11px] font-black ${
                  isDestinationSelected(option.value) ? 'border-forest bg-forest text-white' : 'border-ink/15 text-transparent'
                }`}>✓</span>
              </CmsButton>
            {/each}
          </div>
        </div>

        <div class="mt-4 grid gap-4">
          <div class="grid gap-1.5">
            <div class="flex justify-end gap-1.5">
              <AiAssistButton task="write_short" label="Write" getContext={aiContext} on:apply={(e) => (form.short_description = e.detail.text ?? form.short_description)} />
              <AiAssistButton task="improve" label="Improve" getContext={aiContext} getText={() => form.short_description} on:apply={(e) => (form.short_description = e.detail.text ?? form.short_description)} />
            </div>
            <AdminTextArea label="At a glance" name="short_description" bind:value={form.short_description} rows={3} placeholder="A few sentences that capture the journey, the places and the feeling." />
          </div>
          <div class="grid gap-1.5">
            <div class="flex justify-end gap-1.5">
              <AiAssistButton task="write_description" label="Write" getContext={aiContext} on:apply={(e) => (form.full_description = e.detail.text ?? form.full_description)} />
              <AiAssistButton task="improve" label="Improve" getContext={aiContext} getText={() => toPlainText(form.full_description)} on:apply={(e) => (form.full_description = e.detail.text ?? form.full_description)} />
              <AiAssistButton task="shorten" label="Shorten" getContext={aiContext} getText={() => toPlainText(form.full_description)} on:apply={(e) => (form.full_description = e.detail.text ?? form.full_description)} />
            </div>
            <Accordion.Root type="single"><Accordion.Item value="story" class="border-0"><Accordion.Trigger class="text-xs hover:no-underline">Detailed safari story <span class="ml-auto mr-2 text-[10px] text-muted-foreground font-normal">Optional</span></Accordion.Trigger><Accordion.Content forceMount class="data-[state=closed]:hidden"><AdminRichText label="Full description" name="full_description" bind:value={form.full_description} rows={6}/></Accordion.Content></Accordion.Item></Accordion.Root>
          </div>
        </div>
      </section>

      <!-- Publishing flags sit with the status they qualify, not behind a tab
           of their own — they are three checkboxes, not a section. -->
      <section class="cms-form-section">
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Publishing flags</p>
        <div class="mt-5 grid gap-3 md:grid-cols-3">
          <CmsLabel class="flex items-center gap-3 rounded-2xl border border-ink/10 bg-sand/20 px-4 py-3 text-sm font-semibold text-ink">
            <Switch bind:checked={form.is_available} aria-label="Available"/>
            Available for booking
          </CmsLabel>
          <CmsLabel class="flex items-center gap-3 rounded-2xl border border-ink/10 bg-sand/20 px-4 py-3 text-sm font-semibold text-ink">
            <Switch bind:checked={form.is_featured} aria-label="Featured"/>
            Featured tour
          </CmsLabel>
          <CmsLabel class="flex items-center gap-3 rounded-2xl border border-ink/10 bg-sand/20 px-4 py-3 text-sm font-semibold text-ink">
            <Switch bind:checked={form.is_popular} aria-label="Popular"/>
            Popular tour
          </CmsLabel>
        </div>
      </section>
      </div>

      <!-- ── Trip details ────────────────────────────────────────────────── -->
      <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'trip'}>


      <section class="cms-form-section">
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Pricing and logistics</p>
        <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div class="grid gap-1.5">
            <AdminFormInput label="Days" required name="duration_days" type="number" min={1} bind:value={form.duration_days} />
            {#if attemptedSave && durationError}
              <span class="text-[11px] font-semibold text-clay">{durationError}</span>
            {/if}
          </div>
          <AdminFormInput label="Nights" name="duration_nights" type="number" bind:value={form.duration_nights} />
          <AdminFormInput label="Starting price per person" name="price_from" type="number" bind:value={form.price_from} />
          <div class="grid gap-1.5">
            <AdminFormInput label="Currency" name="currency" bind:value={form.currency} placeholder="USD" />
            {#if attemptedSave && currencyError}
              <span class="text-[11px] font-semibold text-clay">{currencyError}</span>
            {/if}
          </div>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminFormInput label="Minimum guests" name="group_size_min" type="number" bind:value={form.group_size_min} />
          <AdminFormInput label="Maximum guests" name="group_size_max" type="number" bind:value={form.group_size_max} />
          <AdminFormInput label="Minimum age" name="minimum_age" type="number" bind:value={form.minimum_age} />
          <AdminFormInput label="Difficulty level" name="difficulty_level" bind:value={form.difficulty_level} placeholder="Easy, Moderate, Challenging" />
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <AdminFormInput label="Start location" name="start_location" bind:value={form.start_location} />
          <AdminFormInput label="End location" name="end_location" bind:value={form.end_location} />
        </div>
      </section>
<Accordion.Root type="single" class="cms-form-section"><Accordion.Item value="customization" class="border-0"><Accordion.Trigger class="text-sm hover:no-underline">Trip customization <span class="ml-auto mr-2 text-[10px] text-muted-foreground font-normal">Optional</span></Accordion.Trigger><Accordion.Content forceMount class="data-[state=closed]:hidden">      <section class="pt-3">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Trip customization</p>
            <h2 class="mt-1 text-lg font-bold text-ink">Ways travellers can customize this tour</h2>
          </div>
          <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-md border border-forest/25 bg-forest/5 px-3 text-xs font-bold text-forest transition hover:bg-forest hover:text-white" type="button" onclick={addCustomizationOption}>
            <Plus size={14} /> Add option
          </CmsButton>
        </div>

        <div class="mt-5">
          <AdminTextArea label="Introduction" name="customization_intro" bind:value={form.customization_intro} rows={3} placeholder="Explain how this specific tour can be adjusted." />
        </div>

        <div class="mt-4 grid gap-2.5 sm:grid-cols-2">
          {#each form.customization_options as _option, index}
            <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_40px] items-end gap-2">
              <AdminFormInput label={`Option ${index + 1}`} name={`customization_option_${index}`} bind:value={form.customization_options[index]} placeholder="Add a Zanzibar extension" />
              <CmsButton variant="ghost"
                class="grid h-11 w-10 place-items-center rounded-md border border-ink/10 bg-surface text-ink/45 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-35"
                type="button"
                aria-label={`Remove customization option ${index + 1}`}
                disabled={form.customization_options.length === 1}
                onclick={() => removeCustomizationOption(index)}
              >
                <Trash2 size={16} />
              </CmsButton>
            </div>
          {/each}
        </div>
      </section></Accordion.Content></Accordion.Item></Accordion.Root>
      </div>

      <!-- ── Highlights ──────────────────────────────────────────────────── -->
      <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'highlights'}>
      <section class="cms-form-section">
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">AI matching</p>
        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <AdminFormInput label="Experience type" name="experience_type" bind:value={form.experience_type} placeholder="safari, beach, trekking" />
          <AdminSelect label="Budget tier" name="budget_tier" bind:value={form.budget_tier} options={budgetTierOptions} />
        </div>

        <div class="mt-4 grid gap-2">
          <div>
            <span class="text-[13px] font-semibold text-ink/65">Travel styles</span>
            <p class="mt-0.5 text-xs text-ink/45">Attach this tour to one or more persona-enabled Travel Styles.</p>
          </div>
          {#if loadingOptions}
            <div class="h-11 animate-pulse rounded-md bg-sand/70"></div>
          {:else if travelStyleOptions.length}
            <div class="flex flex-wrap gap-2" role="group" aria-label="Travel styles">
              {#each travelStyleOptions as style}
                <CmsButton variant="ghost"
                  type="button"
                  aria-pressed={isTravelStyleSelected(style.value)}
                  class={`inline-flex min-h-10 items-center rounded-md border px-3.5 py-2 text-sm font-semibold transition ${isTravelStyleSelected(style.value) ? 'border-forest bg-forest text-white shadow-sm' : 'border-ink/15 bg-black/[0.02] text-ink hover:border-forest/40 hover:bg-sand/60'}`}
                  onclick={() => toggleTravelStyle(style.value)}
                >
                  {style.label}
                </CmsButton>
              {/each}
            </div>
          {:else}
            <p class="rounded-md border border-dashed border-ink/15 bg-sand/35 px-3.5 py-3 text-sm text-ink/55">
              No persona-enabled Travel Styles are available. Add a Persona key on the Travel Styles page first.
            </p>
          {/if}
          {#if selectedPersonaKeys().some((key) => !travelStyleOptions.some((style) => style.value === key))}
            <p class="text-xs leading-5 text-amber-700">
              Existing unmatched keys are preserved: {selectedPersonaKeys().filter((key) => !travelStyleOptions.some((style) => style.value === key)).join(', ')}
            </p>
          {/if}
        </div>

        <div class="mt-4 grid gap-1.5">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span class="text-[13px] font-semibold text-ink/65">Highlights</span>
              <p class="mt-0.5 text-xs text-ink/45">Each item renders as a bullet. Use light formatting only when it improves scanning.</p>
            </div>
            <div class="flex gap-2">
              <AiAssistButton task="suggest_highlights" label="Suggest highlights" getContext={aiContext} on:apply={(e) => (form.highlights = (e.detail.items ?? []).length ? (e.detail.items ?? []).map(String) : form.highlights)} />
              <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink/10 bg-surface px-3 text-xs font-bold text-ink transition hover:border-forest/25 hover:bg-sand/55" type="button" onclick={addHighlight}>
                <Plus size={14} /> Add
              </CmsButton>
            </div>
          </div>

          <div class="grid gap-3">
            {#each form.highlights as _highlight, index}
              <div class="grid gap-2 rounded-xl border border-ink/10 bg-sand/20 p-3 sm:grid-cols-[1fr_auto] sm:items-start">
                <AdminRichText label={`Bullet ${index + 1}`} name={`highlight_${index}`} bind:value={form.highlights[index]} rows={3} headings="none" placeholder="e.g. Private game drives in Serengeti" />
                <CmsButton variant="ghost"
                  class="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-red-200 bg-surface px-3 text-xs font-bold text-red-700 transition hover:bg-red-50 sm:mt-6"
                  type="button"
                  onclick={() => removeHighlight(index)}
                >
                  <Trash2 size={14} /> Remove
                </CmsButton>
              </div>
            {/each}
          </div>
        </div>
      </section>
      </div>

      <!-- ── Media ───────────────────────────────────────────────────────── -->
      <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'media'}>
      <section class="cms-form-section">
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Media</p>
        <p class="mt-1 text-sm text-ink/60">Choose images from the Media Library or paste a URL manually.</p>

        {#if loadingOptions}
          <p class="mt-4 rounded-2xl bg-sand/45 px-4 py-3 text-sm text-ink/60">Loading image options...</p>
        {/if}

        <div class="mt-5 grid gap-4 lg:grid-cols-3">
          <div class="rounded-xl border border-ink/10 bg-sand/20 p-4">
            <MediaPicker label="Main image" media={mediaItems} bind:value={form.main_image_url} />
          </div>
          <div class="rounded-xl border border-ink/10 bg-sand/20 p-4">
            <MediaPicker label="Banner image" media={mediaItems} bind:value={form.banner_image_url} />
          </div>
          <div class="rounded-xl border border-ink/10 bg-sand/20 p-4">
            <MediaPicker label="Open Graph image" media={mediaItems} bind:value={form.og_image_url} />
          </div>
        </div>
      </section>

      </div>

      <!-- ── SEO ─────────────────────────────────────────────────────────── -->
      <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'seo'}>
      <section class="cms-form-section">
        <div class="flex items-center justify-between">
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">SEO</p>
          <AiAssistButton task="seo_meta" label="Generate SEO" getContext={aiContext} on:apply={(e) => { form.seo_title = e.detail.seo_title || form.seo_title; form.meta_description = e.detail.meta_description || form.meta_description; }} />
        </div>
        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <AdminFormInput label="SEO title" name="seo_title" bind:value={form.seo_title} />
          <AdminTextArea label="Meta description" name="meta_description" bind:value={form.meta_description} rows={3} />
        </div>
      </section>
      </div>

      <!-- ── Translations (saved tours only — needs an id) ────────────────── -->
      {#if mode === 'edit' && tourId}
        <div class:hidden={activeTab !== 'translations'}>
          <AdminTranslationTabs entityType="tours" entityId={tourId} on:toast={(event) => showToast(event.detail.message, event.detail.type ?? 'success')} />
        </div>
      {/if}

      <!--
        Sticky rather than pinned to a flex column: this is a page, and the
        admin layout's <main> is the scroll container, so bottom-0 holds the
        bar against the bottom of the visible area whichever tab is open.
      -->
        </div>
      </div>
      <footer class="cms-editor-footer"><span class="cms-save-note">{form.status === 'draft' ? 'Draft · Not visible on your website' : form.status === 'published' ? 'Changes will be visible on your website' : 'Archived · Hidden from your website'}</span><div class="cms-editor-footer-actions">{#if stepIndex > 0}<CmsButton variant="ghost" class="cms-editor-back" aria-label="Previous section" onclick={() => selectTab(visibleTabs[stepIndex - 1][0])}><ArrowLeft size={14}/><span>Back</span></CmsButton>{/if}{#if stepIndex < visibleTabs.length - 1}<CmsButton variant="outline" onclick={() => selectTab(visibleTabs[stepIndex + 1][0])}>Continue<ArrowRight size={14}/></CmsButton>{/if}<CmsButton type="submit" disabled={saving} class="gap-2 px-5"><Save size={14}/>{saving ? 'Saving…' : form.status === 'draft' ? 'Save draft' : mode === 'edit' ? 'Save changes' : 'Create safari'}</CmsButton></div></footer>
    </form>
  {/if}
</div>
