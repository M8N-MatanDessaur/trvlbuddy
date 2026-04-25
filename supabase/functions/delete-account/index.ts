// Supabase Edge Function: delete-account
// Authenticates the caller via their JWT, then deletes every user-owned
// record and finally the auth row. Runs as service-role so it can bypass
// RLS for the cascade. Callers prove identity with their session token;
// we NEVER accept a user_id from the request body.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.3';

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
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return json({ error: 'Server not configured' }, 500, corsHeaders);
  }

  // Identify the caller by decoding their JWT with the anon key client.
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Missing auth token' }, 401, corsHeaders);

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    return json({ error: 'Invalid session' }, 401, corsHeaders);
  }
  const userId = userData.user.id;

  // Service-role client for the cascade.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Storage: remove every object the user uploaded. List the prefixes we
    // use ("{activityId}/{userId}-..." under activity-images), match the
    // filename prefix, and delete in batches.
    const { data: images } = await admin
      .from('activity_images')
      .select('storage_path')
      .eq('uploaded_by', userId);
    const paths = (images || []).map((r: { storage_path: string }) => r.storage_path);
    for (let i = 0; i < paths.length; i += 50) {
      const chunk = paths.slice(i, i + 50);
      if (chunk.length > 0) {
        await admin.storage.from('activity-images').remove(chunk).catch(() => {});
      }
    }

    // Relational cascade. Order matters only where FKs aren't cascading.
    // Most trvlbuddy tables already ON DELETE CASCADE from auth.users, but
    // we still scrub explicitly so nothing orphans if that's ever changed.
    await admin.from('activity_image_comments').delete().eq('user_id', userId);
    await admin.from('activity_image_likes').delete().eq('user_id', userId);
    await admin.from('activity_images').delete().eq('uploaded_by', userId);
    await admin.from('activity_completions').delete().eq('user_id', userId);
    await admin.from('activity_votes').delete().eq('user_id', userId);

    // Trips: owner rows and membership rows. Leave shared trips intact for
    // other owners if that table schema supports co-ownership.
    await admin.from('trip_members').delete().eq('user_id', userId).catch(() => {});
    await admin.from('trips').delete().eq('owner_id', userId).catch(() => {});

    // Profile row last so anything with a FK to profiles is gone first.
    await admin.from('profiles').delete().eq('id', userId);

    // And finally the auth row itself.
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      return json({ error: deleteAuthError.message }, 500, corsHeaders);
    }

    return json({ ok: true }, 200, corsHeaders);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500, corsHeaders);
  }
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
