-- A shared, server-side cache in front of the Google Places API.
--
-- This is the cost fix, and it is the reason the app exists in its current
-- shape: a $500 Google bill in a single day. The old arrangement billed Google
-- per user per action and cached only in each browser's localStorage, so two
-- people looking at the same street paid twice and ten people paid ten times.
-- Everything now goes through the `places` edge function, which reads this
-- table first and only calls Google on a miss. One call serves everybody.
--
-- It is also the abuse fix. The API key used to ship in the browser bundle,
-- unrestricted -- anyone could read it off the site and spend the budget. The
-- key now lives only in the edge function.

-- ---------------------------------------------------------------------------
-- Raw response cache, keyed by operation + normalised parameters
-- ---------------------------------------------------------------------------

create table if not exists public.places_cache (
  cache_key    text primary key,
  op           text not null,
  payload      jsonb not null,
  fetched_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  hits         integer not null default 0
);

comment on table public.places_cache is
  'Shared cache of Google Places/Geocoding responses. Written only by service_role via the places edge function. Cache lifetimes are kept short enough to respect the Places API terms on caching content.';

create index if not exists places_cache_expires_idx on public.places_cache (expires_at);

alter table public.places_cache enable row level security;
revoke all on public.places_cache from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Place facts, extracted from those responses
-- ---------------------------------------------------------------------------

-- The ranking signals live in real columns, not buried in the payload blob,
-- because Nearby currently ranks by proximity alone and shows whatever is
-- physically close (a children's playground next to a great bar). Tuning that
-- needs rating, review volume, price and category to be queryable -- and it
-- has to be tunable with zero further Google calls, or every experiment costs
-- money.
create table if not exists public.place_facts (
  place_id            text primary key,
  name                text,
  formatted_address   text,
  lat                 double precision,
  lng                 double precision,
  rating              numeric(2,1),
  user_ratings_total  integer,
  price_level         smallint,
  types               text[],
  business_status     text,
  refreshed_at        timestamptz not null default now()
);

comment on table public.place_facts is
  'Structured, queryable facts about places, harvested from cached Google responses. Ranking reads from here so tuning the Nearby feed costs nothing.';

create index if not exists place_facts_rating_idx
  on public.place_facts (rating desc nulls last, user_ratings_total desc nulls last);
create index if not exists place_facts_types_idx on public.place_facts using gin (types);

alter table public.place_facts enable row level security;

-- Readable by the app (it is public business information and the app needs it
-- to render), written only by the service role through the edge function.
drop policy if exists place_facts_read_all on public.place_facts;
create policy place_facts_read_all on public.place_facts for select using (true);
revoke all on public.place_facts from anon, authenticated;
grant select on public.place_facts to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------------

create or replace function public.purge_expired_places_cache()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  removed integer;
begin
  delete from public.places_cache where expires_at < now();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.purge_expired_places_cache() from public, anon, authenticated;
grant execute on function public.purge_expired_places_cache() to service_role;
