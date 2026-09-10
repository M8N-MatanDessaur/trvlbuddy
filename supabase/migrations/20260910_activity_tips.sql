-- Tips: what people say about a place, and what others say back.
--
-- Comments already exist, but they hang off a photograph, so a place nobody
-- has photographed cannot be talked about at all -- and the first thing you
-- want to say about somewhere is usually not about a picture of it. A tip
-- belongs to the place.
--
-- Deliberately not built here: anything that adds up to a person. No tip
-- count on a profile, no score that follows an author around, no way to
-- accumulate standing by posting a lot. A tip is useful where it stands, to
-- someone who is standing there, or it is not useful.

create table if not exists public.activity_tips (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- A reply to another tip. One level only, enforced below: a thread you
  -- have to unfold twice on a phone is a thread nobody reads.
  parent_id uuid references public.activity_tips(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 600),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists activity_tips_activity_created_idx
  on public.activity_tips (activity_id, created_at desc);
create index if not exists activity_tips_parent_idx
  on public.activity_tips (parent_id, created_at);

-- One level of replies.
create or replace function public.activity_tips_depth_guard()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not null then
    if exists (
      select 1 from public.activity_tips t
      where t.id = new.parent_id and t.parent_id is not null
    ) then
      raise exception 'a reply cannot be replied to';
    end if;
    -- A reply belongs to the same place as the tip it answers.
    if not exists (
      select 1 from public.activity_tips t
      where t.id = new.parent_id and t.activity_id = new.activity_id
    ) then
      raise exception 'a reply must be on the same activity as its parent';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists activity_tips_depth on public.activity_tips;
create trigger activity_tips_depth
  before insert or update on public.activity_tips
  for each row
  execute function public.activity_tips_depth_guard();

alter table public.activity_tips enable row level security;

drop policy if exists "Tips are readable" on public.activity_tips;
create policy "Tips are readable"
  on public.activity_tips
  for select
  using (true);

drop policy if exists "Users can post their own tips" on public.activity_tips;
create policy "Users can post their own tips"
  on public.activity_tips
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can edit their own tips" on public.activity_tips;
create policy "Users can edit their own tips"
  on public.activity_tips
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own tips" on public.activity_tips;
create policy "Users can remove their own tips"
  on public.activity_tips
  for delete
  using (auth.uid() = user_id);

-- "Helpful", not "liked".
--
-- One per person per tip, so it counts people rather than enthusiasm, and it
-- lives on the tip rather than on the tipper. What it is for is ordering the
-- tips on this place -- nothing else reads it.
create table if not exists public.activity_tip_helpful (
  tip_id uuid not null references public.activity_tips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tip_id, user_id)
);

create index if not exists activity_tip_helpful_tip_idx
  on public.activity_tip_helpful (tip_id);

alter table public.activity_tip_helpful enable row level security;

drop policy if exists "Helpful marks are readable" on public.activity_tip_helpful;
create policy "Helpful marks are readable"
  on public.activity_tip_helpful
  for select
  using (true);

drop policy if exists "Users can mark a tip helpful" on public.activity_tip_helpful;
create policy "Users can mark a tip helpful"
  on public.activity_tip_helpful
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can take back a helpful mark" on public.activity_tip_helpful;
create policy "Users can take back a helpful mark"
  on public.activity_tip_helpful
  for delete
  using (auth.uid() = user_id);
