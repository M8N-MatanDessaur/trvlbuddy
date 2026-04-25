-- Influence model v1 (locked for Phase 4).
--
-- Scoring:
--   image_liked           +5   (per like received on your photo)
--   image_commented       +3   (per top-level comment on your photo by someone else)
--   comment_replied       +1   (per reply to your comment by someone else)
--   self-actions           0   (already filtered in app + trigger below)
--   deletes reverse the delta (soft-delete for comments, hard delete for likes)
--
-- No time decay in v1. `influence_events` is the source of truth; the
-- denormalized profiles.influence column is kept in sync by triggers so the
-- UI can read a single number without aggregating per request.

create table if not exists public.influence_events (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  delta integer not null,
  subject_type text,
  subject_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists influence_events_recipient_created_idx
  on public.influence_events (recipient_id, created_at desc);

alter table public.influence_events enable row level security;

drop policy if exists "Own influence events readable" on public.influence_events;
create policy "Own influence events readable"
  on public.influence_events
  for select
  using (auth.uid() = recipient_id);

-- Replace the old +1-per-like trigger with the v1 scoring function.
create or replace function public.apply_activity_image_like_influence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  image_owner uuid;
begin
  if tg_op = 'INSERT' then
    select uploaded_by into image_owner from public.activity_images where id = new.image_id;
    if image_owner is not null and image_owner <> new.user_id then
      insert into public.influence_events
        (recipient_id, actor_id, event_type, delta, subject_type, subject_id)
        values (image_owner, new.user_id, 'image_liked', 5, 'activity_image', new.image_id);
      update public.profiles set influence = influence + 5 where id = image_owner;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    select uploaded_by into image_owner from public.activity_images where id = old.image_id;
    if image_owner is not null and image_owner <> old.user_id then
      insert into public.influence_events
        (recipient_id, actor_id, event_type, delta, subject_type, subject_id)
        values (image_owner, old.user_id, 'image_liked_reverted', -5, 'activity_image', old.image_id);
      update public.profiles set influence = greatest(influence - 5, 0) where id = image_owner;
    end if;
    return old;
  end if;

  return null;
end;
$$;

-- Comment influence: +3 for a top-level comment on someone else's photo,
-- +1 for a reply. Reverses on soft-delete (deleted_at set) so deleted
-- comments don't keep granting points.
create or replace function public.apply_activity_image_comment_influence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  image_owner uuid;
  parent_author uuid;
  recipient uuid;
  event text;
  delta_value integer;
  parent_deleted boolean;
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is not null then return new; end if;

    if new.parent_comment_id is null then
      select uploaded_by into image_owner from public.activity_images where id = new.image_id;
      if image_owner is null or image_owner = new.user_id then return new; end if;
      recipient := image_owner;
      event := 'image_commented';
      delta_value := 3;
    else
      select user_id into parent_author from public.activity_image_comments where id = new.parent_comment_id;
      if parent_author is null or parent_author = new.user_id then return new; end if;
      recipient := parent_author;
      event := 'comment_replied';
      delta_value := 1;
    end if;

    insert into public.influence_events
      (recipient_id, actor_id, event_type, delta, subject_type, subject_id)
      values (recipient, new.user_id, event, delta_value, 'activity_image_comment', new.id);
    update public.profiles set influence = influence + delta_value where id = recipient;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Only act on the transition from not-deleted -> deleted. Edits don't
    -- move influence.
    if old.deleted_at is null and new.deleted_at is not null then
      if new.parent_comment_id is null then
        select uploaded_by into image_owner from public.activity_images where id = new.image_id;
        if image_owner is null or image_owner = new.user_id then return new; end if;
        recipient := image_owner;
        delta_value := -3;
        event := 'image_commented_reverted';
      else
        select user_id into parent_author from public.activity_image_comments where id = new.parent_comment_id;
        if parent_author is null or parent_author = new.user_id then return new; end if;
        recipient := parent_author;
        delta_value := -1;
        event := 'comment_replied_reverted';
      end if;

      insert into public.influence_events
        (recipient_id, actor_id, event_type, delta, subject_type, subject_id)
        values (recipient, new.user_id, event, delta_value, 'activity_image_comment', new.id);
      update public.profiles set influence = greatest(influence + delta_value, 0) where id = recipient;
    end if;
    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists activity_image_comment_influence on public.activity_image_comments;
create trigger activity_image_comment_influence
  after insert or update on public.activity_image_comments
  for each row
  execute function public.apply_activity_image_comment_influence();
