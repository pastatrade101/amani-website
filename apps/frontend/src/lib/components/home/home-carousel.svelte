<script lang="ts" generics="T">
  import { onMount, type Snippet } from 'svelte';
  import { ChevronLeft, ChevronRight } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  let {items, label, card, columns=4}: {items:T[];label:string;card:Snippet<[T,number]>;columns?:number}=$props();
  const id=$props.id();
  let track=$state<HTMLUListElement>();
  let atStart=$state(true), atEnd=$state(false);
  let target=0;
  function update(){if(!track)return;atStart=track.scrollLeft<=2;atEnd=track.scrollLeft+track.clientWidth>=track.scrollWidth-2;}
  function slide(direction:number){if(!track)return;const first=track.children[0] as HTMLElement; if(!first)return;const step=first.getBoundingClientRect().width+parseFloat(getComputedStyle(track).gap);target=Math.max(0,Math.min(track.scrollWidth-track.clientWidth,Math.round(target/step)*step+direction*step));track.scrollTo({left:target,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  onMount(()=>{if(!track)return;const observer=new ResizeObserver(()=>{target=track?.scrollLeft??0;update();});observer.observe(track);return()=>observer.disconnect();});
</script>
<div class="home-carousel" style={`--columns:${columns}`} role="region" aria-roledescription="carousel" aria-label={label}>
  <div class="controls"><Button variant="outline" size="icon" class="size-11 rounded-full bg-white" aria-label={`Previous ${label}`} aria-controls={id} disabled={atStart} onclick={()=>slide(-1)}><ChevronLeft class="size-5" /></Button><Button variant="outline" size="icon" class="size-11 rounded-full bg-white" aria-label={`Next ${label}`} aria-controls={id} disabled={atEnd} onclick={()=>slide(1)}><ChevronRight class="size-5" /></Button></div>
  <ul {id} bind:this={track} onscroll={update} onscrollend={()=>{target=track?.scrollLeft??0;update();}} onpointerdown={()=>target=track?.scrollLeft??0} onwheel={()=>target=track?.scrollLeft??0} class="track">
    {#each items as item,i}<li class="slide" aria-label={`${i+1} of ${items.length}`}>{@render card(item,i)}</li>{/each}
  </ul>
</div>
<style>
 .controls{display:flex;justify-content:flex-end;gap:12px;margin-bottom:20px}.track{position:relative;display:flex;gap:24px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;padding:4px 2px 16px;scrollbar-width:none}.track::-webkit-scrollbar{display:none}.slide{display:flex;flex-direction:column;min-width:0;flex:0 0 calc((100% - (var(--columns) - 1)*24px)/var(--columns));scroll-snap-align:start}
 @media(max-width:1023px){.slide{flex-basis:calc((100% - 24px)/2)}}@media(max-width:639px){.track{gap:16px}.slide{flex-basis:86%}.controls{margin-bottom:16px}}
</style>
