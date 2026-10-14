<script lang="ts">
  import { ArrowRight, ArrowUpRight, Check, Star } from '@lucide/svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import { safeUrl, textContent } from '$lib/home-content';
  import { approvedReviews, type GuestReview } from '$lib/homepage-guides';

  // Every review card on the site: green stars, the quote, then who wrote it
  // and where. A grid on larger screens, a swipeable row with dots on phones.
  // "View more reviews" pages through the rest of the approved reviews.
  let { reviews, variant = 'default', total = 0 }: { reviews: GuestReview[]; variant?: 'default' | 'tour'; total?: number } = $props();

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
    const step = card ? card.getBoundingClientRect().width + 16 : 1;
    active = Math.min(shown.length - 1, Math.max(0, Math.round(track.scrollLeft / step)));
  }
  function showCard(index: number) {
    const card = track?.children[index] as HTMLElement | undefined;
    if (!track || !card) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
  }
</script>

<div class="reviews" class:tour-reviews={variant === 'tour'}>
  <div class="review-track" bind:this={track} onscroll={syncDots}>
    {#each shown as review (review.id)}
      {@const text = plain(review.message)}
      <article class="review-card" data-motion="card">
        <div class="stars" role="img" aria-label={`${review.rating} out of 5 stars`}>
          {#each Array(5) as _, j}<Star size={18} strokeWidth={0} fill={j < review.rating ? 'currentColor' : '#d7dde0'} aria-hidden="true" />{/each}
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

  {#if hasMore || failed}
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
  .review-card { display: flex; flex-direction: column; min-width: 0; padding: 28px; color: var(--navy); background: white; border: 1px solid var(--border); border-radius: 20px; box-shadow: 0 12px 32px -26px rgb(20 49 77 / .25); }
  .stars { display: flex; gap: 6px; color: #22a352; }
  .review-card blockquote { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 7; line-clamp: 7; overflow: hidden; overflow-wrap: anywhere; margin: 18px 0 0; font-size: 16px; line-height: 1.6; color: var(--navy); }
  .review-card :global(.review-more) { display: inline-flex; align-items: center; gap: 4px; width: fit-content; min-height: 32px; margin-top: 6px; padding: 0; border: 0; background: none; color: var(--navy); font-size: 13px; font-weight: 600; text-decoration: underline; text-decoration-color: var(--sun); text-underline-offset: 4px; cursor: pointer; }
  .review-author { margin-top: auto; padding-top: 22px; }
  .review-author::before { content: ''; display: block; height: 1px; margin-bottom: 22px; background: var(--border); }
  .review-author h3 { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 17px; font-weight: 700; color: var(--navy); }
  .review-author p { margin: 4px 0 0; font-size: 14px; color: var(--muted-foreground); }
  .review-author .review-source { display: flex; align-items: center; gap: 10px; margin-top: 16px; }
  .tick { display: grid; flex: none; place-items: center; width: 22px; height: 22px; border-radius: 999px; background: color-mix(in oklch, #22a352 16%, white); color: #22a352; }
  .full-review { max-height: 55dvh; overflow-y: auto; padding-right: 8px; white-space: pre-line; overflow-wrap: anywhere; font-size: 15px; line-height: 1.85; color: #334b60; margin: 0; }
  .original-review { display: inline-flex; align-items: center; gap: 8px; width: fit-content; color: var(--navy); font-size: 13px; font-weight: 600; text-decoration: underline; text-underline-offset: 4px; }
  .review-dots { display: none; justify-content: center; gap: 8px; margin-top: 18px; }
  .review-dots button { width: 8px; height: 8px; padding: 0; border: 0; border-radius: 999px; background: #d7dde0; cursor: pointer; transition: background-color .2s ease; }
  .review-dots button.on { background: var(--sun); }
  .review-actions { display: grid; justify-items: center; gap: 8px; margin-top: 28px; }
  .review-load { display: inline-flex; align-items: center; gap: 8px; min-height: 46px; padding: 0 22px; border: 1.5px solid var(--sun); border-radius: 10px; background: white; color: var(--navy); font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color .2s ease; }
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
</style>
