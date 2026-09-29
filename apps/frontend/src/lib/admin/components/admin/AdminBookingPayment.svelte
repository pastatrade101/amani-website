<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import * as CmsSelect from '$lib/components/ui/native-select';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Textarea as CmsTextarea } from '$lib/components/ui/textarea';

  /**
   * What a confirmed booking still owes, and asking for it.
   *
   * The step between "the price is agreed" and "the money arrived" used to
   * happen by hand in WhatsApp, invisible to everyone else — so a traveller who
   * had never been asked looked exactly like one who had been asked three
   * times. This shows the position and sends the ask through the same outbox as
   * every other message.
   *
   * Nothing here takes money. Recording says money already arrived — by
   * M-Pesa, by bank transfer, in cash — and the booking's payment status is
   * derived from what is recorded, never set by hand.
   */
  import { createEventDispatcher } from 'svelte';
  import { BadgeCheck, Loader2, Plus, Send, Wallet, X } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import AdminPaymentRecorder from './AdminPaymentRecorder.svelte';

  export let bookingId: string;
  export let bookingStatus = '';
  /** Shown in the recorder so it names the booking it is writing against. */
  export let bookingLabel = '';

  const dispatch = createEventDispatcher<{ sent: string; recorded: void }>();

  /** The dialog that records money as having arrived. */
  let recording = false;

  type Req = {
    id: string;
    kind: 'deposit' | 'balance' | 'full';
    amount: string | number;
    currency: string;
    due_date: string | null;
    status: 'sent' | 'cancelled';
    sent_via: string | null;
    sent_at: string;
    claimed_paid_at: string | null;
  };

  let currency = 'USD';
  let total: number | null = null;
  let paid = 0;
  let outstanding: number | null = null;
  let suggestedDeposit: number | null = null;
  let terms: string | null = null;
  let requests: Req[] = [];

  let loading = false;
  let error = '';
  let busy = '';
  let loadedFor = '';

  let composing = false;
  let kind: 'deposit' | 'balance' | 'full' = 'deposit';
  /** Number input: Svelte binds a number, so never call .trim() on it. */
  let amount: string | number | null = '';
  let dueDate = '';
  let instructions = '';

  $: if (bookingId && loadedFor !== bookingId) {
    loadedFor = bookingId;
    void load();
  }

  $: confirmed = bookingStatus === 'confirmed' || bookingStatus === 'completed';
  $: hasAmount = String(amount ?? '').trim() !== '' && Number(amount) > 0;

  const money = (value: unknown, code = currency) =>
    `${code} ${Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const day = (value: unknown) =>
    value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(String(value))) : '';

  const load = async () => {
    if (!bookingId) return;
    loading = true;
    error = '';
    try {
      const res = await api.bookings.payment.position(bookingId);
      currency = res.data?.currency ?? 'USD';
      total = res.data?.total ?? null;
      paid = res.data?.paid ?? 0;
      outstanding = res.data?.outstanding ?? null;
      suggestedDeposit = res.data?.suggested_deposit ?? null;
      terms = res.data?.terms ?? null;
      requests = ((res.data?.requests ?? []) as Req[]) ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load the payment position.';
    } finally {
      loading = false;
    }
  };

  /** Seed the amount from whatever the chosen kind sensibly means. */
  const seedAmount = () => {
    if (kind === 'deposit' && suggestedDeposit) amount = String(suggestedDeposit);
    else if (outstanding != null) amount = String(outstanding);
    else amount = '';
  };

  const open = () => {
    composing = true;
    kind = suggestedDeposit && paid === 0 ? 'deposit' : 'balance';
    instructions = terms ?? '';
    seedAmount();
  };

  const send = async () => {
    if (busy || !hasAmount) return;
    busy = 'send';
    error = '';
    try {
      const res = await api.bookings.payment.request(bookingId, {
        kind,
        amount: String(amount ?? '').trim(),
        due_date: dueDate || null,
        instructions: instructions.trim() || null
      });
      composing = false;
      dueDate = '';
      await load();
      dispatch('sent', String((res.data as Record<string, unknown>)?.sent_via ?? ''));
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not send the request.';
    } finally {
      busy = '';
    }
  };

  const cancel = async (row: Req) => {
    if (busy) return;
    busy = row.id;
    try {
      await api.bookings.payment.cancelRequest(bookingId, row.id);
      await load();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not cancel the request.';
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
    <p class={labelClass}><Wallet size={12} class="mr-1 inline" /> Payment</p>
    {#if !composing}
      <div class="flex flex-wrap items-center gap-2">
        <!-- Recording comes first: money arrives more often than it is chased,
             and this is the action that actually moves the booking. -->
        <CmsButton variant="ghost"
          class="inline-flex h-8 items-center gap-1.5 rounded-xl bg-forest px-3 text-xs font-bold text-white shadow-sm transition hover:brightness-110"
          type="button"
          onclick={() => (recording = true)}><Plus size={13} /> Record payment</CmsButton
        >
        {#if confirmed}
          <CmsButton variant="ghost"
            class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-ink/15 bg-surface px-3 text-xs font-semibold text-heading shadow-sm transition hover:bg-sand"
            type="button"
            onclick={open}><Send size={13} /> Request payment</CmsButton
          >
        {/if}
      </div>
    {/if}
  </div>

  {#if !confirmed}
    <p class="rounded-xl bg-sand/30 px-3.5 py-2.5 text-xs leading-6 text-ink/60">
      Payment is requested once the booking is confirmed. Until then the price is still being agreed on the quotation.
    </p>
  {/if}

  {#if error}
    <p class="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 ring-1 ring-red-100" role="alert">{error}</p>
  {/if}

  {#if loading}
    <p class="flex items-center gap-2 px-1 py-2 text-sm text-ink/50"><Loader2 size={15} class="animate-spin" /> Loading…</p>
  {:else}
    <!-- The position, before any action. Three figures an agent needs before
         deciding what to ask for. -->
    <div class="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 text-center">
      <div class="bg-surface px-3 py-2.5">
        <p class="text-[10px] font-bold uppercase tracking-[0.1em] text-ink/45">Trip total</p>
        <p class="mt-0.5 text-sm font-bold text-ink">{total == null ? '—' : money(total)}</p>
      </div>
      <div class="bg-surface px-3 py-2.5">
        <p class="text-[10px] font-bold uppercase tracking-[0.1em] text-ink/45">Received</p>
        <p class="mt-0.5 text-sm font-bold text-emerald-600">{money(paid)}</p>
      </div>
      <div class="bg-surface px-3 py-2.5">
        <p class="text-[10px] font-bold uppercase tracking-[0.1em] text-ink/45">Outstanding</p>
        <p class="mt-0.5 text-sm font-bold text-clay">{outstanding == null ? '—' : money(outstanding)}</p>
      </div>
    </div>

    {#if total == null}
      <!-- Without a price nothing can be asked for, and the reason is not
           obvious from a dash in a box. -->
      <p class="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs leading-6 text-amber-800 ring-1 ring-amber-200/60">
        This booking has no price on it, so there is nothing to ask for. It comes across automatically when a quotation is accepted —
        add an estimated amount on the booking if this one was created by hand.
      </p>
    {/if}

    {#if composing}
      <div class="grid gap-3 rounded-2xl border border-ink/10 bg-sand/20 p-4">
        <div class="grid gap-3 sm:grid-cols-[1fr_1fr]">
          <CmsLabel class="grid gap-1.5">
            <span class="text-[13px] font-semibold text-ink/65">What for</span>
            <CmsSelect.Root class={inputClass} bind:value={kind} onchange={seedAmount}>
              <CmsSelect.Option value="deposit">Deposit</CmsSelect.Option>
              <CmsSelect.Option value="balance">Balance</CmsSelect.Option>
              <CmsSelect.Option value="full">Full amount</CmsSelect.Option>
            </CmsSelect.Root>
          </CmsLabel>
          <CmsLabel class="grid gap-1.5">
            <span class="text-[13px] font-semibold text-ink/65">Amount ({currency})</span>
            <CmsInput class={inputClass} type="number" step="0.01" min="0" inputmode="decimal" bind:value={amount} />
          </CmsLabel>
        </div>
        <CmsLabel class="grid gap-1.5">
          <span class="text-[13px] font-semibold text-ink/65">Due by <span class="font-normal text-ink/40">optional</span></span>
          <CmsInput class={inputClass} type="date" bind:value={dueDate} />
        </CmsLabel>
        <CmsLabel class="grid gap-1.5">
          <span class="text-[13px] font-semibold text-ink/65">How to pay</span>
          <CmsTextarea
            class="w-full rounded-xl border border-ink/15 bg-surface px-3 py-2.5 text-sm leading-6 text-heading outline-none focus:border-forest"
            rows={3}
            bind:value={instructions}
            placeholder="M-Pesa to 0754 000 000 (Key2africa Safaris), or bank transfer to…"
          ></CmsTextarea>
          {#if terms}
            <span class="text-[11px] text-ink/45">Pre-filled from the accepted quotation's payment terms.</span>
          {/if}
        </CmsLabel>
        <div class="flex justify-end gap-2">
          <CmsButton variant="ghost" class="h-9 rounded-xl px-3 text-xs font-semibold text-ink/55 transition hover:text-heading" type="button" onclick={() => (composing = false)}
            >Cancel</CmsButton
          >
          <CmsButton variant="ghost"
            class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-forest px-4 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
            type="button"
            disabled={!hasAmount || busy === 'send'}
            onclick={send}
          >
            {#if busy === 'send'}<Loader2 size={13} class="animate-spin" />{:else}<Send size={13} />{/if}
            Send request
          </CmsButton>
        </div>
      </div>
    {/if}

    {#if requests.length}
      <ul class="grid gap-2">
        {#each requests as row (row.id)}
          <li class="rounded-2xl border border-ink/10 bg-surface px-3.5 py-2.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-heading">
                  {money(row.amount, row.currency)}
                  <span class="font-normal text-ink/50">· {row.kind}</span>
                </p>
                <p class="text-[11px] text-ink/45">
                  Asked {day(row.sent_at)}{row.due_date ? ` · due ${day(row.due_date)}` : ''}
                  {#if row.sent_via}· sent by {row.sent_via}{:else}· <span class="text-clay">not delivered</span>{/if}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                {#if row.claimed_paid_at}
                  <!-- Their word, not a payment. Deliberately not green: nothing
                       here has seen the money yet. -->
                  <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200/70">
                    <BadgeCheck size={12} /> Says they paid — check
                  </span>
                {:else if row.status === 'cancelled'}
                  <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">Cancelled</span>
                {:else}
                  <span class="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700 ring-1 ring-sky-200/70">Awaiting payment</span>
                  <CmsButton variant="ghost"
                    class="inline-flex h-7 items-center gap-1 rounded-xl px-2 text-[11px] font-semibold text-ink/45 transition hover:text-red-600 disabled:opacity-50"
                    type="button"
                    disabled={busy === row.id}
                    onclick={() => cancel(row)}><X size={12} /> Cancel</CmsButton
                  >
                {/if}
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {:else if confirmed && !composing && total != null}
      <p class="rounded-2xl border border-dashed border-ink/15 px-4 py-5 text-center text-sm text-ink/50">
        Nobody has been asked to pay yet.
      </p>
    {/if}
  {/if}
</div>

<AdminPaymentRecorder
  open={recording}
  {bookingId}
  {bookingLabel}
  {currency}
  {outstanding}
  on:close={() => (recording = false)}
  on:saved={async () => {
    recording = false;
    await load();
    dispatch('recorded');
  }}
/>
