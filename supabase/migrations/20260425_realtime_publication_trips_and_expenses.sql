-- Enable Supabase Realtime postgres_changes for the tables our Phase 3
-- co-trip presence work subscribes to. trip_members was already in the
-- publication (member-strip realtime predates this), so we only need to
-- add the two newcomers. Wrapped in a guarded DO block so the migration
-- is idempotent on environments where these were added by hand.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_expenses'
  ) then
    execute 'alter publication supabase_realtime add table public.trip_expenses';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trips'
  ) then
    execute 'alter publication supabase_realtime add table public.trips';
  end if;
end $$;
