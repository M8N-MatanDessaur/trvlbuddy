-- Fire send-push on every new notification row.
--
-- This replaces the commented-out template in
-- 20260424_push_webhook_template.sql, which was never run -- which is why
-- push has never delivered anything: the function was not deployed and
-- nothing called it.
--
-- Authentication is a dedicated shared secret in x-webhook-secret, not the
-- service role key. send-push takes recipient_id, title and body straight
-- from the payload, so an unauthenticated version of it is a way to push
-- arbitrary text to anyone's phone under our name. Using a purpose-made
-- secret also means this endpoint is not a second place the service role key
-- is accepted, and rotating it does not touch anything else.
--
-- Replace <PROJECT_REF> and <PUSH_WEBHOOK_SECRET> before running. The secret
-- must match the edge function secret:
--   supabase secrets set PUSH_WEBHOOK_SECRET=... --project-ref <ref>

create extension if not exists pg_net;

create or replace function public.notify_send_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_name text;
  body_text text;
begin
  select display_name into actor_name from public.profiles where id = new.actor_id;
  actor_name := coalesce(actor_name, 'Someone');

  case new.type
    when 'image_liked' then body_text := actor_name || ' liked your photo';
    when 'image_commented' then body_text := actor_name || ' commented on your photo';
    when 'comment_replied' then body_text := actor_name || ' replied to your comment';
    when 'comment_mentioned' then body_text := actor_name || ' mentioned you';
    when 'influence_milestone' then body_text := 'Influence milestone unlocked';
    else body_text := 'New notification';
  end case;

  -- timeout_milliseconds is not optional: pg_net defaults to 1000ms, an edge
  -- function cold start is slower, and the failure is invisible because
  -- net.http_post only queues the request. Check net._http_response, never
  -- the caller's return value, when this looks like it is not firing.
  perform net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '<PUSH_WEBHOOK_SECRET>'
    ),
    body := jsonb_build_object(
      'recipient_id', new.recipient_id,
      'type', new.type,
      'title', 'TravelBuddy',
      'body', body_text,
      'url', '/notifications',
      'tag', new.id::text
    ),
    timeout_milliseconds := 30000
  );

  return new;
end;
$$;

-- Never let a push failure roll back the notification itself: the row in the
-- table is the source of truth and the in-app list must still work if the
-- push leg is broken.
drop trigger if exists notifications_send_push on public.notifications;
create trigger notifications_send_push
  after insert on public.notifications
  for each row
  execute function public.notify_send_push();
