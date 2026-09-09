-- A hard ceiling on what we can spend at Google, per day, for the whole app.
--
-- The per-user quota already stops one person hammering the API. It does not
-- stop the app as a whole costing more than intended, and it does not stop a
-- bug -- a render loop, a bad dependency array, a retry storm -- from doing in
-- an afternoon what took a $500 day last time.
--
-- So there is a global counter, and when it is spent the proxy serves stale
-- cache instead of calling Google. Not an alert after the fact: a stop.
--
-- Verified prices this is protecting against (2026-09-09): Nearby/Text Search
-- Enterprise is ~$35 per 1000 with only 1000 free events a month, so the
-- default ceiling below is deliberately low.

create table if not exists public.api_budget (
  provider   text not null,
  day        date not null,
  calls      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (provider, day)
);

comment on table public.api_budget is
  'Global per-day counter of paid upstream calls. Written only by service_role via consume_api_budget. This is a spend ceiling, not analytics.';

alter table public.api_budget enable row level security;
revoke all on public.api_budget from anon, authenticated;

-- Atomically claim one call against today's ceiling. Returns false when the
-- day is spent, in which case nothing is counted and the caller must not go
-- to the upstream API.
create or replace function public.consume_api_budget(
  p_provider text,
  p_daily_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_calls integer;
begin
  insert into public.api_budget as b (provider, day, calls, updated_at)
  values (p_provider, v_day, 0, now())
  on conflict (provider, day) do update set updated_at = now()
  returning b.calls into v_calls;

  if v_calls >= p_daily_limit then
    return false;
  end if;

  update public.api_budget
     set calls = calls + 1, updated_at = now()
   where provider = p_provider and day = v_day;

  return true;
end;
$$;

revoke all on function public.consume_api_budget(text, integer) from public, anon, authenticated;
grant execute on function public.consume_api_budget(text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- place_facts retention
-- ---------------------------------------------------------------------------

-- place_facts is what makes ranking free: rating and review counts are read
-- from here instead of re-asking Google. But the Places terms only allow
-- limited caching of content other than place ids, so these values are not
-- ours to keep indefinitely.
--
-- The compromise: the identity of a place (id, name, coordinates) is kept, and
-- the rated content is blanked once it is older than 30 days. A place that is
-- still being browsed gets refreshed by ordinary traffic long before that; one
-- nobody has looked at in a month loses its ratings and simply ranks on the
-- app's own social signals until someone visits it again.
create or replace function public.expire_stale_place_facts()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected integer;
begin
  update public.place_facts
     set rating = null,
         user_ratings_total = null,
         price_level = null
   where refreshed_at < now() - interval '30 days'
     and (rating is not null or user_ratings_total is not null or price_level is not null);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.expire_stale_place_facts() from public, anon, authenticated;
grant execute on function public.expire_stale_place_facts() to service_role;
