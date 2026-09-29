<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsSelect from '$lib/components/ui/native-select';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import * as CmsTable from '$lib/components/ui/table';

  import { onMount } from 'svelte';
  import { ChevronLeft, ChevronRight, Filter, Search, ShieldAlert, X } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';

  type Row = Record<string, any>;

  let rows: Row[] = [];
  let loading = true;
  let error = '';
  let viewing: Row | null = null;

  // filters
  let search = '';
  let action = 'all';
  let entityType = 'all';
  let actorId = 'all';
  let createdFrom = '';
  let createdTo = '';

  // facets + paging
  let entityTypes: string[] = [];
  let actors: Array<{ id: string; name: string }> = [];
  let page = 1;
  const limit = 25;
  let total = 0;
  $: totalPages = Math.max(1, Math.ceil(total / limit));

  const ACTION_META: Record<string, { label: string; cls: string }> = {
    create: { label: 'Create', cls: 'bg-emerald-500/12 text-emerald-600' },
    update: { label: 'Update', cls: 'bg-goldfinch-gold/15 text-heading' },
    delete: { label: 'Delete', cls: 'bg-red-500/12 text-red-600' },
    status_change: { label: 'Status', cls: 'bg-sky-500/12 text-sky-600' },
    assign: { label: 'Assign', cls: 'bg-violet-500/12 text-violet-600' },
    notes_update: { label: 'Notes', cls: 'bg-slate-500/12 text-slate-500' }
  };
  const actionMeta = (a: string) => ACTION_META[a] ?? { label: a || '—', cls: 'bg-ink/8 text-ink/55' };
  const ACTION_OPTIONS = Object.keys(ACTION_META);

  // Noisy / sensitive keys never shown in the diff.
  const SKIP = new Set(['id', 'created_at', 'updated_at', 'deleted_at', 'search_vector', 'embedding', 'tsv', 'password_hash', 'password', 'admin_user_id']);

  const str = (v: unknown) => (v == null ? '' : String(v)).trim();
  const humanize = (t: string) => str(t).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

  const initials = (name: string) =>
    (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

  const actorName = (r: Row) => str(r.admin_users?.full_name) || str(r.admin_users?.email) || 'System';

  const deriveName = (r: Row): string => {
    const s = (r.new_data ?? r.old_data ?? {}) as Row;
    return str(s.title || s.name || s.full_name || s.label || s.question || s.section_key || s.slug || s.booking_code || s.key);
  };

  const diffFields = (r: Row) => {
    const o = (r.old_data ?? {}) as Row;
    const n = (r.new_data ?? {}) as Row;
    const keys = [...new Set([...Object.keys(o || {}), ...Object.keys(n || {})])].filter((k) => !SKIP.has(k));
    const out: Array<{ key: string; old: unknown; new: unknown }> = [];
    for (const k of keys) {
      if (JSON.stringify(o?.[k]) !== JSON.stringify(n?.[k])) out.push({ key: k, old: o?.[k], new: n?.[k] });
    }
    return out;
  };

  const changeSummary = (r: Row) => {
    if (r.action === 'create') return 'Created';
    if (r.action === 'delete') return 'Deleted';
    const n = diffFields(r).length;
    return n ? `${n} field${n === 1 ? '' : 's'} changed` : 'No field changes';
  };

  const preview = (v: unknown): string => {
    if (v == null || v === '') return '—';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s.length > 140 ? `${s.slice(0, 140)}…` : s;
  };

  const fmtWhen = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const relative = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.round(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    return d < 30 ? `${d}d ago` : `${Math.round(d / 30)}mo ago`;
  };

  const load = async () => {
    loading = true;
    error = '';
    const params: Record<string, string | number> = { page, limit };
    if (search.trim()) params.search = search.trim();
    if (action !== 'all') params.action = action;
    if (entityType !== 'all') params.entity_type = entityType;
    if (actorId !== 'all') params.admin_user_id = actorId;
    if (createdFrom) params.created_from = createdFrom;
    if (createdTo) params.created_to = createdTo;
    try {
      const res = await api.auditLogs.list(params);
      rows = res.data.items as Row[];
      total = (res.data.pagination as Row)?.total ?? rows.length;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unable to load audit logs.';
    } finally {
      loading = false;
    }
  };

  const applyFilters = () => { page = 1; void load(); };
  const clearFilters = () => {
    search = ''; action = 'all'; entityType = 'all'; actorId = 'all'; createdFrom = ''; createdTo = '';
    applyFilters();
  };
  const go = (p: number) => { page = Math.min(Math.max(1, p), totalPages); void load(); };

  $: activeFilters = (search.trim() ? 1 : 0) + (action !== 'all' ? 1 : 0) + (entityType !== 'all' ? 1 : 0) + (actorId !== 'all' ? 1 : 0) + (createdFrom ? 1 : 0) + (createdTo ? 1 : 0);

  onMount(async () => {
    try {
      const f = await api.auditLogs.facets();
      entityTypes = f.data.entityTypes ?? [];
      actors = f.data.actors ?? [];
    } catch {
      /* facets optional */
    }
    await load();
  });
</script>

<section class="grid gap-5">
  <p class="text-sm text-ink/60">Track who changed what across content, users, settings, media and bookings — with full before/after detail.</p>

  <!-- filters -->
  <div class="rounded-xl border border-ink/10 bg-surface p-4 shadow-card">
    <div class="flex flex-wrap items-end gap-3">
      <form class="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-ink/12 bg-sand/20 px-3" on:submit|preventDefault={applyFilters}>
        <Search size={16} class="text-ink/40" />
        <CmsInput class="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/40" placeholder="Search action, entity, id…" bind:value={search} />
      </form>
      <CmsSelect.Root class="h-10 rounded-lg border border-ink/12 bg-surface px-3 text-sm" bind:value={action} onchange={applyFilters}>
        <CmsSelect.Option value="all">All actions</CmsSelect.Option>
        {#each ACTION_OPTIONS as a}<CmsSelect.Option value={a}>{actionMeta(a).label}</CmsSelect.Option>{/each}
      </CmsSelect.Root>
      <CmsSelect.Root class="h-10 max-w-[180px] rounded-lg border border-ink/12 bg-surface px-3 text-sm" bind:value={entityType} onchange={applyFilters}>
        <CmsSelect.Option value="all">All entities</CmsSelect.Option>
        {#each entityTypes as e}<CmsSelect.Option value={e}>{humanize(e)}</CmsSelect.Option>{/each}
      </CmsSelect.Root>
      <CmsSelect.Root class="h-10 max-w-[180px] rounded-lg border border-ink/12 bg-surface px-3 text-sm" bind:value={actorId} onchange={applyFilters}>
        <CmsSelect.Option value="all">All users</CmsSelect.Option>
        {#each actors as a}<CmsSelect.Option value={a.id}>{a.name}</CmsSelect.Option>{/each}
      </CmsSelect.Root>
      <CmsInput type="date" class="h-10 rounded-lg border border-ink/12 bg-surface px-3 text-sm" bind:value={createdFrom} onchange={applyFilters} aria-label="From date" />
      <CmsInput type="date" class="h-10 rounded-lg border border-ink/12 bg-surface px-3 text-sm" bind:value={createdTo} onchange={applyFilters} aria-label="To date" />
      {#if activeFilters}
        <CmsButton variant="ghost" class="inline-flex h-10 items-center gap-1.5 rounded-lg border border-ink/12 px-3 text-sm font-semibold text-ink/65 transition hover:border-goldfinch-gold/40" type="button" onclick={clearFilters}>
          <Filter size={14} /> Clear ({activeFilters})
        </CmsButton>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="grid gap-2">{#each Array(8) as _}<div class="h-14 animate-pulse rounded-lg border border-ink/10 bg-surface/70"></div>{/each}</div>
  {:else if error}
    <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
  {:else if !rows.length}
    <div class="grid place-items-center gap-2 rounded-xl border border-dashed border-ink/15 bg-surface py-16 text-center">
      <ShieldAlert size={26} class="text-ink/30" />
      <p class="text-sm font-semibold text-ink/70">No audit entries match these filters.</p>
    </div>
  {:else}
    <div class="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-card">
      <CmsTable.Root class="w-full text-left text-sm">
        <CmsTable.Header class="border-b border-ink/10 text-[11px] font-bold uppercase tracking-[0.12em] text-ink/45">
          <CmsTable.Row>
            <CmsTable.Head class="px-4 py-3">User</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3">Action</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3">Entity</CmsTable.Head>
            <CmsTable.Head class="hidden px-4 py-3 md:table-cell">Change</CmsTable.Head>
            <CmsTable.Head class="px-4 py-3 text-right">When</CmsTable.Head>
          </CmsTable.Row>
        </CmsTable.Header>
        <CmsTable.Body>
          {#each rows as r (r.id)}
            <CmsTable.Row class="cursor-pointer border-b border-ink/5 transition hover:bg-sand/40" onclick={() => (viewing = r)}>
              <CmsTable.Cell class="px-4 py-3">
                <div class="flex items-center gap-2.5">
                  <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest/10 text-[11px] font-bold text-forest dark:text-goldfinch-gold">{initials(actorName(r))}</span>
                  <span class="min-w-0">
                    <span class="block truncate font-semibold text-ink">{actorName(r)}</span>
                    {#if r.admin_users?.role}<span class="block text-[11px] capitalize text-ink/45">{str(r.admin_users.role).replace(/_/g, ' ')}</span>{/if}
                  </span>
                </div>
              </CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3">
                <span class={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${actionMeta(r.action).cls}`}>{actionMeta(r.action).label}</span>
              </CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3">
                <span class="block font-semibold text-ink">{humanize(r.entity_type)}</span>
                {#if deriveName(r)}<span class="block truncate text-xs text-ink/55">{deriveName(r)}</span>{/if}
              </CmsTable.Cell>
              <CmsTable.Cell class="hidden px-4 py-3 text-ink/60 md:table-cell">{changeSummary(r)}</CmsTable.Cell>
              <CmsTable.Cell class="px-4 py-3 text-right">
                <span class="block text-ink/70">{relative(r.created_at)}</span>
                <span class="block text-[11px] text-ink/40">{fmtWhen(r.created_at)}</span>
              </CmsTable.Cell>
            </CmsTable.Row>
          {/each}
        </CmsTable.Body>
      </CmsTable.Root>
    </div>

    <!-- pagination -->
    <div class="flex items-center justify-between text-sm text-ink/55">
      <span>Page {page} of {totalPages} · {total} entries</span>
      <div class="flex gap-2">
        <CmsButton variant="ghost" class="grid h-9 w-9 place-items-center rounded-lg border border-ink/12 bg-surface transition hover:border-goldfinch-gold/40 disabled:opacity-40" type="button" disabled={page <= 1} onclick={() => go(page - 1)}><ChevronLeft size={16} /></CmsButton>
        <CmsButton variant="ghost" class="grid h-9 w-9 place-items-center rounded-lg border border-ink/12 bg-surface transition hover:border-goldfinch-gold/40 disabled:opacity-40" type="button" disabled={page >= totalPages} onclick={() => go(page + 1)}><ChevronRight size={16} /></CmsButton>
      </div>
    </div>
  {/if}
</section>

<!-- detail drawer -->
{#if viewing}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (() => (viewing = null))(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),36rem);max-width:none">
      <CmsDialog.Title class="sr-only">audit logs editor</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <div class="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-surface shadow-2xl">
      <div class="flex items-start justify-between gap-3 border-b border-ink/10 p-5">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${actionMeta(viewing.action).cls}`}>{actionMeta(viewing.action).label}</span>
            <span class="font-bold text-ink">{humanize(viewing.entity_type)}</span>
          </div>
          {#if deriveName(viewing)}<p class="mt-1 truncate text-sm text-ink/60">{deriveName(viewing)}</p>{/if}
        </div>
        <CmsButton variant="ghost" class="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink/10 text-ink transition hover:bg-sand" type="button" aria-label="Close" onclick={() => (viewing = null)}><X size={18} /></CmsButton>
      </div>

      <div class="grid gap-5 overflow-y-auto p-5" data-lenis-prevent>
        <div class="grid gap-2 rounded-xl border border-ink/10 bg-sand/20 p-4 text-sm sm:grid-cols-2">
          <div><span class="text-ink/45">User</span><p class="font-semibold text-ink">{actorName(viewing)}</p></div>
          <div><span class="text-ink/45">Role</span><p class="font-semibold capitalize text-ink">{str(viewing.admin_users?.role).replace(/_/g, ' ') || '—'}</p></div>
          <div><span class="text-ink/45">When</span><p class="font-semibold text-ink">{fmtWhen(viewing.created_at)}</p></div>
          <div><span class="text-ink/45">IP</span><p class="font-semibold text-ink">{viewing.ip_address || '—'}</p></div>
          <div class="sm:col-span-2"><span class="text-ink/45">Entity ID</span><p class="truncate font-mono text-xs text-ink/70">{viewing.entity_id || '—'}</p></div>
        </div>

        <div>
          <p class="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70">
            {viewing.action === 'create' ? 'Created with' : viewing.action === 'delete' ? 'Removed record' : 'Changes'}
          </p>
          {#if viewing.action === 'delete' && !viewing.old_data}
            <p class="rounded-xl border border-ink/10 bg-sand/15 p-3 text-sm text-ink/55">Record deleted. No snapshot stored.</p>
          {:else}
            {@const changes = diffFields(viewing)}
            {#if !changes.length}
              <p class="rounded-xl border border-ink/10 bg-sand/15 p-3 text-sm text-ink/55">No field-level changes recorded.</p>
            {:else}
              <div class="grid gap-2">
                {#each changes as c}
                  <div class="rounded-xl border border-ink/10 bg-sand/15 p-3">
                    <p class="text-xs font-bold text-ink/70">{humanize(c.key)}</p>
                    <div class="mt-1.5 grid gap-1 text-xs">
                      {#if viewing.action !== 'create'}
                        <p class="flex gap-2"><span class="shrink-0 font-semibold text-red-500/80">−</span><span class="whitespace-pre-wrap break-words text-ink/55 line-through decoration-ink/20">{preview(c.old)}</span></p>
                      {/if}
                      <p class="flex gap-2"><span class="shrink-0 font-semibold text-emerald-600">+</span><span class="whitespace-pre-wrap break-words text-ink/80">{preview(c.new)}</span></p>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          {/if}
        </div>
      </div>
    </div>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}
