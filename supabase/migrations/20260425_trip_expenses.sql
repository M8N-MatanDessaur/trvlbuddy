-- Per-trip expense ledger. Manual-entry first (auto-pulled bank/card data
-- is out of scope here); the goal is "did this trip stay on budget?" and
-- "where is my money going?", visible to every member of the trip.
--
-- Visibility model mirrors trip_activities: members of the trip can read
-- the whole ledger, but only the entry's author can edit / delete it.
-- That keeps the budget honest while still letting groups split and
-- attribute charges (e.g. "Sara paid for the Airbnb").

create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null check (char_length(currency) = 3),
  category text not null,
  note text,
  occurred_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists trip_expenses_trip_idx
  on public.trip_expenses (trip_id, occurred_at desc, created_at desc);
create index if not exists trip_expenses_user_idx
  on public.trip_expenses (user_id);

alter table public.trip_expenses enable row level security;

-- Owner OR member of the trip can read every expense on it.
drop policy if exists "Trip expenses readable by trip members" on public.trip_expenses;
create policy "Trip expenses readable by trip members"
  on public.trip_expenses
  for select
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_expenses.trip_id
        and (
          t.owner_id = auth.uid()
          or exists (
            select 1 from public.trip_members m
            where m.trip_id = t.id and m.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "Members can add expenses" on public.trip_expenses;
create policy "Members can add expenses"
  on public.trip_expenses
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.trips t
      where t.id = trip_expenses.trip_id
        and (
          t.owner_id = auth.uid()
          or exists (
            select 1 from public.trip_members m
            where m.trip_id = t.id and m.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "Authors can edit own expenses" on public.trip_expenses;
create policy "Authors can edit own expenses"
  on public.trip_expenses
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Authors can delete own expenses" on public.trip_expenses;
create policy "Authors can delete own expenses"
  on public.trip_expenses
  for delete
  using (auth.uid() = user_id);
