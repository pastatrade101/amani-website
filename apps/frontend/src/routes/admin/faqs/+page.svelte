<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';
  import * as CmsSelect from '$lib/components/ui/select';

  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Switch } from '$lib/components/ui/switch';

  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { page } from '$app/state';
  import {
    ChevronDown,
    CircleCheck,
    CircleQuestionMark,
    Compass,
    Edit,
    House,
    MapPin,
    Plus,
    Route,
    Save,
    Search,
    Trash2,
    TriangleAlert,
    X
  } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminTranslationTabs from '$lib/admin/components/admin/AdminTranslationTabs.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminRichText from '$lib/admin/components/admin/AdminRichText.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import FaqPlacementPicker from '$lib/admin/components/admin/faq/FaqPlacementPicker.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';
  import RichText from '$lib/admin/components/public/RichText.svelte';
  import {
    FAQ_PLACEMENT_KINDS,
    describeFaqPlacements,
    faqPlacementHref,
    loadFaqPlacementRecords,
    type FaqPickerRecord,
    type FaqPlacementKind
  } from '$lib/admin/faqEntities';
  import { toMetaText } from '$lib/admin/richText';
  import type { FAQ, FaqPlacements } from '$lib/admin/types';

  type Status = NonNullable<FAQ['status']>;
  type Option = { label: string; value: string };
  type Toast = { id: string; message: string; type: 'error' | 'success' };
  type Chip = { key: string; label: string; href: string };

  // Editorial topics for filing the library. Never a travel style: where a
  // question shows is chosen under "Where this question shows".
  const recommendedTopics = [
    'Safari',
    'Kilimanjaro',
    'Zanzibar',
    'Family Travel',
    'Safety',
    'Payments',
    'Booking',
    'Visas',
    'Health',
    'General'
  ];

  const statusOptions: Option[] = [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' }
  ];

  const KIND_ICONS = { category: Compass, tour: Route, destination: MapPin } as const;
  const KIND_HELP: Record<FaqPlacementKind, string> = {
    category: 'Shown where travellers browse tours of that style.',
    tour: 'Shown on each chosen tour’s page.',
    destination: 'Shown on each chosen destination’s page.'
  };
  const CHIP_PREFIX: Record<FaqPlacementKind, string> = { category: 'Style', tour: 'Tour', destination: 'Destination' };
  const KIND_VALUES: string[] = FAQ_PLACEMENT_KINDS.map((kind) => kind.value);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  /** The API's page cap. More than this and the list says so rather than paging. */
  const LIST_LIMIT = 100;
  const CHIP_LIMIT = 4;

  const emptyPlacements = (): FaqPlacements => ({ home: false, categories: [], tours: [], destinations: [] });

  const emptyForm = () => ({
    answer: '',
    category: '',
    question: '',
    sort_order: '0',
    status: 'draft' as Status,
    home: false,
    category_ids: [] as string[],
    tour_ids: [] as string[],
    destination_ids: [] as string[]
  });

  let rows: FAQ[] = [];
  let total = 0;
  let loading = true;
  let saving = false;
  let deleting = false;
  let error = '';
  let search = '';
  let statusFilter = 'all';
  let topicFilter = 'all';
  /** 'all' | 'home' | 'none' | '<kind>:<uuid>' — one value so a single select can carry it. */
  let showsOn = 'all';
  let modalOpen = false;
  let confirmOpen = false;
  let editingFaq: FAQ | null = null;
  let faqToDelete: FAQ | null = null;
  let form = emptyForm();
  let expanded = new Set<string>();
  let allChips = new Set<string>();
  let toasts: Toast[] = [];

  // Every travel style, tour and destination, for the "Shows on" filter and the
  // editor's pickers. Loaded once with the page.
  let records: Record<FaqPlacementKind, FaqPickerRecord[]> = { category: [], tour: [], destination: [] };
  let recordErrors: Partial<Record<FaqPlacementKind, string>> = {};
  let recordsLoading = true;

  // topic filter list = recommended ∪ topics actually present in data
  let seenTopics = new Set<string>(recommendedTopics);
  $: topicFilterOptions = [
    { label: 'All topics', value: 'all' },
    ...[...seenTopics].sort((a, b) => a.localeCompare(b)).map((topic) => ({ label: topic, value: topic }))
  ];
  // A question filed under a topic outside the list keeps it selectable rather
  // than showing a blank select.
  $: topicFormOptions = [
    { label: 'No topic', value: '' },
    ...recommendedTopics.map((topic) => ({ label: topic, value: topic })),
    ...[...seenTopics].filter((topic) => !recommendedTopics.includes(topic)).map((topic) => ({ label: topic, value: topic })),
    ...(form.category && !seenTopics.has(form.category) ? [{ label: form.category, value: form.category }] : [])
  ];

  const parseShowsOn = (value: string) => {
    const [kind, id] = value.split(':');
    return KIND_VALUES.includes(kind) && id ? { kind: kind as FaqPlacementKind, id } : null;
  };

  /** The filter as the API reads it. */
  const placementParams = (value: string): Record<string, string> => {
    if (value === 'home' || value === 'none') return { placement: value };
    const target = parseShowsOn(value);
    return target ? { placement: target.kind, target_id: target.id } : {};
  };

  /** `?placement=home` or `?placement=tour&target_id=…`, so other screens can link to a filtered list. */
  const showsOnFromUrl = (params: URLSearchParams) => {
    const placement = params.get('placement') ?? '';
    if (placement === 'home' || placement === 'none') return placement;
    const targetId = params.get('target_id') ?? '';
    return KIND_VALUES.includes(placement) && UUID.test(targetId) ? `${placement}:${targetId}` : 'all';
  };

  // The trigger names the chosen record even before the pickers' records load:
  // every row a target filter returns carries that target's name.
  $: showsOnLabel = (() => {
    if (showsOn === 'home') return 'Home page';
    if (showsOn === 'none') return 'Not shown anywhere';
    const target = parseShowsOn(showsOn);
    if (!target) return 'All places';
    const kind = FAQ_PLACEMENT_KINDS.find((entry) => entry.value === target.kind);
    const name =
      records[target.kind].find((record) => record.id === target.id)?.label ??
      rows.flatMap((faq) => (kind ? faq.placements?.[kind.key] ?? [] : [])).find((entry) => entry.id === target.id)?.name ??
      'Selected record';
    return `${kind?.label ?? 'Place'}: ${name}`;
  })();

  $: filtered = search.trim() !== '' || statusFilter !== 'all' || topicFilter !== 'all' || showsOn !== 'all';

  const placementChips = (faq: FAQ): Chip[] => {
    const placements = faq.placements ?? emptyPlacements();
    return [
      ...(placements.home ? [{ key: 'home', label: 'Home page', href: faqPlacementHref('home') }] : []),
      ...FAQ_PLACEMENT_KINDS.flatMap((kind) =>
        (placements[kind.key] ?? []).map((target) => ({
          key: `${kind.value}:${target.id}`,
          label: `${CHIP_PREFIX[kind.value]}: ${target.name}`,
          href: faqPlacementHref(kind.value, target)
        }))
      )
    ];
  };

  $: placementSummary = describeFaqPlacements({
    home: form.home,
    categories: form.category_ids.length,
    tours: form.tour_ids.length,
    destinations: form.destination_ids.length
  });
  $: placed = placementSummary !== '';
  $: saveNote =
    form.status === 'draft'
      ? 'Draft · Not visible on your website'
      : form.status === 'archived'
        ? 'Archived · Hidden from your website'
        : placed
          ? 'Changes will be visible on your website'
          : 'Published, but not placed on any page yet';

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); }, 3500);
  };

  const dismissToast = (e: CustomEvent<string>) => { toasts = toasts.filter((t) => t.id !== e.detail); };

  const toggleIn = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };

  const load = async () => {
    loading = true;
    error = '';
    try {
      const res = await api.faqs.list({
        search,
        status: statusFilter,
        category: topicFilter === 'all' ? undefined : topicFilter,
        ...placementParams(showsOn),
        limit: LIST_LIMIT
      });
      rows = res.data.items ?? [];
      total = res.data.pagination?.total ?? rows.length;
      // remember any topics present so the filter never hides them
      const next = new Set(seenTopics);
      for (const faq of rows) if (faq.category?.trim()) next.add(faq.category.trim());
      seenTopics = next;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load FAQs.';
    } finally {
      loading = false;
    }
  };

  // Each kind loads on its own, so one failing collection leaves the other
  // pickers usable and says which one is missing.
  const loadRecords = async () => {
    recordsLoading = true;
    const results = await Promise.allSettled(FAQ_PLACEMENT_KINDS.map((kind) => loadFaqPlacementRecords(kind.value)));
    const next = { ...records };
    const errors: Partial<Record<FaqPlacementKind, string>> = {};
    FAQ_PLACEMENT_KINDS.forEach((kind, index) => {
      const result = results[index];
      if (result.status === 'fulfilled') next[kind.value] = result.value;
      else errors[kind.value] = `Unable to load ${kind.plural.toLowerCase()}. Close and reopen the editor to try again.`;
    });
    records = next;
    recordErrors = errors;
    recordsLoading = false;
  };

  const openEditor = (faq: FAQ | null) => {
    editingFaq = faq;
    const placements = faq?.placements ?? emptyPlacements();
    form = faq
      ? {
          answer: faq.answer,
          category: faq.category ?? '',
          question: faq.question,
          sort_order: String(faq.sort_order ?? 0),
          status: faq.status ?? 'draft',
          home: placements.home,
          category_ids: placements.categories.map((target) => target.id),
          tour_ids: placements.tours.map((target) => target.id),
          destination_ids: placements.destinations.map((target) => target.id)
        }
      : emptyForm();
    modalOpen = true;
    if (!recordsLoading && Object.keys(recordErrors).length) void loadRecords();
  };

  const closeModal = () => { modalOpen = false; editingFaq = null; form = emptyForm(); };

  const save = async () => {
    if (saving) return;
    if (form.question.trim().length < 5) { showToast('Question must be at least 5 characters.', 'error'); return; }
    // The answer is HTML; count what a reader would see, not the markup.
    if (toMetaText(form.answer).length < 5) { showToast('Answer must be at least 5 characters.', 'error'); return; }
    saving = true;
    const payload = {
      answer: form.answer.trim(),
      category: form.category.trim() || null,
      question: form.question.trim(),
      sort_order: Math.max(0, Math.trunc(Number(form.sort_order) || 0)),
      status: form.status,
      // Sending placements replaces every place this question showed before.
      placements: {
        home: form.home,
        category_ids: form.category_ids,
        tour_ids: form.tour_ids,
        destination_ids: form.destination_ids
      }
    };
    try {
      if (editingFaq) {
        await api.faqs.update(editingFaq.id, payload);
        showToast('FAQ updated successfully.');
      } else {
        await api.faqs.create(payload);
        showToast('FAQ created successfully.');
      }
      closeModal();
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save FAQ.', 'error');
    } finally {
      saving = false;
    }
  };

  const openDelete = (faq: FAQ) => { faqToDelete = faq; confirmOpen = true; };

  const confirmDelete = async () => {
    if (!faqToDelete) return;
    deleting = true;
    try {
      await api.faqs.remove(faqToDelete.id);
      showToast('FAQ deleted successfully.');
      confirmOpen = false;
      faqToDelete = null;
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete FAQ.', 'error');
    } finally {
      deleting = false;
    }
  };

  onMount(() => {
    showsOn = showsOnFromUrl(page.url.searchParams);
    void loadRecords();
    void load();
  });
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
  <AdminPageHeader
    eyebrow="Content Management"
    title="FAQs"
    description="One shared library of traveller questions. Write each question once, then choose where it shows: the home page, travel styles, tours and destinations."
    actionLabel="New FAQ"
    actionIcon={Plus}
    on:action={() => openEditor(null)}
  />

  <!-- Four filters plus a button will not fit one row until the screen is very
       wide: fixed tracks pushed the Apply button past the card. Same ladder the
       tours toolbar uses — stack, then two up, then three, then one row. -->
  <AdminToolbar className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(200px,1fr)_minmax(180px,240px)_minmax(150px,190px)_minmax(140px,170px)_auto] 2xl:items-end">
    <CmsLabel class="grid min-w-0 gap-2 text-sm font-medium text-ink">
      <span>Search</span>
      <span class="flex h-11 min-w-0 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
        <Search size={16} class="shrink-0 text-ink/45" />
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Search question, answer, or topic..." onkeydown={(e) => e.key === 'Enter' && load()} />
      </span>
    </CmsLabel>

    <!-- Grouped by kind, so a tour and a destination with the same name stay
         distinguishable. -->
    <div class="cms-field">
      <CmsLabel for="shows_on_filter">Shows on</CmsLabel>
      <CmsSelect.Root type="single" name="shows_on_filter" bind:value={showsOn}>
        <CmsSelect.Trigger id="shows_on_filter" class="h-10 w-full min-w-0"><span class="truncate">{showsOnLabel}</span></CmsSelect.Trigger>
        <CmsSelect.Content class="cms-select-content">
          <CmsSelect.Item value="all" label="All places">All places</CmsSelect.Item>
          <CmsSelect.Item value="home" label="Home page">Home page</CmsSelect.Item>
          <CmsSelect.Item value="none" label="Not shown anywhere">Not shown anywhere</CmsSelect.Item>
          {#each FAQ_PLACEMENT_KINDS as kind (kind.value)}
            {#if records[kind.value].length}
              <CmsSelect.Separator />
              <CmsSelect.Group>
                <CmsSelect.GroupHeading>{kind.plural}</CmsSelect.GroupHeading>
                {#each records[kind.value] as record (record.id)}
                  <CmsSelect.Item value={`${kind.value}:${record.id}`} label={record.label}>{record.label}</CmsSelect.Item>
                {/each}
              </CmsSelect.Group>
            {/if}
          {/each}
        </CmsSelect.Content>
      </CmsSelect.Root>
    </div>

    <AdminSelect label="Topic" name="topic_filter" bind:value={topicFilter} options={topicFilterOptions} />
    <AdminSelect label="Status" name="status_filter" bind:value={statusFilter} options={[{ label: 'All statuses', value: 'all' }, ...statusOptions]} />
    <AdminButton variant="secondary" on:click={load}>Apply</AdminButton>
  </AdminToolbar>

  {#if loading}
    <LoadingState message="Loading FAQs..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if rows.length === 0}
    <AdminEmptyState
      title={filtered ? 'No matching questions' : 'No FAQs yet'}
      message={filtered
        ? 'Nothing matches these filters. Change them above, or add a new question.'
        : 'Create your first FAQ to help travelers, improve SEO, and handle common objections before they reach support.'}
      actionLabel="New FAQ"
      icon={CircleQuestionMark}
      on:action={() => openEditor(null)}
    />
  {:else}
    <!-- One flat list in sort order. A question can show in many places, so
         grouping by place would repeat rows; the chips say where each shows. -->
    <section class="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm">
      <header class="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 bg-sand/40 px-5 py-3">
        <h2 class="text-sm font-bold text-ink">{total === 1 ? '1 question' : `${total} questions`}</h2>
        {#if total > rows.length}
          <p class="text-xs text-ink/55">Showing the first {rows.length}, by sort order. Search or filter to find the rest.</p>
        {/if}
      </header>

      <div class="divide-y divide-ink/10">
        {#each rows as faq (faq.id)}
          {@const chips = placementChips(faq)}
          {@const showAll = allChips.has(faq.id)}
          <article class="px-5 py-4">
            <div class="flex items-start gap-3">
              <CmsButton variant="ghost"
                class="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-ink/10 bg-surface text-ink/55 transition hover:bg-sand/70"
                type="button"
                aria-label={expanded.has(faq.id) ? 'Collapse answer' : 'Expand answer'}
                onclick={() => (expanded = toggleIn(expanded, faq.id))}
              >
                <ChevronDown size={15} class={`transition-transform ${expanded.has(faq.id) ? 'rotate-180' : ''}`} />
              </CmsButton>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <CmsButton variant="ghost" class="h-auto min-w-0 flex-1 justify-start whitespace-normal p-0 text-left hover:bg-transparent" type="button" onclick={() => (expanded = toggleIn(expanded, faq.id))}>
                    <p class="font-semibold text-ink">{faq.question}</p>
                  </CmsButton>
                  <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {#if faq.category?.trim()}
                      <span class="rounded-full bg-sand/70 px-2 py-0.5 text-[11px] font-semibold text-ink/55">Topic: {faq.category}</span>
                    {/if}
                    <span class="rounded-full bg-sand/70 px-2 py-0.5 text-[11px] font-semibold text-ink/55">Sort {faq.sort_order ?? 0}</span>
                    <StatusBadge status={faq.status ?? 'draft'} />
                  </div>
                </div>

                {#if expanded.has(faq.id)}
                  <div transition:slide={{ duration: 160 }}>
                    <RichText value={faq.answer} className="mt-2 text-sm leading-6 text-ink/65" />
                  </div>
                {:else}
                  <p class="mt-1 line-clamp-1 text-sm text-ink/45">{toMetaText(faq.answer, 140)}</p>
                {/if}

                <ul class="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Where this question shows">
                  {#if !chips.length}
                    <li class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200/80">
                      <TriangleAlert size={11} />Not shown anywhere
                    </li>
                  {/if}
                  {#each showAll ? chips : chips.slice(0, CHIP_LIMIT) as chip (chip.key)}
                    <li class="max-w-full">
                      {#if chip.href}
                        <a
                          class="block max-w-full truncate rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-semibold text-forest underline-offset-2 transition hover:underline"
                          href={chip.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open on the website"
                        >{chip.label}</a>
                      {:else}
                        <span class="block max-w-full truncate rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-semibold text-forest">{chip.label}</span>
                      {/if}
                    </li>
                  {/each}
                  {#if chips.length > CHIP_LIMIT}
                    <li>
                      <CmsButton variant="ghost" size="xs" class="h-auto rounded-full px-2 py-0.5 text-[11px] font-semibold text-ink/60" onclick={() => (allChips = toggleIn(allChips, faq.id))}>
                        {showAll ? 'Show fewer' : `+${chips.length - CHIP_LIMIT} more`}
                      </CmsButton>
                    </li>
                  {/if}
                </ul>

                <div class="mt-3 flex gap-2">
                  <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openEditor(faq)}>
                    <Edit size={14} />Edit
                  </CmsButton>
                  <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDelete(faq)}>
                    <Trash2 size={14} />Delete
                  </CmsButton>
                </div>
              </div>
            </div>
          </article>
        {/each}
      </div>
    </section>
  {/if}
</div>

{#if modalOpen}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) closeModal(); }}>
    <!-- cms-category-dialog is the shared fixed-height editor shell: the body
         scrolls between a pinned header and footer. -->
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog cms-category-dialog gap-0 p-0 overflow-hidden" style="width:min(calc(100vw - 2rem),72rem);max-width:none">
      <CmsDialog.Title class="sr-only">{editingFaq ? 'Edit question' : 'Add a question'}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Write the question and answer, then choose where it shows. Save your changes or close to return to the list.</CmsDialog.Description>
      <form class="cms-editor-form" novalidate on:submit|preventDefault={save}>
        <header class="cms-editor-header">
          <div class="flex items-center gap-3">
            <span class="cms-editor-emblem"><CircleQuestionMark size={20} /></span>
            <div><p>FAQ EDITOR</p><h2>{editingFaq ? 'Edit question' : 'Add a question'}</h2></div>
          </div>
          <div class="flex items-center gap-4">
            <StatusBadge status={form.status} />
            <CmsButton variant="ghost" size="icon" aria-label="Close FAQ editor" onclick={closeModal}><X size={19} /></CmsButton>
          </div>
        </header>

        <div class="cms-editor-canvas flex-1">
          <div class="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
            <!-- Content -->
            <div class="grid min-w-0 gap-5">
              <section class="cms-form-section grid gap-5">
                <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Question &amp; answer</p>
                <AdminFormInput label="Question" name="question" bind:value={form.question} placeholder="e.g. What is the best time for a Serengeti safari?" required />
                <AdminRichText label="Answer" name="answer" bind:value={form.answer} rows={8} headings="none" placeholder="Write a clear, helpful answer that builds trust and handles objections." />
              </section>

              <section class="cms-form-section grid gap-5">
                <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Library details</p>
                <div class="grid gap-4 sm:grid-cols-3">
                  <AdminSelect label="Topic" name="topic" bind:value={form.category} options={topicFormOptions} />
                  <AdminSelect label="Status" name="status" bind:value={form.status} options={statusOptions} />
                  <AdminFormInput label="Sort order" name="sort_order" type="number" min={0} bind:value={form.sort_order} />
                </div>
                <p class="-mt-2 text-xs leading-5 text-ink/50">Topic files the question in this library — it is not a travel style. Lower sort order shows first on every page the question appears on.</p>
              </section>

              <!-- Translations, on a saved question only: they hang off its id, and a
                   question being written has none yet. The English above is the
                   source, so it is written first and translated after. -->
              {#if editingFaq?.id}
                <section class="cms-form-section grid gap-4">
                  <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Translations</p>
                  <AdminTranslationTabs
                    entityType="faqs"
                    entityId={editingFaq.id}
                    on:toast={(event) => showToast(event.detail.message, event.detail.type)}
                  />
                </section>
              {/if}
            </div>

            <!-- Placements -->
            <div class="grid min-w-0 gap-4">
              <section class="cms-form-section grid gap-4">
                <div>
                  <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Where this question shows</p>
                  <p class="mt-1 text-xs leading-5 text-ink/55">Write it once and place it on every page it answers. Changes apply everywhere it shows.</p>
                </div>

                {#if placed}
                  <p class="flex items-start gap-2 rounded-lg border border-forest/15 bg-forest/5 px-3 py-2.5 text-[13px] font-medium leading-5 text-forest" role="status">
                    <CircleCheck size={16} class="mt-0.5 shrink-0" />{placementSummary}.
                  </p>
                {:else}
                  <p class="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] font-medium leading-5 text-amber-900" role="status">
                    <TriangleAlert size={16} class="mt-0.5 shrink-0" />Not shown anywhere yet — choose at least one place.
                  </p>
                {/if}
                {#if form.status !== 'published'}
                  <p class="-mt-1 text-xs leading-5 text-ink/55">
                    {form.status === 'draft' ? 'Draft' : 'Archived'} — it only shows on the site once Published.
                  </p>
                {/if}

                <CmsLabel class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-ink/10 bg-surface px-4 py-3">
                  <span class="flex min-w-0 items-center gap-3">
                    <House size={16} class="shrink-0 text-forest/70" />
                    <span class="grid gap-0.5">
                      <span class="text-sm font-semibold text-heading">Home page</span>
                      <span class="text-xs font-normal text-ink/55">The FAQ section on the home page.</span>
                    </span>
                  </span>
                  <Switch bind:checked={form.home} aria-label="Show on the home page" />
                </CmsLabel>
              </section>

              {#each FAQ_PLACEMENT_KINDS as kind (kind.value)}
                <FaqPlacementPicker
                  id={`faq-${kind.value}`}
                  label={kind.plural}
                  description={KIND_HELP[kind.value]}
                  icon={KIND_ICONS[kind.value]}
                  options={records[kind.value]}
                  known={editingFaq?.placements?.[kind.key] ?? []}
                  loading={recordsLoading && !records[kind.value].length}
                  error={recordErrors[kind.value] ?? ''}
                  bind:selected={form[kind.field]}
                />
              {/each}
            </div>
          </div>
        </div>

        <footer class="cms-editor-footer">
          <span class="cms-save-note">{saveNote}</span>
          <div class="cms-editor-footer-actions">
            <CmsButton variant="outline" onclick={closeModal}>Cancel</CmsButton>
            <CmsButton variant="default" type="submit" disabled={saving} class="gap-2 px-5"><Save size={14} />{saving ? 'Saving…' : editingFaq ? 'Save changes' : 'Create FAQ'}</CmsButton>
          </div>
        </footer>
      </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title="Delete FAQ"
  message={`Delete "${faqToDelete?.question ?? 'this FAQ'}"? It is removed from every page it shows on. This action soft-deletes the record.`}
  on:cancel={() => { confirmOpen = false; faqToDelete = null; }}
  on:confirm={confirmDelete}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting FAQ...
  </div>
{/if}
