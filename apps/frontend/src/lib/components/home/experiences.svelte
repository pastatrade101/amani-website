<script lang="ts">
	import { PHOTO } from '$lib/media-photos';
	import { ArrowRight } from '@lucide/svelte';
	import HomeCarousel from './home-carousel.svelte';
	import { homeExperiences, experiencePhotos } from '$lib/homepage-refresh';
	import { safeUrl, textContent } from '$lib/home-content';
	import type { Activity, Category, HomepageSection } from '$lib/types/api';
	let { items, section, categories = [] }: { items: Activity[]; section: HomepageSection; categories?: Category[] } = $props();
	let cards = $derived(homeExperiences(section, categories, items));
	// Image-less cards in the row never share a photo while an unused one is left.
	let photos = $derived(experiencePhotos(cards));
</script>

<section id="experiences" class="home-band">
	<div class="home-container">
		{#snippet head()}{#if section.subtitle}<p class="home-kicker">{section.subtitle}</p>{/if}<h2 class="home-heading mt-4">{section.title}</h2>{#if textContent(section.content)}<p class="home-copy mt-3">{textContent(section.content)}</p>{/if}{/snippet}
		{#if cards.length}
			<div data-motion="reveal"><HomeCarousel items={cards} label="experiences" {head}>{#snippet card(item, i)}
				<a class="experience-card" href={safeUrl(item.href, '/tours')} aria-label={`${item.cta_label} ${item.name}`}>
					<img src={safeUrl(photos[i], PHOTO.popUpRoofView)} alt="" loading="lazy" />
					<span class="experience-veil" aria-hidden="true"></span>
					<div class="experience-heading">{#if item.meta}<p>{textContent(item.meta)}</p>{/if}<h3>{item.name}</h3></div>
					<span class="experience-cta">{item.cta_label}<ArrowRight class="size-4" /></span>
				</a>
			{/snippet}</HomeCarousel></div>
		{:else}
			<div class="max-w-2xl">{@render head()}</div>
			<p class="mt-8 text-sm text-muted-foreground">New experiences are on their way. Our team can help you plan a personal journey.</p>
		{/if}
	</div>
</section>

<style>
	.experience-card { position: relative; display: flex; flex-direction: column; justify-content: space-between; min-height: 440px; overflow: hidden; border-radius: var(--radius-surface); background: var(--secondary); isolation: isolate; }
	.experience-card > img { position: absolute; inset: 0; z-index: -2; width: 100%; height: 100%; object-fit: cover; transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1); }
	/* A soft light wash at the top for the title, easing out by mid-card. */
	.experience-veil { position: absolute; inset: 0; z-index: -1; background: linear-gradient(180deg, rgb(255 255 255 / 0.94) 0%, rgb(255 255 255 / 0.84) 14%, rgb(255 255 255 / 0.6) 26%, rgb(255 255 255 / 0.32) 38%, rgb(255 255 255 / 0.12) 48%, rgb(255 255 255 / 0) 58%), linear-gradient(0deg, rgb(20 18 15 / 0.28) 0%, rgb(20 18 15 / 0) 30%); }
	.experience-heading { padding: 24px 22px 0; }
	.experience-heading p { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; font-size: 11.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #7a5a26; }
	.experience-heading h3 { margin-top: 6px; font-size: 20px; font-weight: 650; line-height: 1.3; letter-spacing: -0.01em; color: var(--navy); text-wrap: balance; }
	.experience-cta { display: inline-flex; align-self: flex-start; align-items: center; gap: 10px; margin: 0 22px 22px; padding: 11px 18px; border-radius: var(--radius-control); background: var(--sun); color: var(--navy); font-size: 13px; font-weight: 700; transition: gap 0.2s ease, background-color 0.2s ease; }
	.experience-card:hover > img { transform: scale(1.05); }
	.experience-card:hover .experience-cta { gap: 14px; background: color-mix(in oklab, var(--sun) 92%, black); }
	.experience-card:focus-visible { outline: 3px solid var(--navy); outline-offset: 2px; }
	@media (max-width: 639px) { .experience-card { min-height: 410px; } }
	@media (prefers-reduced-motion: reduce) { .experience-card:hover > img { transform: none; } }
</style>
