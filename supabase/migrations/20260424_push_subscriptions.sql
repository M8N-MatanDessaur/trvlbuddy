-- Web Push subscriptions. Each row represents one browser/device. A user
-- can have many (phone + desktop + incognito). The endpoint is effectively
-- unique across browsers so we key on it.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Own push subs readable" on public.push_subscriptions;
create policy "Own push subs readable"
  on public.push_subscriptions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Own push subs writable" on public.push_subscriptions;
create policy "Own push subs writable"
  on public.push_subscriptions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Own push subs deletable" on public.push_subscriptions;
create policy "Own push subs deletable"
  on public.push_subscriptions
  for delete
  using (auth.uid() = user_id);
