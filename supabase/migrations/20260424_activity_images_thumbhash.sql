-- Phase 2 media pipeline: per-image thumbhash placeholder.
-- 80-byte base64 string computed client-side at upload time. Decodes to a
-- tiny blurred preview the UI paints under the real image while it loads.
-- Nullable so existing rows aren't broken; backfill happens asynchronously.

alter table public.activity_images
  add column if not exists thumbhash text;

comment on column public.activity_images.thumbhash is
  'Base64-encoded ThumbHash (~80 bytes) for blurred placeholder preview.';
