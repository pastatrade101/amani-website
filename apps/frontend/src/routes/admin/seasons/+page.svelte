<script lang="ts">
  import EditorNavigation from '$lib/admin/components/admin/EditorNavigation.svelte';
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
    CloudSun,
    Edit,
    FileText,
    ListChecks,
    Palette,
    Plus,
    Save,
    Search,
    ThumbsDown,
    ThumbsUp,
    Trash2,
    X
  } from '@lucide/svelte';
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
  import SeasonCard from '$lib/components/home/season-card.svelte';
  import {
    MONTHS,
    MONTH_SHORT,
    SEASON_ICONS,
    SEASON_TONES,
    UNASSIGNED_MONTH,
    coversMonth,
    monthRange,
    monthStrip,
    seasonIcon,
    seasonTone,
    type Season
  } from '$lib/seasons';

  type TabKey = 'basics' | 'look' | 'considerations';
  type PointKind = 'advantages' | 'disadvantages';

  /** Same stepped editor as Categories: one concern per step, Save always in reach. */
  const TABS = [
    ['basics', FileText, 'Essentials'],
    ['look', Palette, 'Icon & colour'],
    ['considerations', ListChecks, 'Travel considerations']
  ] as const;

  const STEP_HINTS: Record<TabKey, string> = {
    basics: 'Name the season, set its months and say what it is like to travel then.',
    look: 'Pick the icon and colour travellers see on the card and in the month strip.',
    considerations: 'The advantages and disadvantages behind “Travel considerations” on the card.'
  };

  type SeasonForm = {
    name: string;
    start_month: string;
    end_month: string;
    description: string;
    icon: string;
    tone: string;
    advantages: string[];
    disadvantages: string[];
    best_for: string;
    status: string;
    sort_order: string;
  };

  type Toast = { id: string; message: string; type: 'error' | 'success' };

  const MAX_POINTS = 12;
  const POINT_MAX = 160;

  const emptyForm = (sortOrder = 0): SeasonForm => ({
    name: '',
    start_month: '1',
    end_month: '3',
    description: '',
    icon: 'leaf',
    tone: 'green',
    advantages: [''],
    disadvantages: [''],
    best_for: '',
    status: 'draft',
    sort_order: String(sortOrder)
  });

  const statusOptions = [
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Archived', value: 'archived' }
  ];

  const monthOptions = MONTHS.map((month, index) => ({ label: month, value: String(index + 1) }));

  let rows: Season[] = [];
  let loading = true;
  let saving = false;
  let deleting = false;
  let error = '';
  let search = '';
  let status = 'all';
  let modalOpen = false;
  let confirmOpen = false;
  let editingSeason: Season | null = null;
  let seasonToDelete: Season | null = null;
  let form = emptyForm();
  let toasts: Toast[] = [];
  let activeTab: TabKey = 'basics';
  let bodyEl: HTMLDivElement;
  /** Fields only go red once the operator has tried to save. */
  let attemptedSave = false;

  $: stepIndex = TABS.findIndex(([key]) => key === activeTab);

  $: nameError =
    form.name.trim().length < 2
      ? 'Give the season a name, e.g. Green Season.'
      : form.name.trim().length > 60
        ? 'Keep the season name under 60 characters.'
        : '';
  $: pointsError = [...form.advantages, ...form.disadvantages].some((point) => point.trim().length > POINT_MAX)
    ? `Keep each point under ${POINT_MAX} characters.`
    : '';
  $: tabError = {
    basics: attemptedSave && Boolean(nameError),
    look: false,
    considerations: attemptedSave && Boolean(pointsError)
  } as Record<TabKey, boolean>;

  /** Live preview of the card being edited — the same component the homepage renders. */
  $: preview = {
    name: form.name.trim() || 'Season name',
    start_month: Number(form.start_month),
    end_month: Number(form.end_month),
    description: form.description,
    icon: form.icon,
    tone: form.tone,
    advantages: form.advantages,
    disadvantages: form.disadvantages,
    best_for: form.best_for
  } as Season;

  /** Year at a glance: what the homepage strip shows right now (published only, in order). */
  $: published = rows.filter((row) => row.status === 'published');
  $: strip = monthStrip(published);
  $: gaps = strip.filter((month) => !month.season).map((month) => month.label);
  $: overlaps = MONTH_SHORT.filter((_, index) => published.filter((season) => coversMonth(season, index + 1)).length > 1);

  const selectTab = (tab: TabKey) => {
    activeTab = tab;
    bodyEl?.scrollTo({ top: 0 });
  };

  /** Save blocked by a field the operator cannot see: go to it, then explain. */
  const failOn = (tab: TabKey, message: string) => {
    selectTab(tab);
    showToast(message, 'error');
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

  const loadSeasons = async () => {
    loading = true;
    error = '';
    try {
      const response = await api.seasons.list({ limit: 100, search, status });
      rows = response.data.items as unknown as Season[];
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : 'Unable to load seasons.';
    } finally {
      loading = false;
    }
  };

  const openCreateModal = () => {
    editingSeason = null;
    const nextSort = rows.reduce((max, row) => Math.max(max, Number(row.sort_order ?? 0)), 0) + 10;
    form = emptyForm(nextSort);
    activeTab = 'basics';
    attemptedSave = false;
    modalOpen = true;
  };

  // The list endpoint selects every column, so a row is the full record.
  const openEditModal = (season: Season) => {
    editingSeason = season;
    form = {
      name: season.name ?? '',
      start_month: String(season.start_month ?? 1),
      end_month: String(season.end_month ?? 1),
      description: season.description ?? '',
      icon: season.icon || 'leaf',
      tone: season.tone || 'green',
      advantages: season.advantages?.length ? [...season.advantages] : [''],
      disadvantages: season.disadvantages?.length ? [...season.disadvantages] : [''],
      best_for: season.best_for ?? '',
      status: season.status ?? 'draft',
      sort_order: String(season.sort_order ?? 0)
    };
    activeTab = 'basics';
    attemptedSave = false;
    modalOpen = true;
  };

  const closeModal = () => {
    modalOpen = false;
    editingSeason = null;
    form = emptyForm();
    activeTab = 'basics';
    attemptedSave = false;
  };

  const addPoint = (kind: PointKind) => {
    if (form[kind].length >= MAX_POINTS) return;
    form[kind] = [...form[kind], ''];
  };

  const removePoint = (kind: PointKind, index: number) => {
    const next = form[kind].filter((_, i) => i !== index);
    form[kind] = next.length ? next : [''];
  };

  const movePoint = (kind: PointKind, index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= form[kind].length) return;
    const next = [...form[kind]];
    [next[index], next[target]] = [next[target], next[index]];
    form[kind] = next;
  };

  const cleanPoints = (points: string[]) => points.map((point) => point.trim()).filter(Boolean);

  const payload = () => ({
    name: form.name.trim(),
    start_month: Number(form.start_month),
    end_month: Number(form.end_month),
    description: form.description.trim() || null,
    icon: form.icon,
    tone: form.tone,
    advantages: cleanPoints(form.advantages),
    disadvantages: cleanPoints(form.disadvantages),
    best_for: form.best_for.trim() || null,
    status: form.status,
    sort_order: Number(form.sort_order) || 0
  });

  const saveSeason = async () => {
    if (saving) return;
    attemptedSave = true;
    if (nameError) {
      failOn('basics', nameError);
      return;
    }
    if (pointsError) {
      failOn('considerations', pointsError);
      return;
    }
    saving = true;
    try {
      if (editingSeason?.id) {
        await api.seasons.update(editingSeason.id, payload());
        showToast('Season updated successfully.');
      } else {
        await api.seasons.create(payload());
        showToast('Season created successfully.');
      }
      closeModal();
      await loadSeasons();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to save season.', 'error');
    } finally {
      saving = false;
    }
  };

  const openDeleteConfirm = (season: Season) => {
    seasonToDelete = season;
    confirmOpen = true;
  };

  const deleteSeason = async () => {
    if (!seasonToDelete?.id) return;
    deleting = true;
    try {
      await api.seasons.remove(seasonToDelete.id);
      showToast('Season deleted successfully.');
      confirmOpen = false;
      seasonToDelete = null;
      await loadSeasons();
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Unable to delete season.', 'error');
    } finally {
      deleting = false;
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  };

  onMount(loadSeasons);
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
<AdminPageHeader
  eyebrow="Website & content"
  title="Seasons"
  description="The homepage “When should you go?” section: the month strip and the season cards are both painted from these seasons."
  actionLabel="New Season"
  actionIcon={Plus}
  on:action={openCreateModal}
/>

<AdminToolbar className="grid gap-3 md:grid-cols-[1fr_190px_auto] md:items-end">
  <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
    <span>Search</span>
    <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
      <Search size={16} class="text-ink/45" />
      <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Search seasons..." onkeydown={(event) => event.key === 'Enter' && loadSeasons()} />
    </span>
  </CmsLabel>

  <AdminSelect label="Status" name="status_filter" bind:value={status} options={[{ label: 'All statuses', value: 'all' }, ...statusOptions]} />

  <AdminButton variant="secondary" on:click={loadSeasons}>Apply</AdminButton>
</AdminToolbar>

{#if loading}
  <LoadingState message="Loading seasons..." />
{:else if error}
  <ErrorState message={error} />
{:else if rows.length === 0}
  <AdminEmptyState
    title="No seasons yet"
    message="Add the seasons travellers choose between. Each one paints its months on the homepage strip and gets its own card."
    actionLabel="Create season"
    on:action={openCreateModal}
  />
{:else}
  <!-- What the homepage strip shows right now, so gaps and overlaps are obvious. -->
  <section class="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Year at a glance · published seasons</p>
      {#if gaps.length}
        <span class="text-xs font-semibold text-clay">No season covers {gaps.join(', ')}</span>
      {:else if overlaps.length}
        <span class="text-xs font-semibold text-clay">{overlaps.join(', ')} {overlaps.length === 1 ? 'is' : 'are'} in more than one season — the first by sort order wins</span>
      {:else}
        <span class="text-xs text-ink/50">Every month is covered once</span>
      {/if}
    </div>
    <ol aria-label="Seasons by month" class="mt-3 grid grid-cols-6 overflow-hidden rounded-xl md:grid-cols-12">
      {#each strip as month}
        <li title={month.season?.name ?? 'No season'} class={`border-r border-white py-2.5 text-center text-[10px] font-semibold tracking-wider ${month.season ? seasonTone(month.season.tone).strip : UNASSIGNED_MONTH}`}>{month.label}</li>
      {/each}
    </ol>
  </section>

  <div class="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm">
    <div class="overflow-x-auto">
      <CmsTable.Root class="w-full min-w-[860px] text-start text-sm">
        <CmsTable.Header class="bg-sand/70 text-xs uppercase tracking-[0.08em] text-ink/60">
          <CmsTable.Row>
            <CmsTable.Head class="px-4 py-3 font-semibold">Season</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Months</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Status</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Sort</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-semibold">Updated</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 text-right font-semibold">Actions</CmsTable.Head>
          </CmsTable.Row>
        </CmsTable.Header>
        <CmsTable.Body class="divide-y divide-ink/10">
          {#each rows as season (season.id)}
            {@const tone = seasonTone(season.tone)}
            <CmsTable.Row class="transition hover:bg-sand/25">
              <CmsTable.Cell class="px-4 py-4">
                <div class="flex items-center gap-3">
                  <span class={`grid size-9 shrink-0 place-items-center rounded-full ${tone.card}`}><svelte:component this={seasonIcon(season.icon)} size={17} class={tone.icon} /></span>
                  <div class="min-w-0">
                    <div class="font-semibold text-ink">{season.name}</div>
                    <p class="mt-1 line-clamp-1 text-xs text-ink/55">{season.best_for || season.description || 'No description yet.'}</p>
                  </div>
                </div>
              </CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4 text-ink/65">{monthRange(season)}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4"><StatusBadge status={season.status} /></CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4 text-ink/65">{season.sort_order ?? 0}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4 text-ink/65">{formatDate(season.updated_at ?? season.created_at)}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-4">
                <div class="flex justify-end gap-2">
                  <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-ink/10 bg-surface px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70" type="button" onclick={() => openEditModal(season)}>
                    <Edit size={14} />
                    Edit
                  </CmsButton>
                  <CmsButton variant="ghost" class="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="button" onclick={() => openDeleteConfirm(season)}>
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
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog cms-category-dialog gap-0 p-0 overflow-hidden" style="width:min(calc(100vw - 2rem),72rem);max-width:none">
      <CmsDialog.Title class="sr-only">{editingSeason ? editingSeason.name : 'Create season'}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <form class="cms-editor-form" novalidate on:submit|preventDefault={saveSeason}>
        <header class="cms-editor-header"><div class="flex items-center gap-3"><span class="cms-editor-emblem"><CloudSun size={20}/></span><div><p>SEASON EDITOR</p><h2>{editingSeason ? editingSeason.name : 'Create a season'}</h2></div></div><div class="flex items-center gap-4"><StatusBadge status={form.status}/><CmsButton variant="ghost" size="icon" aria-label="Close season editor" onclick={closeModal}><X size={19}/></CmsButton></div></header>
        <div class="cms-editor-workspace">
          <EditorNavigation sections={TABS} active={activeTab} errors={tabError} onNavigate={(key) => selectTab(key as TabKey)}/>
          <div class="cms-editor-canvas" bind:this={bodyEl}>
            <div class="cms-editor-section-heading"><p>STEP {String(stepIndex + 1).padStart(2, '0')} / {String(TABS.length).padStart(2, '0')}</p><h3>{TABS[stepIndex]?.[2]}</h3><span>{STEP_HINTS[activeTab]}</span></div>

        <!-- ── Essentials ────────────────────────────────────────────────── -->
        <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'basics'}>
        <section class="cms-form-section grid gap-5">
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Season details</p>

          <div class="grid gap-1.5">
            <AdminFormInput label="Season name" name="name" required bind:value={form.name} placeholder="Green Season" counter={60} />
            {#if attemptedSave && nameError}
              <span class="text-[11px] font-semibold text-clay">{nameError}</span>
            {:else}
              <span class="text-[11px] text-ink/40">Shown in capitals on the card, e.g. GREEN SEASON.</span>
            {/if}
          </div>

          <div class="grid gap-1.5">
            <div class="grid gap-4 md:grid-cols-2">
              <AdminSelect label="Starts in" name="start_month" bind:value={form.start_month} options={monthOptions} />
              <AdminSelect label="Ends in" name="end_month" bind:value={form.end_month} options={monthOptions} />
            </div>
            <span class="text-[11px] text-ink/40">Shows as “{monthRange(preview)}”. A season can run over the new year, e.g. November – February.</span>
          </div>

          <AdminTextArea
            label="Description"
            name="description"
            bind:value={form.description}
            rows={3}
            counter={300}
            placeholder="What travelling in this season feels like — weather, landscapes, crowds."
          />

          <AdminFormInput
            label="Best for · the starred line at the bottom of the card"
            name="best_for"
            bind:value={form.best_for}
            counter={90}
            placeholder="Green landscapes, photography and fewer crowds"
          />
        </section>

        <section class="cms-form-section grid gap-5">
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Publishing</p>
          <div class="grid gap-4 md:grid-cols-2">
            <AdminSelect label="Status" name="status" bind:value={form.status} options={statusOptions} />
            <AdminFormInput label="Sort order" name="sort_order" type="number" min={0} bind:value={form.sort_order} />
          </div>
          <p class="-mt-2 text-xs text-ink/45">Only published seasons appear on the homepage. Sort order sets the card order — lower first — and decides which season wins a month two seasons share.</p>
        </section>
        </div>

        <!-- ── Icon & colour ─────────────────────────────────────────────── -->
        <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'look'}>
        <section class="cms-form-section grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div class="grid content-start gap-6">
            <div class="grid gap-2">
              <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Icon</p>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Season icon">
                {#each SEASON_ICONS as item (item.key)}
                  {@const selected = form.icon === item.key}
                  <CmsButton
                    variant="ghost"
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    class={`flex h-auto flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[11px] font-semibold transition ${selected ? 'border-deep-green bg-deep-green/5 text-heading ring-2 ring-deep-green/20' : 'border-ink/12 bg-surface text-ink/60 hover:border-forest/40 hover:text-heading'}`}
                    onclick={() => (form.icon = item.key)}
                  >
                    <span class={`grid size-9 place-items-center rounded-full ${seasonTone(form.tone).card}`}><svelte:component this={item.icon} size={18} class={seasonTone(form.tone).icon} /></span>
                    {item.label}
                  </CmsButton>
                {/each}
              </div>
            </div>

            <div class="grid gap-2">
              <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Colour</p>
              <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Season colour">
                {#each SEASON_TONES as tone (tone.key)}
                  {@const selected = form.tone === tone.key}
                  <CmsButton
                    variant="ghost"
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    class={`inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition ${selected ? 'border-deep-green text-heading ring-2 ring-deep-green/20' : 'border-ink/12 bg-surface text-ink/60 hover:border-forest/40 hover:text-heading'} ${tone.card}`}
                    onclick={() => (form.tone = tone.key)}
                  >
                    <span class={`size-4 rounded-full ${tone.swatch}`}></span>
                    {tone.label}
                  </CmsButton>
                {/each}
              </div>
              <p class="text-xs text-ink/45">The colour tints the card and the season’s months on the homepage strip.</p>
            </div>

            <div class="grid gap-2">
              <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">This season on the month strip</p>
              <ol aria-label="Months in this season" class="grid grid-cols-6 overflow-hidden rounded-xl md:grid-cols-12">
                {#each MONTH_SHORT as label, index}
                  <li class={`border-r border-white py-2.5 text-center text-[10px] font-semibold tracking-wider ${coversMonth(preview, index + 1) ? seasonTone(form.tone).strip : UNASSIGNED_MONTH}`}>{label}</li>
                {/each}
              </ol>
            </div>
          </div>

          <div class="grid content-start gap-2">
            <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Live preview</p>
            <div class="flex"><SeasonCard season={preview} /></div>
            <p class="text-xs text-ink/45">Exactly how the card renders on the homepage. Open “Travel considerations” to check the lists.</p>
          </div>
        </section>
        </div>

        <!-- ── Travel considerations ─────────────────────────────────────── -->
        <div class="grid gap-5 cms-form-panel" class:hidden={activeTab !== 'considerations'}>
        {#each [{ kind: 'advantages', title: 'Advantages', icon: ThumbsUp, badge: 'bg-[#4F8A5B]', example: 'Fewer crowds' }, { kind: 'disadvantages', title: 'Disadvantages', icon: ThumbsDown, badge: 'bg-[#DC4B4B]', example: 'Some roads can be challenging' }] as group (group.kind)}
          {@const kind = group.kind as PointKind}
          <section class="cms-form-section grid gap-4">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <span class={`grid size-7 place-items-center rounded-full text-white ${group.badge}`}><svelte:component this={group.icon} size={14} /></span>
                <div>
                  <p class="text-sm font-semibold text-ink">{group.title}</p>
                  <p class="text-xs text-ink/45">One short point per line · up to {MAX_POINTS} · empty lines are ignored.</p>
                </div>
              </div>
              <CmsButton variant="ghost"
                class="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink/10 bg-surface px-3 text-xs font-bold text-ink transition hover:border-forest/25 hover:bg-sand/55 disabled:opacity-40"
                type="button"
                disabled={form[kind].length >= MAX_POINTS}
                onclick={() => addPoint(kind)}
              >
                <Plus size={14} /> Add
              </CmsButton>
            </div>

            <div class="grid gap-2">
              {#each form[kind] as _point, index}
                <div class="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                  <CmsInput
                    class={`h-11 rounded-md border bg-black/[0.02] px-3.5 text-sm text-ink outline-none transition hover:border-ink/25 focus:border-forest focus:bg-surface focus:ring-2 focus:ring-forest/20 ${form[kind][index].trim().length > POINT_MAX ? 'border-destructive' : 'border-ink/15'}`}
                    name={`${kind}_${index}`}
                    aria-label={`${group.title} ${index + 1}`}
                    placeholder={index === 0 ? `e.g. ${group.example}` : ''}
                    bind:value={form[kind][index]}
                  />
                  <div class="flex gap-1.5">
                    <CmsButton variant="ghost" class="grid h-10 w-9 place-items-center rounded-md border border-ink/10 bg-surface text-ink/60 transition hover:text-heading disabled:opacity-30" type="button" aria-label={`Move ${group.title.toLowerCase()} ${index + 1} up`} disabled={index === 0} onclick={() => movePoint(kind, index, -1)}>
                      <ArrowUp size={14} />
                    </CmsButton>
                    <CmsButton variant="ghost" class="grid h-10 w-9 place-items-center rounded-md border border-ink/10 bg-surface text-ink/60 transition hover:text-heading disabled:opacity-30" type="button" aria-label={`Move ${group.title.toLowerCase()} ${index + 1} down`} disabled={index === form[kind].length - 1} onclick={() => movePoint(kind, index, 1)}>
                      <ArrowDown size={14} />
                    </CmsButton>
                    <CmsButton variant="ghost" class="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-red-200 bg-surface px-3 text-xs font-bold text-red-700 transition hover:bg-red-50" type="button" aria-label={`Remove ${group.title.toLowerCase()} ${index + 1}`} onclick={() => removePoint(kind, index)}>
                      <Trash2 size={14} />
                    </CmsButton>
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {/each}
        {#if attemptedSave && pointsError}
          <p class="text-xs font-semibold text-clay">{pointsError}</p>
        {/if}
        </div>

          </div>
        </div>
        <footer class="cms-editor-footer">
          <span class="cms-save-note">{form.status === 'draft' ? 'Draft · Not visible on your website' : form.status === 'published' ? 'Changes will be visible on your website' : 'Archived · Hidden from your website'}</span>
          <div class="cms-editor-footer-actions">
            {#if stepIndex > 0}<CmsButton variant="ghost" class="cms-editor-back" aria-label="Previous section" onclick={() => selectTab(TABS[stepIndex - 1][0])}><ArrowLeft size={14}/><span>Back</span></CmsButton>{/if}
            {#if stepIndex < TABS.length - 1}<CmsButton variant="outline" onclick={() => selectTab(TABS[stepIndex + 1][0])}>Continue<ArrowRight size={14}/></CmsButton>{/if}
            <CmsButton variant="default" type="submit" disabled={saving} class="gap-2 px-5"><Save size={14}/>{saving ? 'Saving…' : form.status === 'draft' ? 'Save draft' : editingSeason ? 'Save changes' : 'Create season'}</CmsButton>
          </div>
        </footer>
      </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}

<ConfirmModal
  open={confirmOpen}
  title="Delete season"
  message={`Delete "${seasonToDelete?.name ?? 'this season'}"? It disappears from the homepage straight away.`}
  on:cancel={() => {
    confirmOpen = false;
    seasonToDelete = null;
  }}
  on:confirm={deleteSeason}
/>

{#if deleting}
  <div class="fixed bottom-4 right-4 z-[70] rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-sm">
    Deleting season...
  </div>
{/if}
