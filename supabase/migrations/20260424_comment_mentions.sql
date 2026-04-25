-- @-mentions in comments.
--
-- A mention is encoded in the comment body as `@[display_name](user_id)` at
-- insert time. The client extracts the user_id tokens and writes one row
-- per mention. A trigger turns that into a `comment_mentioned` notification
-- so mentioned users hear about it without needing a separate poll.
--
-- Keyed by (comment_id, user_id) so the same user can only be mentioned
-- once per comment no matter how many times the token appears.

create table if not exists public.comment_mentions (
  comment_id uuid not null references public.activity_image_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists comment_mentions_user_created_idx
  on public.comment_mentions (user_id, created_at desc);

alter table public.comment_mentions enable row level security;

drop policy if exists "Comment mentions are readable" on public.comment_mentions;
create policy "Comment mentions are readable"
  on public.comment_mentions
  for select
  using (true);

drop policy if exists "Comment authors can record mentions" on public.comment_mentions;
create policy "Comment authors can record mentions"
  on public.comment_mentions
  for insert
  with check (
    exists (
      select 1
      from public.activity_image_comments c
      where c.id = comment_id
        and c.user_id = auth.uid()
    )
  );

create or replace function public.notify_on_comment_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  comment_row public.activity_image_comments;
  preview text;
begin
  if tg_op <> 'INSERT' then return new; end if;
  select * into comment_row from public.activity_image_comments where id = new.comment_id;
  if comment_row is null then return new; end if;
  if comment_row.user_id = new.user_id then return new; end if;  -- no self-mention pings

  preview := substring(comment_row.body from 1 for 140);

  insert into public.notifications
    (recipient_id, actor_id, type, subject_type, subject_id, data)
  values (
    new.user_id,
    comment_row.user_id,
    'comment_mentioned',
    'activity_image_comment',
    comment_row.id,
    jsonb_build_object('image_id', comment_row.image_id, 'preview', preview)
  );

  return new;
end;
$$;

drop trigger if exists comment_mention_notify on public.comment_mentions;
create trigger comment_mention_notify
  after insert on public.comment_mentions
  for each row
  execute function public.notify_on_comment_mention();
