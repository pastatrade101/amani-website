<script lang="ts">
	import { ArrowUpRight, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Activity, HomepageSection } from '$lib/types/api';
	import { safeUrl, textContent } from '$lib/home-content';
	let { items, section, onInterest, canEnquire = true }: { items: Activity[]; section: HomepageSection; onInterest: (name: string) => void; canEnquire?: boolean } = $props();
	let page = $state(0);
	let pageCount = $derived(Math.max(1, Math.ceil(items.length / 3)));
	let selectedPage = $derived(page % pageCount);
	let shown = $derived(items.slice(selectedPage * 3, selectedPage * 3 + 3));
	function step(direction: number) { page = (selectedPage + direction + pageCount) % pageCount; }
</script>
<section id="experiences" class="experience-section">
	<div class="page-container">
		<div class="experience-heading"><div><p class="eyebrow text-muted-foreground">{section.subtitle}</p><h2 class="section-heading mt-4">{section.title}</h2></div><div class="experience-intro"><p class="section-description">{textContent(section.content)}</p>{#if pageCount > 1}<div class="mt-5 flex gap-2"><Button variant="outline" size="icon" onclick={() => step(-1)} aria-label="Previous experiences" class="size-10 rounded-full bg-transparent"><ChevronLeft class="size-4" /></Button><Button variant="outline" size="icon" onclick={() => step(1)} aria-label="Next experiences" class="size-10 rounded-full bg-transparent"><ChevronRight class="size-4" /></Button></div>{/if}</div></div>
		<div class="experience-grid">
			{#each shown as item (item.id)}
				<article class="experience-card group">
					<img src={safeUrl(item.image_url_thumbnail || item.hero_image_url_thumbnail || item.image_url || item.hero_image_url, '/images/safari-hero.jpg')} alt={item.name} loading="lazy" />
					<div class="experience-copy"><span class="experience-line"></span><h3>{item.name}</h3><p>{textContent(item.description)}</p>{#if canEnquire}<a href="#request-quote" onclick={() => onInterest(item.name)} aria-label={`Explore ${item.name}`} class="experience-cta">Explore this experience <span><ArrowUpRight class="size-4" /></span></a>{/if}</div>
				</article>
			{:else}<p class="rounded-2xl border border-border bg-white p-8 text-sm leading-7 text-muted-foreground md:col-span-3">New experiences are on their way. Let us help you plan a journey around your interests.</p>{/each}
		</div>
		{#if pageCount > 1}<div class="experience-pagination">{#each Array.from({length: pageCount}) as _, i}<button type="button" aria-label={`Show experiences ${i * 3 + 1} to ${Math.min(items.length, i * 3 + 3)}`} aria-current={i === selectedPage ? 'true' : undefined} onclick={() => page = i}><span class:active={i === selectedPage}></span></button>{/each}</div>{/if}
	</div>
</section>
<style>
	.experience-section { padding: 80px 0 65px; background: oklch(.975 .009 85); }
	.experience-heading { display: grid; grid-template-columns: 1.2fr .8fr; gap: 100px; align-items: end; }
	.experience-heading h2 { max-width: 570px; }
	.experience-intro { max-width: 370px; justify-self: end; }
	.experience-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 22px; margin-top: 38px; }
	.experience-card { position: relative; min-height: 415px; overflow: hidden; isolation: isolate; border-radius: 17px; background: var(--navy); }
	.experience-card > img { position: absolute; inset: 0; z-index: -2; width: 100%; height: 100%; object-fit: cover; transition: transform 300ms ease-out; }
	.experience-card::after { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(180deg, transparent 10%, rgb(3 17 21 / .3) 35%, rgb(3 17 21 / .92)); }
	.experience-card:hover > img { transform: scale(1.035); }
	.experience-copy { position: absolute; inset-inline: 25px; bottom: 25px; color: white; }
	.experience-line { display: block; width: 30px; height: 3px; border-radius: 4px; background: var(--sun); }
	.experience-copy h3 { margin-top: 13px; font-size: 25px; font-weight: 600; line-height: 1.2; letter-spacing: -.04em; }
	.experience-copy p { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; margin-top: 12px; font-size: 12px; line-height: 1.85; color: rgb(255 255 255 / .8); }
	.experience-cta { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 20px; padding-top: 17px; border-top: 1px solid rgb(255 255 255 / .25); font-size: 11px; font-weight: 500; }
	.experience-cta span { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--sun); color: var(--navy); }
	.experience-pagination { display: flex; justify-content: center; gap: 1px; margin-top: 22px; }
	.experience-pagination button { display: grid; place-items: center; min-width: 30px; height: 28px; }
	.experience-pagination span { display: block; width: 6px; height: 6px; border-radius: 10px; background: var(--border); }
	.experience-pagination span.active { width: 25px; background: var(--navy); }
	@media (max-width: 1023px) { .experience-heading { gap: 35px; } .experience-grid { gap: 14px; } .experience-card { min-height: 400px; } .experience-copy { inset-inline: 18px; bottom: 20px; } .experience-copy h3 { font-size: 21px; } }
	@media (max-width: 767px) { .experience-section { padding: 60px 0 45px; } .experience-heading { grid-template-columns: 1fr; gap: 20px; } .experience-intro { max-width: none; justify-self: start; } .experience-grid { grid-template-columns: 1fr; gap: 18px; margin-top: 27px; } .experience-card { min-height: 390px; } .experience-copy { inset-inline: 25px; bottom: 25px; } .experience-copy h3 { font-size: 27px; } }
</style>
