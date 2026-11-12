<script lang="ts">
  import DestinationImage from './destination-image.svelte';
  import { destinationHref, destinationFallbackPhoto } from '$lib/destination-content';
  import { textContent } from '$lib/home-content';
  import type { Destination } from '$lib/types/api';

  // A place, told by its photo: a tall tile with the country on it and the
  // name and region along the foot. Larger screens add two lines about the
  // place when there are any; nothing is invented when there are not.
  let {destination}: {destination:Destination}=$props();
  let summary=$derived(textContent(destination.short_description || destination.description));
</script>
<a href={destinationHref(destination)} class="destination-card" data-motion="card">
  <div class="destination-card-photo">
    <DestinationImage urls={[destination.main_image_url_thumbnail,destination.image_url_thumbnail,destination.main_image_url,destination.image_url,destination.banner_image_url]} alt={destination.name} fallback={destinationFallbackPhoto(destination)}/>
  </div>
  {#if destination.country}<span class="destination-place">{destination.country}</span>{/if}
  <div class="destination-card-copy">
    <h3>{destination.name}</h3>
    {#if destination.region}<p class="destination-region">{destination.region}</p>{/if}
    {#if summary}<p class="destination-summary">{summary}</p>{/if}
  </div>
</a>
<style>
  .destination-card { position: relative; isolation: isolate; display: block; min-width: 0; aspect-ratio: 4 / 5; overflow: hidden; border-radius: 14px; background: #2b2722; color: white; text-decoration: none; box-shadow: 0 22px 44px -34px rgb(31 27 22 / .7); transition: scale .18s ease; }
  .destination-card:focus-visible { outline: 3px solid var(--sun); outline-offset: 4px; }
  .destination-card:active { scale: .985; }
  .destination-card-photo { position: absolute; inset: 0; z-index: -2; }
  .destination-card-photo :global(img) { transition: scale .7s cubic-bezier(.22,1,.36,1); }
  /* Dark only along the foot, where the words sit. */
  .destination-card::after { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(0deg, rgb(20 18 15 / .86) 0%, rgb(20 18 15 / .5) 30%, rgb(20 18 15 / 0) 58%); }
  .destination-place { position: absolute; top: 12px; left: 12px; display: inline-flex; align-items: center; height: 26px; padding: 0 9px; border-radius: 6px; background: rgb(255 255 255 / .94); color: var(--navy); font-size: 12px; font-weight: 600; }
  .destination-card-copy { position: absolute; inset: auto 0 0; padding: 18px 18px 18px; }
  .destination-card h3 { margin: 0; font-size: 21px; font-weight: 600; line-height: 1.15; letter-spacing: -.02em; text-wrap: balance; }
  .destination-region { margin: 5px 0 0; overflow: hidden; color: rgb(255 255 255 / .78); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
  .destination-summary { display: none; }
  @media (hover: hover) { .destination-card:hover .destination-card-photo :global(img) { scale: 1.05; } }
  @media (min-width: 1024px) {
    .destination-summary { display: -webkit-box; margin: 10px 0 0; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; color: rgb(255 255 255 / .8); font-size: 13.5px; line-height: 1.55; }
    .destination-card::after { background: linear-gradient(0deg, rgb(20 18 15 / .9) 0%, rgb(20 18 15 / .55) 36%, rgb(20 18 15 / 0) 64%); }
  }
  @media (max-width: 639px) {
    .destination-card-copy { padding: 14px 13px 13px; }
    .destination-card h3 { font-size: 17px; }
    .destination-region { font-size: 12px; }
    .destination-place { top: 9px; left: 9px; height: 24px; padding: 0 7px; font-size: 11.5px; }
  }
  @media (prefers-reduced-motion: reduce) { .destination-card, .destination-card-photo :global(img) { transition: none; } .destination-card:active, .destination-card:hover .destination-card-photo :global(img) { scale: none; } }
</style>
