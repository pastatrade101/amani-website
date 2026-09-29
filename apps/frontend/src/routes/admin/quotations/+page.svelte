<script lang="ts">
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsTable from '$lib/components/ui/table';
  import { Button as CmsButton } from '$lib/components/ui/button';

  /**
   * Quotations — the desk an agent works from while they are quoting.
   *
   * Everything here is about one question: where has each offer got to? So the
   * list shows the real state (including 'viewed', which the traveller never
   * sees) and the actions are the four things an agent does with an offer —
   * revise it, send it, hand over the link, or retire it.
   */
  import { onDestroy, onMount } from 'svelte';
  import { page } from '$app/stores';
  import { Edit, ExternalLink, FileText, History, Link as LinkIcon, MessageCircle, Plus, Search, Trash2 } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import { quotationMoney, quotationStatusChip, quotationStatusLabel, quotationStatusMeta } from '$lib/admin/quotations';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminQuotationEditor from '$lib/admin/components/admin/AdminQuotationEditor.svelte';
  import AdminQuotationThread from '$lib/admin/components/admin/AdminQuotationThread.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import ConfirmModal from '$lib/admin/components/admin/ConfirmModal.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';
  import type { Tour } from '$lib/admin/types';

  type Option = { label: string; value: string };
  type Toast = { id: string; message: string; type: 'error' | 'success' };
  type SendOutcome = { detail?: string; status?: string };
  type Quotation = Record<string, unknown> & {
    adults: number;
    children: number;
    currency: string;
    customer_name: null | string;
    customer_phone: null | string;
    id: string;
    // The enquiry this quotation answers, when it was raised from one.
    lead: { booking_code: string; full_name: null | string } | null;
    public_url: string;
    quote_code: string;
    sent_at: null | string;
    status: string;
    title: string;
    total_amount: number;
    tour: { slug: string; title: string } | null;
    travel_date: null | string;
  };

  // Empty rather than 'all': the endpoint filters on any non-empty status it is
  // given, so the sentinel other admin pages use would match nothing here.
  const statusOptions: Option[] = [
    { label: 'All statuses', value: '' },
    ...Object.entries(quotationStatusMeta).map(([value, meta]) => ({ value, label: meta.label }))
  ];

  const iconButton =
    'grid h-9 w-9 place-items-center rounded-xl border border-ink/10 bg-surface text-ink/70 shadow-sm transition hover:border-goldfinch-gold/35 hover:bg-sand/70 disabled:pointer-events-none disabled:opacity-45';

  let rows: Quotation[] = [];
  let tours: Tour[] = [];

  let loading = true;
  let busy = false;
  let error = '';

  let search = '';
  let statusFilter = '';
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  let editorOpen = false;
  let editing: null | Quotation = null;
  let prefill: Record<string, string> = {};

  let sendingId = '';
  let confirmOpen = false;
  let toDelete: null | Quotation = null;
  let toasts: Toast[] = [];

  // Longer than the usual toast: a skipped send explains itself in a sentence
  // the agent has to actually read before they decide what to do instead.
  const showToast = (message: string, type: Toast['type'] = 'success', ms = 4000) => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); }, ms);
  };
  const dismissToast = (e: CustomEvent<string>) => { toasts = toasts.filter((t) => t.id !== e.detail); };

  const fmtDate = (value: unknown) =>
    value ? new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(String(value))) : '';

  const travellerCount = (row: Quotation) => Number(row.adults ?? 0) + Number(row.children ?? 0);

  $: filtered = Boolean(search.trim()) || statusFilter !== '';
  $: awaitingReply = rows.filter((r) => r.status === 'sent' || r.status === 'viewed').length;
  $: accepted = rows.filter((r) => r.status === 'accepted').length;
  $: expired = rows.filter((r) => r.status === 'expired').length;

  /**
   * Sequenced, because the search is debounced rather than cancelled: a slower
   * earlier request must not paint over a faster later one and leave the table
   * showing results for a query the box no longer contains. `listQuotations`
   * runs a lapsed-status sweep before its select, so the first query of a
   * sitting really is the slow one.
   */
  let seq = 0;

  const load = async () => {
    const mine = ++seq;
    busy = true;
    error = '';
    try {
      const res = await api.quotations.list({ search: search.trim(), status: statusFilter, limit: 100 });
      if (mine !== seq) return;
      rows = res.data as Quotation[];
    } catch (err) {
      if (mine !== seq) return;
      error = err instanceof Error ? err.message : 'Unable to load quotations.';
    } finally {
      if (mine === seq) {
        loading = false;
        busy = false;
      }
    }
  };

  const debouncedLoad = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 300);
  };

  const clearFilters = () => {
    search = '';
    statusFilter = '';
    load();
  };

  const openCreate = () => { editing = null; editorOpen = true; };
  const openEdit = (row: Quotation) => { editing = row; editorOpen = true; };
  const closeEditor = () => { editorOpen = false; editing = null; };

  let threadOpen = false;
  let threadRow: null | Quotation = null;
  const openThread = (row: Quotation) => { threadRow = row; threadOpen = true; };

  /**
   * A new revision exists but has not been sent. Go straight into the editor on
   * it — the version was bumped precisely so the figures could be changed, and
   * making the agent find the row again would be a step for nothing.
   */
  const onRevised = (e: CustomEvent<Record<string, unknown>>) => {
    threadOpen = false;
    showToast(`Revision v${e.detail?.revision ?? ''} started — edit it, then send.`);
    load();
    if (e.detail?.id) { editing = e.detail as Quotation; editorOpen = true; }
  };

  const onOverridden = () => {
    threadOpen = false;
    showToast('Status set by hand. The reason is recorded on the quotation.');
    load();
  };

  const onSaved = (e: CustomEvent<{ quotation: Quotation }>) => {
    // Keep the editor pointed at the row it has just written, so a second save
    // in the same sitting revises that quotation instead of raising another one.
    if (e.detail?.quotation) editing = e.detail.quotation;
    prefill = {};
    showToast('Quotation saved.');
    load();
  };

  /**
   * A send has three endings, and only one of them is "the traveller has it".
   * A skip is the ordinary outcome when there is no opt-in or the 24-hour
   * window has closed — the backend deliberately leaves the quotation unsent,
   * so this must never read as confirmation.
   */
  const reportOutcome = (outcome: SendOutcome | undefined) => {
    const detail = outcome?.detail ? String(outcome.detail) : '';
    if (outcome?.status === 'sent') {
      showToast('Sent to the traveller.');
      return;
    }
    if (outcome?.status === 'skipped') {
      showToast(detail ? `Not sent — ${detail}` : 'Not sent. Neither channel would accept this message.', 'error', 8000);
      return;
    }
    showToast(detail ? `Send failed — ${detail}` : 'Send failed.', 'error', 8000);
  };

  /**
   * A send is the end of the job, so the editor comes down and the agent is put
   * back in front of the list — the same thing the inbox does. Whether the send
   * was accepted or skipped is reported in the toast, which outlives the modal.
   */
  const onSent = (e: CustomEvent<{ outcome: SendOutcome }>) => {
    reportOutcome(e.detail?.outcome);
    closeEditor();
    load();
  };

  const send = async (row: Quotation) => {
    if (sendingId) return;
    sendingId = row.id;
    try {
      const res = await api.quotations.send(row.id, row.sent_at ? { resend: true } : {});
      reportOutcome((res.data as { outcome?: SendOutcome })?.outcome);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to send the quotation.', 'error', 8000);
    } finally {
      sendingId = '';
      // Always reload: sent, skipped or refused, the chip must show what the
      // record actually says rather than what was attempted.
      await load();
    }
  };

  const copyLink = async (row: Quotation) => {
    try {
      await navigator.clipboard.writeText(row.public_url);
      showToast('Quotation link copied.');
    } catch {
      // Clipboard blocked (e.g. an insecure context) — show the link so it can
      // still be copied by hand.
      showToast(`Clipboard blocked. The link is: ${row.public_url}`, 'error', 8000);
    }
  };

  const openLink = (row: Quotation) => { window.open(row.public_url, '_blank', 'noopener'); };

  const openDelete = (row: Quotation) => { toDelete = row; confirmOpen = true; };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await api.quotations.remove(toDelete.id);
      showToast('Quotation deleted.');
      confirmOpen = false;
      toDelete = null;
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete the quotation.', 'error');
    }
  };

  onMount(async () => {
    // Handed over from somewhere that already knows who is being quoted — the
    // inbox, or a lead. The conversation and booking a quotation belongs to can
    // only be set as it is created, so the seed has to arrive before the editor.
    const params = $page.url.searchParams;
    const seed: Record<string, string> = {};
    for (const key of ['booking_request_id', 'conversation_id', 'customer_name', 'customer_phone']) {
      const value = params.get(key);
      if (value) seed[key] = value;
    }
    prefill = seed;

    await load();
    try {
      // status: 'all' — the endpoint defaults to published only, and quoting a
      // trip that is not yet live on the site is exactly when an agent quotes
      // by hand. Matches the picker on the bookings page.
      const res = await api.tours.list({ status: 'all', limit: 200 });
      tours = res.data.items;
    } catch {
      // Optional — the editor's tour picker degrades to a quotation with no
      // tour attached, which is a valid quotation.
    }
  });

  onDestroy(() => clearTimeout(searchTimer));
</script>

<ToastStack {toasts} on:dismiss={dismissToast} />

<div class="mx-auto grid w-full max-w-[1500px] gap-6">
  <AdminPageHeader
    eyebrow="Sales"
    title="Quotations"
    description="The priced offer a traveller receives between their enquiry and a booking. Raise one, send it on WhatsApp and by email, and follow it from draft through to accepted."
    actionLabel="New quotation"
    actionIcon={Plus}
    on:action={openCreate}
  />

  <AdminToolbar className="grid gap-3 lg:grid-cols-[1fr_220px] lg:items-end">
    <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
      <span>Search</span>
      <span class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10">
        <Search size={16} class="text-ink/45" />
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink/35" bind:value={search} placeholder="Reference, traveller or trip..." oninput={debouncedLoad} />
      </span>
    </CmsLabel>
    <AdminSelect label="Status" name="status_filter" bind:value={statusFilter} options={statusOptions} on:change={load} />
  </AdminToolbar>

  {#if loading}
    <LoadingState message="Loading quotations..." />
  {:else if error}
    <ErrorState message={error} />
  {:else if rows.length === 0}
    {#if filtered}
      <AdminEmptyState
        title="No quotations match"
        message="Nothing here matches that search and status. Clear them to see every quotation."
        actionLabel="Clear filters"
        icon={FileText}
        on:action={clearFilters}
      />
    {:else}
      <AdminEmptyState
        title="No quotations yet"
        message="Quotations appear here once you raise one for a traveller — a price, what it covers, and a link they can accept from."
        actionLabel="New quotation"
        icon={FileText}
        on:action={openCreate}
      />
    {/if}
  {:else}
    <!-- Counted from the rows on screen, not fetched: with a filter applied
         these describe the filtered list, which is why the first tile says how
         many that is. -->
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {#each [['Showing', rows.length, 'text-ink'], ['Awaiting a reply', awaitingReply, 'text-sky-700'], ['Accepted', accepted, 'text-emerald-600'], ['Expired', expired, 'text-amber-600']] as [label, value, tone]}
        <div class="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
          <p class="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/45">{label}</p>
          <p class={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
        </div>
      {/each}
    </div>

    <!-- Dimmed rather than replaced while a filtered reload is in flight: a
         debounced search that blanks the table on every pause is harder to read
         than one that stays put. -->
    <div class={`overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm transition-opacity ${busy ? 'opacity-60' : ''}`}>
      <div class="overflow-x-auto">
        <CmsTable.Root class="w-full min-w-[1120px] text-sm">
          <CmsTable.Header class="bg-sand/70 text-xs uppercase tracking-[0.08em] text-ink/60">
            <CmsTable.Row>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Reference</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Trip</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Traveller</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Travellers</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Travel date</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-right font-semibold">Total</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-left font-semibold">Status</CmsTable.Head>
              <CmsTable.Head class="px-4 py-3 text-right font-semibold">Actions</CmsTable.Head>
            </CmsTable.Row>
          </CmsTable.Header>
          <CmsTable.Body class="divide-y divide-ink/10">
            {#each rows as row (row.id)}
              <CmsTable.Row class="cursor-pointer transition hover:bg-sand/25" onclick={() => openEdit(row)}>
                <CmsTable.Cell class="px-4 py-3 font-mono text-xs font-bold text-heading">{row.quote_code}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-3">
                  <div class="font-semibold text-ink">{row.title}</div>
                  {#if row.tour?.title && row.tour.title !== row.title}
                    <div class="text-xs text-ink/55">{row.tour.title}</div>
                  {/if}
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-3">
                  {#if row.customer_name}
                    <div class="font-semibold text-ink">{row.customer_name}</div>
                    {#if row.customer_phone}<div class="text-xs text-ink/55">{row.customer_phone}</div>{/if}
                  {:else if row.customer_phone}
                    <div class="text-ink/70">{row.customer_phone}</div>
                  {/if}
                  <!-- Which enquiry this answers, when it was raised from one. -->
                  {#if row.lead?.booking_code}
                    <div class="mt-0.5 font-mono text-[11px] text-ink/45">from {row.lead.booking_code}</div>
                  {/if}
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-3 text-ink/65">
                  {#if travellerCount(row) > 0}{travellerCount(row)}{/if}
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-3 text-ink/65">{fmtDate(row.travel_date)}</CmsTable.Cell>
                <CmsTable.Cell class="whitespace-nowrap px-4 py-3 text-right font-semibold text-ink">{quotationMoney(row.total_amount, row.currency)}</CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-3">
                  <span class={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${quotationStatusChip(row.status)}`}>{quotationStatusLabel(row.status)}</span>
                </CmsTable.Cell>
                <CmsTable.Cell class="px-4 py-3">
                  <div class="flex justify-end gap-1.5" role="presentation" on:click|stopPropagation>
                    <CmsButton variant="ghost" class={iconButton} type="button" aria-label="Copy quotation link" onclick={() => copyLink(row)}><LinkIcon size={15} /></CmsButton>
                    <CmsButton variant="ghost" class={iconButton} type="button" aria-label="Open the traveller's quotation" onclick={() => openLink(row)}><ExternalLink size={15} /></CmsButton>
                    <CmsButton variant="ghost" class={iconButton} type="button" aria-label="Edit quotation" onclick={() => openEdit(row)}><Edit size={15} /></CmsButton>
                    <!-- Badged when the traveller is waiting on us, so the queue
                         is visible from the list rather than only once opened. -->
                    <span class="relative inline-flex">
                      <CmsButton variant="ghost" class={iconButton} type="button" aria-label="History and traveller requests" onclick={() => openThread(row)}
                        ><History size={15} /></CmsButton
                      >
                      {#if row.status === 'changes_requested'}
                        <span class="pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-surface"></span>
                      {/if}
                    </span>
                    <!-- The reason lives on the wrapper: `iconButton` disables
                         pointer events, so a title on the button itself can
                         never be hovered and the agent would see a greyed-out
                         icon with no explanation anywhere on the page. -->
                    <span class="inline-flex" title={row.customer_phone || row.customer_email ? undefined : 'No WhatsApp number or email address on this quotation.'}>
                      <CmsButton variant="ghost"
                        class={iconButton}
                        type="button"
                        aria-label={row.sent_at ? 'Resend to traveller' : 'Send to traveller'}
                        disabled={!row.customer_phone || sendingId === row.id}
                        onclick={() => send(row)}
                      ><MessageCircle size={15} /></CmsButton>
                    </span>
                    <CmsButton variant="ghost" class="grid h-9 w-9 place-items-center rounded-xl border border-red-200 bg-surface text-red-600 shadow-sm transition hover:bg-red-50" type="button" aria-label="Delete quotation" onclick={() => openDelete(row)}><Trash2 size={15} /></CmsButton>
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

<AdminQuotationEditor
  open={editorOpen}
  quotation={editing}
  {prefill}
  {tours}
  on:saved={onSaved}
  on:sent={onSent}
  on:close={closeEditor}
/>

<AdminQuotationThread
  open={threadOpen}
  quotation={threadRow}
  on:close={() => { threadOpen = false; threadRow = null; }}
  on:revised={onRevised}
  on:changed={onOverridden}
/>

<ConfirmModal
  open={confirmOpen}
  title="Delete quotation"
  message={`Delete ${toDelete?.quote_code ?? 'this quotation'}? The traveller's link stops opening immediately. The record is kept for the audit trail.`}
  on:cancel={() => { confirmOpen = false; toDelete = null; }}
  on:confirm={confirmDelete}
/>
