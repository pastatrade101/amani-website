<script lang="ts">
 import { ArrowUpRight } from '@lucide/svelte';
 import GuestReviews from './guest-reviews.svelte';
 import { TRIPADVISOR_URL } from '$lib/homepage-refresh';
 import type { HomepageSection } from '$lib/types/api';
 import type { GuestReview } from '$lib/homepage-guides';
 let {section,reviews,reviewTotal}:{section:HomepageSection;reviews:GuestReview[];reviewTotal:number}=$props();
</script>
{#if reviews.length}<section id="reviews-section" class="home-band home-cream"><div class="home-container">
 <div class="text-center"><h2 class="home-heading">{section.title}</h2><a class="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground" href={TRIPADVISOR_URL} target="_blank" rel="noopener noreferrer">{reviewTotal} guest reviews · View us on TripAdvisor<ArrowUpRight class="size-4" /></a></div>
 <div class="reviews-layout"><div><span aria-hidden="true" class="block font-serif text-[100px] leading-none text-[#9a6a2f]">“</span><h3 class="max-w-xs text-2xl font-semibold leading-snug">What our guests are saying</h3></div><div class="min-w-0"><GuestReviews {reviews} total={reviewTotal} variant="home" /></div></div>
</div></section>{/if}
<style>.reviews-layout{display:grid;grid-template-columns:.28fr .72fr;gap:42px;align-items:center;margin-top:42px}@media(max-width:900px){.reviews-layout{grid-template-columns:1fr;gap:24px}.reviews-layout>div:first-child{display:flex;align-items:center;gap:16px}.reviews-layout h3{font-size:20px}.reviews-layout span{font-size:75px}}</style>
