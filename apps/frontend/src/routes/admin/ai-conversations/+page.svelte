<script lang="ts">
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsSelect from '$lib/components/ui/native-select';
  import * as CmsTable from '$lib/components/ui/table';

  import { onMount } from 'svelte';
  import { ArrowRight, Bot, Search } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import StatusBadge from '$lib/admin/components/admin/StatusBadge.svelte';

  type Conversation = {
    id: string;
    visitor_name?: string | null;
    visitor_email?: string | null;
    status?: string | null;
    lead_status?: string | null;
    lead_score?: number | null;
    handoff_required?: boolean | null;
    source_page?: string | null;
    language?: string | null;
    booking_request_id?: string | null;
    ai_message_count?: number | null;
    total_estimated_cost_usd?: number | null;
    updated_at?: string | null;
    created_at?: string | null;
  };

  let rows: Conversation[] = [];
  let loading = true;
  let error = '';
  let search = '';
  let statusFilter = 'all';
  let leadFilter = 'all';

  const load = async () => {
    loading = true;
    error = '';
    try {
      const params: Record<string, string> = { limit: '100' };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.aiTravelAdvisor.conversations(params);
      rows = (res.data.items ?? []) as Conversation[];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load AI conversations.';
    } finally {
      loading = false;
    }
  };

  onMount(load);

  $: filtered = rows.filter((r) => (leadFilter === 'all' ? true : leadFilter === 'handoff' ? r.handoff_required : r.lead_status === leadFilter));

  const fmt = (v?: string | null) => (v ? new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(v)) : '—');
  const money = (v?: number | null) => `$${Number(v ?? 0).toFixed(4)}`;
</script>

<svelte:head><title>AI Conversations | Key2africa CMS</title></svelte:head>

<section class="grid gap-6">
  <AdminPageHeader
    eyebrow="AI System"
    title="AI Conversations"
    description="Key2africa Travel Advisor leads — transcripts, lead score, recommendations, handoff and booking status."
  />

  <div class="rounded-xl border border-ink/10 bg-surface p-4 shadow-card">
    <div class="grid gap-3 md:grid-cols-[1fr_180px_180px]">
      <CmsLabel class="grid gap-1.5 text-xs font-semibold text-ink/60">
        Search
        <span class="flex h-10 items-center gap-2 rounded-lg border border-ink/15 bg-surface px-3 focus-within:border-forest">
          <Search size={15} class="text-ink/40" />
          <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none" bind:value={search} placeholder="Name, email, status…" onkeydown={(e) => e.key === 'Enter' && load()} />
        </span>
      </CmsLabel>
      <CmsLabel class="grid gap-1.5 text-xs font-semibold text-ink/60">
        Status
        <CmsSelect.Root class="h-10 rounded-lg border border-ink/15 bg-surface px-2 text-sm outline-none focus:border-forest" bind:value={statusFilter} onchange={load}>
          <CmsSelect.Option value="all">All statuses</CmsSelect.Option>
          <CmsSelect.Option value="in_progress">In progress</CmsSelect.Option>
          <CmsSelect.Option value="handoff_ready">Handoff ready</CmsSelect.Option>
          <CmsSelect.Option value="booking_request_created">Booking created</CmsSelect.Option>
        </CmsSelect.Root>
      </CmsLabel>
      <CmsLabel class="grid gap-1.5 text-xs font-semibold text-ink/60">
        Lead
        <CmsSelect.Root class="h-10 rounded-lg border border-ink/15 bg-surface px-2 text-sm outline-none focus:border-forest" bind:value={leadFilter}>
          <CmsSelect.Option value="all">All leads</CmsSelect.Option>
          <CmsSelect.Option value="qualified">Qualified</CmsSelect.Option>
          <CmsSelect.Option value="hot">Hot</CmsSelect.Option>
          <CmsSelect.Option value="warm">Warm</CmsSelect.Option>
          <CmsSelect.Option value="cold">Cold</CmsSelect.Option>
          <CmsSelect.Option value="handoff">Handoff required</CmsSelect.Option>
        </CmsSelect.Root>
      </CmsLabel>
    </div>
  </div>

  {#if loading}
    <div class="grid gap-2">
      {#each Array(5) as _}<div class="h-14 animate-pulse rounded-lg bg-black/5"></div>{/each}
    </div>
  {:else if error}
    <p class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
  {:else if !filtered.length}
    <div class="grid place-items-center gap-2 rounded-xl border border-dashed border-ink/15 bg-surface py-16 text-center">
      <span class="grid h-12 w-12 place-items-center rounded-full bg-forest/10 text-forest"><Bot size={22} /></span>
      <p class="text-sm font-semibold text-ink">No AI conversations yet</p>
      <p class="max-w-sm text-sm text-ink/55">Leads from the public AI advisor widget will appear here.</p>
    </div>
  {:else}
    <div class="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-card">
      <CmsTable.Root class="w-full text-left text-sm">
        <CmsTable.Header class="border-b border-ink/10 bg-black/[0.02] text-[11px] uppercase tracking-wide text-ink/50">
          <CmsTable.Row>
            <CmsTable.Head class="px-4 py-3 font-bold">Visitor</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-bold">Lead</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-bold">Status</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-bold">Msgs</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-bold">Cost</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 font-bold">Updated</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3"></CmsTable.Head>
          </CmsTable.Row>
        </CmsTable.Header>
        <CmsTable.Body class="divide-y divide-ink/[0.06]">
          {#each filtered as c (c.id)}
            <CmsTable.Row class="transition hover:bg-sand/30">
              <CmsTable.Cell class="px-4 py-3">
                <a class="font-semibold text-ink hover:text-forest" href={`/admin/ai-conversations/${c.id}`}>{c.visitor_name || 'Anonymous visitor'}</a>
                <p class="text-xs text-ink/45">{c.visitor_email || c.source_page || '—'}{c.language && c.language !== 'en' ? ` · ${c.language.toUpperCase()}` : ''}</p>
              </CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3">
                <span class="inline-flex items-center gap-1.5">
                  <StatusBadge status={c.lead_status || 'cold'} />
                  <span class="text-xs font-semibold text-ink/50">{c.lead_score ?? 0}</span>
                </span>
                {#if c.handoff_required}<span class="ml-1 rounded bg-goldfinch-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-clay">Handoff</span>{/if}
              </CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3"><StatusBadge status={c.status || 'in_progress'} />{#if c.booking_request_id}<span class="ml-1 text-[10px] font-bold text-forest">• booked</span>{/if}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3 text-ink/70">{c.ai_message_count ?? 0}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3 text-ink/70">{money(c.total_estimated_cost_usd)}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3 text-xs text-ink/55">{fmt(c.updated_at || c.created_at)}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3 text-right">
                <a class="inline-flex items-center gap-1 text-xs font-bold text-forest hover:text-heading" href={`/admin/ai-conversations/${c.id}`}>Open <ArrowRight size={13} /></a>
              </CmsTable.Cell>
            </CmsTable.Row>
          {/each}
        </CmsTable.Body>
      </CmsTable.Root>
    </div>
  {/if}
</section>
