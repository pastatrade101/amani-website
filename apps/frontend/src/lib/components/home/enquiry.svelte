<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowRight, MapPin, Compass, Check, CalendarDays, Users } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { today, parseDate, DateFormatter, type DateValue } from '@internationalized/date';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { textContent } from '$lib/home-content';
	import type { HomepageSection } from '$lib/types/api';
	import type { ActionData } from '../../../routes/$types';
	let { section, form, interest }: { section: HomepageSection; form: ActionData; interest: string } = $props();
	let sending = $state(false);
	let travelDate = $state<DateValue>();
	let travelerCount = $state('2');
	let calendarOpen = $state(false);
	const dateFormat = new DateFormatter('en', { dateStyle: 'medium' });
	$effect(() => {
		try { travelDate = form?.values?.travel_date ? parseDate(form.values.travel_date) : undefined; } catch { travelDate = undefined; }
		travelerCount = form?.values?.travelers || '2';
	});
</script>
<section id="request-quote" class="bg-secondary/70 py-16 md:py-24">
	<div class="page-container grid gap-10 lg:grid-cols-[.85fr_1.15fr] lg:gap-20">
		<div data-motion="reveal" class="lg:pt-5"><p class="eyebrow text-muted-foreground">{section.subtitle}</p><div class="gold-line mt-4"></div><h2 class="section-heading mt-5 max-w-md text-3xl md:text-4xl">{section.title}</h2><p class="mt-5 max-w-md text-sm leading-7 text-muted-foreground">{textContent(section.content)}</p>
			<div class="mt-8 grid gap-5 text-sm"><p class="flex items-center gap-3"><MapPin class="size-5" /> Local knowledge, personal attention</p><p class="flex items-center gap-3"><Compass class="size-5" /> A journey shaped around your interests</p><p class="flex items-center gap-3"><Check class="size-5" /> An enquiry, with no obligation to book</p></div>
			<img src="/images/itinerary-game-drive.jpg" alt="A safari vehicle on a Tanzania game drive" loading="lazy" class="mt-9 h-44 w-full max-w-md rounded-2xl object-cover" />
		</div>
		<form data-motion="reveal" data-motion-delay="0.12" method="POST" action="?/enquire#request-quote" use:enhance={() => { sending = true; return async ({ update, result }) => { try { await update({ reset: result.type === 'success' && result.data?.success === true, invalidateAll: false }); } finally { sending = false; } }; }} class="enquiry-form grid gap-5 rounded-2xl border border-border bg-white p-6 shadow-[0_20px_60px_-30px_rgba(16,45,65,.2)] sm:p-8">
			<div class="mb-1"><h3 class="text-xl font-semibold tracking-tight">Your journey starts here</h3><p class="mt-2 text-xs leading-6 text-muted-foreground">A few details are all we need to start planning together.</p></div>
			{#if form?.message}<p role={form.success ? 'status' : 'alert'} class={`rounded-xl p-4 text-sm leading-6 ${form.success ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>{form.message}</p>{/if}
			<div class="grid gap-5 sm:grid-cols-2"><div class="grid gap-2"><Label for="full-name">Your name</Label><Input id="full-name" name="full_name" autocomplete="name" required minlength={2} maxlength={150} value={form?.values?.full_name ?? ''} placeholder="Full name" class="h-11" /></div><div class="grid gap-2"><Label for="email">Email address</Label><Input id="email" name="email" type="email" autocomplete="email" required maxlength={254} value={form?.values?.email ?? ''} placeholder="you@example.com" class="h-11" /></div></div>
			<div class="grid gap-2"><Label for="phone">Phone <span class="font-normal text-muted-foreground">(optional)</span></Label><Input id="phone" name="phone" type="tel" autocomplete="tel" maxlength={50} value={form?.values?.phone ?? ''} placeholder="Include country code" class="h-11" /></div>
			<div class="grid gap-5 sm:grid-cols-2"><div class="grid gap-2"><Label for="travel-date">Preferred start date</Label><Popover.Root bind:open={calendarOpen}><Popover.Trigger id="travel-date" class="flex h-11 w-full items-center gap-2 rounded-md border border-input bg-white px-3 text-left text-sm"><CalendarDays class="size-4 text-muted-foreground" />{travelDate ? dateFormat.format(travelDate.toDate('Africa/Dar_es_Salaam')) : 'Select a date'}</Popover.Trigger><Popover.Content class="w-auto p-0" align="start"><Calendar type="single" bind:value={travelDate} onValueChange={() => calendarOpen = false} minValue={today('Africa/Dar_es_Salaam')} captionLayout="dropdown" /></Popover.Content></Popover.Root><input type="hidden" name="travel_date" value={travelDate?.toString() || ''} /></div><div class="grid gap-2"><Label for="travelers">Number of travelers</Label><Select.Root type="single" name="travelers" bind:value={travelerCount}><Select.Trigger id="travelers" class="h-11 w-full"><span class="flex items-center gap-2"><Users class="size-4 text-muted-foreground" />{travelerCount} {travelerCount === '1' ? 'traveler' : 'travelers'}</span></Select.Trigger><Select.Content>{#each Array.from({ length: 20 }, (_, i) => String(i + 1)) as count}<Select.Item value={count}>{count} {count === '1' ? 'traveler' : 'travelers'}</Select.Item>{/each}</Select.Content></Select.Root></div></div>
			<div class="grid gap-2"><Label for="interest">What would you love to explore?</Label><Input id="interest" name="interest" maxlength={200} value={interest || form?.values?.interest || ''} placeholder="Serengeti, a family safari, Zanzibar…" class="h-11" /></div>
			<div class="grid gap-2"><Label for="message">Tell us about your trip</Label><Textarea id="message" name="message" required minlength={10} maxlength={5000} value={form?.values?.message ?? ''} placeholder="Your interests, ideal trip length, budget, or anything you would like us to know." class="min-h-28" /></div>
			<div class="hidden" aria-hidden="true"><label for="website">Website</label><input id="website" name="website" tabindex="-1" autocomplete="off" /></div>
			<Button variant="safari" type="submit" disabled={sending} class="h-12 rounded-lg px-6 font-bold w-full">{sending ? 'Sending your enquiry…' : 'Send My Safari Enquiry'} <ArrowRight class="ml-2" /></Button><p class="text-center text-[10px] leading-5 text-muted-foreground">We’ll use your details to respond to this enquiry.</p>
		</form>
	</div>
</section>

<style>
	.enquiry-form :global([data-slot="label"]) { font-size: 12px; font-weight: 500; }
	.enquiry-form :global([data-slot="input"]), .enquiry-form :global([data-slot="select-trigger"]), .enquiry-form :global([data-slot="popover-trigger"]) { height: 46px; min-height: 46px; border-radius: 9px; font-size: 13px; background: white; }
	.enquiry-form :global(textarea) { border-radius: 9px; font-size: 13px; line-height: 1.8; }
</style>
