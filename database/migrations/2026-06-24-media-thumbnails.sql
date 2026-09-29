-- Media thumbnails: store a small, web-optimized derivative for each uploaded
-- image so the Media Library picker (and cards) load fast instead of pulling
-- the full-size original. Generated server-side on upload (sharp -> webp).
-- thumbnail_url is nullable: older images fall back to file_url until backfilled.
alter table media_library add column if not exists thumbnail_url text;
alter table media_library add column if not exists thumbnail_path text;
