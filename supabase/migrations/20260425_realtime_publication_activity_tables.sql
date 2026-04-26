-- Add the activity-feature tables to supabase_realtime so the client
-- useActivityMedia hook can subscribe to live cross-user changes:
-- votes, likes, comments, and new image/video uploads. Without these,
-- a co-member's upvote or photo upload only appears on the next page
-- reload. Idempotent guard so re-running this migration on a project
-- that already has them is a no-op.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'activity_votes',
    'activity_images',
    'activity_videos',
    'activity_image_likes',
    'activity_image_comments',
    'activity_video_likes',
    'activity_video_comments'
  ]) loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute 'alter publication supabase_realtime add table public.' || t;
    end if;
  end loop;
end $$;
