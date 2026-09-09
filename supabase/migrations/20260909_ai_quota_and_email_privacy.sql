-- Two independent security fixes.
--
-- 1. ai_usage + consume_ai_quota: a per-user quota for the gemini edge
--    function. Counting in Postgres rather than in the function means the
--    limit holds across cold starts and across concurrent instances.
--
-- 2. profiles stops carrying an email address at all.

-- ---------------------------------------------------------------------------
-- 1. AI quota
-- ---------------------------------------------------------------------------

create table if not exists public.ai_usage (
  user_id      uuid not null references auth.users (id) on delete cascade,
  hour_bucket  timestamptz not null,
  day_bucket   date not null,
  hour_count   integer not null default 0,
  day_count    integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (user_id)
);

comment on table public.ai_usage is
  'Per-user AI request counters for the gemini edge function. Written only by service_role via consume_ai_quota.';

alter table public.ai_usage enable row level security;

-- No policies on purpose: nothing but service_role (which bypasses RLS)
-- should read or write this. A user cannot see or reset their own counter.
revoke all on public.ai_usage from anon, authenticated;

-- Atomically roll the windows and increment. Returns false when either limit
-- is already reached, in which case nothing is counted.
create or replace function public.consume_ai_quota(
  p_user uuid,
  p_hourly_limit integer,
  p_daily_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hour timestamptz := date_trunc('hour', now());
  v_day  date        := (now() at time zone 'utc')::date;
  v_hour_count integer;
  v_day_count  integer;
begin
  insert into public.ai_usage as u (user_id, hour_bucket, day_bucket, hour_count, day_count, updated_at)
  values (p_user, v_hour, v_day, 0, 0, now())
  on conflict (user_id) do update
    set hour_bucket = case when u.hour_bucket = v_hour then u.hour_bucket else v_hour end,
        hour_count  = case when u.hour_bucket = v_hour then u.hour_count  else 0 end,
        day_bucket  = case when u.day_bucket  = v_day  then u.day_bucket  else v_day end,
        day_count   = case when u.day_bucket  = v_day  then u.day_count   else 0 end,
        updated_at  = now()
  returning u.hour_count, u.day_count into v_hour_count, v_day_count;

  if v_hour_count >= p_hourly_limit or v_day_count >= p_daily_limit then
    return false;
  end if;

  update public.ai_usage
     set hour_count = hour_count + 1,
         day_count  = day_count + 1,
         updated_at = now()
   where user_id = p_user;

  return true;
end;
$$;

-- Only the service role calls this. Revoking from the client roles means a
-- signed-in user cannot burn their own quota without going through the
-- function, and cannot call it for somebody else's user id.
revoke all on function public.consume_ai_quota(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 2. profiles stops carrying an email address at all
-- ---------------------------------------------------------------------------

-- The read policy on profiles is `using (true)` for anon, which is fine for a
-- public profile, but the table carried an email column -- so anyone holding
-- the anon key (it ships in the browser bundle) could dump every user's
-- address with a single request. Verified against the live project.
--
-- Two narrower approaches were tried against the live database first:
--   * `revoke select (email)` alone does NOTHING. A table-level GRANT SELECT
--     already covers every column and column privileges are additive, not
--     subtractive, so the revoke is silently a no-op.
--   * Revoking the table grant and granting back a column list DOES block the
--     column, but PostgREST then answers `select('*')` with
--     `42501 permission denied for table profiles` rather than filtering to
--     the permitted columns -- which breaks every already-loaded bundle.
--
-- So the column goes instead. Email belongs to auth.users and was only
-- duplicated here; the client reads its own from the auth session. Dropping it
-- leaves `select('*')` working, so an old tab degrades to "no email" rather
-- than erroring, and there is no second copy left to leak.

-- The signup trigger writes email into profiles, so it has to stop first or
-- every new signup fails. Its display_name fallback was the email address as
-- well, which would have put an address into a world-readable column for
-- anyone signing up without a name; that becomes a neutral label.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      'Traveler'
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

alter table public.profiles drop column if exists email;

-- PostgREST caches the schema, so the dropped column lingers in its cache
-- without this.
notify pgrst, 'reload schema';
