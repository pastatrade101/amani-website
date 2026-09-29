<script lang="ts">
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsTable from '$lib/components/ui/table';

  /**
   * The money that has actually arrived.
   *
   * The previous version listed an amount, a currency and a reference — and
   * dropped the one thing that makes a payment mean anything, which is who it
   * was from. The API has always returned the booking on every row; the table
   * simply threw it away, so a page of "1680 USD bank_transfer" told you a
   * payment existed and nothing else.
   *
   * Reading order is deliberate: who paid, how much, against what, when. The
   * reference and provider come last because they are what you check a
   * statement against, not what you scan a list for.
   */
  import { onMount } from 'svelte';
  import { ArrowDownLeft, ArrowUpRight, Plus, Receipt, Search, Wallet } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminEmptyState from '$lib/admin/components/admin/AdminEmptyState.svelte';
  import AdminPageHeader from '$lib/admin/components/admin/AdminPageHeader.svelte';
  import AdminPaymentRecorder from '$lib/admin/components/admin/AdminPaymentRecorder.svelte';
  import AdminSelect from '$lib/admin/components/admin/AdminSelect.svelte';
  import AdminToolbar from '$lib/admin/components/admin/AdminToolbar.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import ErrorState from '$lib/admin/components/public/ErrorState.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';

  let recording = false;
  let toasts: Array<{ id: string; message: string; type: 'success' | 'error' }> = [];
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => (toasts = toasts.filter((t) => t.id !== id)), 3500);
  };

  type Booking = { booking_code?: string; full_name?: string; email?: string; status?: string };
  type Payment = {
    id: string;
    amount: string | number;
    currency: string;
    payment_method: string | null;
    payment_provider: string | null;
    transaction_reference: string | null;
    status: string;
    paid_at: string | null;
    created_at: string;
    notes: string | null;
    booking_requests?: Booking | null;
  };

  let rows: Payment[] = [];
  let loading = true;
  let error = '';

  let search = '';
  let statusFilter = 'all';

  const statusMeta: Record<string, { label: string; chip: string; tone: string; accent: string }> = {
    paid: { label: 'Paid', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70', tone: 'text-emerald-600', accent: 'bg-emerald-500' },
    partially_paid: { label: 'Partial', chip: 'bg-amber-50 text-amber-700 ring-amber-200/70', tone: 'text-amber-600', accent: 'bg-amber-400' },
    unpaid: { label: 'Unpaid', chip: 'bg-slate-100 text-slate-600 ring-slate-200', tone: 'text-slate-500', accent: 'bg-slate-400' },
    refunded: { label: 'Refunded', chip: 'bg-sky-50 text-sky-700 ring-sky-200/70', tone: 'text-sky-600', accent: 'bg-sky-400' },
    failed: { label: 'Failed', chip: 'bg-red-50 text-red-600 ring-red-200/70', tone: 'text-red-500', accent: 'bg-red-400' }
  };

  const statusOptions = [
    { label: 'All statuses', value: 'all' },
    ...Object.entries(statusMeta).map(([value, m]) => ({ value, label: m.label }))
  ];

  const load = async () => {
    loading = true;
    error = '';
    try {
      const response = await api.payments.list({ limit: 100 });
      rows = (response.data.items ?? []) as Payment[];
    } catch (requestError) {
      error = requestError instanceof Error ? requestError.message : 'Unable to load payments.';
    } finally {
      loading = false;
    }
  };

  onMount(load);

  const money = (amount: unknown, currency: unknown = 'USD') =>
    `${String(currency ?? 'USD')} ${Number(amount ?? 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

  const day = (value: unknown) =>
    value
      ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(String(value)))
      : '';

  /**
   * Names that a generic title-case gets wrong. Mostly the ones that matter
   * here: "Mpesa" is not how anyone in Tanzania writes M-Pesa, and a finance
   * screen that misspells the payment method most of its customers use does
   * not look like it was built for them.
   */
  const DISPLAY_NAMES: Record<string, string> = {
    mpesa: 'M-Pesa',
    m_pesa: 'M-Pesa',
    tigopesa: 'Tigo Pesa',
    airtelmoney: 'Airtel Money',
    halopesa: 'HaloPesa',
    makutano_connect: 'Makutano Connect'
  };

  /** Underscored provider keys are storage, not language. */
  const pretty = (value: unknown) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
    return (
      DISPLAY_NAMES[key] ??
      DISPLAY_NAMES[key.replace(/_/g, '')] ??
      raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    );
  };

  $: filtered = rows.filter((row) => {
    if (statusFilter !== 'all' && row.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [
      row.transaction_reference,
      row.payment_method,
      row.payment_provider,
      row.booking_requests?.booking_code,
      row.booking_requests?.full_name,
      row.booking_requests?.email
    ]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(q));
  });

  /**
   * Totals are summed per currency rather than added together. Two payments in
   * different currencies have no meaningful sum, and printing one would invent
   * a number nobody can reconcile against a bank statement.
   */
  $: totals = filtered.reduce<Record<string, { in: number; out: number }>>((acc, row) => {
    const code = String(row.currency ?? 'USD');
    acc[code] ??= { in: 0, out: 0 };
    if (row.status === 'paid') acc[code].in += Number(row.amount ?? 0);
    if (row.status === 'refunded') acc[code].out += Number(row.amount ?? 0);
    return acc;
  }, {});

  $: currencies = Object.keys(totals).sort();
  $: counts = {
    all: filtered.length,
    paid: filtered.filter((r) => r.status === 'paid').length,
    refunded: filtered.filter((r) => r.status === 'refunded').length,
    failed: filtered.filter((r) => r.status === 'failed').length
  };
</script>

<div class="grid gap-4">
  <AdminPageHeader
    eyebrow="Finance"
    title="Payments"
    description="Every payment recorded against a booking — deposits, balances and refunds. Recording one here moves that booking's payment status."
    actionLabel="Record payment"
    actionIcon={Plus}
    on:action={() => (recording = true)}
  />

  {#if loading}
    <LoadingState message="Loading payments..." />
  {:else if error}
    <ErrorState message={error} />
  {:else}
    <!--
      Received leads, because it is the figure anyone opening this page came
      for. Split by currency: a combined total across currencies would be a
      number that reconciles against nothing.
    -->
    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {#each currencies as code}
        <div class="flex items-center gap-2.5 overflow-hidden rounded-xl border border-ink/10 bg-surface px-3 py-2.5 shadow-sm">
          <span class="h-8 w-1 shrink-0 rounded-full bg-emerald-500"></span>
          <span class="min-w-0">
            <span class="block text-xl font-extrabold leading-none text-emerald-600">{money(totals[code].in, code)}</span>
            <span class="mt-0.5 block truncate text-[11px] font-semibold text-ink/50">Received</span>
          </span>
        </div>
        {#if totals[code].out > 0}
          <div class="flex items-center gap-2.5 overflow-hidden rounded-xl border border-ink/10 bg-surface px-3 py-2.5 shadow-sm">
            <span class="h-8 w-1 shrink-0 rounded-full bg-sky-400"></span>
            <span class="min-w-0">
              <span class="block text-xl font-extrabold leading-none text-sky-600">{money(totals[code].out, code)}</span>
              <span class="mt-0.5 block truncate text-[11px] font-semibold text-ink/50">Refunded</span>
            </span>
          </div>
        {/if}
      {/each}
      <div class="flex items-center gap-2.5 overflow-hidden rounded-xl border border-ink/10 bg-surface px-3 py-2.5 shadow-sm">
        <span class="h-8 w-1 shrink-0 rounded-full bg-ink/25"></span>
        <span class="min-w-0">
          <span class="block text-xl font-extrabold leading-none text-ink">{counts.all}</span>
          <span class="mt-0.5 block truncate text-[11px] font-semibold text-ink/50">
            {counts.all === 1 ? 'Payment' : 'Payments'}{counts.failed ? ` · ${counts.failed} failed` : ''}
          </span>
        </span>
      </div>
    </div>

    <AdminToolbar>
      <div class="grid gap-3 lg:grid-cols-[1fr_200px] lg:items-end">
        <CmsLabel class="grid gap-2 text-sm font-medium text-ink">
          <span>Search</span>
          <span
            class="flex h-11 items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3 shadow-sm transition focus-within:border-forest/45 focus-within:ring-2 focus-within:ring-forest/10"
          >
            <Search size={16} class="shrink-0 text-ink/40" />
            <CmsInput
              class="h-full w-full bg-transparent text-sm outline-none placeholder:text-ink/40"
              type="search"
              bind:value={search}
              placeholder="Reference, method, booking code, traveller…"
            />
          </span>
        </CmsLabel>
        <AdminSelect label="Status" name="payment_status_filter" bind:value={statusFilter} options={statusOptions} />
      </div>
    </AdminToolbar>

    {#if !filtered.length}
      <AdminEmptyState
        icon={Wallet}
        title={rows.length ? 'Nothing matches those filters' : 'No payments recorded yet'}
        message={rows.length
          ? 'Clear the search or choose a different status.'
          : 'Payments appear here once one is recorded against a booking — from the booking’s own payment panel, or automatically when a provider reports one.'}
      />
    {:else}
      <div class="overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-sm">
        <div class="overflow-x-auto">
          <CmsTable.Root class="w-full min-w-[880px] text-left text-sm">
            <CmsTable.Header class="bg-sand/30 text-[11px] uppercase tracking-[0.12em] text-ink/50">
              <CmsTable.Row>
                <CmsTable.Head class="px-4 py-3 font-bold">Traveller</CmsTable.Head>
                <CmsTable.Head class="px-4 py-3 text-right font-bold">Amount</CmsTable.Head>
                <CmsTable.Head class="px-4 py-3 font-bold">Status</CmsTable.Head>
                <CmsTable.Head class="px-4 py-3 font-bold">Method</CmsTable.Head>
                <CmsTable.Head class="px-4 py-3 font-bold">Paid</CmsTable.Head>
                <CmsTable.Head class="px-4 py-3 font-bold">Reference</CmsTable.Head>
              </CmsTable.Row>
            </CmsTable.Header>
            <CmsTable.Body class="divide-y divide-ink/[0.07]">
              {#each filtered as row (row.id)}
                {@const meta = statusMeta[row.status] ?? { label: row.status, chip: 'bg-sand text-ink ring-ink/10' }}
                {@const refund = row.status === 'refunded'}
                <CmsTable.Row class="transition hover:bg-sand/20">
                  <CmsTable.Cell class="px-4 py-3">
                    <!-- The join the old table dropped. A payment nobody can
                         attribute is an accounting question, not a record. -->
                    {#if row.booking_requests?.full_name}
                      <div class="font-semibold text-heading">{row.booking_requests.full_name}</div>
                      <div class="font-mono text-[11px] text-ink/45">{row.booking_requests.booking_code ?? ''}</div>
                    {:else}
                      <span class="text-sm italic text-ink/40">Unattached</span>
                    {/if}
                  </CmsTable.Cell>
                  <CmsTable.Cell class="whitespace-nowrap px-4 py-3 text-right">
                    <span class="inline-flex items-center gap-1.5 font-bold tabular-nums {refund ? 'text-sky-600' : 'text-heading'}">
                      {#if refund}<ArrowUpRight size={13} />{:else}<ArrowDownLeft size={13} class="text-emerald-600" />{/if}
                      {money(row.amount, row.currency)}
                    </span>
                  </CmsTable.Cell>
                  <CmsTable.Cell class="px-4 py-3">
                    <span class={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${meta.chip}`}>{meta.label}</span>
                  </CmsTable.Cell>
                  <CmsTable.Cell class="px-4 py-3 text-ink/70">
                    {pretty(row.payment_method) || '—'}
                    {#if row.payment_provider}
                      <div class="text-[11px] text-ink/40">{pretty(row.payment_provider)}</div>
                    {/if}
                  </CmsTable.Cell>
                  <CmsTable.Cell class="whitespace-nowrap px-4 py-3 text-ink/65">{day(row.paid_at) || day(row.created_at)}</CmsTable.Cell>
                  <CmsTable.Cell class="px-4 py-3">
                    {#if row.transaction_reference}
                      <span class="font-mono text-xs text-ink/70">{row.transaction_reference}</span>
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

      <p class="flex items-center gap-1.5 px-1 text-xs text-ink/45">
        <Receipt size={13} />
        Recorded here or reported by a provider. A booking's status follows from these — it is never set by hand.
      </p>
    {/if}
  {/if}
</div>

<AdminPaymentRecorder
  open={recording}
  on:close={() => (recording = false)}
  on:saved={async () => {
    recording = false;
    showToast('Payment recorded. The booking’s status has been updated.');
    await load();
  }}
/>

<ToastStack {toasts} on:dismiss={(e) => (toasts = toasts.filter((t) => t.id !== e.detail))} />
