<script lang="ts">
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsTable from '$lib/components/ui/table';

  import { goto } from '$app/navigation';
  import { ArrowLeft, Download, FileUp, Upload } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';

  type Toast = { id: string; message: string; type: 'error' | 'success' };
  let toasts: Toast[] = [];
  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => (toasts = toasts.filter((t) => t.id !== id)), 4000);
  };
  const dismissToast = (event: CustomEvent<string>) => {
    toasts = toasts.filter((t) => t.id !== event.detail);
  };

  // ── CSV template (single source of truth for the format) ───────────────────
  const HEADERS = [
    'title', 'slug', 'category', 'destination', 'destination_country', 'experience_type', 'budget_tier',
    'duration_days', 'duration_nights', 'price_from', 'currency', 'group_size_min', 'group_size_max',
    'minimum_age', 'difficulty_level', 'start_trip_point_id', 'end_trip_point_id', 'persona_tags', 'highlights',
    'short_description', 'full_description', 'main_image_url', 'banner_image_url', 'status', 'is_featured',
    'is_popular', 'seo_title', 'meta_title', 'meta_description', 'days', 'inclusions', 'exclusions', 'price_options'
  ];

  const EXAMPLE = [
    'Classic Northern Circuit Safari', 'classic-northern-circuit', 'Classic Northern Circuit', 'Serengeti', 'Tanzania',
    'safari', 'signature', '7', '6', '3500', 'USD', '2', '6', '6', 'Easy', 'Arusha', 'Arusha',
    'couple|family', 'Serengeti|Ngorongoro Crater|Tarangire',
    'The essential Tanzania: Tarangire, Ngorongoro and the Serengeti.',
    "Three of Africa's most iconic landscapes on one private journey.",
    'https://images.unsplash.com/photo-1516426122078-c23e76319801', '', 'published', 'true', 'false',
    'Classic Northern Circuit Safari Tanzania | Key2africa Safaris', 'Classic Northern Circuit Safari',
    'Tarangire, Ngorongoro Crater and the Serengeti on a private 7-day safari from Arusha.',
    'Arrival in Arusha~Arusha Coffee Lodge~Your private safari begins at Kilimanjaro Airport.~||Tarangire National Park~Olivers Camp~The elephant capital of Tanzania.~||Ngorongoro Crater~The Manor at Ngorongoro~Descend into the caldera at sunrise.~||Serengeti~Namiri Plains~Three days on the endless plains.~',
    'Private 4x4 Land Cruiser|Certified guide|All park fees|All accommodation|All meals|Airport transfers',
    'International flights|Visa fees|Travel insurance|Tips|Alcohol',
    'Essential~3500~per_person~Mid-range lodges, 7 nights 2 pax sharing||Signature~5500~per_person~Premium tented camps||Prestige~9000~per_person~Singita, Ngorongoro Crater Lodge'
  ];

  const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const toCsv = (rows: string[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\n');

  const downloadTemplate = () => {
    const blob = new Blob([toCsv([HEADERS, EXAMPLE])], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'goldfinch-itinerary-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── upload + import ────────────────────────────────────────────────────────
  type RowResult = {
    line: number;
    status: 'ok' | 'error';
    action?: 'created' | 'updated';
    title?: string;
    slug?: string;
    days?: number;
    inclusions?: number;
    exclusions?: number;
    price_options?: number;
    warnings?: string[];
    error?: string;
  };
  type ImportResult = { summary: { total: number; created: number; updated: number; failed: number }; results: RowResult[] };

  let file: File | null = null;
  let importing = false;
  let result: ImportResult | null = null;

  const onFileChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    file = input.files?.[0] ?? null;
    result = null;
  };

  const runImport = async () => {
    if (!file) {
      showToast('Choose a CSV file first.', 'error');
      return;
    }
    importing = true;
    result = null;
    try {
      const res = await api.tours.importCsv(file);
      result = res.data;
      const { created, updated, failed } = res.data.summary;
      showToast(`${created} created · ${updated} updated${failed ? ` · ${failed} failed` : ''}.`, failed ? 'error' : 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import failed.', 'error');
    } finally {
      importing = false;
    }
  };
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<AdminPageHeader
  eyebrow="Itineraries"
  title="Import Itineraries"
  description="Upload one CSV to create or update multiple safari itineraries — including type, day-by-day plan, inclusions, exclusions and pricing tiers."
  secondaryLabel="Back to Itineraries"
  on:secondary={() => goto('/admin/tours')}
/>

<div class="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
  <!-- Upload card -->
  <section class="rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm">
    <h2 class="text-base font-bold text-heading">1 · Upload your CSV</h2>
    <p class="mt-1 text-sm text-ink/60">Each row is one full itinerary. Existing itineraries (matched by slug) are updated; new ones are created.</p>

    <CmsLabel
      class="mt-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/15 bg-sand/40 px-6 py-10 text-center transition hover:border-goldfinch-gold/60 hover:bg-sand/70"
    >
      <FileUp size={26} class="text-forest" />
      <span class="text-sm font-semibold text-heading">{file ? file.name : 'Click to choose a .csv file'}</span>
      <span class="text-xs text-ink/50">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'or drag & drop into this area'}</span>
      <CmsInput class="hidden" type="file" accept=".csv,text/csv" onchange={onFileChange} />
    </CmsLabel>

    <div class="mt-5 flex flex-wrap items-center gap-3">
      <AdminButton disabled={!file || importing} on:click={runImport}>
        <Upload size={16} />
        {importing ? 'Importing…' : 'Import itineraries'}
      </AdminButton>
      <AdminButton variant="secondary" on:click={downloadTemplate}>
        <Download size={16} />
        Download template
      </AdminButton>
    </div>
  </section>

  <!-- Format help -->
  <section class="rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm">
    <h2 class="text-base font-bold text-heading">CSV format</h2>
    <p class="mt-1 text-sm text-ink/60">Download the template for a working example. Repeating parts use these separators inside a single cell:</p>
    <ul class="mt-4 grid gap-2.5 text-sm text-ink/75">
      <li><code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">category</code> / <code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">destination</code> — by name or slug; created automatically if new.</li>
      <li><code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">highlights</code>, <code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">inclusions</code>, <code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">exclusions</code>, <code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">persona_tags</code> — list, separate items with <code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">|</code></li>
      <li><code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">days</code> — each day <code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">title~lodge~description~image</code>, days separated by <code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">||</code></li>
      <li><code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">price_options</code> — each tier <code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">label~price~price_type~notes</code> (price_type: <code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">per_person</code> / <code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">per_group</code> / <code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">per_child</code> …), tiers separated by <code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">||</code></li>
      <li><code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">status</code> — <code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">draft</code> / <code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">published</code> / <code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">archived</code>. Only <code class="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">title</code> is required.</li>
    </ul>
  </section>
</div>

<!-- Results -->
{#if result}
  <section class="mt-6 rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="text-base font-bold text-heading">Import results</h2>
      <span class="rounded-full bg-forest/10 px-3 py-1 text-xs font-bold text-forest">{result.summary.created} created</span>
      <span class="rounded-full bg-goldfinch-gold/15 px-3 py-1 text-xs font-bold text-clay">{result.summary.updated} updated</span>
      {#if result.summary.failed}
        <span class="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">{result.summary.failed} failed</span>
      {/if}
    </div>

    <div class="mt-4 overflow-x-auto">
      <CmsTable.Root class="w-full min-w-[720px] border-collapse text-sm">
        <CmsTable.Header>
          <CmsTable.Row class="border-b border-ink/10 text-left text-xs font-bold uppercase tracking-wide text-ink/50">
            <CmsTable.Head class="py-2 pr-3">Row</CmsTable.Head>
            <CmsTable.Head class="py-2 pr-3">Status</CmsTable.Head>
            <CmsTable.Head class="py-2 pr-3">Itinerary</CmsTable.Head>
            <CmsTable.Head class="py-2 pr-3">Days</CmsTable.Head>
            <CmsTable.Head class="py-2 pr-3">Incl / Excl</CmsTable.Head>
            <CmsTable.Head class="py-2 pr-3">Pricing</CmsTable.Head>
            <CmsTable.Head class="py-2 pr-3">Notes</CmsTable.Head>
          </CmsTable.Row>
        </CmsTable.Header>
        <CmsTable.Body>
          {#each result.results as row (row.line)}
            <CmsTable.Row class="border-b border-ink/[0.06] align-top">
              <CmsTable.Cell class="py-2 pr-3 font-mono text-xs text-ink/60">{row.line}</CmsTable.Cell>
              <CmsTable.Cell class="py-2 pr-3">
                {#if row.status === 'ok'}
                  <span class="rounded-full bg-forest/10 px-2 py-0.5 text-xs font-bold text-forest">{row.action}</span>
                {:else}
                  <span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">error</span>
                {/if}
              </CmsTable.Cell>
              <CmsTable.Cell class="py-2 pr-3">
                <p class="font-semibold text-heading">{row.title ?? '—'}</p>
                {#if row.slug}<p class="font-mono text-xs text-ink/45">{row.slug}</p>{/if}
              </CmsTable.Cell>
              <CmsTable.Cell class="py-2 pr-3 text-ink/70">{row.days ?? 0}</CmsTable.Cell>
              <CmsTable.Cell class="py-2 pr-3 text-ink/70">{row.inclusions ?? 0} / {row.exclusions ?? 0}</CmsTable.Cell>
              <CmsTable.Cell class="py-2 pr-3 text-ink/70">{row.price_options ?? 0}</CmsTable.Cell>
              <CmsTable.Cell class="py-2 pr-3 text-xs">
                {#if row.error}<p class="text-red-700">{row.error}</p>{/if}
                {#if row.warnings}
                  {#each row.warnings as w}<p class="text-clay/80">{w}</p>{/each}
                {/if}
              </CmsTable.Cell>
            </CmsTable.Row>
          {/each}
        </CmsTable.Body>
      </CmsTable.Root>
    </div>

    <div class="mt-5">
      <AdminButton variant="secondary" on:click={() => goto('/admin/tours')}>
        <ArrowLeft size={16} />
        View itineraries
      </AdminButton>
    </div>
  </section>
{/if}
