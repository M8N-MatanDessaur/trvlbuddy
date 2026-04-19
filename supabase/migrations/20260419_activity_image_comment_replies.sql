alter table public.activity_image_comments
  add column if not exists parent_comment_id uuid references public.activity_image_comments(id) on delete cascade,
  add column if not exists updated_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists activity_image_comments_parent_created_idx
  on public.activity_image_comments (parent_comment_id, created_at);

create or replace function public.validate_activity_image_comment_parent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_image_id uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  if new.parent_comment_id = new.id then
    raise exception 'A comment cannot reply to itself';
  end if;

  select image_id
    into parent_image_id
    from public.activity_image_comments
    where id = new.parent_comment_id;

  if parent_image_id is null then
    raise exception 'Parent comment does not exist';
  end if;

  if parent_image_id <> new.image_id then
    raise exception 'Reply must belong to the same image as its parent comment';
  end if;

  return new;
end;
$$;

drop trigger if exists activity_image_comment_parent_validate on public.activity_image_comments;
create trigger activity_image_comment_parent_validate
  before insert or update of image_id, parent_comment_id on public.activity_image_comments
  for each row
  execute function public.validate_activity_image_comment_parent();

create or replace function public.touch_activity_image_comment_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists activity_image_comment_touch_updated_at on public.activity_image_comments;
create trigger activity_image_comment_touch_updated_at
  before update on public.activity_image_comments
  for each row
  execute function public.touch_activity_image_comment_updated_at();

drop policy if exists "Users can edit their activity image comments" on public.activity_image_comments;
create policy "Users can edit their activity image comments"
  on public.activity_image_comments
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
