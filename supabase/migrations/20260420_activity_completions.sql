-- Per-user "I did this" tracker for activities. Keyed by (user_id, activity_id)
-- so the same activity can be marked done by many users without colliding.
create table if not exists public.activity_completions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, activity_id)
);

create index if not exists activity_completions_user_idx
  on public.activity_completions (user_id);

alter table public.activity_completions enable row level security;

drop policy if exists "Activity completions are readable" on public.activity_completions;
create policy "Activity completions are readable"
  on public.activity_completions
  for select
  using (true);

drop policy if exists "Users can mark activities done" on public.activity_completions;
create policy "Users can mark activities done"
  on public.activity_completions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can clear their completion" on public.activity_completions;
create policy "Users can clear their completion"
  on public.activity_completions
  for delete
  using (auth.uid() = user_id);
