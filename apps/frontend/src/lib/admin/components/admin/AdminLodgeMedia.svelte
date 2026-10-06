<script lang="ts">
  import { Input as CmsInput } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import { Label as CmsLabel } from '$lib/components/ui/label';
  import { Checkbox as CmsCheckbox } from '$lib/components/ui/checkbox';
  import { Button as CmsButton } from '$lib/components/ui/button';

  import { cdnUrl } from '$lib/admin/img';
  /**
   * Gallery and amenities for one property, inside the existing lodge editor.
   *
   * No separate admin page: the two things an editor needs when writing about a
   * property are its photographs and what is there, and both belong on the same
   * screen as the copy.
   *
   * The parent owns saving — it calls `save(lodgeId)` after the lodge itself is
   * written, so a brand-new property has an id to attach these to.
   */
  import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from '@lucide/svelte';
  import { api, apiRequest } from '$lib/admin/api/client';
  import MediaPicker from './MediaPicker.svelte';
  import { GALLERY_CATEGORIES, enumLabel } from '$lib/admin/accommodationEnums';

  type GalleryImage = { image_url: string; alt_text: string; caption: string; category: string; is_featured: boolean; is_cover: boolean };
  type Amenity = { id: string; name: string; icon_key?: string | null; is_active?: boolean | null };

  let images: GalleryImage[] = [];
  let amenities: Amenity[] = [];
  let selected = new Set<string>();
  let loading = false;
  let error = '';
  // Saving replaces the whole gallery, so an existing property whose gallery
  // failed to load must not be saved with the empty list left in memory.
  let loadFailed = false;

  const blank = (url: string): GalleryImage => ({ image_url: url, alt_text: '', caption: '', category: 'EXTERIOR', is_featured: false, is_cover: false });

  export const load = async (id: string | null) => {
    images = [];
    selected = new Set();
    loadFailed = false;
    error = '';
    if (!id) {
      // A new property still needs the amenity list so the boxes can be ticked
      // before the first save. /:id/media 404s without a real lodge id.
      try {
        const res = await apiRequest<{ items: Amenity[] }>('/lodges/meta/amenities');
        amenities = (res.data?.items ?? []).filter((amenity) => amenity.is_active !== false);
      } catch {
        amenities = [];
      }
      return;
    }

    loading = true;
    try {
      const res = await api.lodges.media(id);
      const data = res.data ?? { images: [], amenity_ids: [], amenities: [] };
      images = ((data.images ?? []) as Record<string, unknown>[]).map((image) => ({
        image_url: String(image.image_url ?? ''),
        alt_text: String(image.alt_text ?? ''),
        caption: String(image.caption ?? ''),
        category: String(image.category ?? 'EXTERIOR').toUpperCase(),
        is_featured: image.is_featured === true,
        is_cover: image.is_cover === true
      }));
      amenities = (data.amenities ?? []) as Amenity[];
      selected = new Set((data.amenity_ids ?? []).map(String));
    } catch (err) {
      loadFailed = true;
      error = err instanceof Error ? err.message : 'Unable to load gallery and amenities.';
    } finally {
      loading = false;
    }
  };

  /** Called by the parent once the lodge row exists. */
  export const save = async (id: string) => {
    if (loadFailed) {
      // Nothing added since the failed load: keep the stored gallery as it is.
      if (!images.length && !selected.size) return;
      throw new Error('The gallery could not be loaded, so these photos were not saved. Reopen the property and add them again.');
    }
    await api.lodges.saveImages(id, images as unknown as Record<string, unknown>[]);
    await api.lodges.saveAmenities(id, [...selected]);
  };

  // The existing single-image picker is reused rather than building a second
  // one: it already browses the library, uploads, searches and returns the alt
  // text a librarian wrote. Each pick is appended and the picker reset, so it
  // behaves as a repeat-add control.
  let picked = '';

  const addPicked = (url: string, item?: { alt_text?: string | null; caption?: string | null; title?: string | null }) => {
    if (!url) return;
    const added = images.find((image) => image.image_url === url);
    // A library pick reports the URL first (change) and the record second
    // (select), so the alt text arrives for a photo that is already listed.
    if (added && item && !added.alt_text) {
      added.alt_text = String(item.alt_text ?? item.title ?? '');
      images = images;
    }
    if (!added) {
      const next = blank(url);
      next.alt_text = String(item?.alt_text ?? item?.title ?? '');
      next.caption = String(item?.caption ?? '');
      images = [...images, next];
      // First one in is the cover until somebody says otherwise.
      if (!images.some((image) => image.is_cover)) images[0].is_cover = true;
      images = images;
    }
    // Reset so the same slot can take the next pick.
    picked = '';
  };

  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    [next[index], next[to]] = [next[to], next[index]];
    images = next;
  };

  const remove = (index: number) => {
    const wasCover = images[index].is_cover;
    images = images.filter((_, at) => at !== index);
    if (wasCover && images.length) images[0].is_cover = true;
    images = images;
  };

  const setCover = (index: number) => {
    images = images.map((image, at) => ({ ...image, is_cover: at === index }));
  };

  const toggleAmenity = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  };
</script>

<div class="grid gap-4">
  <!-- ── gallery ─────────────────────────────────────────────────────────── -->
  <div>
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Gallery</p>
        <p class="mt-0.5 text-xs text-ink/50">
          The cover leads the public page. Drag order with the arrows; alt text describes the photo for screen readers
          and search.
        </p>
      </div>
      <p class="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/45">
        <ImagePlus size={14} /> Add photos below
      </p>
    </div>

    {#if error}
      <p class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>
    {/if}

    {#if loading}
      <p class="mt-3 rounded-xl bg-sand/45 px-4 py-3 text-sm text-ink/60">Loading gallery…</p>
    {:else if !images.length}
      <p class="mt-2 rounded-xl border border-dashed border-ink/15 px-4 py-3 text-center text-sm text-ink/50">
        No photos yet. The public page will fall back to the hero and card images above.
      </p>
    {:else}
      <ul class="mt-2 grid gap-2 xl:grid-cols-2">
        {#each images as image, index (image.image_url)}
          <li class="grid gap-2 rounded-xl border border-ink/10 bg-surface p-2 sm:grid-cols-[76px_1fr_auto]">
            <img class="h-16 w-full rounded-[7px] object-cover sm:w-[76px]" src={cdnUrl(image.image_url)} alt="" loading="lazy" />

            <div class="grid gap-1.5">
              <CmsInput
                class="h-9 rounded-md border border-ink/15 bg-black/[0.02] px-2.5 text-[13px] outline-none transition focus:border-forest focus:bg-surface"
                type="text"
                placeholder="Alt text — what is in the photo"
                aria-label={`Alt text for photo ${index + 1}`}
                bind:value={image.alt_text}
              />
              <CmsInput
                class="h-9 rounded-md border border-ink/15 bg-black/[0.02] px-2.5 text-[13px] outline-none transition focus:border-forest focus:bg-surface"
                type="text"
                placeholder="Caption (optional)"
                aria-label={`Caption for photo ${index + 1}`}
                bind:value={image.caption}
              />
              <div class="grid grid-cols-[1fr_auto] gap-2">
                <Select.Root type="single" bind:value={image.category}>
                  <Select.Trigger class="h-9 w-full min-w-0 rounded-md border border-ink/15 bg-black/[0.02] px-2 text-[12px]" aria-label={`Category for photo ${index + 1}`}><span class="truncate">{enumLabel(image.category)}</span></Select.Trigger>
                  <!-- No scroll lock: the editor scrolls inside its dialog, and a lock
                       restores the old position after closing, jumping the list. -->
                  <Select.Content class="cms-select-content" preventScroll={false}>
                    {#each GALLERY_CATEGORIES as category}<Select.Item value={category} label={enumLabel(category)}>{enumLabel(category)}</Select.Item>{/each}
                  </Select.Content>
                </Select.Root>
                <CmsLabel class="flex items-center gap-1.5 text-[11px] font-semibold text-ink/60"><CmsCheckbox  bind:checked={image.is_featured}/> Featured</CmsLabel>
              </div>
            </div>

            <div class="flex items-center gap-1 sm:flex-col sm:items-end">
              <CmsButton variant="ghost"
                class="grid h-8 w-8 place-items-center rounded-md border transition {image.is_cover
                  ? 'border-goldfinch-gold bg-goldfinch-gold/15 text-goldfinch-gold'
                  : 'border-ink/10 text-ink/45 hover:border-goldfinch-gold hover:text-goldfinch-gold'}"
                type="button"
                aria-label={image.is_cover ? `Photo ${index + 1} is the cover` : `Make photo ${index + 1} the cover`}
                aria-pressed={image.is_cover}
                title="Cover image"
                onclick={() => setCover(index)}
              >
                <Star size={14} fill={image.is_cover ? 'currentColor' : 'none'} />
              </CmsButton>
              <CmsButton variant="ghost" class="grid h-8 w-8 place-items-center rounded-md border border-ink/10 text-ink/55 transition hover:bg-sand/60 disabled:opacity-30" type="button" aria-label={`Move photo ${index + 1} up`} disabled={index === 0} onclick={() => move(index, -1)}>
                <ArrowUp size={14} />
              </CmsButton>
              <CmsButton variant="ghost" class="grid h-8 w-8 place-items-center rounded-md border border-ink/10 text-ink/55 transition hover:bg-sand/60 disabled:opacity-30" type="button" aria-label={`Move photo ${index + 1} down`} disabled={index === images.length - 1} onclick={() => move(index, 1)}>
                <ArrowDown size={14} />
              </CmsButton>
              <CmsButton variant="ghost" class="grid h-8 w-8 place-items-center rounded-md border border-red-200 text-red-600 transition hover:bg-red-50" type="button" aria-label={`Remove photo ${index + 1}`} onclick={() => remove(index)}>
                <Trash2 size={14} />
              </CmsButton>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <!-- ── amenities ───────────────────────────────────────────────────────── -->
  {#if amenities.length}
    <div>
      <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-forest/70">Amenities</p>
      <p class="mt-0.5 text-xs text-ink/50">Only ticked amenities appear on the public page.</p>
      <div class="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
        {#each amenities as amenity (amenity.id)}
          <CmsLabel class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-ink/80 transition hover:bg-sand/50">
            <CmsCheckbox
              class="h-4 w-4 rounded border-ink/25 text-forest focus:ring-forest"
              
              checked={selected.has(amenity.id)}
              onCheckedChange={() => toggleAmenity(amenity.id)}
            />
            {amenity.name}
          </CmsLabel>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Picking here appends to the gallery above and clears itself, so the same
     control adds photo after photo. -->
<div class="mt-3 max-w-md rounded-xl border border-dashed border-ink/15 bg-sand/20 p-3">
  <MediaPicker
    label="Add a photo to the gallery"
    uploadFolder="lodges"
    aspect="aspect-[3/1]"
    multiple
    bind:value={picked}
    on:select={(event) => addPicked(event.detail.file_url, event.detail)}
    on:change={(event) => addPicked(event.detail)}
  />
</div>
