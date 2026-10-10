<script lang="ts">
  import * as CmsDialog from '$lib/components/ui/dialog';

  import { Button as CmsButton } from '$lib/components/ui/button';
  import { Input as CmsInput } from '$lib/components/ui/input';
  import { Label as CmsLabel } from '$lib/components/ui/label';

  /**
   * The quotation composer.
   *
   * Shared by the quotations list and the WhatsApp inbox, so it owns nothing
   * beyond its own form: the parent decides when it is open, hears back through
   * events, and does its own reloading and toasting. Sending is the one place
   * this screen is opinionated — a send that the server skipped is reported as
   * skipped, never as sent.
   */
  import type { OptionalActivitySelection } from '$lib/types/api';
  import { optionalQuotationAmount } from '$lib/optional-activities';
  import { createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { MessageCircle, Plus, Save, Trash2, X } from '@lucide/svelte';
  import { api } from '$lib/admin/api/client';
  import { currency, initCurrency } from '$lib/admin/currency';
  import { quotationMoney, quotationStatusChip, quotationStatusLabel } from '$lib/admin/quotations';
  import AdminButton from './AdminButton.svelte';
  import AdminFormInput from './AdminFormInput.svelte';
  import AdminSelect from './AdminSelect.svelte';
  import AdminTextArea from './AdminTextArea.svelte';

  export let open = false;
  export let quotation: Record<string, any> | null = null;
  export let prefill: Record<string, any> = {};
  export let tours: Array<Record<string, any>> = [];

  type Line = { key: number; label: string; amount: string; activity_id?: string };
  let requestedActivities: OptionalActivitySelection[] = [];
  let requestedError = '';
  let requestGeneration = 0;
  const loadRequestedActivities = async (id: string) => {
    const generation = ++requestGeneration; requestedActivities = []; requestedError = '';
    if (!id) return;
    const initialAdults = form.adults, initialChildren = form.children;
    try {
      const booking = await api.bookings.get(id);
      if (generation !== requestGeneration) return;
      const context = booking.data.lead_context as Record<string,unknown> | null;
      requestedActivities = Array.isArray(context?.optional_activities) ? context.optional_activities as OptionalActivitySelection[] : [];
      if (!quotation) {
        if (prefill.adults == null && form.adults === initialAdults) form.adults = String(booking.data.number_of_adults ?? 1);
        if (prefill.children == null && form.children === initialChildren) form.children = String(booking.data.number_of_children ?? 0);
      }
    }
    catch { if (generation === requestGeneration) requestedError = 'Could not load requested activities. Check the inquiry before sending this quotation.'; }
  };
  const addRequestedActivity = (item: OptionalActivitySelection) => {
    if (lines.some(line => line.activity_id === item.activity_id)) return;
    lines = [...lines, {key: ++lineSeq, activity_id:item.activity_id,label:`${item.name} (optional activity)`,amount:optionalQuotationAmount(item,Number(form.adults),Number(form.children),form.currency)}];
  };
  type Form = {
    title: string;
    tour_id: string;
    travel_date: string;
    adults: string;
    children: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    currency: string;
    total_amount: string;
    valid_until: string;
    notes: string;
    /** One per line. Stored as string arrays; edited as text because that is
        how an agent actually writes a list. */
    inclusions: string;
    exclusions: string;
    deposit_amount: string;
    payment_terms: string;
  };

  // The detail payloads stay loose: both consumers keep their own, stricter idea
  // of what a quotation row looks like, and a shared editor has no business
  // forcing one of them onto the other.
  const dispatch = createEventDispatcher<{
    saved: { quotation: any };
    sent: { outcome: any; quotation: any };
    close: void;
  }>();

  // Lifted from AdminFormInput so the money fields can carry a step and stay
  // plain strings — Svelte coerces a bound type="number" input to a number and
  // rewrites what is in the box mid-keystroke, which a price should never do.
  // Width is deliberately NOT in the base. It used to be, and `w-32` on the
  // amount input lost the collision to `w-full` — Tailwind decides that by
  // stylesheet order, not by the order classes appear on the element — so the
  // amount took the whole row and squeezed the description to nothing.
  const fieldBase =
    'h-11 min-w-0 rounded-md border border-ink/15 bg-black/[0.02] px-3.5 text-sm text-ink outline-none transition placeholder:text-ink/35 hover:border-ink/25 focus:border-forest focus:bg-surface focus:ring-2 focus:ring-forest/20';
  const fieldClass = `${fieldBase} w-full`;
  const amountClass = `${fieldBase} w-28 shrink-0 text-right tabular-nums`;
  const labelClass = 'text-[11px] font-bold uppercase tracking-[0.12em] text-ink/45';
  const hintClass = 'text-xs leading-5 text-ink/55';

  const emptyForm = (): Form => ({
    title: '',
    tour_id: '',
    travel_date: '',
    adults: '1',
    children: '0',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    currency: 'USD',
    total_amount: '',
    valid_until: '',
    notes: '',
    inclusions: '',
    exclusions: '',
    deposit_amount: '',
    payment_terms: ''
  });

  let form: Form = emptyForm();
  let lines: Line[] = [];
  let lineSeq = 0;
  let errors = { title: '', total: '' };
  let apiError = '';
  let saving = false;
  let sending = false;

  /**
   * True once the full row has been read back from the API. Until it is, the
   * form may be showing only the subset a caller happened to have, so saving
   * would write blanks over fields it never loaded.
   */
  let hydrated = false;

  /**
   * The record as it currently exists on the server, which is not always the
   * `quotation` prop: a create that saved but then failed to send must edit
   * that new row rather than create a second one on the next attempt.
   */
  let current: Record<string, any> | null = null;

  /**
   * Set only while there is saved work the parent has not been told about yet —
   * a create that succeeded and then failed to send. It is cleared the moment a
   * `saved` or `sent` goes out, so closing the modal never re-reports work the
   * parent has already handled.
   */
  let persisted = false;

  /**
   * What the form looked like when it was last in step with the server, so a
   * send can tell "the agent revised this" from "the agent pressed resend".
   */
  let baseline = '';

  const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));
  const numText = (value: unknown, fallback: string) =>
    value === null || value === undefined || value === '' ? fallback : String(value);
  const dateOnly = (value: unknown) => (value ? String(value).slice(0, 10) : '');
  const newLine = (): Line => ({ key: (lineSeq += 1), label: '', amount: '' });

  // Reactive rather than a plain const: the hints below the total read the
  // currency through it, and only a dependency on `form` re-renders them when
  // the agent switches currency without touching the numbers.
  $: money = (amount: number) => quotationMoney(amount, form.currency);

  const fmtDateTime = (value: unknown) =>
    value
      ? new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
          new Date(String(value))
        )
      : '';

  const ensureCurrencies = () => {
    if (!$currency.loading && $currency.status === 'missing') void initCurrency();
  };

  /**
   * The operator's own deposit policy, and their standard terms.
   *
   * A quotation that goes out with no deposit and no terms cannot later be
   * turned into a payment request — there is nothing to ask for and nothing to
   * tell the traveller about how to pay. That was only discovered days later,
   * on a booking nobody could chase.
   *
   * So the fields fill themselves from a policy set once in Settings. Not a
   * number invented here: 30% is the seeded default, and it is the operator's
   * to change. Everything below stays overridable per quotation.
   */
  let depositPercent = 30;
  let defaultTerms = '';
  let policyLoaded = false;

  /** True once the agent types in the deposit box — after that, hands off. */
  let depositTouched = false;

  const loadPolicy = async () => {
    if (policyLoaded) return;
    policyLoaded = true;
    try {
      const rows = (await api.settings.byGroup('booking')).data ?? [];
      for (const row of rows as Array<Record<string, any>>) {
        if (row.setting_key === 'default_deposit_percent') {
          const parsed = Number(row.setting_value);
          if (Number.isFinite(parsed) && parsed > 0 && parsed <= 100) depositPercent = parsed;
        }
        if (row.setting_key === 'default_payment_terms' && typeof row.setting_value === 'string') {
          defaultTerms = row.setting_value;
        }
      }
    } catch {
      // Keep the built-in default. A settings hiccup must not stop an agent
      // writing a quotation.
    }
  };

  const roundMoney = (value: number) => Math.round(value * 100) / 100;

  /** Set the deposit to a percentage of the current total. */
  const applyPercent = (percent: number) => {
    if (!(totalValue > 0)) return;
    form.deposit_amount = String(roundMoney((totalValue * percent) / 100));
    depositTouched = true;
  };

  const useFullAmount = () => {
    if (!(totalValue > 0)) return;
    form.deposit_amount = String(roundMoney(totalValue));
    depositTouched = true;
  };

  // Keep the deposit in step with the total until the agent takes it over.
  // Without this, changing the price after setting a deposit silently leaves a
  // figure that no longer matches the trip.
  $: if (!depositTouched && totalValue > 0 && depositPercent > 0) {
    form.deposit_amount = String(roundMoney((totalValue * depositPercent) / 100));
  }

  /** What the agent is about to send out, checked before they send it. */
  $: depositMissing = String(form.deposit_amount ?? '').trim() === '';
  $: termsMissing = form.payment_terms.trim() === '';

  /** jsonb string array <-> one-per-line textarea, in both directions. */
  const linesFrom = (value: unknown): string =>
    Array.isArray(value) ? value.map((v) => String(v ?? '').trim()).filter(Boolean).join('\n') : '';

  const linesTo = (value: string): string[] =>
    value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  const seed = () => {
    const source: Record<string, any> = quotation ?? prefill ?? {};
    current = quotation ? { ...quotation } : null;
    persisted = false;
    apiError = '';
    errors = { title: '', total: '' };
    form = {
      title: text(source.title),
      tour_id: text(source.tour_id),
      travel_date: dateOnly(source.travel_date),
      adults: numText(source.adults, '1'),
      children: numText(source.children, '0'),
      customer_name: text(source.customer_name),
      customer_phone: text(source.customer_phone),
      customer_email: text(source.customer_email),
      currency: text(source.currency) || 'USD',
      total_amount: numText(source.total_amount, ''),
      valid_until: dateOnly(source.valid_until),
      notes: text(source.notes),
      inclusions: linesFrom(source.inclusions),
      exclusions: linesFrom(source.exclusions),
      deposit_amount: numText(source.deposit_amount, ''),
      // A quotation that already carries terms keeps them; a new one starts
      // from the operator's standard wording rather than an empty box that
      // quietly ships as null.
      payment_terms: text(source.payment_terms) || (quotation ? '' : defaultTerms)
    };
    // An existing deposit is the agent's decision and must not be recomputed
    // out from under them when the total is edited. A blank one is still ours
    // to fill.
    depositTouched = source.deposit_amount != null && String(source.deposit_amount).trim() !== '';
    const existing = Array.isArray(quotation?.items) ? (quotation?.items as Array<Record<string, any>>) : [];
    lines = existing.length
      ? existing.map((item) => ({
          key: (lineSeq += 1),
          label: text(item?.label ?? item?.title),
          activity_id: item?.activity_id,
          amount: numText(item?.amount, '')
        }))
      : [newLine()];
    baseline = snapshot();
    void loadRequestedActivities(text(source.booking_request_id));
    ensureCurrencies();
    // `hydrated` also stops the recursion: hydrate() re-seeds with the full row.
    if (quotation?.id && !hydrated) void hydrate(String(quotation.id));
  };

  /**
   * Re-read the quotation in full before letting anyone edit it.
   *
   * The prop cannot be trusted to be the whole row: the WhatsApp inbox lists
   * threads with a projection that carries no items, notes, travel date or
   * contact details. Seeding from that and saving would write the blanks back
   * over a document a traveller has already been shown a price on. So the
   * prop paints the form immediately — the agent sees something at once — and
   * the authoritative row replaces it a moment later.
   */
  const hydrate = async (id: string) => {
    const forId = seededFor;
    try {
      const full = (await api.quotations.get(id)).data as Record<string, any>;
      // Abandon a response that arrived after the agent moved on, or after
      // they had started typing into the form we were about to overwrite.
      if (seededFor !== forId || snapshot() !== baseline) return;
      quotation = full;
      hydrated = true;
      seed();
    } catch {
      // Leave the form as the prop painted it. Saving is still guarded by
      // `hydrated`, so a partial row cannot be written back.
    }
  };

  // Re-seed on every open, and on being handed a different quotation while
  // already open. Keyed on the id alone so a parent that refreshes its list
  // behind the modal cannot overwrite what the agent is halfway through typing.
  let seededFor = '';
  $: seedKey = open ? String(quotation?.id ?? 'new') : '';
  $: if (seedKey !== seededFor) {
    seededFor = seedKey;
    hydrated = false;
    // Fetched before seeding so a new quotation is painted with the operator's
    // standard terms rather than briefly showing an empty box.
    if (open) void loadPolicy().then(seed);
  }

  $: busy = saving || sending;
  $: alreadySent = Boolean(current?.sent_at);
  // Either channel can carry it, so either contact detail is enough. Gating
  // on the phone number alone would hide the email route from a traveller who
  // only ever gave us an address.
  $: canSend = form.customer_phone.trim() !== '' || form.customer_email.trim() !== '';
  $: tourOptions = [
    { label: 'No linked tour', value: '' },
    ...tours.map((tour) => ({ label: String(tour.title ?? tour.slug ?? 'Untitled'), value: String(tour.id) }))
  ];

  /**
   * The store is the site's only list of real currencies and it arrives
   * asynchronously, so a quotation already written in a code that has not
   * loaded yet keeps its own option rather than being silently rewritten.
   */
  $: currencyOptions = (() => {
    const options = $currency.supportedCurrencies
      .filter((item) => item.enabled)
      .map((item) => ({ label: `${item.code} — ${item.name}`, value: item.code }));
    if (form.currency && !options.some((option) => option.value === form.currency)) {
      options.unshift({ label: form.currency, value: form.currency });
    }
    return options;
  })();

  $: pricedLines = lines.filter((line) => line.amount.trim() !== '' && Number.isFinite(Number(line.amount)));
  $: lineSum = pricedLines.reduce((sum, line) => sum + Number(line.amount), 0);
  $: totalValue = Number(form.total_amount);
  $: totalDiffers =
    pricedLines.length > 0 &&
    form.total_amount.trim() !== '' &&
    Number.isFinite(totalValue) &&
    Math.abs(totalValue - lineSum) >= 0.005;

  // The server refuses to put a lapsed price in front of a traveller, so say so
  // here rather than letting the agent discover it by failing to send.
  $: validUntilLapsed = form.valid_until !== '' && form.valid_until < new Date().toISOString().slice(0, 10);
  $: alreadyDelivered = Boolean(current && ['sent', 'viewed'].includes(String(current.status)));

  const addLine = () => {
    lines = [...lines, newLine()];
  };

  const removeLine = (key: number) => {
    lines = lines.filter((line) => line.key !== key);
  };

  const setLine = (key: number, field: 'label' | 'amount', value: string) => {
    lines = lines.map((line) => (line.key === key ? { ...line, [field]: value } : line));
  };

  const validate = () => {
    errors = { title: '', total: '' };
    if (!form.title.trim()) errors.title = 'The traveller reads this as the heading, so it cannot be blank.';
    if (form.total_amount.trim() === '' || !Number.isFinite(totalValue) || totalValue < 0) {
      errors.total = 'Enter the total this traveller is being quoted.';
    }
    if (lines.some(line => line.activity_id && (line.amount.trim() === '' || !Number.isFinite(Number(line.amount)) || Number(line.amount) < 0))) errors.total = 'Confirm the price of each requested activity before saving or sending this quotation.';
    return !errors.title && !errors.total;
  };

  /** Rows the agent started and abandoned are not line items. */
  const cleanItems = () =>
    lines
      .map((line) => ({ label: line.label.trim(), amount: line.amount.trim(), activity_id: line.activity_id }))
      .filter((line) => line.label !== '' || line.amount !== '')
      .map((line) => ({
        ...(line.activity_id ? { activity_id: line.activity_id } : {}),
        label: line.label,
        amount: line.amount === '' || !Number.isFinite(Number(line.amount)) ? null : Number(line.amount)
      }));

  /**
   * Deliberately built from the form rather than from `payload()`: it has to be
   * readable synchronously inside `seed()`, before any reactive value derived
   * from the new form has been recomputed. Blank rows the agent added and never
   * filled in are not a change to the document, which is why it goes through
   * `cleanItems()`.
   */
  const snapshot = () => JSON.stringify({ form, items: cleanItems() });

  /**
   * Who the quotation is for is only accepted at creation — the update endpoint
   * deliberately does not take those fields, because a quotation is a document
   * and it keeps saying who it was quoted to.
   */
  const payload = () => ({
    ...(current
      ? {}
      : {
          conversation_id: prefill.conversation_id ?? null,
          booking_request_id: prefill.booking_request_id ?? null,
          customer_name: form.customer_name.trim() || null,
          customer_phone: form.customer_phone.trim() || null,
          customer_email: form.customer_email.trim() || null
        }),
    tour_id: form.tour_id || null,
    title: form.title.trim(),
    currency: form.currency,
    adults: Number(form.adults) || 0,
    children: Number(form.children) || 0,
    travel_date: form.travel_date || null,
    items: cleanItems(),
    total_amount: totalValue,
    notes: form.notes.trim() || null,
    valid_until: form.valid_until || null,
    inclusions: linesTo(form.inclusions),
    exclusions: linesTo(form.exclusions),
    // An empty box means "not stated", which is not the same as a deposit of
    // zero — the traveller's page hides the block entirely for null.
    deposit_amount: form.deposit_amount.trim() === '' ? null : Number(form.deposit_amount),
    payment_terms: form.payment_terms.trim() || null
  });

  const persist = async () => {
    // Refuse to overwrite a row we only ever saw part of.
    if (current?.id && !hydrated) {
      throw new Error('Still loading this quotation — give it a moment and try again.');
    }

    const res = current
      ? await api.quotations.update(String(current.id), payload())
      : await api.quotations.create(payload());
    // The API answers with the whole row, so from here the form is complete
    // even if it started from a projection.
    current = res.data as Record<string, any>;
    hydrated = true;
    persisted = true;
    baseline = snapshot();
    return current;
  };

  const saveOnly = async () => {
    if (busy || !validate()) return;
    saving = true;
    apiError = '';
    try {
      const saved = await persist();
      persisted = false;
      dispatch('saved', { quotation: saved });
    } catch (error) {
      apiError = error instanceof Error ? error.message : 'Unable to save the quotation.';
    } finally {
      saving = false;
    }
  };

  const saveAndSend = async () => {
    if (busy || !canSend || !validate()) return;
    sending = true;
    apiError = '';
    try {
      // "Resend link" on an untouched quotation must not PUT first. The update
      // endpoint messages the traveller whenever the row is already sent or
      // viewed, and its dedupe key includes the `updated_at` that the PUT
      // itself rewrites — so a save-then-send would tell the traveller their
      // quotation was revised, then send them the link, for one click that
      // changed nothing.
      const saved = current && snapshot() === baseline ? current : await persist();
      const res = await api.quotations.send(String(saved.id), {
        phone: form.customer_phone.trim(),
        resend: alreadySent
      });
      const outcome = ((res.data as Record<string, any>)?.outcome ?? {}) as Record<string, any>;

      // Only the server knows whether the send moved the row to 'sent', so read
      // it back instead of assuming; the saved copy is the honest fallback.
      let record = saved;
      if (outcome.status === 'sent') {
        try {
          record = (await api.quotations.get(String(saved.id))).data as Record<string, any>;
          current = record;
        } catch {
          // Its status is a moment stale, nothing more.
        }
      }
      persisted = false;
      dispatch('sent', { quotation: record, outcome });
    } catch (error) {
      apiError = error instanceof Error ? error.message : 'Unable to send the quotation.';
    } finally {
      sending = false;
    }
  };

  /**
   * A quotation that saved but failed to send is still a real quotation, and
   * leaving by the back door is the parent's only chance to hear about it — so
   * report it first. But `close` always goes out afterwards: it is the only
   * signal a parent has that the modal is finished with, and swallowing it in
   * favour of `saved` left the quotations page with no way to dismiss the
   * editor once anything had been written.
   */
  const requestClose = () => {
    if (busy) return;
    if (persisted && current) {
      persisted = false;
      dispatch('saved', { quotation: current });
    }
    dispatch('close');
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && open) requestClose();
  };
</script>



{#if open}
  <CmsDialog.Root open={true} onOpenChange={(next) => { if (!next) (requestClose)(); }}>
    <CmsDialog.Content onInteractOutside={(event) => event.preventDefault()} showCloseButton={false} class="cms-editor-dialog gap-0 p-0 overflow-hidden max-h-[92dvh]" style="width:min(calc(100vw - 2rem),48rem);max-width:none">
      <CmsDialog.Title class="sr-only">Edit quotation</CmsDialog.Title>
      <CmsDialog.Description class="sr-only">Review the details below. Save your changes or close to return to the list.</CmsDialog.Description>
      <form
      class="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm"
      novalidate
      
      on:submit|preventDefault={saveOnly}
    >
      <div class="flex items-start justify-between gap-4 border-b border-ink/10 bg-sand/30 p-5">
        <div class="min-w-0">
          {#if current}
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-mono text-sm font-bold text-heading">{current.quote_code}</span>
              <span class={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${quotationStatusChip(current.status)}`}
                >{quotationStatusLabel(current.status)}</span
              >
            </div>
            <h2 class="mt-1 truncate font-serif text-xl font-semibold text-heading">Edit quotation</h2>
            {#if current.sent_at}
              <p class="text-xs text-ink/50">Sent {fmtDateTime(current.sent_at)}{current.sent_via ? ` · ${current.sent_via}` : ''}</p>
            {/if}
          {:else}
            <p class={labelClass}>Quotation</p>
            <h2 class="mt-1 font-serif text-xl font-semibold text-heading">New quotation</h2>
          {/if}
        </div>
        <CmsButton variant="ghost"
          class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-ink/10 bg-surface text-ink shadow-sm transition hover:bg-sand"
          type="button"
          aria-label="Close"
          onclick={requestClose}><X size={18} /></CmsButton
        >
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <section class="grid gap-4 p-5">
          <div>
            <p class={labelClass}>Trip</p>
            <p class="mt-1 {hintClass}">What the traveller is being quoted for. The title is the heading they see.</p>
          </div>
          <div class="grid gap-1.5">
            <AdminFormInput
              label="Title"
              name="title"
              bind:value={form.title}
              placeholder="e.g. 7-day Northern Circuit safari for the Harrisons"
              required
            />
            {#if errors.title}<p class="text-[12px] font-medium text-red-600">{errors.title}</p>{/if}
          </div>

          {#if tours.length}
            <AdminSelect label="Tour" name="tour_id" bind:value={form.tour_id} options={tourOptions} />
          {:else if current?.tour?.title}
            <div class="grid gap-1">
              <span class="text-[13px] font-semibold text-ink/65">Tour</span>
              <p class="text-sm text-ink/70">{current.tour.title}</p>
            </div>
          {/if}

          <div class="grid gap-4 sm:grid-cols-3">
            <AdminFormInput label="Travel date" name="travel_date" type="date" bind:value={form.travel_date} />
            <AdminFormInput label="Adults" name="adults" type="number" min={0} bind:value={form.adults} />
            <AdminFormInput label="Children" name="children" type="number" min={0} bind:value={form.children} />
          </div>
        </section>

        <section class="grid gap-4 border-t border-ink/10 p-5">
          <div>
            <p class={labelClass}>Who it is for</p>
            <p class="mt-1 {hintClass}">Where the quotation is delivered. Either a WhatsApp number or an email address is enough.</p>
          </div>
          {#if current}
            {#if form.customer_name || form.customer_phone || form.customer_email}
              <dl class="grid gap-px overflow-hidden rounded-md border border-ink/10 bg-ink/10 sm:grid-cols-3">
                {#if form.customer_name}
                  <div class="grid gap-0.5 bg-surface px-3 py-2">
                    <dt class="text-[11px] font-semibold text-ink/45">Name</dt>
                    <dd class="truncate text-sm text-ink/80">{form.customer_name}</dd>
                  </div>
                {/if}
                {#if form.customer_phone}
                  <div class="grid gap-0.5 bg-surface px-3 py-2">
                    <dt class="text-[11px] font-semibold text-ink/45">WhatsApp</dt>
                    <dd class="truncate text-sm text-ink/80">{form.customer_phone}</dd>
                  </div>
                {/if}
                {#if form.customer_email}
                  <div class="grid gap-0.5 bg-surface px-3 py-2">
                    <dt class="text-[11px] font-semibold text-ink/45">Email</dt>
                    <dd class="truncate text-sm text-ink/80">{form.customer_email}</dd>
                  </div>
                {/if}
              </dl>
              <p class="text-xs text-ink/55">
                Captured when the quotation was created and kept as part of the record, so it cannot be changed here.
              </p>
            {:else}
              <p class="text-sm text-ink/60">No WhatsApp number or email address was recorded on this quotation, so it cannot be sent from here.</p>
            {/if}
          {:else}
            <div class="grid gap-4 sm:grid-cols-2">
              <AdminFormInput label="Customer name" name="customer_name" bind:value={form.customer_name} />
              <AdminFormInput label="Email" name="customer_email" type="email" bind:value={form.customer_email} />
            </div>
            <div class="grid gap-1.5">
              <AdminFormInput label="Phone" name="customer_phone" bind:value={form.customer_phone} placeholder="+255…" />
              <p class="text-xs text-ink/55">The quotation is delivered to this number on WhatsApp.</p>
            </div>
          {/if}
        </section>

        {#if requestedActivities.length || requestedError}
        <section class="grid gap-3 border-t border-ink/10 bg-sun/5 p-5">
         <h3 class="text-sm font-semibold text-heading">Requested optional activities</h3>
         <p class="text-xs leading-5 text-ink/60">Selected by the customer; rates were captured at inquiry time. Add confirmed experiences to the quotation breakdown and review the final total. Blank amounts need a confirmed price or currency conversion.</p>
         {#if requestedError}<p role="alert" class="text-sm text-red-700">{requestedError}</p>{/if}
         {#each requestedActivities as item (item.activity_id)}
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-surface p-3">
           <div><p class="text-sm font-semibold">{item.name}</p><p class="mt-1 text-xs text-ink/60">{!item.additional_cost ? 'No additional cost' : item.price === null ? 'Price on request' : `${item.currency} ${item.price} ${item.price_type?.replaceAll('_',' ')}`}</p></div>
           <CmsButton type="button" variant="outline" size="sm" disabled={lines.some(line => line.activity_id === item.activity_id)} onclick={() => addRequestedActivity(item)}>{lines.some(line => line.activity_id === item.activity_id) ? 'Added to quotation' : 'Add to quotation'}</CmsButton>
          </div>
         {/each}
        </section>
        {/if}
        <section class="grid gap-3 border-t border-ink/10 p-5">
          <div>
            <p class={labelClass}>What's included</p>
            <p class="mt-1 {hintClass}">
              Optional. Break the price down so the traveller can see what they are paying for — park fees, lodges, a private
              guide. Leave it empty and they simply see the total.
            </p>
          </div>
          {#if lines.length}
            <div class="grid gap-2">
              <div class="flex items-center gap-2 pr-[52px]">
                <span class="flex-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink/40">Description</span>
                <span class="w-28 shrink-0 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-ink/40">
                  Amount ({form.currency})
                </span>
              </div>
              {#each lines as line, index (line.key)}
                <div class="flex items-center gap-2">
                  <CmsInput
                    class={`${fieldClass} flex-1`}
                    type="text"
                    value={line.label}
                    placeholder="e.g. Park fees for 4 nights"
                    aria-label={`Line ${index + 1} description`}
                    oninput={(event) => setLine(line.key, 'label', event.currentTarget.value)}
                  />
                  <CmsInput
                    class={amountClass}
                    type="number"
                    step="0.01"
                    min="0"
                    inputmode="decimal"
                    value={line.amount}
                    placeholder="0.00"
                    aria-label={`Line ${index + 1} amount`}
                    oninput={(event) => setLine(line.key, 'amount', event.currentTarget.value)}
                  />
                  <CmsButton variant="ghost"
                    class="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-ink/10 bg-surface text-ink/60 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    type="button"
                    aria-label={`Remove line ${index + 1}`}
                    onclick={() => removeLine(line.key)}><Trash2 size={15} /></CmsButton
                  >
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-sm text-ink/60">No line items — the traveller will see the total on its own.</p>
          {/if}
          <div>
            <AdminButton variant="ghost" size="sm" on:click={addLine}><Plus size={14} />Add line</AdminButton>
          </div>
        </section>

        <section class="grid gap-4 border-t border-ink/10 p-5">
          <div>
            <p class={labelClass}>Price</p>
            <p class="mt-1 {hintClass}">The total is what the traveller is quoted — it is not calculated from the lines above.</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            <AdminSelect label="Currency" name="currency" bind:value={form.currency} options={currencyOptions} />
            <CmsLabel class="grid min-w-0 gap-1.5">
              <span class="text-[13px] font-semibold text-ink/65">Total</span>
              <CmsInput
                class={fieldClass}
                name="total_amount"
                type="number"
                step="0.01"
                min="0"
                inputmode="decimal"
                value={form.total_amount}
                placeholder="0.00"
                required
                oninput={(event) => (form.total_amount = event.currentTarget.value)}
              />
            </CmsLabel>
            <AdminFormInput label="Valid until" name="valid_until" type="date" bind:value={form.valid_until} />
          </div>

          {#if errors.total}<p class="text-[12px] font-medium text-red-600">{errors.total}</p>{/if}

          {#if totalDiffers}
            <p class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-amber-200/70">
              <span>The lines add up to {money(lineSum)} but the total says {money(totalValue)}. The total is what the traveller is quoted, so leave it if that is deliberate.</span>
              <CmsButton variant="ghost"
                type="button"
                class="shrink-0 font-bold underline underline-offset-2 hover:no-underline"
                onclick={() => (form.total_amount = lineSum.toFixed(2))}
              >Use {money(lineSum)}</CmsButton>
            </p>
          {:else if pricedLines.length}
            <p class="text-xs text-ink/55">The lines add up to {money(lineSum)}.</p>
          {/if}

          {#if validUntilLapsed}
            <p class="rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-amber-200/70">
              That valid-until date has passed. Give it a new one before sending — the server will not deliver a lapsed price.
            </p>
          {/if}
        </section>

        <section class="grid gap-4 border-t border-ink/10 p-5">
          <div>
            <p class={labelClass}>What the price covers</p>
            <p class="mt-1 {hintClass}">
              One per line. Leave either box empty to hide it on the traveller's page — an empty heading is worse than no heading.
            </p>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <AdminTextArea
              label="Included"
              name="inclusions"
              rows={5}
              bind:value={form.inclusions}
              placeholder={'All park fees\nFull-board accommodation\nPrivate 4x4 with a guide'}
            />
            <!-- The list that prevents arguments. Worth its own box rather than
                 a line buried in the notes, where it reads as small print. -->
            <AdminTextArea
              label="Not included"
              name="exclusions"
              rows={5}
              bind:value={form.exclusions}
              placeholder={'International flights\nVisas\nTravel insurance\nTips'}
            />
          </div>
        </section>

        <section class="grid gap-4 border-t border-ink/10 p-5">
          <div>
            <p class={labelClass}>Payment</p>
            <p class="mt-1 {hintClass}">
              Shown on the quotation so accepting is an informed decision, and reused when you request payment on the booking. Nothing
              here takes money — it states what will be asked for.
            </p>
          </div>

          {#if totalValue > 0}
            <!-- One tap instead of arithmetic. The first is the operator's own
                 policy from Settings, not a figure invented here. -->
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-[12px] font-semibold text-ink/50">Deposit:</span>
              {#each [depositPercent, 50].filter((p, i, a) => p > 0 && p < 100 && a.indexOf(p) === i) as percent}
                <CmsButton variant="ghost"
                  type="button"
                  class="inline-flex h-8 items-center rounded-xl border border-ink/15 bg-surface px-3 text-xs font-semibold text-heading shadow-sm transition hover:bg-sand"
                  onclick={() => applyPercent(percent)}
                >{percent}% · {money(roundMoney((totalValue * percent) / 100))}</CmsButton>
              {/each}
              <CmsButton variant="ghost"
                type="button"
                class="inline-flex h-8 items-center rounded-xl border border-ink/15 bg-surface px-3 text-xs font-semibold text-heading shadow-sm transition hover:bg-sand"
                onclick={useFullAmount}
              >Full amount</CmsButton>
              {#if !depositMissing}
                <CmsButton variant="ghost"
                  type="button"
                  class="inline-flex h-8 items-center rounded-xl px-2.5 text-xs font-semibold text-ink/45 transition hover:text-red-600"
                  onclick={() => { form.deposit_amount = ''; depositTouched = true; }}
                >Clear</CmsButton>
              {/if}
            </div>
          {/if}
          <div class="grid gap-4 md:grid-cols-[10rem_1fr]">
            <!-- A raw input rather than AdminFormInput: money needs step="0.01",
                 which that component does not take — the same reason the total
                 above is written out longhand. -->
            <CmsLabel class="grid min-w-0 gap-1.5">
              <span class="text-[13px] font-semibold text-ink/65">Deposit to confirm</span>
              <CmsInput
                class={fieldClass}
                name="deposit_amount"
                type="number"
                step="0.01"
                min="0"
                inputmode="decimal"
                value={form.deposit_amount}
                placeholder="Optional"
                oninput={(event) => {
                  form.deposit_amount = event.currentTarget.value;
                  // Typing here is the agent taking the figure over. Without
                  // this the next edit to the total would recompute their
                  // deposit out from under them.
                  depositTouched = true;
                }}
              />
            </CmsLabel>
            <AdminFormInput
              label="Terms"
              name="payment_terms"
              bind:value={form.payment_terms}
              placeholder="e.g. 30% deposit to confirm, balance due 60 days before travel"
            />
          </div>

          {#if depositMissing || termsMissing}
            <!-- A nudge, not a block. Taking the full amount up front is a real
                 way to run a business, and so is settling the details on a
                 call. But leaving both blank is almost always an oversight —
                 and it only shows up days later, on a booking nobody can
                 chase for money it never named. -->
            <p class="rounded-md bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-800 ring-1 ring-amber-200/70">
              {#if depositMissing && termsMissing}
                No deposit or payment terms. The traveller won't see what's due, and you won't be able to request a deposit on the
                booking until one is set.
              {:else if depositMissing}
                No deposit set — requesting payment on this booking will ask for the full {money(totalValue)}.
              {:else}
                No payment terms, so the quotation won't say how to pay. You can still add them when you request payment.
              {/if}
            </p>
          {/if}
        </section>

        <section class="grid gap-2 border-t border-ink/10 p-5">
          <p class={labelClass}>Notes</p>
          <AdminTextArea
            label="Notes the traveller will read"
            name="notes"
            rows={3}
            bind:value={form.notes}
            placeholder="Anything worth saying alongside the price — how flexible the dates are, what happens next."
          />
        </section>
      </div>

      <div class="border-t border-ink/10 bg-sand/20 p-4">
        {#if apiError}
          <p class="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 ring-1 ring-red-200/70">{apiError}</p>
        {/if}
        {#if alreadyDelivered}
          <p class="mb-3 text-xs text-ink/55">
            The traveller already has this quotation, so saving a change here also tries to tell them it was revised.
          </p>
        {/if}
        {#if !canSend}
          <p class="mb-3 text-xs text-ink/55">Add a WhatsApp number or an email address to send this quotation.</p>
        {/if}
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <AdminButton variant="ghost" type="button" disabled={busy} on:click={requestClose}>Cancel</AdminButton>
          <AdminButton variant="secondary" type="submit" disabled={busy}>
            <Save size={15} />{saving ? 'Saving…' : current ? 'Save changes' : 'Save draft'}
          </AdminButton>
          <span class="inline-flex" title={canSend ? undefined : 'Add a WhatsApp number or an email address to send this quotation.'}>
            <AdminButton type="button" disabled={busy || !canSend} on:click={saveAndSend}>
              <MessageCircle size={15} />{sending ? 'Sending…' : alreadySent ? 'Resend link' : 'Save & send to traveller'}
            </AdminButton>
          </span>
        </div>
      </div>
    </form>
    </CmsDialog.Content>
  </CmsDialog.Root>
{/if}
