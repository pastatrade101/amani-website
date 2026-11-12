<script lang="ts">
	import { ArrowRight, Check } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { PHOTO } from '$lib/media-photos';
	import { safeUrl, textContent } from '$lib/home-content';
	import { refreshSections } from '$lib/homepage-refresh';
	import { scrollcraft } from '$lib/motion/scrollcraft';
	import type { HomepageSection, TourDetail } from '$lib/types/api';

	type Person = NonNullable<TourDetail['specialist']>;
	// Who we are, straight after the hero: the team photo with a second moment
	// from the road laid over it, the promise, three plain points and one way to
	// start. ScrollCraft drifts the small photo at its own rate on larger screens,
	// so the pair reads as two planes rather than one flat picture.
	let { section, team = null, canEnquire = true }: { section: HomepageSection; team?: Person | null; canEnquire?: boolean } = $props();

	let fallback = $derived(refreshSections.find((item) => item.section_key === 'company_intro'));
	const lines = (value: unknown) => (Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean) : []);
	let points = $derived(lines(section.extra_data?.points).length ? lines(section.extra_data?.points) : lines(fallback?.extra_data?.points));
	let footnote = $derived(String(section.extra_data?.footnote ?? fallback?.extra_data?.footnote ?? '').trim());
	let image = $derived(safeUrl(section.image_url, PHOTO.teamWithGuests));
	// The people are named only when the photo is the team's own.
	// The second plane: never the same picture as the first.
	let inset = $derived(image === PHOTO.guestPopUpRoof ? PHOTO.guidePicnic : PHOTO.guestPopUpRoof);
	let tagged = $derived(team?.photo_url && safeUrl(team.photo_url, '') === image ? team : null);
	let href = $derived.by(() => {
		const target = safeUrl(section.button_url, '#plan-form');
		return target === '#plan-form' && !canEnquire ? '/plan-my-trip' : target;
	});
</script>

<section id="about-key2africa" class="home-band" use:scrollcraft={{ query: '(min-width: 768px) and (prefers-reduced-motion: no-preference)' }}>
	<div class="home-container intro" data-sc-act="flow">
		<figure class="intro-figure" data-motion="image">
			<img src={image} alt={tagged ? `${tagged.name} with guests beside their safari vehicles` : image === PHOTO.teamWithGuests ? 'The Key2africa team with guests beside their safari vehicles' : 'Our team on safari in Tanzania'} loading="lazy" width="1200" height="800" />
			{#if tagged}<figcaption class="intro-tag"><strong>{tagged.name}</strong>{#if tagged.role}<span>{tagged.role}</span>{/if}</figcaption>{/if}
			<div class="intro-inset" data-sc-parallax="-1.1"><img src={inset} alt={inset === PHOTO.guestPopUpRoof ? 'A guest standing up through the pop-up roof of a safari vehicle' : 'Guests at a picnic table with their guide'} loading="lazy" width="600" height="750" /></div>
		</figure>
		<div class="intro-copy" data-motion="reveal">
			<h2 class="home-heading">{section.title}</h2>
			{#if textContent(section.content)}<p class="intro-lede">{textContent(section.content)}</p>{/if}
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
	.intro { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr); gap: 96px; align-items: center; }
	/* Room under and beside the main photo for the inset to hang over its corner. */
	.intro-figure { position: relative; margin: 0 9% 56px 0; }
	.intro-figure > img { display: block; width: 100%; aspect-ratio: 5 / 4; object-fit: cover; object-position: 50% 45%; border-radius: var(--radius-surface); }
	.intro-inset { position: absolute; right: -14%; bottom: -64px; width: 40%; padding: 7px; border-radius: 14px; background: white; box-shadow: 0 26px 50px -30px rgb(31 27 22 / 0.55), 0 4px 12px -6px rgb(31 27 22 / 0.18); }
	.intro-inset img { display: block; width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 8px; }
	.intro-tag { position: absolute; left: 20px; bottom: 20px; display: grid; gap: 2px; max-width: calc(54% - 20px); padding: 12px 18px; border-radius: var(--radius-control); background: rgb(255 255 255 / 0.96); box-shadow: 0 12px 28px -18px rgb(20 18 15 / 0.5); }
	.intro-tag strong { font-size: 15px; font-weight: 700; line-height: 1.3; color: var(--navy); }
	.intro-tag span { font-size: 13px; line-height: 1.4; color: var(--muted-foreground); }
	.intro-copy { max-width: 34rem; }
	.intro-lede { margin: 20px 0 0; font-size: 17px; line-height: 1.7; color: #4f483f; }
	.intro-points { display: grid; gap: 14px; margin: 30px 0 0; padding: 26px 0 0; border-top: 1px solid var(--border); list-style: none; }
	.intro-points li { display: flex; align-items: flex-start; gap: 14px; font-size: 15px; line-height: 1.55; color: var(--navy); }
	.tick { display: grid; flex: none; place-items: center; width: 22px; height: 22px; margin-top: 1px; border-radius: 6px; background: var(--sun); color: var(--navy); }
	.tick :global(svg) { width: 13px; height: 13px; }
	.intro-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 18px 24px; margin-top: 34px; }
	.intro-note { max-width: 32ch; font-size: 13px; line-height: 1.55; color: var(--muted-foreground); }
	@media (max-width: 1023px) { .intro { gap: 56px; } .intro-inset { right: -10%; } }
	@media (max-width: 767px) {
		.intro { grid-template-columns: 1fr; gap: 40px; }
		.intro-figure { margin: 0 14% 40px 0; }
		.intro-figure > img { aspect-ratio: 4 / 3; }
		.intro-inset { right: -17%; bottom: -40px; width: 42%; padding: 5px; border-radius: 11px; }
		.intro-inset img { border-radius: 7px; }
		.intro-tag { left: 12px; bottom: 12px; max-width: calc(60% - 12px); padding: 9px 12px; }
		.intro-tag strong { font-size: 14px; }
		.intro-lede { font-size: 16px; }
		.intro-actions { flex-direction: column; align-items: stretch; }
		.intro-note { max-width: none; text-align: center; }
	}
</style>
