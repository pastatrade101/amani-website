<script lang="ts">
  import { ArrowUpRight, Image as ImageIcon, MapPin } from '@lucide/svelte';
  import { locationLine } from '$lib/admin/destination-places';
  import { textContent } from '$lib/home-content';

  /**
   * How the place fields read on the website: the destination card (as on
   * /destinations and the home page) and the destination page's header label
   * and location line. Placeholders show where the site fills a gap.
   */
  let {
    name,
    country,
    region,
    location,
    summary,
    image
  }: { name: string; country: string; region: string; location: string; summary: string; image: string } = $props();

  let line = $derived(locationLine(location, region, country));
  let eyebrow = $derived([country, region].map((part) => part.trim()).filter(Boolean).join(' / '));
  let excerpt = $derived(textContent(summary));
</script>

<div class="grid gap-4">
  <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/45">How visitors see it</p>
  <div class="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm" aria-label="Destination card preview">
    <div class="relative grid aspect-[1.4] place-items-center bg-sand/60">
      {#if image}<img src={image} alt="" class="absolute inset-0 size-full object-cover" />{:else}<ImageIcon size={26} class="text-ink/25" aria-hidden="true" />{/if}
      <span class="absolute top-3 left-3 rounded-full bg-[#fffef1]/95 px-2.5 py-1 text-[9px] font-semibold tracking-[0.06em] text-heading">{country || 'Explore Africa'}</span>
      <span class="absolute right-3 bottom-3 grid size-8 place-items-center rounded-full bg-[#f6d21b] text-heading"><ArrowUpRight size={15} aria-hidden="true" /></span>
    </div>
    <div class="p-4">
      <p class={`truncate text-[9px] uppercase tracking-[0.14em] ${region ? 'text-ink/55' : 'text-ink/30 italic'}`}>{region || 'A place to discover'}</p>
      <p class="mt-1.5 truncate text-[17px] font-semibold tracking-[-0.02em] text-heading">{name || 'Destination name'}</p>
      <p class={`mt-1.5 line-clamp-2 text-[11.5px] leading-5 ${excerpt ? 'text-ink/60' : 'text-ink/30 italic'}`}>{excerpt || 'Explore this destination and plan your journey with our team.'}</p>
    </div>
  </div>
  <div class="grid gap-2 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm" aria-label="Destination page preview">
    <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/40">Page header</p>
    <p class={`text-[10px] font-semibold uppercase tracking-[0.18em] ${eyebrow ? 'text-[#9d853b]' : 'text-ink/30 italic'}`}>{eyebrow || 'A place worth the journey'}</p>
    <p class="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-ink/40">“At a glance” location line</p>
    <p class={`flex items-start gap-1.5 text-xs leading-5 ${line ? 'text-ink/70' : 'text-ink/30 italic'}`}><MapPin size={13} class="mt-0.5 shrink-0" aria-hidden="true" />{line || 'Hidden until a place is set'}</p>
  </div>
  <p class="text-[11px] leading-5 text-ink/45">Grey text is what the site shows while a field is empty.</p>
</div>
