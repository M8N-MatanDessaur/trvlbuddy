// Supabase Edge Function: gemini
//
// Why this exists: the app used to call Gemini straight from the browser with
// VITE_GEMINI_API_KEY, which Vite inlines into the shipped bundle. The key was
// readable by anyone who opened the site, on an API that cannot be restricted
// by domain, so anyone could spend the project's quota. All Gemini traffic now
// goes through here and the key never leaves the server.
//
// Three rules this function enforces that a browser cannot:
//   1. You must be signed in. The caller proves identity with their session
//      token; we never accept a user id from the body.
//   2. You get a quota. Per-user, per-hour and per-day, counted in Postgres so
//      the limit holds across function instances.
//   3. The model is ours to choose. The client sends only the request body, so
//      nobody can point our key at a more expensive model.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.3';

// Pinned server side. The client cannot influence this.
const MODEL = 'gemini-3.1-flash-lite-preview';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Vision requests carry an inline base64 image, so the cap is generous but
// finite: enough for a compressed photo, not enough to be interesting to abuse.
const MAX_BODY_BYTES = 6 * 1024 * 1024;

// Per-user quota. Hourly stops a runaway loop, daily stops a slow drain.
const HOURLY_LIMIT = 60;
const DAILY_LIMIT = 400;

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

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = cors(origin);

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return json({ error: 'Server not configured' }, 500, corsHeaders);
  }

  // 1. Who is calling. Anonymous callers get nothing.
  //
  // This runs before the GEMINI_API_KEY check on purpose: a stranger should be
  // told to sign in, not told which server-side secrets are missing.
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in to use this' }, 401, corsHeaders);

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Invalid session' }, 401, corsHeaders);
  const userId = userData.user.id;

  // Only now is it safe to talk about server configuration.
  if (!GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY not configured' }, 500, corsHeaders);
  }

  // 2. Body: size-capped, and shaped like a generateContent request.
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: 'Request too large' }, 413, corsHeaders);
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Expected JSON' }, 400, corsHeaders);
  }
  if (!body || !Array.isArray((body as { contents?: unknown }).contents)) {
    return json({ error: 'Expected a contents array' }, 400, corsHeaders);
  }

  // 3. Quota, counted in Postgres so it survives cold starts and holds across
  // instances. Fails closed: if the counter errors we do not spend the key.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: allowed, error: quotaError } = await admin.rpc('consume_ai_quota', {
    p_user: userId,
    p_feature: 'gemini',
    p_hourly_limit: HOURLY_LIMIT,
    p_daily_limit: DAILY_LIMIT,
  });
  if (quotaError) {
    console.error('quota check failed', quotaError.message);
    return json({ error: 'Could not verify quota' }, 503, corsHeaders);
  }
  if (allowed === false) {
    return json(
      { error: 'You have reached the AI limit for now. Try again later.' },
      429,
      { ...corsHeaders, 'Retry-After': '3600' },
    );
  }

  // 4. Forward. The key is attached here and only here.
  let upstream: Response;
  try {
    upstream = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    console.error('gemini upstream failed', String(err));
    return json({ error: 'The assistant is unavailable right now' }, 502, corsHeaders);
  }

  const text = await upstream.text();

  // Never pass an upstream error body through verbatim: Google's errors can
  // echo request details, and a 4xx from them is not the caller's business.
  if (!upstream.ok) {
    console.error('gemini returned', upstream.status, text.slice(0, 500));
    const status = upstream.status === 429 ? 429 : 502;
    return json({ error: 'The assistant is unavailable right now' }, status, corsHeaders);
  }

  return new Response(text, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
