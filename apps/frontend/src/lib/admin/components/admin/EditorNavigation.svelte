<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { AlertCircle, ArrowUpRight } from '@lucide/svelte';
  import type { Component } from 'svelte';
  let { sections, active, errors = {}, onNavigate }: { sections: readonly (readonly [string, Component, string])[]; active: string; errors?: Record<string, boolean>; onNavigate: (key: string) => void } = $props();
  const descriptions: Record<string,string> = {basics: 'Name, story & publishing', travel: 'Timing & traveller advice', trip: 'Duration, route & group', highlights: 'What makes it special', itinerary: 'Day by day & overnights', included: 'What the price covers', pricing: 'Prices per person', activities: 'Experiences to add', where: 'Places & best time', tours: 'Tours that include it', story: 'What makes it special', about: 'Story & highlights', location: 'Where it is & getting there', rates: 'Rates & tours using it', header: 'Title & introduction', look: 'Icon & colour', guide: 'Month by month', considerations: 'Worth knowing', media: 'Photography & visuals', landing: 'Build the experience page', seo: 'Search & sharing', translations: 'Speak their language'};
</script>
<nav class="cms-editor-nav" aria-label="Editor sections">
  <p class="cms-editor-nav-label">IN THIS EDITOR</p>
  {#each sections as [key, Icon, label], index}
    <Button type="button" variant="ghost" class={`cms-editor-step ${active === key ? 'is-current' : ''}`} aria-current={active === key ? 'step' : undefined} onclick={() => onNavigate(key)}>
      <span class="cms-step-number">{String(index + 1).padStart(2,'0')}</span><span class="cms-step-copy"><strong>{label}</strong><small>{descriptions[key]}</small></span>{#if errors[key]}<AlertCircle class="cms-step-error" size={14}/>{/if}
    </Button>
  {/each}
  <div class="cms-editor-nav-tip"><span class="cms-tip-line"></span><strong>Your story. Your way.</strong><p>Start with the essentials. You can come back and add the finishing touches.</p></div>
</nav>
