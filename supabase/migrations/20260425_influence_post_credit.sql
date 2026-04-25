-- Influence model v1.1: credit users for posting photos.
--
-- Philosophy from the v1 lock: engagement *received* drives influence
-- (image_liked +5, image_commented +3, comment_replied +1). v1.1 adds a
-- small self-action credit so an active uploader is never stuck at 0
-- before they get their first like / comment:
--   image_posted          +2   (per photo you upload)
--   image_posted_reverted -2   (when the photo is deleted)
--
-- Engagement still dominates: one received like (+5) outweighs two posts
-- (+4), so the leaderboard remains driven by what others think of your
-- content, not raw upload count.
--
-- Activity_images uses hard delete (no deleted_at column), so we trigger
-- on INSERT and DELETE only.

create or replace function public.apply_activity_image_post_influence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.uploaded_by is not null then
      insert into public.influence_events
        (recipient_id, actor_id, event_type, delta, subject_type, subject_id)
        values (new.uploaded_by, new.uploaded_by, 'image_posted', 2, 'activity_image', new.id);
      update public.profiles set influence = influence + 2 where id = new.uploaded_by;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.uploaded_by is not null then
      insert into public.influence_events
        (recipient_id, actor_id, event_type, delta, subject_type, subject_id)
        values (old.uploaded_by, old.uploaded_by, 'image_posted_reverted', -2, 'activity_image', old.id);
      update public.profiles set influence = greatest(influence - 2, 0) where id = old.uploaded_by;
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists activity_image_post_influence on public.activity_images;
create trigger activity_image_post_influence
  after insert or delete on public.activity_images
  for each row
  execute function public.apply_activity_image_post_influence();

-- Backfill: credit every existing photo once. The `not exists` guard makes
-- this safe to re-run — it inserts an image_posted event only for photos
-- that don't already have one. The denormalized profiles.influence column
-- is rebaselined from the ledger at the end so the totals stay correct.
insert into public.influence_events
  (recipient_id, actor_id, event_type, delta, subject_type, subject_id, created_at)
select
  ai.uploaded_by,
  ai.uploaded_by,
  'image_posted',
  2,
  'activity_image',
  ai.id,
  ai.created_at
from public.activity_images ai
where ai.uploaded_by is not null
  and not exists (
    select 1
    from public.influence_events e
    where e.subject_type = 'activity_image'
      and e.subject_id = ai.id
      and e.event_type = 'image_posted'
  );

-- Rebaseline profiles.influence from the ledger so the backfill takes
-- effect immediately on the UI without waiting for the next event.
update public.profiles p
set influence = coalesce(sub.total, 0)
from (
  select recipient_id, sum(delta)::int as total
  from public.influence_events
  group by recipient_id
) sub
where sub.recipient_id = p.id;

update public.profiles p
set influence = 0
where not exists (
  select 1 from public.influence_events e where e.recipient_id = p.id
);
