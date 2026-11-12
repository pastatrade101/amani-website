<script lang="ts">
  import { onMount, tick, type Snippet } from 'svelte';
  import { ChevronLeft, ChevronRight, ArrowRight, ArrowUpRight, Check, Star } from '@lucide/svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import { safeUrl, textContent } from '$lib/home-content';
  import { approvedReviews, type GuestReview } from '$lib/homepage-guides';

  // Every review card on the site: green stars, the quote, then who wrote it
  // and where. A grid on larger screens, a swipeable row with dots on phones.
  // "View more reviews" pages through the rest of the approved reviews.
  // `aside` (home only) sits beside the row with the arrows under it.
  let { reviews, variant = 'default', total = 0, aside }: { reviews: GuestReview[]; variant?: 'default' | 'tour' | 'home'; total?: number; aside?: Snippet } = $props();

  const PAGE = 6;
  const LIMIT = 260;
  let extra = $state<GuestReview[]>([]);
  let nextPage = $state(1);
  let known = $state(0);
  let loading = $state(false);
  let failed = $state(false);
  let shown = $derived.by(() => {
    const seen = new Set<string>();
    return [...reviews, ...extra].filter((review) => !seen.has(review.id) && seen.add(review.id));
  });
  let available = $derived(Math.max(total, known));
  let hasMore = $derived(shown.length < available && (nextPage - 1) * PAGE < available);

  let track = $state<HTMLDivElement>();
  let active = $state(0);
  let atStart = $state(true), atEnd = $state(false);
  onMount(() => { if(!track)return;const observer=new ResizeObserver(syncDots);observer.observe(track);syncDots();return()=>observer.disconnect(); });

  const plain = (message: string) => textContent(message).replace(/\s+/g, ' ').trim();
  const excerpt = (message: string) => {
    const text = plain(message);
    return text.length > LIMIT ? `${text.slice(0, LIMIT).replace(/\s+\S*$/, '')}…` : text;
  };

  async function loadMore() {
    loading = true;
    failed = false;
    try {
      const response = await fetch(`/api/reviews?status=approved&limit=${PAGE}&page=${nextPage}`);
      const body = await response.json();
      if (!response.ok || !body?.success) throw new Error('reviews');
      extra = [...extra, ...approvedReviews(body.data.items, PAGE)];
      known = Number(body.data.pagination?.total) || known;
      nextPage += 1;
      await tick();
      syncDots();
    } catch {
      failed = true;
    } finally {
      loading = false;
    }
  }

  // Phones only: which card the row is showing, for the dots.
  function syncDots() {
    if (!track) return;
    const card = track.children[0] as HTMLElement | undefined;
    const step = card ? card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap) : 1;
    atStart = track.scrollLeft <= 2; atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    active = Math.min(shown.length - 1, Math.max(0, Math.round(track.scrollLeft / step)));
  }
  function showCard(index: number) {
    const card = track?.children[index] as HTMLElement | undefined;
    if (!track || !card) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: track.scrollLeft + card.getBoundingClientRect().left - track.getBoundingClientRect().left - parseFloat(getComputedStyle(track).paddingLeft), behavior: reduce ? 'auto' : 'smooth' });
  }
</script>

<div class="reviews" class:tour-reviews={variant === 'tour'} class:home-reviews={variant === 'home'}>
  {#if variant === 'home'}<div class="home-review-side">{#if aside}{@render aside()}{/if}{#if shown.length > 1}<div class="home-review-controls"><button type="button" aria-label="Previous review" disabled={atStart} onclick={()=>showCard(Math.max(0,active-1))}><ChevronLeft size={20} /></button><button type="button" aria-label="Next review" disabled={atEnd} onclick={()=>showCard(Math.min(shown.length-1,active+1))}><ChevronRight size={20} /></button></div>{/if}</div>{/if}
  <div class="review-track" bind:this={track} onscroll={syncDots}>
    {#each shown as review (review.id)}
      {@const text = plain(review.message)}
      <article class="review-card" data-motion="card">
        <div class="stars" role="img" aria-label={`${review.rating} out of 5 stars`}>
          {#each Array(5) as _, j}<Star size={18} strokeWidth={0} fill={j < review.rating ? 'currentColor' : '#e0ddd7'} aria-hidden="true" />{/each}
        </div>
        <blockquote>“{excerpt(review.message)}”</blockquote>
        {#if text.length > LIMIT}
          <Dialog.Root>
            <Dialog.Trigger class="review-more" aria-label={`Read full review by ${review.author_name}`}>Read full review <ArrowUpRight size={14} aria-hidden="true" /></Dialog.Trigger>
            <Dialog.Content onOpenAutoFocus={(event) => { event.preventDefault(); document.getElementById(`review-body-${review.id}`)?.focus(); }} class="max-h-[90dvh] overflow-hidden rounded-2xl sm:max-w-xl">
              <Dialog.Header class="pr-8 text-left">
                <Dialog.Title>Review by {review.author_name}</Dialog.Title>
                <Dialog.Description>{[review.country, review.platform, `${review.rating} out of 5 stars`].filter(Boolean).join(' · ')}</Dialog.Description>
              </Dialog.Header>
              <blockquote class="full-review" id={`review-body-${review.id}`} tabindex="-1" aria-label={`Full review by ${review.author_name}`}>{textContent(review.message)}</blockquote>
              {#if review.source_url && safeUrl(review.source_url, '')}
                <a class="original-review" href={safeUrl(review.source_url, '')} target="_blank" rel="noopener noreferrer">Read original review <ArrowUpRight size={16} /></a>
              {/if}
            </Dialog.Content>
          </Dialog.Root>
        {/if}
        <footer class="review-author">
          <h3>{review.author_name}</h3>
          {#if review.country}<p>{review.country}</p>{/if}
          <!-- Only what is true of every review: where it was left. -->
          {#if review.platform}<p class="review-source"><span class="tick" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>Reviewed on {review.platform}</p>{/if}
        </footer>
      </article>
    {/each}
  </div>

  {#if shown.length > 1}
    <div class="review-dots" aria-label="Choose a review">
      {#each shown as review, i (review.id)}
        <button type="button" class:on={i === active} aria-label={`Show review ${i + 1} of ${shown.length}`} aria-current={i === active ? 'true' : undefined} onclick={() => showCard(i)}></button>
      {/each}
    </div>
  {/if}

  <!-- The home row already holds every review it was sent. -->
  {#if (hasMore || failed) && variant !== 'home'}
    <div class="review-actions">
      <button type="button" class="review-load" onclick={loadMore} disabled={loading}>
        {loading ? 'Loading reviews…' : failed ? 'Try again' : 'View more reviews'}{#if !loading}<ArrowRight size={16} aria-hidden="true" />{/if}
      </button>
      {#if failed}<p class="review-error" role="status">We couldn’t load more reviews just now.</p>{/if}
    </div>
  {/if}
</div>

<style>
  .review-track { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; align-items: stretch; }
  .tour-reviews .review-track { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .review-card { display: flex; flex-direction: column; min-width: 0; padding: 28px; color: var(--navy); background: white; border: 1px solid var(--border); border-radius: var(--radius-surface); box-shadow: 0 12px 32px -26px rgb(54 49 43 / .25); }
  .stars { display: flex; gap: 6px; color: #22a352; }
  .review-card blockquote { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 7; line-clamp: 7; overflow: hidden; overflow-wrap: anywhere; margin: 18px 0 0; font-size: 16px; line-height: 1.6; color: var(--navy); }
  .review-card :global(.review-more) { display: inline-flex; align-items: center; gap: 4px; width: fit-content; min-height: 32px; margin-top: 6px; padding: 0; border: 0; background: none; color: var(--navy); font-size: 13px; font-weight: 700; text-decoration: none; cursor: pointer; transition: color .2s ease; }
  .review-card :global(.review-more:hover) { color: #7a5a26; }
  .review-author { margin-top: auto; padding-top: 22px; }
  .review-author::before { content: ''; display: block; height: 1px; margin-bottom: 22px; background: var(--border); }
  .review-author h3 { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 17px; font-weight: 700; color: var(--navy); }
  .review-author p { margin: 4px 0 0; font-size: 14px; color: var(--muted-foreground); }
  .review-author .review-source { display: flex; align-items: center; gap: 10px; margin-top: 16px; }
  .tick { display: grid; flex: none; place-items: center; width: 22px; height: 22px; border-radius: 999px; background: color-mix(in oklch, #22a352 16%, white); color: #22a352; }
  .full-review { max-height: 55dvh; overflow-y: auto; padding-right: 8px; white-space: pre-line; overflow-wrap: anywhere; font-size: 15px; line-height: 1.85; color: #524b41; margin: 0; }
  .original-review { display: inline-flex; align-items: center; gap: 8px; width: fit-content; color: var(--navy); font-size: 13px; font-weight: 600; text-decoration: underline; text-underline-offset: 4px; }
  .review-dots { display: none; justify-content: center; gap: 8px; margin-top: 18px; }
  .review-dots button { width: 8px; height: 8px; padding: 0; border: 0; border-radius: 999px; background: #e0ddd7; cursor: pointer; transition: background-color .2s ease; }
  .review-dots button.on { background: var(--sun); }
  .review-actions { display: grid; justify-items: center; gap: 8px; margin-top: 28px; }
  .review-load { display: inline-flex; align-items: center; gap: 8px; min-height: 46px; padding: 0 22px; border: 1.5px solid var(--sun); border-radius: var(--radius-surface); background: white; color: var(--navy); font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color .2s ease; }
  .review-load:hover:not(:disabled) { background: color-mix(in oklch, var(--sun) 14%, white); }
  .review-load:disabled { opacity: .7; cursor: progress; }
  .review-error { font-size: 12px; color: var(--muted-foreground); }
  @media (max-width: 1023px) { .review-track { gap: 16px; } .review-card { padding: 24px; } }
  /* Phones: one card at a time with the next peeking in, swiped sideways. */
  @media (max-width: 767px) {
    .review-track, .tour-reviews .review-track { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline: 16px; margin-inline: -16px; padding: 4px 16px 8px; scrollbar-width: none; }
    .review-track::-webkit-scrollbar { display: none; }
    .review-card { flex: 0 0 86%; scroll-snap-align: start; padding: 22px; }
    .review-card blockquote { font-size: 15px; -webkit-line-clamp: 8; line-clamp: 8; }
    .review-dots { display: flex; }
    .review-actions { margin-top: 20px; }
  }

 /* Home: the heading and arrows on the left, two reviews at a time on the right. */
 .home-reviews{display:grid;grid-template-columns:minmax(0,.32fr) minmax(0,.68fr);gap:56px;align-items:center}
 .home-review-side{min-width:0}
 .home-review-controls{display:flex;gap:10px;margin-top:28px}.home-review-controls button{display:grid;place-items:center;width:44px;height:44px;border:1px solid var(--border);border-radius:var(--radius-control);background:white;color:var(--navy);cursor:pointer;transition:border-color .2s ease,background-color .2s ease}.home-review-controls button:hover:not(:disabled){border-color:var(--navy)}.home-review-controls button:disabled{opacity:.35;cursor:default}.home-review-controls button:focus-visible{outline:2px solid var(--sun);outline-offset:2px}
 .home-reviews .review-track{position:relative;display:flex;min-width:0;margin:0;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:4px 2px 12px;gap:24px}
 .home-reviews .review-card{flex:0 0 calc((100% - 24px)/2);scroll-snap-align:start;min-height:330px}
 .home-reviews .review-card blockquote{font-size:15px;-webkit-line-clamp:6;line-clamp:6}
 .home-reviews .review-author h3{font-size:15px}.home-reviews .review-author p{font-size:13px}.home-reviews .review-dots{display:none}
 @media(max-width:900px){.home-reviews{grid-template-columns:1fr;gap:28px}.home-review-controls{margin-top:20px}}
 /* Touch screens swipe; the arrows are for a mouse. */
 @media(hover:none){.home-review-controls{display:none}}
 /* Phones: an edge-to-edge rail, the next review peeking in, dots under it. */
 @media(max-width:767px){.home-reviews .review-track{margin-inline:calc(50% - 50vw);padding:4px calc(50vw - 50%) 12px;scroll-padding-inline:calc(50vw - 50%);gap:14px}.home-reviews .review-card{flex-basis:84%;min-height:0}.home-reviews .review-dots{display:flex;margin-top:12px}}
</style>
