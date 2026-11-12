<script lang="ts">
	import { ArrowRight, Check } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { PHOTO } from '$lib/media-photos';
	import { safeUrl, textContent } from '$lib/home-content';
	import { refreshSections } from '$lib/homepage-refresh';
	import type { HomepageSection, TourDetail } from '$lib/types/api';

	type Person = NonNullable<TourDetail['specialist']>;
	// Who we are, straight after the hero: the team photo, the promise, three
	// plain points and one way to start.
	let { section, team = null, canEnquire = true }: { section: HomepageSection; team?: Person | null; canEnquire?: boolean } = $props();

	let fallback = $derived(refreshSections.find((item) => item.section_key === 'company_intro'));
	const lines = (value: unknown) => (Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean) : []);
	let points = $derived(lines(section.extra_data?.points).length ? lines(section.extra_data?.points) : lines(fallback?.extra_data?.points));
	let footnote = $derived(String(section.extra_data?.footnote ?? fallback?.extra_data?.footnote ?? '').trim());
	let image = $derived(safeUrl(section.image_url, PHOTO.teamWithGuests));
	// The people are named only when the photo is the team's own.
	let tagged = $derived(team?.photo_url && safeUrl(team.photo_url, '') === image ? team : null);
	let href = $derived.by(() => {
		const target = safeUrl(section.button_url, '#plan-form');
		return target === '#plan-form' && !canEnquire ? '/plan-my-trip' : target;
	});
</script>

<section id="about-key2africa" class="home-band">
	<div class="home-container intro">
		<figure class="intro-figure" data-motion="image">
			<img src={image} alt={tagged ? `${tagged.name} with guests beside their safari vehicles` : image === PHOTO.teamWithGuests ? 'The Key2africa team with guests beside their safari vehicles' : 'Our team on safari in Tanzania'} loading="lazy" width="1200" height="800" />
			{#if tagged}<figcaption class="intro-tag"><strong>{tagged.name}</strong>{#if tagged.role}<span>{tagged.role}</span>{/if}</figcaption>{/if}
		</figure>
		<div class="intro-copy" data-motion="reveal">
			{#if section.subtitle}<p class="home-kicker">{section.subtitle}</p>{/if}
			<h2 class="home-heading mt-4">{section.title}</h2>
			{#if textContent(section.content)}<p class="home-copy mt-5">{textContent(section.content)}</p>{/if}
			{#if points.length}
				<ul class="intro-points">
					{#each points as point}<li><span class="tick" aria-hidden="true"><Check strokeWidth={3} /></span>{point}</li>{/each}
				</ul>
			{/if}
			<div class="intro-actions">
				<Button variant="safari" class="h-12 px-7" {href}>{section.button_text || 'Plan My Safari'}<ArrowRight class="size-4" /></Button>
				{#if footnote}<p class="intro-note">{footnote}</p>{/if}
			</div>
		</div>
	</div>
</section>

<style>
	.intro { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 72px; align-items: center; }
	.intro-figure { position: relative; margin: 0; }
	.intro-figure img { display: block; width: 100%; aspect-ratio: 5 / 4; object-fit: cover; object-position: 50% 45%; border-radius: var(--radius-surface); }
	.intro-tag { position: absolute; left: 20px; bottom: 20px; display: grid; gap: 2px; max-width: calc(100% - 40px); padding: 12px 18px; border-radius: var(--radius-control); background: rgb(255 255 255 / 0.96); box-shadow: 0 12px 28px -18px rgb(20 18 15 / 0.5); }
	.intro-tag strong { font-size: 15px; font-weight: 700; line-height: 1.3; color: var(--navy); }
	.intro-tag span { font-size: 13px; line-height: 1.4; color: var(--muted-foreground); }
	.intro-copy { max-width: 36rem; }
	.intro-points { display: grid; gap: 14px; margin: 28px 0 0; padding: 0; list-style: none; }
	.intro-points li { display: flex; align-items: flex-start; gap: 14px; font-size: 15px; line-height: 1.55; color: var(--navy); }
	.tick { display: grid; flex: none; place-items: center; width: 22px; height: 22px; margin-top: 1px; border-radius: 6px; background: var(--sun); color: var(--navy); }
	.tick :global(svg) { width: 13px; height: 13px; }
	.intro-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 18px 24px; margin-top: 34px; }
	.intro-note { max-width: 32ch; font-size: 13px; line-height: 1.55; color: var(--muted-foreground); }
	@media (max-width: 1023px) { .intro { gap: 44px; } }
	@media (max-width: 767px) {
		.intro { grid-template-columns: 1fr; gap: 32px; }
		.intro-figure img { aspect-ratio: 4 / 3; }
		.intro-tag { left: 14px; bottom: 14px; padding: 10px 14px; }
		.intro-actions { flex-direction: column; align-items: stretch; }
		.intro-note { max-width: none; }
	}
</style>
