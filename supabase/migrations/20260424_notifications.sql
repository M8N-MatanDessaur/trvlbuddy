-- Notifications + realtime hookup.
--
-- Types:
--   image_liked           someone liked your photo
--   image_commented       someone left a top-level comment on your photo
--   comment_replied       someone replied to your comment
--   influence_milestone   you crossed 100 / 500 / 1000 / 5000 / 10000 points
--
-- `data jsonb` carries per-type payload (thresholds, comment preview, etc).
-- Recipients can only read their own rows.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  subject_type text,
  subject_id uuid,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "Own notifications readable" on public.notifications;
create policy "Own notifications readable"
  on public.notifications
  for select
  using (auth.uid() = recipient_id);

drop policy if exists "Own notifications can be marked read" on public.notifications;
create policy "Own notifications can be marked read"
  on public.notifications
  for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Triggers that emit notification rows. Kept separate from the influence
-- triggers so the two concerns can evolve independently (e.g., a future
-- "quiet hours" preference would gate notifications without touching
-- influence math).

create or replace function public.notify_on_activity_image_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  image_owner uuid;
begin
  if tg_op <> 'INSERT' then return new; end if;
  select uploaded_by into image_owner from public.activity_images where id = new.image_id;
  if image_owner is null or image_owner = new.user_id then return new; end if;

  insert into public.notifications (recipient_id, actor_id, type, subject_type, subject_id)
  values (image_owner, new.user_id, 'image_liked', 'activity_image', new.image_id);

  return new;
end;
$$;

drop trigger if exists activity_image_like_notify on public.activity_image_likes;
create trigger activity_image_like_notify
  after insert on public.activity_image_likes
  for each row
  execute function public.notify_on_activity_image_like();

create or replace function public.notify_on_activity_image_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  image_owner uuid;
  parent_author uuid;
  recipient uuid;
  notif_type text;
  preview text;
begin
  if tg_op <> 'INSERT' then return new; end if;
  if new.deleted_at is not null then return new; end if;

  if new.parent_comment_id is null then
    select uploaded_by into image_owner from public.activity_images where id = new.image_id;
    if image_owner is null or image_owner = new.user_id then return new; end if;
    recipient := image_owner;
    notif_type := 'image_commented';
  else
    select user_id into parent_author from public.activity_image_comments where id = new.parent_comment_id;
    if parent_author is null or parent_author = new.user_id then return new; end if;
    recipient := parent_author;
    notif_type := 'comment_replied';
  end if;

  preview := substring(new.body from 1 for 140);

  insert into public.notifications
    (recipient_id, actor_id, type, subject_type, subject_id, data)
  values (
    recipient,
    new.user_id,
    notif_type,
    'activity_image_comment',
    new.id,
    jsonb_build_object('image_id', new.image_id, 'preview', preview)
  );

  return new;
end;
$$;

drop trigger if exists activity_image_comment_notify on public.activity_image_comments;
create trigger activity_image_comment_notify
  after insert on public.activity_image_comments
  for each row
  execute function public.notify_on_activity_image_comment();

-- Influence milestone notifications. Fires from influence_events insert:
-- when the running total crosses a threshold, drop a notification row. We
-- read profiles.influence for the POST value (the event trigger already
-- wrote it) and compare to the threshold set.
create or replace function public.notify_on_influence_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post integer;
  pre integer;
  thresholds integer[] := array[100, 500, 1000, 5000, 10000];
  t integer;
begin
  if new.delta <= 0 then return new; end if;
  select influence into post from public.profiles where id = new.recipient_id;
  if post is null then return new; end if;
  pre := post - new.delta;

  foreach t in array thresholds loop
    if pre < t and post >= t then
      insert into public.notifications
        (recipient_id, actor_id, type, subject_type, subject_id, data)
      values (
        new.recipient_id,
        null,
        'influence_milestone',
        'influence_milestone',
        null,
        jsonb_build_object('threshold', t)
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists influence_event_milestone on public.influence_events;
create trigger influence_event_milestone
  after insert on public.influence_events
  for each row
  execute function public.notify_on_influence_milestone();

-- Publish to realtime so the client can subscribe.
alter publication supabase_realtime add table public.notifications;
