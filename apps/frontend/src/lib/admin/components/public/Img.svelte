<script lang="ts">
  /**
   * One image, served at a sensible size.
   *
   * Prefers the AVIF/WebP ladder the backend already generates over the
   * original upload. On the landing page the originals were multi-megabyte
   * files scaled down in the browser — a 3872×2592 photograph in a 1280px slot
   * — which is what made the page heavy and slow to paint.
   *
   * Falls back to the plain original whenever a record has no variants (an
   * external URL, or an upload predating the backfill), so nothing breaks.
   */
  import {
    imgUrl,
    sourceFor,
    srcsetFor,
    variantFromMap,
    variantSrc,
    variantsOf,
    type ImageVariantMap,
    type ImageVariants
  } from '$lib/admin/img';

  /** The API record carrying `<field>_variants`, e.g. a tour or destination. */
  export let record: any = undefined;
  /** Image fields to try, in order. */
  export let fields: string[] = [];
  /** Explicit URL when there is no record (already-resolved images). */
  export let src = '';
  /** Explicit variants, or a URL-keyed map returned by /public/image-variants. */
  export let variants: ImageVariants | null = null;
  export let variantsMap: ImageVariantMap | null | undefined = undefined;
  export let alt = '';
  /** CSS width the image occupies at its largest, used to pick a variant. */
  export let width = 800;
  export let height: number | string | undefined = undefined;
  /** Maps viewport to rendered width so the browser can choose correctly. */
  export let sizes = '';
  export let className = '';
  export let pictureClass = 'contents';
  export let imgStyle = '';
  export let eager = false;
  export let onError: (() => void) | undefined = undefined;
  /** Intrinsic ratio, to reserve space and avoid layout shift. */
  export let aspect = '';

  $: original = src || (record ? fields.map((field) => record?.[field]).find(Boolean) : '') || '';
  $: responsiveVariants = variants || variantsOf(record, ...fields) || variantFromMap(original, variantsMap);
  $: avif = srcsetFor(responsiveVariants, 'avif');
  $: webp = srcsetFor(responsiveVariants, 'webp');
  // Last resort keeps the pre-existing thumbnail/original behavior for old or
  // external images with no responsive ladder.
  $: fallbackSource = src || (record ? sourceFor(record, width, ...fields) : original);
  $: fallback = variantSrc(responsiveVariants, width) || imgUrl(fallbackSource || original, width, 72);
  $: resolvedSizes = sizes || `${width}px`;
  $: resolvedStyle = [aspect ? `aspect-ratio:${aspect}` : '', imgStyle].filter(Boolean).join(';');
</script>

{#if fallback}
  <picture class={pictureClass}>
    {#if avif}<source type="image/avif" srcset={avif} sizes={resolvedSizes} />{/if}
    {#if webp}<source type="image/webp" srcset={webp} sizes={resolvedSizes} />{/if}
    <img
      class={className}
      style={resolvedStyle || undefined}
      src={fallback}
      {alt}
      {width}
      {height}
      loading={eager ? 'eager' : 'lazy'}
      fetchpriority={eager ? 'high' : 'auto'}
      decoding="async"
      on:error={onError}
    />
  </picture>
{/if}
