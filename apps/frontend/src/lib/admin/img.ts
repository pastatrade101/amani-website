import { env as publicEnv } from '$env/dynamic/public';

// ----------------------------------------------------------------------------
// imgUrl — return a right-sized image URL for the requested render width.
//   • Unsplash (images.unsplash.com): append CDN sizing (free, always safe).
//     Most seed/CMS images are raw Unsplash URLs with NO params, so they serve
//     the full multi-MB original — this is the single biggest perf win.
//   • Supabase storage public URLs: use the render/image transform, but ONLY
//     when PUBLIC_SUPABASE_IMG_TRANSFORM=true (image transforms are a paid
//     Supabase feature — default off so we never break uploaded images).
//   • Anything else: returned unchanged.
// ----------------------------------------------------------------------------

const UNSPLASH = 'images.unsplash.com';
const SUPABASE_PUBLIC = '/storage/v1/object/public/';

const mediaCdnOrigin = () => (publicEnv.PUBLIC_MEDIA_CDN_URL || '').trim().replace(/\/+$/, '');

/** True only for an object managed by the legacy Supabase public bucket. */
export const isManagedMediaUrl = (url: string | null | undefined): boolean => {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return false;
  try {
    return new URL(url).pathname.includes(SUPABASE_PUBLIC);
  } catch {
    return url.includes(SUPABASE_PUBLIC);
  }
};

// Uploads made since the move to R2 store the bucket's public r2.dev address.
// Those are served from the CDN origin too, so moving to a custom domain is
// only a change of PUBLIC_MEDIA_CDN_URL — no stored URL has to be rewritten.
const R2_DEV_HOST = /^pub-[0-9a-f]{32}\.r2\.dev$/i;

const fromR2Dev = (url: string, cdn: string): string => {
  try {
    const parsed = new URL(url);
    if (!R2_DEV_HOST.test(parsed.hostname) || parsed.origin === cdn) return url;
    return `${cdn}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
};

/**
 * Convert a managed storage URL to its Cloudflare delivery URL.
 * Never persist this result: callers must retain the raw DB URL as the lookup
 * key for media_library and the image-variant resolver.
 */
export const cdnUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  const cdn = mediaCdnOrigin();
  if (!cdn) return url;
  if (!isManagedMediaUrl(url)) return fromR2Dev(url, cdn);
  try {
    const pathname = new URL(url).pathname;
    const managed = pathname.split(SUPABASE_PUBLIC)[1] ?? '';
    const slash = managed.indexOf('/'); // discard the Supabase bucket name
    if (slash < 0 || !managed.slice(slash + 1)) return url;
    return `${cdn}/${managed.slice(slash + 1)}`;
  } catch {
    const managed = url.split(SUPABASE_PUBLIC)[1]?.split(/[?#]/)[0] ?? '';
    const slash = managed.indexOf('/');
    return slash >= 0 ? `${cdn}/${managed.slice(slash + 1)}` : url;
  }
};

/** Explicit raw URL accessor for database lookups and mutation payloads. */
export const origUrl = (url: string | null | undefined): string => url || '';

export const imgUrl = (url: string | null | undefined, width = 800, quality = 70): string => {
  if (!url) return '';
  try {
    if (url.includes(UNSPLASH)) {
      const base = url.split('?')[0];
      return `${base}?auto=format&fit=crop&w=${width}&q=${quality}`;
    }
    if (mediaCdnOrigin() && isManagedMediaUrl(url)) return cdnUrl(url);
    if (url.includes(SUPABASE_PUBLIC) && publicEnv.PUBLIC_SUPABASE_IMG_TRANSFORM === 'true') {
      const transformed = url.replace(SUPABASE_PUBLIC, '/storage/v1/render/image/public/');
      const sep = transformed.includes('?') ? '&' : '?';
      return `${transformed}${sep}width=${width}&quality=${quality}`;
    }
    return cdnUrl(url);
  } catch {
    return url;
  }
};

// Width of the webp the backend generates alongside each upload
// (upload.service.ts THUMBNAIL_WIDTH). Anything asking for more than this from
// the thumbnail is upscaling it.
export const THUMBNAIL_WIDTH = 600;

// Pick the best source URL for a record's image: prefer the server-attached
// `<field>_thumbnail` (a small webp from media_library) over the full-size
// original, walking a fallback chain of fields. Pass the result to imgUrl().
export const thumbUrl = (record: Record<string, any> | null | undefined, ...fields: string[]): string => {
  if (!record) return '';
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string' && value) {
      const thumbnail = record[`${field}_thumbnail`];
      return cdnUrl(typeof thumbnail === 'string' && thumbnail ? thumbnail : value);
    }
  }
  return '';
};


// Width-aware source selection. `thumbUrl` always prefers the 600px thumbnail,
// which is right for a small tile and wrong for a hero or a large card: with
// Supabase transforms disabled (the default, since they are a paid feature)
// imgUrl cannot resize, so a 600px file gets stretched into a 1600px slot and
// looks soft. Above THUMBNAIL_WIDTH — including retina, so pass the CSS width
// times the DPR you design for — this returns the full-size original and lets
// the browser downscale instead.
export const sourceFor = (
  record: Record<string, any> | null | undefined,
  renderWidth: number,
  ...fields: string[]
): string => {
  if (!record) return '';
  for (const field of fields) {
    const original = record[field];
    if (typeof original !== 'string' || !original) continue;
    const thumbnail = record[`${field}_thumbnail`];
    const useThumbnail = renderWidth <= THUMBNAIL_WIDTH && typeof thumbnail === 'string' && thumbnail;
    return cdnUrl(useThumbnail ? thumbnail : original);
  }
  return '';
};

// ── Responsive variants ─────────────────────────────────────────────────────
// The backend writes a WebP + AVIF ladder alongside uploads:
//   <folder>/<uuid>.<ext> -> <folder>/responsive/<uuid>/<width>.{avif,webp}
//
// Public list/detail APIs attach `<field>_variants` for known image columns.
// Homepage/gallery section URLs can use the batch `/public/image-variants`
// resolver, which returns widths keyed by original URL. In both cases we only
// put widths that actually exist in `srcset`, because a 404 candidate can break
// image selection instead of falling back.

export type ImageVariants = { base: string; widths: number[]; avif?: boolean };
export type ResolvedImageVariant = {
  base?: string | null;
  widths?: number[] | null;
  variant_widths?: number[] | null;
  avif?: boolean | null;
  hasAvif?: boolean | null;
  has_avif?: boolean | null;
};
export type ImageVariantMap = Record<string, ResolvedImageVariant | ImageVariants | undefined>;

const cleanWidths = (widths: unknown): number[] =>
  Array.isArray(widths)
    ? [...new Set(widths.map((width) => Number(width)).filter((width) => Number.isFinite(width) && width > 0))].sort(
        (a, b) => a - b
      )
    : [];

export const variantBaseFromUrl = (url: string | null | undefined): string => {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return '';
  const clean = url.split(/[?#]/)[0];
  const fileName = clean.split('/').pop() ?? '';
  const stem = fileName.replace(/\.[^.]+$/, '');
  const folder = clean.replace(/\/[^/]+$/, '');
  if (!stem || stem === fileName || !folder || folder === clean) return '';
  return cdnUrl(`${folder}/responsive/${stem}`);
};

export const variantForUrl = (
  url: string | null | undefined,
  meta: ResolvedImageVariant | ImageVariants | null | undefined
): ImageVariants | null => {
  if (!meta) return null;
  const raw = meta as ResolvedImageVariant & Partial<ImageVariants>;
  const widths = cleanWidths(raw.widths ?? raw.variant_widths);
  if (!widths.length) return null;
  const base = typeof raw.base === 'string' && raw.base ? cdnUrl(raw.base) : variantBaseFromUrl(url);
  if (!base) return null;
  return {
    base,
    widths,
    avif: raw.avif === true || raw.hasAvif === true || raw.has_avif === true
  };
};

export const variantFromMap = (
  url: string | null | undefined,
  variants: ImageVariantMap | null | undefined
): ImageVariants | null => (url && variants ? variantForUrl(url, variants[url]) : null);

export const variantsOf = (
  record: Record<string, any> | null | undefined,
  ...fields: string[]
): ImageVariants | null => {
  if (!record) return null;
  for (const field of fields) {
    const original = record[field];
    const value = record[`${field}_variants`];
    const variants = variantForUrl(typeof original === 'string' ? original : '', value);
    if (variants) return variants;
  }
  return null;
};

export const attachResolvedVariantFields = <T extends Record<string, any>>(
  rows: T[],
  variants: ImageVariantMap,
  fields: string[]
): T[] => {
  if (!rows.length || !Object.keys(variants).length) return rows;
  for (const row of rows) {
    for (const field of fields) {
      const url = row[field];
      if (typeof url !== 'string' || !url) continue;
      if (row[`${field}_variants`]) continue;
      const resolved = variantFromMap(url, variants);
      if (resolved) (row as Record<string, any>)[`${field}_variants`] = resolved;
    }
  }
  return rows;
};

/** `srcset` string for one format, or '' when there is nothing to offer. */
export const srcsetFor = (variants: ImageVariants | null, ext: 'avif' | 'webp'): string => {
  if (!variants?.widths?.length) return '';
  if (ext === 'avif' && !variants.avif) return '';
  return cleanWidths(variants.widths).map((width) => `${variants.base}/${width}.${ext} ${width}w`).join(', ');
};

/**
 * Best single src from the ladder for a known render width — used as the <img>
 * fallback inside a <picture>, and anywhere a srcset is overkill.
 */
export const variantSrc = (variants: ImageVariants | null, renderWidth: number, ext: 'avif' | 'webp' = 'webp'): string => {
  if (!variants?.widths?.length) return '';
  if (ext === 'avif' && !variants.avif) return '';
  const target = renderWidth * 2; // retina
  const widths = cleanWidths(variants.widths);
  const pick = widths.find((width) => width >= target) ?? widths[widths.length - 1];
  return `${variants.base}/${pick}.${ext}`;
};
