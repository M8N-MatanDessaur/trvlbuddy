create or replace function public.add_trip_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (trip_id, user_id) do update
    set role = excluded.role;

  return new;
end;
$$;

drop trigger if exists trips_add_owner_member on public.trips;
create trigger trips_add_owner_member
  after insert on public.trips
  for each row
  execute function public.add_trip_owner_member();

insert into public.trip_members (trip_id, user_id, role)
select id, owner_id, 'owner'
from public.trips
where owner_id is not null
on conflict (trip_id, user_id) do update
  set role = excluded.role;

drop policy if exists "trip_members_read" on public.trip_members;
create policy "trip_members_read"
  on public.trip_members
  for select
  using (public.is_trip_member(trip_id));

drop policy if exists "trips_member_read" on public.trips;
create policy "trips_member_read"
  on public.trips
  for select
  using (public.is_trip_member(id));

drop policy if exists "trips_member_upd" on public.trips;
create policy "trips_member_upd"
  on public.trips
  for update
  using (public.is_trip_member(id))
  with check (public.is_trip_member(id));
