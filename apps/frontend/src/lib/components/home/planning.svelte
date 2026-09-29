<script lang="ts">
	import { ArrowRight, MessageCircle, Map, Sunrise } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { safeUrl, textContent } from '$lib/home-content';
	import type { HomepageSection } from '$lib/types/api';
	let { section, canEnquire }: { section: HomepageSection; canEnquire: boolean } = $props();
	const steps = [
		{ number: '01', icon: MessageCircle, title: 'Tell us what moves you', description: 'Share your wish list, travel dates and the people you’re bringing along.' },
		{ number: '02', icon: Map, title: 'Shape your journey', description: 'Explore the route, experiences and stays with our team until it feels right.' },
		{ number: '03', icon: Sunrise, title: 'Look forward to Tanzania', description: 'Settle the details with your planner and get ready for the adventure ahead.' }
	];
</script>
<section id="how-it-works" class="planning-section">
	<div class="page-container">
		<div class="planning-heading"><div><p class="eyebrow text-muted-foreground">{section.subtitle}</p><h2 class="section-heading mt-4">{section.title}</h2></div><p class="section-description">{textContent(section.content)}</p></div>
		<div class="steps">{#each steps as step}<article><div class="step-top"><span class="step-icon"><step.icon class="size-6" strokeWidth={1.5} /></span><span class="step-number">{step.number}</span></div><h3>{step.title}</h3><p>{step.description}</p></article>{/each}</div>
		{#if canEnquire}<div class="planning-cta"><span>Your next great story starts with a conversation.</span><Button variant="safari" href={safeUrl(section.button_url)} class="h-12 px-6">{section.button_text || 'Start planning my safari'} <ArrowRight class="size-4" /></Button></div>{/if}
	</div>
</section>
<style>
	.planning-section { background: oklch(.975 .009 85); padding: 80px 0; }
	.planning-heading { display: grid; grid-template-columns: 1.2fr 1fr; align-items: end; gap: 80px; }
	.planning-heading .section-description { max-width: 420px; justify-self: end; }
	.steps { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 25px; margin-top: 42px; }
	.steps article { padding: 28px; background: white; border: 1px solid var(--border); border-radius: 16px; }
	.step-top { display: flex; align-items: center; justify-content: space-between; }
	.step-icon { display: grid; place-items: center; width: 50px; height: 50px; border-radius: 14px; background: var(--secondary); }
	.step-number { font-size: 35px; font-weight: 500; letter-spacing: -.06em; color: oklch(.87 .016 252); }
	.steps h3 { margin-top: 27px; font-size: 17px; font-weight: 600; letter-spacing: -.025em; }
	.steps p { margin-top: 12px; font-size: 13px; line-height: 1.85; color: var(--muted-foreground); }
	.planning-cta { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 25px; margin-top: 36px; font-size: 13px; }
	@media (max-width: 767px) { .planning-section { padding: 60px 0; } .planning-heading { grid-template-columns: 1fr; gap: 20px; } .planning-heading .section-description { justify-self: start; } .steps { grid-template-columns: 1fr; gap: 14px; margin-top: 30px; } .steps article { padding: 24px; } .steps h3 { margin-top: 16px; } .planning-cta { text-align: center; gap: 16px; } }
</style>
