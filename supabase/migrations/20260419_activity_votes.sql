create table if not exists public.activity_votes (
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create index if not exists activity_votes_activity_idx on public.activity_votes (activity_id);

alter table public.activity_votes enable row level security;

drop policy if exists "Activity votes are readable" on public.activity_votes;
create policy "Activity votes are readable"
  on public.activity_votes
  for select
  using (true);

drop policy if exists "Users can cast their activity vote" on public.activity_votes;
create policy "Users can cast their activity vote"
  on public.activity_votes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their activity vote" on public.activity_votes;
create policy "Users can update their activity vote"
  on public.activity_votes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can clear their activity vote" on public.activity_votes;
create policy "Users can clear their activity vote"
  on public.activity_votes
  for delete
  using (auth.uid() = user_id);

create or replace function public.touch_activity_vote_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists activity_votes_touch_updated_at on public.activity_votes;
create trigger activity_votes_touch_updated_at
  before update on public.activity_votes
  for each row
  execute function public.touch_activity_vote_updated_at();

create or replace view public.activity_vote_scores as
  select
    activity_id,
    coalesce(sum(value)::int, 0) as score,
    count(*) filter (where value = 1)::int as upvotes,
    count(*) filter (where value = -1)::int as downvotes
  from public.activity_votes
  group by activity_id;

grant select on public.activity_vote_scores to anon, authenticated;
