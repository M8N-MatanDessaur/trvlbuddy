drop policy if exists "trips_owner_insert" on public.trips;
create policy "trips_owner_insert"
  on public.trips
  for insert
  with check (auth.uid() = owner_id);

drop policy if exists "trips_owner_read" on public.trips;
create policy "trips_owner_read"
  on public.trips
  for select
  using (auth.uid() = owner_id);

drop policy if exists "trips_owner_update" on public.trips;
create policy "trips_owner_update"
  on public.trips
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "trips_owner_delete" on public.trips;
create policy "trips_owner_delete"
  on public.trips
  for delete
  using (auth.uid() = owner_id);
