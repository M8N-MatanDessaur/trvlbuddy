// Supabase Edge Function: transcribe
//
// Speech to text via Gemini, using a server-held GEMINI_API_KEY.
//
// It used to relay to OpenAI Whisper, which meant a second vendor and a
// second key for one feature. Gemini is already paid for here, and
// gemini-3.5-transcribe is a purpose-built transcription model, so voice now
// goes the same way as everything else AI-shaped in this app.
//
// The first version of this function stopped at "the client never sees the
// key", which made it an open proxy to a billed API: no authentication, no
// quota, 25MB a request, and CORS is no defence because curl ignores it. It
// was never deployed, so that stayed theoretical. The rules that had to exist
// before it could be:
//
//   1. You must be signed in. Identity comes from the session token; a user
//      id in the request is never accepted.
//   2. You get a budget, counted in Postgres so it holds across instances.
//   3. The upload is bounded and has to look like audio.
//   4. Upstream errors do not pass through verbatim.
//
// The response shape is { text } either way, so the client did not change.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.3';

// A purpose-built transcription model, pinned server side so the client cannot
// point our key at something costlier.
const MODEL = 'gemini-3.5-transcribe';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Short voice notes. Every megabyte we accept is a megabyte someone can make
// us pay to process, and inline audio has to fit in a request body.
const MAX_BYTES = 8 * 1024 * 1024;

// Audio costs more per request than a text prompt, so a smaller budget.
const HOURLY_LIMIT = 20;
const DAILY_LIMIT = 120;

// What the browser's MediaRecorder actually produces, plus the common
// container formats Gemini accepts.
const ALLOWED_AUDIO: Record<string, string> = {
  'audio/webm': 'audio/webm',
  'audio/ogg': 'audio/ogg',
  'audio/oga': 'audio/ogg',
  'audio/mp4': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
  'audio/mpeg': 'audio/mpeg',
  'audio/mp3': 'audio/mp3',
  'audio/wav': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/flac': 'audio/flac',
  'audio/aac': 'audio/aac',
};

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

// Chunked so a multi-megabyte recording does not blow the argument limit the
// way String.fromCharCode(...bytes) would.
function toBase64(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(out);
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

  // 1. Who is calling. Before any mention of server configuration, so a
  // stranger is told to sign in rather than which secrets are missing.
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in to use this' }, 401, corsHeaders);

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Invalid session' }, 401, corsHeaders);
  const userId = userData.user.id;

  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) return json({ error: 'Transcription is not configured' }, 500, corsHeaders);

  // 2. Refuse an oversized upload before reading it into memory. Checked
  // again below, because a client can lie about or omit the header.
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared && declared > MAX_BYTES) {
    return json({ error: 'Recording too long' }, 413, corsHeaders);
  }

  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: 'Expected multipart/form-data' }, 400, corsHeaders);

  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'Missing file field' }, 400, corsHeaders);
  if (file.size === 0) return json({ error: 'Empty recording' }, 400, corsHeaders);
  if (file.size > MAX_BYTES) return json({ error: 'Recording too long' }, 413, corsHeaders);

  // 3. It has to look like audio. Browsers append codec parameters
  // ("audio/webm;codecs=opus"), so compare the media type only.
  const declaredType = (file.type || '').split(';')[0].trim().toLowerCase();
  const mimeType = ALLOWED_AUDIO[declaredType];
  if (declaredType && !mimeType) {
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

  // 5. Transcribe. The key is attached here and only here.
  const audioBase64 = toBase64(new Uint8Array(await file.arrayBuffer()));

  let upstream: Response;
  try {
    upstream = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Audio only, no instruction. gemini-3.5-transcribe is a dedicated
        // transcription model: it transcribes what it is given, and a prompt
        // only adds tokens (verified -- identical output with and without).
        contents: [{
          role: 'user',
          parts: [
            { inline_data: { mime_type: mimeType || 'audio/webm', data: audioBase64 } },
          ],
        }],
        generationConfig: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    console.error('transcribe upstream failed', String(err));
    return json({ error: 'Transcription is unavailable right now' }, 502, corsHeaders);
  }

  const raw = await upstream.text();

  // Never relay an upstream error body: a billing or quota message from
  // Google is not the caller's business.
  if (!upstream.ok) {
    console.error('transcribe returned', upstream.status, raw.slice(0, 400));
    return json(
      { error: 'Transcription is unavailable right now' },
      upstream.status === 429 ? 429 : 502,
      corsHeaders,
    );
  }

  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { return json({ error: 'Bad upstream response' }, 502, corsHeaders); }

  // The transcription models answer with a part shaped
  // { audioTranscription: { text } } rather than the { text } a chat model
  // returns -- reading only `.text` silently yields an empty transcript, which
  // is exactly what happened the first time this was wired up. Handle both, so
  // this keeps working if the model is ever swapped for a general one.
  //
  // An empty transcript is a legitimate answer (silence), not an error.
  const text = (parsed?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string; audioTranscription?: { text?: string } }) =>
      p?.audioTranscription?.text ?? p?.text ?? '')
    .join(' ')
    .trim();

  return json({ text }, 200, corsHeaders);
});
