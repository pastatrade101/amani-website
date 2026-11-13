<script lang="ts">
	import { ArrowRight, Compass, FileText, MessageCircle } from '@lucide/svelte';
	import { PHOTO } from '$lib/media-photos';
	import { safeUrl, textContent } from '$lib/home-content';
	import { refreshSections, WHATSAPP_URL } from '$lib/homepage-refresh';
	import type { HomepageSection, TourDetail } from '$lib/types/api';

	type Person = NonNullable<TourDetail['specialist']>;
	// A person to talk to, halfway down the page: the same dark photo card as
	// the safari pages' booking card, with the free quote and WhatsApp side by side.
	let { section, team = null, canEnquire = true }: { section: HomepageSection; team?: Person | null; canEnquire?: boolean } = $props();

	let fallback = $derived(refreshSections.find((item) => item.section_key === 'planning_cta'));
	const extra = (key: string) => String(section.extra_data?.[key] ?? fallback?.extra_data?.[key] ?? '').trim();
	let image = $derived(safeUrl(section.image_url, PHOTO.guidePicnic));
	let teamPhoto = $derived(team?.photo_url ? safeUrl(team.photo_url, '') : '');
	let quoteHref = $derived.by(() => {
		const target = safeUrl(section.button_url, '#plan-form');
		return target === '#plan-form' && !canEnquire ? '/plan-my-trip' : target;
	});
	let chatHref = $derived(safeUrl(extra('secondary_cta_url') || WHATSAPP_URL, WHATSAPP_URL));
	// The highlighted words of the heading, when the heading contains them.
	let title = $derived.by(() => {
		const text = section.title || 'Ready to plan your safari?';
		const mark = extra('title_highlight');
		const at = mark ? text.lastIndexOf(mark) : -1;
		return at < 0 ? { before: text, mark: '', after: '' } : { before: text.slice(0, at), mark, after: text.slice(at + mark.length) };
	});
</script>

<section class="home-band consultant-band" aria-labelledby="consultant-title">
	<div class="home-container">
		<div class="consultant" data-motion="reveal">
			<div class="consultant-photo"><img src={image} alt="" loading="lazy" width="1200" height="800" /></div>
			<div class="consultant-copy">
				<h2 id="consultant-title">{title.before}{#if title.mark}<span class="mark">{title.mark}</span>{/if}{title.after}</h2>
				{#if textContent(section.content)}<p class="consultant-intro">{textContent(section.content)}</p>{/if}
				{#if team}
					<div class="consultant-team">
						{#if teamPhoto}<img src={teamPhoto} alt="" loading="lazy" width="56" height="56" />{:else}<span class="team-mark" aria-hidden="true"><Compass /></span>{/if}
						<p>Share your dates and travel style with <strong>{team.name}</strong>{team.role ? `, ${team.role}` : ''}.</p>
					</div>
				{/if}
				<div class="consultant-actions">
					<a class="cta cta-sun" href={quoteHref} data-cta="free_quote" data-cta-location="home_consultant"><FileText aria-hidden="true" />{section.button_text || 'Request a Free Quote'}<ArrowRight aria-hidden="true" /></a>
					<a class="cta cta-chat" href={chatHref} target="_blank" rel="noopener noreferrer" data-cta="whatsapp" data-cta-location="home_consultant"><MessageCircle aria-hidden="true" />{extra('secondary_cta_text') || 'WhatsApp Us'}</a>
				</div>
				{#if extra('footnote')}<p class="consultant-note">{extra('footnote')}</p>{/if}
			</div>
		</div>
	</div>
</section>

<style>
	.consultant { position: relative; isolation: isolate; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); min-height: 440px; overflow: hidden; border-radius: var(--radius-surface); background: #2b2722; color: #fff; box-shadow: 0 30px 60px -44px rgb(20 18 15 / 0.6); }
	.consultant-photo { position: absolute; inset: 0; z-index: -1; }
	.consultant-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 75% 45%; }
	/* Solid behind the words, then easing out across the photo. */
	.consultant-photo::after {
		content: ''; position: absolute; inset: 0;
		background:
			linear-gradient(90deg, rgb(43 39 34 / 0.95) 0%, rgb(43 39 34 / 0.9) 24%, rgb(43 39 34 / 0.8) 34%, rgb(43 39 34 / 0.66) 42%, rgb(43 39 34 / 0.5) 50%, rgb(43 39 34 / 0.34) 57%, rgb(43 39 34 / 0.2) 65%, rgb(43 39 34 / 0.09) 74%, rgb(43 39 34 / 0.02) 84%, rgb(43 39 34 / 0) 94%),
			linear-gradient(0deg, rgb(43 39 34 / 0.35) 0%, rgb(43 39 34 / 0) 40%);
	}
	.consultant-copy { display: flex; flex-direction: column; justify-content: center; padding: 56px 8px 56px 60px; }
	h2 { max-width: 15ch; margin: 0; font-size: var(--text-h2); font-weight: 600; line-height: 1.08; letter-spacing: -0.03em; text-wrap: balance; }
	.mark { color: var(--sun); }
	.consultant-intro { max-width: 44ch; margin: 16px 0 0; font-size: var(--text-base); line-height: 1.7; color: rgb(255 255 255 / 0.78); }
	.consultant-team { display: flex; align-items: center; gap: 14px; max-width: 46ch; margin-top: 22px; }
	.consultant-team img, .team-mark { flex: none; width: 52px; height: 52px; border: 2px solid var(--sun); border-radius: 50%; object-fit: cover; }
	.team-mark { display: grid; place-items: center; color: var(--sun); }
	.team-mark :global(svg) { width: 22px; height: 22px; }
	.consultant-team p { margin: 0; font-size: var(--text-base); line-height: 1.55; color: rgb(255 255 255 / 0.78); }
	.consultant-team strong { font-weight: 600; color: #fff; }
	.consultant-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 30px; }
	.cta { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 50px; padding: 12px 24px; border-radius: var(--radius-control); font-size: var(--text-sm); font-weight: 700; line-height: 1.3; text-decoration: none; transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease; }
	.cta :global(svg) { width: 17px; height: 17px; flex: none; }
	.cta-sun { background: var(--sun); color: #2b2722; }
	.cta-sun:hover { background: color-mix(in oklab, var(--sun) 90%, black); }
	.cta-sun :global(svg:last-child) { transition: transform 0.2s ease; }
	.cta-sun:hover :global(svg:last-child) { transform: translateX(3px); }
	.cta-chat { border: 1px solid rgb(255 255 255 / 0.4); color: #fff; }
	.cta-chat:hover { border-color: #fff; background: rgb(255 255 255 / 0.08); }
	.cta-chat :global(svg) { color: #4ade80; }
	.cta:focus-visible { outline: 2px solid var(--sun); outline-offset: 3px; }
	.consultant-note { margin: 14px 0 0; font-size: var(--text-sm); color: rgb(255 255 255 / 0.6); }
	@media (max-width: 960px) {
		/* The photo moves to the top and fades down into the words. */
		.consultant { grid-template-columns: minmax(0, 1fr); min-height: 0; }
		.consultant-photo { position: relative; inset: auto; z-index: 0; aspect-ratio: 16 / 9; }
		.consultant-photo img { object-position: center 45%; }
		.consultant-photo::after { background: linear-gradient(0deg, #2b2722 0%, rgb(43 39 34 / 0.8) 14%, rgb(43 39 34 / 0.5) 30%, rgb(43 39 34 / 0.22) 48%, rgb(43 39 34 / 0.06) 66%, rgb(43 39 34 / 0) 80%); }
		.consultant-copy { padding: 8px 40px 44px; }
	}
	@media (max-width: 600px) {
		.consultant-photo { aspect-ratio: 4 / 3; }
		.consultant-copy { padding: 4px 22px 30px; }
		.consultant-actions { flex-direction: column; align-items: stretch; }
	}
	@media (prefers-reduced-motion: reduce) { .cta-sun:hover :global(svg:last-child) { transform: none; } }
</style>
