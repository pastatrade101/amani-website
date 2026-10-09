<script lang="ts">
	/**
	 * Plan my trip: a seven-step planner that suggests real trips as it goes.
	 * Every "Plan my safari" link lands here. The trip types, priorities,
	 * comfort levels, budget scale and season notes all come from Key2africa's
	 * own published catalogue (lib/planner/planner.ts). The request goes through
	 * the enquiry pipeline (the "plan" action, lib/server/plan-trip.ts).
	 */
	import { onMount, tick } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { ArrowLeft, ArrowRight, BedDouble, CalendarDays, Clock, Compass, Flag, Gauge, Heart, Lightbulb, LoaderCircle, Lock, MapPin, Minus, Pencil, Plus, Users, Wallet } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import SiteHeader from '$lib/components/home/site-header.svelte';
	import SiteFooter from '$lib/components/home/site-footer.svelte';
	import ChoiceCard from '$lib/components/planner/choice-card.svelte';
	import Progress from '$lib/components/planner/progress.svelte';
	import Sidebar, { type SoFarRow } from '$lib/components/planner/sidebar.svelte';
	import Success from '$lib/components/planner/success.svelte';
	import { siteInfo } from '$lib/site-info';
	import {
		CONTACTS, DIAL_CODES, LENGTHS, MAX_NOTES, MAX_PRIORITIES, MAX_TYPES, MONTH_NAMES, MONTH_SHORT, NOT_SURE, NOT_SURE_LABEL, PACES, PARTIES, STAGES,
		activeMonth, budgetText, comfortLabel, emptyAnswers, lengthLabel, namesText, notSure, paceLabel, partyLabel, stageLabel, travellersText, usd, whenText,
		type ContactId, type Named, type PartyId, type PlanAnswers
	} from '$lib/planner/options';
	import { bandDays, budgetScale, comfortOptions, plannerTips, poolFor, popularLength, recommend, seasonFor, seasonNote, startingAtOrUnder } from '$lib/planner/planner';
	import { cleanLine, phoneDigits, validEmail } from '$lib/planner/compose';
	import { createFormTracker } from '$lib/tracking/form-tracker';
	import { newTransactionId } from '$lib/tracking/data-layer';
	import { campaignTags, lastCta, visitDetails } from '$lib/tracking/attribution';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const STEPS = ['Trip type', 'Travellers', 'When', 'Length & pace', 'Preferences', 'Planning stage', 'Summary'];
	const STEP_KEYS = ['trip_type', 'travellers', 'when', 'length_pace', 'preferences', 'planning_stage', 'summary'];
	const LAST = STEPS.length - 1;

	const now = new Date();
	const thisYear = now.getFullYear();
	const years = [thisYear, thisYear + 1, thisYear + 2];
	const monthPast = (year: number, month: number) => year === thisYear && month < now.getMonth();
	// Today in the visitor's own time zone, as the date inputs read it.
	const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

	// A link from a tour, stay or destination page prefills what it can; none of it counts as a start.
	function initial(): PlanAnswers {
		const prefill = data.prefill;
		const a = emptyAnswers(thisYear);
		const type = data.types.find((item) => item.slug === prefill.type);
		if (type) a.types = [{ slug: type.slug, name: type.name }];
		const activity = data.priorities.find((item) => item.slug === prefill.priority);
		if (activity) a.priorities = [{ slug: activity.slug, name: activity.name }];
		if (prefill.party) {
			a.party = prefill.party;
			if (prefill.party === 'family') [a.children, a.childAges] = [1, [null]];
		}
		if (prefill.date) [a.dateMode, a.startDate, a.year] = ['exact', prefill.date, Number(prefill.date.slice(0, 4))];
		else if (prefill.year !== null && prefill.month !== null) [a.year, a.month] = [prefill.year, prefill.month];
		a.context = prefill.context;
		a.from = prefill.from;
		return a;
	}
	let a = $state<PlanAnswers>(initial());
	let step = $state(0);
	let dir = $state(1);
	let errors = $state<Record<string, string>>({});

	// Contact details: only asked on the last step, never sent to analytics.
	let fullName = $state('');
	let email = $state('');
	let dialCode = $state('');
	let phone = $state('');
	let notes = $state('');
	let honeypot = $state('');
	let requestKey = '';

	let submitting = $state(false);
	let submitted = $state(false);
	let reference = $state('');
	let recap = $state<{ label: string; value: string }[]>([]);
	let errorMessage = $state('');
	let card = $state<HTMLElement>();
	let nextButton = $state<HTMLElement | null>(null);

	// ── Tracking ────────────────────────────────────────────────────────────────
	// One tracker records the whole path: opened, first answer, each step passed,
	// what stopped a step, where it was left, and the lead. Only ids, bands and
	// step names leave the page, never what anyone typed.
	const tracker = createFormTracker({ form_name: 'plan_my_trip', form_type: 'trip_planner', lead_type: 'plan_my_trip' }, 'plan_my_trip_submitted');
	onMount(() => {
		// One key per page load: the backend treats a repeat of it as the same request.
		requestKey = crypto.randomUUID?.() ?? `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
		tracker.opened();
		return tracker.watchLeave();
	});
	$effect(() => tracker.at(step, STEP_KEYS[step]));
	/** Every answer handler calls this: the first one is the start. */
	const touch = () => tracker.started();
	const firstError = () => Object.keys(errors)[0] ?? 'unknown';

	// ── What the catalogue offers ───────────────────────────────────────────────
	let typeOptions = $derived<Named[]>([...data.types.map((type) => ({ slug: type.slug, name: type.name })), notSure()]);
	let priorityOptions = $derived<Named[]>([...data.priorities, notSure()]);
	let comfortChoices = $derived(comfortOptions(data.tours, data.stays));
	let scale = $derived(budgetScale(data.tours));
	let pool = $derived(poolFor(a, data.tours));
	let popular = $derived(popularLength(pool));
	let month = $derived(activeMonth(a));
	let season = $derived(month === null ? null : seasonFor(data.seasons, month));
	let recs = $derived(recommend(a, data.tours, data.stays));
	let tips = $derived(plannerTips(a, data.tours, data.seasons, comfortChoices, month));
	let sliderValue = $derived(a.budget ?? scale?.start ?? 0);
	let underBudget = $derived(scale ? startingAtOrUnder(pool, sliderValue) : 0);
	let pickedTypes = $derived(a.types.filter((type) => type.slug !== NOT_SURE).length);
	let pickedPriorities = $derived(a.priorities.filter((p) => p.slug !== NOT_SURE).length);
	const typeMeta = (slug: string) => {
		const type = data.types.find((item) => item.slug === slug);
		return type ? `${type.count} ${type.count === 1 ? 'trip' : 'trips'}${type.minDays ? ` · from ${type.minDays} days` : ''}` : '';
	};

	// ── The answers so far, as the sidebar and the summary show them ──────────────
	let when = $derived(whenText(a));
	let budget = $derived(budgetText(a));
	let rows = $derived<SoFarRow[]>(
		[
			{ key: 'trip', icon: Compass, label: 'Trip type', value: namesText(a.types), chips: a.types.map((type) => type.name) },
			{ key: 'interest', icon: MapPin, label: 'Interested in', value: a.context?.name ?? '', chips: [] },
			{ key: 'travellers', icon: Users, label: 'Travellers', value: travellersText(a), chips: [] },
			{ key: 'when', icon: CalendarDays, label: 'When', value: when && season && a.dateMode === 'flexible' ? `${when} · ${season.name}` : when, chips: [] },
			{ key: 'length', icon: Clock, label: 'Length', value: lengthLabel(a.length), chips: [] },
			{ key: 'pace', icon: Gauge, label: 'Pace', value: paceLabel(a.pace), chips: [] },
			{ key: 'priorities', icon: Heart, label: 'Priorities', value: namesText(a.priorities), chips: a.priorities.map((p) => p.name) },
			{ key: 'comfort', icon: BedDouble, label: 'Comfort', value: comfortLabel(a.comfort), chips: [] },
			{ key: 'budget', icon: Wallet, label: 'Budget', value: budget, chips: [] },
			{ key: 'stage', icon: Flag, label: 'Planning stage', value: stageLabel(a.stage), chips: [] }
		].filter((row) => row.value)
	);
	let review = $derived([
		{ label: 'Trip type', value: namesText(a.types), at: 0 },
		{ label: 'Travellers', value: travellersText(a), at: 1 },
		{ label: 'When', value: when, at: 2 },
		{ label: 'Length & pace', value: [lengthLabel(a.length), paceLabel(a.pace)].filter(Boolean).join(' · '), at: 3 },
		{ label: 'Preferences', value: [namesText(a.priorities), comfortLabel(a.comfort), budget].filter(Boolean).join(' · '), at: 4 },
		{ label: 'Planning stage', value: stageLabel(a.stage), at: 5 }
	]);

	// ── Answering ───────────────────────────────────────────────────────────────
	const clear = (...keys: string[]) => {
		if (keys.some((key) => errors[key])) errors = Object.fromEntries(Object.entries(errors).filter(([key]) => !keys.includes(key)));
	};
	/** "Not sure yet" stands alone; otherwise up to MAX_TYPES kinds. */
	function toggleType(option: Named) {
		const rest = a.types.filter((type) => type.slug !== NOT_SURE);
		if (option.slug === NOT_SURE) a.types = a.types.some((type) => type.slug === NOT_SURE) ? [] : [notSure()];
		else if (rest.some((type) => type.slug === option.slug)) a.types = rest.filter((type) => type.slug !== option.slug);
		else if (rest.length < MAX_TYPES) a.types = [...rest, option];
		clear('types');
		touch();
	}
	function pickParty(id: PartyId) {
		a.party = id;
		// A family usually travels with a child; the counter can take it back to none.
		if (id === 'family' && a.children === 0) setChildren(1);
		clear('party');
		touch();
	}
	const setAdults = (n: number) => ((a.adults = Math.max(1, Math.min(20, n))), touch());
	function setChildren(n: number) {
		a.children = Math.max(0, Math.min(20, n));
		a.childAges = Array.from({ length: a.children }, (_, i) => a.childAges[i] ?? null);
		touch();
	}
	function setAge(index: number, input: HTMLInputElement) {
		const digits = input.value.replace(/\D/g, '').slice(0, 2);
		a.childAges[index] = digits === '' ? null : Math.min(17, Number(digits));
		// Show exactly what is kept: digits only, 17 at most.
		input.value = a.childAges[index] === null ? '' : String(a.childAges[index]);
		touch();
	}
	function pickYear(year: number) {
		a.year = year;
		if (a.month !== null && monthPast(year, a.month)) a.month = null;
		touch();
	}
	function pickMonth(index: number) {
		[a.month, a.dateUnsure] = [index, false];
		clear('when');
		touch();
	}
	function toggleDateUnsure() {
		a.dateUnsure = !a.dateUnsure;
		if (a.dateUnsure) a.month = null;
		clear('when');
		touch();
	}
	function setDateMode(mode: PlanAnswers['dateMode']) {
		a.dateMode = mode;
		clear('when', 'start', 'end');
		touch();
	}
	function setStart(value: string) {
		a.startDate = value;
		// An end date before the new start is no longer an answer.
		if (a.endDate && value && a.endDate < value) a.endDate = '';
		clear('start', 'end');
		touch();
	}
	function setEnd(value: string) {
		a.endDate = value;
		clear('end');
		touch();
	}
	const pick = <K extends 'length' | 'pace' | 'comfort' | 'stage'>(key: K, value: PlanAnswers[K]) => {
		a[key] = value;
		clear(key);
		touch();
	};
	/** Up to MAX_PRIORITIES; "Not sure yet" replaces the rest. */
	function togglePriority(option: Named) {
		const rest = a.priorities.filter((p) => p.slug !== NOT_SURE);
		if (option.slug === NOT_SURE) a.priorities = a.priorities.some((p) => p.slug === NOT_SURE) ? [] : [notSure()];
		else if (rest.some((p) => p.slug === option.slug)) a.priorities = rest.filter((p) => p.slug !== option.slug);
		else if (rest.length < MAX_PRIORITIES) a.priorities = [...rest, option];
		touch();
	}
	function setBudget(value: number) {
		[a.budget, a.budgetUnsure] = [value, false];
		touch();
	}
	function setBudgetUnsure(value: boolean) {
		a.budgetUnsure = value;
		touch();
	}
	function setContact(id: ContactId) {
		a.contact = id;
		clear('phone');
		touch();
	}

	// ── Moving through the steps ──────────────────────────────────────────────────
	function validate(index: number): boolean {
		const e: Record<string, string> = {};
		if (index === 0 && !a.types.length) e.types = 'Choose at least one kind of trip, or “Not sure yet”.';
		if (index === 1 && !a.party) e.party = 'Tell us who’s travelling.';
		if (index === 2) {
			if (a.dateMode === 'flexible' && a.month === null && !a.dateUnsure) e.when = 'Pick a month, or “Not sure yet”.';
			if (a.dateMode === 'exact') {
				if (!a.startDate) e.start = 'Choose a start date.';
				else if (a.startDate < today) e.start = 'Choose a start date from today onwards.';
				if (a.endDate && a.startDate && a.endDate < a.startDate) e.end = 'The end date can’t be before the start date.';
			}
		}
		if (index === 3) {
			if (!a.length) e.length = 'Choose a trip length, or “Not sure yet”.';
			if (!a.pace) e.pace = 'Choose a pace, or “Not sure yet”.';
		}
		if (index === 4 && !a.comfort) e.comfort = 'Choose a comfort level, or “Not sure yet”.';
		if (index === 5 && !a.stage) e.stage = 'Tell us where you are with your plans.';
		if (index === LAST) {
			const name = cleanLine(fullName, 151);
			if (name.length < 2 || name.length > 150) e.full_name = 'Please enter your full name.';
			if (!validEmail(email.trim())) e.email = 'Please enter a valid email address.';
			const digits = phoneDigits(phone);
			// A number is only required when that is how they asked to be reached.
			if (digits || a.contact !== 'email') {
				if (!/^\d{6,14}$/.test(digits)) e.phone = 'Please enter a phone number of 6 to 14 digits.';
				else if (!dialCode) e.phone = 'Please choose the country code for your phone number.';
			}
		}
		errors = e;
		return !Object.keys(e).length;
	}

	const ms = (n: number) => (prefersReducedMotion.current ? 0 : n);
	/** A small shake of the button when a step still needs an answer. */
	const nudge = () =>
		!prefersReducedMotion.current &&
		nextButton?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: 380, easing: 'ease-out' });
	/** After a refused step: bring the first problem into view and put focus on it. */
	async function showFirstError() {
		await tick();
		card?.querySelector<HTMLElement>('[role="alert"]')?.scrollIntoView({ behavior: prefersReducedMotion.current ? 'auto' : 'smooth', block: 'center' });
		// A field marked invalid, or the first choice in a group that still needs an answer.
		card?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid] button:not(:disabled)')?.focus({ preventScroll: true });
	}
	async function goTo(index: number) {
		dir = index >= step ? 1 : -1;
		step = index;
		errorMessage = '';
		await tick();
		// Only scroll when the top of the card is out of sight; a short step should not jump.
		if (card && card.getBoundingClientRect().top < 0) card.scrollIntoView({ behavior: prefersReducedMotion.current ? 'auto' : 'smooth', block: 'start' });
		// Screen readers and keyboards land on the new step's question.
		card?.querySelector<HTMLElement>('[data-step-heading]')?.focus({ preventScroll: true });
	}
	function next() {
		if (validate(step)) {
			tracker.step(step, STEP_KEYS[step]);
			return goTo(Math.min(LAST, step + 1));
		}
		tracker.invalid(STEP_KEYS[step], firstError());
		nudge();
		showFirstError();
	}
	const back = () => goTo(Math.max(0, step - 1));
	/** Back to edit: only steps already passed, so nothing is skipped unchecked. */
	const edit = (index: number) => index < step && goTo(index);

	// ── Sending ───────────────────────────────────────────────────────────────────
	const travelDate = () => (a.dateMode === 'exact' ? a.startDate : a.month !== null && !a.dateUnsure ? `${a.year}-${String(a.month + 1).padStart(2, '0')}` : '');
	const submitPlan: SubmitFunction = ({ formData, cancel }) => {
		if (submitting) return cancel();
		if (!validate(LAST)) {
			tracker.invalid(STEP_KEYS[LAST], firstError());
			nudge();
			showFirstError();
			return cancel();
		}
		submitting = true;
		errorMessage = '';
		const plan = { ...$state.snapshot(a), suggested: recs.map((rec) => rec.tour.title), lastCta: lastCta(), campaign: visitDetails() };
		for (const [key, value] of Object.entries({ plan: JSON.stringify(plan), request_key: requestKey, full_name: fullName, email, dial_code: dialCode, phone, notes, company_website: honeypot })) formData.set(key, value);
		return async ({ result }) => {
			submitting = false;
			if (result.type === 'success' && result.data?.success) {
				reference = String(result.data.reference ?? '');
				recap = (result.data.recap as typeof recap) ?? [];
				submitted = true;
				// The lead, only now the server has it: generate_lead in Google, with
				// the trip's shape and campaign tags. Never a name, email or phone.
				tracker.submitted(
					{
						lead_source: 'plan_my_trip',
						// Random, for Google Ads de-duplication only: the K2A reference is tied to the traveller.
						transaction_id: newTransactionId(),
						traveller_type: a.party || undefined,
						duration_days: bandDays(a.length) || undefined,
						budget_range: a.budgetUnsure ? 'not_sure' : a.budget !== null ? `up_to_${a.budget}` : undefined,
						experience_type: a.types.map((type) => type.slug).join(',') || undefined,
						accommodation_level: a.comfort || undefined,
						destination: a.context?.slug
					},
					{ travel_date: travelDate(), cta_clicked: lastCta(), ...campaignTags() }
				);
				return;
			}
			const failure = result.type === 'failure' ? ((result.data ?? {}) as { message?: string; field?: string }) : {};
			tracker.failed(result.type === 'failure' && result.status === 429 ? 'rate_limited' : result.type === 'failure' && result.status === 400 ? 'server_validation' : 'submit_failed');
			if (failure.field && failure.message) {
				errors = { [failure.field]: failure.message };
				showFirstError();
			} else errorMessage = failure.message ?? 'We couldn’t send your plan right now. Your answers are still here; please try again shortly.';
		};
	};

	const fieldError = (key: string) => (errors[key] ? `${key}-error` : undefined);
	const pill = (on: boolean) => `pm-rise inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-navy transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${on ? 'border-sun bg-sun/15 font-semibold' : 'border-border bg-white hover:border-sun'}`;
	const description = `Tell us about the trip you have in mind and ${siteInfo.brand} will suggest safaris that fit, then plan yours with you.`;
</script>

<svelte:head>
	<title>Plan my trip | {siteInfo.company}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={`Plan my trip | ${siteInfo.brand}`} />
	<meta property="og:description" content={description} />
	<meta property="og:site_name" content={siteInfo.company} />
	<link rel="canonical" href={`${data.siteOrigin}/plan-my-trip`} />
</svelte:head>

<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-sun focus:p-4">Skip to content</a>
<SiteHeader visible={data.visible} activities={data.activities} destinations={data.destinations} onInterest={() => {}} tours={data.navTours} categories={data.categories} stays={data.navStays} onPage={['top']} />
<main id="main">
	<h1 id="top" class="sr-only">Plan my trip with {siteInfo.brand}</h1>
	{#if submitted}
		<Success {reference} {recap} />
	{:else}
		<div class="bg-secondary/70">
			<!-- items-start: each column keeps its own height. -->
			<div class="page-container grid items-start gap-6 py-8 md:py-14 lg:grid-cols-[minmax(0,1fr)_320px]">
				<div bind:this={card} class="min-w-0 scroll-mt-28 rounded-2xl border border-border bg-white p-5 shadow-[0_20px_60px_-30px_rgba(16,45,65,.2)] md:p-7">
					<Progress steps={STEPS} {step} onedit={edit} />

					{#key step}
						<div in:fly={{ x: 40 * dir, duration: ms(420), easing: cubicOut }}>
							{#if step === 0}
								<h2 data-step-heading tabindex="-1" class="lux-heading mt-3 !text-[1.9rem] outline-none md:!text-[2.3rem]">What kind of trip are you dreaming of?</h2>
								<p class="mt-2 text-[13px] text-muted-foreground">Choose up to {MAX_TYPES}. Each shows how many of our published trips it has.</p>
								{#if errors.types}<p class="mt-3 text-sm font-medium text-destructive" role="alert">{errors.types}</p>{/if}
								<div class="mt-5 grid gap-3 sm:grid-cols-2" role="group" aria-label="Trip type" data-invalid={errors.types ? '' : undefined}>
									{#each typeOptions as option, i (option.slug)}
										{@const on = a.types.some((type) => type.slug === option.slug)}
										<ChoiceCard selected={on} index={i} title={option.name} desc={option.slug === NOT_SURE ? 'Tell us what you enjoy and we’ll suggest a direction.' : ''} meta={typeMeta(option.slug)} disabled={!on && option.slug !== NOT_SURE && pickedTypes >= MAX_TYPES} onclick={() => toggleType(option)} />
									{/each}
								</div>
							{:else if step === 1}
								<h2 data-step-heading tabindex="-1" class="lux-heading mt-3 !text-[1.9rem] outline-none md:!text-[2.3rem]">Who’s travelling?</h2>
								{#if errors.party}<p class="mt-3 text-sm font-medium text-destructive" role="alert">{errors.party}</p>{/if}
								<div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" role="group" aria-label="Travellers" data-invalid={errors.party ? '' : undefined}>
									{#each PARTIES as option, i (option.id)}
										<ChoiceCard selected={a.party === option.id} index={i} title={option.label} desc={option.hint} onclick={() => pickParty(option.id)} />
									{/each}
								</div>
								{#if a.party === 'family' || a.party === 'group'}
									<div class="mt-5 grid gap-4 rounded-xl bg-secondary/70 p-4" transition:slide={{ duration: ms(300), easing: cubicOut }}>
										{#each [{ key: 'adults', label: 'Adults', min: 1, value: a.adults, set: setAdults }, { key: 'children', label: 'Children (under 18)', min: 0, value: a.children, set: setChildren }] as counter (counter.key)}
											<div class="flex items-center justify-between gap-3">
												<span class="text-sm font-medium text-navy">{counter.label}</span>
												<div class="flex items-center gap-3">
													<button type="button" class="grid size-11 place-items-center rounded-full border border-border bg-white disabled:opacity-40" aria-label={`Fewer ${counter.label.toLowerCase()}`} disabled={counter.value <= counter.min} onclick={() => counter.set(counter.value - 1)}><Minus class="size-4" /></button>
													<span class="w-6 text-center font-semibold text-navy" aria-live="polite">{counter.value}</span>
													<button type="button" class="grid size-11 place-items-center rounded-full border border-border bg-white disabled:opacity-40" aria-label={`More ${counter.label.toLowerCase()}`} disabled={counter.value >= 20} onclick={() => counter.set(counter.value + 1)}><Plus class="size-4" /></button>
												</div>
											</div>
										{/each}
										{#if a.children > 0}
											<div transition:slide={{ duration: ms(260), easing: cubicOut }}>
												<p class="text-xs text-muted-foreground">Children’s ages <span class="opacity-75">(optional, helps us check lodge age limits)</span></p>
												<div class="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
													{#each a.childAges as age, i (i)}
														<Input inputmode="numeric" maxlength={2} aria-label={`Age of child ${i + 1}`} placeholder={`Child ${i + 1}`} value={age === null ? '' : String(age)} oninput={(event) => setAge(i, event.currentTarget)} class="h-11 bg-white" />
													{/each}
												</div>
											</div>
										{/if}
									</div>
								{/if}
							{:else if step === 2}
								<h2 data-step-heading tabindex="-1" class="lux-heading mt-3 !text-[1.9rem] outline-none md:!text-[2.3rem]">When would you like to travel?</h2>
								<p class="mt-2 text-[13px] text-muted-foreground">A rough month is plenty. Each month shows its season.</p>
								<div class="mt-5 inline-grid grid-cols-2 rounded-xl bg-secondary p-1" role="group" aria-label="Date type">
									{#each [{ id: 'flexible', label: 'Flexible' }, { id: 'exact', label: 'Exact dates' }] as mode (mode.id)}
										<button type="button" aria-pressed={a.dateMode === mode.id} class={`h-11 rounded-lg px-4 text-sm font-semibold transition-colors ${a.dateMode === mode.id ? 'bg-white text-navy shadow-sm' : 'text-muted-foreground hover:text-navy'}`} onclick={() => setDateMode(mode.id === 'exact' ? 'exact' : 'flexible')}>{mode.label}</button>
									{/each}
								</div>
								{#if a.dateMode === 'flexible'}
									<div in:fade={{ duration: ms(240) }}>
										{#if errors.when}<p class="mt-3 text-sm font-medium text-destructive" role="alert">{errors.when}</p>{/if}
										<div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="Year">
											{#each years as year (year)}
												<button type="button" aria-pressed={a.year === year} class={`h-11 rounded-lg px-4 text-sm font-semibold ${a.year === year ? 'bg-navy text-white' : 'border border-border text-navy'}`} onclick={() => pickYear(year)}>{year}</button>
											{/each}
										</div>
										<div class="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" aria-label="Month" data-invalid={errors.when ? '' : undefined}>
											{#each MONTH_SHORT as label, i (label)}
												{@const past = monthPast(a.year, i)}
												{@const on = !a.dateUnsure && a.month === i}
												{@const covering = seasonFor(data.seasons, i)}
												<button type="button" disabled={past} aria-pressed={on} aria-label={`${MONTH_NAMES[i]} ${a.year}${covering ? `, ${covering.name}` : ''}`} style={`--i: ${i * 0.45}`} class={`pm-rise min-h-14 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${on ? 'border-sun bg-sun/15' : 'border-border bg-white hover:border-sun'}`} onclick={() => pickMonth(i)}>
													<span class="block text-sm font-semibold text-navy">{label}</span>
													{#if covering}<span class="mt-1 block truncate text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{covering.name}</span>{/if}
												</button>
											{/each}
										</div>
										<button type="button" aria-pressed={a.dateUnsure} class={`mt-3 h-12 w-full rounded-xl border text-sm font-semibold text-navy transition-colors ${a.dateUnsure ? 'border-sun bg-sun/15' : 'border-border bg-white hover:border-sun'}`} onclick={toggleDateUnsure}>{NOT_SURE_LABEL}</button>
									</div>
								{:else}
									<div class="mt-5 grid gap-4 sm:grid-cols-2" in:fade={{ duration: ms(240) }}>
										<div class="grid gap-1.5">
											<Label for="start-date">Start date <span class="text-destructive">*</span></Label>
											<Input id="start-date" type="date" min={today} value={a.startDate} onchange={(event) => setStart(event.currentTarget.value)} aria-invalid={errors.start ? 'true' : undefined} aria-describedby={fieldError('start')} class="h-11" />
											{#if errors.start}<p id="start-error" class="text-xs font-medium text-destructive" role="alert">{errors.start}</p>{/if}
										</div>
										<div class="grid gap-1.5">
											<Label for="end-date">End date <span class="font-normal text-muted-foreground">(optional)</span></Label>
											<Input id="end-date" type="date" min={a.startDate || today} value={a.endDate} onchange={(event) => setEnd(event.currentTarget.value)} aria-invalid={errors.end ? 'true' : undefined} aria-describedby={fieldError('end')} class="h-11" />
											{#if errors.end}<p id="end-error" class="text-xs font-medium text-destructive" role="alert">{errors.end}</p>{/if}
										</div>
									</div>
								{/if}
								{#if month !== null && season && seasonNote(season)}
									{#key month}
										<p in:fly={{ y: 8, duration: ms(320), easing: cubicOut }} class="mt-4 flex items-start gap-2 rounded-xl bg-secondary/70 px-4 py-3 text-sm text-navy">
											<Lightbulb class="mt-0.5 size-4 shrink-0 text-[#D9A900]" /><span><b>{MONTH_NAMES[month]}, {season.name}:</b> {seasonNote(season)}</span>
										</p>
									{/key}
								{/if}
							{:else if step === 3}
								<h2 data-step-heading tabindex="-1" class="lux-heading mt-3 !text-[1.9rem] outline-none md:!text-[2.3rem]">How long, and at what pace?</h2>
								<p class="mt-2 text-[13px] text-muted-foreground">The whole trip, from arrival to departure.</p>
								{#if errors.length}<p class="mt-3 text-sm font-medium text-destructive" role="alert">{errors.length}</p>{/if}
								<div class="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Trip length" data-invalid={errors.length ? '' : undefined}>
									{#each [...LENGTHS.map((band) => ({ id: band.id as string, label: band.label })), { id: NOT_SURE, label: NOT_SURE_LABEL }] as band, i (band.id)}
										<button type="button" class={pill(a.length === band.id)} style={`--i: ${i}`} aria-pressed={a.length === band.id} onclick={() => pick('length', band.id as PlanAnswers['length'])}>
											{band.label}
											{#if popular === band.id}<span class="rounded bg-navy px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white uppercase">Popular</span>{/if}
										</button>
									{/each}
								</div>
								<div class="mt-6 border-t border-border pt-6">
									<h3 class="text-[15px] font-semibold text-navy">Your pace</h3>
									{#if errors.pace}<p class="mt-2 text-sm font-medium text-destructive" role="alert">{errors.pace}</p>{/if}
									<div class="mt-3 grid gap-3 sm:grid-cols-2" role="group" aria-label="Pace" data-invalid={errors.pace ? '' : undefined}>
										{#each [...PACES, { id: NOT_SURE, label: NOT_SURE_LABEL, desc: 'We’ll suggest a pace that suits your route.' }] as option, i (option.id)}
											<ChoiceCard selected={a.pace === option.id} index={i + 3} title={option.label} desc={option.desc} onclick={() => pick('pace', option.id as PlanAnswers['pace'])} />
										{/each}
									</div>
								</div>
							{:else if step === 4}
								<h2 data-step-heading tabindex="-1" class="lux-heading mt-3 !text-[1.9rem] outline-none md:!text-[2.3rem]">What matters most to you?</h2>
								<p class="mt-2 text-[13px] text-muted-foreground">So we can suggest the right places, stays and price range.</p>
								<h3 class="mt-5 text-[15px] font-semibold text-navy">Your priorities <span class="font-normal text-muted-foreground">(optional, up to {MAX_PRIORITIES})</span> <span class="ml-1 font-normal text-muted-foreground" aria-live="polite">{pickedPriorities}/{MAX_PRIORITIES}</span></h3>
								<div class="mt-3 flex flex-wrap gap-2" role="group" aria-label="Priorities">
									{#each priorityOptions as option, i (option.slug)}
										{@const on = a.priorities.some((p) => p.slug === option.slug)}
										<button type="button" aria-pressed={on} disabled={!on && option.slug !== NOT_SURE && pickedPriorities >= MAX_PRIORITIES} style={`--i: ${i * 0.5}`} class={pill(on)} onclick={() => togglePriority(option)}>{option.name}</button>
									{/each}
								</div>

								<div class="mt-6 border-t border-border pt-6">
									<h3 class="text-[15px] font-semibold text-navy">Comfort level</h3>
									{#if errors.comfort}<p class="mt-2 text-sm font-medium text-destructive" role="alert">{errors.comfort}</p>{/if}
									<div class="mt-3 grid gap-3 sm:grid-cols-2" role="group" aria-label="Comfort level" data-invalid={errors.comfort ? '' : undefined}>
										{#each comfortChoices as option, i (option.id)}
											<ChoiceCard selected={a.comfort === option.id} index={i + 4} title={option.label} desc={option.desc}
												meta={[option.tours ? `${option.tours} ${option.tours === 1 ? 'trip' : 'trips'}` : '', option.stays ? `${option.stays} ${option.stays === 1 ? 'stay' : 'stays'}` : '', option.from ? `from ${usd(option.from)}` : ''].filter(Boolean).join(' · ')}
												onclick={() => pick('comfort', option.id)} />
										{/each}
										<ChoiceCard selected={a.comfort === NOT_SURE} index={comfortChoices.length + 4} title={NOT_SURE_LABEL} desc="We’ll suggest stays that suit your budget." onclick={() => pick('comfort', NOT_SURE)} />
									</div>
								</div>

								{#if scale}
									<div class="mt-6 border-t border-border pt-6">
										<h3 class="text-[15px] font-semibold text-navy">Budget per person <span class="font-normal text-muted-foreground">(optional)</span></h3>
										<p class="mt-1 text-sm text-muted-foreground">Drag to the most you’d like to spend per person, before international flights.</p>
										<div class={`mt-4 rounded-xl border border-border bg-white px-4 py-5 transition-opacity sm:px-6 ${a.budgetUnsure ? 'opacity-45' : ''}`}>
											<p class="text-center text-2xl font-bold text-navy" aria-live="polite">{a.budgetUnsure ? NOT_SURE_LABEL : `Up to ${usd(sliderValue)} per person`}</p>
											<p class="mt-1 min-h-5 text-center text-xs text-muted-foreground">
												{#if a.budgetUnsure}&nbsp;{:else if a.budget === null}Drag the slider to set your budget.{:else if pool.length}{underBudget} of {pool.length} {pool.length === 1 ? 'trip starts' : 'trips start'} at or under this{/if}
											</p>
											<input type="range" class="planner-range mt-4 w-full" min={scale.min} max={scale.max} step={scale.step} value={sliderValue} disabled={a.budgetUnsure} aria-label="Budget per person, in US dollars" aria-valuetext={`Up to ${usd(sliderValue)} per person`} style={`--fill: ${((sliderValue - scale.min) / (scale.max - scale.min)) * 100}%`} oninput={(event) => setBudget(Number(event.currentTarget.value))} />
											<div class="mt-2 flex justify-between text-xs font-medium text-navy"><span>{usd(scale.min)}</span><span>{usd(scale.max)}</span></div>
										</div>
										<p class="mt-2 text-xs text-muted-foreground">The scale runs from our lowest to our highest published starting price, in US dollars.</p>
										<div class="mt-3 flex items-center gap-2.5">
											<Checkbox id="budget-unsure" checked={a.budgetUnsure} onCheckedChange={(value) => setBudgetUnsure(value === true)} />
											<Label for="budget-unsure" class="text-sm font-normal text-muted-foreground">Not sure yet</Label>
										</div>
									</div>
								{/if}
							{:else if step === 5}
								<h2 data-step-heading tabindex="-1" class="lux-heading mt-3 !text-[1.9rem] outline-none md:!text-[2.3rem]">Where are you with your plans?</h2>
								{#if errors.stage}<p class="mt-3 text-sm font-medium text-destructive" role="alert">{errors.stage}</p>{/if}
								<div class="mt-5 grid gap-3" role="group" aria-label="Planning stage" data-invalid={errors.stage ? '' : undefined}>
									{#each STAGES as option, i (option.id)}
										<ChoiceCard selected={a.stage === option.id} index={i} title={option.label} desc={option.desc} onclick={() => pick('stage', option.id)} />
									{/each}
								</div>
							{:else}
								<h2 data-step-heading tabindex="-1" class="lux-heading mt-3 !text-[1.9rem] outline-none md:!text-[2.3rem]">Your trip, and how to reach you</h2>
								<dl class="mt-5 divide-y divide-border rounded-xl border border-border">
									{#each review as row, i (row.at)}
										<div class="pm-rise flex items-start justify-between gap-3 px-4 py-3" style={`--i: ${i * 0.7}`}>
											<div class="min-w-0">
												<dt class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{row.label}</dt>
												<dd class="mt-0.5 text-sm break-words text-navy">{row.value || NOT_SURE_LABEL}</dd>
											</div>
											<button type="button" class="inline-flex min-h-11 shrink-0 items-center gap-1 px-1 text-xs font-semibold text-navy hover:underline" aria-label={`Edit ${row.label.toLowerCase()}`} onclick={() => edit(row.at)}><Pencil class="size-3" />Edit</button>
										</div>
									{/each}
								</dl>

								<form id="plan-form" method="POST" action="?/plan" novalidate use:enhance={submitPlan} class="plan-form relative mt-6 grid gap-4 sm:grid-cols-2">
									<!-- Honeypot: off-screen, so people never see it and autofill skips it; bots reading the HTML fill it. -->
									<div class="absolute top-0 left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
										<label for="company-website">Company website</label>
										<input id="company-website" name="company_website" tabindex="-1" autocomplete="off" bind:value={honeypot} />
									</div>
									<div class="grid gap-1.5">
										<Label for="full-name">Full name <span class="text-destructive">*</span></Label>
										<Input id="full-name" name="full_name" autocomplete="name" maxlength={150} bind:value={fullName} aria-invalid={errors.full_name ? 'true' : undefined} aria-describedby={fieldError('full_name')} class="h-11" />
										{#if errors.full_name}<p id="full_name-error" class="text-xs font-medium text-destructive" role="alert">{errors.full_name}</p>{/if}
									</div>
									<div class="grid gap-1.5">
										<Label for="email">Email <span class="text-destructive">*</span></Label>
										<Input id="email" name="email" type="email" autocomplete="email" maxlength={254} bind:value={email} placeholder="you@example.com" aria-invalid={errors.email ? 'true' : undefined} aria-describedby={fieldError('email')} class="h-11" />
										{#if errors.email}<p id="email-error" class="text-xs font-medium text-destructive" role="alert">{errors.email}</p>{/if}
									</div>
									<div class="grid gap-1.5 sm:col-span-2">
										<Label for="phone">Phone {#if a.contact !== 'email'}<span class="text-destructive">*</span>{:else}<span class="font-normal text-muted-foreground">(optional)</span>{/if}</Label>
										<div class="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
											<Select.Root type="single" name="dial_code" bind:value={dialCode}>
												<Select.Trigger class="h-11 w-full" aria-label="Country code">{dialCode || 'Code'}</Select.Trigger>
												<Select.Content class="max-h-72">
													{#each DIAL_CODES as item (item.code)}<Select.Item value={item.code} label={`${item.code} ${item.country}`}>{item.code} · {item.country}</Select.Item>{/each}
												</Select.Content>
											</Select.Root>
											<Input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" maxlength={30} bind:value={phone} aria-invalid={errors.phone ? 'true' : undefined} aria-describedby={fieldError('phone')} class="h-11" />
										</div>
										{#if errors.phone}<p id="phone-error" class="text-xs font-medium text-destructive" role="alert">{errors.phone}</p>{/if}
									</div>
									<div class="grid gap-1.5 sm:col-span-2">
										<span class="text-sm font-medium text-navy" id="contact-label">How should we contact you?</span>
										<div class="grid grid-cols-3 gap-2" role="group" aria-labelledby="contact-label">
											{#each CONTACTS as option (option.id)}
												<button type="button" aria-pressed={a.contact === option.id} class={pill(a.contact === option.id)} onclick={() => setContact(option.id)}>{option.label}</button>
											{/each}
										</div>
									</div>
									<div class="grid gap-1.5 sm:col-span-2">
										<Label for="notes">Anything else? <span class="font-normal text-muted-foreground">(optional)</span></Label>
										<Textarea id="notes" name="notes" rows={3} maxlength={MAX_NOTES} bind:value={notes} placeholder="Special occasions, must-sees, dietary needs or anything you’d like us to know." class="min-h-24" />
									</div>
									<div class="flex items-start gap-2.5 sm:col-span-2">
										<Checkbox id="whatsapp-ok" bind:checked={a.whatsappOk} class="mt-0.5" />
										<Label for="whatsapp-ok" class="text-xs leading-5 font-normal text-muted-foreground">I’m happy for {siteInfo.brand} to contact me on WhatsApp about this trip.</Label>
									</div>
									{#if errorMessage}<p class="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:col-span-2" role="alert">{errorMessage}</p>{/if}
								</form>
								<p class="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><Lock class="size-3" />We only use your details to plan this trip with you.</p>
							{/if}
						</div>
					{/key}

					<!-- Back / Next. On phones it stays in reach at the bottom of the screen; on wide screens it sits under the step. -->
					<div class="planner-dock sticky bottom-0 z-20 -mx-5 -mb-5 mt-7 rounded-b-2xl border-t border-border bg-white/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur sm:px-5 md:-mx-7 md:-mb-7 md:px-7 lg:static lg:mx-0 lg:mb-0 lg:rounded-none lg:bg-transparent lg:px-0 lg:pt-5 lg:pb-0 lg:backdrop-blur-none">
						<div class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:gap-3 lg:flex lg:justify-between">
							<Button type="button" variant="outline" disabled={step === 0} aria-label="Back" onclick={back} class="h-12 w-12 px-0 sm:w-auto sm:px-5 lg:disabled:invisible"><ArrowLeft class="size-4" /><span class="hidden sm:inline">Back</span></Button>
							{#if step < LAST}
								<Button bind:ref={nextButton} type="button" variant="safari" onclick={next} class="h-12 w-full px-6 lg:w-auto">Next <ArrowRight class="size-4" /></Button>
							{:else}
								<Button bind:ref={nextButton} type="submit" form="plan-form" variant="safari" disabled={submitting} class="h-12 w-full px-6 lg:w-auto">
									{#if submitting}<LoaderCircle class="size-4 animate-spin" /> Sending…{:else}Send my plan <ArrowRight class="size-4" />{/if}
								</Button>
							{/if}
						</div>
					</div>
				</div>

				<Sidebar {rows} {tips} {recs} {step} total={STEPS.length} chosen={a.types.length > 0} />
			</div>
		</div>
	{/if}
</main>
<SiteFooter visible={data.visible} destinations={data.destinations} onInterest={() => {}} onPage={['top']} />

<style>
	.plan-form :global([data-slot='label']) { font-size: 12px; font-weight: 500; }

	/* Choices rise into place one after another when a step opens. */
	:global(.pm-rise) { animation: pm-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards; animation-delay: calc(var(--i, 0) * 45ms + 80ms); }
	@keyframes -global-pm-rise { from { opacity: 0; transform: translateY(12px) scale(0.985); } }
	/* Progress segments fill from the left. */
	:global(.pm-fill) { transform-origin: left center; transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
	/* The final screen: a ring bursts out from the tick, which draws itself. */
	:global(.pm-burst) { animation: pm-burst 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.45s backwards; opacity: 0; }
	@keyframes -global-pm-burst { from { opacity: 0.8; box-shadow: 0 0 0 0 color-mix(in oklch, var(--sun) 55%, transparent); } to { opacity: 0; box-shadow: 0 0 0 22px transparent; } }
	:global(.pm-tick path), :global(.pm-tick polyline) { stroke-dasharray: 30; stroke-dashoffset: 30; animation: pm-tick 0.5s cubic-bezier(0.65, 0, 0.35, 1) 0.55s forwards; }
	@keyframes -global-pm-tick { to { stroke-dashoffset: 0; } }
	@media (prefers-reduced-motion: reduce) {
		:global(.pm-rise), :global(.pm-burst) { animation: none; }
		:global(.pm-tick path), :global(.pm-tick polyline) { animation: none; stroke-dashoffset: 0; }
		:global(.pm-fill) { transition: none; }
	}

	/* The budget slider: a sun-coloured fill up to the thumb, and a large thumb for fingers. */
	.planner-range { -webkit-appearance: none; appearance: none; height: 40px; background: transparent; cursor: pointer; }
	.planner-range:disabled { cursor: not-allowed; }
	.planner-range::-webkit-slider-runnable-track { height: 8px; border-radius: 9999px; background: linear-gradient(var(--sun), var(--sun)) 0 0 / var(--fill, 0%) 100% no-repeat, color-mix(in oklch, var(--navy) 14%, transparent); }
	.planner-range::-moz-range-track { height: 8px; border-radius: 9999px; background: color-mix(in oklch, var(--navy) 14%, transparent); }
	.planner-range::-moz-range-progress { height: 8px; border-radius: 9999px; background: var(--sun); }
	.planner-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 30px; height: 30px; margin-top: -11px; border-radius: 9999px; background: var(--navy); border: 4px solid white; box-shadow: 0 0 0 1px rgb(16 45 65 / .2), 0 4px 12px rgb(16 45 65 / .2); }
	.planner-range::-moz-range-thumb { width: 24px; height: 24px; border-radius: 9999px; background: var(--navy); border: 4px solid white; box-shadow: 0 0 0 1px rgb(16 45 65 / .2), 0 4px 12px rgb(16 45 65 / .2); }
	.planner-range:focus-visible { outline: none; }
	.planner-range:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 4px color-mix(in oklch, var(--sun) 60%, transparent); }
	.planner-range:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 4px color-mix(in oklch, var(--sun) 60%, transparent); }
</style>
