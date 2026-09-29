<script lang="ts">
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as CmsSelect from '$lib/components/ui/native-select';
  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Textarea as CmsTextarea } from '$lib/components/ui/textarea';

  /**
   * WhatsApp inbox.
   *
   * Deliberately one screen: threads on the left, the conversation in the
   * middle, who the traveller is on the right. An agent should be able to
   * answer without opening anything else, which is the whole point of holding
   * the lead and the assistant's captured context beside the messages.
   */
  import { onMount, onDestroy } from 'svelte';
  import { AlertTriangle, Ban, Bot, Check, CheckCheck, Clock, FileText, MessageCircle, Plus, Search, Send, User, UserCog } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import { quotationMoney, quotationStatusChip, quotationStatusLabel } from '$lib/admin/quotations';
  import AdminButton from '$lib/admin/components/admin/AdminButton.svelte';
  import AdminQuotationEditor from '$lib/admin/components/admin/AdminQuotationEditor.svelte';
  import ToastStack from '$lib/admin/components/admin/ToastStack.svelte';
  import LoadingState from '$lib/admin/components/public/LoadingState.svelte';

  type Row = Record<string, any>;
  type Toast = { id: string; message: string; type: 'error' | 'success' };

  let conversations: Row[] = [];
  let agents: Array<{ id: string; full_name: string }> = [];
  let activeId = '';
  let detail: Row | null = null;
  let loadingList = true;
  let loadingThread = false;
  let sending = false;
  let search = '';
  let stateFilter = '';
  let draft = '';
  let noteDraft = '';
  let toasts: Toast[] = [];
  let poller: ReturnType<typeof setInterval> | undefined;
  let quoteOpen = false;
  let quoteLoading = false;
  let editingQuote: Row | null = null;
  let quotePrefill: Row = {};
  let tours: Row[] = [];
  let templates: Row[] = [];
  // A failed fetch and an empty registry look identical in `templates`, and
  // telling an agent "none are configured" when the request actually failed
  // would be a lie. Keep the reason so the composer can say which it was.
  let templatesError = '';
  let templateKey = '';
  let templateValues: string[] = [];
  let templateSending = false;
  // Free-form stays the default inside the window; the template path is opt-in.
  let useTemplate = false;

  const STATES = [
    { value: '', label: 'All conversations' },
    { value: 'AI_ACTIVE', label: 'AI handling' },
    { value: 'HUMAN_REQUESTED', label: 'Human requested' },
    { value: 'AGENT_ASSIGNED', label: 'Assigned' },
    { value: 'HUMAN_ACTIVE', label: 'Agent replying' },
    { value: 'RESOLVED', label: 'Resolved' }
  ];

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID();
    toasts = [{ id, message, type }, ...toasts].slice(0, 4);
    setTimeout(() => (toasts = toasts.filter((t) => t.id !== id)), 4000);
  };

  const loadList = async () => {
    try {
      const res = await api.whatsapp.conversations({ search, state: stateFilter, limit: 60 });
      conversations = res.data as Row[];
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to load conversations.', 'error');
    } finally {
      loadingList = false;
    }
  };

  const openConversation = async (id: string) => {
    // Only on a real switch: the post-send reload re-opens the same thread and
    // must not wipe what the agent is still writing.
    if (id !== activeId) clearThreadDrafts();
    activeId = id;
    loadingThread = true;
    try {
      const res = await api.whatsapp.conversation(id);
      detail = res.data as Row;
      // Opening a thread is what marks it read — the badge clears here rather
      // than on some separate action an agent has to remember.
      await api.whatsapp.markRead(id);
      const row = conversations.find((c) => c.id === id);
      if (row) row.unread_count = 0;
      conversations = conversations;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to open the conversation.', 'error');
    } finally {
      loadingThread = false;
    }
  };

  const reply = async () => {
    const body = draft.trim();
    if (!body || !detail || sending) return;
    sending = true;
    try {
      await api.whatsapp.send({ to: detail.conversation.visitor_phone, body });
      draft = '';
      await openConversation(activeId);
      showToast('Message sent.');
    } catch (error) {
      // The 24-hour window rejection arrives here as a readable sentence.
      showToast(error instanceof Error ? error.message : 'Unable to send.', 'error');
    } finally {
      sending = false;
    }
  };

  /**
   * Everything the agent had half-typed for the thread they are leaving.
   *
   * All of it belongs to one traveller: a reply, an internal note, a template's
   * name and reference. Carrying any of it into the next thread means one click
   * sends the wrong person someone else's message, so they go together.
   */
  const clearThreadDrafts = () => {
    templateKey = '';
    templateValues = [];
    useTemplate = false;
    draft = '';
    noteDraft = '';
  };

  // Values are positional, so a leftover from the previous template would be
  // sent as a different variable entirely. Rebuild the array from scratch.
  const selectTemplate = (key: string) => {
    templateKey = key;
    const chosen = templates.find((row) => row.internal_key === key);
    templateValues = (Array.isArray(chosen?.variables) ? chosen?.variables : []).map(() => '');
  };

  const humanise = (name: string) => {
    const spaced = String(name).replace(/_/g, ' ').trim();
    return spaced ? spaced[0].toUpperCase() + spaced.slice(1) : '';
  };

  /**
   * The one thing allowed to cross the 24-hour boundary — and only because it
   * goes through the approved registry rather than carrying free text.
   */
  const sendTemplate = async () => {
    if (!detail || !activeTemplate || templateSending || templateIncomplete) return;
    templateSending = true;
    // Minted once per attempt, here rather than in the markup: a re-render must
    // not hand a second click a fresh key and message the traveller twice.
    const idempotencyKey = crypto.randomUUID();
    try {
      await api.whatsapp.send({
        to: detail.conversation.visitor_phone,
        // The internal key, not Meta's name: the registry is what decides which
        // approved template actually goes out.
        template_name: activeTemplate.internal_key,
        language: activeTemplate.language,
        parameters: templateParameters,
        idempotency_key: idempotencyKey
      });
      templateValues = templateValues.map(() => '');
      await openConversation(activeId);
      showToast('Template sent.');
    } catch (error) {
      // The server names the exact template and count it rejected. Repeat it
      // word for word — a paraphrase loses what the agent needs to fix.
      showToast(error instanceof Error ? error.message : 'Unable to send the template.', 'error');
    } finally {
      templateSending = false;
    }
  };

  const setState = async (handoffState: string) => {
    if (!detail) return;
    try {
      await api.whatsapp.updateState(activeId, { handoff_state: handoffState });
      await Promise.all([openConversation(activeId), loadList()]);
      showToast(`Conversation set to ${handoffState.replace('_', ' ').toLowerCase()}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update.', 'error');
    }
  };

  const assign = async (agentId: string) => {
    if (!detail) return;
    try {
      await api.whatsapp.updateState(activeId, { assigned_to: agentId || null });
      await Promise.all([openConversation(activeId), loadList()]);
      showToast(agentId ? 'Assigned. The assistant will stop replying.' : 'Unassigned.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to assign.', 'error');
    }
  };

  const addNote = async () => {
    const body = noteDraft.trim();
    if (!body || !detail) return;
    try {
      await api.whatsapp.addNote(activeId, body);
      noteDraft = '';
      await openConversation(activeId);
      showToast('Note added.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to add the note.', 'error');
    }
  };

  // Quoting from the inbox only earns its place if the agent retypes nothing, so the
  // thread hands over everything it already knows. Keys without a real value are
  // dropped rather than sent as blanks the editor would show as answered fields.
  const newQuotation = () => {
    if (!detail) return;
    const prefill: Row = {
      conversation_id: activeId,
      booking_request_id: lead?.id,
      tour_id: detail.tour?.id,
      // `||`, not `??`: the webhook stores a missing WhatsApp profile name as an
      // empty string, which `??` would keep — and the filter below would then
      // drop the key entirely instead of falling back to the lead's name.
      customer_name: detail.conversation.visitor_name || lead?.full_name,
      customer_phone: detail.conversation.visitor_phone,
      customer_email: lead?.email,
      adults: lead?.number_of_adults,
      children: lead?.number_of_children,
      travel_date: lead?.travel_date,
      title: detail.tour?.title
    };
    quotePrefill = Object.fromEntries(Object.entries(prefill).filter(([, value]) => value !== null && value !== undefined && value !== ''));
    editingQuote = null;
    quoteOpen = true;
  };

  /**
   * The thread only carries a summary of each quotation — `getConversation`
   * selects eleven display columns and nothing else, so this row has no items,
   * notes, travel date, tour or contact details. The editor expects the whole
   * record, and the update endpoint patches every field the form submits, so
   * handing it the summary would blank the line items and the traveller-visible
   * notes on a live commercial document. Fetch the real row first.
   */
  const editQuotation = async (quotation: Row) => {
    if (quoteLoading) return;
    quoteLoading = true;
    try {
      const res = await api.quotations.get(String(quotation.id));
      editingQuote = res.data as Row;
      quotePrefill = {};
      quoteOpen = true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to open that quotation.', 'error');
    } finally {
      quoteLoading = false;
    }
  };

  const closeQuote = () => {
    quoteOpen = false;
    editingQuote = null;
    quotePrefill = {};
  };

  // Refresh the thread but leave the editor up, the same way the quotations
  // page does: `saved` means "there is a new version to reload", not "the agent
  // is finished". Closing here would break saving a draft and then sending it,
  // and would force a second save to raise a second quotation.
  const quotationSaved = async () => {
    await openConversation(activeId);
  };

  // A skipped send is neither a success nor an error: the opt-in check and the
  // 24-hour window both land here, and the backend deliberately leaves the quotation
  // unsent. Repeat its reason word for word instead of implying the traveller has it.
  const quotationSent = async (event: CustomEvent<Row>) => {
    const outcome = event.detail?.outcome;
    closeQuote();
    await openConversation(activeId);
    if (outcome?.status === 'sent') showToast('Quotation sent to the traveller.');
    else showToast(outcome?.detail ?? 'The quotation was not sent.', 'error');
  };

  const time = (value?: string) =>
    value ? new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '';

  onMount(async () => {
    await Promise.all([
      loadList(),
      api.whatsapp.agents().then((r) => (agents = r.data)).catch(() => undefined),
      // The approved registry, fetched once. Outside the 24-hour window this is
      // the only way to reach the traveller, so a failure has to be visible.
      api.whatsapp
        .templates()
        .then((r) => (templates = r.data as Row[]))
        .catch((error) => (templatesError = error instanceof Error ? error.message : 'Unable to load templates.')),
      // Feeds the composer's tour picker. Optional — without it the editor
      // falls back to a quotation with no tour attached, which is still valid.
      api.tours
        .list({ status: 'all', limit: 200 })
        .then((r) => (tours = r.data.items as Row[]))
        .catch(() => undefined)
    ]);
    // A quiet refresh so an agent sees new messages without reloading.
    poller = setInterval(() => void loadList(), 20000);
  });
  onDestroy(() => poller && clearInterval(poller));

  $: void (search, stateFilter, loadList());
  $: lead = detail?.lead ?? null;
  $: context = (lead?.lead_context ?? detail?.conversation?.lead_context ?? {}) as Record<string, unknown>;
  /**
   * The assistant stores whatever it captured, so a value here can be a nested
   * object — attribution is one. String() turns those into "[object Object]",
   * which tells an agent nothing; a compact key: value rendering at least says
   * what was captured.
   */
  const contextValue = (value: unknown): string => {
    if (Array.isArray(value)) return value.join(', ');
    if (value && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
        .join(' · ');
    }
    return String(value);
  };

  $: contextEntries = Object.entries(context)
    .filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && !v.length))
    // An object that reduces to nothing is noise, not information.
    .filter(([, v]) => contextValue(v).trim() !== '');
  $: activeTemplate = templates.find((row) => row.internal_key === templateKey) ?? null;
  $: templateVariables = (Array.isArray(activeTemplate?.variables) ? activeTemplate?.variables : []) as string[];
  // What actually goes to Meta. The preview reads from the same array, so the
  // agent is looking at the message that will be sent, not an approximation.
  $: templateParameters = templateValues.map((value) => value.trim());
  // Meta rejects a template with a missing parameter. Say so before the send.
  $: templateIncomplete = templateParameters.length !== templateVariables.length || templateParameters.some((value) => !value);
  $: templatePreview = activeTemplate?.body_text
    ? String(activeTemplate.body_text).replace(/\{\{(\d+)\}\}/g, (match, index) => templateParameters[Number(index) - 1] || match)
    : '';
</script>

<ToastStack {toasts} on:dismiss={(e) => (toasts = toasts.filter((t) => t.id !== e.detail))} />

<header class="mb-4 flex flex-col gap-3 rounded-xl border border-ink/10 bg-surface px-5 py-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
  <div class="min-w-0">
    <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-forest/70">Admin CMS</p>
    <h1 class="mt-1 text-2xl font-bold tracking-normal text-ink">WhatsApp Inbox</h1>
    <p class="mt-1 text-sm text-ink/60">Read, reply, and manage traveller conversations in one place.</p>
  </div>
  <div class="flex shrink-0 items-center gap-2 text-xs font-semibold text-ink/55">
    <span class="h-2 w-2 rounded-full bg-[#25D366]"></span>
    {conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}
  </div>
</header>

<!--
  Every track is minmax(0, …) and every child carries min-w-0: a grid item's
  default min-width is auto, so one unbreakable string — a source URL in the
  traveller panel — would otherwise widen its column past the track and push
  the whole layout off screen.
-->
<div class="grid min-h-[640px] gap-4 lg:h-[calc(100dvh-240px)] lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(240px,280px)_minmax(420px,1fr)_minmax(320px,360px)]">
  <!-- ── Threads ──────────────────────────────────────────────────────────── -->
  <section class="min-w-0 overflow-hidden rounded-xl border border-ink/10 bg-surface lg:flex lg:min-h-0 lg:flex-col">
    <div class="grid gap-2 border-b border-ink/10 p-3">
      <CmsLabel class="flex h-10 items-center gap-2 rounded-md border border-ink/15 px-3">
        <Search size={15} class="text-ink/40" />
        <CmsInput class="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Name or number…" bind:value={search} />
      </CmsLabel>
      <CmsSelect.Root class="h-9 rounded-md border border-ink/15 bg-surface px-2 text-xs font-semibold text-ink" bind:value={stateFilter}>
        {#each STATES as option}<CmsSelect.Option value={option.value}>{option.label}</CmsSelect.Option>{/each}
      </CmsSelect.Root>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      {#if loadingList}
        <div class="p-6"><LoadingState message="Loading conversations…" /></div>
      {:else if !conversations.length}
        <p class="p-6 text-sm text-ink/55">No WhatsApp conversations yet. They appear here as soon as a traveller messages you.</p>
      {:else}
        {#each conversations as conversation (conversation.id)}
          <CmsButton variant="ghost"
            class={`flex w-full flex-col gap-1 border-b border-ink/[0.06] p-3 text-left transition hover:bg-sand/40 ${activeId === conversation.id ? 'bg-sand/60' : ''}`}
            type="button"
            onclick={() => openConversation(conversation.id)}
          >
            <span class="flex items-center justify-between gap-2">
              <span class="truncate text-sm font-bold text-heading">{conversation.visitor_name || conversation.visitor_phone}</span>
              {#if conversation.unread_count}
                <span class="shrink-0 rounded-full bg-clay px-1.5 py-0.5 text-[10px] font-bold text-white">{conversation.unread_count}</span>
              {/if}
            </span>
            <span class="truncate text-xs text-ink/55">{conversation.last_message?.content ?? 'No messages yet'}</span>
            <span class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink/40">
              {#if conversation.handoff_state === 'AI_ACTIVE'}<Bot size={11} />{:else}<UserCog size={11} />{/if}
              {conversation.handoff_state?.replace('_', ' ')}
              {#if conversation.assigned_to_name}· {conversation.assigned_to_name}{/if}
            </span>
          </CmsButton>
        {/each}
      {/if}
    </div>
  </section>

  <!-- ── Thread ───────────────────────────────────────────────────────────── -->
  <section class="flex min-h-[640px] min-w-0 flex-col overflow-hidden rounded-xl border border-ink/10 bg-surface lg:min-h-0">
    {#if !detail}
      <div class="grid flex-1 place-items-center p-10 text-center text-sm text-ink/50">
        <div><MessageCircle size={26} class="mx-auto mb-2 text-ink/25" />Select a conversation to read and reply.</div>
      </div>
    {:else}
      <header class="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 p-3">
        <div class="min-w-0">
          <p class="truncate text-sm font-bold text-heading">{detail.conversation.visitor_name || detail.conversation.visitor_phone}</p>
          <p class="text-xs text-ink/50">{detail.conversation.visitor_phone}</p>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <CmsSelect.Root
            class="h-8 rounded-md border border-ink/15 bg-surface px-2 text-xs font-semibold"
            value={detail.conversation.assigned_to ?? ''}
            onchange={(event) => assign(event.currentTarget.value)}
          >
            <CmsSelect.Option value="">Unassigned</CmsSelect.Option>
            {#each agents as agent}<CmsSelect.Option value={agent.id}>{agent.full_name}</CmsSelect.Option>{/each}
          </CmsSelect.Root>
          {#if detail.conversation.handoff_state !== 'RESOLVED'}
            <AdminButton variant="secondary" type="button" on:click={() => setState('RESOLVED')}>Resolve</AdminButton>
          {:else}
            <AdminButton variant="secondary" type="button" on:click={() => setState('AI_ACTIVE')}>Reopen</AdminButton>
          {/if}
        </div>
      </header>

      {#if !detail.conversation.ai_enabled}
        <p class="flex items-center gap-2 border-b border-ink/10 bg-sand/40 px-3 py-2 text-xs font-semibold text-ink/70">
          <UserCog size={13} /> A person has this conversation — the assistant will not reply automatically.
        </p>
      {/if}

      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto bg-canvas/35 p-4">
        {#if loadingThread}
          <LoadingState message="Loading messages…" />
        {:else}
          {#each detail.messages as message (message.id)}
            {@const mine = message.role !== 'user'}
            <div class={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div class={`max-w-[82%] break-words rounded-xl px-3 py-2 text-sm shadow-sm ${mine ? 'bg-deep-green text-white' : 'border border-ink/[0.06] bg-surface text-ink'}`}>
                <p class="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] opacity-70">
                  {#if message.role === 'user'}<User size={10} /> Traveller
                  {:else if message.role === 'agent'}<UserCog size={10} /> Agent
                  {:else}<Bot size={10} /> Assistant{/if}
                </p>
                <p class="whitespace-pre-wrap leading-6">{message.content}</p>
                <!--
                  The timestamp carries the muting, not the row: a failure drawn
                  inside an opacity-60 line is a decoration, and this one has to
                  stop an agent scrolling past it.
                -->
                <p class="mt-1 flex items-center justify-end gap-1.5 text-[10px]">
                  <span class="opacity-60">{time(message.created_at)}</span>
                  <!--
                    Six distinct states, because they mean different things to
                    the traveller. 'accepted' in particular is Meta holding the
                    request, not a phone holding the message — drawing it the
                    same as delivered is what made unsent messages look sent.
                    An outbound turn with no transport row shows nothing at all.

                    Each tooltip sits on the wrapping span rather than on the
                    icon: `title` is not an SVG attribute, so a browser renders
                    no tooltip for one set on the svg itself.
                  -->
                  {#if message.delivery?.direction === 'outbound'}
                    {#if message.delivery.status === 'read'}
                      <span class="inline-flex" title="Read by the traveller"><CheckCheck size={12} aria-label="Read" /></span>
                    {:else if message.delivery.status === 'delivered'}
                      <span class="inline-flex opacity-60" title="Delivered to the traveller's phone"><CheckCheck size={12} aria-label="Delivered" /></span>
                    {:else if message.delivery.status === 'sent'}
                      <span class="inline-flex opacity-90" title="Sent — delivery not yet confirmed"><Check size={12} aria-label="Sent" /></span>
                    {:else if message.delivery.status === 'accepted'}
                      <span class="inline-flex opacity-45" title="WhatsApp accepted the request — delivery is not confirmed yet">
                        <Check size={12} aria-label="Accepted by WhatsApp, delivery not confirmed" />
                      </span>
                    {:else if message.delivery.status === 'pending'}
                      <span class="inline-flex opacity-70" title="Not handed to WhatsApp yet"><Clock size={12} aria-label="Pending" /></span>
                    {:else if message.delivery.status === 'failed'}
                      <span class="inline-flex items-center gap-1 rounded-full bg-clay px-1.5 py-0.5 font-bold uppercase tracking-[0.08em] text-white" title="This message did not reach the traveller">
                        <AlertTriangle size={11} /> Failed
                      </span>
                    {:else if message.delivery.status === 'skipped'}
                      <span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-bold uppercase tracking-[0.08em] opacity-70 ring-1 ring-current" title="Nothing was handed to WhatsApp">
                        <Ban size={11} /> Not sent
                      </span>
                    {/if}
                  {/if}
                </p>
                <!--
                  Why it did not arrive, in the backend's own words. Without a
                  reason the badge only tells an agent that something is wrong,
                  not what to do about it — and neither line invents one when the
                  row carries none.
                -->
                {#if message.delivery?.direction === 'outbound' && message.delivery.status === 'failed'}
                  <p class="mt-1 rounded bg-clay/30 px-1.5 py-1 text-[10px] leading-4">
                    Not delivered{message.delivery.error_message ? ` — ${message.delivery.error_message}` : '.'}
                  </p>
                {:else if message.delivery?.direction === 'outbound' && message.delivery.status === 'skipped'}
                  <p class="mt-1 rounded bg-black/15 px-1.5 py-1 text-[10px] leading-4 opacity-80">
                    Not sent{message.delivery.skipped_reason ? ` — ${message.delivery.skipped_reason}` : '.'}
                  </p>
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <footer class="border-t border-ink/10 p-3">
        {#if detail.session_window_open}
          <div class="mb-2 flex justify-end">
            <CmsButton variant="ghost"
              class="inline-flex items-center gap-1.5 rounded-md border border-ink/15 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ink/55 transition hover:border-forest/30 hover:text-heading"
              type="button"
              aria-pressed={useTemplate}
              onclick={() => (useTemplate = !useTemplate)}
            >
              <FileText size={12} /> {useTemplate ? 'Write a reply' : 'Use a template'}
            </CmsButton>
          </div>
        {:else}
          <p class="mb-2.5 flex items-start gap-2 rounded-md border border-goldfinch-gold/35 bg-goldfinch-gold/[0.08] px-3 py-2.5 text-xs text-ink/75">
            <Clock size={14} class="mt-0.5 shrink-0 text-clay" />
            This traveller last wrote more than 24 hours ago, so WhatsApp only allows an approved template now. Free-form replies resume as soon as they message again.
          </p>
        {/if}

        {#if detail.session_window_open && !useTemplate}
          <div class="flex gap-2">
            <CmsTextarea
              class="min-h-[44px] flex-1 rounded-md border border-ink/15 bg-black/[0.02] px-3 py-2 text-sm outline-none focus:border-forest"
              rows={2}
              placeholder="Write a reply…"
              bind:value={draft}
              onkeydown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) reply(); }}
            ></CmsTextarea>
            <AdminButton type="button" disabled={sending || !draft.trim()} on:click={reply}>
              <Send size={15} /> {sending ? 'Sending…' : 'Send'}
            </AdminButton>
          </div>
          <p class="mt-1 text-[11px] text-ink/40">⌘/Ctrl + Enter to send.</p>
        {:else if templatesError}
          <p class="flex items-start gap-2 rounded-md border border-clay/35 bg-clay/[0.06] px-3 py-2.5 text-xs text-ink/75">
            <AlertTriangle size={14} class="mt-0.5 shrink-0 text-clay" />
            {templatesError}
          </p>
        {:else if !templates.length}
          <p class="rounded-md border border-ink/15 bg-sand/40 px-3 py-2.5 text-xs text-ink/60">
            No approved templates are configured yet. One has to be approved in WhatsApp Manager and registered here before it can be sent.
          </p>
        {:else}
          <div class="grid gap-2.5">
            <CmsLabel class="grid gap-1">
              <span class="text-[11px] font-bold uppercase tracking-[0.14em] text-forest/70">Template</span>
              <CmsSelect.Root
                class="h-9 rounded-md border border-ink/15 bg-surface px-2 text-sm text-ink outline-none focus:border-forest"
                value={templateKey}
                onchange={(event) => selectTemplate(event.currentTarget.value)}
              >
                <CmsSelect.Option value="">Choose a template…</CmsSelect.Option>
                {#each templates as template (template.internal_key)}
                  <CmsSelect.Option value={template.internal_key}>{template.label || template.internal_key}</CmsSelect.Option>
                {/each}
              </CmsSelect.Root>
            </CmsLabel>

            {#if activeTemplate}
              <!-- Meta's own name, so an agent can check this against WhatsApp Manager. -->
              <p class="-mt-1 text-[11px] text-ink/55">
                <span class="font-mono text-ink/70">{activeTemplate.meta_template_name}</span>
                · {activeTemplate.language}{#if activeTemplate.category} · {activeTemplate.category}{/if}
              </p>
              {#if activeTemplate.description}
                <p class="-mt-1.5 text-[11px] text-ink/55">{activeTemplate.description}</p>
              {/if}

              {#if templateVariables.length}
                <div class="grid gap-2 sm:grid-cols-2">
                  {#each templateVariables as variable, index}
                    <CmsLabel class="grid gap-1">
                      <span class="text-[11px] font-semibold text-ink/55">{humanise(variable)}</span>
                      <CmsInput
                        class="h-9 rounded-md border border-ink/15 bg-surface px-2 text-sm outline-none focus:border-forest"
                        bind:value={templateValues[index]}
                      />
                    </CmsLabel>
                  {/each}
                </div>
              {/if}

              <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-forest/70">Preview</p>
              {#if activeTemplate.body_text}
                <div class="-mt-1 flex justify-end">
                  <div class="max-w-[78%] rounded-xl bg-deep-green px-3 py-2 text-sm text-white">
                    <p class="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] opacity-70">
                      <UserCog size={10} /> Agent
                    </p>
                    <p class="whitespace-pre-wrap leading-6">{templatePreview}</p>
                  </div>
                </div>
              {:else}
                <p class="-mt-1 text-[11px] text-ink/55">
                  This template's body text is not stored here, so there is nothing to preview. The traveller receives the approved wording from WhatsApp Manager with these values filled in.
                </p>
              {/if}

              <div class="flex items-center justify-end gap-3">
                {#if templateIncomplete}
                  <p class="text-[11px] text-clay">Every value is required — WhatsApp rejects a template with a blank one.</p>
                {/if}
                <AdminButton type="button" disabled={templateSending || templateIncomplete} on:click={sendTemplate}>
                  <Send size={15} /> {templateSending ? 'Sending…' : 'Send template'}
                </AdminButton>
              </div>
            {/if}
          </div>
        {/if}
      </footer>
    {/if}
  </section>

  <!-- ── Traveller ────────────────────────────────────────────────────────── -->
  <section class="min-w-0 overflow-y-auto rounded-xl border border-ink/10 bg-surface p-4 lg:col-span-2 2xl:col-span-1">
    {#if !detail}
      <p class="text-sm text-ink/50">No conversation selected.</p>
    {:else}
      <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-forest/70">Traveller</p>
      <dl class="mt-2 grid min-w-0 gap-2 text-sm">
        {#if detail.conversation.visitor_country}<div class="grid min-w-0 grid-cols-[100px_minmax(0,1fr)] gap-3"><dt class="text-ink/50">Country</dt><dd class="min-w-0 break-words font-semibold text-heading">{detail.conversation.visitor_country}</dd></div>{/if}
        {#if detail.conversation.lead_status}<div class="grid min-w-0 grid-cols-[100px_minmax(0,1fr)] gap-3"><dt class="text-ink/50">Lead</dt><dd class="min-w-0 break-words font-semibold capitalize text-heading">{detail.conversation.lead_status}</dd></div>{/if}
        {#if detail.contact?.whatsapp_opt_in}<div class="grid min-w-0 grid-cols-[100px_minmax(0,1fr)] gap-3"><dt class="text-ink/50">Opt-in</dt><dd class="font-semibold text-forest">Yes</dd></div>{/if}
      </dl>

      {#if lead}
        <p class="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-forest/70">Enquiry</p>
        <dl class="mt-2 grid min-w-0 gap-2 text-sm">
          {#if lead.booking_code}<div class="grid min-w-0 grid-cols-[100px_minmax(0,1fr)] gap-3"><dt class="text-ink/50">Ref</dt><dd class="min-w-0 break-words font-semibold text-heading">{lead.booking_code}</dd></div>{/if}
          {#if detail.tour}<div class="grid min-w-0 grid-cols-[100px_minmax(0,1fr)] gap-3"><dt class="text-ink/50">Tour</dt><dd class="min-w-0 break-words font-semibold text-heading">{detail.tour.title}</dd></div>{/if}
          {#if lead.travel_date}<div class="grid min-w-0 grid-cols-[100px_minmax(0,1fr)] gap-3"><dt class="text-ink/50">Travel</dt><dd class="min-w-0 break-words font-semibold text-heading">{lead.travel_date}</dd></div>{/if}
          {#if lead.total_people}<div class="grid min-w-0 grid-cols-[100px_minmax(0,1fr)] gap-3"><dt class="text-ink/50">Travellers</dt><dd class="min-w-0 break-words font-semibold text-heading">{lead.total_people}</dd></div>{/if}
          {#if lead.estimated_amount}<div class="grid min-w-0 grid-cols-[100px_minmax(0,1fr)] gap-3"><dt class="text-ink/50">Estimate</dt><dd class="min-w-0 break-words font-semibold text-heading">{lead.currency ?? 'USD'} {lead.estimated_amount}</dd></div>{/if}
          {#if lead.status}<div class="grid min-w-0 grid-cols-[100px_minmax(0,1fr)] gap-3"><dt class="text-ink/50">Status</dt><dd class="min-w-0 break-words font-semibold capitalize text-heading">{lead.status}</dd></div>{/if}
        </dl>
      {/if}

      {#if contextEntries.length}
        <p class="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-forest/70">From the assistant</p>
        <dl class="mt-2 grid min-w-0 gap-2.5 text-sm">
          {#each contextEntries.slice(0, 10) as [key, value]}
            <div class="grid min-w-0 grid-cols-[100px_minmax(0,1fr)] gap-3">
              <dt class="capitalize text-ink/50">{key.replace(/_/g, ' ')}</dt>
              <dd class="min-w-0 break-words font-semibold leading-5 text-heading [overflow-wrap:anywhere]">{contextValue(value)}</dd>
            </div>
          {/each}
        </dl>
      {/if}

      <p class="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-forest/70">Quotations</p>
      <div class="mt-2">
        <AdminButton variant="secondary" size="sm" type="button" on:click={newQuotation}>
          <Plus size={14} /> New quotation
        </AdminButton>
      </div>
      {#if detail.quotations?.length}
        <div class="mt-2 grid gap-2">
          {#each detail.quotations as quotation (quotation.id)}
            <CmsButton variant="ghost" class="w-full rounded-md bg-sand/40 p-2 text-left text-xs transition hover:bg-sand/70 disabled:opacity-60" type="button" disabled={quoteLoading} onclick={() => editQuotation(quotation)}>
              <span class="flex items-center justify-between gap-2">
                <span class="font-mono font-bold text-heading">{quotation.quote_code}</span>
                <span class={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${quotationStatusChip(quotation.status)}`}>{quotationStatusLabel(quotation.status)}</span>
              </span>
              <span class="mt-1 flex items-center justify-between gap-2 text-ink/55">
                {#if quotation.title}<span class="truncate">{quotation.title}</span>{/if}
                {#if quotation.total_amount != null}<span class="shrink-0 font-semibold text-heading">{quotationMoney(quotation.total_amount, quotation.currency)}</span>{/if}
              </span>
            </CmsButton>
          {/each}
        </div>
      {:else}
        <p class="mt-2 text-[11px] text-ink/45">No quotations raised from this conversation yet.</p>
      {/if}

      <p class="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-forest/70">Internal notes</p>
      <p class="mt-0.5 text-[11px] text-ink/45">Staff only — never sent to the traveller.</p>
      <div class="mt-2 flex gap-1.5">
        <CmsInput class="h-9 min-w-0 flex-1 rounded-md border border-ink/15 px-2 text-sm outline-none focus:border-forest" placeholder="Add a note…" bind:value={noteDraft} onkeydown={(e) => e.key === 'Enter' && addNote()} />
        <AdminButton variant="secondary" type="button" disabled={!noteDraft.trim()} on:click={addNote}>Add</AdminButton>
      </div>
      <div class="mt-2 grid gap-2">
        {#each detail.notes as note (note.id)}
          <div class="rounded-md bg-sand/40 p-2 text-xs">
            <p class="text-ink/75">{note.body}</p>
            <p class="mt-1 text-[10px] text-ink/40">{time(note.created_at)}</p>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>

<AdminQuotationEditor
  open={quoteOpen}
  quotation={editingQuote}
  prefill={quotePrefill}
  {tours}
  on:saved={quotationSaved}
  on:sent={quotationSent}
  on:close={closeQuote}
/>
