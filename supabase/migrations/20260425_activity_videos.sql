-- Activity videos. Parallels activity_images + its likes/comments tables
-- so nothing in the image path has to change. A video row stores its own
-- file path + a poster-frame path (still image extracted during upload)
-- so grids and previews stay fast.

create table if not exists public.activity_videos (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  poster_path text not null,
  thumbhash text,
  duration_ms integer,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

create index if not exists activity_videos_activity_created_idx
  on public.activity_videos (activity_id, created_at desc);
create index if not exists activity_videos_uploaded_by_idx
  on public.activity_videos (uploaded_by);

alter table public.activity_videos enable row level security;

drop policy if exists "Activity videos are readable" on public.activity_videos;
create policy "Activity videos are readable"
  on public.activity_videos for select using (true);

drop policy if exists "Users can upload activity videos" on public.activity_videos;
create policy "Users can upload activity videos"
  on public.activity_videos for insert
  with check (auth.uid() = uploaded_by);

drop policy if exists "Users can remove own activity videos" on public.activity_videos;
create policy "Users can remove own activity videos"
  on public.activity_videos for delete
  using (auth.uid() = uploaded_by);

-- Likes: reuse the same (id, user_id) composite PK pattern as images.
create table if not exists public.activity_video_likes (
  video_id uuid not null references public.activity_videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);

alter table public.activity_video_likes enable row level security;

drop policy if exists "Video likes are readable" on public.activity_video_likes;
create policy "Video likes are readable"
  on public.activity_video_likes for select using (true);

drop policy if exists "Users can like videos" on public.activity_video_likes;
create policy "Users can like videos"
  on public.activity_video_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can unlike their videos" on public.activity_video_likes;
create policy "Users can unlike their videos"
  on public.activity_video_likes for delete
  using (auth.uid() = user_id);

-- Ignore self-likes so the feed can still emit an insert without inflating
-- the counter.
create or replace function public.ignore_own_activity_video_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare video_owner uuid;
begin
  select uploaded_by into video_owner from public.activity_videos where id = new.video_id;
  if video_owner = new.user_id then return null; end if;
  return new;
end;
$$;

drop trigger if exists activity_video_like_ignore_own on public.activity_video_likes;
create trigger activity_video_like_ignore_own
  before insert on public.activity_video_likes
  for each row execute function public.ignore_own_activity_video_like();

-- Influence + notifications on video like — matches image behavior:
-- +5 per like, reverses on unlike, self-likes 0.
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
        values (video_owner, new.user_id, 'video_liked', 5, 'activity_video', new.video_id);
      update public.profiles set influence = influence + 5 where id = video_owner;
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
        values (video_owner, old.user_id, 'video_liked_reverted', -5, 'activity_video', old.video_id);
      update public.profiles set influence = greatest(influence - 5, 0) where id = video_owner;
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists activity_video_like_influence on public.activity_video_likes;
create trigger activity_video_like_influence
  after insert or delete on public.activity_video_likes
  for each row execute function public.apply_activity_video_like_influence();

-- Comments: same shape as image comments, including threading + soft-delete.
create table if not exists public.activity_video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.activity_videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 500),
  parent_comment_id uuid references public.activity_video_comments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create index if not exists activity_video_comments_video_created_idx
  on public.activity_video_comments (video_id, created_at);

alter table public.activity_video_comments enable row level security;

drop policy if exists "Video comments are readable" on public.activity_video_comments;
create policy "Video comments are readable"
  on public.activity_video_comments for select using (true);

drop policy if exists "Users can comment on videos" on public.activity_video_comments;
create policy "Users can comment on videos"
  on public.activity_video_comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can edit own video comments" on public.activity_video_comments;
create policy "Users can edit own video comments"
  on public.activity_video_comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove own video comments" on public.activity_video_comments;
create policy "Users can remove own video comments"
  on public.activity_video_comments for delete
  using (auth.uid() = user_id);

-- Notifications on new top-level / reply comments (reuses the same
-- payload shape as image comments — recipient is the uploader for
-- top-level, parent author for replies).
create or replace function public.notify_on_activity_video_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  video_owner uuid;
  parent_author uuid;
  recipient uuid;
  notif_type text;
  preview text;
begin
  if tg_op <> 'INSERT' then return new; end if;
  if new.deleted_at is not null then return new; end if;

  if new.parent_comment_id is null then
    select uploaded_by into video_owner from public.activity_videos where id = new.video_id;
    if video_owner is null or video_owner = new.user_id then return new; end if;
    recipient := video_owner;
    notif_type := 'video_commented';
  else
    select user_id into parent_author from public.activity_video_comments where id = new.parent_comment_id;
    if parent_author is null or parent_author = new.user_id then return new; end if;
    recipient := parent_author;
    notif_type := 'comment_replied';
  end if;

  preview := substring(new.body from 1 for 140);

  insert into public.notifications (recipient_id, actor_id, type, subject_type, subject_id, data)
  values (
    recipient, new.user_id, notif_type, 'activity_video_comment', new.id,
    jsonb_build_object('video_id', new.video_id, 'preview', preview)
  );

  return new;
end;
$$;

drop trigger if exists activity_video_comment_notify on public.activity_video_comments;
create trigger activity_video_comment_notify
  after insert on public.activity_video_comments
  for each row execute function public.notify_on_activity_video_comment();

-- Video comment influence (same weights as images).
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
      recipient := video_owner; event := 'video_commented'; delta_value := 3;
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
        recipient := video_owner; delta_value := -3; event := 'video_commented_reverted';
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

drop trigger if exists activity_video_comment_influence on public.activity_video_comments;
create trigger activity_video_comment_influence
  after insert or update on public.activity_video_comments
  for each row execute function public.apply_activity_video_comment_influence();

-- Don't forget to create the storage bucket:
--   supabase storage create activity-videos --public
-- or via SQL (requires service role):
--   insert into storage.buckets (id, name, public) values ('activity-videos', 'activity-videos', true);
