<script lang="ts">
	import { ArrowRight, MessageCircle } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { WHATSAPP_URL } from '$lib/homepage-refresh';
	import { PHOTO } from '$lib/media-photos';

	// The step after the list, worded from what the visitor picked: their
	// filters become the brief, and the planner opens on the place and style.
	let { picked, count, planLink }: { picked: string[]; count: number; planLink: string } = $props();
	let title = $derived(!picked.length ? 'Every safari here can change' : count ? 'Like these, but made around you?' : 'We can build this one for you');
	let copy = $derived(
		!picked.length
			? 'Add a night in the Serengeti, swap a lodge or finish on Zanzibar’s beaches. Tell us what matters and our team in Arusha will shape the days around it.'
			: count
				? 'Start from what you picked and our team in Arusha will shape the days, lodges and pace around your dates.'
				: 'No published safari has all of that yet, but we plan private trips from scratch. Tell us and we’ll come back with what’s possible.'
	);
</script>

<section class="tailor" aria-labelledby="tailor-title" data-motion="reveal">
	<img src={PHOTO.vehiclesAcacia} alt="" loading="lazy" class="photo" />
	<div class="copy">
		<h2 id="tailor-title">{title}</h2>
		<p>{copy}</p>
		{#if picked.length}
			<p class="brief"><span>Your brief</span>{picked.join(' · ')}</p>
		{/if}
		<div class="actions">
			<Button variant="safari" href={planLink} data-cta="plan_my_trip" data-cta-location="tours_results" class="h-12 px-6">Plan this safari <ArrowRight class="size-4" /></Button>
			<a class="chat" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"><MessageCircle class="size-4" aria-hidden="true" />Ask us on WhatsApp</a>
		</div>
	</div>
</section>

<style>
	.tailor { position: relative; isolation: isolate; display: grid; overflow: hidden; margin-top: 48px; border-radius: var(--radius-surface); background: #2b2722; color: #fff; }
	.photo { width: 100%; height: 180px; object-fit: cover; }
	.copy { padding: 24px 22px 26px; }
	h2 { margin: 0; color: #fff; font-size: var(--text-h3); line-height: 1.15; }
	.copy > p { max-width: 56ch; margin: 12px 0 0; color: rgb(255 255 255 / 0.78); font-size: var(--text-base); line-height: 1.7; }
	.copy > .brief { display: grid; gap: 4px; margin-top: 18px; padding-top: 16px; border-top: 1px solid rgb(255 255 255 / 0.14); color: #fff; font-size: var(--text-sm); font-weight: 600; line-height: 1.5; }
	.brief span { color: rgb(255 255 255 / 0.6); font-size: var(--text-xs); font-weight: 500; }
	.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 22px; margin-top: 22px; }
	.chat { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; color: #fff; font-size: var(--text-sm); font-weight: 600; text-decoration: none; transition: color 160ms ease-out; }
	.chat:hover { color: var(--sun); }
	@media (min-width: 768px) {
		.tailor { grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); }
		.photo { height: 100%; min-height: 300px; }
		.copy { align-self: center; padding: 40px 44px; }
	}
	@media (min-width: 1024px) { .tailor { margin-top: 64px; } }
</style>
