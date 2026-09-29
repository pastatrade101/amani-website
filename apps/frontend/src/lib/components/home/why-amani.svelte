<script lang="ts">
	import { ArrowRight, Compass, Heart, Route } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { safeUrl, textContent } from '$lib/home-content';
	import type { HomepageSection } from '$lib/types/api';
	let { section, canEnquire }: { section: HomepageSection; canEnquire: boolean } = $props();
	const reasons = [
		{ icon: Compass, title: 'A local perspective', text: 'Discover the places, people and small details that make Tanzania special.' },
		{ icon: Heart, title: 'A safari that feels like you', text: 'Your interests, your travel dates, your pace. A journey shaped around you.' },
		{ icon: Route, title: 'Room for a little more', text: 'From the Serengeti plains to the shores of Zanzibar, make the journey your own.' }
	];
</script>
<section id="why-amani" class="why-section">
	<div class="page-container why-grid">
		<div class="why-photos">
			<img class="main-photo" src={safeUrl(section.image_url, '/images/activity-bush-lunch.jpg')} alt="A table set for an intimate lunch in the Tanzanian wilderness" loading="lazy" />
			<img class="detail-photo" src="/images/itinerary-elephants.jpg" alt="Elephants in Tanzania’s wild landscape" loading="lazy" />
			<div class="photo-note"><Compass class="size-6" strokeWidth={1.4} /><span>A little closer<br /><strong>to the extraordinary.</strong></span></div>
		</div>
		<div class="why-copy">
			<p class="eyebrow">{section.subtitle}</p><h2 class="section-heading mt-4">{section.title}</h2>
			<p class="section-description mt-5">{textContent(section.content)}</p>
			<div class="reason-list">{#each reasons as reason}<div class="reason"><span class="reason-icon"><reason.icon class="size-5" strokeWidth={1.6} /></span><div><h3>{reason.title}</h3><p>{reason.text}</p></div></div>{/each}</div>
			{#if canEnquire}<Button variant="safari" href={safeUrl(section.button_url)} class="mt-7 h-12 px-6">{section.button_text || 'Plan my safari'} <ArrowRight class="size-4" /></Button>{/if}
		</div>
	</div>
</section>
<style>
	.why-section { padding: 48px 0 96px; }
	.why-grid { display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 86px; }
	.why-photos { position: relative; padding: 0 50px 54px 0; }
	.main-photo { width: 100%; height: 470px; border-radius: 20px; object-fit: cover; }
	.detail-photo { position: absolute; right: 0; bottom: 0; width: 49%; height: 220px; border: 8px solid white; border-radius: 20px; object-fit: cover; }
	.photo-note { position: absolute; bottom: 76px; left: -16px; display: flex; align-items: center; gap: 13px; border: 1px solid var(--border); border-radius: 12px; background: white; padding: 18px 20px; box-shadow: 0 10px 30px rgb(15 35 55 / .06); }
	.photo-note span { font-size: 11px; line-height: 1.7; }
	.photo-note strong { font-weight: 600; }
	.why-copy { min-width: 0; }
	.why-copy :global(a) { max-width: 100%; white-space: normal; }
	.why-copy .eyebrow { color: var(--muted-foreground); }
	.reason-list { display: grid; gap: 21px; margin-top: 27px; }
	.reason { display: flex; gap: 14px; }
	.reason-icon { display: grid; place-items: center; width: 43px; height: 43px; flex-shrink: 0; border-radius: 12px; background: oklch(.97 .025 95); }
	.reason h3 { font-size: 14px; font-weight: 600; }
	.reason p { max-width: 365px; margin-top: 5px; font-size: 12px; line-height: 1.8; color: var(--muted-foreground); }
	@media (max-width: 1023px) { .why-grid { gap: 38px; } .main-photo { height: 480px; } .detail-photo { height: 185px; } .photo-note { left: 0; padding: 14px; } }
	@media (max-width: 767px) { .why-section { padding: 28px 0 64px; } .why-grid { grid-template-columns: minmax(0,1fr); gap: 34px; } .why-photos { padding-right: 35px; } .main-photo { height: 340px; } .detail-photo { height: 175px; } .photo-note { bottom: 70px; } }
</style>
