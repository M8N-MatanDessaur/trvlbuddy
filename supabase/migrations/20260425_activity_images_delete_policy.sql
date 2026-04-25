-- RLS DELETE policy for activity_images.
-- The table existed before migrations were tracked here and ended up with
-- read/insert policies but no user-facing delete policy, so client deletes
-- silently affected zero rows (RLS-blocked deletes don't surface an error).
-- Mirrors the policy on activity_videos.

drop policy if exists "Users can remove own activity images" on public.activity_images;
create policy "Users can remove own activity images"
  on public.activity_images
  for delete
  using (auth.uid() = uploaded_by);
