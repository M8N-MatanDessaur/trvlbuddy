create table if not exists public.activity_image_likes (
  image_id uuid not null references public.activity_images(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (image_id, user_id)
);

alter table public.activity_image_likes enable row level security;

drop policy if exists "Activity image likes are readable" on public.activity_image_likes;
create policy "Activity image likes are readable"
  on public.activity_image_likes
  for select
  using (true);

drop policy if exists "Users can like activity images" on public.activity_image_likes;
create policy "Users can like activity images"
  on public.activity_image_likes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their activity image likes" on public.activity_image_likes;
create policy "Users can remove their activity image likes"
  on public.activity_image_likes
  for delete
  using (auth.uid() = user_id);

create or replace function public.ignore_own_activity_image_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  image_owner uuid;
begin
  select uploaded_by
    into image_owner
    from public.activity_images
    where id = new.image_id;

  if image_owner = new.user_id then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists activity_image_like_ignore_own on public.activity_image_likes;
create trigger activity_image_like_ignore_own
  before insert on public.activity_image_likes
  for each row
  execute function public.ignore_own_activity_image_like();

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
    select uploaded_by
      into image_owner
      from public.activity_images
      where id = new.image_id;

    if image_owner is not null and image_owner <> new.user_id then
      update public.profiles
        set influence = influence + 1
        where id = image_owner;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    select uploaded_by
      into image_owner
      from public.activity_images
      where id = old.image_id;

    if image_owner is not null and image_owner <> old.user_id then
      update public.profiles
        set influence = greatest(influence - 1, 0)
        where id = image_owner;
    end if;

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists activity_image_like_influence on public.activity_image_likes;
create trigger activity_image_like_influence
  after insert or delete on public.activity_image_likes
  for each row
  execute function public.apply_activity_image_like_influence();

create table if not exists public.activity_image_comments (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.activity_images(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists activity_image_comments_image_created_idx
  on public.activity_image_comments (image_id, created_at);

alter table public.activity_image_comments enable row level security;

drop policy if exists "Activity image comments are readable" on public.activity_image_comments;
create policy "Activity image comments are readable"
  on public.activity_image_comments
  for select
  using (true);

drop policy if exists "Users can comment on activity images" on public.activity_image_comments;
create policy "Users can comment on activity images"
  on public.activity_image_comments
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their activity image comments" on public.activity_image_comments;
create policy "Users can remove their activity image comments"
  on public.activity_image_comments
  for delete
  using (auth.uid() = user_id);
