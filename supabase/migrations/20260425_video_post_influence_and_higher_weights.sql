-- Influence model v1.2: videos out-influence photos at every tier.
--
-- Rationale: shooting + uploading a video is a meaningfully bigger
-- contribution than snapping a photo, and a video that lands also drives
-- more engagement than a still. Reward both sides.
--
-- New weights (image weights stay where they are):
--   image_posted     +2          video_posted     +5   (NEW trigger + backfill)
--   image_commented  +3          video_commented  +6   (was +3)
--   image_liked      +5          video_liked      +10  (was +5)
--   comment_replied  +1          comment_replied  +1   (unchanged)
--
-- Past video_liked / video_commented events were recorded at the old +5/+3
-- weights. Rather than mutate history, we write paired *_boost events that
-- top up the deltas to the new totals. Then we rebaseline profiles.influence
-- from the ledger sum so all denormalized counters reflect the new model.

-------------------------------------------------------------------------------
-- 1. video_posted trigger (+5 per upload, reverses on delete)
-------------------------------------------------------------------------------

create or replace function public.apply_activity_video_post_influence()
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
        values (new.uploaded_by, new.uploaded_by, 'video_posted', 5, 'activity_video', new.id);
      update public.profiles set influence = influence + 5 where id = new.uploaded_by;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.uploaded_by is not null then
      insert into public.influence_events
        (recipient_id, actor_id, event_type, delta, subject_type, subject_id)
        values (old.uploaded_by, old.uploaded_by, 'video_posted_reverted', -5, 'activity_video', old.id);
      update public.profiles set influence = greatest(influence - 5, 0) where id = old.uploaded_by;
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists activity_video_post_influence on public.activity_videos;
create trigger activity_video_post_influence
  after insert or delete on public.activity_videos
  for each row
  execute function public.apply_activity_video_post_influence();

-------------------------------------------------------------------------------
-- 2. Bump video_liked from +5 to +10 (replace function body)
-------------------------------------------------------------------------------

create or replace function public.apply_activity_video_like_influence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare video_owner uuid;
begin
  if tg_op = 'INSERT' then
    select uploaded_by into video_owner from public.activity_videos where id = new.video_id;
    if video_owner is not null and video_owner <> new.user_id then
      insert into public.influence_events
        (recipient_id, actor_id, event_type, delta, subject_type, subject_id)
        values (video_owner, new.user_id, 'video_liked', 10, 'activity_video', new.video_id);
      update public.profiles set influence = influence + 10 where id = video_owner;
      insert into public.notifications (recipient_id, actor_id, type, subject_type, subject_id)
        values (video_owner, new.user_id, 'video_liked', 'activity_video', new.video_id);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    select uploaded_by into video_owner from public.activity_videos where id = old.video_id;
    if video_owner is not null and video_owner <> old.user_id then
      insert into public.influence_events
        (recipient_id, actor_id, event_type, delta, subject_type, subject_id)
        values (video_owner, old.user_id, 'video_liked_reverted', -10, 'activity_video', old.video_id);
      update public.profiles set influence = greatest(influence - 10, 0) where id = video_owner;
    end if;
    return old;
  end if;

  return null;
end;
$$;

-------------------------------------------------------------------------------
-- 3. Bump video_commented from +3 to +6 (replies stay at +1)
-------------------------------------------------------------------------------

create or replace function public.apply_activity_video_comment_influence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  video_owner uuid;
  parent_author uuid;
  recipient uuid;
  event text;
  delta_value integer;
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is not null then return new; end if;
    if new.parent_comment_id is null then
      select uploaded_by into video_owner from public.activity_videos where id = new.video_id;
      if video_owner is null or video_owner = new.user_id then return new; end if;
      recipient := video_owner; event := 'video_commented'; delta_value := 6;
    else
      select user_id into parent_author from public.activity_video_comments where id = new.parent_comment_id;
      if parent_author is null or parent_author = new.user_id then return new; end if;
      recipient := parent_author; event := 'comment_replied'; delta_value := 1;
    end if;
    insert into public.influence_events
      (recipient_id, actor_id, event_type, delta, subject_type, subject_id)
      values (recipient, new.user_id, event, delta_value, 'activity_video_comment', new.id);
    update public.profiles set influence = influence + delta_value where id = recipient;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      if new.parent_comment_id is null then
        select uploaded_by into video_owner from public.activity_videos where id = new.video_id;
        if video_owner is null or video_owner = new.user_id then return new; end if;
        recipient := video_owner; delta_value := -6; event := 'video_commented_reverted';
      else
        select user_id into parent_author from public.activity_video_comments where id = new.parent_comment_id;
        if parent_author is null or parent_author = new.user_id then return new; end if;
        recipient := parent_author; delta_value := -1; event := 'comment_replied_reverted';
      end if;
      insert into public.influence_events
        (recipient_id, actor_id, event_type, delta, subject_type, subject_id)
        values (recipient, new.user_id, event, delta_value, 'activity_video_comment', new.id);
      update public.profiles set influence = greatest(influence + delta_value, 0) where id = recipient;
    end if;
    return new;
  end if;

  return null;
end;
$$;

-------------------------------------------------------------------------------
-- 4. Backfill: credit every existing video once with video_posted +5.
-------------------------------------------------------------------------------

insert into public.influence_events
  (recipient_id, actor_id, event_type, delta, subject_type, subject_id, created_at)
select
  av.uploaded_by,
  av.uploaded_by,
  'video_posted',
  5,
  'activity_video',
  av.id,
  av.created_at
from public.activity_videos av
where av.uploaded_by is not null
  and not exists (
    select 1 from public.influence_events e
    where e.subject_type = 'activity_video'
      and e.subject_id = av.id
      and e.event_type = 'video_posted'
  );

-------------------------------------------------------------------------------
-- 5. Boost past video_liked events from +5 to +10 (delta of +5).
-------------------------------------------------------------------------------

insert into public.influence_events
  (recipient_id, actor_id, event_type, delta, subject_type, subject_id, created_at)
select
  e.recipient_id,
  e.actor_id,
  'video_liked_boost',
  5,
  e.subject_type,
  e.subject_id,
  e.created_at
from public.influence_events e
where e.event_type = 'video_liked'
  and not exists (
    select 1 from public.influence_events b
    where b.event_type = 'video_liked_boost'
      and b.subject_id = e.subject_id
      and b.actor_id = e.actor_id
      and b.recipient_id = e.recipient_id
  );

-- Mirror boost the reverts so net of like/unlike stays balanced.
insert into public.influence_events
  (recipient_id, actor_id, event_type, delta, subject_type, subject_id, created_at)
select
  e.recipient_id,
  e.actor_id,
  'video_liked_boost_reverted',
  -5,
  e.subject_type,
  e.subject_id,
  e.created_at
from public.influence_events e
where e.event_type = 'video_liked_reverted'
  and not exists (
    select 1 from public.influence_events b
    where b.event_type = 'video_liked_boost_reverted'
      and b.subject_id = e.subject_id
      and b.actor_id = e.actor_id
      and b.recipient_id = e.recipient_id
  );

-------------------------------------------------------------------------------
-- 6. Boost past video_commented (top-level) events from +3 to +6 (delta +3).
-------------------------------------------------------------------------------

insert into public.influence_events
  (recipient_id, actor_id, event_type, delta, subject_type, subject_id, created_at)
select
  e.recipient_id,
  e.actor_id,
  'video_commented_boost',
  3,
  e.subject_type,
  e.subject_id,
  e.created_at
from public.influence_events e
where e.event_type = 'video_commented'
  and not exists (
    select 1 from public.influence_events b
    where b.event_type = 'video_commented_boost'
      and b.subject_id = e.subject_id
      and b.actor_id = e.actor_id
      and b.recipient_id = e.recipient_id
  );

insert into public.influence_events
  (recipient_id, actor_id, event_type, delta, subject_type, subject_id, created_at)
select
  e.recipient_id,
  e.actor_id,
  'video_commented_boost_reverted',
  -3,
  e.subject_type,
  e.subject_id,
  e.created_at
from public.influence_events e
where e.event_type = 'video_commented_reverted'
  and not exists (
    select 1 from public.influence_events b
    where b.event_type = 'video_commented_boost_reverted'
      and b.subject_id = e.subject_id
      and b.actor_id = e.actor_id
      and b.recipient_id = e.recipient_id
  );

-------------------------------------------------------------------------------
-- 7. Rebaseline profiles.influence from the ledger so the UI shows the
--    new totals immediately, including all backfills + boosts.
-------------------------------------------------------------------------------

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
