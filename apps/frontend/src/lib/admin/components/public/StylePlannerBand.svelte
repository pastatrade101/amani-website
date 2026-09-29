<script lang="ts">
  import { t } from '$lib/admin/i18n/ui';
  /**
   * The inline planner on a safari-style or safari-package page.
   *
   * Three short steps rather than one long form: the band sits between
   * sections, so asking nine questions at once would either dominate the page
   * or shrink the fields past usability. Each step is one row.
   *
   * It writes the same booking_request every other form does — same endpoint,
   * same honeypot, same idempotency key — so a lead from here reaches the
   * inbox looking like every other lead, tagged with the page it came from.
   *
   * Every word a traveller reads goes through the dictionary, the way the other
   * forms' do. The values it submits stay in English on purpose: they are read
   * by the team in the inbox, not by the traveller, and "Mittelklasse" in one
   * enquiry and "Mid-range" in the next would be two answers to one question.
   */
  import { tick } from 'svelte';
  import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Lock } from '@lucide/svelte';
  import { getAttribution, trackEvent } from '$lib/admin/analytics';
  import { api } from '$lib/admin/api/client';
  import { ACCOMMODATION, NOT_SURE } from '$lib/admin/enquiry/fields';

  /** Empty uses the translated default. */
  export let eyebrow = '';
  export let title: string;
  export let description = '';
  /** Real gateways from the CMS. An empty list hides the field rather than inventing one. */
  export let startPoints: Array<Record<string, unknown>> = [];
  /** Real categories, used for "main interest". */
  export let interests: Array<{ name: string; slug: string }> = [];
  export let categoryName = '';
  export let categorySlug = '';
  /**
   * The safari-package page this band is closing, when it is not a safari
   * style. Recorded under its own key rather than as `safari_style`: a package
   * is not a style, and an admin reading the lead should not be told it was.
   * Empty on a style page, where the two keys above carry the answer.
   */
  export let packageName = '';
  export let packageSlug = '';
  /**
   * The package's route options, labelled exactly as its route tabs are. Two
   * or more turn on a "Route option" field in the first step; one or none
   * leaves the step as it was, since a choice of one is not a question.
   */
  export let routeOptions: Array<{ label: string; tourTitle: string; tourSlug: string; tourDays?: number | null }> = [];
  /**
   * The route a traveller was last looking at in the tabs above. It fills the
   * field until they choose for themselves, so "Check this price for my date"
   * arrives at a form that already knows which option they meant.
   */
  export let suggestedRoute = '';

  type Field =
    | 'route'
    | 'travellers'
    | 'travelDate'
    | 'days'
    | 'startPoint'
    | 'comfort'
    | 'interest'
    | 'fullName'
    | 'email'
    | 'phone';

  const TOTAL = 3;
  let step = 1;
  let submitting = false;
  let submitted = false;
  let bookingCode = '';
  let formError = '';
  let errors: Partial<Record<Field, string>> = {};

  let stepFields: HTMLElement;
  let confirmation: HTMLElement;

  let travellers = '2';
  let travelDate = '';
  let days = '';
  let daysTouched = false;
  let routeChoice = '';
  let routeTouched = false;
  let startPoint = '';
  let comfort = '';
  let interest = '';
  let fullName = '';
  let email = '';
  let phone = '';
  let whatsappOptIn = false;
  let hp = '';

  const todayStr = new Date().toISOString().slice(0, 10);
  /** The lengths we actually sell — a free-text box invited "a couple of weeks". */
  const DAY_OPTIONS = Array.from({ length: 21 }, (_, index) => String(index + 1));

  /**
   * What the traveller reads for each comfort level. The value underneath
   * stays the shared English one, so this form's answers match every other
   * form's in the inbox.
   */
  const COMFORT_LABEL_KEYS: Record<string, string> = {
    Value: 'ui.comfort_value',
    'Mid-range': 'tier.mid_range',
    Luxury: 'tier.luxury'
  };
  // "Not sure yet" is added once below, translated — ACCOMMODATION carries its
  // own, and rendering both printed the option twice.
  const COMFORT_OPTIONS = ACCOMMODATION.filter((option) => option.value !== NOT_SURE);

  $: hasRouteOptions = routeOptions.length > 1;
  // No fallback list. The loader already filters to points whose role is start
  // or both, so an empty array means the CMS genuinely has none — and offering
  // a gateway this operator may not run from would put a preference in the
  // inbox that nobody can honour.
  $: hasStartPoints = startPoints.length > 0;
  $: if (!routeTouched && suggestedRoute && routeOptions.some((option) => option.label === suggestedRoute)) {
    routeChoice = suggestedRoute;
  }
  $: chosenRoute = routeOptions.find((option) => option.label === routeChoice);
  /**
   * A route's own length is the most likely answer to "how many days", so it
   * is filled in — until the traveller sets the number themselves.
   */
  $: if (!daysTouched && chosenRoute?.tourDays && DAY_OPTIONS.includes(String(chosenRoute.tourDays))) {
    days = String(chosenRoute.tourDays);
    // Filled in for them, so a "how many days?" left over from an earlier
    // attempt is no longer true and must not stay on screen.
    clearError('days');
  }

  $: stepLabel = $t('ui.step_x_of_y').replace('{step}', String(step)).replace('{total}', String(TOTAL));
  $: submitLabel = step === TOTAL ? $t('ui.start_my_trip_plan') : $t('ui.continue');

  const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const digitsIn = (value: string) => value.replace(/\D/g, '').length;

  /** The questions on each step, in the order a keyboard reaches them. */
  const fieldsFor = (index: number): Field[] =>
    index === 1
      ? [...(hasRouteOptions ? (['route'] as Field[]) : []), 'travellers', 'travelDate', 'days']
      : index === 2
        ? [...(hasStartPoints ? (['startPoint'] as Field[]) : []), 'comfort', 'interest']
        : ['fullName', 'email', 'phone'];

  const problemWith = (field: Field): string => {
    switch (field) {
      case 'route':
        return routeChoice ? '' : $t('ui.choose_the_route_option_you');
      case 'travellers': {
        const count = Number(travellers);
        return Number.isInteger(count) && count >= 1 ? '' : $t('ui.how_many_people_are_travelling');
      }
      case 'travelDate':
        if (!travelDate) return $t('ui.choose_the_date_you_would');
        return travelDate < todayStr ? $t('ui.that_date_has_already_passed') : '';
      case 'days':
        return days ? '' : $t('ui.how_many_days_would_you');
      case 'startPoint':
        return startPoint ? '' : $t('ui.where_would_you_like_to_start');
      case 'comfort':
        return comfort ? '' : $t('ui.choose_a_comfort_level');
      case 'interest':
        return interest ? '' : $t('ui.choose_what_interests_you_most');
      case 'fullName':
        return fullName.trim().length > 1 ? '' : $t('ui.please_enter_your_full_name');
      case 'email':
        return isEmail(email.trim()) ? '' : $t('ui.that_email_address_does_not');
      case 'phone':
        return digitsIn(phone) >= 6 ? '' : $t('ui.add_a_number_we_can');
    }
  };

  /** Checks one step and puts the keyboard on the first field that needs attention. */
  const validate = async (index: number): Promise<boolean> => {
    const found: Partial<Record<Field, string>> = {};
    for (const field of fieldsFor(index)) {
      const problem = problemWith(field);
      if (problem) found[field] = problem;
    }
    errors = found;
    const first = fieldsFor(index).find((field) => found[field]);
    if (!first) return true;
    await tick();
    stepFields?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
    trackEvent('form_validation_error', { metadata: { form: 'style_planner', step: index, field: first } });
    return false;
  };

  const clearError = (field: Field) => {
    if (!errors[field]) return;
    const { [field]: _drop, ...rest } = errors;
    errors = rest;
  };

  /**
   * Moving between steps puts the keyboard on the new step's first question,
   * so a keyboard or screen-reader user is not left on a button that has just
   * changed its meaning.
   */
  const focusStep = async () => {
    await tick();
    stepFields?.querySelector<HTMLElement>('[data-field]')?.focus();
  };

  const next = async () => {
    formError = '';
    if (!(await validate(step))) return;
    if (step < TOTAL) {
      step += 1;
      void focusStep();
    }
  };

  const back = () => {
    formError = '';
    errors = {};
    if (step > 1) {
      step -= 1;
      void focusStep();
    }
  };

  const submit = async () => {
    if (submitting) return;
    formError = '';
    if (!(await validate(TOTAL))) return;

    submitting = true;
    try {
      const res = await api.bookings.create({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        number_of_adults: Number(travellers) || 1,
        number_of_children: 0,
        // A real date from the picker, so the column gets one every time
        // rather than only when somebody happened to type one.
        travel_date: travelDate || null,
        source: 'category_enquiry',
        whatsapp_opt_in: whatsappOptIn,
        lead_context: {
          v: 1,
          form_type: 'style_planner',
          safari_style: categoryName || undefined,
          safari_style_slug: categorySlug || undefined,
          safari_package: packageName || undefined,
          safari_package_slug: packageSlug || undefined,
          // The tab name as the traveller saw it, plus the tour behind it —
          // "Option 2" alone means nothing to whoever opens the enquiry.
          route_option: hasRouteOptions ? routeChoice || undefined : undefined,
          route_option_tour: chosenRoute?.tourTitle || undefined,
          route_option_tour_slug: chosenRoute?.tourSlug || undefined,
          trip_days: days || undefined,
          starting_point: startPoint || undefined,
          comfort_level: comfort || undefined,
          main_interest: interest || undefined,
          attribution: getAttribution()
        },
        hp_company: hp
      });
      bookingCode = String((res.data as Record<string, unknown>)?.booking_code ?? '');
      submitted = true;
      trackEvent('request_trip_submitted', {
        metadata: { form: 'style_planner', safari_style_slug: categorySlug, safari_package_slug: packageSlug }
      });
      await tick();
      confirmation?.focus();
    } catch {
      // The API's own wording is written for developers and in English. The
      // fields were checked above, so what is left is a network or server
      // fault, and the traveller needs to know only that it did not go.
      formError = $t('ui.unable_to_send_your_message');
    } finally {
      submitting = false;
    }
  };

  const fieldBase =
    'h-11 w-full min-w-0 rounded-[10px] border bg-white px-3.5 text-[15px] text-heading outline-none transition placeholder:text-ink/45 focus:border-goldfinch-gold focus:ring-2 focus:ring-goldfinch-gold/25';
  // Light terracotta on the dark panel — the site's red reads as mud on olive.
  const fieldClass = (field: Field, extra = '') =>
    `${fieldBase} ${errors[field] ? 'border-[#F2B8A6] ring-2 ring-[#F2B8A6]/40' : 'border-white/20'} ${extra}`;
  const selectClass = (field: Field) => fieldClass(field, 'appearance-none pr-10');
  const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.10em] text-white/70';
  const hintClass = 'text-[11.5px] leading-5 text-white/55';
  const errorClass = 'text-[12px] font-semibold leading-5 text-[#F2B8A6]';
  const errorId = (field: Field) => `${packageSlug || categorySlug || 'planner'}-${field}-error`;
</script>

<section class="bg-surface py-10 md:py-14" class:package-planner={Boolean(packageSlug)}>
  <div class="container-shell">
    <div class="planner-panel relative overflow-hidden rounded-[12px] bg-deep-green p-6 text-white md:p-8">
      <div class="grid gap-6 lg:grid-cols-12 lg:items-center lg:gap-10">
    <div class="min-w-0 lg:col-span-4">
      <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-goldfinch-gold">{eyebrow || $t('ui.plan_this_experience')}</p>
      <h2 class="mt-2 font-serif text-2xl font-semibold leading-[1.15] md:text-[30px]">{title}</h2>
      {#if description}
        <p class="mt-2 text-[14px] leading-relaxed text-white/70">{description}</p>
      {/if}

      {#if !submitted}
        <!-- Progress reads as bars rather than numbered circles: three steps do
             not need the ceremony, and it keeps the left column short. -->
        <div class="mt-4 flex items-center gap-2">
          <span class="flex items-center gap-2" aria-hidden="true">
            {#each Array(TOTAL) as _, index}
              <span
                class="h-1.5 rounded-full transition-all duration-300 {index + 1 === step
                  ? 'w-8 bg-goldfinch-gold'
                  : index + 1 < step
                    ? 'w-4 bg-clay'
                    : 'w-4 bg-white/25'}"
              ></span>
            {/each}
          </span>
          <span aria-live="polite" class="ml-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">{stepLabel}</span>
        </div>
      {/if}
    </div>

    <div class="min-w-0 lg:col-span-8">
      {#if submitted}
        <div
          bind:this={confirmation}
          class="rounded-2xl border border-goldfinch-gold/30 bg-white/[0.06] p-6 outline-none"
          role="status"
          tabindex="-1"
        >
          <p class="font-serif text-2xl font-semibold">{$t('form.thank_you')}</p>
          {#if bookingCode}
            <p class="mt-2 text-sm text-white/75">{$t('form.your_reference_is')}<span class="font-bold text-goldfinch-gold">{bookingCode}</span>.</p>
          {/if}
          <p class="mt-2 text-sm leading-6 text-white/70">{$t('ui.a_local_specialist_will_shape')}</p>
        </div>
      {:else}
        <form novalidate on:submit|preventDefault={step === TOTAL ? submit : next}>
          <!-- Honeypot: named as nothing, so autofill has nothing to match. -->
          <div class="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
            <input type="text" name="gf-x1" tabindex="-1" autocomplete="off" bind:value={hp} />
          </div>

          <div bind:this={stepFields}>
          {#if step === 1}
            <!-- With a route field the row holds four, so Travellers — a one-
                 or two-digit number — gives up the width the other three need.
                 Between the phone and wide-desktop layouts it wraps two by two
                 rather than squeezing a date picker below its own text. -->
            <div class="grid items-start gap-4 {hasRouteOptions ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}" class:planner-row-four={hasRouteOptions}>
              {#if hasRouteOptions}
                <label class="grid gap-1.5">
                  <span class={labelClass}>{$t('ui.route_option')}</span>
                  <span class="relative block">
                    <select
                      class={selectClass('route')}
                      data-field="route"
                      bind:value={routeChoice}
                      on:change={() => { routeTouched = true; clearError('route'); }}
                      aria-invalid={Boolean(errors.route)}
                      aria-describedby={errors.route ? errorId('route') : undefined}
                    >
                      <option value="">{$t('ui.select')}</option>
                      {#each routeOptions as option (option.label)}
                        <option value={option.label}>{option.label}</option>
                      {/each}
                      <option value={NOT_SURE}>{$t('ui.not_sure_yet')}</option>
                    </select>
                    <ChevronDown class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink/65" size={18} />
                  </span>
                  {#if errors.route}<span id={errorId('route')} class={errorClass}>{errors.route}</span>{/if}
                </label>
              {/if}
              <label class="grid gap-1.5">
                <span class={labelClass}>{$t('ui.travellers')}</span>
                <input
                  class={fieldClass('travellers')}
                  data-field="travellers"
                  type="number"
                  min="1"
                  max="60"
                  step="1"
                  inputmode="numeric"
                  bind:value={travellers}
                  on:input={() => clearError('travellers')}
                  aria-invalid={Boolean(errors.travellers)}
                  aria-describedby={errors.travellers ? errorId('travellers') : undefined}
                />
                {#if errors.travellers}<span id={errorId('travellers')} class={errorClass}>{errors.travellers}</span>{/if}
              </label>
              <label class="grid gap-1.5">
                <span class={labelClass}>{$t('ui.travel_date')}</span>
                <!-- A picker rather than free text. Nothing in the past, since
                     a trip cannot start before today. -->
                <input
                  class={fieldClass('travelDate')}
                  data-field="travelDate"
                  type="date"
                  min={todayStr}
                  bind:value={travelDate}
                  on:input={() => clearError('travelDate')}
                  aria-invalid={Boolean(errors.travelDate)}
                  aria-describedby={errors.travelDate ? errorId('travelDate') : undefined}
                />
                {#if errors.travelDate}<span id={errorId('travelDate')} class={errorClass}>{errors.travelDate}</span>{/if}
              </label>
              <label class="grid gap-1.5">
                <span class={labelClass}>{$t('ui.number_of_days')}</span>
                <span class="relative block">
                  <select
                    class={selectClass('days')}
                    data-field="days"
                    bind:value={days}
                    on:change={() => { daysTouched = true; clearError('days'); }}
                    aria-invalid={Boolean(errors.days)}
                    aria-describedby={errors.days ? errorId('days') : undefined}
                  >
                    <option value="">{$t('ui.select')}</option>
                    {#each DAY_OPTIONS as option (option)}
                      <option value={option}>{option} {option === '1' ? $t('label.day') : $t('label.days')}</option>
                    {/each}
                  </select>
                  <ChevronDown class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink/65" size={18} />
                </span>
                {#if errors.days}<span id={errorId('days')} class={errorClass}>{errors.days}</span>{/if}
              </label>
            </div>
          {:else if step === 2}
            <div class="grid items-start gap-4 {hasStartPoints ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}">
              {#if hasStartPoints}
                <label class="grid gap-1.5">
                  <span class={labelClass}>{$t('ui.starting_point')}</span>
                  <span class="relative block">
                    <select
                      class={selectClass('startPoint')}
                      data-field="startPoint"
                      bind:value={startPoint}
                      on:change={() => clearError('startPoint')}
                      aria-invalid={Boolean(errors.startPoint)}
                      aria-describedby={errors.startPoint ? errorId('startPoint') : undefined}
                    >
                      <option value="">{$t('ui.select')}</option>
                      {#each startPoints as point}
                        <option value={String(point.name)}>{point.name}</option>
                      {/each}
                      <option value={NOT_SURE}>{$t('ui.not_sure_yet')}</option>
                    </select>
                    <ChevronDown class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink/65" size={18} />
                  </span>
                  {#if errors.startPoint}<span id={errorId('startPoint')} class={errorClass}>{errors.startPoint}</span>{/if}
                </label>
              {/if}
              <label class="grid gap-1.5">
                <span class={labelClass}>{$t('ui.comfort_level')}</span>
                <span class="relative block">
                  <select
                    class={selectClass('comfort')}
                    data-field="comfort"
                    bind:value={comfort}
                    on:change={() => clearError('comfort')}
                    aria-invalid={Boolean(errors.comfort)}
                    aria-describedby={errors.comfort ? errorId('comfort') : undefined}
                  >
                    <option value="">{$t('ui.select')}</option>
                    {#each COMFORT_OPTIONS as option (option.value)}
                      <option value={option.value}>{COMFORT_LABEL_KEYS[option.value] ? $t(COMFORT_LABEL_KEYS[option.value]) : option.label}</option>
                    {/each}
                    <option value={NOT_SURE}>{$t('ui.not_sure_yet')}</option>
                  </select>
                  <ChevronDown class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink/65" size={18} />
                </span>
                {#if errors.comfort}<span id={errorId('comfort')} class={errorClass}>{errors.comfort}</span>{/if}
              </label>
              <label class="grid gap-1.5">
                <span class={labelClass}>{$t('ui.main_interest')}</span>
                <span class="relative block">
                  <select
                    class={selectClass('interest')}
                    data-field="interest"
                    bind:value={interest}
                    on:change={() => clearError('interest')}
                    aria-invalid={Boolean(errors.interest)}
                    aria-describedby={errors.interest ? errorId('interest') : undefined}
                  >
                    <option value="">{$t('ui.select')}</option>
                    {#each interests as option}
                      <option value={option.name}>{option.name}</option>
                    {/each}
                    <option value={NOT_SURE}>{$t('ui.not_sure_yet')}</option>
                  </select>
                  <ChevronDown class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink/65" size={18} />
                </span>
                {#if errors.interest}<span id={errorId('interest')} class={errorClass}>{errors.interest}</span>{/if}
              </label>
            </div>
          {:else}
            <div class="grid items-start gap-4 sm:grid-cols-3">
              <label class="grid gap-1.5">
                <span class={labelClass}>{$t('ui.name')}</span>
                <input
                  class={fieldClass('fullName')}
                  data-field="fullName"
                  type="text"
                  autocomplete="name"
                  autocapitalize="words"
                  bind:value={fullName}
                  on:input={() => clearError('fullName')}
                  aria-invalid={Boolean(errors.fullName)}
                  aria-describedby={errors.fullName ? errorId('fullName') : undefined}
                />
                {#if errors.fullName}<span id={errorId('fullName')} class={errorClass}>{errors.fullName}</span>{/if}
              </label>
              <label class="grid gap-1.5">
                <span class={labelClass}>{$t('form.email')}</span>
                <input
                  class={fieldClass('email')}
                  data-field="email"
                  type="email"
                  inputmode="email"
                  autocomplete="email"
                  autocapitalize="off"
                  spellcheck="false"
                  placeholder="you@example.com"
                  bind:value={email}
                  on:input={() => clearError('email')}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? errorId('email') : undefined}
                />
                {#if errors.email}<span id={errorId('email')} class={errorClass}>{errors.email}</span>{/if}
              </label>
              <label class="grid gap-1.5">
                <span class={labelClass}>{$t('ui.whatsapp_number')}</span>
                <input
                  class={fieldClass('phone')}
                  data-field="phone"
                  type="tel"
                  inputmode="tel"
                  autocomplete="tel"
                  placeholder="+255 …"
                  bind:value={phone}
                  on:input={() => clearError('phone')}
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? errorId('phone') : `${errorId('phone')}-hint`}
                />
                {#if errors.phone}
                  <span id={errorId('phone')} class={errorClass}>{errors.phone}</span>
                {:else}
                  <span id={`${errorId('phone')}-hint`} class={hintClass}>{$t('ui.include_your_country_code')}</span>
                {/if}
              </label>
            </div>

            <!-- A WhatsApp number is not permission to use it, so it is asked
                 for separately here as it is on every other form. -->
            <label class="mt-3 flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" class="mt-0.5 h-4 w-4 shrink-0 accent-[#25D366]" bind:checked={whatsappOptIn} />
              <span class="text-xs leading-5 text-white/70">{$t('ui.contact_me_on_whatsapp_about')}<span class="text-white/45">{$t('ui.optional_we_reply_by_email')}</span>
              </span>
            </label>
          {/if}
          </div>

          {#if formError}
            <p class="mt-3 rounded-lg bg-clay/25 px-3 py-2 text-xs text-white" role="alert">{formError}</p>
          {/if}

          {#if step === TOTAL}
            <!-- On a phone the buttons fill the row, so the reassurance sits on
                 its own line above them instead of beside them. -->
            <p class="mt-4 flex items-center gap-1.5 text-[11.5px] text-white/55 sm:hidden">
              <Lock size={12} />{$t('form.never_shared')}
            </p>
          {/if}

          <div class="planner-actions mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            {#if step === TOTAL}
              <span class="mr-auto hidden items-center gap-1.5 text-[11.5px] text-white/55 sm:inline-flex">
                <Lock size={12} />{$t('form.never_shared')}
              </span>
            {/if}
            {#if step > 1}
              <button
                class="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-white/25 px-5 text-[13px] font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                type="button"
                disabled={submitting}
                on:click={back}
              ><ChevronLeft size={16} />{$t('form.back')}</button>
            {/if}
            <button
              class="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] bg-goldfinch-gold px-6 text-[13px] font-bold uppercase tracking-[0.08em] text-heading transition hover:bg-gold-hover disabled:opacity-60"
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
            >
              {#if submitting}
                <Loader2 size={16} class="animate-spin" /> {$t('ui.sending')}
              {:else}
                {submitLabel} <ChevronRight size={16} />
              {/if}
            </button>
          </div>
        </form>
      {/if}
    </div>
      </div>
    </div>
  </div>
</section>

<style>
  /* Route, travellers, date, days. Travellers holds a small number, so it
     takes the narrow track; the date picker keeps room for dd/mm/yyyy. */
  @media (min-width: 1280px) {
    .planner-row-four {
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.7fr) minmax(0, 1.15fr) minmax(0, 0.95fr);
    }
  }

  @media (max-width: 767px) {
    .package-planner { padding-block: 28px; }
    .package-planner .container-shell { width: calc(100% - 32px); }
    .package-planner .planner-panel { padding: 24px 16px; border-radius: 20px; }
    .package-planner input:not([type='checkbox']), .package-planner select { height: 50px; font-size: 16px; color: rgb(var(--c-forest)); }
    .package-planner .planner-actions { display: flex; flex-direction: row; }
    .package-planner .planner-actions button { min-height: 50px; height: auto; }
    .package-planner .planner-actions button[type='submit'] { flex: 1; padding-inline: 12px; color: rgb(var(--c-forest)); }
    .package-planner .planner-actions button[type='button'] { padding-inline: 14px; }
  }
</style>
