-- The AI quota gains a feature key.
--
-- 20260909_ai_quota_and_email_privacy.sql keyed ai_usage on user_id alone,
-- which was fine while the gemini function was the only thing counting. The
-- transcribe function needs its own budget -- a minute of audio through
-- Whisper costs very differently from a text prompt -- and sharing one counter
-- would let one feature starve the other.
--
-- Feature is a plain text label ('gemini', 'transcribe') rather than an enum so
-- adding a third AI endpoint needs no migration.

-- Rebuild rather than migrate the key: the counters are ephemeral by design
-- (they roll hourly and daily) so there is nothing worth preserving.
drop table if exists public.ai_usage;

create table public.ai_usage (
  user_id      uuid not null references auth.users (id) on delete cascade,
  feature      text not null,
  hour_bucket  timestamptz not null,
  day_bucket   date not null,
  hour_count   integer not null default 0,
  day_count    integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (user_id, feature)
);

comment on table public.ai_usage is
  'Per-user, per-feature AI request counters. Written only by service_role via consume_ai_quota.';

alter table public.ai_usage enable row level security;

-- No policies on purpose: only service_role (which bypasses RLS) touches this.
-- A user cannot read or reset their own counter.
revoke all on public.ai_usage from anon, authenticated;

-- The old single-counter signature is gone; drop it so nothing calls it by
-- accident and silently gets a different limit.
drop function if exists public.consume_ai_quota(uuid, integer, integer);

create or replace function public.consume_ai_quota(
  p_user uuid,
  p_feature text,
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
  if p_feature is null or length(trim(p_feature)) = 0 then
    raise exception 'feature is required';
  end if;

  insert into public.ai_usage as u (user_id, feature, hour_bucket, day_bucket, hour_count, day_count, updated_at)
  values (p_user, p_feature, v_hour, v_day, 0, 0, now())
  on conflict (user_id, feature) do update
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
   where user_id = p_user and feature = p_feature;

  return true;
end;
$$;

revoke all on function public.consume_ai_quota(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, text, integer, integer) to service_role;
