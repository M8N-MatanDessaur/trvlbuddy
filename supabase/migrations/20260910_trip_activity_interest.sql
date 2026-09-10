-- Who is actually coming to each thing on the trip.
--
-- The plan already knows what is on it and who ticked it off afterwards. What
-- it cannot say is the thing groups actually argue about beforehand: is
-- everyone up for this, and who is going.
--
-- One row per person per activity, saying "in" or "out". That is both halves
-- of the question at once -- a vote and an attendance list are the same
-- gesture, and splitting them would mean voting yes to something you are not
-- going to. Silence is not a no: someone who has not said anything has no row,
-- and the UI says "3 in" rather than "3 of 5", because a plan that shames the
-- people who have not opened the app yet is worse than one that waits.
create table if not exists public.trip_activity_interest (
  trip_activity_id uuid not null
    references public.trip_activities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- 'in' or 'out'. Changing your mind updates the row; withdrawing entirely
  -- deletes it, which is different from saying no.
  state text not null check (state in ('in', 'out')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_activity_id, user_id)
);

create index if not exists trip_activity_interest_activity_idx
  on public.trip_activity_interest (trip_activity_id);
create index if not exists trip_activity_interest_user_idx
  on public.trip_activity_interest (user_id);

alter table public.trip_activity_interest enable row level security;

-- Everything here is scoped to the trip the activity belongs to: only the
-- people on that trip can see it or take part.
create or replace function public.is_member_of_activity_trip(p_activity_id uuid)
returns boolean
language sql
security definer
stable
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.trip_activities ta
    where ta.id = p_activity_id
      and public.is_trip_member(ta.trip_id)
  );
$$;

drop policy if exists "Trip members see who is coming" on public.trip_activity_interest;
create policy "Trip members see who is coming"
  on public.trip_activity_interest
  for select
  using (public.is_member_of_activity_trip(trip_activity_id));

drop policy if exists "Trip members say whether they are coming" on public.trip_activity_interest;
create policy "Trip members say whether they are coming"
  on public.trip_activity_interest
  for insert
  with check (
    auth.uid() = user_id
    and public.is_member_of_activity_trip(trip_activity_id)
  );

drop policy if exists "You can change your mind" on public.trip_activity_interest;
create policy "You can change your mind"
  on public.trip_activity_interest
  for update
  using (auth.uid() = user_id and public.is_member_of_activity_trip(trip_activity_id))
  with check (auth.uid() = user_id);

drop policy if exists "You can take it back" on public.trip_activity_interest;
create policy "You can take it back"
  on public.trip_activity_interest
  for delete
  using (auth.uid() = user_id);

create or replace function public.touch_trip_activity_interest()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trip_activity_interest_touch on public.trip_activity_interest;
create trigger trip_activity_interest_touch
  before update on public.trip_activity_interest
  for each row
  execute function public.touch_trip_activity_interest();
