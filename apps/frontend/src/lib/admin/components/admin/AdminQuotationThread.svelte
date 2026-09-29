<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Textarea as CmsTextarea } from '$lib/components/ui/textarea';
  import * as CmsSelect from '$lib/components/ui/native-select';
  import { Input as CmsInput } from '$lib/components/ui/input';

  /**
   * Everything said about one quotation, and everything it used to say.
   *
   * The negotiation used to happen in WhatsApp, where it was invisible to
   * anyone who was not in that thread and gone the moment the conversation
   * moved on. This is the same exchange kept against the document: what the
   * traveller asked for, what we replied, and what each superseded version
   * actually said.
   *
   * Three actions live here because all three are about answering the traveller
   * rather than composing a price: reply, revise, and — for the cases the link
   * cannot cover — force the status by hand.
   */
  import { createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { AlertTriangle, Check, History, Loader2, MessageSquare, ShieldAlert, X } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import { quotationIsSettled, quotationMoney, quotationStatusChip, quotationStatusLabel } from '$lib/admin/quotations';

  export let open = false;
  export let quotation: Record<string, any> | null = null;

  const dispatch = createEventDispatcher<{ close: void; revised: Record<string, any>; changed: Record<string, any> }>();

  type Comment = {
    id: string;
    revision: number;
    author: 'traveller' | 'admin';
    author_name: string | null;
    body: string;
    resolved_at: string | null;
    created_at: string;
  };
  type Revision = {
    id: string;
    revision: number;
    superseded_reason: string | null;
    created_at: string;
    snapshot: Record<string, any>;
  };

  let comments: Comment[] = [];
  let revisions: Revision[] = [];
  let loading = false;
  let error = '';
  let busy = '';

  let reply = '';
  let overrideStatus = '';
  let overrideReason = '';
  let showOverride = false;

  let loadedFor = '';

  // Reload whenever a different quotation is opened. Keyed on the id rather
  // than on `open` so closing and reopening the same one does not refetch.
  $: if (open && quotation?.id && loadedFor !== quotation.id) {
    loadedFor = String(quotation.id);
    void load();
  }
  $: if (!open) loadedFor = '';

  $: settled = quotation ? quotationIsSettled(quotation) : false;
  $: openRequests = comments.filter((c) => c.author === 'traveller' && !c.resolved_at);

  const fmt = (value: unknown) =>
    value
      ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
          new Date(String(value))
        )
      : '';

  const load = async () => {
    if (!quotation?.id) return;
    loading = true;
    error = '';
    try {
      const res = await api.quotations.thread(String(quotation.id));
      comments = ((res.data?.comments ?? []) as Comment[]) ?? [];
      revisions = ((res.data?.revisions ?? []) as Revision[]) ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load this quotation’s history.';
    } finally {
      loading = false;
    }
  };

  const sendReply = async () => {
    if (!quotation?.id || !reply.trim() || busy) return;
    busy = 'reply';
    error = '';
    try {
      await api.quotations.comment(String(quotation.id), reply.trim());
      reply = '';
      await load();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not save that note.';
    } finally {
      busy = '';
    }
  };

  const resolve = async (comment: Comment) => {
    if (!quotation?.id || busy) return;
    busy = comment.id;
    try {
      await api.quotations.resolveComment(String(quotation.id), comment.id);
      await load();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not update that note.';
    } finally {
      busy = '';
    }
  };

  /**
   * Bump to the next version without changing any figures.
   *
   * The price edits themselves happen in the editor; this exists so the archive
   * is written and the version incremented at a moment the agent chooses,
   * rather than silently on whatever edit happens to come next.
   */
  const revise = async () => {
    if (!quotation?.id || busy) return;
    busy = 'revise';
    error = '';
    try {
      const res = await api.quotations.revise(String(quotation.id));
      await load();
      dispatch('revised', res.data ?? {});
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not create a new revision.';
    } finally {
      busy = '';
    }
  };

  const applyOverride = async () => {
    if (!quotation?.id || !overrideStatus || !overrideReason.trim() || busy) return;
    busy = 'override';
    error = '';
    try {
      const res = await api.quotations.setStatus(String(quotation.id), overrideStatus, overrideReason.trim());
      showOverride = false;
      overrideStatus = '';
      overrideReason = '';
      dispatch('changed', res.data ?? {});
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not change the status.';
    } finally {
      busy = '';
    }
  };

  const close = () => dispatch('close');
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && open) close();
  };

  const labelClass = 'text-[11px] font-bold uppercase tracking-[0.12em] text-ink/45';
</script>



{#if open && quotation}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (close)(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),42rem);max-width:none">
      <CmsDialog.Title class="sr-only">{quotation.title}</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <div
      class="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm"
      
    >
      <div class="flex items-start justify-between gap-4 border-b border-ink/10 bg-sand/30 p-5">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono text-sm font-bold text-heading">{quotation.quote_code}</span>
            <span class={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${quotationStatusChip(quotation.status)}`}
              >{quotationStatusLabel(quotation.status)}</span
            >
            <span class="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[11px] font-semibold text-ink/60">
              v{Number(quotation.revision ?? 1)}
            </span>
          </div>
          <h2 class="mt-1 truncate font-serif text-xl font-semibold text-heading">{quotation.title}</h2>
          <p class="text-xs text-ink/50">{quotationMoney(quotation.total_amount, quotation.currency)}</p>
        </div>
        <CmsButton variant="ghost"
          class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand"
          type="button"
          aria-label="Close"
          onclick={close}><X size={18} /></CmsButton
        >
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto">
        {#if settled}
          <!-- Says why the actions below are missing. A locked document with no
               explanation reads as a broken page. -->
          <p class="flex items-start gap-2 border-b border-ink/10 bg-emerald-50/60 px-5 py-3 text-xs leading-6 text-emerald-800">
            <ShieldAlert size={15} class="mt-0.5 shrink-0" />
            {#if quotation.status === 'accepted'}
              <span>
                Accepted and locked. This is the agreement as it stood — changes now go on the booking as an amendment.
                <!-- Names the booking where there is one. "Raise an amendment"
                     with nowhere to raise it is an instruction, not a route. -->
                {#if quotation.lead?.booking_code}
                  Open <span class="font-mono font-bold">{quotation.lead.booking_code}</span> under Bookings and record it there.
                {/if}
              </span>
            {:else}
              <span>Declined and closed. Create a new quotation rather than reopening this one.</span>
            {/if}
          </p>
        {/if}

        {#if quotation.status_override_reason}
          <p class="flex items-start gap-2 border-b border-ink/10 bg-amber-50/70 px-5 py-3 text-xs leading-6 text-amber-900">
            <AlertTriangle size={15} class="mt-0.5 shrink-0" />
            <span
              >Status set by hand, not by the traveller. Reason given: <span class="font-semibold">{quotation.status_override_reason}</span></span
            >
          </p>
        {/if}

        {#if error}
          <p class="border-b border-red-100 bg-red-50 px-5 py-3 text-xs font-medium text-red-700" role="alert">{error}</p>
        {/if}

        <section class="grid gap-4 p-5">
          <div class="flex items-center justify-between gap-3">
            <p class={labelClass}><MessageSquare size={12} class="mr-1 inline" /> The exchange</p>
            {#if openRequests.length}
              <span class="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700 ring-1 ring-orange-200/70">
                {openRequests.length} awaiting a reply
              </span>
            {/if}
          </div>

          {#if loading}
            <p class="flex items-center gap-2 text-sm text-ink/50"><Loader2 size={15} class="animate-spin" /> Loading…</p>
          {:else if !comments.length}
            <p class="rounded-xl border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/50">
              Nothing said about this quotation yet. When the traveller asks for a change from their link, it lands here.
            </p>
          {:else}
            <ul class="grid gap-2.5">
              {#each comments as comment (comment.id)}
                <li
                  class="rounded-xl border p-3.5 {comment.author === 'traveller'
                    ? 'border-orange-200/70 bg-orange-50/50'
                    : 'border-ink/10 bg-sand/25'}"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="text-[11px] font-bold uppercase tracking-[0.1em] {comment.author === 'traveller' ? 'text-orange-700' : 'text-ink/50'}">
                      {comment.author === 'traveller' ? quotation.customer_name || 'Traveller' : comment.author_name || 'Team'}
                      <span class="font-medium normal-case tracking-normal text-ink/40">· v{comment.revision} · {fmt(comment.created_at)}</span>
                    </p>
                    {#if comment.author === 'traveller'}
                      {#if comment.resolved_at}
                        <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><Check size={12} /> Handled</span>
                      {:else}
                        <CmsButton variant="ghost"
                          class="text-[11px] font-semibold text-ink/50 underline underline-offset-2 transition hover:text-heading disabled:opacity-50"
                          type="button"
                          disabled={busy === comment.id}
                          onclick={() => resolve(comment)}>Mark handled</CmsButton
                        >
                      {/if}
                    {/if}
                  </div>
                  <p class="mt-1.5 whitespace-pre-line text-sm leading-6 text-ink/80">{comment.body}</p>
                </li>
              {/each}
            </ul>
          {/if}

          {#if !settled}
            <div class="grid gap-2">
              <CmsTextarea
                bind:value={reply}
                rows={2}
                placeholder="A note for the team about this quotation…"
                class="w-full rounded-xl border border-ink/15 bg-canvas px-3 py-2.5 text-sm leading-6 text-heading outline-none focus:border-forest"
              ></CmsTextarea>
              <!-- Internal on purpose. Replying to the traveller happens on
                   WhatsApp or by sending the revised quotation; a note that
                   silently reached them would be a surprise to whoever wrote it. -->
              <div class="flex items-center justify-between gap-3">
                <p class="text-[11px] text-ink/45">Internal — the traveller never sees this.</p>
                <CmsButton variant="ghost"
                  class="inline-flex h-9 items-center rounded-xl bg-heading px-4 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                  type="button"
                  disabled={!reply.trim() || busy === 'reply'}
                  onclick={sendReply}>{busy === 'reply' ? 'Saving…' : 'Add note'}</CmsButton
                >
              </div>
            </div>
          {/if}
        </section>

        {#if revisions.length}
          <section class="grid gap-3 border-t border-ink/10 p-5">
            <p class={labelClass}><History size={12} class="mr-1 inline" /> Earlier versions</p>
            <ul class="grid gap-2">
              {#each revisions as rev (rev.id)}
                <li class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl bg-sand/25 px-3.5 py-2.5">
                  <span class="text-sm font-semibold text-heading">v{rev.revision}</span>
                  <span class="text-sm text-ink/60">{quotationMoney(rev.snapshot?.total_amount, rev.snapshot?.currency)}</span>
                  <span class="text-xs text-ink/40">superseded {fmt(rev.created_at)}</span>
                  {#if rev.superseded_reason}
                    <p class="w-full text-xs italic leading-5 text-ink/55">“{rev.superseded_reason}”</p>
                  {/if}
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 bg-sand/20 p-4">
        {#if showOverride}
          <div class="grid w-full gap-2">
            <p class="text-[11px] font-semibold text-amber-800">
              This records the change against your name. Use it only when the traveller cannot answer from their own link.
            </p>
            <div class="flex flex-wrap gap-2">
              <CmsSelect.Root
                bind:value={overrideStatus}
                class="h-10 min-w-[9rem] flex-1 rounded-xl border border-ink/15 bg-surface px-3 text-sm text-heading outline-none focus:border-forest"
              >
                <CmsSelect.Option value="">Set status to…</CmsSelect.Option>
                <CmsSelect.Option value="sent">Sent</CmsSelect.Option>
                <CmsSelect.Option value="viewed">Viewed</CmsSelect.Option>
                <CmsSelect.Option value="changes_requested">Changes requested</CmsSelect.Option>
                <CmsSelect.Option value="accepted">Accepted</CmsSelect.Option>
                <CmsSelect.Option value="declined">Declined</CmsSelect.Option>
                <CmsSelect.Option value="expired">Expired</CmsSelect.Option>
              </CmsSelect.Root>
              <CmsInput
                bind:value={overrideReason}
                type="text"
                placeholder="Why — e.g. agreed by phone with the client"
                class="h-10 min-w-0 flex-[2] rounded-xl border border-ink/15 bg-surface px-3 text-sm text-heading outline-none focus:border-forest"
              />
            </div>
            <div class="flex justify-end gap-2">
              <CmsButton variant="ghost" class="h-9 rounded-xl px-3 text-xs font-semibold text-ink/55 transition hover:text-heading" type="button" onclick={() => (showOverride = false)}
                >Cancel</CmsButton
              >
              <CmsButton variant="ghost"
                class="inline-flex h-9 items-center rounded-xl bg-amber-600 px-4 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                type="button"
                disabled={!overrideStatus || !overrideReason.trim() || busy === 'override'}
                onclick={applyOverride}>{busy === 'override' ? 'Saving…' : 'Apply override'}</CmsButton
              >
            </div>
          </div>
        {:else}
          <CmsButton variant="ghost"
            class="text-xs font-semibold text-ink/45 underline underline-offset-4 transition hover:text-amber-700"
            type="button"
            onclick={() => (showOverride = true)}>Set status by hand…</CmsButton
          >
          {#if !settled}
            <CmsButton variant="ghost"
              class="inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-4 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-50"
              type="button"
              disabled={busy === 'revise'}
              onclick={revise}
            >
              {#if busy === 'revise'}<Loader2 size={14} class="animate-spin" />{:else}<History size={14} />{/if}
              Start v{Number(quotation.revision ?? 1) + 1}
            </CmsButton>
          {/if}
        {/if}
      </div>
    </div>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}
