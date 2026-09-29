-- Responsive image pipeline metadata.
--
-- Each uploaded image now stores its intrinsic dimensions + a blurhash/dominant
-- colour placeholder, plus which responsive widths were generated. The image
-- derivatives themselves live in storage at a deterministic path:
--   <folder>/<uuid>.<ext>  ->  <folder>/responsive/<uuid>/<width>.{avif,webp}
-- so the frontend can build an AVIF/WebP srcset straight from the original URL.
--
-- Apply once, then run:  npm run backfill:responsive:prod

alter table media_library
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists aspect_ratio numeric(7,4),
  add column if not exists blurhash text,
  add column if not exists dominant_color text,
  add column if not exists variant_widths integer[] not null default '{}',
  add column if not exists has_avif boolean not null default false;
