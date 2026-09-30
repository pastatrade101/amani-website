<script lang="ts" module>
  /** A message for the next editor to show: creating a tour ends on its edit page. */
  let flash = '';
</script>

<script lang="ts">
  import EditorNavigation from './EditorNavigation.svelte';
  import StatusBadge from './StatusBadge.svelte';
  import { Button as CmsButton } from '$lib/components/ui/button';

  import { beforeNavigate, goto, replaceState } from '$app/navigation';
  import { onMount, tick } from 'svelte';
  import {
    ArrowLeft,
    ArrowRight,
    Binoculars,
    CircleDollarSign,
    Compass,
    ExternalLink,
    FileText,
    Images,
    Languages,
    ListChecks,
    Route,
    Save,
    Search
  } from '@lucide/svelte';
  import { ApiRequestError, api } from '$lib/admin/api/client';
  import AdminItineraryTranslations from './AdminItineraryTranslations.svelte';
  import AdminTranslationTabs from './AdminTranslationTabs.svelte';
  import ToastStack from './ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';
  import { toPlainText } from '$lib/admin/richText';
  import type { Activity, Destination, ItineraryDay, Lodge, Paginated, Tour, TravelStyle } from '$lib/admin/types';
  import type { PricingSeason } from '$lib/safari-pricing';
  import ActivitiesPanel from './tour-editor/ActivitiesPanel.svelte';
  import EssentialsPanel from './tour-editor/EssentialsPanel.svelte';
  import InclusionsPanel from './tour-editor/InclusionsPanel.svelte';
  import ItineraryPanel from './tour-editor/ItineraryPanel.svelte';
  import PhotographyPanel from './tour-editor/PhotographyPanel.svelte';
  import PricingPanel from './tour-editor/PricingPanel.svelte';
  import SeoPanel from './tour-editor/SeoPanel.svelte';
  import TripDetailsPanel from './tour-editor/TripDetailsPanel.svelte';
  import {
    contentPayload,
    corePayload,
    emptyForm,
    findProblems,
    formFromTour,
    lodgesInTour,
    slugify,
    snapshot,
    text,
    type ActivityOption,
    type DestinationOption,
    type LodgeOption,
    type MediaItem,
    type Option,
    type TabKey
  } from './tour-editor/model';

  type Toast = { id: string; message: string; type: 'error' | 'success' };

  export let mode: 'create' | 'edit' = 'create';
  export let tourId = '';

  /**
   * Same stepped editor as Categories and Activities, as a full page: one
   * concern per step, Save always in reach. The itinerary, lists, gallery and
   * activities that used to live on their own admin pages are steps here, so
   * a tour is written — and saved — in one place.
   */
  const TABS = [
    ['basics', FileText, 'Essentials'],
    ['trip', Compass, 'Trip details'],
    ['itinerary', Route, 'Itinerary'],
    ['included', ListChecks, 'Included & excluded'],
    ['pricing', CircleDollarSign, 'Pricing'],
    ['activities', Binoculars, 'Activities'],
    ['media', Images, 'Photography'],
    ['seo', Search, 'Search & sharing'],
    ['translations', Languages, 'Translations']
  ] as const;

  const STEP_HINTS: Record<TabKey, string> = {
    basics: 'Introduce a journey worth taking.',
    trip: 'The practical details, from the first day to the last.',
    itinerary: 'Day by day: where travellers go, what they do and where they sleep in each safari style.',
    included: 'What the price covers, and what it does not.',
    pricing: 'Per-person prices by group size for Budget, Midrange and Luxury.',
    activities: 'Experiences from the catalogue that are part of this safari.',
    media: 'Let your photography do the talking.',
    seo: 'Help the right travellers discover this safari.',
    translations: 'Make your safari accessible in more languages.'
  };

  /** API field → the step that owns it, so a rejected save opens the right step. */
  const FIELD_TABS: Record<string, TabKey> = {
    title: 'basics',
    slug: 'basics',
    short_description: 'basics',
    full_description: 'basics',
    destination_id: 'basics',
    destination_ids: 'basics',
    category_id: 'basics',
    specialist_id: 'basics',
    duration_days: 'trip',
    duration_nights: 'trip',
    group_size_min: 'trip',
    group_size_max: 'trip',
    minimum_age: 'trip',
    highlights: 'trip',
    customization_options: 'trip',
    start_location: 'trip',
    end_location: 'trip',
    experience_type: 'trip',
    days: 'itinerary',
    inclusions: 'included',
    exclusions: 'included',
    price_from: 'pricing',
    currency: 'pricing',
    activity_ids: 'activities',
    images: 'media',
    main_image_url: 'media',
    banner_image_url: 'media',
    og_image_url: 'seo',
    meta_title: 'seo',
    seo_title: 'seo',
    meta_description: 'seo'
  };

  /** Set once the tour exists; a create whose content save failed switches to it. */
  let currentId = mode === 'edit' ? tourId : '';
  let loadedTourId = '';
  let record: Tour | null = null;
  let form = emptyForm();
  let baseline = snapshot(form);
  let loading = mode === 'edit';
  let loadingOptions = true;
  let loadingLodges = false;
  let saving = false;
  let mounted = false;
  let error = '';
  let attemptedSave = false;
  let slugManuallyEdited = mode === 'edit';
  let translationUnsaved = false;
  /** Set right before a deliberate navigation, so the unsaved-changes guard stays quiet. */
  let leaving = false;
  let expandedKey = '';
  let activeTab: TabKey = 'basics';
  let editorBody: HTMLDivElement;
  let toasts: Toast[] = [];

  let destinations: DestinationOption[] = [];
  let lodges: LodgeOption[] = [];
  let activities: ActivityOption[] = [];
  let categoryOptions: Option[] = [{ label: 'No category', value: '' }];
  let specialistOptions: Option[] = [{ label: 'No specialist', value: '' }];
  let travelStyleOptions: Option[] = [];
  let mediaItems: MediaItem[] = [];
  let seasons: PricingSeason[] = [];
  let knownActivityNames: Record<string, string> = {};
  /** Lodges the saved days already use: named before the lodge list arrives. */
  let recordLodges: LodgeOption[] = [];

  $: visibleTabs = TABS.filter(([key]) => key !== 'translations' || Boolean(currentId));
  $: stepIndex = Math.max(0, visibleTabs.findIndex(([key]) => key === activeTab));
  $: if (!slugManuallyEdited) form.slug = slugify(form.title);

  $: dirty = !loading && snapshot(form) !== baseline;
  $: storedSlug = text(record?.slug);
  $: problems = findProblems(form, storedSlug);
  $: problemTabs = new Set(problems.map((problem) => problem.tab));
  $: tabError = Object.fromEntries(TABS.map(([key]) => [key, attemptedSave && problemTabs.has(key)])) as Record<TabKey, boolean>;
  $: problemDays = problems.map((problem) => problem.dayKey).filter((key): key is string => Boolean(key));

  // Only saved days can be translated; the list is remounted when that set changes.
  $: savedDays = [...((record?.itinerary_days ?? []) as ItineraryDay[])]
    .filter((day) => day.id)
    .sort((a, b) => Number(a.day_number) - Number(b.day_number));
  $: savedDayKey = savedDays.map((day) => day.id).join(',');
  $: unsavedDayCount = form.days.filter((day) => !day.id).length;
  $: lodgeChoices = [...lodges, ...recordLodges.filter((lodge) => !lodges.some((item) => item.id === lodge.id))];
  $: publicUrl = record?.status === 'published' && record.slug ? `/tours/${record.slug}` : '';

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    // Errors carry instructions, so they stay long enough to read.
    setTimeout(() => (toasts = toasts.filter((toast) => toast.id !== id)), type === 'error' ? 7000 : 3500);
  };
  const dismissToast = (event: CustomEvent<string>) => (toasts = toasts.filter((toast) => toast.id !== event.detail));
  const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

  const selectTab = (tab: TabKey) => {
    activeTab = tab;
    // Each step starts at its own top rather than inheriting the last one's scroll.
    editorBody?.scrollTo({ top: 0 });
  };

  /** Save blocked by a field on a step the editor cannot see: go there, then say why. */
  const failOn = (tab: TabKey, message: string) => {
    selectTab(tab);
    showToast(message, 'error');
  };

  const tabForError = (err: unknown): TabKey | null => {
    if (!(err instanceof ApiRequestError)) return null;
    for (const issue of err.errors) {
      const tab = FIELD_TABS[String(issue.path?.[0] ?? '')];
      if (tab) return tab;
    }
    return null;
  };

  // Live context handed to the AI co-pilot so its drafts fit the trip.
  const aiContext = () => ({
    title: text(form.title) || undefined,
    destination:
      form.destination_ids
        .map((id) => destinations.find((place) => place.id === id)?.name)
        .filter(Boolean)
        .join(', ') || undefined,
    duration_days: Number(text(form.duration_days)) || undefined,
    budget_tier: form.budget_tier || undefined,
    highlights: form.highlights.map(text).filter(Boolean).join('\n') || undefined,
    short_description: text(form.short_description) || undefined,
    // The co-pilot reads prose, not markup.
    full_description: toPlainText(form.full_description) || undefined
  });

  // ── Loading ────────────────────────────────────────────────────────────────

  /** The API caps a page at 100, so long lists are read page by page. */
  const allPages = async <T>(read: (page: number) => Promise<{ data: Paginated<T> }>, maxPages = 20): Promise<T[]> => {
    const items: T[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const res = await read(page);
      items.push(...(res.data.items ?? []));
      if (page >= Number(res.data.pagination?.totalPages ?? 1)) break;
    }
    return items;
  };

  const loadLodges = async () => {
    loadingLodges = true;
    try {
      const items = await allPages<Lodge>((page) => api.lodges.list({ limit: 100, page, status: 'all' }), 10);
      lodges = items
        .filter((lodge) => lodge.id)
        .map((lodge) => ({
          id: String(lodge.id),
          name: String(lodge.name ?? 'Untitled lodge'),
          destination_id: String(lodge.destination_id ?? ''),
          destination_name: String(lodge.destinations?.name ?? ''),
          level: String(lodge.accommodation_level ?? ''),
          status: String(lodge.status ?? 'published')
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      showToast(errorText(err, 'Unable to load lodges.'), 'error');
    } finally {
      loadingLodges = false;
    }
  };

  const loadOptions = async () => {
    loadingOptions = true;
    const [places, categories, specialists, styles, media, catalogue] = await Promise.allSettled([
      allPages<Destination>((page) => api.destinations.list({ limit: 100, page, status: 'all' })),
      api.categories.list({ limit: 100, status: 'all' }),
      api.specialists.list({ limit: 100, status: 'all' }),
      api.travelStyles.list({ limit: 100, status: 'all' }),
      api.media.list({ file_type: 'image', limit: 100 }),
      allPages<Activity>((page) => api.activities.list({ limit: 100, page, status: 'all' }), 5)
    ]);
    const failed: string[] = [];

    if (places.status === 'fulfilled') {
      destinations = places.value
        .filter((place) => place.id)
        .map((place) => ({
          id: String(place.id),
          name: String(place.name ?? place.slug ?? 'Untitled destination'),
          region: String(place.region ?? ''),
          status: String(place.status ?? 'published'),
          // A place without coordinates is linkable but invisible on the route map.
          pinned:
            place.latitude != null &&
            place.longitude != null &&
            Number.isFinite(Number(place.latitude)) &&
            Number.isFinite(Number(place.longitude))
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } else failed.push('destinations');

    if (categories.status === 'fulfilled') {
      categoryOptions = [
        { label: 'No category', value: '' },
        ...categories.value.data.items.map((category) => ({ label: String(category.name ?? category.slug ?? 'Untitled category'), value: String(category.id) }))
      ];
    } else failed.push('categories');

    if (specialists.status === 'fulfilled') {
      specialistOptions = [
        { label: 'No specialist', value: '' },
        ...specialists.value.data.items
          .filter((specialist) => specialist.id)
          .map((specialist) => {
            const role = String(specialist.role ?? '').trim();
            const name = String(specialist.name ?? 'Untitled specialist');
            return { label: role ? `${name} - ${role}` : name, value: String(specialist.id) };
          })
      ];
    } else failed.push('specialists');

    if (styles.status === 'fulfilled') {
      travelStyleOptions = (styles.value.data.items as TravelStyle[])
        .filter((style) => style.persona?.trim() && style.status !== 'archived')
        .map((style) => ({ label: style.name, value: slugify(style.persona) }))
        .filter((option, index, options) => option.value && options.findIndex((item) => item.value === option.value) === index);
    } else failed.push('travel styles');

    if (media.status === 'fulfilled') {
      mediaItems = media.value.data.items
        .map((item) => ({
          id: String(item.id ?? ''),
          file_name: String(item.file_name ?? 'Untitled image'),
          file_url: String(item.file_url ?? ''),
          thumbnail_url: (item.thumbnail_url as string | null | undefined) ?? null
        }))
        .filter((item) => item.id && item.file_url);
    }

    if (catalogue.status === 'fulfilled') {
      activities = catalogue.value
        .filter((activity) => activity.id)
        .map((activity) => ({
          id: String(activity.id),
          name: String(activity.name ?? 'Untitled activity'),
          category: String(activity.category ?? ''),
          status: String(activity.status ?? 'published'),
          destination_ids: [
            ...new Set(
              [activity.destination_id, ...(activity.activity_destinations ?? []).map((link) => link.destination_id)]
                .map((id) => String(id ?? ''))
                .filter(Boolean)
            )
          ]
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } else failed.push('activities');

    if (failed.length) showToast(`Could not load ${failed.join(', ')}. Reload the page to try again.`, 'error');
    loadingOptions = false;
  };

  /** Replace the whole form with a stored tour and call that the clean state. */
  const hydrate = (tour: Tour) => {
    const openIndex = form.days.findIndex((day) => day.key === expandedKey);
    record = tour;
    form = formFromTour(tour);
    expandedKey = openIndex >= 0 ? (form.days[openIndex]?.key ?? '') : '';
    baseline = snapshot(form);
    slugManuallyEdited = true;
    seasons = (Array.isArray(tour.tour_pricing_seasons) ? tour.tour_pricing_seasons : []) as PricingSeason[];
    recordLodges = lodgesInTour(tour);
    knownActivityNames = Object.fromEntries(
      (tour.tour_activities ?? []).flatMap((link) => (link.activity?.id ? [[link.activity.id, link.activity.name]] : []))
    );
  };

  const loadTour = async (id: string) => {
    loadedTourId = id;
    loading = true;
    error = '';
    try {
      const res = await api.tours.get(id);
      if (loadedTourId !== id) return;
      currentId = String(res.data.id ?? id);
      expandedKey = '';
      attemptedSave = false;
      hydrate(res.data);
    } catch (err) {
      error = errorText(err, 'Unable to load this safari.');
    } finally {
      if (loadedTourId === id) loading = false;
    }
  };

  // Loads the tour once mounted, and again if the edit route is reused for another tour.
  $: if (mounted && mode === 'edit' && tourId && tourId !== loadedTourId) void loadTour(tourId);

  // ── Saving ─────────────────────────────────────────────────────────────────

  /**
   * Two requests: the tour itself, then its content (days, lists, gallery,
   * activities) in one replace-all call. The form is rebuilt from what the
   * server returns, so new days and photos get their ids and the next save
   * updates them instead of adding them again.
   */
  const saveTour = async () => {
    if (saving) return;
    attemptedSave = true;
    const problem = findProblems(form, storedSlug)[0];
    if (problem) {
      failOn(problem.tab, problem.message);
      if (problem.dayKey) {
        // Open the day that blocks the save and bring it into view.
        expandedKey = problem.dayKey;
        await tick();
        editorBody?.querySelector(`[data-day-key="${problem.dayKey}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      } else if (problem.field) {
        // Put the cursor in the field that is too long, with its counter in view.
        await tick();
        const input = editorBody?.querySelector<HTMLElement>(`[name="${problem.field}"]`);
        input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        input?.focus({ preventScroll: true });
      }
      return;
    }

    saving = true;
    const core = corePayload(form);
    const content = contentPayload(form);
    let id = currentId;

    try {
      if (id) {
        await api.tours.update(id, core);
      } else {
        const created = await api.tours.create(core);
        id = String(created.data?.id ?? '');
        if (!id) throw new Error('The safari was created, but the server did not say which one. Find it in the tours list.');
      }
    } catch (err) {
      saving = false;
      const tab = tabForError(err);
      if (tab) selectTab(tab);
      showToast(errorText(err, 'Unable to save the safari.'), 'error');
      return;
    }

    try {
      const res = await api.tours.saveContent(id, content);
      const saved = Array.isArray(res.data?.itinerary_days) ? res.data : (await api.tours.get(id)).data;
      if (mode === 'create') {
        flash = 'Safari created.';
        leaving = true;
        await goto(`/admin/tours/${id}/edit`, { replaceState: true });
        return;
      }
      hydrate(saved);
      showToast('Safari saved.');
    } catch (err) {
      // The tour exists now: stay here, keep everything typed, and let Save
      // retry as an update rather than creating a second tour.
      if (!currentId) {
        currentId = id;
        try {
          replaceState(`/admin/tours/${id}/edit`, {});
        } catch {
          /* only the address bar; the editor already knows the id */
        }
      }
      const tab = tabForError(err);
      if (tab) selectTab(tab);
      showToast(
        `The safari details were saved, but not the itinerary, lists, photos and activities: ${errorText(err, 'the server refused them.')} Press Save to try again.`,
        'error'
      );
    } finally {
      saving = false;
    }
  };

  beforeNavigate((navigation) => {
    if (leaving || !(dirty || translationUnsaved)) return;
    // Closing or reloading the tab: the browser shows its own prompt.
    if (navigation.type === 'leave') {
      navigation.cancel();
      return;
    }
    if (!confirm('This safari has unsaved changes. Leave without saving them?')) navigation.cancel();
  });

  onMount(() => {
    mounted = true;
    if (flash) {
      showToast(flash);
      flash = '';
    }
    void loadOptions();
    void loadLodges();
  });
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="cms-tour-workspace">
  <div class="cms-tour-breadcrumb">
    <CmsButton variant="ghost" size="sm" onclick={() => goto('/admin/tours')}><ArrowLeft size={14} />All tours</CmsButton><span>/</span><span>{currentId ? 'Edit safari' : 'New safari'}</span>
  </div>
  {#if loading}
    <LoadingState message="Loading safari..." />
  {:else if error}
    <ErrorState message={error} />
  {:else}
    <form class="cms-editor-form cms-tour-editor" novalidate on:submit|preventDefault={saveTour}>
      <header class="cms-editor-header">
        <div class="flex min-w-0 items-center gap-3">
          <span class="cms-editor-emblem shrink-0"><Compass size={20} /></span>
          <div class="min-w-0"><p>SAFARI EDITOR</p><h2>{text(form.title) || (currentId ? 'Untitled safari' : 'Create a safari')}</h2></div>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          {#if publicUrl}
            <a class="hidden items-center gap-1 text-xs font-semibold text-ink/60 hover:text-heading sm:inline-flex" href={publicUrl} target="_blank" rel="noopener">View on site <ExternalLink size={12} /></a>
          {/if}
          <StatusBadge status={form.status} />
        </div>
      </header>
      <div class="cms-editor-workspace">
        <EditorNavigation sections={visibleTabs} active={activeTab} errors={tabError} onNavigate={(key) => selectTab(key as TabKey)} />
        <div class="cms-editor-canvas" bind:this={editorBody}>
          <div class="cms-editor-section-heading"><p>STEP {String(stepIndex + 1).padStart(2, '0')} / {String(visibleTabs.length).padStart(2, '0')}</p><h3>{visibleTabs[stepIndex]?.[2]}</h3><span>{STEP_HINTS[activeTab]}</span></div>

          <!--
            Steps are CSS-hidden, never {#if}-unmounted: the rich-text editors
            and AdminTranslationTabs keep their state that way, and a draft
            survives moving between steps. The toggle sits on a bare wrapper —
            `hidden` on an element that also carries a display utility would
            lose to it.
          -->
          <div class:hidden={activeTab !== 'basics'}>
            <EssentialsPanel bind:form bind:slugManuallyEdited {storedSlug} {destinations} {seasons} {categoryOptions} {specialistOptions} {loadingOptions} {attemptedSave} {aiContext} />
          </div>
          <div class:hidden={activeTab !== 'trip'}>
            <TripDetailsPanel bind:form {travelStyleOptions} {loadingOptions} {attemptedSave} {aiContext} />
          </div>
          <div class:hidden={activeTab !== 'itinerary'}>
            <ItineraryPanel
              bind:form
              bind:expandedKey
              {destinations}
              lodges={lodgeChoices}
              {loadingLodges}
              onRefreshLodges={loadLodges}
              {mediaItems}
              {attemptedSave}
              {problemDays}
              notify={showToast}
            />
          </div>
          <div class:hidden={activeTab !== 'included'}>
            <InclusionsPanel bind:form />
          </div>
          <div class:hidden={activeTab !== 'pricing'}>
            <PricingPanel bind:form tourId={currentId} {seasons} {dirty} {attemptedSave} />
          </div>
          <div class:hidden={activeTab !== 'activities'}>
            <ActivitiesPanel bind:form {activities} {destinations} {loadingOptions} knownNames={knownActivityNames} />
          </div>
          <div class:hidden={activeTab !== 'media'}>
            <PhotographyPanel bind:form {mediaItems} {destinations} {seasons} />
          </div>
          <div class:hidden={activeTab !== 'seo'}>
            <SeoPanel bind:form {mediaItems} {aiContext} />
          </div>

          <!-- Translations need saved records: the tour, and each saved day. -->
          {#if currentId}
            <div class:hidden={activeTab !== 'translations'}>
              <div class="grid gap-5">
                <AdminTranslationTabs entityType="tours" entityId={currentId} bind:unsaved={translationUnsaved} on:toast={(event) => showToast(event.detail.message, event.detail.type ?? 'success')} />
                {#if savedDays.length}
                  {#key savedDayKey}
                    <AdminItineraryTranslations days={savedDays} on:toast={(event) => showToast(event.detail.message, event.detail.type ?? 'success')} />
                  {/key}
                {/if}
                {#if unsavedDayCount}
                  <p class="rounded-md border border-dashed border-ink/20 bg-surface px-3 py-3 text-xs text-ink/55">
                    {unsavedDayCount} new {unsavedDayCount === 1 ? 'day appears' : 'days appear'} here for translation once the safari is saved.
                  </p>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </div>
      <footer class="cms-editor-footer">
        <span class="cms-save-note">{dirty ? 'Unsaved changes · ' : ''}{form.status === 'draft' ? 'Draft · Not visible on your website' : form.status === 'published' ? 'Changes will be visible on your website' : 'Archived · Hidden from your website'}</span>
        <div class="cms-editor-footer-actions">
          {#if stepIndex > 0}<CmsButton variant="ghost" class="cms-editor-back" aria-label="Previous section" onclick={() => selectTab(visibleTabs[stepIndex - 1][0])}><ArrowLeft size={14} /><span>Back</span></CmsButton>{/if}
          {#if stepIndex < visibleTabs.length - 1}<CmsButton variant="outline" onclick={() => selectTab(visibleTabs[stepIndex + 1][0])}>Continue<ArrowRight size={14} /></CmsButton>{/if}
          <CmsButton type="submit" disabled={saving} class="gap-2 px-5"><Save size={14} />{saving ? 'Saving…' : form.status === 'draft' ? 'Save draft' : currentId ? 'Save changes' : 'Create safari'}</CmsButton>
        </div>
      </footer>
    </form>
  {/if}
</div>
