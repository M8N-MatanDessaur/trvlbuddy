// Supabase Edge Function: places
//
// Every Google Places / Geocoding call in the app comes through here.
//
// Why: the key used to ship in the browser bundle, unrestricted, and the app
// billed Google per user per action with only per-browser localStorage in
// front of it. That combination once produced a $500 bill in a day. Two
// changes fix it, and both need a server:
//
//   1. The key lives here and nowhere else.
//   2. There is ONE shared cache. A lookup paid for by one person serves
//      everybody, instead of every browser paying for its own copy.
//
// On top of that: you must be signed in, you get a per-user quota, and the
// operation list is closed so nobody can aim our key at an endpoint (or a
// field mask) we did not choose.
//
// Cache lifetimes are deliberately short-ish. The Places API terms allow
// limited caching of place content; place ids may be kept indefinitely, other
// content should not be hoarded. Search results expire in a day, place
// details in a week.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.3';

const HOURLY_LIMIT = 120;
const DAILY_LIMIT = 800;

// A ceiling for the whole app, per day, not per person. The per-user quota
// stops one person hammering the API; this stops the app as a whole -- or a
// render loop, or a retry storm -- from running up a bill nobody authorised.
// When it is spent we serve stale cache rather than calling Google.
//
// 300 misses a day is generous for a handful of users once locations are
// snapped to a grid and results live for a week: expected real usage is a few
// dozen. It is also about $10 a day if something were to spend all of it,
// which is a survivable mistake rather than a $500 one.
const GLOBAL_DAILY_CALLS = 300;

// Coordinates are snapped to a grid before they are used, for both the cache
// key AND the request sent to Google. Without this the cache barely works: two
// people standing twenty metres apart produce different keys and pay for two
// separate searches, which at 100 users a day is ~$595/month against ~$1 with
// snapping. 0.005 degrees is roughly 550m of latitude -- immaterial inside a
// 1.5km radius sweep, and it means everyone in a neighbourhood shares one
// paid lookup.
const GRID_DEGREES = 0.005;

function snap(value: number): number {
  return Math.round(value / GRID_DEGREES) * GRID_DEGREES;
}

// "45.50191,-73.56742" -> "45.5,-73.565"
function snapLatLngPair(pair: string): string {
  const [a, b] = pair.split(',').map((n) => Number(n.trim()));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return pair;
  return `${snap(a).toFixed(4)},${snap(b).toFixed(4)}`;
}

// The v1 endpoints carry coordinates inside a JSON circle.
function snapCircle(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const v = value as Record<string, any>;
  const centre = v?.circle?.center;
  if (centre && Number.isFinite(centre.latitude) && Number.isFinite(centre.longitude)) {
    return {
      ...v,
      circle: {
        ...v.circle,
        center: {
          latitude: Number(snap(centre.latitude).toFixed(4)),
          longitude: Number(snap(centre.longitude).toFixed(4)),
        },
      },
    };
  }
  return value;
}

type OpName =
  | 'textsearch' | 'nearbysearch' | 'details' | 'findplace'
  | 'autocomplete' | 'geocode' | 'searchText' | 'searchNearby';

// The field mask for the v1 endpoints, chosen here and not by the caller,
// because the mask is what decides the billing SKU. This set matches what
// the Nearby feed renders today.
//
// COST NOTE: rating, userRatingCount and priceLevel move these calls into
// Google's more expensive tier. They are kept because Nearby genuinely uses
// them (and the ranking work will need them), but if the bill ever needs
// cutting, this line is the lever -- and place_facts already stores those
// values, so previously-seen places keep their ratings for free.
const V1_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.currentOpeningHours.openNow',
  'places.regularOpeningHours.openNow',
  'places.types',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.businessStatus',
].join(',');

// Each operation declares where it goes, which parameters may pass through,
// and how long its answer stays fresh. A parameter not listed here is dropped:
// that is what stops a caller asking for an expensive field mask on our bill.
const OPS: Record<OpName, {
  kind: 'legacy' | 'v1';
  path: string;
  allow: string[];
  ttlSeconds: number;
  fieldMask?: string;
}> = {
  textsearch: {
    kind: 'legacy', path: 'https://maps.googleapis.com/maps/api/place/textsearch/json',
    allow: ['query', 'location', 'radius', 'opennow', 'type', 'language', 'region', 'minprice', 'maxprice', 'pagetoken'],
    ttlSeconds: 7 * 24 * 3600,
  },
  nearbysearch: {
    kind: 'legacy', path: 'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
    allow: ['location', 'radius', 'keyword', 'opennow', 'type', 'rankby', 'language', 'minprice', 'maxprice', 'pagetoken'],
    ttlSeconds: 7 * 24 * 3600,
  },
  details: {
    kind: 'legacy', path: 'https://maps.googleapis.com/maps/api/place/details/json',
    // `fields` is NOT passthrough: the field list decides the price of the
    // call, so the server picks it.
    allow: ['place_id', 'language'],
    ttlSeconds: 30 * 24 * 3600,
  },
  findplace: {
    kind: 'legacy', path: 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json',
    allow: ['input', 'inputtype', 'locationbias', 'language'],
    ttlSeconds: 30 * 24 * 3600,
  },
  autocomplete: {
    kind: 'legacy', path: 'https://maps.googleapis.com/maps/api/place/autocomplete/json',
    allow: ['input', 'types', 'components', 'location', 'radius', 'language', 'sessiontoken'],
    ttlSeconds: 7 * 24 * 3600,
  },
  geocode: {
    kind: 'legacy', path: 'https://maps.googleapis.com/maps/api/geocode/json',
    allow: ['latlng', 'address', 'language', 'result_type'],
    ttlSeconds: 30 * 24 * 3600, // a coordinate's country does not move
  },
  searchText: {
    kind: 'v1', path: 'https://places.googleapis.com/v1/places:searchText',
    allow: ['textQuery', 'pageSize', 'locationBias', 'locationRestriction', 'includedType', 'openNow', 'languageCode', 'rankPreference'],
    ttlSeconds: 7 * 24 * 3600,
    fieldMask: V1_FIELD_MASK,
  },
  searchNearby: {
    kind: 'v1', path: 'https://places.googleapis.com/v1/places:searchNearby',
    allow: ['locationRestriction', 'includedTypes', 'excludedTypes', 'maxResultCount', 'languageCode', 'rankPreference'],
    ttlSeconds: 7 * 24 * 3600,
    fieldMask: V1_FIELD_MASK,
  },
};

// The field list for legacy place details. Chosen once, here, so the cost of a
// details call is a decision and not something a caller can inflate.
const DETAILS_FIELDS =
  'place_id,name,formatted_address,address_components,geometry,rating,user_ratings_total,price_level,opening_hours,website,url,types,formatted_phone_number,business_status';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '*').split(',').map((s) => s.trim());

function cors(origin: string | null) {
  const allow = ALLOWED_ORIGINS.includes('*') || (origin && ALLOWED_ORIGINS.includes(origin))
    ? origin || '*' : ALLOWED_ORIGINS[0] || '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

// Stable cache key: sorted parameters so {a,b} and {b,a} are one entry.
async function cacheKey(op: string, params: Record<string, string>) {
  const canonical = op + '|' + Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return op + ':' + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}

// Pull whatever place facts a response contains into place_facts, so ranking
// has real columns to work with and never needs to re-ask Google.
function harvest(op: string, payload: any): any[] {
  const rows: any[] = [];
  const push = (r: any) => { if (r && r.place_id) rows.push(r); };

  if (op === 'textsearch' || op === 'nearbysearch') {
    for (const p of payload?.results ?? []) {
      push({
        place_id: p.place_id, name: p.name, formatted_address: p.formatted_address ?? p.vicinity,
        lat: p.geometry?.location?.lat ?? null, lng: p.geometry?.location?.lng ?? null,
        rating: p.rating ?? null, user_ratings_total: p.user_ratings_total ?? null,
        price_level: p.price_level ?? null, types: p.types ?? null,
        business_status: p.business_status ?? null, refreshed_at: new Date().toISOString(),
      });
    }
  } else if (op === 'details') {
    const p = payload?.result;
    if (p) push({
      place_id: p.place_id, name: p.name, formatted_address: p.formatted_address,
      lat: p.geometry?.location?.lat ?? null, lng: p.geometry?.location?.lng ?? null,
      rating: p.rating ?? null, user_ratings_total: p.user_ratings_total ?? null,
      price_level: p.price_level ?? null, types: p.types ?? null,
      business_status: p.business_status ?? null, refreshed_at: new Date().toISOString(),
    });
  } else if (op === 'searchText' || op === 'searchNearby') {
    for (const p of payload?.places ?? []) {
      const priceMap: Record<string, number> = {
        PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2,
        PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
      };
      push({
        place_id: p.id, name: p.displayName?.text, formatted_address: p.formattedAddress,
        lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null,
        rating: p.rating ?? null, user_ratings_total: p.userRatingCount ?? null,
        price_level: p.priceLevel ? priceMap[p.priceLevel] ?? null : null,
        types: p.types ?? null, business_status: p.businessStatus ?? null,
        refreshed_at: new Date().toISOString(),
      });
    }
  }
  return rows;
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

  // Signed in first, before anything about server configuration is revealed.
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in to use this' }, 401, corsHeaders);
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Invalid session' }, 401, corsHeaders);
  const userId = userData.user.id;

  const KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!KEY) return json({ error: 'Places is not configured' }, 500, corsHeaders);

  let body: { op?: string; params?: Record<string, unknown> };
  try { body = await req.json(); } catch { return json({ error: 'Expected JSON' }, 400, corsHeaders); }

  const op = String(body.op || '') as OpName;
  const spec = OPS[op];
  if (!spec) return json({ error: 'Unknown operation' }, 400, corsHeaders);

  // Keep only the parameters this operation declares. Anything else is
  // dropped rather than forwarded.
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.params ?? {})) {
    if (!spec.allow.includes(k)) continue;
    if (v === undefined || v === null || v === '') continue;
    params[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
  if (Object.keys(params).length === 0) {
    return json({ error: 'No usable parameters for this operation' }, 400, corsHeaders);
  }

  // Snap every coordinate to the grid, so neighbours share a cache entry.
  if (params.location) params.location = snapLatLngPair(params.location);
  if (params.latlng) params.latlng = snapLatLngPair(params.latlng);
  for (const field of ['locationBias', 'locationRestriction']) {
    if (!params[field]) continue;
    try {
      params[field] = JSON.stringify(snapCircle(JSON.parse(params[field])));
    } catch { /* leave it; the allow-list already vetted the shape */ }
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Shared cache. A hit costs nothing and does not touch the quota, so
  //    browsing cached ground is free for the user and for us.
  const key = await cacheKey(op, params);
  const { data: cached } = await admin
    .from('places_cache')
    .select('payload, expires_at, hits')
    .eq('cache_key', key)
    .maybeSingle();

  if (cached && new Date(cached.expires_at) > new Date()) {
    admin.from('places_cache').update({ hits: (cached.hits ?? 0) + 1 }).eq('cache_key', key)
      .then(() => {}, () => {});
    return json({ cached: true, payload: cached.payload }, 200, corsHeaders);
  }

  // The app's ceiling for the day. Checked before the per-user quota because
  // it protects the bill rather than the person: when it is spent, an expired
  // cache entry is a far better answer than either an error or a charge.
  const { data: withinBudget, error: budgetError } = await admin.rpc('consume_api_budget', {
    p_provider: 'google-places',
    p_daily_limit: GLOBAL_DAILY_CALLS,
  });
  if (budgetError) {
    console.error('budget check failed', budgetError.message);
    if (cached) return json({ cached: true, stale: true, payload: cached.payload }, 200, corsHeaders);
    return json({ error: 'Place lookup is unavailable right now' }, 503, corsHeaders);
  }
  if (withinBudget === false) {
    console.warn('daily google-places budget exhausted; serving stale or refusing');
    if (cached) return json({ cached: true, stale: true, payload: cached.payload }, 200, corsHeaders);
    return json(
      { error: 'Place lookups are paused for today. Everything already saved still works.' },
      503,
      { ...corsHeaders, 'Retry-After': '3600' },
    );
  }

  // 2. A miss is about to cost money, so it needs quota.
  const { data: allowed, error: quotaError } = await admin.rpc('consume_ai_quota', {
    p_user: userId, p_feature: 'places', p_hourly_limit: HOURLY_LIMIT, p_daily_limit: DAILY_LIMIT,
  });
  if (quotaError) {
    console.error('quota check failed', quotaError.message);
    return json({ error: 'Could not verify quota' }, 503, corsHeaders);
  }
  if (allowed === false) {
    return json({ error: 'You have reached the lookup limit for now. Try again later.' }, 429,
      { ...corsHeaders, 'Retry-After': '3600' });
  }

  // 3. Ask Google.
  let upstream: Response;
  try {
    if (spec.kind === 'legacy') {
      const qs = new URLSearchParams(params);
      if (op === 'details') qs.set('fields', DETAILS_FIELDS);
      qs.set('key', KEY);
      upstream = await fetch(`${spec.path}?${qs}`, { signal: AbortSignal.timeout(20_000) });
    } else {
      // The v1 endpoints take a JSON body; parameters that arrived as JSON
      // strings go back to objects.
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(params)) {
        try { payload[k] = JSON.parse(v); } catch { payload[k] = v; }
      }
      upstream = await fetch(spec.path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': KEY,
          'X-Goog-FieldMask': spec.fieldMask!,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      });
    }
  } catch (err) {
    console.error('places upstream failed', op, String(err));
    return json({ error: 'Place lookup is unavailable right now' }, 502, corsHeaders);
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    console.error('places returned', upstream.status, text.slice(0, 400));
    return json({ error: 'Place lookup is unavailable right now' }, upstream.status === 429 ? 429 : 502, corsHeaders);
  }

  let payload: any;
  try { payload = JSON.parse(text); } catch { return json({ error: 'Bad upstream response' }, 502, corsHeaders); }

  // 4. Store it for everyone else. A ZERO_RESULTS answer is cached too --
  //    "there is nothing here" is worth remembering, it was paid for.
  const expires = new Date(Date.now() + spec.ttlSeconds * 1000).toISOString();
  await admin.from('places_cache').upsert({
    cache_key: key, op, payload, fetched_at: new Date().toISOString(), expires_at: expires, hits: 0,
  }, { onConflict: 'cache_key' });

  const facts = harvest(op, payload);
  if (facts.length) {
    const { error: factErr } = await admin.from('place_facts').upsert(facts, { onConflict: 'place_id' });
    if (factErr) console.warn('place_facts upsert skipped:', factErr.message);
  }

  return json({ cached: false, payload }, 200, corsHeaders);
});
