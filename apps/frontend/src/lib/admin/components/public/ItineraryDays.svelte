<script lang="ts">
  import { t } from '$lib/admin/i18n/ui';
  /**
   * The day-by-day itinerary — one renderer, wherever days are shown.
   *
   * This was inline markup in the tour page. A landing page needed the same
   * thing, and the choice was to copy a hundred lines or to lift them out; a
   * second copy would have drifted from the first the day either changed.
   *
   * It renders the list only. The heading, the intro and the surrounding
   * section belong to the page, because a tour page and a landing page
   * introduce the same days with different words.
   */
  import { BedDouble, ChevronDown, Compass, MapPin, Utensils } from '@lucide/svelte';
  import Img from './Img.svelte';
  import RichText from './RichText.svelte';
  import StayCard from './StayCard.svelte';
  import { loadLodgeMedia, stayKey, type MediaImage } from '$lib/admin/lodgeMedia';
  import type { ItineraryDay } from '$lib/admin/types';

  // Same shape the tour page used: the constructor type, taken from a concrete
  // icon. `import type { Icon }` gives the instance type, which svelte:component
  // will not accept.
  type Icon = typeof MapPin;
  type FactCard = { icon: Icon; label: string; value: string };

  export let days: ItineraryDay[] = [];
  /**
   * Extra photographs per property, keyed by lodge id or slug. The tour page
   * fetches these; a caller without them still gets the lodge's own images.
   */
  export let lodgeMedia: Record<string, MediaImage[]> = {};
  /**
   * Fetch those photographs here instead, for a caller that has no reason to
   * hold them itself. Off by default so a page that already loads them — the
   * tour page, which also shows them on its accommodation tab — does not ask
   * for the same galleries twice.
   */
  export let autoloadMedia = false;
  /** Which day starts open. -1 opens none. */
  export let openIndex = 0;

  /** Galleries fetched here. A prop-supplied one always wins. */
  let fetched: Record<string, MediaImage[]> = {};
  const requested = new Set<string>();
  $: media = { ...fetched, ...lodgeMedia };

  const hydrateMedia = async (list: ItineraryDay[]) => {
    const next = await loadLodgeMedia(
      list.map((day) => day.lodge),
      fetched,
      requested
    );
    if (next !== fetched) fetched = next;
  };

  $: if (autoloadMedia) void hydrateMedia(days ?? []);

  $: dayImage = (day: ItineraryDay): MediaImage | null => {
    if (day.image_url) return { src: day.image_url, caption: `${$t('ui.day')} ${day.day_number}: ${day.title}`, record: day as unknown as Record<string, unknown>, fields: ['image_url'] };
    if (day.lodge?.hero_image_url) return { src: day.lodge.hero_image_url, caption: day.lodge.name, record: day.lodge as unknown as Record<string, unknown>, fields: ['hero_image_url', 'image_url', 'cover_image_url'] };
    if (day.lodge?.image_url) return { src: day.lodge.image_url, caption: day.lodge.name, record: day.lodge as unknown as Record<string, unknown>, fields: ['hero_image_url', 'image_url', 'cover_image_url'] };
    return null;
  };

  /** Only the facts a day actually carries. An absent one is left out, not filled in. */
  $: detailsForDay = (day: ItineraryDay): FactCard[] => {
    const stay = day.lodge?.name || day.accommodation || '';
    return [
      day.title ? { icon: MapPin, label: $t('ui.main_stop'), value: day.title } : null,
      stay ? { icon: BedDouble, label: $t('nav.accommodation'), value: stay } : null,
      day.meals ? { icon: Utensils, label: $t('ui.meals'), value: day.meals } : null,
      day.activities ? { icon: Compass, label: $t('ui.activities'), value: day.activities } : null
    ].filter(Boolean) as FactCard[];
  };

  /** <details> snaps open; this gives it the height transition it should have had. */
  const animateDayDisclosure = async (event: MouseEvent) => {
    const summary = event.currentTarget as HTMLElement;
    const details = summary.closest('details');
    if (!details || details.dataset.animating === 'true') return;

    event.preventDefault();
    const wasOpen = details.open;
    if (!wasOpen) details.open = true;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      details.open = !wasOpen;
      return;
    }

    const startHeight = wasOpen ? details.offsetHeight : summary.offsetHeight;
    const endHeight = wasOpen ? summary.offsetHeight : details.scrollHeight;
    details.dataset.animating = 'true';
    details.style.overflow = 'hidden';

    const animation = details.animate(
      [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
      { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    );

    try {
      await animation.finished;
    } catch {
      // A cancelled animation should still leave the disclosure usable.
    }

    details.style.height = '';
    details.style.overflow = '';
    details.dataset.animating = 'false';
    if (wasOpen) details.open = false;
  };

  $: sorted = [...(days ?? [])].sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0));
</script>

{#if sorted.length}
  <div class="tour-day-list space-y-2.5">
    {#each sorted as day, index (day.day_number)}
      {@const image = dayImage(day)}
      {@const details = detailsForDay(day)}
      <details id={`day-${day.day_number}`} class="tour-day-card group overflow-hidden rounded-[12px] border border-ink/10 bg-surface" open={index === openIndex}>
        <summary
          class="tour-day-toggle flex w-full cursor-pointer list-none items-center gap-4 px-4 py-4 text-left marker:content-none md:px-5 [&::-webkit-details-marker]:hidden"
          on:click={animateDayDisclosure}
        >
          <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-deep-green text-[13px] font-bold text-white">
            {day.day_number}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-clay/80">{$t('ui.day')} {day.day_number}</span>
            <span class="mt-0.5 block font-serif text-[16.5px] font-bold leading-snug text-heading md:text-[18px]">{day.title}</span>
            <span class="mt-0.5 block text-[12.5px] text-ink/55">
              {[day.lodge?.name || day.accommodation || '', day.meals || ''].filter(Boolean).join(' / ')}
            </span>
          </span>
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink/60 transition-transform duration-200 group-open:rotate-180">
            <ChevronDown class="h-5 w-5" />
          </span>
        </summary>

        <div class="tour-day-body border-t border-ink/10 px-4 pb-8 pt-6 md:px-8 md:pt-8">
          {#if image}
            <Img
              src={image.record ? '' : image.src}
              record={image.record}
              fields={image.fields ?? []}
              alt={image.caption}
              width={1000}
              sizes="(max-width: 768px) 92vw, 700px"
              className="tour-day-image mb-6 h-[220px] w-full rounded-[12px] object-cover sm:h-[280px] md:mb-8 md:h-[380px]"
            />
          {/if}

          {#if day.description}
            <RichText value={day.description} className="space-y-4 text-[14.5px] leading-[1.65] text-ink/70 md:text-[16px]" />
          {/if}

          {#if details.length}
            <ul class="tour-day-details mb-7 mt-6 rounded-[12px] border border-ink/10 bg-canvas p-5 md:p-[22px]">
              {#each details as detail, detailIndex}
                <li class={`flex items-start gap-3 text-[14.5px] leading-[1.55] md:text-[15px] ${detailIndex > 0 ? 'mt-2.5' : ''}`}>
                  <svelte:component this={detail.icon} size={16} class="mt-[2px] shrink-0 text-clay" />
                  <span class="min-w-0 flex-1">
                    <span class="font-semibold text-heading">{detail.label}:</span>
                    <span class="text-ink/70"> {detail.value}</span>
                  </span>
                </li>
              {/each}
            </ul>
          {/if}

          {#if day.lodge}
            {@const stay = day.lodge}
            <StayCard {stay} extra={media[stayKey(stay)] ?? []} label={`${$t('nav.accommodation')} - ${stay.name}`} />
          {/if}
        </div>
      </details>
    {/each}
  </div>
{/if}

<style>
  /* Carried over with the markup, so a day card reads the same on a landing
     page as it does on the tour page it came from. */
  @media (max-width: 767px) {
    .tour-day-list {
      display: grid;
      gap: 0.75rem;
    }

    .tour-day-card {
      border-radius: 14px;
    }

    .tour-day-toggle {
      gap: 0.75rem;
      padding: 0.95rem;
    }

    .tour-day-toggle > span:first-child {
      height: 2rem;
      width: 2rem;
      font-size: 0.78rem;
    }

    .tour-day-body {
      padding: 0.9rem 0.9rem 1rem;
    }

    :global(.tour-day-image) {
      aspect-ratio: 16 / 10;
      height: auto;
      margin-bottom: 1rem;
      border-radius: 12px;
    }

    .tour-day-details {
      margin-block: 1rem 1.1rem;
      border-radius: 12px;
      padding: 0.9rem;
    }

  }
</style>
