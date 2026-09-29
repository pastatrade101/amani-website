<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Textarea as CmsTextarea } from '$lib/components/ui/textarea';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';

  /**
   * Composes a landing page out of blocks.
   *
   * Every control here is generated from BLOCK_TYPES — the same list the public
   * renderer switches on. Adding a block type means editing that one file; this
   * editor grows a new form for it without being touched, and the two can never
   * disagree about a field name.
   */
  import { createEventDispatcher, onMount } from 'svelte';
  import { ChevronDown, LayoutTemplate, Plus, ShieldCheck, Undo2, X } from '@lucide/svelte';
  import AdminFormInput from './AdminFormInput.svelte';
  import AdminRichText from './AdminRichText.svelte';
  import AdminSelect from './AdminSelect.svelte';
  import AdminTextArea from './AdminTextArea.svelte';
  import MediaPicker from './MediaPicker.svelte';
  import PackageIconPicker from './PackageIconPicker.svelte';
  import { api } from '$lib/admin/api/client';
  import { PROPERTY_CATEGORIES, enumLabel } from '$lib/admin/accommodationEnums';
  import { BLOCK_TYPES, blockSpec, emptyBlock, newBlockId, routeDisplayName, routeTourSlugs, type Block, type FieldSpec } from '$lib/admin/safariPackageBlocks';
  import { orderedPackageBlocks, sectionGuidance, sectionSummary } from '$lib/admin/packagePresentation';
  import type { Lodge, Tour } from '$lib/admin/types';

  // `any` on the value bag deliberately: these are jsonb fields of mixed type,
  // and a rich-text control has to bind straight into one.
  export let blocks: Array<Record<string, any> & { type: string }> = [];

  const dispatch = createEventDispatcher<{ change: Block[] }>();
  const push = () => {
    blocks = blocks;
    dispatch('change', blocks);
  };

  let addType = BLOCK_TYPES[0]?.type ?? '';
  let lodges: Lodge[] = [];
  let tours: Tour[] = [];
  let accommodationLoading = true;
  let lodgeSearch: Record<string, string> = {};

  const categoryOptions = [{ value: '', label: 'Choose an accommodation category' }, ...PROPERTY_CATEGORIES.map((category) => ({ value: category, label: enumLabel(category) }))];
  $: tourOptions = [{ value: '', label: 'Choose a published tour' }, ...tours.map((tour) => ({ value: tour.slug, label: tour.title }))];

  onMount(async () => {
    try {
      const [lodgeResult, tourResult] = await Promise.allSettled([
        api.lodges.list({ status: 'published', limit: 200 }),
        api.tours.list({ status: 'published', limit: 200 })
      ]);
      if (lodgeResult.status === 'fulfilled') lodges = lodgeResult.value.data.items ?? [];
      if (tourResult.status === 'fulfilled') tours = tourResult.value.data.items ?? [];
    } finally {
      accommodationLoading = false;
    }
  });

  let activeBlock: Block | null = null;
  let pendingRemoval: { label: string; remove: () => void; restore: () => void } | null = null;
  let removed: { label: string; restore: () => void } | null = null;
  let showLibrary = false;
  const identities = new WeakMap<object, number>();
  let nextIdentity = 0;
  const identity = (value: object) => {
    if (!identities.has(value)) identities.set(value, ++nextIdentity);
    return identities.get(value)!;
  };
  const confirmRemoval = () => {
    if (!pendingRemoval) return;
    pendingRemoval.remove();
    removed = { label: pendingRemoval.label, restore: pendingRemoval.restore };
    pendingRemoval = null;
  };
  const undoRemoval = () => { removed?.restore(); removed = null; push(); };
  const requestRemoval = (label: string, remove: () => void, restore: () => void) => {
    pendingRemoval = { label, remove, restore };
  };

  const addBlock = () => {
    if (!addType) return;
    if (addType === 'enquiry' && blocks.some((block) => block.type === 'enquiry')) return;
    const next = emptyBlock(addType);
    blocks = orderedPackageBlocks([...blocks, next]);
    activeBlock = next;
    showLibrary = false;
    push();
  };

  const removeBlock = (index: number) => {
    const target = blocks[index];
    requestRemoval(blockSpec(target.type)?.label ?? 'section', () => {
      blocks = blocks.filter((block) => block !== target);
      if (activeBlock === target) activeBlock = null;
      push();
    }, () => {
      blocks = orderedPackageBlocks([...blocks.slice(0, index), target, ...blocks.slice(index)]);
      activeBlock = target;
    });
  };

  const setField = (index: number, key: string, value: unknown) => {
    blocks[index][key] = value;
    push();
  };

  const itemRows = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? (value as Record<string, unknown>[]) : []);

  const addItem = (index: number, field: FieldSpec) => {
    // An id from the start, so its translations stay with it however the list is reordered.
    const row: Record<string, unknown> = { _id: newBlockId('y') };
    for (const sub of field.fields ?? []) row[sub.key] = sub.kind === 'lines' || sub.kind === 'routeComforts' ? [] : '';
    setField(index, field.key, [...itemRows(blocks[index][field.key]), row]);
  };

  const removeItem = (index: number, field: FieldSpec, rowIndex: number) => {
    const target = blocks[index];
    const row = itemRows(target[field.key])[rowIndex];
    requestRemoval(`${field.label} item ${rowIndex + 1}`, () => {
      target[field.key] = itemRows(target[field.key]).filter((item) => item !== row);
      push();
    }, () => {
      const current = itemRows(target[field.key]);
      target[field.key] = [...current.slice(0, rowIndex), row, ...current.slice(rowIndex)];
    });
  };


  const comfortRows = (blockIndex: number, routeKey: string, routeIndex: number, key: string) =>
    itemRows(itemRows(blocks[blockIndex][routeKey])[routeIndex]?.[key]);

  const setComfortRows = (blockIndex: number, routeKey: string, routeIndex: number, key: string, comforts: Record<string, unknown>[]) => {
    const routes = itemRows(blocks[blockIndex][routeKey]);
    routes[routeIndex][key] = comforts;
    setField(blockIndex, routeKey, routes);
  };

  const addComfort = (blockIndex: number, routeKey: string, routeIndex: number, key: string) =>
    setComfortRows(blockIndex, routeKey, routeIndex, key, [
      ...comfortRows(blockIndex, routeKey, routeIndex, key),
      { accommodation_level: 'MID_RANGE', tour_slug: '', accommodation_ids: [] }
    ]);

  const updateComfort = (blockIndex: number, routeKey: string, routeIndex: number, key: string, comfortIndex: number, patch: Record<string, unknown>) =>
    setComfortRows(
      blockIndex,
      routeKey,
      routeIndex,
      key,
      comfortRows(blockIndex, routeKey, routeIndex, key).map((comfort, index) => (index === comfortIndex ? { ...comfort, ...patch } : comfort))
    );

  const removeComfort = (blockIndex: number, routeKey: string, routeIndex: number, key: string, comfortIndex: number) => {
    const route = itemRows(blocks[blockIndex][routeKey])[routeIndex];
    const comfort = itemRows(route[key])[comfortIndex];
    requestRemoval('accommodation option', () => {
      route[key] = itemRows(route[key]).filter((item) => item !== comfort);
      push();
    }, () => {
      const current = itemRows(route[key]);
      route[key] = [...current.slice(0, comfortIndex), comfort, ...current.slice(comfortIndex)];
    });
  };

  const availableLodges = (category: unknown) => lodges.filter((lodge) => lodge.accommodation_level === category);
  const selectValue = (event: Event) => (event.currentTarget as HTMLSelectElement | null)?.value ?? '';

  const pickAccommodation = (blockIndex: number, routeKey: string, routeIndex: number, key: string, comfortIndex: number, lodgeId: string) => {
    const comfort = comfortRows(blockIndex, routeKey, routeIndex, key)[comfortIndex];
    const selected = Array.isArray(comfort.accommodation_ids) ? comfort.accommodation_ids.map(String) : [];
    const next = selected.includes(lodgeId) ? selected.filter((id) => id !== lodgeId) : [...selected, lodgeId];
    updateComfort(blockIndex, routeKey, routeIndex, key, comfortIndex, { accommodation_ids: next });
  };

  const label = 'block text-[11px] font-bold uppercase tracking-[0.12em] text-ink/55';
</script>

<div class="package-editor grid gap-4">
  <div class="editor-guide">
    <ShieldCheck size={22} />
    <div><strong>Your content. A consistent design.</strong><p>Choose a section and fill in the details. Section order, spacing, image sizes and mobile layout are handled for you.</p></div>
  </div>
  {#if blocks.filter((block) => block.type === 'enquiry').length > 1}
    <p class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-ink/70">This package has more than one enquiry section. Only the first appears on the page. Edit that section for your quote form; the extra sections are kept here until you remove them.</p>
  {/if}
  {#if pendingRemoval}
    <div class="editor-notice" role="alert">
      <div><strong>Remove {pendingRemoval.label}?</strong><p>You can undo this removal before saving.</p></div>
      <CmsButton variant="ghost" type="button" onclick={() => (pendingRemoval = null)}>Keep content</CmsButton>
      <CmsButton variant="ghost" type="button" class="text-red-700" onclick={confirmRemoval}>Remove</CmsButton>
    </div>
  {/if}
  {#if removed}
    <div class="editor-notice" role="status"><span>{removed.label} removed.</span><CmsButton variant="ghost" type="button" onclick={undoRemoval}><Undo2 size={14} /> Undo removal</CmsButton></div>
  {/if}
  <div class="flex items-center justify-between"><h3 class="text-sm font-semibold text-heading">Page sections <span class="ml-1 text-ink/45">{blocks.length}</span></h3><span class="text-xs text-ink/50">Arranged automatically</span></div>
  {#each blocks as block, index (identity(block))}
    {@const spec = blockSpec(block.type)}
    <section class="rounded-[12px] border border-ink/12 bg-surface">
      <header class="section-editor-header">
        <CmsButton variant="ghost" type="button" class="section-toggle" aria-expanded={activeBlock === block} aria-controls={`package-editor-${identity(block)}`} onclick={() => (activeBlock = activeBlock === block ? null : block)}>
          <span class="section-number">{String(index + 1).padStart(2, '0')}</span>
          <span class="min-w-0 flex-1"><strong>{spec?.label ?? block.type}</strong><span class="section-summary">{sectionSummary(block)}</span></span>
          <ChevronDown size={18} class={activeBlock === block ? 'rotate-180' : ''} />
        </CmsButton>
        <CmsButton variant="ghost" type="button" class="section-remove" aria-label={`Remove ${spec?.label ?? block.type}`} onclick={() => removeBlock(index)}><X size={16} /></CmsButton>
      </header>

      {#if spec}
        <div id={`package-editor-${identity(block)}`} class="grid gap-5 border-t border-ink/10 p-5" class:hidden={activeBlock !== block}>
          <p class="text-sm leading-6 text-ink/60">{spec.blurb}</p>
          {#each sectionGuidance(block) as note}<p class="rounded-lg bg-sand/40 px-3 py-2 text-xs leading-5 text-ink/65">{note}</p>{/each}
          {#each spec.fields as field (field.key)}
            {#if field.kind === 'text'}
              <AdminFormInput
                label={field.label}
                name={`b${index}_${field.key}`}
                placeholder={field.placeholder ?? ''}
                bind:value={blocks[index][field.key]}
              />
            {:else if field.kind === 'textarea'}
              <AdminTextArea
                label={field.label}
                name={`b${index}_${field.key}`}
                rows={3}
                placeholder={field.placeholder ?? ''}
                bind:value={blocks[index][field.key]}
              />
            {:else if field.kind === 'richtext'}
              <AdminRichText
                label={field.label}
                name={`b${index}_${field.key}`}
                rows={8}
                compact
                hint={field.hint ?? ''}
                bind:value={blocks[index][field.key]}
              />
            {:else if field.kind === 'image'}
              <MediaPicker
                label={field.label}
                value={String(block[field.key] ?? '')}
                on:change={(event) => setField(index, field.key, event.detail ?? '')}
              />
            {:else if field.kind === 'icon'}
              <PackageIconPicker
                label={field.label}
                hint={field.hint ?? ''}
                bind:value={blocks[index][field.key]}
              />
            {:else if field.kind === 'lines'}
              <div class="grid gap-1">
                <AdminTextArea
                  label={field.label}
                  name={`b${index}_${field.key}`}
                  rows={4}
                  bind:value={blocks[index][field.key]}
                />
                <span class="text-[11px] text-ink/45">{field.hint ?? 'One per line.'}</span>
              </div>
            {:else if field.kind === 'items'}
              <div class="grid gap-2">
                <span class={label}>{field.label}</span>
                {#if field.hint}<span class="-mt-1 text-[11px] text-ink/45">{field.hint}</span>{/if}
                {#each itemRows(block[field.key]) as row, rowIndex (rowIndex)}
                  <details class="rounded-xl border border-ink/10 bg-canvas p-3" open={rowIndex === 0}>
                    <summary class="cursor-pointer text-sm font-semibold text-heading">{block.type === 'routes' ? routeDisplayName(row.tab, tours.find((tour) => tour.slug === routeTourSlugs(row)[0])?.title) || `New route ${rowIndex + 1}` : String(row.label || row.question || row.title || row.caption || `Item ${rowIndex + 1}`)}</summary>
                    <div class="mt-4 grid gap-3">
                    <div class="flex items-center justify-between">
                      <span class="text-[11px] font-bold uppercase tracking-wider text-ink/45">{rowIndex + 1}</span>
                      <CmsButton variant="ghost" type="button" class="rounded p-1 text-ink/40 transition hover:text-red-600" aria-label="Remove" onclick={() => removeItem(index, field, rowIndex)}>
                        <X size={14} />
                      </CmsButton>
                    </div>
                    {#each field.fields ?? [] as sub (sub.key)}
                      {#if sub.kind === 'routeComforts'}
                        <div class="grid gap-3 rounded-xl border border-forest/15 bg-forest/[0.025] p-3">
                          <div>
                            <p class="text-[12px] font-bold text-heading">Accommodation options</p>
                            <p class="mt-0.5 text-[11px] leading-4 text-ink/55">1. Choose a comfort level. 2. Select its tour. 3. Optionally feature accommodation below.</p>
                          </div>
                          {#if sub.hint}<span class="-mt-1 text-[11px] text-ink/45">{sub.hint}</span>{/if}
                          {#if accommodationLoading}
                            <p class="text-[12px] text-ink/55">Loading accommodation choices…</p>
                          {:else}
                            {#each comfortRows(index, field.key, rowIndex, sub.key) as comfort, comfortIndex (comfortIndex)}
                              {@const category = String(comfort.accommodation_level ?? '')}
                              {@const linkedTour = tours.find((tour) => tour.slug === comfort.tour_slug)}
                              {@const matchingLodges = availableLodges(category)}
                              {@const selectedIds = Array.isArray(comfort.accommodation_ids) ? comfort.accommodation_ids.map(String) : []}
                              {@const lodgeGroup = `b${index}_${field.key}_${rowIndex}_${sub.key}_${comfortIndex}_lodge`}
                              <div class="grid gap-3 rounded-[9px] border border-ink/12 bg-surface p-3">
                                <div class="flex items-center justify-between gap-3">
                                  <span class="text-[11px] font-bold uppercase tracking-wider text-forest">{category ? enumLabel(category) : 'Safari stay'}</span>
                                  <CmsButton variant="ghost" type="button" class="rounded p-1 text-ink/40 transition hover:text-red-600" aria-label="Remove accommodation tab" onclick={() => removeComfort(index, field.key, rowIndex, sub.key, comfortIndex)}>
                                    <X size={14} />
                                  </CmsButton>
                                </div>
                                <div class="grid gap-3 md:grid-cols-2">
                                  <AdminSelect
                                    label="Accommodation category"
                                    name={`b${index}_${field.key}_${rowIndex}_${sub.key}_${comfortIndex}_category`}
                                    options={categoryOptions}
                                    value={category}
                                    on:change={(event) => updateComfort(index, field.key, rowIndex, sub.key, comfortIndex, { accommodation_level: selectValue(event) })}
                                  />
                                  <AdminSelect
                                    label="Tour for price & itinerary"
                                    name={`b${index}_${field.key}_${rowIndex}_${sub.key}_${comfortIndex}_tour`}
                                    options={tourOptions}
                                    value={String(comfort.tour_slug ?? '')}
                                    on:change={(event) => updateComfort(index, field.key, rowIndex, sub.key, comfortIndex, { tour_slug: selectValue(event) })}
                                  />
                                </div>
                                <div class="content-source">
                                  <strong>Tour content</strong>
                                  <p>The route photo, introduction, highlights, prices and itinerary come from the selected tour.</p>
                                  {#if linkedTour}<a href={`/admin/tours/${linkedTour.id}/edit`} target="_blank" rel="noreferrer">Edit {linkedTour.title} ↗</a>{/if}
                                </div>
                                <CmsLabel class="grid gap-1.5">
                                  <span class="text-[13px] font-semibold text-ink/65">Paragraph below “{category ? enumLabel(category) : 'Safari stay'}” in the price card (optional)</span>
                                  <CmsTextarea
                                    class="rounded-md border border-ink/15 bg-black/[0.02] px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink/35 focus:border-forest focus:bg-surface focus:ring-2 focus:ring-forest/20"
                                    name={`b${index}_${field.key}_${rowIndex}_${sub.key}_${comfortIndex}_description`}
                                    placeholder={linkedTour?.short_description || 'Describe this comfort level and what makes it a good choice.'}
                                    rows={3}
                                    value={String(comfort.description ?? '')}
                                    oninput={(event) => updateComfort(index, field.key, rowIndex, sub.key, comfortIndex, { description: event.currentTarget.value })}
                                  ></CmsTextarea>
                                </CmsLabel>
                                <p class="text-xs leading-5 text-ink/55">Write here to change this paragraph for this package. When blank, the tour summary is used if it is not already shown in the route introduction.</p>
                                <div class="grid gap-1.5">
                                  <span class={label}>Featured accommodation (optional)</span>
                                  {#if matchingLodges.length}
                                    <details class="lodge-picker">
                                      <summary>{selectedIds.length ? `${selectedIds.length} ${selectedIds.length === 1 ? 'property' : 'properties'} selected · Change selection` : 'Choose properties to feature'}</summary>
                                      <CmsLabel class="mt-3 grid gap-1 text-xs text-ink/60">Search properties<CmsInput type="search" placeholder="Search by name or destination" class="rounded-md border border-ink/15 p-2.5 text-sm" bind:value={lodgeSearch[lodgeGroup]} /></CmsLabel>
                                      <div class="lodge-picker-options grid gap-2 sm:grid-cols-2">
                                      {#each matchingLodges.filter((lodge) => `${lodge.name} ${lodge.destinations?.name ?? ''}`.toLowerCase().includes((lodgeSearch[lodgeGroup] ?? '').toLowerCase())).sort((a, b) => Number(selectedIds.includes(b.id)) - Number(selectedIds.includes(a.id))) as lodge (lodge.id)}
                                        <CmsLabel class={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${selectedIds.includes(lodge.id) ? 'border-goldfinch-gold bg-goldfinch-gold/10' : 'border-ink/10 bg-canvas hover:border-goldfinch-gold/45'}`}>
                                          <CmsCheckbox class="mt-0.5 h-4 w-4 border-ink/30 text-goldfinch-gold focus:ring-goldfinch-gold"  name={lodgeGroup} checked={selectedIds.includes(lodge.id)} onCheckedChange={() => pickAccommodation(index, field.key, rowIndex, sub.key, comfortIndex, lodge.id)} />
                                          <span class="min-w-0"><span class="block text-[12px] font-semibold text-heading">{lodge.name}</span>{#if lodge.destinations?.name}<span class="block truncate text-[11px] text-ink/50">{lodge.destinations.name}</span>{/if}</span>
                                        </CmsLabel>
                                      {/each}
                                      </div>
                                      {#if !matchingLodges.some((lodge) => `${lodge.name} ${lodge.destinations?.name ?? ''}`.toLowerCase().includes((lodgeSearch[lodgeGroup] ?? '').toLowerCase()))}<p class="mt-3 text-xs text-ink/55">No properties match this search.</p>{/if}
                                    </details>
                                    <p class="text-[11px] leading-5 text-ink/55">Select the properties to feature. With none selected, stays still appear in the tour’s day-by-day itinerary.</p>
                                  {:else}
                                    <p class="rounded-xl border border-dashed border-ink/15 px-3 py-2 text-[12px] text-ink/55">No CMS accommodation is available in this category yet.</p>
                                  {/if}
                                  {#each selectedIds.filter((id) => !matchingLodges.some((lodge) => lodge.id === id)) as id}
                                    <CmsLabel class="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs leading-5">
                                      <CmsCheckbox  checked onCheckedChange={() => pickAccommodation(index, field.key, rowIndex, sub.key, comfortIndex, id)} />
                                      <span>{lodges.find((lodge) => lodge.id === id)?.name ?? 'Previously selected property'} — kept from this package; outside this category or currently unavailable.</span>
                                    </CmsLabel>
                                  {/each}
                                  {#if selectedIds.length}
                                    <div class="content-source">
                                      <strong>Property names, “Mid Range”, location and photos</strong>
                                      <p>These come from each property’s record. Changes there update every page that uses the property.</p>
                                      {#each lodges.filter((lodge) => selectedIds.includes(lodge.id)) as lodge}
                                        <a href={`/admin/lodges?edit=${encodeURIComponent(lodge.slug)}`} target="_blank" rel="noreferrer">Edit {lodge.name} ↗</a>
                                      {/each}
                                    </div>
                                  {/if}
                                </div>
                              </div>
                            {/each}
                            <CmsButton variant="ghost" type="button" class="inline-flex h-9 w-fit items-center gap-1.5 rounded border border-ink/15 px-3 text-xs font-semibold text-heading transition hover:bg-sand/50" onclick={() => addComfort(index, field.key, rowIndex, sub.key)}>
                              <Plus size={13} /> Add accommodation category
                            </CmsButton>
                          {/if}
                        </div>
                      {:else if sub.kind === 'richtext'}
                        <AdminRichText
                          label={sub.label}
                          name={`b${index}_${field.key}_${rowIndex}_${sub.key}`}
                          rows={5}
                          compact
                          hint={sub.hint ?? ''}
                          bind:value={blocks[index][field.key][rowIndex][sub.key]}
                        />
                      {:else if sub.kind === 'textarea'}
                        <AdminTextArea
                          label={sub.label}
                          name={`b${index}_${field.key}_${rowIndex}_${sub.key}`}
                          rows={2}
                          placeholder={sub.placeholder ?? ''}
                          bind:value={blocks[index][field.key][rowIndex][sub.key]}
                        />
                      {:else if sub.kind === 'image'}
                        <MediaPicker
                          label={sub.label}
                          value={String(row[sub.key] ?? '')}
                          on:change={(event) => {
                            blocks[index][field.key][rowIndex][sub.key] = event.detail ?? '';
                            push();
                          }}
                        />
                      {:else if sub.kind === 'icon'}
                        <PackageIconPicker
                          label={sub.label}
                          hint={sub.hint ?? ''}
                          bind:value={blocks[index][field.key][rowIndex][sub.key]}
                        />
                      {:else if sub.kind === 'lines'}
                        <div class="grid gap-1">
                          <AdminTextArea
                            label={sub.label}
                            name={`b${index}_${field.key}_${rowIndex}_${sub.key}`}
                            rows={3}
                            bind:value={blocks[index][field.key][rowIndex][sub.key]}
                          />
                          <span class="text-[11px] text-ink/45">{sub.hint ?? 'One per line.'}</span>
                        </div>
                      {:else}
                        <AdminFormInput
                          label={sub.label}
                          name={`b${index}_${field.key}_${rowIndex}_${sub.key}`}
                          placeholder={sub.placeholder ?? ''}
                          bind:value={blocks[index][field.key][rowIndex][sub.key]}
                        />
                      {/if}
                      {#if sub.hint && (sub.kind === 'text' || sub.kind === 'textarea')}<p class="text-xs leading-5 text-ink/55">{sub.hint}</p>{/if}
                    {/each}
                    </div>
                  </details>
                {/each}
                <CmsButton variant="ghost" type="button" class="inline-flex h-9 w-fit items-center gap-1.5 rounded border border-ink/15 px-3 text-xs font-semibold text-heading transition hover:bg-sand/50" onclick={() => addItem(index, field)}>
                  <Plus size={13} /> Add {field.label.toLowerCase()} item
                </CmsButton>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </section>
  {/each}

  <CmsButton variant="ghost" type="button" class="section-add" aria-expanded={showLibrary} onclick={() => (showLibrary = !showLibrary)}><Plus size={17} /> Add a section <span>Choose what this trip needs</span></CmsButton>
  {#if showLibrary}
    <div class="section-library">
      {#each orderedPackageBlocks(BLOCK_TYPES.map((spec) => ({ type: spec.type }))) as choice}
        {@const spec = blockSpec(choice.type)!}
        <CmsButton variant="ghost" type="button" disabled={blocks.length >= 60 || (spec.type === 'enquiry' && blocks.some((block) => block.type === 'enquiry'))} onclick={() => { addType = spec.type; addBlock(); }}>
          <LayoutTemplate size={18} /><strong>{spec.label}</strong><span>{spec.type === 'enquiry' && blocks.some((block) => block.type === 'enquiry') ? 'Already on this page. Edit the existing enquiry section above.' : spec.blurb}</span>
        </CmsButton>
      {/each}
    </div>
  {/if}
</div>

<style>
:global {
 .key2africa-admin-surface {

  .lodge-picker { padding:12px; border:1px solid rgb(var(--c-ink)/.12); border-radius:8px; }
  .lodge-picker summary { cursor:pointer; font-size:12px; font-weight:600; color:rgb(var(--c-forest)); }
  .lodge-picker-options { max-height:300px; overflow-y:auto; margin-top:12px; padding:2px; }
  .content-source { display:grid; gap:5px; padding:14px; border-radius:8px; background:rgb(var(--c-sand)/.35); font-size:12px; line-height:1.6; color:rgb(var(--c-ink)/.65); }
  .content-source strong { color:rgb(var(--c-heading)); }
  .content-source a { width:fit-content; font-weight:600; color:rgb(var(--c-forest)); text-decoration:underline; text-underline-offset:3px; }
  .editor-guide { display:flex; gap:14px; padding:20px; border:1px solid rgb(var(--c-forest)/.15); border-radius:12px; background:rgb(var(--c-forest)/.04); color:rgb(var(--c-forest)); }
  .editor-guide svg { flex-shrink:0; margin-top:2px; }
  .editor-guide strong { font-size:14px; }
  .editor-guide p { margin-top:4px; max-width:75ch; font-size:13px; line-height:1.7; color:rgb(var(--c-ink)/.65); }
  .editor-notice { position:sticky; top:0; z-index:25; display:flex; flex-wrap:wrap; align-items:center; gap:12px; padding:14px 18px; border:1px solid rgb(var(--c-goldfinch-gold)/.5); border-radius:10px; background:#fffbef; font-size:13px; }
  .editor-notice > div, .editor-notice > span { flex:1; }
  .editor-notice p { margin-top:3px; font-size:12px; }
  .editor-notice button { display:flex; align-items:center; gap:6px; min-height:36px; padding:6px 10px; border:1px solid rgb(var(--c-ink)/.15); border-radius:6px; font-weight:600; }
  .section-editor-header { display:flex; align-items:center; padding-right:12px; }
  .section-toggle { display:flex; align-items:center; gap:14px; flex:1; min-width:0; padding:18px; text-align:left; }
  .section-toggle strong { display:block; font-size:14px; color:rgb(var(--c-heading)); }
  .section-summary { display:-webkit-box; -webkit-line-clamp:2; line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-top:4px; font-size:12px; line-height:1.5; color:rgb(var(--c-ink)/.55); overflow-wrap:anywhere; }
  .section-number { display:grid; place-items:center; flex-shrink:0; width:34px; height:38px; border-radius:7px; background:rgb(var(--c-sand)/.55); font-size:12px; font-weight:700; color:rgb(var(--c-forest)); }
  .section-toggle svg { flex-shrink:0; }
  .section-remove { padding:10px; color:rgb(var(--c-ink)/.4); border-radius:6px; }
  .section-remove:hover { background:#fff1f0; color:#a32929; }
  .section-add { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:8px; min-height:64px; border:1px dashed rgb(var(--c-forest)/.3); border-radius:12px; color:rgb(var(--c-forest)); font-size:14px; font-weight:600; }
  .section-add span { font-size:12px; font-weight:400; color:rgb(var(--c-ink)/.5); }
  .section-library { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr)); gap:12px; }
  .section-library button { display:grid; gap:8px; padding:20px; border:1px solid rgb(var(--c-ink)/.12); border-radius:10px; background:rgb(var(--c-surface)); text-align:left; }
  .section-library button:disabled { opacity:.5; cursor:default; }
  .section-library button:not(:disabled):hover { border-color:rgb(var(--c-forest)); }
  .section-library strong { font-size:14px; }
  .section-library span { font-size:12px; line-height:1.6; color:rgb(var(--c-ink)/.6); }
  .package-editor button:focus-visible { outline:2px solid rgb(var(--c-forest)); outline-offset:3px; }

 }
}
</style>
