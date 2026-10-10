<script lang="ts">
  import { ArrowUpRight, Quote, Star } from '@lucide/svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import { safeUrl, textContent } from '$lib/home-content';
  import type { GuestReview } from '$lib/homepage-guides';

  let { reviews, variant = 'default' }: { reviews: GuestReview[]; variant?: 'default' | 'tour' } = $props();
  const excerpt = (message: string) => {
    const text = textContent(message).replace(/\s+/g, ' ').trim();
    return text.length > 260 ? `${text.slice(0, 260).replace(/\s+\S*$/, '')}…` : text;
  };
</script>

<div class="review-grid" class:tour-reviews={variant === 'tour'}>
  {#each reviews as review (review.id)}
    <article class="review-card" data-motion="card">
      <div class="review-top">
        <div class="rating" aria-label={`${review.rating} out of 5 stars`}>
          <div class="stars" aria-hidden="true">{#each Array(5) as _, j}<Star size={14} fill={j < review.rating ? 'currentColor' : 'none'} />{/each}</div>
          <span>{review.platform || 'Guest review'}</span>
        </div>
        <span class="quote-mark" aria-hidden="true"><Quote size={24} strokeWidth={1.5} /></span>
      </div>
      <blockquote>{excerpt(review.message)}</blockquote>
      <div class="review-bottom">
        <div class="review-author">
          {#if variant !== 'tour'}<span class="author-quote" aria-hidden="true"><Quote size={20} fill="currentColor" /></span>{/if}<span class="initial" aria-hidden="true">{review.author_name.trim().slice(0, 1).toUpperCase()}</span>
          <div><h3>{review.author_name}</h3><p>{review.country || 'Safari guest'}</p></div>
        </div>
        <Dialog.Root>
          <Dialog.Trigger class="review-trigger" aria-label={`Read full review by ${review.author_name}`}>
            Read full review <ArrowUpRight size={16} aria-hidden="true" />
          </Dialog.Trigger>
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
      </div>
    </article>
  {/each}
</div>

<style>
 .author-quote{display:grid;place-items:center;width:46px;height:46px;border:3px solid white;border-radius:50%;background:#14314d;color:#f6d21b;margin-right:-24px;z-index:1;flex-shrink:0}.review-author .initial{margin-right:4px}.review-card:hover .author-quote{background:#f6d21b;color:#14314d}.author-quote{transition:background .25s ease,color .25s ease}
  .review-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; align-items: start; }
  .review-card { --card-ink: #17334c; --card-muted: #627181; --card-line: #17334c1c; display: flex; flex-direction: column; min-width: 0; height: 328px; padding: 28px; color: var(--card-ink); background: white; border: 1px solid #edf0f1; border-radius: 30px; box-shadow: 0 8px 30px #17334c08; }
  .review-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .rating { min-width: 0; }
  .stars { display: flex; gap: 3px; color: #9a7416; }
  .rating>span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--card-muted); margin-top: 7px; }
  .quote-mark { display: grid; place-items: center; width: 42px; height: 42px; flex-shrink: 0; border: 1px solid var(--card-line); border-radius: 50%; color: #927427; }
  .review-card>blockquote { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; line-clamp: 4; flex-shrink: 0; overflow: hidden; overflow-wrap: anywhere; font-size: 15px; line-height: 1.7; font-weight: 450; margin: 18px 0 16px; }
  .review-bottom { margin-top: auto; padding-top: 16px; border-top: 1px solid var(--card-line); }
  .review-author { display: flex; gap: 11px; align-items: center; min-width: 0; }
  .initial { display: grid; place-items: center; height: 46px; width: 46px; flex-shrink: 0; background: #ede6cf; border-radius: 50%; color: #17334c; font-size: 13px; font-weight: 600; }
  .review-author>div { min-width: 0; }
  .review-author h3 { color: var(--card-ink); font-size: 13px; font-weight: 600; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; }
  .review-author p { color: var(--card-muted); font-size: 11px; line-height: 1.5; margin: 3px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .review-bottom :global(.review-trigger) { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 32px; margin-top: 9px; padding: 0; border: 0; background: none; color: var(--card-ink); font-size: 11px; font-weight: 600; cursor: pointer; text-align: left; }
  .review-bottom :global(.review-trigger:hover) { text-decoration: underline; text-underline-offset: 4px; }
  .review-bottom :global(.review-trigger:focus-visible) { outline: 2px solid #b79827; outline-offset: 4px; border-radius: 3px; }
  .full-review { max-height: 55dvh; overflow-y: auto; padding-right: 8px; white-space: pre-line; overflow-wrap: anywhere; font-size: 15px; line-height: 1.85; color: #334b60; margin: 0; }
  .original-review { display: inline-flex; align-items: center; gap: 8px; width: fit-content; color: #17334c; font-size: 13px; font-weight: 600; text-decoration: underline; text-underline-offset: 4px; }
  @media(max-width:1023px) { .review-grid { gap: 14px; } .review-card { padding: 20px; } }
  @media(max-width:767px) { .review-grid { grid-template-columns: minmax(0, 1fr); } .review-card { height: 328px; padding: 23px; } }

  /* Tour pages use a compact pair, with a consistent reading area and aligned authors. */
  .tour-reviews { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; gap: 24px; }
  .tour-reviews .review-card { height: auto; min-height: 300px; padding: 28px; border-color: var(--border); border-radius: 20px; box-shadow: 0 12px 32px -24px rgb(20 49 77 / .2); }
  .tour-reviews .stars { color: var(--success); }
  .tour-reviews .quote-mark { width: 40px; height: 40px; border: none; border-radius: 12px; background: var(--navy); color: var(--sun); }
  .tour-reviews .review-card > blockquote { min-height: 6.8em; margin: 20px 0 24px; font-size: 14px; line-height: 1.7; color: var(--muted-foreground); }
  .tour-reviews .review-bottom { display: flex; align-items: center; gap: 16px; padding-top: 20px; }
  .tour-reviews .review-author { flex: 1; gap: 12px; }
  .tour-reviews .initial { background: color-mix(in oklch, var(--sun) 18%, white); margin-right: 0; }
  .tour-reviews .review-bottom :global(.review-trigger) { flex-shrink: 0; gap: 6px; width: auto; min-height: 44px; margin-top: 0; font-size: 12px; }
  @media(max-width:1023px) {
    .tour-reviews .review-card { padding: 24px; }
    .tour-reviews .review-bottom { flex-wrap: wrap; gap: 8px; }
    .tour-reviews .review-author { flex-basis: 100%; }
    .tour-reviews .review-bottom :global(.review-trigger) { width: 100%; }
  }
  @media(max-width:767px) { .tour-reviews { grid-template-columns: minmax(0, 1fr); gap: 16px; } }
</style>
