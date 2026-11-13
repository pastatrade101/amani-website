<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ChevronRight } from '@lucide/svelte';

	/**
	 * The photo hero every public page opens with: one full-bleed photograph,
	 * one veil, the breadcrumb at the top and the words anchored bottom-left.
	 * Pages pass their own photo (or a `media` snippet when the photo needs
	 * fallbacks), their words, their buttons and, optionally, a card on the right.
	 */
	type Crumb = { label: string; href?: string };
	let {
		id = 'top',
		titleId,
		image = '',
		imageAlt = '',
		imagePosition = 'center',
		crumbs = [],
		// Kept for old callers; the hero no longer shows a kicker over the title.
		eyebrow: _eyebrow = '',
		title,
		intro = '',
		media,
		actions,
		aside,
		asideWide = false
	}: {
		id?: string;
		titleId: string;
		image?: string;
		imageAlt?: string;
		imagePosition?: string;
		crumbs?: Crumb[];
		eyebrow?: string;
		title: string;
		intro?: string;
		media?: Snippet;
		actions?: Snippet;
		aside?: Snippet;
		/** A wider card (a tool rather than a note) that only shows from 1024px up. */
		asideWide?: boolean;
	} = $props();
</script>

<section {id} class="page-hero" class:aside-wide={asideWide} aria-labelledby={titleId}>
	{#if media}
		<div class="page-hero-media">{@render media()}</div>
	{:else if image}
		<img class="page-hero-media" src={image} alt={imageAlt} width="1600" height="1000" fetchpriority="high" style:object-position={imagePosition} />
	{/if}
	<div class="page-hero-veil" aria-hidden="true"></div>
	<div class="page-container page-hero-inner">
		{#if crumbs.length}
			<nav aria-label="Breadcrumb">
				<ol class="page-hero-crumbs">
					{#each crumbs as crumb, i (crumb.label)}
						<li>{#if crumb.href}<a href={crumb.href}>{crumb.label}</a>{:else}<span aria-current="page">{crumb.label}</span>{/if}</li>
						{#if i < crumbs.length - 1}<li aria-hidden="true"><ChevronRight /></li>{/if}
					{/each}
				</ol>
			</nav>
		{/if}
		<div class="page-hero-main">
			<div class="page-hero-copy">
				<h1 id={titleId} data-motion="hero" data-motion-delay="0.08">{title}</h1>
				{#if intro}<p data-motion="hero" data-motion-delay="0.16" class="page-hero-intro">{intro}</p>{/if}
				{#if actions}<div data-motion="hero" data-motion-delay="0.24" class="page-hero-actions">{@render actions()}</div>{/if}
			</div>
			{#if aside}<div class="page-hero-aside">{@render aside()}</div>{/if}
		</div>
	</div>
</section>

<style>
	.page-hero { position: relative; isolation: isolate; overflow: hidden; background: #2b2722; color: #fff; }
	.page-hero-media { position: absolute; inset: 0; z-index: -2; width: 100%; height: 100%; object-fit: cover; }
	.page-hero-media :global(.destination-image), .page-hero-media :global(img) { width: 100%; height: 100%; object-fit: cover; }
	/* Top fade for the breadcrumb, a deep floor for the words, a side fade for long lines. */
	.page-hero-veil {
		position: absolute; inset: 0; z-index: -1;
		background:
			linear-gradient(180deg, rgb(20 18 15 / 0.5) 0%, rgb(20 18 15 / 0) 24%),
			linear-gradient(0deg, rgb(20 18 15 / 0.92) 0%, rgb(20 18 15 / 0.64) 40%, rgb(20 18 15 / 0.14) 78%),
			linear-gradient(90deg, rgb(20 18 15 / 0.5) 0%, rgb(20 18 15 / 0) 60%);
	}
	.page-hero-inner { display: flex; flex-direction: column; min-height: clamp(560px, 78svh, 760px); padding-block: 26px 64px; }
	.page-hero-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: var(--text-xs); color: rgb(255 255 255 / 0.8); }
	.page-hero-crumbs a { transition: color 0.2s; }
	.page-hero-crumbs a:hover { color: var(--sun); }
	.page-hero-crumbs [aria-current] { font-weight: 600; color: #fff; }
	.page-hero-crumbs :global(svg) { width: 12px; height: 12px; }
	.page-hero-main { display: flex; align-items: flex-end; justify-content: space-between; gap: 48px; margin-top: auto; padding-top: 96px; }
	.page-hero-copy { min-width: 0; max-width: 780px; }
	.page-hero h1 { margin: 0; max-width: 16ch; font-size: var(--text-display); line-height: 1.04; text-wrap: balance; }
	.page-hero-intro { margin: 22px 0 0; max-width: 54ch; font-size: var(--text-lead); line-height: 1.75; color: rgb(255 255 255 / 0.86); }
	.page-hero-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 34px; }
	.page-hero-actions :global([data-slot='button']) { min-height: 50px; padding-inline: 24px; font-size: var(--text-sm); }
	/* The second button is always the quiet one: a white outline on the photo. */
	.page-hero-actions :global([data-slot='button'] + [data-slot='button']) { border: 1px solid rgb(255 255 255 / 0.6); background: transparent; color: #fff; font-weight: 600; box-shadow: none; }
	.page-hero-actions :global([data-slot='button'] + [data-slot='button']:hover) { border-color: #fff; background: rgb(255 255 255 / 0.1); color: #fff; }
	.page-hero-aside { flex: none; width: min(280px, 100%); }
	.aside-wide .page-hero-aside { width: min(400px, 100%); }
	@media (max-width: 1023px) { .page-hero-main { gap: 28px; } .page-hero-aside { width: 220px; } .aside-wide .page-hero-aside { display: none; } }
	@media (max-width: 639px) {
		.page-hero-veil { background: linear-gradient(180deg, rgb(20 18 15 / 0.5) 0%, rgb(20 18 15 / 0) 20%), linear-gradient(0deg, rgb(20 18 15 / 0.94) 0%, rgb(20 18 15 / 0.74) 50%, rgb(20 18 15 / 0.22) 86%); }
		.page-hero-inner { min-height: 600px; padding-block: 20px 40px; }
		.page-hero-main { display: block; padding-top: 120px; }
		.page-hero h1 { margin-top: 0; font-size: var(--text-display); line-height: 1.06; }
		.page-hero-intro { margin-top: 16px; font-size: var(--text-base); line-height: 1.7; }
		.page-hero-actions { flex-direction: column; align-items: stretch; margin-top: 26px; }
		.page-hero-actions :global([data-slot='button']) { width: 100%; justify-content: center; }
		.page-hero-aside { width: 100%; margin-top: 28px; }
	}
</style>
