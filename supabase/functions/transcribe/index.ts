// Supabase Edge Function: transcribe
// Relays a client audio blob to OpenAI Whisper using a server-held OPENAI_API_KEY.
// The client never sees the key.

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
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const incoming = await req.formData().catch(() => null);
  if (!incoming) {
    return new Response(JSON.stringify({ error: 'expected multipart/form-data' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const file = incoming.get('file');
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: 'missing file field' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const MAX_BYTES = 25 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return new Response(JSON.stringify({ error: 'file too large (25MB max)' }), {
      status: 413,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const outbound = new FormData();
  outbound.append('file', file, file.name || 'audio.webm');
  outbound.append('model', 'whisper-1');

  const upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: outbound,
  });

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      ...corsHeaders,
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
    },
  });
});
