// Supabase Edge Function: transcribe
//
// Relays a client audio blob to OpenAI Whisper using a server-held
// OPENAI_API_KEY, so the client never sees the key.
//
// The first version of this stopped there, which made it an open proxy to a
// billed API: no authentication, no quota, and CORS is no defence because
// curl ignores it. Anyone could have posted 25MB of audio in a loop and put it
// on our bill. It was never deployed, so that stayed theoretical -- these are
// the rules that had to exist before it could be.
//
//   1. You must be signed in. Identity comes from the session token; we never
//      accept a user id from the request.
//   2. You get a budget. Per-user, per-hour and per-day, counted in Postgres
//      so it holds across function instances.
//   3. The file is bounded and has to look like audio.
//   4. Upstream errors do not pass through verbatim.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.3';

// Whisper's own ceiling is 25MB. This is lower on purpose: the client records
// short voice notes, and every megabyte we accept is a megabyte someone can
// make us pay to process.
const MAX_BYTES = 8 * 1024 * 1024;

// Audio costs more per request than a text prompt, so the budget is smaller
// than the gemini one.
const HOURLY_LIMIT = 20;
const DAILY_LIMIT = 120;

const ALLOWED_AUDIO = [
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/mp3',
  'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a', 'audio/flac',
];

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
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return json({ error: 'Server not configured' }, 500, corsHeaders);
  }

  // 1. Who is calling. This runs before the OPENAI_API_KEY check so a stranger
  // is told to sign in rather than which secrets are missing.
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in to use this' }, 401, corsHeaders);

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Invalid session' }, 401, corsHeaders);
  const userId = userData.user.id;

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return json({ error: 'Transcription is not configured' }, 500, corsHeaders);
  }

  // 2. Content-Length first, so an oversized upload is refused before we read
  // it into memory. The real size is checked again below, because a client can
  // lie about or omit the header.
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared && declared > MAX_BYTES) {
    return json({ error: 'Recording too long' }, 413, corsHeaders);
  }

  const incoming = await req.formData().catch(() => null);
  if (!incoming) return json({ error: 'Expected multipart/form-data' }, 400, corsHeaders);

  const file = incoming.get('file');
  if (!(file instanceof File)) return json({ error: 'Missing file field' }, 400, corsHeaders);
  if (file.size === 0) return json({ error: 'Empty recording' }, 400, corsHeaders);
  if (file.size > MAX_BYTES) return json({ error: 'Recording too long' }, 413, corsHeaders);

  // 3. It has to look like audio. Browsers append codec parameters, so compare
  // the media type only.
  const mime = (file.type || '').split(';')[0].trim().toLowerCase();
  if (mime && !ALLOWED_AUDIO.includes(mime)) {
    return json({ error: 'Unsupported audio format' }, 415, corsHeaders);
  }

  // 4. Budget. Fails closed: if the counter errors we do not spend the key.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: allowed, error: quotaError } = await admin.rpc('consume_ai_quota', {
    p_user: userId,
    p_feature: 'transcribe',
    p_hourly_limit: HOURLY_LIMIT,
    p_daily_limit: DAILY_LIMIT,
  });
  if (quotaError) {
    console.error('quota check failed', quotaError.message);
    return json({ error: 'Could not verify quota' }, 503, corsHeaders);
  }
  if (allowed === false) {
    return json(
      { error: 'You have reached the voice limit for now. Try again later.' },
      429,
      { ...corsHeaders, 'Retry-After': '3600' },
    );
  }

  // 5. Forward. The key is attached here and only here.
  const outbound = new FormData();
  outbound.append('file', file, file.name || 'audio.webm');
  outbound.append('model', 'whisper-1');

  let upstream: Response;
  try {
    upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: outbound,
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    console.error('whisper upstream failed', String(err));
    return json({ error: 'Transcription is unavailable right now' }, 502, corsHeaders);
  }

  const text = await upstream.text();

  // Never relay an upstream error body: it can echo request details and a
  // billing or quota message from OpenAI is not the caller's business.
  if (!upstream.ok) {
    console.error('whisper returned', upstream.status, text.slice(0, 500));
    const status = upstream.status === 429 ? 429 : 502;
    return json({ error: 'Transcription is unavailable right now' }, status, corsHeaders);
  }

  return new Response(text, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
  });
});
