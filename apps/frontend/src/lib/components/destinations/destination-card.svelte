<script lang="ts">
  import { ArrowUpRight } from '@lucide/svelte';
  import DestinationImage from './destination-image.svelte';
  import { destinationHref, destinationFallbackPhoto } from '$lib/destination-content';
  import { textContent } from '$lib/home-content';
  import type { Destination } from '$lib/types/api';
  let {destination}: {destination:Destination}=$props();
</script>
<a href={destinationHref(destination)} class="destination-card" data-motion="card">
  <div class="destination-card-photo">
    <DestinationImage urls={[destination.main_image_url_thumbnail,destination.image_url_thumbnail,destination.main_image_url,destination.image_url,destination.banner_image_url]} alt={destination.name} fallback={destinationFallbackPhoto(destination)}/>
    <span class="destination-place">{destination.country || 'Explore Africa'}</span>
    <span class="destination-arrow"><ArrowUpRight size={20} aria-hidden="true" /></span>
  </div>
  <div class="destination-card-copy"><p>{destination.region || 'A place to discover'}</p><h3>{destination.name}</h3><p class="destination-summary">{textContent(destination.short_description || destination.description) || 'Explore this destination and plan your journey with our team.'}</p><span class="destination-card-link">Explore destination <ArrowUpRight size={15} /></span></div>
</a>
<style>
.destination-card{display:block;min-width:0;border:1px solid #e4e7e8;border-radius:18px;overflow:hidden;background:white;color:#14314d;text-decoration:none}.destination-card:focus-visible{outline:3px solid #d9b526;outline-offset:5px}.destination-card-photo{position:relative;aspect-ratio:1.4;background:#e9ece6;display:grid;place-items:center;overflow:hidden}.destination-place{position:absolute;left:20px;top:20px;padding:7px 12px;background:#fffef1ed;border-radius:20px;font-size:10px;letter-spacing:.06em;font-weight:600}.destination-arrow{position:absolute;right:18px;bottom:18px;width:38px;height:38px;display:grid;place-items:center;border-radius:50%;background:#f6d21b}.destination-card-copy{padding:24px}.destination-card-copy>p:first-child{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#6b7a85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.destination-card h3{font-size:22px;line-height:1.3;letter-spacing:-.6px;font-weight:600;margin:9px 0 12px}.destination-summary{font-size:13px;line-height:1.85;color:#63727e;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;line-clamp:3;overflow:hidden;min-height:5.55em}.destination-card-link{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e6e9eb;padding-top:17px;margin-top:20px;font-size:11px;font-weight:600}.destination-card:hover .destination-card-link{color:#8b6b0d}
</style>
