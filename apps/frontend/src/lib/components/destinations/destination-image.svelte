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
.destination-image{width:100%;height:100%;overflow:hidden}.destination-image img{display:block;width:100%;height:100%;object-fit:cover}.photo-placeholder{display:grid;place-items:center;width:100%;height:100%;background:linear-gradient(135deg,#d6ddd4,#ecebdd);color:#607b72}
</style>
