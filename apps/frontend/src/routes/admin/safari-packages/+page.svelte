<script lang="ts">
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsSelect from '$lib/components/ui/native-select';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import * as CmsTable from '$lib/components/ui/table';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  import { cdnUrl } from '$lib/admin/img';
  /**
   * Safari packages — compose a landing page from blocks.
   *
   * Two rules this screen exists to keep:
   *
   *  1. The edit form is ALWAYS built from the full record fetched by slug,
   *     never from the row in the list. The list projection has no `sections`,
   *     and a form seeded from it would save the page back with its content
   *     erased. If that fetch fails the form does not open.
   *
   *  2. A page is not indexable until somebody says so, and the differentiation
   *     guard tells them what the page is still missing. It warns; it never
   *     blocks.
   */
  import { onMount, tick } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import { AlertTriangle, CheckCircle2, ArrowLeft, Eye, ExternalLink, Pencil, FileText, Languages, LayoutTemplate, Loader2, Plus, Save, Search } from '@lucide/svelte';
  import AdminFormInput from '$lib/admin/components/admin/AdminFormInput.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminTextArea from '$lib/admin/components/admin/AdminTextArea.svelte';
  import AdminTranslationTabs from '$lib/admin/components/admin/AdminTranslationTabs.svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import SafariPackagePreview from '$lib/admin/components/admin/SafariPackagePreview.svelte';
  import { orderedPackageBlocks, starterPackageBlocks } from '$lib/admin/packagePresentation';
  import SafariPackageBlocksEditor from '$lib/admin/components/admin/SafariPackageBlocksEditor.svelte';
  import { api } from '$lib/admin/api/client';
  import { assessPackageDifferentiation, type Assessment } from '$lib/admin/packageDifferentiation';
  import { blocksForEditing, blocksForSaving, type Block } from '$lib/admin/safariPackageBlocks';
  import type { SafariPackage, Tour } from '$lib/admin/types';

  type Row = SafariPackage;

  let rows: Row[] = [];
  let tours: Tour[] = [];
  let loading = true;
  let listError = '';
  let searchQuery = '';
  let statusFilter = 'all';
  $: filteredRows = rows.filter((row) => (statusFilter === 'all' || row.status === statusFilter) && `${row.name} ${row.slug}`.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  $: publishedCount = rows.filter((row) => row.status === 'published').length;
  $: draftCount = rows.filter((row) => row.status === 'draft').length;

  let open = false;
  let editingId: string | null = null;
  let opening = false;
  let saving = false;
  let formError = '';
  let toast = '';

  const blank = () => ({
    name: '',
    slug: '',
    tour_id: '',
    hero_eyebrow: '',
    hero_title: '',
    hero_subtitle: '',
    hero_image_url: '',
    status: 'draft',
    indexable: false,
    seo_title: '',
    meta_title: '',
    meta_description: '',
    og_image_url: ''
  });

  type TabKey = 'basics' | 'content' | 'seo' | 'preview' | 'translations';

  /**
   * Three tabs rather than one long column. The blocks editor alone can run to
   * a dozen sections, which put Save far below the fold.
   */
  const TABS = [
    ['basics', FileText, 'Page details'],
    ['content', LayoutTemplate, 'Page content'],
    ['seo', Search, 'Search settings'],
    ['preview', Eye, 'Preview'],
    // Only once the package exists: a translation belongs to a saved record.
    ['translations', Languages, 'Translations']
  ] as const;

  /** The last message from the translation panel, shown above it. */
  let translationNotice: { message: string; type: 'success' | 'error' } | null = null;

  let activeTab: TabKey = 'basics';
  let attemptedSave = false;

  const selectTab = (tab: TabKey) => {
    // The translation panel only exists on its tab: leaving it drops typed text.
    if (activeTab === 'translations' && tab !== 'translations' && translationUnsaved && !confirm('Discard your unsaved translation changes?')) return;
    activeTab = tab;
    if (typeof document !== 'undefined') document.querySelector('.package-workspace-content')?.scrollTo({ top: 0 });
  };

  let form = blank();
  let blocks: Block[] = [];
  let baseline = '';
  $: currentDraft = JSON.stringify({ form, blocks });
  $: dirty = open && baseline !== currentDraft;
  const rememberDraft = () => { baseline = JSON.stringify({ form, blocks }); };
  // The translation panel's own edits are tracked there; leaving must not drop them silently either.
  let translationPanel: AdminTranslationTabs | null = null;
  let translationUnsaved = false;
  let savingTranslation = false;
  const canLeave = () =>
    (!dirty || confirm('Discard your unsaved changes to this package?')) &&
    (!translationUnsaved || confirm('Discard your unsaved translation changes?'));

  /**
   * The footer's Save on the Translations tab saves the translation. It used to
   * save the English and close the editor, so edits typed into a language were
   * dropped — the panel's own buttons sat below every field on the page.
   */
  const saveTranslation = async () => {
    if (!translationPanel || savingTranslation) return;
    savingTranslation = true;
    try {
      await translationPanel.saveCurrent();
    } finally {
      savingTranslation = false;
    }
  };
  $: onTranslations = activeTab === 'translations' && Boolean(editingId);
  const closeEditor = () => { if (canLeave()) open = false; };
  const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
  beforeNavigate(({ cancel }) => { if (!canLeave()) cancel(); });
  /**
   * How many published days the linked tour has.
   *
   * Taken from the full record, or fetched when the editor picks a different
   * tour. It cannot come from the tour dropdown: that list is a projection and
   * carries no itinerary_days, so reading it there reported every page as
   * having no itinerary and the guard marked a complete page incomplete.
   */
  let linkedDayCount = 0;
  /** Cleared whenever the warning changes, so a stale tick cannot carry over. */
  let acknowledged = '';

  const loadList = async () => {
    loading = true;
    listError = '';
    try {
      // `status: 'all'` on purpose. The list helper defaults to published, and
      // every new page starts as a draft — without this an editor could not see,
      // let alone open, the page they had just created.
      const res = await api.safariPackages.list({ status: 'all', limit: 200 });
      rows = res.data.items ?? [];
    } catch (error) {
      listError = error instanceof Error ? error.message : 'Could not load safari packages.';
    } finally {
      loading = false;
    }
  };

  onMount(async () => {
    await loadList();
    try {
      const res = await api.tours.list({ status: 'published', limit: 200 });
      tours = (res.data.items ?? []) as Tour[];
    } catch {
      // The tour picker simply offers nothing; the page still saves.
    }
  });

  const startCreate = async () => {
    if (!canLeave()) return;
    activeTab = 'basics';
    attemptedSave = false;
    editingId = null;
    form = blank();
    blocks = starterPackageBlocks();
    linkedDayCount = 0;
    formError = '';
    acknowledged = '';
    open = true;
    await tick();
    rememberDraft();
  };

  const startEdit = async (row: Row) => {
    if (opening || !canLeave()) return;
    opening = true;
    formError = '';
    try {
      // The FULL record. Never `row` — see the note at the top of this file.
      const res = await api.safariPackages.get(row.slug);
      const full = res.data;
      if (!full?.id) throw new Error('That package could not be loaded.');

      editingId = full.id;
      form = {
        name: full.name ?? '',
        slug: full.slug ?? '',
        tour_id: full.tour_id ?? '',
        hero_eyebrow: full.hero_eyebrow ?? '',
        hero_title: full.hero_title ?? '',
        hero_subtitle: full.hero_subtitle ?? '',
        hero_image_url: full.hero_image_url ?? '',
        status: full.status ?? 'draft',
        indexable: full.indexable === true,
        seo_title: full.seo_title ?? '',
        meta_title: full.meta_title ?? '',
        meta_description: full.meta_description ?? '',
        og_image_url: full.og_image_url ?? ''
      };
      blocks = orderedPackageBlocks(blocksForEditing(full.sections));
      activeTab = 'basics';
      attemptedSave = false;
      linkedDayCount = (full.tours?.itinerary_days ?? []).length;
      acknowledged = '';
      open = true;
      await tick();
      rememberDraft();
    } catch (error) {
      // Refusing to open is the point: an empty form here saves an empty page.
      toast = error instanceof Error ? error.message : 'Could not open that package.';
    } finally {
      opening = false;
    }
  };

  /** Re-read the day count whenever the chosen tour changes. */
  const onTourChange = async () => {
    const tour = tours.find((item) => item.id === form.tour_id);
    if (!tour?.slug) {
      linkedDayCount = 0;
      return;
    }
    try {
      const res = await api.tours.get(tour.slug);
      linkedDayCount = ((res.data as { itinerary_days?: unknown[] })?.itinerary_days ?? []).length;
    } catch {
      linkedDayCount = 0;
    }
  };

  /**
   * Assessed against the draft in front of the editor, and only against pages
   * that are already published AND indexable — a draft is not competition.
   */
  $: rivals = rows
    .filter((row) => row.id !== editingId && row.status === 'published' && row.indexable === true)
    .map((row) => ({ slug: row.slug, name: row.name, sections: row.sections, hero_title: row.hero_title, hero_subtitle: row.hero_subtitle, meta_description: row.meta_description }));

  $: assessment = open
    ? assessPackageDifferentiation(
        {
          slug: form.slug || 'new-page',
          name: form.name,
          hero_eyebrow: form.hero_eyebrow,
          hero_title: form.hero_title,
          hero_subtitle: form.hero_subtitle,
          meta_title: form.meta_title,
          meta_description: form.meta_description,
          sections: blocksForSaving(blocks),
          itinerary_day_count: linkedDayCount
        },
        rivals
      )
    : (null as Assessment | null);

  /** A tick is tied to the exact warning it answered. */
  $: warningKey = assessment ? `${assessment.verdict}|${assessment.gaps.join('|')}` : '';
  $: needsAck = form.indexable && assessment?.requiresAcknowledgement === true && acknowledged !== warningKey;

  const save = async () => {
    if (saving) return;
    formError = '';
    attemptedSave = true;
    // Both guards live on tabs the editor may not be looking at, so each one
    // switches to the tab that owns it rather than only setting a message.
    if (form.name.trim().length < 2) {
      selectTab('basics');
      formError = 'Give the page a name.';
      return;
    }
    if (needsAck) {
      selectTab('seo');
      formError = 'This page reads as a near-duplicate. Tick the box to publish it anyway, or give it something of its own.';
      return;
    }

    saving = true;
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        tour_id: form.tour_id || null,
        hero_eyebrow: form.hero_eyebrow || null,
        hero_title: form.hero_title || null,
        hero_subtitle: form.hero_subtitle || null,
        hero_image_url: form.hero_image_url || null,
        sections: blocksForSaving(blocks),
        status: form.status,
        // A real boolean, always sent. Leaving it out would let the column keep
        // a value the editor has just turned off.
        indexable: form.indexable === true,
        meta_title: form.meta_title || null,
        seo_title: form.seo_title || null,
        meta_description: form.meta_description || null,
        og_image_url: form.og_image_url || null
      };
      if (form.slug.trim()) payload.slug = form.slug.trim();

      if (editingId) await api.safariPackages.update(editingId, payload);
      else await api.safariPackages.create(payload);

      toast = editingId ? 'Package saved.' : 'Package created.';
      open = false;
      await loadList();
    } catch (error) {
      formError = error instanceof Error ? error.message : 'Could not save this package.';
    } finally {
      saving = false;
    }
  };

  const remove = async (row: Row) => {
    if (!confirm(`Delete “${row.name}”? The page stops resolving immediately.`)) return;
    try {
      await api.safariPackages.remove(row.id);
      toast = 'Package deleted.';
      await loadList();
    } catch (error) {
      toast = error instanceof Error ? error.message : 'Could not delete that package.';
    }
  };

  const containFocus = (node: HTMLElement) => {
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(node.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, iframe, [tabindex]'))
      .filter((element) => element.tabIndex >= 0 && !element.hasAttribute('disabled') && element.getClientRects().length > 0);
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    node.addEventListener('keydown', trap);
    queueMicrotask(() => focusable()[0]?.focus());
    return { destroy() { node.removeEventListener('keydown', trap); if (previous?.isConnected) previous.focus(); } };
  };

  const VERDICT_STYLE: Record<string, string> = {
    strong: 'border-forest/30 bg-forest/[0.07] text-forest',
    moderate: 'border-goldfinch-gold/40 bg-goldfinch-gold/10 text-heading',
    weak: 'border-clay/30 bg-clay/[0.07] text-clay'
  };
</script>

<svelte:window on:beforeunload={beforeUnload} />

{#if !open}
  <AdminPageHeader title="Safari packages" description="Thoughtfully presented trips. One consistent design, with all your safari content in one place." />
  {#if toast}<p class="package-message" role="status">{toast}</p>{/if}
  <div class="package-list-summary">
    <div><span>ALL PACKAGES</span><strong>{rows.length}</strong><p>Safari landing pages</p></div>
    <div><span>PUBLISHED</span><strong>{publishedCount}</strong><p>Available on your website</p></div>
    <div><span>DRAFTS</span><strong>{draftCount}</strong><p>Ready for your next edit</p></div>
  </div>
  <section class="package-library" aria-label="Safari package library">
    <div class="package-library-toolbar">
      <CmsLabel class="package-search"><Search size={17} /><span class="sr-only">Search safari packages</span><CmsInput type="search" bind:value={searchQuery} placeholder="Search by package name…" /></CmsLabel>
      <CmsLabel class="package-filter"><span class="sr-only">Filter by status</span><CmsSelect.Root bind:value={statusFilter}><CmsSelect.Option value="all">All statuses</CmsSelect.Option><CmsSelect.Option value="published">Published</CmsSelect.Option><CmsSelect.Option value="draft">Drafts</CmsSelect.Option><CmsSelect.Option value="archived">Archived</CmsSelect.Option></CmsSelect.Root></CmsLabel>
      <CmsButton variant="ghost" type="button" class="package-primary" onclick={startCreate}><Plus size={16} /> New package</CmsButton>
    </div>
    {#if loading}
      <p class="package-list-empty" role="status">Loading your safari packages…</p>
    {:else if listError}
      <div class="package-list-empty" role="alert"><p>{listError}</p><CmsButton variant="ghost" type="button" class="mt-4 underline" onclick={loadList}>Try again</CmsButton></div>
    {:else if !filteredRows.length}
      <div class="package-list-empty"><LayoutTemplate size={28} /><h2>{rows.length ? 'No matching packages' : 'Your next safari starts here'}</h2><p>{rows.length ? 'Try a different name or status.' : 'Create a package, choose its tours and add your story. The page layout is already taken care of.'}</p></div>
    {:else}
      <div class="package-table-scroll">
        <CmsTable.Root class="package-library-table">
          <CmsTable.Header><CmsTable.Row><CmsTable.Head>Package</CmsTable.Head><CmsTable.Head>Visibility</CmsTable.Head><CmsTable.Head>Content</CmsTable.Head><CmsTable.Head><span class="sr-only">Actions</span></CmsTable.Head></CmsTable.Row></CmsTable.Header>
          <CmsTable.Body>
            {#each filteredRows as row (row.id)}
              <CmsTable.Row>
                <CmsTable.Cell><div class="package-row-title">
                  {#if row.hero_image_url}<img src={cdnUrl(row.hero_image_url)} alt="" loading="lazy" />{:else}<span class="package-thumbnail"><LayoutTemplate size={22} /></span>{/if}
                  <div><strong>{row.name}</strong><span>/{row.slug}</span></div>
                </div></CmsTable.Cell>
                <CmsTable.Cell><span class="package-status" class:published={row.status === 'published'} class:draft={row.status === 'draft'}>{row.status || 'Draft'}</span><span class="package-seo">{row.indexable === true ? 'Search indexing on' : 'Search indexing off'}</span></CmsTable.Cell>
                <CmsTable.Cell><span class="package-section-count">{(row.sections ?? []).length} sections</span></CmsTable.Cell>
                <CmsTable.Cell><div class="package-row-actions">
                  <CmsButton variant="ghost" type="button" class="package-edit" disabled={opening} onclick={() => startEdit(row)}><Pencil size={14} /> Edit</CmsButton>
                  <a href={`/${row.slug}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${row.name}`}><ExternalLink size={16} /></a>
                  <details class="package-more"><summary aria-label={`More actions for ${row.name}`}>•••</summary><div><CmsButton variant="ghost" type="button" onclick={() => remove(row)}>Delete package</CmsButton></div></details>
                </div></CmsTable.Cell>
              </CmsTable.Row>
            {/each}
          </CmsTable.Body>
        </CmsTable.Root>
      </div>
      <p class="package-library-footer">{filteredRows.length} of {rows.length} packages · Every page uses the same protected layout.</p>
    {/if}
  </section>
{/if}

{#if open}
  <div class="package-workspace" role="dialog" aria-modal="true" aria-label="Safari package editor" tabindex="-1" use:containFocus>
    <header class="package-workspace-header">
      <CmsButton variant="ghost" type="button" class="workspace-back" onclick={closeEditor}><ArrowLeft size={18} /><span>All packages</span></CmsButton>
      <div class="workspace-heading"><span>{editingId ? 'EDIT SAFARI PACKAGE' : 'NEW SAFARI PACKAGE'}</span><h2>{form.name || 'Create your safari page'}</h2></div>
      <span class="package-status" class:published={form.status === 'published'} class:draft={form.status === 'draft'}>{form.status}</span>
    </header>
    <div class="package-workspace-content">
    <div class="workspace-tabs" aria-label="Package editing steps">
      {#each TABS.filter(([tab]) => tab !== 'translations' || editingId) as [tab, Icon, label], step (tab)}
        <CmsButton variant="ghost"
          class={`flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/20 ${
            activeTab === tab ? 'bg-forest text-white shadow-sm' : 'text-ink/55 hover:bg-sand/50 hover:text-ink'
          }`}
          type="button"
          aria-current={activeTab === tab}
          onclick={() => selectTab(tab)}
        >
          <span class="workspace-step">{step + 1}</span><Icon size={15} />
          {label}
          {#if tab === 'basics' && attemptedSave && form.name.trim().length < 2}
            <span class="h-1.5 w-1.5 rounded-full bg-clay" title="Something here is blocking the save"></span>
          {/if}
        </CmsButton>
      {/each}
    </div>

    <!--
      Panels are CSS-hidden, never {#if}-unmounted: the blocks editor holds the
      media pickers and rich-text fields for every section, and tearing those
      down on a tab click would be both slow and a good way to lose an edit.
    -->
    <div class="mt-6 grid gap-6 md:grid-cols-2" class:hidden={activeTab !== 'basics'}>
    <div class="grid gap-4 md:col-span-2 md:grid-cols-2">
      <div class="grid gap-1.5">
        <AdminFormInput label="Name" name="name" bind:value={form.name} placeholder="2-Day Safari from Zanzibar" />
        {#if attemptedSave && form.name.trim().length < 2}
          <span class="text-[11px] font-semibold text-clay">Give the page a name — at least 2 characters.</span>
        {/if}
      </div>
      <AdminFormInput label="Slug" name="slug" bind:value={form.slug} placeholder="Left blank, made from the name" />
      <AdminFormInput label="Small label above the title" name="hero_eyebrow" counter={40} bind:value={form.hero_eyebrow} />
      <AdminFormInput label="Page headline" name="hero_title" counter={100} bind:value={form.hero_title} />
    </div>

    <p class="text-xs leading-5 text-ink/55 md:col-span-2">Use a short, descriptive headline and two or three sentences. The page handles line breaks, image cropping and spacing on every screen.</p>
    <AdminTextArea label="Short introduction" name="hero_subtitle" counter={320} rows={3} bind:value={form.hero_subtitle} />
    <MediaPicker label="Cover photograph" bind:value={form.hero_image_url} on:change={(event) => (form.hero_image_url = event.detail ?? '')} />

    <div class="grid gap-4 md:col-span-2 md:grid-cols-2">
      <AdminSelect
        label="Linked tour"
        name="tour_id"
        bind:value={form.tour_id}
        on:change={onTourChange}
        options={[{ label: 'No tour linked', value: '' }, ...tours.map((tour) => ({ label: tour.title, value: tour.id }))]}
      />
      <AdminSelect
        label="Status"
        name="status"
        bind:value={form.status}
        options={[
          { label: 'Draft', value: 'draft' },
          { label: 'Published', value: 'published' },
          { label: 'Archived', value: 'archived' }
        ]}
      />
    </div>
    <p class="-mt-2 text-[12px] text-ink/55 md:col-span-2">
      Optional: select a tour for a standalone itinerary section. Route options have their own tours, selected under Page content.
    </p>
    </div>

    <!-- ── Page content ───────────────────────────────────────────────── -->
    <div class="mt-6" class:hidden={activeTab !== 'content'}>
      {#key editingId ?? 'new'}<SafariPackageBlocksEditor bind:blocks />{/key}
    </div>

    {#if activeTab === 'preview'}
      <div class="mt-6"><SafariPackagePreview record={{ ...form, id: editingId ?? '' }} {blocks} availableTours={tours} /></div>
    {/if}

    <!-- ── Translations ───────────────────────────────────────────────── -->
    {#if activeTab === 'translations' && editingId}
      <div class="mt-6 grid gap-4">
        <p class="text-[13px] leading-6 text-ink/60">
          Every piece of text on this page, section by section — the English on the left, the translation on the right. Prices,
          photos, icons and linked tours are shared by every language and are not listed. A section keeps its translation when you
          move it; delete a section and its translation goes with it.
        </p>
        {#if dirty}
          <!-- The panel reads the saved page. Text typed since is not in it yet. -->
          <p class="flex items-start gap-2 rounded-xl border border-goldfinch-gold/40 bg-goldfinch-gold/10 px-3 py-2.5 text-[13px] text-heading">
            <AlertTriangle size={15} class="mt-0.5 shrink-0 text-goldfinch-gold" />
            You have unsaved changes. Translations work from the saved page — save first, then reopen this package to translate the new text.
          </p>
        {/if}
        {#if translationNotice}
          <p
            class="rounded-xl px-3 py-2.5 text-[13px] font-semibold {translationNotice.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}"
            role="status"
          >{translationNotice.message}</p>
        {/if}
        <AdminTranslationTabs
          bind:this={translationPanel}
          bind:unsaved={translationUnsaved}
          entityType="safari_packages"
          entityId={editingId}
          on:toast={(event) => (translationNotice = { message: event.detail.message, type: event.detail.type ?? 'success' })}
        />
      </div>
    {/if}

    <!-- ── SEO & indexing ─────────────────────────────────────────────── -->
    <div class="mt-6 grid gap-6" class:hidden={activeTab !== 'seo'}>
    <div class="grid gap-4 rounded-[12px] border border-ink/12 bg-surface p-4">
      <p class="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/55">Search result</p>
      <div class="grid gap-4 md:grid-cols-2">
        <AdminFormInput label="Meta title" name="meta_title" bind:value={form.meta_title} counter={60} placeholder="Falls back to the SEO title, then the page name." />
        <AdminFormInput label="SEO title" name="seo_title" bind:value={form.seo_title} counter={60} placeholder="Used when there is no meta title." />
      </div>
      <AdminTextArea label="Meta description" name="meta_description" rows={2} counter={160} bind:value={form.meta_description} placeholder="Falls back to the hero subtitle." />
      <MediaPicker
        label="Social / Open Graph image"
        aspect="aspect-[1.91/1]"
        bind:value={form.og_image_url}
        on:change={(event) => (form.og_image_url = event.detail ?? '')}
      />
      <p class="-mt-1 text-[12px] text-ink/55">All optional. Empty fields fall back to the page name, hero subtitle and hero image.</p>
    </div>

    <div class="grid gap-3 rounded-[12px] border border-ink/12 bg-surface p-4">
      <CmsLabel class="flex items-start gap-3">
        <CmsCheckbox  class="mt-1 h-4 w-4 rounded border-ink/30 text-goldfinch-gold focus:ring-goldfinch-gold" bind:checked={form.indexable} />
        <span>
          <span class="block text-sm font-semibold text-heading">Let search engines index this page</span>
          <span class="mt-0.5 block text-[12px] leading-5 text-ink/55">
            Off by default. Turn it on once the page says something the others do not — it controls both the page's robots tag and whether the sitemap offers it.
          </span>
        </span>
      </CmsLabel>

      {#if assessment}
        <div class={`rounded-xl border p-3 ${VERDICT_STYLE[assessment.verdict]}`}>
          <p class="flex items-center gap-2 text-sm font-bold capitalize">
            {#if assessment.verdict === 'strong'}<CheckCircle2 size={15} />{:else}<AlertTriangle size={15} />{/if}
            {assessment.verdict} differentiation
          </p>
          {#if assessment.gaps.length}
            <ul class="mt-2 grid gap-1 text-[12.5px] leading-5">
              {#each assessment.gaps as gap (gap)}<li>• {gap}</li>{/each}
            </ul>
          {/if}
          {#if assessment.strengths.length}
            <details class="mt-2">
              <summary class="cursor-pointer text-[12px] font-semibold opacity-75">What this page does have</summary>
              <ul class="mt-1.5 grid gap-1 text-[12.5px] leading-5 opacity-90">
                {#each assessment.strengths as strength (strength)}<li>• {strength}</li>{/each}
              </ul>
            </details>
          {/if}
        </div>

        {#if form.indexable && assessment.requiresAcknowledgement}
          <CmsLabel class="flex items-start gap-3 rounded-xl border border-clay/30 bg-clay/[0.06] p-3">
            <CmsCheckbox
              
              class="mt-1 h-4 w-4 rounded border-clay/40 text-clay focus:ring-clay"
              checked={acknowledged === warningKey}
              onCheckedChange={(checked) => (acknowledged = checked ? warningKey : '')}
            />
            <span class="text-[12.5px] leading-5 text-clay">
              I have read the above and want this page indexed anyway.
            </span>
          </CmsLabel>
        {/if}
      {/if}
    </div>

    </div>

    {#if formError}
      <p class="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p>
    {/if}

    </div>

    <!-- Save stays reachable however long the page content runs. -->
    <div class="package-workspace-footer">
      {#if onTranslations}
        <p class="text-[12px] {translationUnsaved ? 'font-semibold text-clay' : 'text-ink/55'}">
          {translationUnsaved ? 'Unsaved translation changes' : 'Translation saved'} · Save here saves the language you are editing.
        </p>
      {:else}
        <p class="text-[12px] text-ink/55">{dirty ? 'Unsaved changes' : editingId ? 'All changes saved' : 'New draft'} · {form.status === 'published' ? 'Saving updates the live page.' : 'Visible only after publishing.'}</p>
      {/if}
      <div class="flex flex-wrap gap-3">
        {#if activeTab !== 'preview'}<CmsButton variant="ghost" type="button" class="inline-flex h-11 items-center gap-2 rounded border border-forest/30 px-4 text-sm font-semibold text-forest" onclick={() => selectTab('preview')}><Eye size={15} /> Preview page</CmsButton>{/if}
        <CmsButton variant="ghost" type="button" class="inline-flex h-11 items-center rounded border border-ink/20 px-5 text-sm font-semibold text-heading transition hover:bg-sand/50" onclick={closeEditor}>
          Cancel
        </CmsButton>
        {#if onTranslations}
          <CmsButton variant="ghost" type="button" class="inline-flex h-11 items-center gap-2 rounded bg-goldfinch-gold px-5 text-sm font-bold text-heading transition hover:brightness-105 disabled:opacity-60" disabled={savingTranslation || !translationUnsaved} onclick={saveTranslation}>
            {#if savingTranslation}<Loader2 size={15} class="animate-spin" />{:else}<Save size={15} />{/if}
            Save translation
          </CmsButton>
        {:else}
          <CmsButton variant="ghost" type="button" class="inline-flex h-11 items-center gap-2 rounded bg-goldfinch-gold px-5 text-sm font-bold text-heading transition hover:brightness-105 disabled:opacity-60" disabled={saving} onclick={save}>
            {#if saving}<Loader2 size={15} class="animate-spin" />{:else}<Save size={15} />{/if}
            {editingId ? 'Save changes' : 'Create package'}
          </CmsButton>
        {/if}
      </div>
    </div>
  </div>
{/if}


<style>
:global {
 .key2africa-admin-surface {

  .package-message { margin-block:16px; padding:14px 18px; border:1px solid rgb(var(--c-forest)/.2); border-radius:10px; background:rgb(var(--c-forest)/.04); color:rgb(var(--c-forest)); font-size:14px; }
  .package-list-summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; margin-block:24px; }
  .package-list-summary > div { padding:22px 24px; border:1px solid rgb(var(--c-ink)/.08); border-radius:12px; background:rgb(var(--c-surface)); }
  .package-list-summary span { display:block; font-size:10px; letter-spacing:.12em; font-weight:700; color:rgb(var(--c-ink)/.5); }
  .package-list-summary strong { display:block; margin-top:10px; font-size:30px; font-weight:600; letter-spacing:-.04em; color:rgb(var(--c-heading)); }
  .package-list-summary p { margin-top:3px; font-size:12px; color:rgb(var(--c-ink)/.55); }
  .package-library { background:rgb(var(--c-surface)); border:1px solid rgb(var(--c-ink)/.1); border-radius:14px; }
  .package-library-toolbar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; padding:20px; }
  .package-search { display:flex; align-items:center; flex:1; min-width:180px; gap:10px; color:rgb(var(--c-ink)/.5); }
  .package-search input { width:100%; min-width:0; height:44px; background:transparent; outline:0; font-size:14px; color:rgb(var(--c-ink)); }
  .package-search:focus-within { color:rgb(var(--c-forest)); }
  .package-filter select { min-height:42px; border:1px solid rgb(var(--c-ink)/.12); border-radius:7px; padding:8px 30px 8px 12px; font-size:13px; background:rgb(var(--c-surface)); }
  .package-primary { display:inline-flex; align-items:center; justify-content:center; min-height:44px; gap:8px; padding:10px 18px; border-radius:8px; background:rgb(var(--c-forest)); color:white; font-size:13px; font-weight:600; }
  .package-table-scroll { overflow-x:auto; padding-bottom:70px; margin-bottom:-70px; }
  .package-library-table { width:100%; min-width:640px; border-collapse:collapse; text-align:left; }
  .package-library-table th { padding:13px 20px; border-block:1px solid rgb(var(--c-ink)/.06); background:rgb(var(--c-canvas)/.5); color:rgb(var(--c-ink)/.45); font-size:10px; letter-spacing:.1em; text-transform:uppercase; }
  .package-library-table td { padding:22px 20px; border-bottom:1px solid rgb(var(--c-ink)/.06); }
  .package-row-title { display:flex; gap:14px; align-items:center; }
  .package-row-title img,.package-thumbnail { width:66px; height:54px; flex-shrink:0; border-radius:8px; object-fit:cover; }
  .package-thumbnail { display:grid; place-items:center; background:rgb(var(--c-sand)/.5); color:rgb(var(--c-forest)); }
  .package-row-title strong { display:block; max-width:42ch; font-size:14px; font-weight:600; line-height:1.5; color:rgb(var(--c-heading)); overflow-wrap:anywhere; }
  .package-row-title div > span { display:block; margin-top:4px; font-size:11px; line-height:1.6; color:rgb(var(--c-ink)/.45); overflow-wrap:anywhere; }
  .package-status { display:inline-flex; align-items:center; gap:6px; padding:5px 9px; border-radius:5px; background:rgb(var(--c-ink)/.06); color:rgb(var(--c-ink)/.65); font-size:11px; font-weight:600; text-transform:capitalize; white-space:nowrap; }
  .package-status::before { content:''; width:5px; height:5px; border-radius:50%; background:currentColor; }
  .package-status.published { background:#eaf1e8; color:#416447; }
  .package-status.draft { background:#faf1dd; color:#8a682d; }
  .package-seo { display:block; margin-top:6px; font-size:10px; color:rgb(var(--c-ink)/.45); white-space:nowrap; }
  .package-section-count { font-size:12px; color:rgb(var(--c-ink)/.6); white-space:nowrap; }
  .package-row-actions { display:flex; align-items:center; justify-content:flex-end; gap:8px; }
  .package-row-actions > a, .package-more summary { display:grid; place-items:center; width:34px; min-height:36px; border-radius:6px; color:rgb(var(--c-ink)/.55); cursor:pointer; list-style:none; }
  .package-more summary::-webkit-details-marker { display:none; }
  .package-edit { display:flex; align-items:center; gap:6px; min-height:36px; padding:8px 12px; border:1px solid rgb(var(--c-ink)/.15); border-radius:7px; font-size:12px; font-weight:600; color:rgb(var(--c-heading)); }
  .package-more { position:relative; }
  .package-more > div { position:absolute; right:0; top:100%; z-index:20; width:150px; padding:6px; border:1px solid rgb(var(--c-ink)/.12); border-radius:8px; background:white; box-shadow:0 8px 24px #00000012; }
  .package-more button { width:100%; padding:10px; text-align:left; color:#a23131; font-size:12px; }
  .package-library-footer { padding:18px 20px; font-size:11px; line-height:1.6; color:rgb(var(--c-ink)/.45); }
  .package-list-empty { display:grid; justify-items:center; gap:12px; padding:60px 24px; text-align:center; color:rgb(var(--c-ink)/.6); font-size:14px; }
  .package-list-empty h2 { font-size:20px; color:rgb(var(--c-heading)); font-weight:600; }
  .package-list-empty p { max-width:55ch; line-height:1.8; }
  .package-workspace { position:fixed; inset:0; z-index:65; display:flex; flex-direction:column; overflow:hidden; background:#f7f8f5; font-family:inherit; }
  .package-workspace-header { display:flex; flex-shrink:0; align-items:center; gap:24px; padding:20px 32px; border-bottom:1px solid rgb(var(--c-ink)/.1); background:rgb(var(--c-surface)); }
  .workspace-back { display:flex; flex-shrink:0; align-items:center; gap:8px; min-height:40px; padding-right:24px; border-right:1px solid rgb(var(--c-ink)/.12); color:rgb(var(--c-ink)/.65); font-size:13px; font-weight:600; }
  .workspace-heading { flex:1; min-width:0; }
  .workspace-heading > span { display:block; font-size:9px; font-weight:700; letter-spacing:.12em; color:rgb(var(--c-ink)/.45); }
  .workspace-heading h2 { margin-top:5px; font-size:20px; font-weight:600; color:rgb(var(--c-heading)); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .package-workspace-content { width:100%; max-width:1480px; margin:0 auto; flex:1; min-height:0; overflow-y:auto; padding:0 40px 40px; }
  .workspace-tabs { position:sticky; top:0; z-index:25; display:flex; gap:8px; overflow-x:auto; padding:20px 0; background:#f7f8f5; border-bottom:1px solid rgb(var(--c-ink)/.08); }
  .workspace-step { display:grid; place-items:center; height:21px; width:21px; border-radius:50%; border:1px solid currentColor; font-size:10px; opacity:.75; }
  .workspace-tabs svg { display:none; }
  .package-workspace-footer { display:flex; flex-shrink:0; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:16px 32px; border-top:1px solid rgb(var(--c-ink)/.1); background:rgb(var(--c-surface)); }
  .package-workspace-footer > p { flex:1; min-width:180px; }
  button:focus-visible, a:focus-visible, select:focus-visible, input:focus-visible, summary:focus-visible { outline:2px solid rgb(var(--c-forest)); outline-offset:3px; }
  @media(max-width:767px) {
    .package-list-summary { gap:8px; margin-block:16px; }
    .package-list-summary > div { padding:16px 12px; }
    .package-list-summary span { font-size:8px; letter-spacing:.07em; }
    .package-list-summary strong { font-size:25px; }
    .package-list-summary p { font-size:10px; line-height:1.5; }
    .package-library-toolbar { padding:14px; gap:10px; }
    .package-search { flex-basis:100%; }
    .package-filter { flex:1; }.package-filter select { width:100%; }
    .package-workspace-header { gap:12px; padding:14px 16px; }
    .workspace-back { padding-right:12px; }.workspace-back span { display:none; }
    .workspace-heading h2 { font-size:16px; }.workspace-heading > span { font-size:8px; }
    .package-workspace-content { padding:0 16px 24px; }
    .workspace-tabs { padding-block:14px; gap:4px; }.workspace-tabs button { padding:10px 12px; font-size:12px; }
    .workspace-step { display:none; }
    .package-workspace-footer { padding:12px 16px; }.package-workspace-footer > p { flex-basis:100%; font-size:11px; }
  }

 }
}
</style>
