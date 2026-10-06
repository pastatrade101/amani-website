<script lang="ts">
	import { Quote } from '@lucide/svelte';
	import RichText from '$lib/components/tours/rich-text.svelte';
	import { textContent } from '$lib/home-content';
	import type { StayGalleryPhoto } from '$lib/stay-content';

	// The team's own words on the one navy band of the page. With a second photo
	// it sits beside it; without, the band's contour rings are the visual anchor.
	let { why, photo = null, team, onOpen }: { why: string; photo?: StayGalleryPhoto | null; team: string; onOpen: (opener: HTMLElement) => void } = $props();
	// Long notes step down a size so the band stays a quote, not a wall of text.
	let long = $derived(textContent(why).length > 320);
</script>

<section id="why" aria-labelledby="why-title" class={`relative isolate overflow-hidden bg-navy py-20 text-white md:py-28 ${photo ? '' : 'rings'}`}>
	<div class={photo ? 'page-container grid items-center gap-10 lg:grid-cols-12 lg:gap-16' : 'page-container'}>
		{#if photo}
			<button type="button" data-motion="image" onclick={(event) => onOpen(event.currentTarget)} aria-label={`Open photo: ${photo.alt}`} class="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-white/5 lg:col-span-5 lg:aspect-[4/5]">
				<img src={photo.src} alt="" loading="lazy" decoding="async" class="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transform-none" />
			</button>
		{/if}
		<div data-motion="reveal" class={photo ? 'lg:col-span-7' : 'mx-auto max-w-3xl text-center'}>
			<p id="why-title" class="eyebrow text-sun">Why we recommend it</p>
			<Quote class={`mt-6 size-10 text-sun ${photo ? '' : 'mx-auto'}`} aria-hidden="true" />
			<figure>
				<blockquote class={`quote mt-5 font-display italic ${long ? 'text-[22px] leading-[1.45] sm:text-[26px] lg:text-[30px]' : 'text-[26px] leading-[1.35] sm:text-[34px] lg:text-[40px]'}`}><RichText value={why} /></blockquote>
				<figcaption class="mt-8 text-xs uppercase tracking-[.2em] text-white/60">— The {team} team</figcaption>
			</figure>
		</div>
	</div>
</section>

<style>
	/* The quote takes the band's type, not the body copy's. */
	blockquote.quote :global(.rich-text) { font: inherit; color: inherit; letter-spacing: inherit; }
	blockquote.quote :global(.rich-text strong) { color: inherit; }
	blockquote.quote :global(.rich-text a) { color: inherit; text-decoration-color: var(--sun); }
	/* Faint contour rings, like a map of the plains (as on the photo placeholder). */
	.rings { background: radial-gradient(120% 90% at 50% 0%, oklch(0.38 0.07 252) 0%, var(--navy) 55%, oklch(0.22 0.05 252) 100%); }
	.rings::before { content: ''; position: absolute; inset: -40%; z-index: -1; background: repeating-radial-gradient(circle at 70% 120%, transparent 0 22px, rgb(255 255 255 / 0.08) 22px 23px); }
</style>
