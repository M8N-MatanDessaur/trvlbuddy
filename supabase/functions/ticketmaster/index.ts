// Supabase Edge Function: ticketmaster
//
// Real ticketed events near a point, from the Ticketmaster Discovery API.
//
// Ticketmaster is free, but it is not free of consequences, so it follows the
// same discipline as the places function:
//
//   1. The key lives here and nowhere else. A VITE_ variable would be inlined
//      into the public bundle, where anyone could lift it and burn the quota.
//   2. You must be signed in.
//   3. There is ONE shared cache, and coordinates are snapped to a grid
//      before they are used, so everybody standing in the same part of town
//      shares one lookup instead of each browser spending its own.
//
// Ticketmaster's limits are 5,000 requests a day and 5 a second. The cache
// and the grid are what keep us far below both: a neighbourhood costs one
// request every six hours, however many people are looking.
//
// Only the fields the feed actually shows are returned. Ticketmaster's raw
// response is large and carries far more about the customer than the app has
// any reason to hold.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.3';

// Events change through the day, but not minute to minute.
const CACHE_TTL_HOURS = 6;

// Roughly 5.5km. Coarser than the places grid, because an event 5km away is
// still "on near you" in a way that a coffee shop 5km away is not.
const GRID_DEGREES = 0.05;

// A ceiling for the whole app per day. Not about money, about not being
// cut off. Well under Ticketmaster's 5,000.
const GLOBAL_DAILY_CALLS = 400;

const MAX_RADIUS_MILES = 50;
const PAGE_SIZE = 20;

function snap(value: number): number {
  return Math.round(value / GRID_DEGREES) * GRID_DEGREES;
}

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

async function cacheKey(params: Record<string, string>) {
  const canonical = 'ticketmaster|' +
    Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return 'ticketmaster:' +
    [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}

interface TrimmedEvent {
  id: string;
  name: string;
  /** "Tonight, 8:00 PM", or a date when it is further out. */
  time: string;
  /** Venue name and city, as one line. */
  location: string;
  /** What kind of thing it is, from Ticketmaster's own classification. */
  category: string;
  lat: number | null;
  lng: number | null;
  /** The event page. Ticketmaster's terms require linking back. */
  url: string;
  /** Ticketmaster supplies its own event artwork, free to use with the link. */
  imageUrl: string | null;
}

// Ticketmaster returns every image in a dozen crops. Take the widest one that
// is landscape-ish and big enough to fill a hero without going soft.
function bestImage(images: Array<{ url?: string; width?: number; height?: number }> = []) {
  const usable = images
    .filter((img) => img?.url && (img.width ?? 0) >= 600)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return usable[0]?.url ?? null;
}

function formatWhen(dates: any): string {
  const localDate: string | undefined = dates?.start?.localDate;
  const localTime: string | undefined = dates?.start?.localTime;
  if (!localDate) return 'Date to be announced';

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  let when: string;
  if (localDate === today) when = 'Today';
  else if (localDate === tomorrow) when = 'Tomorrow';
  else {
    const parsed = new Date(`${localDate}T12:00:00`);
    when = Number.isNaN(parsed.getTime())
      ? localDate
      : parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  if (!localTime) return when;
  const [h, m] = localTime.split(':').map(Number);
  if (!Number.isFinite(h)) return when;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${when}, ${hour12}:${String(m ?? 0).padStart(2, '0')} ${suffix}`;
}

function trim(payload: any): TrimmedEvent[] {
  const events = payload?._embedded?.events ?? [];
  const out: TrimmedEvent[] = [];
  for (const e of events) {
    if (!e?.id || !e?.name || !e?.url) continue;
    const venue = e?._embedded?.venues?.[0];
    const city = venue?.city?.name;
    const classification = e?.classifications?.[0];
    // Ticketmaster returns the literal string "Undefined" for unclassified
    // genres, which would otherwise be printed on the card as though it were
    // a category. Treat it as missing and fall back up the classification.
    const named = (value: unknown): string | null => {
      const text = typeof value === 'string' ? value.trim() : '';
      return text && text.toLowerCase() !== 'undefined' ? text : null;
    };
    out.push({
      id: String(e.id),
      name: String(e.name),
      time: formatWhen(e.dates),
      location: [venue?.name, city].filter(Boolean).join(', '),
      category:
        named(classification?.subGenre?.name) ||
        named(classification?.genre?.name) ||
        named(classification?.segment?.name) ||
        'Event',
      lat: Number(venue?.location?.latitude) || null,
      lng: Number(venue?.location?.longitude) || null,
      url: String(e.url),
      imageUrl: bestImage(e.images),
    });
  }

  // Ticketmaster falls back to stock artwork for events whose promoter never
  // supplied any, so six unrelated gigs come back wearing the same picture.
  // An image used by more than one event in a single response is by
  // definition not a picture of any of them: drop it and let those events
  // show their poster instead. No hardcoded list of placeholder URLs to
  // maintain, the repetition itself is the signal.
  const uses = new Map<string, number>();
  for (const e of out) {
    if (e.imageUrl) uses.set(e.imageUrl, (uses.get(e.imageUrl) ?? 0) + 1);
  }
  for (const e of out) {
    if (e.imageUrl && (uses.get(e.imageUrl) ?? 0) > 1) e.imageUrl = null;
  }

  return out;
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

  const KEY = Deno.env.get('TICKETMASTER_API_KEY');
  if (!KEY) {
    // Not configured is not an error the feed should shout about: it simply
    // has one source fewer. The client treats an empty list as "nothing here".
    return json({ configured: false, events: [] }, 200, corsHeaders);
  }

  let body: { lat?: unknown; lng?: unknown; radiusMiles?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'Expected JSON' }, 400, corsHeaders); }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ error: 'lat and lng are required' }, 400, corsHeaders);
  }
  const radius = Math.min(
    MAX_RADIUS_MILES,
    Math.max(1, Number.isFinite(Number(body.radiusMiles)) ? Number(body.radiusMiles) : 30),
  );

  // Only things that have not already happened, but snapped to the top of
  // the hour. The cache key is built from these parameters, so a start time
  // carrying minutes and seconds would make every single call a unique key
  // and the shared cache would never once be hit.
  const hourStart = new Date();
  hourStart.setUTCMinutes(0, 0, 0);

  // Snapped, so neighbours share one cache entry and one request.
  const params: Record<string, string> = {
    latlong: `${snap(lat).toFixed(3)},${snap(lng).toFixed(3)}`,
    radius: String(Math.round(radius)),
    unit: 'miles',
    size: String(PAGE_SIZE),
    sort: 'date,asc',
    startDateTime: hourStart.toISOString().slice(0, 19) + 'Z',
  };

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Shared cache. A hit costs nothing and does not touch the ceiling.
  const key = await cacheKey(params);
  const { data: cached } = await admin
    .from('places_cache')
    .select('payload, expires_at, hits')
    .eq('cache_key', key)
    .maybeSingle();

  if (cached && new Date(cached.expires_at) > new Date()) {
    admin.from('places_cache').update({ hits: (cached.hits ?? 0) + 1 }).eq('cache_key', key)
      .then(() => {}, () => {});
    return json({ cached: true, events: cached.payload }, 200, corsHeaders);
  }

  // 2. The app-wide ceiling. Spent means serve whatever we last had rather
  //    than risk being rate-limited out of the source entirely.
  const { data: withinBudget, error: budgetError } = await admin.rpc('consume_api_budget', {
    p_provider: 'ticketmaster',
    p_daily_limit: GLOBAL_DAILY_CALLS,
  });
  // A failed budget check must not become an unbudgeted call: treat anything
  // other than an explicit yes as spent.
  if (budgetError || withinBudget !== true) {
    return json({ cached: true, stale: true, events: cached?.payload ?? [] }, 200, corsHeaders);
  }

  // 3. Ask Ticketmaster.
  const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('apikey', KEY);

  let events: TrimmedEvent[];
  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      // A rate limit or an outage: last known answer beats an error screen.
      return json({ cached: Boolean(cached), stale: true, events: cached?.payload ?? [] }, 200, corsHeaders);
    }
    events = trim(await response.json());
  } catch {
    return json({ cached: Boolean(cached), stale: true, events: cached?.payload ?? [] }, 200, corsHeaders);
  }

  // 4. Store it for everyone else. An empty answer is cached too, so a quiet
  //    area is not re-asked every six seconds.
  const expires = new Date(Date.now() + CACHE_TTL_HOURS * 3600 * 1000).toISOString();
  await admin.from('places_cache').upsert({
    cache_key: key,
    op: 'ticketmaster',
    payload: events,
    fetched_at: new Date().toISOString(),
    expires_at: expires,
    hits: 0,
  }, { onConflict: 'cache_key' });

  return json({ cached: false, events }, 200, corsHeaders);
});
