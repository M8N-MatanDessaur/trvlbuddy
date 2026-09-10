// Supabase Edge Function: place-images
//
// A default image for each location in a feed, resolved once for everybody.
//
// The browser sends the locations it is about to show. This answers from our
// own table where it can, and only goes out to a source for the ones nobody
// has ever looked up. Whatever it finds, including finding nothing, is
// written back, so the next person to stand in this neighbourhood pays for
// none of it.
//
// This is only the DEFAULT image, for a location nobody has posted to yet.
// User photos live in activity_images and always win; the client prefers them
// and never asks here for a location that already has media.
//
// Sources, in order, all free and unkeyed:
//   1. Wikipedia by title     , exact-ish name match, batched 45 at a time
//   2. Wikipedia by coordinate, what is photographed around here
//   3. Wikimedia Commons      , for OSM POIs carrying wikimedia_commons=*
//
// A wrong photograph is worse than none, so every match has to clear a
// word-overlap check against the name we were actually looking for.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.3';

const TITLE_BATCH = 45;
const THUMB_WIDTH = 1000;
const GEO_GRID = 0.05;
const GEO_RADIUS_M = 10000;
// A location with no photograph today may have one next year, but not next
// week. Negatives stand for a month before they are looked at again.
const NEGATIVE_TTL_DAYS = 30;
const MAX_LOCATIONS = 60;
const MIN_CORRESPONDENCE = 0.5;

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

function significantWords(value: string): Set<string> {
  return new Set(
    value.toLowerCase()
      // Accents off, so "Marche" matches "Marché".
      .normalize('NFKD').replace(/\p{Diacritic}/gu, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
}

/**
 * Does this source title describe the thing we asked for?
 *
 * Word overlap only, deliberately. Requiring the query's most distinctive
 * word to appear was tried and reverted: it fixed "Notre-Dame Basilica"
 * matching a photo of Notre-Dame-de-Bon-Secours Chapel, but it broke
 * "Marche Jean-Talon", whose English article is titled "Jean-Talon Market" --
 * the distinctive word had simply been translated. Names cross languages too
 * often for word-picking to be safe.
 *
 * Ambiguity between two similarly-named places nearby is settled by
 * coordinates instead (see nearest-wins below), which is what actually
 * distinguishes a basilica from the chapel down the road.
 */
function matches(query: string, title: string): boolean {
  const a = significantWords(query);
  const b = significantWords(title);
  if (a.size === 0 || b.size === 0) return false;

  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / Math.min(a.size, b.size) >= MIN_CORRESPONDENCE;
}

/** Kilometres between two points. Rough is fine: this only has to tell
 *  "same part of the world" from "different city". */
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Place names repeat across the world, there is a Notre-Dame in a hundred
// cities. When the article carries coordinates and they are nowhere near the
// location we were asked about, it is the wrong place whatever its name says.
// The location's own coordinates come from Google, so this is tight: a
// building is where it is, not two kilometres away.
const MAX_MATCH_KM = 2;

// Placeholders a model reaches for when it does not know where something is.
const VAGUE = /^(various|multiple|several|citywide|city[- ]wide|downtown|city centre|city center|tbc|tba|tbd|online|venue|location)\b/i;

function usable(name: string | undefined | null): string | null {
  const n = name?.trim();
  if (!n || n.length < 4 || VAGUE.test(n)) return null;
  return n;
}

interface Resolved {
  url: string | null;
  source: string | null;
  source_title: string | null;
  source_url: string | null;
  /** Where the article says it is, when it says. Used to reject a same-named
   *  place in another city. */
  lat?: number | null;
  lng?: number | null;
}

const EMPTY: Resolved = { url: null, source: null, source_title: null, source_url: null };

/** Wikipedia, many titles at once. pilimit is load-bearing: without it only
 *  the first title comes back with a thumbnail. */
async function wikipediaByTitle(titles: string[]): Promise<Map<string, Resolved>> {
  const found = new Map<string, Resolved>();
  if (titles.length === 0) return found;

  const url = 'https://en.wikipedia.org/w/api.php?action=query' +
    `&titles=${encodeURIComponent(titles.join('|'))}` +
    `&prop=pageimages|coordinates&piprop=thumbnail&pithumbsize=${THUMB_WIDTH}&pilimit=50` +
    '&colimit=50&redirects=1&format=json&origin=*';

  let data: any;
  try {
    const res = await fetch(url);
    if (!res.ok) return found;
    data = await res.json();
  } catch {
    return found;
  }

  const alias = new Map<string, string>();
  for (const n of data?.query?.normalized ?? []) alias.set(n.from, n.to);
  for (const r of data?.query?.redirects ?? []) alias.set(r.from, r.to);
  const resolveTitle = (t: string) => {
    let cur = t;
    for (let i = 0; i < 4 && alias.has(cur); i += 1) cur = alias.get(cur)!;
    return cur;
  };

  const byTitle = new Map<string, any>();
  for (const p of Object.values(data?.query?.pages ?? {})) {
    const page = p as any;
    if (page?.title) byTitle.set(page.title, page);
  }

  for (const title of titles) {
    const page = byTitle.get(resolveTitle(title));
    const src = page?.thumbnail?.source;
    if (!src || page.missing !== undefined) continue;
    if (!matches(title, page.title)) continue;
    const coord = page?.coordinates?.[0];
    found.set(title, {
      url: src,
      source: 'wikipedia',
      source_title: page.title,
      source_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(page.title).replace(/ /g, '_'))}`,
      lat: Number.isFinite(coord?.lat) ? coord.lat : null,
      lng: Number.isFinite(coord?.lon) ? coord.lon : null,
    });
  }
  return found;
}

/** Every illustrated article near a point, in one request. This is the source
 *  that finds an old city gate or a covered market whose exact article name
 *  nobody would guess. */
async function wikipediaNearPoint(lat: number, lng: number) {
  const snap = (v: number) => (Math.round(v / GEO_GRID) * GEO_GRID).toFixed(3);
  const url = 'https://en.wikipedia.org/w/api.php?action=query' +
    `&generator=geosearch&ggscoord=${snap(lat)}%7C${snap(lng)}` +
    `&ggsradius=${GEO_RADIUS_M}&ggslimit=100` +
    `&prop=pageimages&piprop=thumbnail&pithumbsize=${THUMB_WIDTH}&pilimit=100` +
    '&format=json&origin=*';
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Object.values(data?.query?.pages ?? {})
      .map((p) => p as any)
      .filter((p) => p?.title && p?.thumbnail?.source)
      .map((p) => ({ title: String(p.title), url: String(p.thumbnail.source) }));
  } catch {
    return [];
  }
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

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in to use this' }, 401, corsHeaders);
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Invalid session' }, 401, corsHeaders);

  let body: { locations?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'Expected JSON' }, 400, corsHeaders); }

  const raw = Array.isArray(body.locations) ? body.locations : [];
  if (raw.length === 0) return json({ images: {} }, 200, corsHeaders);

  // locationId is the same slug activities uses. names are what to search
  // for, best first. lat/lng let the coordinate source run.
  const locations = raw.slice(0, MAX_LOCATIONS).map((l) => {
    const item = l as Record<string, unknown>;
    return {
      locationId: String(item.locationId ?? '').slice(0, 300),
      names: (Array.isArray(item.names) ? item.names : [])
        .map((n) => usable(typeof n === 'string' ? n : null))
        .filter((n): n is string => Boolean(n))
        .slice(0, 3),
      lat: Number(item.lat),
      lng: Number(item.lng),
    };
  }).filter((l) => l.locationId && l.names.length > 0);

  if (locations.length === 0) return json({ images: {} }, 200, corsHeaders);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Our own library first. This is the whole point: most of a feed should
  //    be answered from here without a single outbound request.
  const ids = locations.map((l) => l.locationId);
  const { data: known } = await admin
    .from('place_images')
    .select('location_id, url, source, source_title, source_url, resolved_at, hits')
    .in('location_id', ids);

  const images: Record<string, string> = {};
  const settled = new Set<string>();
  const negativeCutoff = Date.now() - NEGATIVE_TTL_DAYS * 86400_000;

  for (const row of known ?? []) {
    if (row.url) {
      images[row.location_id] = row.url;
      settled.add(row.location_id);
    } else if (new Date(row.resolved_at).getTime() > negativeCutoff) {
      // A fresh negative is an answer. Do not look again.
      settled.add(row.location_id);
    }
  }

  if (known && known.length > 0) {
    const seenIds = known.filter((r) => r.url).map((r) => r.location_id);
    if (seenIds.length > 0) {
      admin.rpc('bump_place_image_hits', { p_ids: seenIds }).then(() => {}, () => {});
    }
  }

  const todo = locations.filter((l) => !settled.has(l.locationId));
  if (todo.length === 0) {
    return json({ images, fromLibrary: Object.keys(images).length, resolved: 0 }, 200, corsHeaders);
  }

  // 2. Wikipedia by title, batched. One request per 45 names.
  const wanted: string[] = [];
  for (const l of todo) for (const n of l.names) if (!wanted.includes(n)) wanted.push(n);

  const titleHits = new Map<string, Resolved>();
  for (let i = 0; i < wanted.length; i += TITLE_BATCH) {
    const found = await wikipediaByTitle(wanted.slice(i, i + TITLE_BATCH));
    for (const [k, v] of found) titleHits.set(k, v);
  }

  // An image belongs to one location only: three venues on the same street
  // would otherwise all show the same photograph, which reads as a bug.
  const claimed = new Set<string>(Object.values(images));
  const rows: Array<Record<string, unknown>> = [];

  const unresolved: typeof todo = [];
  for (const l of todo) {
    const hasCoords = Number.isFinite(l.lat) && Number.isFinite(l.lng);

    // Every name this location is willing to be illustrated by, then the
    // nearest of them wins. Nearest is what tells a basilica from the chapel
    // down the road, where the words cannot.
    const candidates = l.names
      .map((n) => titleHits.get(n))
      .filter((c): c is Resolved => Boolean(c?.url) && !claimed.has(c!.url!))
      .map((c) => ({
        hit: c,
        km: hasCoords && c.lat != null && c.lng != null
          ? distanceKm(l.lat, l.lng, c.lat, c.lng)
          : null,
      }))
      // An article that says where it is, somewhere else, is the wrong place.
      .filter((c) => c.km === null || c.km <= MAX_MATCH_KM)
      .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));

    const hit = candidates[0]?.hit;
    if (!hit) { unresolved.push(l); continue; }
    claimed.add(hit.url!);
    images[l.locationId] = hit.url!;
    // lat/lng are for choosing, not for storing: place_images has no such
    // columns, and including them makes the whole upsert fail, which took
    // the negative rows down with it and made every repeat call re-resolve.
    rows.push({
      location_id: l.locationId,
      url: hit.url,
      source: hit.source,
      source_title: hit.source_title,
      source_url: hit.source_url,
      query_name: l.names[0],
      resolved_at: new Date().toISOString(),
    });
  }

  // 3. What is photographed around here, for the ones the name lookup missed.
  const withCoords = unresolved.filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng));
  if (withCoords.length > 0) {
    const pool = await wikipediaNearPoint(withCoords[0].lat, withCoords[0].lng);
    for (const l of unresolved) {
      const match = pool.find(
        (p) => !claimed.has(p.url) && l.names.some((n) => matches(n, p.title)),
      );
      if (!match) continue;
      claimed.add(match.url);
      images[l.locationId] = match.url;
      rows.push({
        location_id: l.locationId,
        url: match.url,
        source: 'wikipedia',
        source_title: match.title,
        source_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(match.title.replace(/ /g, '_'))}`,
        query_name: l.names[0],
        resolved_at: new Date().toISOString(),
      });
    }
  }

  // 4. Record the negatives too. This is what stops the same fruitless
  //    lookups running for every visitor, forever.
  for (const l of todo) {
    if (images[l.locationId]) continue;
    rows.push({
      location_id: l.locationId, ...EMPTY,
      query_name: l.names[0], resolved_at: new Date().toISOString(),
    });
  }

  if (rows.length > 0) {
    await admin.from('place_images').upsert(rows, { onConflict: 'location_id' });
  }

  return json({
    images,
    resolved: rows.filter((r) => r.url).length,
    recordedEmpty: rows.filter((r) => !r.url).length,
  }, 200, corsHeaders);
});
