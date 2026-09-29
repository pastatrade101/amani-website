<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Textarea as CmsTextarea } from '$lib/components/ui/textarea';
  import * as CmsSelect from '$lib/components/ui/native-select';

  /**
   * Changes agreed after the quotation was accepted.
   *
   * The accepted quotation is frozen — it says what was agreed and stops
   * changing. Trips still change, so this is where "add a night", "swap the
   * lodge", "one traveller dropped out" live, each keeping its own price effect
   * rather than quietly becoming a new version of the original figure.
   *
   * The revised total is arithmetic shown in the open, not a number written
   * back over the booking: the original has to stay recoverable, and a derived
   * sum cannot drift from the log it came from.
   */
  import { createEventDispatcher } from 'svelte';
  import { Check, Loader2, Plus, Trash2, X } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';

  export let bookingId: string;
  /** Amendments only make sense once there is something agreed to amend. */
  export let bookingStatus = '';

  const dispatch = createEventDispatcher<{ changed: void }>();

  type Amendment = {
    id: string;
    requested_by: 'traveller' | 'admin';
    summary: string;
    detail: string | null;
    amount_delta: string | number | null;
    currency: string;
    status: 'proposed' | 'agreed' | 'declined' | 'applied';
    created_at: string;
    resolved_at: string | null;
  };

  let rows: Amendment[] = [];
  let currency = 'USD';
  let originalAmount: number | null = null;
  let revisedAmount: number | null = null;
  let appliedDelta = 0;

  let loading = false;
  let error = '';
  let busy = '';
  let loadedFor = '';

  let adding = false;
  let summary = '';
  let detail = '';
  let delta = '';
  let requestedBy: 'traveller' | 'admin' = 'traveller';

  $: if (bookingId && loadedFor !== bookingId) {
    loadedFor = bookingId;
    void load();
  }

  const STATUS_META: Record<string, { label: string; chip: string }> = {
    proposed: { label: 'Proposed', chip: 'bg-sky-50 text-sky-700 ring-sky-200/70' },
    agreed: { label: 'Agreed · not yet done', chip: 'bg-amber-50 text-amber-700 ring-amber-200/70' },
    applied: { label: 'Applied', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70' },
    declined: { label: 'Declined', chip: 'bg-slate-100 text-slate-600 ring-slate-200' }
  };

  const money = (amount: unknown, code = currency) =>
    `${code} ${Number(amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  /** Signed, and says so — the sign is the whole point of a delta. */
  const signed = (amount: unknown, code = currency) => {
    const value = Number(amount ?? 0);
    return `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(Math.abs(value), code)}`;
  };

  const fmt = (value: unknown) =>
    value ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(String(value))) : '';

  const load = async () => {
    if (!bookingId) return;
    loading = true;
    error = '';
    try {
      const res = await api.bookings.amendments.list(bookingId);
      rows = (res.data?.amendments ?? []) as Amendment[];
      currency = res.data?.currency ?? 'USD';
      originalAmount = res.data?.original_amount ?? null;
      revisedAmount = res.data?.revised_amount ?? null;
      appliedDelta = res.data?.applied_delta ?? 0;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load the amendments.';
    } finally {
      loading = false;
    }
  };

  const reset = () => {
    adding = false;
    summary = '';
    detail = '';
    delta = '';
    requestedBy = 'traveller';
  };

  const create = async () => {
    if (!summary.trim() || busy) return;
    busy = 'create';
    error = '';
    try {
      await api.bookings.amendments.create(bookingId, {
        summary: summary.trim(),
        detail: detail.trim() || null,
        amount_delta: delta.trim() === '' ? null : delta.trim(),
        requested_by: requestedBy
      });
      reset();
      await load();
      dispatch('changed');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not record the amendment.';
    } finally {
      busy = '';
    }
  };

  const setStatus = async (row: Amendment, status: string) => {
    if (busy) return;
    busy = row.id;
    error = '';
    try {
      await api.bookings.amendments.update(bookingId, row.id, { status });
      await load();
      dispatch('changed');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not update the amendment.';
    } finally {
      busy = '';
    }
  };

  const remove = async (row: Amendment) => {
    if (busy) return;
    busy = row.id;
    error = '';
    try {
      await api.bookings.amendments.remove(bookingId, row.id);
      await load();
      dispatch('changed');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not remove the proposal.';
    } finally {
      busy = '';
    }
  };

  const labelClass = 'text-[11px] font-bold uppercase tracking-[0.16em] text-forest/70';
  const inputClass =
    'h-10 w-full min-w-0 rounded-xl border border-ink/15 bg-surface px-3 text-sm text-heading outline-none transition focus:border-forest';
</script>

<div class="grid gap-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <p class={labelClass}>Amendments</p>
    {#if !adding}
      <CmsButton variant="ghost"
        class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-ink/15 bg-surface px-3 text-xs font-semibold text-heading shadow-sm transition hover:bg-sand"
        type="button"
        onclick={() => (adding = true)}><Plus size={13} /> Record a change</CmsButton
      >
    {/if}
  </div>

  {#if bookingStatus && bookingStatus !== 'confirmed' && bookingStatus !== 'completed'}
    <!-- Says why rather than hiding the section: an agent looking for this
         needs to know it is the booking's state, not a missing feature. -->
    <p class="rounded-xl bg-sand/30 px-3.5 py-2.5 text-xs leading-6 text-ink/60">
      Amendments are for changes agreed after a quotation is accepted. This booking is not confirmed yet — while it is still being
      negotiated, change the quotation itself.
    </p>
  {/if}

  {#if error}
    <p class="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 ring-1 ring-red-100" role="alert">{error}</p>
  {/if}

  {#if adding}
    <div class="grid gap-3 rounded-2xl border border-ink/10 bg-sand/20 p-4">
      <CmsLabel class="grid gap-1.5">
        <span class="text-[13px] font-semibold text-ink/65">What is changing</span>
        <CmsInput class={inputClass} bind:value={summary} placeholder="e.g. Added a third night at Ngorongoro" />
      </CmsLabel>
      <CmsLabel class="grid gap-1.5">
        <span class="text-[13px] font-semibold text-ink/65">Detail <span class="font-normal text-ink/40">optional</span></span>
        <CmsTextarea
          class="w-full rounded-xl border border-ink/15 bg-surface px-3 py-2.5 text-sm leading-6 text-heading outline-none focus:border-forest"
          rows={2}
          bind:value={detail}
          placeholder="Anything worth recording about how this was agreed."
        ></CmsTextarea>
      </CmsLabel>
      <div class="grid gap-3 sm:grid-cols-2">
        <CmsLabel class="grid gap-1.5">
          <span class="text-[13px] font-semibold text-ink/65">
            Price change <span class="font-normal text-ink/40">negative to reduce</span>
          </span>
          <CmsInput class={inputClass} type="number" step="0.01" inputmode="decimal" bind:value={delta} placeholder="Leave blank if not settled" />
        </CmsLabel>
        <CmsLabel class="grid gap-1.5">
          <span class="text-[13px] font-semibold text-ink/65">Asked for by</span>
          <CmsSelect.Root class={inputClass} bind:value={requestedBy}>
            <CmsSelect.Option value="traveller">The traveller</CmsSelect.Option>
            <CmsSelect.Option value="admin">Us</CmsSelect.Option>
          </CmsSelect.Root>
        </CmsLabel>
      </div>
      <div class="flex justify-end gap-2">
        <CmsButton variant="ghost" class="h-9 rounded-xl px-3 text-xs font-semibold text-ink/55 transition hover:text-heading" type="button" onclick={reset}
          >Cancel</CmsButton
        >
        <CmsButton variant="ghost"
          class="inline-flex h-9 items-center rounded-xl bg-forest px-4 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
          type="button"
          disabled={!summary.trim() || busy === 'create'}
          onclick={create}>{busy === 'create' ? 'Saving…' : 'Record'}</CmsButton
        >
      </div>
    </div>
  {/if}

  {#if loading}
    <p class="flex items-center gap-2 px-1 py-3 text-sm text-ink/50"><Loader2 size={15} class="animate-spin" /> Loading…</p>
  {:else if !rows.length}
    {#if !adding}
      <p class="rounded-2xl border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/50">
        Nothing has changed since the quotation was accepted.
      </p>
    {/if}
  {:else}
    <ul class="grid gap-2">
      {#each rows as row (row.id)}
        <li class="rounded-2xl border border-ink/10 bg-surface p-3.5">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-heading">{row.summary}</p>
              <p class="mt-0.5 text-[11px] text-ink/45">
                {row.requested_by === 'traveller' ? 'Asked for by the traveller' : 'Raised by us'} · {fmt(row.created_at)}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              {#if row.amount_delta != null}
                <span
                  class="font-mono text-sm font-bold {Number(row.amount_delta) > 0
                    ? 'text-clay'
                    : Number(row.amount_delta) < 0
                      ? 'text-emerald-700'
                      : 'text-ink/50'}">{signed(row.amount_delta, row.currency)}</span
                >
              {:else}
                <span class="text-[11px] italic text-ink/40">price not settled</span>
              {/if}
              <span class={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${STATUS_META[row.status]?.chip ?? ''}`}
                >{STATUS_META[row.status]?.label ?? row.status}</span
              >
            </div>
          </div>

          {#if row.detail}
            <p class="mt-2 whitespace-pre-line border-t border-ink/[0.07] pt-2 text-sm leading-6 text-ink/70">{row.detail}</p>
          {/if}

          {#if row.status === 'proposed' || row.status === 'agreed'}
            <div class="mt-2.5 flex flex-wrap items-center gap-2 border-t border-ink/[0.07] pt-2.5">
              {#if row.status === 'proposed'}
                <CmsButton variant="ghost"
                  class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-heading px-3 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                  type="button"
                  disabled={busy === row.id}
                  onclick={() => setStatus(row, 'agreed')}><Check size={13} /> Agreed</CmsButton
                >
              {:else}
                <!-- Only from agreed. Applying something nobody agreed to is how
                     an unasked-for change reaches an invoice, and the API
                     refuses it too. -->
                <CmsButton variant="ghost"
                  class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-forest px-3 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                  type="button"
                  disabled={busy === row.id}
                  onclick={() => setStatus(row, 'applied')}><Check size={13} /> Done — apply it</CmsButton
                >
              {/if}
              <CmsButton variant="ghost"
                class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-ink/15 px-3 text-xs font-semibold text-ink/65 transition hover:text-heading disabled:opacity-50"
                type="button"
                disabled={busy === row.id}
                onclick={() => setStatus(row, 'declined')}><X size={13} /> Declined</CmsButton
              >
              {#if row.status === 'proposed'}
                <CmsButton variant="ghost"
                  class="ml-auto inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-ink/40 transition hover:text-red-600 disabled:opacity-50"
                  type="button"
                  disabled={busy === row.id}
                  onclick={() => remove(row)}><Trash2 size={13} /> Remove</CmsButton
                >
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>

    {#if appliedDelta !== 0}
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-2xl bg-sand/40 px-4 py-3">
        <span class="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/45">After applied amendments</span>
        {#if revisedAmount != null}
          <span class="text-sm text-ink/60">
            {money(originalAmount)} <span class="text-ink/35">→</span>
            <span class="font-mono text-base font-bold text-heading">{money(revisedAmount)}</span>
          </span>
        {:else}
          <!-- No figure on the booking to add to, so the sum is shown alone
               rather than implying the trip costs only the difference. -->
          <span class="text-sm text-ink/60">
            <span class="font-mono text-base font-bold text-heading">{signed(appliedDelta)}</span>
            <span class="text-ink/40">· no quoted figure on this booking</span>
          </span>
        {/if}
      </div>
    {/if}
  {/if}
</div>
