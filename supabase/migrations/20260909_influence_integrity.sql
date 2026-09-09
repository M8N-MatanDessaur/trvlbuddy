-- Influence is the only social currency in this app -- there are no followers
-- and no verification, you are visible because of what you contributed and
-- how much people liked it. That makes the score worth counterfeiting, so it
-- has to be countable and capped.
--
-- Three fixes, all verified against the live database first.

-- ---------------------------------------------------------------------------
-- 1. Stop double-crediting image uploads
-- ---------------------------------------------------------------------------

-- Two triggers fired on insert into activity_images and both added influence:
--
--   on_activity_image_insert  -> bump_influence()                 +1, no event row
--   activity_image_post_influence -> apply_activity_image_post_influence()  +2, with event row
--
-- So an upload was worth 3 points, not the 2 the scheme intends. Worse, only
-- the second has a DELETE branch, so deleting the photo refunded 2 and left
-- the other 1 behind: upload, delete, repeat farmed a point per cycle with no
-- content left over. It also meant profiles.influence stopped agreeing with
-- the sum of influence_events, so the audit trail was already wrong.
--
-- bump_influence is the legacy one (it predates influence_events) and it is
-- the one that goes.
drop trigger if exists on_activity_image_insert on public.activity_images;
drop function if exists public.bump_influence();

-- ---------------------------------------------------------------------------
-- 2. Make the stored totals agree with the ledger again
-- ---------------------------------------------------------------------------

-- influence_events is the ledger; profiles.influence is a running total of it.
-- Recompute from the ledger so the phantom points the legacy trigger minted
-- are gone. Scores can only go down here, and only by the amount that was
-- never accounted for.
update public.profiles p
   set influence = coalesce((
     select greatest(sum(e.delta), 0)::integer
       from public.influence_events e
      where e.recipient_id = p.id
   ), 0);

-- ---------------------------------------------------------------------------
-- 3. Cap how fast one person can post
-- ---------------------------------------------------------------------------

-- There was no limit of any kind on uploads, and posting is worth points, so
-- the fastest route to the top of the leaderboard was a loop. Videos are the
-- expensive case: a 500MB bucket limit per file with no per-user quota is a
-- storage bill waiting to happen.
--
-- These ceilings are set well above what a real trip generates in a day and
-- well below what makes farming worthwhile.
create or replace function public.enforce_upload_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer;
  v_count integer;
  v_owner uuid := new.uploaded_by;
begin
  if v_owner is null then
    return new;
  end if;

  if tg_table_name = 'activity_videos' then
    v_limit := 10;
    select count(*) into v_count
      from public.activity_videos
     where uploaded_by = v_owner and created_at > now() - interval '24 hours';
  else
    v_limit := 40;
    select count(*) into v_count
      from public.activity_images
     where uploaded_by = v_owner and created_at > now() - interval '24 hours';
  end if;

  if v_count >= v_limit then
    raise exception 'Upload limit reached: % per day for %', v_limit, tg_table_name
      using errcode = 'check_violation',
            hint = 'Try again tomorrow.';
  end if;

  return new;
end;
$$;

drop trigger if exists activity_images_rate_limit on public.activity_images;
create trigger activity_images_rate_limit
  before insert on public.activity_images
  for each row execute function public.enforce_upload_rate_limit();

drop trigger if exists activity_videos_rate_limit on public.activity_videos;
create trigger activity_videos_rate_limit
  before insert on public.activity_videos
  for each row execute function public.enforce_upload_rate_limit();

-- ---------------------------------------------------------------------------
-- 4. Make the ledger idempotent per subject
-- ---------------------------------------------------------------------------

-- influence_events had no uniqueness at all beyond its own id, so nothing at
-- the database level stopped the same like being credited twice if a trigger
-- ever fired twice. Liking is already guarded (the like triggers handle both
-- INSERT and DELETE, and self-likes are ignored), but the ledger should not
-- rely on the triggers being perfect.
--
-- Partial, because reverting events intentionally pair with their originals
-- and posting/like events are the ones that must not repeat.
create unique index if not exists influence_events_unique_credit
  on public.influence_events (recipient_id, actor_id, event_type, subject_type, subject_id)
  where subject_id is not null and delta > 0;
