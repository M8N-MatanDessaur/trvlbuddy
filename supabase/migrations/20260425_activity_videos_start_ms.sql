-- Add a start offset to activity_videos so the player can play the
-- 7-second window the uploader picked, without re-encoding the source.
-- Defaults to 0 so existing rows continue to play from the beginning.

alter table public.activity_videos
  add column if not exists start_ms integer not null default 0;
