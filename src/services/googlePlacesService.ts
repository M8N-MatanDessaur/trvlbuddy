// Shared Google Places helpers used by trip-generation enrichment AND the
// Map tab's on-the-fly fallback. Far more accurate than Photon at matching a
// named place ("Tim Hortons", "Gyeongbokgung Palace") to the right city.

const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';

// Quota / auth gate. When Google returns OVER_QUERY_LIMIT or REQUEST_DENIED,
// we short-circuit every subsequent call for the rest of the session so we
// stop hammering the API (and let the UI surface the actual reason).
let _placesBlocked: { reason: 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED'; message: string } | null = null;

// Negative cache: query strings Google said don't exist. Stored in
// localStorage with a 7-day TTL so repeat map opens for the same trip don't
// re-burn quota on activities Google has already said it can't find.
//
// v2 abandons the v1 entries that got poisoned by treating quota / auth
// errors as "this query has no result" -- old caches would short-circuit
// every lookup forever after the first OVER_QUERY_LIMIT.
const NEG_KEY = 'places-negative-v2';
const NEG_TTL_MS = 1000 * 60 * 60 * 24 * 7;

// Best-effort cleanup of the poisoned predecessor on module load.
if (typeof localStorage !== 'undefined') {
  try { localStorage.removeItem('places-negative-v1'); } catch { /* noop */ }
}

function negKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function readNeg(): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(NEG_KEY) || '{}'); } catch { return {}; }
}

function writeNeg(cache: Record<string, number>) {
  try { localStorage.setItem(NEG_KEY, JSON.stringify(cache)); } catch { /* quota */ }
}

function isNegativelyCached(query: string): boolean {
  const cache = readNeg();
  const k = negKey(query);
  const ts = cache[k];
  return !!ts && Date.now() - ts < NEG_TTL_MS;
}

function recordMiss(query: string) {
  const cache = readNeg();
  cache[negKey(query)] = Date.now();
  writeNeg(cache);
}

export function clearPlacesNegativeCache() {
  try { localStorage.removeItem(NEG_KEY); } catch { /* noop */ }
}

export interface PlacesBlocked {
  reason: 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED';
  message: string;
}

export function getPlacesBlocked(): PlacesBlocked | null {
  return _placesBlocked;
}

function maybeBlock(status: string | undefined, errorMessage: string | undefined) {
  if (status === 'OVER_QUERY_LIMIT' || status === 'REQUEST_DENIED') {
    if (!_placesBlocked) {
      _placesBlocked = { reason: status, message: errorMessage || '' };
      console.error('[places] blocked further calls -', status, errorMessage);
    }
  }
}

export interface GooglePlaceHit {
  place_id: string;
  lat: number;
  lng: number;
  formatted_address?: string;
}

export interface FindPlaceOptions {
  // Bias the search to a coordinate + radius. Typical use: pass the trip's
  // city center so the query is anchored to the right region.
  near?: { lat: number; lng: number; radiusMeters?: number };
}

/**
 * Find Place from Text (basic SKU, $17 / 1K). Returns the first candidate or
 * null. We bias to a location when given so a name that exists in many
 * countries (chains, common words) lands in the right one.
 */
export async function findPlaceFromText(
  query: string,
  options: FindPlaceOptions = {},
): Promise<GooglePlaceHit | null> {
  if (!GOOGLE_PLACES_API_KEY) return null;
  if (_placesBlocked) return null;
  const trimmed = query.trim();
  if (!trimmed) return null;
  if (isNegativelyCached(trimmed)) return null;

  const params = new URLSearchParams({
    input: trimmed,
    inputtype: 'textquery',
    fields: 'place_id,geometry,formatted_address',
    key: GOOGLE_PLACES_API_KEY,
  });
  if (options.near) {
    const radius = options.near.radiusMeters ?? 50000; // 50km default
    params.set('locationbias', `circle:${radius}@${options.near.lat},${options.near.lng}`);
  }

  try {
    // Route through the Netlify proxy /api/places/* (defined in netlify.toml)
    // so the call doesn't hit Google directly from the browser -- Google's
    // legacy Places API doesn't send CORS headers, so direct calls fail.
    const url = `/api/places/findplacefromtext/json?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[places] findPlace HTTP', res.status, 'for', query);
      return null;
    }
    const data: {
      status?: string;
      error_message?: string;
      candidates?: Array<{
        place_id?: string;
        geometry?: { location?: { lat: number; lng: number } };
        formatted_address?: string;
      }>;
    } = await res.json();
    const status = data.status;
    if (status && status !== 'OK' && status !== 'ZERO_RESULTS') {
      console.warn('[places] findPlace status', status, data.error_message || '', 'for', query);
      maybeBlock(status, data.error_message);
      // Quota / auth / config errors are NOT a property of this query --
      // don't poison the negative cache or the user gets stuck with empty
      // results forever after the first error.
      return null;
    }
    const cand = data.candidates?.[0];
    if (!cand?.place_id || !cand.geometry?.location) {
      // Genuine "Google considered this and found nothing" -- safe to cache.
      recordMiss(trimmed);
      return null;
    }
    return {
      place_id: cand.place_id,
      lat: cand.geometry.location.lat,
      lng: cand.geometry.location.lng,
      formatted_address: cand.formatted_address,
    };
  } catch (err) {
    console.error('[places] findPlace failed for', query, err);
    return null;
  }
}

/**
 * Text Search ($32 / 1K) -- more permissive than Find Place, better at
 * matching descriptive AI-generated names ("Cozy cafe near Han River") to
 * real places. Use as a fallback after findPlaceFromText returns null.
 */
export async function searchPlaceByText(
  query: string,
  options: FindPlaceOptions = {},
): Promise<GooglePlaceHit | null> {
  if (!GOOGLE_PLACES_API_KEY) return null;
  if (_placesBlocked) return null;
  const trimmed = query.trim();
  if (!trimmed) return null;

  const params = new URLSearchParams({
    query: trimmed,
    key: GOOGLE_PLACES_API_KEY,
  });
  if (options.near) {
    const radius = options.near.radiusMeters ?? 50000;
    params.set('location', `${options.near.lat},${options.near.lng}`);
    params.set('radius', String(radius));
  }

  try {
    const url = `/api/places/textsearch/json?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[places] textSearch HTTP', res.status, 'for', query);
      return null;
    }
    const data: {
      status?: string;
      error_message?: string;
      results?: Array<{
        place_id?: string;
        geometry?: { location?: { lat: number; lng: number } };
        formatted_address?: string;
      }>;
    } = await res.json();
    const status = data.status;
    if (status && status !== 'OK' && status !== 'ZERO_RESULTS') {
      console.warn('[places] textSearch status', status, data.error_message || '', 'for', query);
      maybeBlock(status, data.error_message);
      return null;
    }
    const hit = data.results?.[0];
    if (!hit?.place_id || !hit.geometry?.location) return null;
    return {
      place_id: hit.place_id,
      lat: hit.geometry.location.lat,
      lng: hit.geometry.location.lng,
      formatted_address: hit.formatted_address,
    };
  } catch (err) {
    console.error('[places] textSearch failed for', query, err);
    return null;
  }
}
