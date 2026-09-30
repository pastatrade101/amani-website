<script lang="ts">
  import { Eye } from '@lucide/svelte';
  import TourCard from '$lib/components/tours/tour-card.svelte';
  import type { PricingSeason } from '$lib/safari-pricing';
  import { cardPreviewTour, type DestinationOption, type TourEditorForm } from './model';

  /**
   * The public tour card itself, fed from what is typed right now, at the
   * width it has in the tours grid — so a long title or route shows here
   * exactly as it will be cut on the site. `inert` keeps its link and heart
   * from navigating away or saving a shortlist from inside the editor.
   */
  export let form: TourEditorForm;
  export let destinations: DestinationOption[] = [];
  /** The tour's saved price seasons: the card's "from" price comes from them first. */
  export let seasons: PricingSeason[] = [];
  export let note = 'Card preview · as on the Tours page and the homepage.';

  $: tour = cardPreviewTour(form, destinations, seasons);
</script>

<div class="grid gap-2">
  <p class="flex items-center gap-1.5 text-[11px] font-semibold text-ink/55"><Eye size={13} />{note}</p>
  <div class="w-[360px] max-w-full" inert>
    <TourCard {tour} />
  </div>
  <p class="max-w-[360px] text-[11px] leading-5 text-ink/45">The title shows three lines at most and the route one; anything longer is cut with “…”.</p>
</div>
