<script lang="ts">
  import { Button as CmsButton } from '$lib/components/ui/button';

  import { cdnUrl } from '$lib/admin/img';
  import { onDestroy, onMount } from 'svelte';

  type Slide = { image_url: string; title?: string; subtitle?: string };

  export let slides: Slide[] = [];
  export let brandName = '';

  let current = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  $: valid = slides.filter((slide) => slide && typeof slide.image_url === 'string' && slide.image_url.trim());

  const start = () => {
    clearInterval(timer);
    if (valid.length > 1) {
      timer = setInterval(() => {
        current = (current + 1) % valid.length;
      }, 6000);
    }
  };

  const go = (index: number) => {
    current = index;
    start();
  };

  onMount(start);
  onDestroy(() => clearInterval(timer));

  // Keep the index valid if the slide list changes.
  $: if (current >= valid.length) current = 0;
</script>

<div class="relative h-full w-full overflow-hidden bg-deep-green">
  {#each valid as slide, i (i)}
    <div
      class="absolute inset-0 transition-opacity duration-700 ease-out"
      style:opacity={i === current ? '1' : '0'}
      aria-hidden={i === current ? undefined : 'true'}
    >
      <img class="h-full w-full object-cover" src={cdnUrl(slide.image_url)} alt={slide.title || brandName} />
      <div class="absolute inset-0 bg-gradient-to-t from-deep-green/95 via-deep-green/45 to-deep-green/20"></div>
      <div class="absolute inset-x-0 bottom-0 p-9 md:p-12">
        {#if slide.title}
          <h2 class="max-w-md text-3xl font-extrabold leading-[1.12] tracking-tight text-white md:text-[40px]">
            {slide.title}
          </h2>
        {/if}
        {#if slide.subtitle}
          <p class="mt-3 max-w-md text-sm leading-7 text-white/80 md:text-base">{slide.subtitle}</p>
        {/if}
      </div>
    </div>
  {/each}

  <!-- decorative brand glows -->
  <div class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-goldfinch-gold/25 blur-3xl"></div>

  <!-- constant brand wordmark -->
  <div class="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 p-9 md:p-12">
    <span class="grid h-9 w-9 place-items-center rounded-xl bg-goldfinch-gold/90 text-heading shadow-sm">
      <svg viewBox="0 0 24 24" fill="none" class="h-5 w-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
      </svg>
    </span>
    {#if brandName}<span class="text-lg font-bold tracking-wide text-white drop-shadow">{brandName}</span>{/if}
  </div>

  <!-- dots -->
  {#if valid.length > 1}
    <div class="absolute bottom-8 right-9 z-10 flex gap-2 md:right-12">
      {#each valid as _, i (i)}
        <CmsButton variant="ghost"
          type="button"
          class={`h-1.5 rounded-full transition-all ${i === current ? 'w-7 bg-goldfinch-gold' : 'w-2.5 bg-surface/45 hover:bg-surface/70'}`}
          onclick={() => go(i)}
          aria-label={`Go to slide ${i + 1}`}
        ></CmsButton>
      {/each}
    </div>
  {/if}
</div>
