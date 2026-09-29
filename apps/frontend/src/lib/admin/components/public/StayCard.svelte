<script lang="ts">
  import { t } from '$lib/admin/i18n/ui';
  /**
   * The property card that sits under an itinerary day: four photographs, the
   * name, what kind of place it is and where, and a way through to its page.
   *
   * Lifted out of ItineraryDays so the safari-package routes panel shows the
   * same card for the property an editor selected, rather than the single
   * thumbnail it used to draw.
   */
  import { ArrowRight, MapPin } from '@lucide/svelte';
  import Img from './Img.svelte';
  import { galleryForStay, type MediaImage, type Stay } from '$lib/admin/lodgeMedia';

  export let stay: Stay;
  /** Photographs fetched separately for this property. */
  export let extra: MediaImage[] = [];
  /** The small line above the card. Empty renders none. */
  export let label = '';
  /** A larger, editorial gallery for the package's featured properties. */
  export let featured = false;

  /**
   * Dictionary keys for the property type — every value the lodge editor can
   * store (PROPERTY_TYPES), plus two older free-text ones.
   *
   * The lookup is case-insensitive because the CMS stores the enum in capitals
   * (TENTED_CAMP) while this map was written in lower case, so for as long as
   * the card has existed the type never matched and never showed.
   */
  const LODGE_TYPE_KEYS: Record<string, string> = {
    hotel: 'ui.hotel',
    safari_lodge: 'ui.safari_lodge',
    tented_camp: 'ui.tented_camp',
    mobile_camp: 'ui.mobile_camp',
    beach_resort: 'ui.beach_resort',
    villa: 'ui.villa',
    guest_house: 'ui.guest_house',
    eco_lodge: 'ui.eco_lodge',
    boutique_hotel: 'ui.boutique_hotel',
    lodge: 'ui.lodge',
    treehouse: 'ui.treehouse'
  };
  $: lodgeTypeKey = LODGE_TYPE_KEYS[String(stay.lodge_type ?? '').trim().toLowerCase()];
  $: lodgeType = lodgeTypeKey ? $t(lodgeTypeKey) : '';

  /** The comfort level in the reader's language; an unknown level keeps its CMS form. */
  const LEVEL_KEYS: Record<string, string> = {
    BUDGET: 'tier.budget',
    MID_RANGE: 'tier.mid_range',
    LUXURY: 'tier.luxury',
    PREMIUM_LUXURY: 'tier.premium_luxury'
  };
  $: levelLabel = (level: string) =>
    LEVEL_KEYS[level.toUpperCase()] ? $t(LEVEL_KEYS[level.toUpperCase()]) : normaliseLabel(level.toLowerCase());

  const normaliseLabel = (value: string | null | undefined): string =>
    String(value ?? '')
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());

  $: gallery = galleryForStay(stay, extra);
  $: shown = gallery.slice(0, 4);
  $: summary = [
    lodgeType,
    stay.accommodation_level ? levelLabel(stay.accommodation_level) : '',
    stay.destinations?.name ?? ''
  ]
    .filter(Boolean)
    .join(' / ');
</script>

<div class="tour-day-accommodation" class:featured-stay={featured}>
  {#if label}
    <div class="mb-3.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink/60 md:text-[11px]">{label}</div>
  {/if}
  <div class="tour-day-accommodation-card overflow-hidden rounded-[12px] border border-ink/10 bg-surface">
    {#if shown.length}
      <!-- As many columns as there are photographs. A property with one photo
           used to leave three empty cells in a four-column grid. -->
      <div
        class="tour-day-accommodation-gallery grid gap-1 overflow-hidden rounded-t-[11px] bg-canvas p-1"
        class:single-photo={shown.length === 1}
        style={featured ? '' : `grid-template-columns: repeat(${shown.length}, minmax(0, 1fr));`}
      >
        {#each shown as image, imageIndex}
          <div class={`stay-photo relative min-w-0 overflow-hidden bg-canvas ${shown.length === 1 ? 'aspect-[16/9]' : 'aspect-[4/3]'} ${imageIndex === 0 ? 'rounded-tl-[8px]' : ''} ${imageIndex === shown.length - 1 ? 'rounded-tr-[8px]' : ''}`}>
            <Img
              src={image.record ? '' : image.src}
              record={image.record}
              fields={image.fields ?? []}
              alt={image.caption}
              width={featured || shown.length === 1 ? 900 : 360}
              sizes={featured || shown.length === 1 ? '(max-width: 768px) 92vw, 700px' : '(max-width: 768px) 23vw, 175px'}
              className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
            />
            {#if imageIndex === 3 && gallery.length > 4}
              <div class="pointer-events-none absolute inset-0 grid place-items-center bg-heading/55 px-2 text-center text-xs font-extrabold tracking-wide text-white backdrop-blur-[1px] sm:text-sm">
                {$t(gallery.length - 4 === 1 ? 'ui.n_more_photo' : 'ui.n_more_photos').replace('{n}', String(gallery.length - 4))}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
    <div class="p-4 md:p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          {#if featured && stay.accommodation_level}<p class="stay-category">{levelLabel(stay.accommodation_level)}</p>{/if}
          <h4 class="font-serif text-[19px] font-semibold leading-snug text-heading">{stay.name}</h4>
          {#if featured}
            {#if stay.destinations?.name}<p class="stay-location"><MapPin size={13} />{stay.destinations.name}</p>{/if}
            {#if lodgeType}<p class="mt-1 text-xs text-ink/50">{lodgeType}</p>{/if}
          {:else if summary}<p class="mt-1 text-[13px] font-medium text-ink/60">{summary}</p>{/if}
        </div>
        {#if stay.slug}
          <a
            class="inline-flex shrink-0 items-center gap-1 rounded-[6px] border border-ink/10 px-3 py-2 text-[12px] font-bold text-forest transition hover:border-goldfinch-gold hover:text-heading"
            href={`/accommodation/${stay.slug}`}
            data-sveltekit-preload-data="hover"
          >{$t('ui.view_accommodation')}<ArrowRight size={13} />
          </a>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .featured-stay .tour-day-accommodation-card { border-radius:12px; background:rgb(var(--c-surface)); }
  .featured-stay .tour-day-accommodation-gallery { grid-template-columns:repeat(3,minmax(0,1fr)); padding:0; gap:3px; border-radius:0; }
  .featured-stay .stay-photo { aspect-ratio:16/9; border-radius:0; }
  .featured-stay .stay-photo:first-child { grid-column:1/-1; aspect-ratio:2/1; }
  .featured-stay .tour-day-accommodation-gallery:has(.stay-photo:nth-child(2)):not(:has(.stay-photo:nth-child(3))) { grid-template-columns:1fr; }
  .featured-stay .tour-day-accommodation-gallery:has(.stay-photo:nth-child(3)):not(:has(.stay-photo:nth-child(4))) { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .featured-stay .tour-day-accommodation-gallery.single-photo .stay-photo { aspect-ratio:16/9; }
  .featured-stay h4 { font-size:23px; overflow-wrap:anywhere; }
  .featured-stay a { min-height:40px; margin-top:8px; }
  .stay-category { display:inline-block; margin-bottom:10px; padding:4px 8px; border-radius:4px; background:rgb(var(--c-canvas)); color:rgb(var(--c-forest)); font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
  .stay-location { display:flex; align-items:center; gap:5px; margin-top:8px; font-size:12px; line-height:1.6; color:rgb(var(--c-ink)/.6); }
  .stay-location :global(svg) { flex-shrink:0; }
  /* Carried over with the markup from ItineraryDays: on a phone the card sits
     tighter and the link runs the full width, so it is a tappable bar rather
     than a small target in the corner. */
  @media (max-width: 767px) {
    .tour-day-accommodation-card {
      border-radius: 12px;
    }

    .tour-day-accommodation-card :global(.p-4) {
      padding: 0.9rem;
    }

    .tour-day-accommodation-card a {
      width: 100%;
      justify-content: center;
    }
  }
</style>
