-- Keep-alive, so the free-plan project does not pause.
--
-- Supabase pauses a free project after 7 days without activity. This writes a
-- single heartbeat row and makes one request through the project's own API
-- gateway, which is the activity that counts.
--
-- Daily, not weekly, on purpose. At a 7-day interval one missed run pauses the
-- project, and a cron job can look healthy while failing every time: pg_net
-- defaults to a 1000ms timeout that an edge function or a cold gateway blows
-- through, and cron.job_run_details still reports "succeeded" because
-- net.http_post only queues the request. Daily gives six spare days of margin.
--
-- To check it is really landing, read the response, never the run details:
--   select status_code, error_msg, created from net._http_response
--   order by created desc limit 5;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- The heartbeat itself. One row, updated in place: this is database write
-- activity that does not depend on pg_net working at all.
create table if not exists public.keepalive (
  id         smallint primary key default 1,
  beat_at    timestamptz not null default now(),
  beats      bigint not null default 0,
  constraint keepalive_single_row check (id = 1)
);

comment on table public.keepalive is
  'Single-row heartbeat touched daily by the trvlbuddy-keepalive cron job so the free-plan project is never idle for 7 days. Not user data.';

insert into public.keepalive (id, beat_at, beats)
values (1, now(), 0)
on conflict (id) do nothing;

-- Nobody in the browser needs this.
alter table public.keepalive enable row level security;
revoke all on public.keepalive from anon, authenticated;

create or replace function public.keepalive_beat()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.keepalive
     set beat_at = now(),
         beats = beats + 1
   where id = 1;
$$;

revoke all on function public.keepalive_beat() from public, anon, authenticated;
grant execute on function public.keepalive_beat() to service_role;

-- The job itself. Replace <PROJECT_REF> and <ANON_KEY> before running, or run
-- it from the SQL editor where you can paste them once. This is what was
-- scheduled on the live project on 2026-09-09.
--
-- /auth/v1/health answers 200 given the anon key and 401 without one, so a
-- non-200 in net._http_response means something is genuinely wrong rather
-- than merely unauthorised.
select cron.schedule(
  'trvlbuddy-keepalive',
  '12 7 * * *',
  $$
  select public.keepalive_beat();
  select net.http_get(
    url := 'https://<PROJECT_REF>.supabase.co/auth/v1/health',
    headers := '{"apikey":"<ANON_KEY>"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- To inspect or remove:
--   select jobname, schedule, active from cron.job;
--   select status_code, error_msg, created from net._http_response order by created desc limit 5;
--   select beats, beat_at from public.keepalive;
--   select cron.unschedule('trvlbuddy-keepalive');
