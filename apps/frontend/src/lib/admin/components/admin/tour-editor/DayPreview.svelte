<script lang="ts">
  import { ChevronDown, Eye } from '@lucide/svelte';
  import ItineraryDayHeading from '$lib/components/tours/itinerary-day-heading.svelte';
  import ItineraryStayCell from '$lib/components/tours/itinerary-stay-cell.svelte';
  import { SAFARI_STYLE_THEME } from '$lib/safari-pricing';
  import { overnightLabel } from '$lib/tour-itinerary';
  import { STYLE_LABEL, timelineDay, type DayDraft, type LodgeOption } from './model';

  /**
   * The top of this day's card on the public itinerary, at phone width — the
   * narrowest it gets — so editors see a long title or summary wrap as they
   * type. The words are the timeline's own components; only the card frame
   * below is copied, from itinerary-timeline's phone layout.
   */
  export let day: DayDraft;
  export let index: number;
  export let lodges: LodgeOption[] = [];

  $: preview = timelineDay(day, index, lodges);
  // Midrange is the style the tour page opens on.
  $: overnight = overnightLabel(preview, 'midrange');
</script>

<div class="grid content-start gap-2">
  <p class="flex items-center gap-1.5 text-[11px] font-semibold text-ink/55"><Eye size={13} />On the tour page · phone width</p>
  <div class="day-preview" inert>
    <div class="day-preview-head">
      <ItineraryDayHeading day={{ ...preview, title: preview.title || 'Untitled day' }} />
      <span class="day-preview-chevron" aria-hidden="true"><ChevronDown class="size-4" /></span>
    </div>
    {#if overnight}
      <div class="day-preview-stay">
        <ItineraryStayCell kind="overnight" label="Overnight" value={overnight} badge={{ color: SAFARI_STYLE_THEME.midrange.primary, name: STYLE_LABEL.midrange }} />
      </div>
    {/if}
  </div>
  <p class="max-w-[343px] text-[11px] leading-5 text-ink/45">
    {overnight ? 'The Overnight line sits lower in the open day, after the description.' : 'No Midrange overnight yet, so the page leaves that line out.'}
  </p>
</div>

<style>
  /* itinerary-timeline's phone .day-card, .day-head, .day-chevron and .stay-panel. */
  .day-preview { width: 343px; max-width: 100%; border: 1px solid var(--border); border-radius: 1.25rem; background: var(--card); box-shadow: 0 14px 34px -28px rgb(15 35 55 / 0.4); }
  .day-preview-head { display: flex; align-items: flex-start; gap: 0.75rem; padding: 1rem; text-align: left; }
  .day-preview-chevron { display: grid; flex-shrink: 0; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: 999px; background: color-mix(in oklch, var(--sun) 18%, white); color: var(--navy); }
  .day-preview-stay { margin: 0 1rem 1.1rem; border-radius: 1rem; background: color-mix(in oklch, var(--sun) 9%, white); padding: 0.9rem 1rem; }
</style>
