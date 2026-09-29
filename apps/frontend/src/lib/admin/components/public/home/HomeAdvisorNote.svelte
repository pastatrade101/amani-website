<script lang="ts">
  /**
   * The Advisor's Note — the same section wherever it appears: the homepage,
   * the tours listing, a safari-style page, About. Content comes from the one
   * `advisor_note` homepage section via advisorNoteProps(), so there is one
   * note to edit and one promise being made.
   */
  import { Check, Compass, SlidersHorizontal } from '@lucide/svelte';
  import { cdnUrl } from '$lib/admin/img';
  import Img from '../Img.svelte';
  import RichText from '../RichText.svelte';
  import type { AdvisorColumn } from '$lib/admin/advisorNote';

  export let eyebrow = "Advisor's Note";
  export let title = 'The Trip Is Won or Lost in the Planning Details';
  export let body =
    'Most travel mistakes happen before arrival. The wrong route, too many one-night stops, poor lodge locations or badly timed transfers can make even a beautiful trip feel tiring.';
  export let imageUrl = '';
  export let authorName = 'Deo Robert';
  export let authorRole = 'Founder & Advisor, Key2africa Safaris';
  export let footnote =
    'That is why we start with your dates, travel style and priorities — not with a fixed package.';
  export let columns: AdvisorColumn[] = [
    {
      icon_url: '/images/icons-home/icon-big-choices.png',
      title: 'The big choices',
      items: [
        'When to travel — migration timing, dry season, shoulder-season value, beach conditions and Kilimanjaro weather.',
        'Which places to include — and which to leave out so the trip has enough space.',
        'How to combine safari, Zanzibar, Kilimanjaro or culture without wasting days in transit.',
        'Accommodation style — mobile camp, tented camp, lodge, boutique hotel, beach resort or mountain hotel.'
      ]
    },
    {
      icon_url: '/images/icons-home/icon-quiet-details.png',
      title: 'The quiet details',
      items: [
        'Vehicle style, road time and where open-side game-drive vehicles make sense.',
        'Which Zanzibar coast fits your month, swimming preference and travel style.',
        'Family logistics, gentler safari days, connecting rooms and realistic drive times.',
        'Photography, birding, walking, culture or trekking interests matched to the right guide and pace.'
      ]
    }
  ];

  const FALLBACK_ICONS = [Compass, SlidersHorizontal];
  const initials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'G';

  $: visibleColumns = (columns ?? [])
    .filter((column) => column?.title?.trim())
    .map((column) => ({ ...column, items: (column.items ?? []).filter((item) => item?.trim()) }))
    .filter((column) => column.items.length)
    .slice(0, 2);
</script>

<section class="home-advisor-note py-14 md:py-20">
  <div class="container-shell">
    <div class="grid overflow-hidden rounded-2xl shadow-[0_10px_32px_-12px_rgba(57,61,50,0.28)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div class="relative flex flex-col bg-[#393D32] p-9 md:p-11">
        <span class="font-serif text-7xl leading-[0.7] text-goldfinch-gold opacity-90" aria-hidden="true">“</span>
        {#if eyebrow}
          <span class="mt-4 text-xs font-semibold uppercase tracking-[0.15em] text-goldfinch-gold">{eyebrow}</span>
        {/if}
        {#if title}
          <h2 class="mt-3 font-serif text-[28px] font-semibold leading-[1.15] text-white md:text-[30px]">{title}</h2>
        {/if}
        {#if body}
          <RichText value={body} className="mt-3.5 text-sm leading-relaxed text-white/70" />
        {/if}

        <div class="mt-8 flex items-center gap-3 border-t border-white/[0.14] pt-6 sm:mt-auto">
          {#if imageUrl}
            <Img
              src={imageUrl}
              alt={authorName}
              width={96}
              height={96}
              sizes="48px"
              className="h-12 w-12 shrink-0 rounded-full border-2 border-goldfinch-gold object-cover object-top"
            />
          {:else}
            <span class="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-goldfinch-gold bg-white/10 font-serif text-sm font-semibold text-white">
              {initials(authorName)}
            </span>
          {/if}
          <div>
            <div class="text-[13.5px] font-semibold text-white">{authorName}</div>
            <div class="mt-0.5 text-xs text-white/60">{authorRole}</div>
          </div>
        </div>
      </div>

      <div class="bg-canvas p-9 md:p-11">
        {#if visibleColumns.length}
          <div class="grid gap-9 sm:grid-cols-2">
            {#each visibleColumns as column, index (column.title)}
              {@const FallbackIcon = FALLBACK_ICONS[index % FALLBACK_ICONS.length]}
              <div>
                <div class="flex items-center gap-2.5">
                  {#if column.icon_url}
                    <img src={cdnUrl(column.icon_url)} alt="" loading="lazy" class="h-11 w-11 object-contain" />
                  {:else}
                    <span class="grid h-11 w-11 place-items-center text-clay"><FallbackIcon size={32} strokeWidth={1.4} /></span>
                  {/if}
                  <h3 class="font-serif text-lg font-semibold text-heading">{column.title}</h3>
                </div>
                <div class="mb-4 mt-2.5 h-[2px] w-7 bg-goldfinch-gold" aria-hidden="true"></div>
                <ul class="flex flex-col gap-4">
                  {#each column.items as item, itemIndex (itemIndex)}
                    <li class="flex gap-2.5 text-[13.5px] leading-relaxed text-ink/65">
                      <span class="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-goldfinch-gold bg-white">
                        <Check size={10} strokeWidth={3} class="text-clay" aria-hidden="true" />
                      </span>
                      <span>{item}</span>
                    </li>
                  {/each}
                </ul>
              </div>
            {/each}
          </div>
        {/if}

        {#if footnote}
          <div class="mt-7 flex gap-1 border-t border-dashed border-[#E3DCCB] pt-5 font-serif text-[15px] italic text-heading">
            <span aria-hidden="true">“</span>
            <RichText value={footnote} />
            <span aria-hidden="true">”</span>
          </div>
        {/if}
      </div>
    </div>
  </div>
</section>
