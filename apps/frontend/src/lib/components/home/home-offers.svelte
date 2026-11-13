<script lang="ts">
	import { ArrowRight, MapPin } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { PHOTO } from '$lib/media-photos';
	import { safeUrl, textContent } from '$lib/home-content';
	import { offerHref, offerLabel, offerRowsFor, refreshSections } from '$lib/homepage-refresh';
	import { scrollcraft } from '$lib/motion/scrollcraft';
	import { glide } from '$lib/motion/glide';
	import { rail, steer } from '$lib/motion/rail';
	import type { Category, Destination, HomepageSection } from '$lib/types/api';

	// "What we offer": the four journeys travellers ask about most, each told by
	// its photo.
	//
	// Large screens with motion: a ScrollCraft pinned act. One wide photo frame
	// holds the screen; each journey wipes up over the last while its words cross
	// over on the dark side of the frame, and a story bar along the bottom fills
	// as you scroll. Pressing a journey in the bar scrolls straight to it.
	// Phones and tablets: a switcher over swipeable photo cards, like an app.
	// Reduced motion or a short window: the same photo cards in a grid.
	let { section, categories = [], destinations = [], canEnquire = true }: { section: HomepageSection; categories?: Category[]; destinations?: Destination[]; canEnquire?: boolean } = $props();

	const STORY = '(min-width: 1024px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)';

	let fallback = $derived(refreshSections.find((item) => item.section_key === 'safari_offers'));
	let rows = $derived(offerRowsFor(section));
	const extra = (key: string) => String(section.extra_data?.[key] ?? fallback?.extra_data?.[key] ?? '').trim();
	// The opening paragraph tells the journey; the rest waits behind its link.
	const lead = (text: string) => text.split(/\n\s*\n/).map((part) => textContent(part)).find(Boolean) ?? '';
	const where = (row: { facts?: { label: string; value: string }[] }) => row.facts?.find((fact) => /where/i.test(fact.label))?.value ?? '';
	let ctaHref = $derived.by(() => {
		const target = safeUrl(section.button_url, '#plan-form');
		return target === '#plan-form' && !canEnquire ? '/plan-my-trip' : target;
	});

	let live = $state(false);
	let active = $state(0);
	let fills = $state<number[]>([]);
	let act = $state<HTMLElement>();
	let list = $state<HTMLOListElement>();

	// Cue windows in act progress: each journey owns an equal share, fading in
	// over the first 16% of its share and out over the last 16%. The first is
	// already there when the act arrives; the last holds as the act leaves.
	function cue(i: number) {
		const n = rows.length;
		if (n === 1) return '0 1 0 0';
		const from = (i / n).toFixed(3), to = ((i + 1) / n).toFixed(3);
		return i === 0 ? `0 ${to} 0 0.16` : i === n - 1 ? `${from} 1 0.16 0` : `${from} ${to} 0.16 0.16`;
	}
	// Each photo wipes up just ahead of its words.
	const wipe = (i: number) => `${(i / rows.length - 0.05).toFixed(3)} ${(i / rows.length + 0.03).toFixed(3)}`;

	function progress() {
		if (!act) return 0;
		const box = act.getBoundingClientRect();
		return Math.min(1, Math.max(0, -box.top / Math.max(box.height - innerHeight, 1)));
	}

	// The story bar follows the scroll while the act runs.
	$effect(() => {
		if (!live) return;
		let frame = 0;
		const follow = () => {
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				const n = rows.length, p = progress();
				active = Math.min(n - 1, Math.floor(p * n));
				fills = rows.map((_, i) => Math.min(1, Math.max(0, p * n - i)));
			});
		};
		addEventListener('scroll', follow, { passive: true });
		follow();
		return () => {
			removeEventListener('scroll', follow);
			cancelAnimationFrame(frame);
		};
	});

	const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
	function go(i: number, instant = false) {
		if (live && act) {
			const top = act.getBoundingClientRect().top + scrollY;
			const travel = act.offsetHeight - innerHeight;
			scrollTo({ top: top + (travel * (i + 0.5)) / rows.length, behavior: instant || reduced() ? 'instant' : 'smooth' });
			return;
		}
		// Phones: the chosen card glides to the middle; the tabs stay on it
		// rather than flickering through the cards it passes.
		active = i;
		steer(list, i);
	}

	// Keyboard: tabbing into a journey that is not on screen brings it there.
	function reach(event: FocusEvent) {
		if (!live || !list) return;
		const row = (event.target as HTMLElement).closest('li');
		const i = row ? [...list.children].indexOf(row) : -1;
		if (i >= 0 && i !== active) go(i, true);
	}
</script>

{#if rows.length}
	<section id="safari-offers" class="offers home-cream" aria-labelledby="offers-title" use:scrollcraft={{ query: STORY, onChange: (on) => (live = on) }}>
		<header class="home-container offers-head" data-motion="reveal">
			<h2 id="offers-title" class="home-heading">{section.title}</h2>
			{#if textContent(section.content)}<p class="home-copy">{textContent(section.content)}</p>{/if}
		</header>

		<div class="offers-act" bind:this={act} data-sc-act="pin" data-sc-span={(rows.length * 0.85 + 1).toFixed(2)}>
			<div class="offers-stage" data-sc-stage>
				<div class="offers-frame">
					<div class="offers-photos" aria-hidden="true">
						<div class="offers-drift" data-sc-parallax="0.9">
							{#each rows as row, i (row.title)}
								<img src={safeUrl(row.image, PHOTO.popUpRoofView)} alt="" loading="lazy" width="1600" height="1000" data-sc-reveal={i ? 'down' : undefined} data-sc-reveal-at={i ? wipe(i) : undefined} />
							{/each}
						</div>
						<span class="offers-scrim"></span>
					</div>

					{#if rows.length > 1}
						<div class="offers-switch" role="group" aria-label="Choose a safari" use:glide={{ center: !live }}>
							{#each rows as row, i (row.title)}
								<button type="button" style={`--fill:${fills[i] ?? 0}`} aria-current={active === i ? 'true' : undefined} aria-controls={`journey-${i}`} onclick={() => go(i)}><span class="track" aria-hidden="true"><span class="fill"></span></span>{offerLabel(row)}</button>
							{/each}
						</div>
					{/if}

					<ol class="journeys" bind:this={list} onfocusin={reach} use:rail={{ onIndex: (i) => { if (!live) active = i; } }}>
						{#each rows as row, i (row.title)}
							{@const href = offerHref(row, categories, destinations)}
							<li id={`journey-${i}`} class="journey" data-sc-cue={cue(i)}>
								<a class="journey-photo" {href} tabindex="-1" aria-hidden="true"><img src={safeUrl(row.image, PHOTO.popUpRoofView)} alt="" loading="lazy" width="1200" height="900" /></a>
								<div class="journey-copy">
									{#if where(row)}<p class="journey-where"><MapPin aria-hidden="true" />{where(row)}</p>{/if}
									<h3>{row.title}</h3>
									{#if lead(row.text)}<p class="journey-text">{lead(row.text)}</p>{/if}
									{#if row.facts?.length}
										<dl class="journey-facts">
											{#each row.facts as fact}<div><dt>{fact.label}</dt><dd>{fact.value}</dd></div>{/each}
										</dl>
									{/if}
									<div class="journey-foot"><a class="journey-link" {href}>{row.cta_label || `Explore ${row.title}`}<ArrowRight aria-hidden="true" /></a></div>
								</div>
							</li>
						{/each}
					</ol>
				</div>
			</div>
		</div>

		{#if extra('cta_title')}
			<div class="home-container offers-cta" data-motion="reveal">
				<div><h3>{extra('cta_title')}</h3>{#if extra('cta_text')}<p>{extra('cta_text')}</p>{/if}</div>
				<Button variant="safari" class="h-12 shrink-0 px-7" href={ctaHref}>{section.button_text || 'Create My Safari'}<ArrowRight class="size-4" /></Button>
			</div>
		{/if}
	</section>
{/if}

<style>
	.offers { padding-block: 80px; }
	.offers-head > :global(*) { max-width: 44rem; }
	.offers-head .home-copy { margin-top: 16px; }
	.offers-frame { width: 84%; max-width: var(--page-max); margin-inline: auto; }
	.offers-photos { display: none; }
	.journeys { margin: 40px 0 0; padding: 0; list-style: none; }

	/* ---- The photo card: a dark card that frames its photo like a print, with
	   nothing written over the picture. Under it: where it happens, the title,
	   three lines of story and the way in. ---- */
	.journey { position: relative; display: flex; flex-direction: column; padding: 8px; overflow: hidden; border-radius: 14px; background: #221e19; color: white; box-shadow: 0 1px 0 rgb(255 255 255 / 0.06) inset, 0 28px 50px -34px rgb(31 27 22 / 0.75); }
	.journey-photo { position: relative; display: block; flex: none; aspect-ratio: 5 / 4; overflow: hidden; border-radius: 9px; background: #2b2722; }
	.journey-photo img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1); }
	/* A hairline inside the frame keeps light photos from bleeding into the mat. */
	.journey-photo::after { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08); pointer-events: none; }
	@media (hover: hover) { .journey:hover .journey-photo img { transform: scale(1.04); } }
	.journey-copy { display: flex; flex: 1; flex-direction: column; padding: 20px 14px 12px; }
	.journey-where { display: flex; align-items: center; gap: 6px; min-width: 0; margin: 0 0 10px; color: color-mix(in oklch, var(--sun) 78%, white); font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.01em; }
	.journey-where :global(svg) { flex: none; width: 14px; height: 14px; }
	h3 { margin: 0; font-size: var(--text-h3); font-weight: 600; line-height: 1.12; letter-spacing: -0.025em; color: inherit; text-wrap: balance; }
	.journey-text { display: -webkit-box; margin: 10px 0 0; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; font-size: var(--text-base); line-height: 1.6; color: rgb(255 255 255 / 0.74); }
	/* The button sits on the card's floor, so a row of cards lines up. */
	.journey-foot { margin-top: auto; padding-top: 22px; }
	.journey-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 20px; margin: 20px 0 0; padding-top: 18px; border-top: 1px solid rgb(255 255 255 / 0.16); }
	.journey-facts div:nth-child(n + 3) { display: none; }
	.journey-facts dt { font-size: var(--text-xs); font-weight: 500; color: rgb(255 255 255 / 0.6); }
	.journey-facts dd { margin: 3px 0 0; font-size: var(--text-sm); font-weight: 600; line-height: 1.4; color: white; }
	.journey-link { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 0 20px; border-radius: var(--radius-control); background: var(--sun); color: #221e19; font-size: var(--text-sm); font-weight: 700; text-decoration: none; transition: background-color 0.2s ease, transform 0.2s ease; }
	.journey-link:hover { background: color-mix(in oklab, var(--sun) 90%, black); }
	.journey-link:active { transform: scale(0.98); }
	.journey-link :global(svg) { width: 16px; height: 16px; transition: transform 0.2s ease; }
	.journey-link:hover :global(svg) { transform: translateX(3px); }
	.journey-link:focus-visible { outline: 2px solid white; outline-offset: 3px; }

	/* The switcher (phones and tablets): an edge-to-edge strip of tabs, each with
	   room for its words. Each tab rests on a soft chip that sits beneath the
	   dark marker, so as the marker glides over (use:glide) nothing switches on
	   or off; only the words change colour. The strip scrolls its tab to the
	   middle. */
	.offers-switch { display: flex; gap: 8px; margin: 28px calc(50% - 50vw) 0; padding: 2px calc(50vw - 50%); overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; }
	.offers-switch::-webkit-scrollbar { display: none; }
	.offers-switch :global(.glide-mark) { border-radius: 9px; background: var(--navy); box-shadow: 0 10px 20px -12px rgb(31 27 22 / 0.8); }
	.offers-switch button { position: relative; flex: none; min-height: 44px; padding: 0 20px; border: 0; border-radius: 9px; background: none; color: #5f584e; font-size: var(--text-sm); font-weight: 600; letter-spacing: -0.01em; text-align: center; white-space: nowrap; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: color 0.45s cubic-bezier(0.22, 1, 0.36, 1); }
	.offers-switch button::before { content: ''; position: absolute; inset: 0; z-index: -2; border-radius: inherit; background: #ebe6da; transition: background-color 0.2s ease; }
	.offers-switch button:hover { color: var(--navy); }
	.offers-switch button:hover::before { background: #e3ddcf; }
	.offers-switch button[aria-current='true'] { color: white; }
	.offers-switch button:focus-visible { outline: 2px solid var(--sun); outline-offset: 2px; }
	.track { display: none; }

	.offers-cta { display: flex; align-items: center; justify-content: space-between; gap: 24px 40px; margin-top: 56px; }
	.offers-cta h3 { color: var(--navy); font-size: var(--text-h4); }
	.offers-cta p { margin: 6px 0 0; font-size: var(--text-base); line-height: 1.6; color: var(--muted-foreground); }

	/* ---- Large screens without the story: the cards two by two ---- */
	@media (min-width: 1024px) {
		.offers:not(:global([data-sc-live])) .offers-switch { display: none; }
		.offers:not(:global([data-sc-live])) .journeys { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
		.offers:not(:global([data-sc-live])) .journey-photo { aspect-ratio: 16 / 9; }
		.offers:not(:global([data-sc-live])) .journey { padding: 10px; }
		.offers:not(:global([data-sc-live])) .journey-copy { padding: 26px 26px 18px; }
		.offers:not(:global([data-sc-live])) .journey-where { display: none; }
		.offers:not(:global([data-sc-live])) .journey-facts { grid-template-columns: repeat(3, minmax(0, 1fr)); }
		.offers:not(:global([data-sc-live])) .journey-facts div:nth-child(n + 3) { display: block; }
		.offers:not(:global([data-sc-live])) .journey-link { width: fit-content; }
	}

	/* ---- The ScrollCraft story ---- */
	.offers:global([data-sc-live]) { padding-bottom: 72px; }
	.offers:global([data-sc-live]) .offers-act { margin-top: 40px; }
	.offers:global([data-sc-live]) .offers-stage { position: sticky; top: var(--site-header-height); height: calc(100svh - var(--site-header-height) - var(--compare-offset, 0px)); padding: 0 0 24px; overflow: clip; }
	/* The same rail as every other section: 84% wide, never past the page max. */
	.offers:global([data-sc-live]) .offers-frame { position: relative; isolation: isolate; width: 84%; max-width: var(--page-max); height: 100%; overflow: hidden; border-radius: 14px; background: #221e19; }
	.offers:global([data-sc-live]) .offers-photos { position: absolute; inset: 0; z-index: -1; display: block; }
	/* Taller than the frame, so the drift never shows an edge. */
	.offers:global([data-sc-live]) .offers-drift { position: absolute; inset: -48px 0; }
	.offers:global([data-sc-live]) .offers-drift img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
	/* Dark only where the words sit: the left side and the story bar. */
	.offers:global([data-sc-live]) .offers-scrim { position: absolute; inset: 0; background: linear-gradient(90deg, rgb(22 19 15 / 0.9) 0%, rgb(22 19 15 / 0.8) 22%, rgb(22 19 15 / 0.52) 40%, rgb(22 19 15 / 0.18) 56%, rgb(22 19 15 / 0) 68%), linear-gradient(0deg, rgb(22 19 15 / 0.72) 0%, rgb(22 19 15 / 0.3) 14%, rgb(22 19 15 / 0) 28%); }
	.offers:global([data-sc-live]) .journeys { position: absolute; inset: 0 auto 120px 0; display: grid; align-items: center; width: min(58%, 640px); margin: 0; padding-left: clamp(36px, 4.5vw, 64px); }
	.offers:global([data-sc-live]) .journey { grid-area: 1 / 1; display: block; min-height: 0; padding: 0; overflow: visible; border-radius: 0; background: none; box-shadow: none; }
	.offers:global([data-sc-live]) .journey-where { display: none; }
	.offers:global([data-sc-live]) .journey-photo { display: none; }
	.offers:global([data-sc-live]) .journey-copy { display: block; padding: 0; }
	.offers:global([data-sc-live]) h3 { font-size: var(--text-title); line-height: 1.05; letter-spacing: -0.035em; }
	.offers:global([data-sc-live]) .journey-text { margin-top: 20px; max-width: 32rem; font-size: var(--text-lg); line-height: 1.7; }
	.offers:global([data-sc-live]) .journey-facts { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 28px; max-width: 34rem; margin-top: 28px; padding-top: 22px; }
	.offers:global([data-sc-live]) .journey-facts div:nth-child(n + 3) { display: block; }
	.offers:global([data-sc-live]) .journey-foot { padding-top: 30px; }
	/* The story bar: one track per journey, filling with the scroll. */
	.offers:global([data-sc-live]) .offers-switch { position: absolute; inset: auto clamp(36px, 4.5vw, 64px) 34px; display: grid; grid-auto-columns: minmax(0, 1fr); grid-auto-flow: column; gap: 24px; margin: 0; padding: 0; overflow: visible; }
	.offers:global([data-sc-live]) .offers-switch :global(.glide-mark), .offers:global([data-sc-live]) .offers-switch button::before { display: none; }
	.offers:global([data-sc-live]) .offers-switch button { display: grid; gap: 14px; justify-items: start; min-height: 52px; padding: 0; border: 0; border-radius: 0; background: none; color: rgb(255 255 255 / 0.6); font-size: var(--text-base); text-align: left; transition: color 0.4s ease; }
	.offers:global([data-sc-live]) .offers-switch button:hover, .offers:global([data-sc-live]) .offers-switch button[aria-current='true'] { color: white; }
	.offers:global([data-sc-live]) .track { position: relative; display: block; width: 100%; height: 2px; overflow: hidden; border-radius: 2px; background: rgb(255 255 255 / 0.24); }
	.offers:global([data-sc-live]) .fill { position: absolute; inset: 0; background: white; transform: scaleX(var(--fill, 0)); transform-origin: left; }
	.offers:global([data-sc-live]) .offers-cta { width: 84%; max-width: var(--page-max); margin: 56px auto 0; }

	/* ---- Phones and tablets: the switcher over a rail of swipeable cards. The
	   chosen card rests in the middle with its neighbours peeking either side.
	   use:rail tells each card how far it is from the middle, every frame, so
	   the neighbours sit back and dim, and each photo drifts inside its frame,
	   exactly with the finger. ---- */
	@media (max-width: 1023px) {
		.offers { padding-block: 56px; }
		.offers-frame { width: 90%; }
		.journeys { --card: min(80vw, 400px); display: flex; gap: 10px; margin: 18px calc(50% - 50vw) 0; padding: 6px calc((100vw - var(--card)) / 2) 14px; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory; scrollbar-width: none; }
		.journeys::-webkit-scrollbar { display: none; }
		.journey { flex: 0 0 var(--card); scroll-snap-align: center; scroll-snap-stop: always; scale: calc(1 - var(--rail-abs, 0) * 0.05); opacity: calc(1 - var(--rail-abs, 0) * 0.35); }
		.journey-photo img { transform: translateX(calc(var(--rail, 0) * -10%)) scale(1.22); transition: none; }
		h3 { font-size: var(--text-2xl); }
		/* On a phone the card says only what it needs: the rest lives on the
		   safari's own page. */
		.journey-facts { display: none; }
		.journey-foot { padding-top: 20px; }
		.journey-link { width: 100%; }
		.offers-cta { flex-direction: column; align-items: stretch; margin-top: 40px; }
		.offers-cta :global(a) { width: 100%; }
	}
	@media (min-width: 768px) and (max-width: 1023px) { .offers-frame { width: 84%; } .journeys { --card: min(56vw, 420px); } }
	@media (max-width: 380px) { .offers-switch button { padding: 0 16px; } }
	@media (prefers-reduced-motion: reduce) {
		.journey-photo img, .journey-link :global(svg), .offers-switch button { transition: none; }
		.journey-photo img, .journey:hover .journey-photo img, .journey-link:hover :global(svg) { transform: none; }
		.journey { scale: none; }
	}
</style>
