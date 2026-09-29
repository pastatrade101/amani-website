<script lang="ts">
  import * as CmsTable from '$lib/components/ui/table';

  import { onMount } from 'svelte';
  import { CheckCircle2 } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';

  type SessionRow = {
    session_id: string;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    referrer: string | null;
    landing_path: string | null;
    device_type: string | null;
    page_views: number | null;
    first_seen_at: string;
    last_seen_at: string;
    converted: boolean;
  };
  type SourceRow = { source: string; sessions: number; leads: number };
  type Summary = { total: number; converted: number; by_source: SourceRow[] };
  type Option = { label: string; value: string };

  const rangeOptions: Option[] = [
    { label: 'Last 7 days', value: '7d' },
    { label: 'Last 30 days', value: '30d' },
    { label: 'This month', value: 'this_month' },
    { label: 'Last month', value: 'last_month' }
  ];

  let range = '30d';
  let sessions: SessionRow[] = [];
  let summary: Summary = { total: 0, converted: 0, by_source: [] };
  let loading = true;
  let error = '';

  $: convRate = summary.total ? Math.round((summary.converted / summary.total) * 100) : 0;

  const fmtDate = (s?: string) => {
    if (!s) return '—';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const sourceLabel = (r: SessionRow) => r.utm_source || (r.referrer ? 'referral' : 'direct');

  const load = async () => {
    loading = true;
    error = '';
    try {
      const res = await api.analytics.sessions({ range });
      const data = res.data as unknown as { sessions?: SessionRow[]; summary?: Summary };
      sessions = data.sessions ?? [];
      summary = data.summary ?? { total: 0, converted: 0, by_source: [] };
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load attribution.';
    } finally {
      loading = false;
    }
  };

  onMount(load);
</script>

<div class="mx-auto grid w-full max-w-[1300px] gap-6">
  <AdminPageHeader
    eyebrow="Analytics"
    title="Attribution"
    description="Where your visitors come from, and which sources and campaigns actually produce leads. First-touch, privacy-safe (no personal data)."
  />

  <AdminToolbar className="grid gap-3 lg:grid-cols-[200px_auto] lg:items-end">
    <AdminSelect label="Range" name="range" bind:value={range} options={rangeOptions} on:change={load} />
  </AdminToolbar>

  {#if loading}
    <LoadingState message="Loading attribution..." />
  {:else if error}
    <ErrorState message={error} />
  {:else}
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-wide text-ink/50">Sessions</p>
        <p class="mt-1 text-2xl font-bold text-ink">{summary.total}</p>
      </div>
      <div class="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-wide text-ink/50">Became leads</p>
        <p class="mt-1 text-2xl font-bold text-ink">{summary.converted}</p>
      </div>
      <div class="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-wide text-ink/50">Conversion rate</p>
        <p class="mt-1 text-2xl font-bold text-ink">{convRate}%</p>
      </div>
    </div>

    {#if summary.by_source.length}
      <div>
        <h2 class="mb-3 text-sm font-bold uppercase tracking-wide text-ink/55">By source</h2>
        <div class="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm">
          <CmsTable.Root class="w-full min-w-[520px] text-left text-sm">
            <CmsTable.Header class="border-b border-ink/10 bg-sand/40 text-xs font-semibold uppercase tracking-wide text-ink/55">
              <CmsTable.Row><CmsTable.Head class="px-4 py-3">Source</CmsTable.Head><CmsTable.Head class="px-4 py-3">Sessions</CmsTable.Head><CmsTable.Head class="px-4 py-3">Leads</CmsTable.Head><CmsTable.Head class="px-4 py-3">Conv.</CmsTable.Head></CmsTable.Row>
            </CmsTable.Header>
            <CmsTable.Body>
              {#each summary.by_source as s (s.source)}
                <CmsTable.Row class="border-b border-ink/[0.06] last:border-0">
                  <CmsTable.Cell class="px-4 py-3 font-semibold text-ink">{s.source}</CmsTable.Cell>
                  <CmsTable.Cell class="px-4 py-3 text-ink/70">{s.sessions}</CmsTable.Cell>
                  <CmsTable.Cell class="px-4 py-3 text-ink/70">{s.leads}</CmsTable.Cell>
                  <CmsTable.Cell class="px-4 py-3 font-semibold text-forest">{s.sessions ? Math.round((s.leads / s.sessions) * 100) : 0}%</CmsTable.Cell>
                </CmsTable.Row>
              {/each}
            </CmsTable.Body>
          </CmsTable.Root>
        </div>
      </div>
    {/if}

    {#if sessions.length === 0}
      <AdminEmptyState
        title="No sessions in this range"
        message="Attribution data appears here as visitors arrive. Share a link with ?utm_source=…&utm_campaign=… to see it populate."
        icon={CheckCircle2}
      />
    {:else}
      <div>
        <h2 class="mb-3 text-sm font-bold uppercase tracking-wide text-ink/55">Recent sessions</h2>
        <div class="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm">
          <CmsTable.Root class="w-full min-w-[880px] text-left text-sm">
            <CmsTable.Header class="border-b border-ink/10 bg-sand/40 text-xs font-semibold uppercase tracking-wide text-ink/55">
              <CmsTable.Row>
                <CmsTable.Head class="px-4 py-3">Source</CmsTable.Head>
                <CmsTable.Head class="px-4 py-3">Medium / Campaign</CmsTable.Head>
                <CmsTable.Head class="px-4 py-3">Landing</CmsTable.Head>
                <CmsTable.Head class="px-4 py-3">Device</CmsTable.Head>
                <CmsTable.Head class="px-4 py-3">First seen</CmsTable.Head>
                <CmsTable.Head class="px-4 py-3">Lead</CmsTable.Head>
              </CmsTable.Row>
            </CmsTable.Header>
            <CmsTable.Body>
              {#each sessions as r (r.session_id)}
                <CmsTable.Row class="border-b border-ink/[0.06] last:border-0">
                  <CmsTable.Cell class="px-4 py-3 font-semibold text-ink">{sourceLabel(r)}</CmsTable.Cell>
                  <CmsTable.Cell class="px-4 py-3 text-ink/70">
                    {r.utm_medium || '—'}{#if r.utm_campaign} · <span class="text-ink/55">{r.utm_campaign}</span>{/if}
                  </CmsTable.Cell>
                  <CmsTable.Cell class="px-4 py-3"><span class="font-mono text-xs text-ink/60">{r.landing_path || '—'}</span></CmsTable.Cell>
                  <CmsTable.Cell class="px-4 py-3 text-ink/70">{r.device_type || '—'}</CmsTable.Cell>
                  <CmsTable.Cell class="px-4 py-3 whitespace-nowrap text-xs text-ink/60">{fmtDate(r.first_seen_at)}</CmsTable.Cell>
                  <CmsTable.Cell class="px-4 py-3">
                    {#if r.converted}
                      <span class="inline-flex items-center gap-1 rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-semibold text-forest"><CheckCircle2 size={11} />Lead</span>
                    {:else}
                      <span class="text-ink/30">—</span>
                    {/if}
                  </CmsTable.Cell>
                </CmsTable.Row>
              {/each}
            </CmsTable.Body>
          </CmsTable.Root>
        </div>
      </div>
    {/if}
  {/if}
</div>
