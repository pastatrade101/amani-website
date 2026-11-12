<script lang="ts">
  import { MapPin } from '@lucide/svelte';
  import { safeUrl } from '$lib/home-content';
  let {urls,alt='',fallback='',hero=false,class:className=''}:{urls:(string|null|undefined)[];alt?:string;fallback?:string;hero?:boolean;class?:string}=$props();
  let failed=$state<string[]>([]);
  let candidates=$derived([...new Set([...urls,fallback].map(v=>safeUrl(v,'')).filter(Boolean))]);
  let source=$derived(candidates.find(url=>!failed.includes(url))||'');
</script>
<div class={`destination-image ${className}`}>
  {#if source}<img src={source} alt={source===fallback?'Destination inspiration':alt} loading={hero?'eager':'lazy'} fetchpriority={hero?'high':'auto'} onerror={()=>{failed=[...failed,source];}}/>{:else}<div class="photo-placeholder" aria-label={`Explore ${alt}`}><MapPin size={35} strokeWidth={1}/></div>{/if}
</div>
<style>
.destination-image{width:100%;height:100%;overflow:hidden}.destination-image img{display:block;width:100%;height:100%;object-fit:cover}/* No photo yet: a dark contour field with a pin, never a stock photo posing as the place. */
.photo-placeholder{position:relative;display:grid;place-items:center;width:100%;height:100%;overflow:hidden;background:radial-gradient(120% 90% at 50% 0%,oklch(.38 .015 75) 0%,#2b2722 58%,oklch(.22 .015 75) 100%);color:var(--sun)}.photo-placeholder::before{content:'';position:absolute;inset:-40%;background:repeating-radial-gradient(circle at 70% 120%,transparent 0 22px,rgb(255 255 255/.045) 22px 23px)}.photo-placeholder :global(svg){position:relative;translate:0 -18%}
</style>
