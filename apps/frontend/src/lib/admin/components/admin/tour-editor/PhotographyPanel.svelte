<script lang="ts">
  import { ArrowDown, ArrowUp, Star, Trash2 } from '@lucide/svelte';
  import MediaPicker from '$lib/admin/components/admin/MediaPicker.svelte';
  import type { PricingSeason } from '$lib/safari-pricing';
  import CardPreview from './CardPreview.svelte';
  import CountedInput from './CountedInput.svelte';
  import { LIMITS, MAX_GALLERY, moveItem, newKey, text, type DestinationOption, type GalleryDraft, type MediaItem, type TourEditorForm } from './model';

  export let form: TourEditorForm;
  export let mediaItems: MediaItem[] = [];
  /** For the card preview: the route and the "from" price. */
  export let destinations: DestinationOption[] = [];
  export let seasons: PricingSeason[] = [];

  const field =
    'h-10 min-w-0 rounded-md border border-ink/15 bg-surface px-3 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/20';

  /** Bound to the "add photos" picker; each pick becomes a gallery row. */
  let adding = '';

  $: photoCount = form.images.filter((image) => text(image.image_url)).length;
  $: full = form.images.length >= MAX_GALLERY;

  const addPhoto = (event: CustomEvent<{ file_url: string; alt_text?: string | null; caption?: string | null }>) => {
    const url = text(event.detail.file_url);
    adding = '';
    if (!url || full || form.images.some((image) => text(image.image_url) === url)) return;
    const image: GalleryDraft = {
      key: newKey(),
      id: '',
      image_url: url,
      // Reuse what the librarian already wrote rather than asking twice.
      alt_text: text(event.detail.alt_text),
      caption: text(event.detail.caption),
      is_featured: !form.images.some((item) => item.is_featured)
    };
    form.images = [...form.images, image];
  };

  /** One featured photo at most: starring one clears the others. */
  const feature = (key: string) => {
    form.images = form.images.map((image) => ({ ...image, is_featured: image.key === key ? !image.is_featured : false }));
  };

  const remove = (key: string) => {
    form.images = form.images.filter((image) => image.key !== key);
  };
</script>

<div class="grid gap-5 cms-form-panel">
  <section class="cms-form-section grid gap-5 lg:grid-cols-2">
    <div class="grid content-start gap-3">
      <div><h3 class="text-base font-semibold text-ink">Main image</h3><p class="mt-1 text-sm text-ink/55">Used on tour cards and in search results.</p></div>
      <MediaPicker label="Main image" media={mediaItems} uploadFolder="tours" aspect="aspect-[4/3]" bind:value={form.main_image_url} />
    </div>
    <div class="grid content-start gap-3">
      <div><h3 class="text-base font-semibold text-ink">Banner image</h3><p class="mt-1 text-sm text-ink/55">The wide photo across the top of the tour page.</p></div>
      <MediaPicker label="Banner image" media={mediaItems} uploadFolder="tours" aspect="aspect-[16/9]" bind:value={form.banner_image_url} />
    </div>
  </section>

  <!-- Cards crop the main image wider (16:10) than the picker shows it. -->
  <section class="cms-form-section grid gap-3">
    <div>
      <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">The main image on a tour card</p>
      <p class="mt-1 text-xs text-ink/55">Cards crop the photo to 16:10. Without a main image they use the banner, then a stock photo of a place on the route.</p>
    </div>
    <CardPreview {form} {destinations} {seasons} />
  </section>

  <section class="cms-form-section grid gap-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Gallery</p>
        <p class="mt-1 text-xs text-ink/55">Shown in this order. Star one photo to feature it; describe each one for travellers using screen readers.</p>
      </div>
      <span class="text-xs font-semibold text-ink/55">{photoCount} of {MAX_GALLERY}</span>
    </div>

    {#if form.images.length}
      <ol class="grid gap-3">
        {#each form.images as image, index (image.key)}
          <li class={`grid gap-3 rounded-xl border p-3 sm:grid-cols-[180px_minmax(0,1fr)] ${image.is_featured ? 'border-goldfinch-gold/60 bg-goldfinch-gold/5' : 'border-ink/10 bg-surface'}`}>
            <MediaPicker label={`Photo ${index + 1}`} media={mediaItems} uploadFolder="tours" aspect="aspect-[4/3]" bind:value={form.images[index].image_url} />
            <div class="grid content-start gap-2.5">
              <CountedInput class={field} label={`Photo ${index + 1} alt text`} placeholder="Alt text — what the photo shows" maxlength={LIMITS.altText} bind:value={form.images[index].alt_text} />
              <CountedInput class={field} label={`Photo ${index + 1} caption`} placeholder="Caption (optional)" maxlength={LIMITS.caption} bind:value={form.images[index].caption} />
              <div class="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  aria-pressed={image.is_featured}
                  class={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition ${image.is_featured ? 'bg-goldfinch-gold text-heading' : 'bg-goldfinch-gold/15 text-heading hover:bg-goldfinch-gold/30'}`}
                  on:click={() => feature(image.key)}
                ><Star size={12} class={image.is_featured ? 'fill-current' : ''} />{image.is_featured ? 'Featured' : 'Feature'}</button>
                <button type="button" class="flex size-8 items-center justify-center rounded-md border border-ink/10 text-ink/60 hover:bg-sand/60 disabled:opacity-30" aria-label={`Move photo ${index + 1} up`} disabled={index === 0} on:click={() => (form.images = moveItem(form.images, index, -1))}><ArrowUp size={14} /></button>
                <button type="button" class="flex size-8 items-center justify-center rounded-md border border-ink/10 text-ink/60 hover:bg-sand/60 disabled:opacity-30" aria-label={`Move photo ${index + 1} down`} disabled={index === form.images.length - 1} on:click={() => (form.images = moveItem(form.images, index, 1))}><ArrowDown size={14} /></button>
                <button type="button" class="ml-auto inline-flex h-8 items-center gap-1 rounded-md border border-red-200 px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50" aria-label={`Remove photo ${index + 1}`} on:click={() => remove(image.key)}><Trash2 size={13} />Remove</button>
              </div>
            </div>
          </li>
        {/each}
      </ol>
    {/if}

    {#if !full}
      <div class="rounded-xl border border-dashed border-ink/20 bg-sand/15 p-3 sm:max-w-sm">
        <MediaPicker label="Add photos" media={mediaItems} uploadFolder="tours" aspect="aspect-[16/9]" multiple bind:value={adding} on:select={addPhoto} />
      </div>
    {/if}
  </section>
</div>
