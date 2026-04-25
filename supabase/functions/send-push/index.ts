// Supabase Edge Function: send-push
// Expects a payload of { recipient_id, type, title, body, url, tag }.
// Looks up every active push_subscriptions row for that user and fans out
// the Web Push Protocol POST using the stored VAPID keys. On 404 / 410
// from the browser vendor we treat the subscription as dead and delete it.
//
// Trigger wiring (separate from this function):
//   CREATE TRIGGER notifications_webpush AFTER INSERT ON public.notifications
//   FOR EACH ROW EXECUTE FUNCTION net.http_post_sync(...)
// or invoke from a DB webhook. Either way, ship the fields from NEW.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.3';
import webpush from 'https://esm.sh/web-push@3.6.7';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '*')
  .split(',')
  .map((s) => s.trim());

function cors(origin: string | null) {
  const allow =
    ALLOWED_ORIGINS.includes('*') || (origin && ALLOWED_ORIGINS.includes(origin))
      ? origin || '*'
      : ALLOWED_ORIGINS[0] || '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = cors(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
  const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
  const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@trvlbuddy.com';
  if (!SUPABASE_URL || !SERVICE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: 'Server not configured' }, 500, corsHeaders);
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  let payload: {
    recipient_id?: string;
    type?: string;
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, corsHeaders);
  }

  const recipientId = payload.recipient_id;
  if (!recipientId) return json({ error: 'recipient_id required' }, 400, corsHeaders);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', recipientId);

  if (error) return json({ error: error.message }, 500, corsHeaders);
  if (!subs || subs.length === 0) return json({ ok: true, delivered: 0 }, 200, corsHeaders);

  const body = JSON.stringify({
    title: payload.title || 'TravelBuddy',
    body: payload.body || '',
    url: payload.url || '/notifications',
    tag: payload.tag,
  });

  let delivered = 0;
  const deadEndpoints: string[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
        { TTL: 60 * 60 * 24 },
      );
      delivered += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        deadEndpoints.push(sub.endpoint);
      } else {
        console.warn('web-push failure', err);
      }
    }
  }

  if (deadEndpoints.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', deadEndpoints);
  }

  return json({ ok: true, delivered, removed: deadEndpoints.length }, 200, corsHeaders);
});

function json(body: unknown, status: number, extraHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}
